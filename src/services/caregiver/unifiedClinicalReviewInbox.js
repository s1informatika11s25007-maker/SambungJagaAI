/**
 * SambungJaga AI — Unified Clinical Review Inbox Service
 *
 * Aggregates all supervisor review items into a single prioritized queue:
 * 1. Evidence Verification Reviews (pending_review)
 * 2. Unconfirmed Handover Contracts
 * 3. Flagged Entity Resolutions (< 0.85 confidence score)
 * 4. Data Contradictions & Spot Challenges
 * 5. SLA Breach Escalations
 */

import { supabase } from '../../supabase/client/client';

export async function fetchUnifiedClinicalReviewQueue({ facilityId = 'FAC-001', obligations = [] } = {}) {
  const reviewItems = [];

  try {
    // 1. Evidence Verification Reviews
    const { data: verifs } = await supabase
      .from('evidence_verifications')
      .select('*')
      .eq('verifier_status', 'pending_review')
      .eq('facility_id', facilityId);

    const existingObIds = new Set();

    if (verifs && verifs.length > 0) {
      verifs.forEach(v => {
        existingObIds.add(v.obligation_id);
        reviewItems.push({
          id: `review-ev-${v.id}`,
          type: 'EVIDENCE_VERIFICATION',
          priority: v.evidence_grade === 'E3' ? 'emergency' : 'critical',
          title: `Tinjauan Bukti ${v.evidence_grade}`,
          subtitle: `Tugas Obligasi ID: ${v.obligation_id}`,
          payload: v,
          created_at: v.sys_created_at || v.created_at
        });
      });
    }

    // Fallback: check obligations with status 'evidence_submitted'
    if (obligations && obligations.length > 0) {
      const submitted = obligations.filter(o => (o.status === 'evidence_submitted' || o.evidence_submitted) && !existingObIds.has(o.id));
      submitted.forEach(o => {
        reviewItems.push({
          id: `review-ev-ob-${o.id}`,
          type: 'EVIDENCE_VERIFICATION',
          priority: o.priority === 'emergency' ? 'emergency' : 'critical',
          title: `Tinjauan Bukti ${o.required_evidence_grade || 'E1'} — ${o.title}`,
          subtitle: `Pasien: ${o.resident_name || 'Penghuni'} • ID: ${o.id}`,
          payload: {
            id: o.id,
            obligation_id: o.id,
            evidence_grade: o.required_evidence_grade || 'E1',
            verifier_status: 'pending_review',
            facility_id: o.facility_id || facilityId,
            evidence_payload: { note: o.description || 'Bukti foto telah dikirim' }
          },
          created_at: o.sys_created_at || o.valid_from
        });
      });
    }

    // 2. Unconfirmed Handover Contracts
    const { data: handovers } = await supabase
      .from('handover_contracts')
      .select('*')
      .in('contract_status', ['pending_receiver', 'escalated'])
      .eq('facility_id', facilityId);

    if (handovers) {
      handovers.forEach(h => {
        reviewItems.push({
          id: `review-ho-${h.id}`,
          type: 'UNCONFIRMED_HANDOVER',
          priority: h.contract_status === 'escalated' ? 'emergency' : 'important',
          title: `Konfirmasi Serah Terima Shift (${h.shift_name})`,
          subtitle: `Status: ${h.contract_status}`,
          payload: h,
          created_at: h.outgoing_signed_at || h.sys_created_at
        });
      });
    }

    // 3. Unresolved Family Complaints
    const { data: complaints } = await supabase
      .from('family_complaints')
      .select('*')
      .eq('status', 'pending')
      .eq('facility_id', facilityId);

    if (complaints) {
      complaints.forEach(c => {
        reviewItems.push({
          id: `review-fc-${c.id}`,
          type: 'FAMILY_COMPLAINT',
          priority: 'critical',
          title: `Keluhan Keluarga (${c.category || 'Umum'})`,
          subtitle: c.complaint_text,
          payload: c,
          created_at: c.created_at
        });
      });
    }

  } catch (err) {
    console.warn('[Unified Review Inbox] DB fetch fallback:', err);
  }

  // Sort by priority (emergency -> critical -> important) then date
  const priorityOrder = { emergency: 0, critical: 1, important: 2, routine: 3 };
  return reviewItems.sort((a, b) => {
    const pA = priorityOrder[a.priority] ?? 2;
    const pB = priorityOrder[b.priority] ?? 2;
    if (pA !== pB) return pA - pB;
    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
  });
}
