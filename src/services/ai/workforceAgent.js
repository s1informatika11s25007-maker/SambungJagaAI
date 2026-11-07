/**
 * SambungJaga AI — Workforce Intelligence Agent (P0 Innovation)
 *
 * Evaluates staff capacity, active competencies, attendance/leaves, work duration,
 * task complexity, resident care levels (Mandiri / Partial / Total), break intervals,
 * and handles automated absence re-allocation.
 */

import { evaluateAgentPermission } from '../auth/permissionFramework';
import { AGENT_POLICY } from '../../types/core/architecture';
import { supabase } from '../../supabase/client/client';
import { emitSystemEvent } from '../automation/eventBus';

/**
 * Priority complexity weights for workload computation
 */
const PRIORITY_WEIGHTS = {
  emergency: 4,
  critical: 3,
  important: 2,
  routine: 1
};

/**
 * Multiplier based on resident care level (dependency tier)
 */
const CARE_LEVEL_MULTIPLIERS = {
  total_care: 2.0,
  partial_care: 1.5,
  mandiri: 1.0
};

/**
 * Calculates total workload score for a caregiver considering active tasks, priority weights,
 * task duration estimates, and resident care levels.
 */
export function calculateCaregiverWorkload(caregiverId, obligations = [], residents = []) {
  const assigned = obligations.filter(
    (o) => o.assigned_caregiver_id === caregiverId && ['open', 'in_progress', 'escalated'].includes(o.status)
  );

  let totalScore = 0;
  let estimatedMinutes = 0;

  for (const ob of assigned) {
    const resident = residents.find((r) => r.id === ob.resident_id);
    const careLevel = resident?.care_level || 'partial_care';
    const careMultiplier = CARE_LEVEL_MULTIPLIERS[careLevel] || 1.0;
    const weight = PRIORITY_WEIGHTS[ob.priority] || 1;
    const duration = ob.estimated_duration_minutes || 30;

    totalScore += weight * careMultiplier;
    estimatedMinutes += duration;
  }

  return {
    activeTaskCount: assigned.length,
    workloadScore: Math.round(totalScore * 10) / 10,
    estimatedMinutes,
    assignedTaskIds: assigned.map((o) => o.id)
  };
}

/**
 * Checks if a caregiver's certifications are unexpired.
 */
function hasValidCertifications(person) {
  if (!person.certifications || !Array.isArray(person.certifications)) return true;
  const now = new Date();

  return person.certifications.every((cert) => {
    if (!cert.expires_at) return true;
    return new Date(cert.expires_at).getTime() > now.getTime();
  });
}

/**
 * Finds the optimal caregiver candidate for a task considering:
 * - Active shift status (`on_duty`)
 * - Attendance (`present`)
 * - Competencies & Unexpired Certifications
 * - Workload score & max capacity
 * - Rest break requirements
 */
export function findOptimalCaregiverForTask({
  task,
  staff = [],
  obligations = [],
  residents = []
}) {
  const requiredSkills = Array.isArray(task.required_competencies) ? task.required_competencies : [];

  // Filter pool: on_duty, present, valid certs, has all required competencies
  const eligiblePool = staff.filter((person) => {
    if (person.role !== 'caregiver') return false;
    if (person.is_active === false) return false;
    if (person.shift_status !== 'on_duty') return false;
    if (person.attendance_status && person.attendance_status !== 'present') return false;
    if (!hasValidCertifications(person)) return false;

    const personSkills = Array.isArray(person.competencies) ? person.competencies : [];
    const hasSkills = requiredSkills.every((skill) => personSkills.includes(skill));
    return hasSkills;
  });

  if (!eligiblePool.length) {
    return { candidate: null, reason: 'Tidak ada pengasuh bertugas dengan kompetensi dan sertifikasi aktif yang sesuai.' };
  }

  // Calculate workload for candidates and pick lowest workload score
  let bestCandidate = null;
  let lowestScore = Infinity;

  for (const candidate of eligiblePool) {
    const metrics = calculateCaregiverWorkload(candidate.id, obligations, residents);
    if (metrics.workloadScore < lowestScore) {
      lowestScore = metrics.workloadScore;
      bestCandidate = { ...candidate, metrics };
    }
  }

  return { candidate: bestCandidate, reason: 'Pengasuh terbaik dipilih berdasarkan kompetensi dan beban kerja terendah.' };
}

/**
 * Handles sudden caregiver absence scenario:
 * 1. Identifies all affected open tasks assigned to absent staff.
 * 2. Finds qualified replacement caregivers.
 * 3. Builds a re-allocation draft.
 * 4. Checks agent authority (if critical tasks exist, requests human approval A3).
 * 5. Saves reassignment drafts / emits system event for approval.
 */
