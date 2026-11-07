/**
 * SambungJaga AI — Autonomous Handover Agent (P1 Innovation)
 *
 * Automates cross-shift care continuity:
 * 1. Fetches open items for outgoing caregiver
 * 2. Identifies tasks missing required evidence
 * 3. Evaluates risks of pending tasks
 * 4. Matches incoming staff by roster & competency
 * 5. Synthesizes complete handover draft
 * 6. Dispatches to incoming staff & tracks 2-party signatures
 * 7. Escalates if unsigned past deadline
 */

import { supabase } from '../../supabase/client/client';

const handoverCache = new Map();

/**
 * Synthesizes an automated handover draft for shift transition.
 */
export function synthesizeAutonomousHandoverDraft({
  outgoingStaff,
  incomingStaff,
  obligations = [],
  residents = [],
  staff = []
}) {
  const openObligations = obligations.filter(
    (o) => o.assigned_caregiver_id === outgoingStaff?.id && ['open', 'in_progress', 'escalated'].includes(o.status)
  );

  const missingEvidence = openObligations.filter(
    (o) => o.required_evidence_grade && o.required_evidence_grade !== 'E0' && !o.evidence_submitted
  );

  const criticalRisks = openObligations.filter(
    (o) => ['critical', 'emergency'].includes(o.priority) || o.status === 'escalated'
  );

  // Extract all required competencies from open tasks
  const requiredCompetencies = new Set();
  openObligations.forEach((ob) => {
    const skills = Array.isArray(ob.required_competencies) ? ob.required_competencies : [];
    skills.forEach((skill) => requiredCompetencies.add(skill));
  });

  // Candidate matching: find caregiver with highest matching competencies
  let matchedIncoming = incomingStaff;
  if (!matchedIncoming) {
    const candidates = staff.filter(
      (s) => s.id !== outgoingStaff?.id && s.role === 'caregiver' && s.shift_status === 'on_duty' && s.is_active !== false
    );

    if (candidates.length > 0) {
      candidates.sort((a, b) => {
        const skillsA = new Set(Array.isArray(a.competencies) ? a.competencies : []);
        const skillsB = new Set(Array.isArray(b.competencies) ? b.competencies : []);
        const matchCountA = [...requiredCompetencies].filter(skill => skillsA.has(skill)).length;
        const matchCountB = [...requiredCompetencies].filter(skill => skillsB.has(skill)).length;
        return matchCountB - matchCountA;
      });
      matchedIncoming = candidates[0];
    }
  }

  const openSummary = openObligations.map((item) => {
    const resident = residents.find((r) => r.id === item.resident_id);
    return {
      id: item.id,
      title: item.title,
      priority: item.priority,
      grade: item.required_evidence_grade || 'E1',
      resident_name: resident?.full_name || item.resident_name || 'Penghuni',
      missing_evidence: !item.evidence_submitted && item.required_evidence_grade !== 'E0'
    };
  });

  const riskLevel = criticalRisks.length > 0 ? 'HIGH' : missingEvidence.length > 0 ? 'MEDIUM' : 'LOW';

  return {
    outgoingStaffId: outgoingStaff?.id,
    outgoingStaffName: outgoingStaff?.full_name,
    incomingStaffId: matchedIncoming?.id,
    incomingStaffName: matchedIncoming?.full_name,
    openObligationsSummary: openSummary,
    missingEvidenceCount: missingEvidence.length,
    criticalRiskCount: criticalRisks.length,
    riskLevel,
    draftSummary: `Draf serah terima dibuat otomatis oleh Agent: ${openObligations.length} tugas terbuka (${missingEvidence.length} belum melampirkan bukti, ${criticalRisks.length} berisiko tinggi).`,
    created_at: new Date().toISOString()
  };
}

/**
 * Automatically creates and saves a shift-end handover contract draft to DB.
 */
