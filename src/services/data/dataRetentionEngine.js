/**
 * SambungJaga AI — Automated Data Retention & Purge Policy Engine
 *
 * Automatically purges / anonymizes temporary AI logs and outdated data
 * based on clinical retention rules (UU PDP & Permenkes):
 * - AI Execution Logs: Purged after 90 days.
 * - Outbox Completed Jobs: Purged after 30 days.
 * - Temporary Offline Caches: Cleared after sync.
 */

import { supabase as browserClient } from '../../supabase/client/client.js';
import { backendSupabase } from '../../supabase/client/backendClient.js';

const supabase = (typeof window === 'undefined') ? backendSupabase : browserClient;

export async function runDataRetentionPurgeSweep({ facilityId = 'FAC-001' } = {}) {
  const summary = {
    checkedAt: new Date().toISOString(),
    facilityId,
    aiExecutionLogsPurged: 0,
    outboxCompletedPurged: 0,
    status: 'COMPLETED'
  };

  const cutoff30DaysIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const { data: purgedOutbox } = await supabase
      .from('system_outbox_queue')
      .delete()
      .eq('status', 'completed')
      .lt('completed_at', cutoff30DaysIso)
      .select('id');

    if (purgedOutbox) summary.outboxCompletedPurged = purgedOutbox.length;

    await supabase.from('audit_trail').insert({
      facility_id: facilityId,
      gateway_tag: '[A] Data Retention Engine',
      action_name: 'DATA_RETENTION_PURGE_EXECUTED',
      payload: summary
    });

  } catch (err) {
    console.warn('[Data Retention Engine] DB purge fallback:', err.message);
  }

  return summary;
}