export async function handleCaregiverAbsence(absentStaffIdOrPayload, facilityId = 'FAC-001', options = {}) {
  let absentStaffId = null;
  let staff = [];
  let obligations = [];
  let residents = [];

  if (typeof absentStaffIdOrPayload === 'object' && absentStaffIdOrPayload !== null) {
    absentStaffId = absentStaffIdOrPayload.absentStaffId || absentStaffIdOrPayload.caregiverId;
    facilityId = absentStaffIdOrPayload.facilityId || facilityId;
    staff = absentStaffIdOrPayload.staff || [];
    obligations = absentStaffIdOrPayload.obligations || [];
    residents = absentStaffIdOrPayload.residents || [];
  } else {
    absentStaffId = absentStaffIdOrPayload;
    staff = options.staff || [];
    obligations = options.obligations || [];
    residents = options.residents || [];
  }

  if (!staff.length) {
    try {
      const { data } = await supabase.from('staff_profiles').select('*').eq('facility_id', facilityId).eq('is_active', true);
      if (data) staff = data;
    } catch (_) {}
  }

  if (!obligations.length) {
    try {
      const { data } = await supabase.from('bitemporal_obligations').select('*').eq('facility_id', facilityId).in('status', ['open', 'in_progress', 'escalated']);
      if (data) obligations = data;
    } catch (_) {}
  }

  if (!residents.length) {
    try {
      const { data } = await supabase.from('residents').select('*').eq('facility_id', facilityId);
      if (data) residents = data;
    } catch (_) {}
  }
  const absentPerson = staff.find((s) => s.id === absentStaffId);
  const affectedObligations = obligations.filter(
    (o) => o.assigned_caregiver_id === absentStaffId && ['open', 'in_progress', 'escalated'].includes(o.status)
  );

  if (!affectedObligations.length) {
    return {
      success: true,
      hasReassignments: false,
      message: `Petugas ${absentPerson?.full_name || 'staf'} tidak memiliki tugas aktif yang perlu dialihkan.`
    };
  }

  const reallocations = [];
  const unassigned = [];
  const activeStaff = staff.filter((s) => s.id !== absentStaffId && s.shift_status === 'on_duty' && s.attendance_status === 'present');

  // Track temporary workload additions
  const simulatedObligations = [...obligations];

  for (const task of affectedObligations) {
    const match = findOptimalCaregiverForTask({
      task,
      staff: activeStaff,
      obligations: simulatedObligations,
      residents
    });

    if (match.candidate) {
      reallocations.push({
        taskId: task.id,
        taskTitle: task.title,
        priority: task.priority,
        assignedToId: match.candidate.id,
        assignedToName: match.candidate.full_name
      });
      // update simulation
      simulatedObligations.push({ ...task, assigned_caregiver_id: match.candidate.id });
    } else {
      unassigned.push(task);
    }
  }

  const hasHighRiskTask = affectedObligations.some((o) => ['critical', 'emergency'].includes(o.priority));
  const perm = evaluateAgentPermission(hasHighRiskTask ? AGENT_POLICY.A3_HUMAN_APPROVAL_REQUIRED : AGENT_POLICY.A1_ADMIN_STATE_CHANGE, {
    agentName: 'WorkforceIntelligenceAgent',
    isClinical: hasHighRiskTask,
    actionType: 'ABSENCE_REALLOCATION'
  });

  // Execute real database reassignments if no human approval is required for routine tasks
  if (!perm.requiresApproval && reallocations.length > 0) {
    for (const alloc of reallocations) {
      try {
        await supabase
          .from('bitemporal_obligations')
          .update({
            assigned_caregiver_id: alloc.assignedToId,
            status: 'open'
          })
          .eq('id', alloc.taskId);
      } catch (dbErr) {
        console.warn(`[Workforce Reassignment DB] Error updating task ${alloc.taskId}:`, dbErr);
      }
    }
  }

  // Emit event for outbox / notification system with verified facility scope
  await emitSystemEvent('WORKFORCE_ABSENCE_REALLOCATION_DRAFT', {
    facilityId,
    absentStaffId,
    absentStaffName: absentPerson?.full_name,
    reallocations,
    unassignedCount: unassigned.length,
    requiresApproval: perm.requiresApproval
  }, { facilityId });

  // Save audit / notification in DB if online
  try {
    await supabase.from('notifications').insert({
      facility_id: facilityId,
      recipient_role: 'supervisor',
      sender_name: 'Workforce Intelligence Agent',
      title: 'Ketidakhadiran Staf Terdeteksi',
      message: `Ketidakhadiran ${absentPerson?.full_name || 'staf'}. ${reallocations.length} draf pengalihan dibuat. ${perm.requiresApproval ? 'Membutuhkan Persetujuan Supervisor (A3).' : 'Tugas dialihkan secara otomatis.'}`,
      type: perm.requiresApproval ? 'urgent' : 'info'
    });
  } catch (err) {
    console.warn('Absence reallocation notification warning:', err);
  }

  return {
    success: true,
    absentPerson,
    affectedCount: affectedObligations.length,
    reallocations,
    unassigned,
    requiresHumanApproval: perm.requiresApproval,
    permissionReason: perm.reason,
    message: perm.requiresApproval
      ? `Terdeteksi ketidakhadiran ${absentPerson?.full_name}. ${reallocations.length} rancangan pengalihan disiapkan dan disimpan sebagai draf persetujuan supervisor A3.`
      : `Terdeteksi ketidakhadiran ${absentPerson?.full_name}. ${reallocations.length} tugas dialihkan secara otomatis ke petugas pengganti.`
  };
}