export async function autoCreateShiftEndHandoverDraft({
  outgoingStaff,
  incomingStaff,
  obligations = [],
  residents = [],
  staff = []
}) {
  const draft = synthesizeAutonomousHandoverDraft({ outgoingStaff, incomingStaff, obligations, residents, staff });
  const isAutoSignEligible = draft.missingEvidenceCount === 0 && draft.criticalRiskCount === 0;
  const targetStatus = isAutoSignEligible ? 'completed' : 'pending_outgoing';

  try {
    const { data, error } = await supabase.from('handover_contracts').insert({
      outgoing_staff_id: draft.outgoingStaffId,
      incoming_staff_id: draft.incomingStaffId,
      shift_name: `Kontrak Serah Terima Shift ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`,
      open_obligations_summary: draft.openObligationsSummary,
      competency_gaps_identified: [],
      contract_status: targetStatus,
      outgoing_signed_at: isAutoSignEligible ? new Date().toISOString() : null,
      incoming_signed_at: isAutoSignEligible ? new Date().toISOString() : null
    }).select().single();

    if (!error && data) {
      if (draft.incomingStaffId) {
        await supabase.from('notifications').insert({
          recipient_role: 'caregiver',
          sender_name: 'Handover Agent',
          title: isAutoSignEligible ? 'Kontrak Serah Terima Shift Disetujui Otomatis' : 'Draf Serah Terima Shift Siap',
          message: isAutoSignEligible
            ? `Kontrak serah terima shift dari ${draft.outgoingStaffName} disetujui & ditandatangani otomatis oleh Agent Mesh.`
            : `Draf serah terima dari ${draft.outgoingStaffName} telah siap. Harap tinjau dan tanda tangani.`,
          type: 'info'
        });
      }
      return { success: true, contract: data, isAutoSigned: isAutoSignEligible };
    }
  } catch (err) {
    console.warn('Auto create handover contract DB fallback:', err);
  }

  return { success: false, draft };
}

/**
 * Runs intelligent clinical analysis on a handover contract using Edge Function / Smart Engine.
 */
export async function runHandoverAnalysis(contract, outgoingStaff, incomingStaff, openObligations = []) {
  const cacheKey = `${contract?.id || 'c'}_${contract?.updated_at || 't'}_${(openObligations || []).map(o => o.id || o.title).join('-')}`;

  if (handoverCache.has(cacheKey)) {
    return handoverCache.get(cacheKey);
  }

  try {
    const { data, error } = await supabase.functions.invoke('ai_handover_contract', {
      body: { contract, outgoingStaff, incomingStaff, openObligations }
    });

    if (!error && data && data.summaryAnalysis) {
      handoverCache.set(cacheKey, data);
      return data;
    }
  } catch (err) {
    console.warn("AI Handover Contract Edge Function fallback triggered:", err);
  }

  const criticalObs = (openObligations || []).filter((item) => ['critical', 'emergency'].includes(item.priority));
  const importantObs = (openObligations || []).filter((item) => item.priority === 'important');

  const fallbackResult = {
    summaryAnalysis: `Ringkasan lokal mencatat ${openObligations.length} tugas terbuka (${criticalObs.length} prioritas tinggi, ${importantObs.length} penting). Verifikasi AI server tidak tersedia.`,
    riskLevel: criticalObs.length > 0 ? 'HIGH' : 'MEDIUM',
    criticalNotes: criticalObs.map((item) => `Tugas penting untuk shift berikutnya: ${item.title}`),
    isValidated: false,
    source: 'local_summary_fallback'
  };

  handoverCache.set(cacheKey, fallbackResult);
  return fallbackResult;
}

/**
 * Checks for contracts unsigned past deadline and escalates in database.
 */
export async function checkAndEscalateUnsignedHandovers(contracts = []) {
  const escalated = [];
  const now = Date.now();

  let targetContracts = contracts;
  try {
    const { data, error } = await supabase.from('handover_contracts')
      .select('*')
      .neq('contract_status', 'confirmed');
    if (!error && data && data.length > 0) {
      targetContracts = data;
    }
  } catch (err) {
    console.warn('Contract fetch fallback:', err);
  }

  for (const contract of targetContracts) {
    if (contract.contract_status !== 'confirmed') {
      const createdAtMs = new Date(contract.sys_created_at || contract.created_at || now).getTime();
      const hoursPending = (now - createdAtMs) / (1000 * 3600);

      if (hoursPending > 1.0) { // Pending > 1 hour from creation
        try {
          const { data, error } = await supabase.from('handover_contracts')
            .update({
              escalated_at: new Date().toISOString(),
              escalated_reason: 'Kontrak serah terima belum ditandatangani dua pihak lebih dari 1 jam.'
            })
            .eq('id', contract.id)
            .select().single();

          if (!error && data) {
            escalated.push(data);
          }
        } catch (err) {
          console.warn('Contract escalation DB update warning:', err);
        }
      }
    }
  }

  return escalated;
}
