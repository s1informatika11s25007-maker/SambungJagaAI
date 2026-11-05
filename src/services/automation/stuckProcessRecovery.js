/**
 * SambungJaga AI — Stuck Process & Lock Recovery Daemon
 *
 * Automatically detects and releases orphaned outbox locks (>3 minutes lock lease),
 * releases expired worker leases on distributed automation jobs (`lease_expires_at < NOW()`),
 * and escalates stalled evidence verification jobs.
 */

import { supabase as browserClient } from '../../supabase/client/client.js';
import { backendSupabase } from '../../supabase/client/backendClient.js';

const supabase = (typeof window === 'undefined') ? backendSupabase : browserClient;

export async function runStuckProcessRecovery({ facilityId = 'FAC-001' } = {}) {
  const threeMinsAgoIso = new Date(Date.now() - 3 * 60 * 1000).toISOString();
  let orphanedLocksReleased = 0;
  let stalledEvidenceEscalated = 0;

  // 1. Release orphaned system outbox queue locks
  try {
    const { data: released } = await supabase
      .from('system_outbox_queue')
      .update({
        status: 'pending',
        locked_at: null,
        error_message: 'Stuck process lock automatically released by Recovery Daemon'
      })
      .eq('facility_id', facilityId)
      .eq('status', 'processing')
      .lt('locked_at', threeMinsAgoIso)
      .select();

    if (released) orphanedLocksReleased = released.length;
  } catch (err) {
    console.warn('[Stuck Process Recovery] Outbox lock release error:', err.message);
  }

  // 2. Release expired worker leases on automation_jobs table
  try {
    const { data: expiredJobs } = await supabase
      .from('automation_jobs')
      .update({
        status: 'pending',
        lease_owner: null,
        lease_expires_at: null,
        error_message: 'Worker lease expired; released by Recovery Daemon'
      })
      .eq('facility_id', facilityId)
      .eq('status', 'processing')
      .lt('lease_expires_at', new Date().toISOString())
      .select();

    if (expiredJobs) {
      orphanedLocksReleased += expiredJobs.length;
    }
  } catch (err) {
    console.warn('[Stuck Process Recovery] Automation jobs lease release notice:', err.message);
  }

  // 3. Escalate stalled evidence verifications
  try {
    const { data: stalled } = await supabase
      .from('evidence_verifications')
      .update({
        verifier_status: 'pending_review',
        verifier_notes: 'Stalled verification automatically escalated to supervisor'
      })
      .eq('facility_id', facilityId)
      .eq('verifier_status', 'processing')
      .lt('sys_created_at', threeMinsAgoIso)
      .select();

    if (stalled) stalledEvidenceEscalated = stalled.length;
  } catch (err) {
    console.warn('[Stuck Process Recovery] Stalled evidence escalation error:', err.message);
  }

  return {
    timestamp: new Date().toISOString(),
    orphanedOutboxLocksReleased: orphanedLocksReleased,
    stalledEvidenceEscalated: stalledEvidenceEscalated,
    status: 'COMPLETED'
  };
}
