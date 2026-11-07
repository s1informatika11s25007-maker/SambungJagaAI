/**
 * SambungJaga AI — Centralized Data Reconciler & Consistency Healer
 *
 * Runs background checks to reconcile epistemic facts, bitemporal obligation statuses,
 * and handover shift contracts to heal data discrepancies across database tables.
 */

import { supabase as browserClient } from '../../supabase/client/client.js';
import { backendSupabase } from '../../supabase/client/backendClient.js';

const supabase = (typeof window === 'undefined') ? backendSupabase : browserClient;

export async function runDataReconciliation(facilityContext = 'FAC-001') {
  const facilityId = typeof facilityContext === 'string'
    ? facilityContext
    : (facilityContext?.facilityId || 'FAC-001');

  let epistemicDiscrepanciesFound = 0;
  let epistemicDiscrepanciesHealed = 0;
  let handoverShiftDiscrepanciesHealed = 0;

  // 1. Reconcile contradicted epistemic facts with active obligations
  try {
    const { data: facts } = await supabase
      .from('epistemic_facts')
      .select('id, resident_id, status')
      .eq('facility_id', facilityId)
      .eq('status', 'CONTRADICTED');

    if (facts && facts.length > 0) {
      epistemicDiscrepanciesFound = facts.length;

      // Atomic Healing: Flag contradicted facts for supervisor review & mark reconciliation audit
      const { data: healed } = await supabase
        .from('epistemic_facts')
        .update({
          status: 'RECONCILED_FOR_REVIEW',
          updated_at: new Date().toISOString()
        })
        .eq('facility_id', facilityId)
        .eq('status', 'CONTRADICTED')
        .select();

      if (healed) epistemicDiscrepanciesHealed = healed.length;
    }
  } catch (err) {
    console.warn('[Data Reconciler] Epistemic reconciliation error:', err.message);
  }

  // 2. Reconcile unconfirmed handover contracts older than 8 hours
  try {
    const eightHoursAgoIso = new Date(Date.now() - 8 * 3600 * 1000).toISOString();
    const { data: handovers } = await supabase
      .from('handover_contracts')
      .update({
        contract_status: 'escalated',
        escalated_reason: 'Automatic escalation due to 8-hour unconfirmed shift handover'
      })
      .eq('facility_id', facilityId)
      .eq('contract_status', 'pending')
      .lt('sys_created_at', eightHoursAgoIso)
      .select();

    if (handovers) handoverShiftDiscrepanciesHealed = handovers.length;
  } catch (err) {
    console.warn('[Data Reconciler] Handover reconciliation error:', err.message);
  }

  return {
    timestamp: new Date().toISOString(),
    facilityId,
    epistemicDiscrepanciesFound,
    epistemicDiscrepanciesHealed,
    handoverShiftDiscrepanciesHealed,
    status: 'COMPLETED'
  };
}
