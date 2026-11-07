/**
 * SambungJaga AI — Autonomous SLA Watchdog System (P0 Innovation)
 *
 * Runs background sweeps over active bitemporal obligations:
 * - Detects overdue obligations (valid_until < NOW)
 * - Identifies critical unassigned obligations
 * - Triggers automated escalations and system notifications via Outbox Queue
 */

import { supabase as browserClient } from '../../supabase/client/client.js';
import { backendSupabase } from '../../supabase/client/backendClient.js';

const supabase = (typeof window === 'undefined') ? backendSupabase : browserClient;
import { emitSystemEvent, processOutboxQueue, dispatchOutboxEvent } from './eventBus.js';

export async function runSlaWatchdogSweep({
  actorName = 'SLA Watchdog System',
  facilityId = 'FAC-001',
  obligations = null,
  activeObligations = null,
  onEscalate = null,
  onNotify = null
} = {}) {
  const now = new Date();
  const nowIso = now.toISOString();

  let activeObs = obligations || activeObligations;
  if (!activeObs) {
    try {
      const { data, error } = await supabase
        .from('bitemporal_obligations')
        .select('*')
        .eq('facility_id', facilityId)
        .in('status', ['open', 'in_progress', 'escalated'])
        .not('valid_until', 'is', null);

      if (!error && data) activeObs = data;
    } catch (err) {
      console.warn('SLA Watchdog DB query fallback to state:', err);
    }
  }

  activeObs = activeObs || [];

  let breachedCount = 0;
  let unassignedCount = 0;
  const actions = [];

  for (const ob of activeObs) {
    const validUntil = new Date(ob.valid_until);
    const isOverdue = now > validUntil;
    const isUnassigned = !ob.assigned_caregiver_id;

    if (isOverdue) {
      breachedCount += 1;
      const nextStatus = ob.priority === 'emergency' || ob.priority === 'critical' ? 'escalated' : 'breached';

      actions.push({
        type: 'SLA_BREACH_ACTION',
        obligationId: ob.id,
        title: ob.title,
        priority: ob.priority,
        nextStatus,
        assignedCaregiverId: ob.assigned_caregiver_id
      });

      if (typeof onEscalate === 'function') {
        onEscalate(ob.id);
      }
      if (typeof onNotify === 'function') {
        onNotify(ob);
      }

      // Update DB obligation status if escalated or breached
      try {
        await supabase
          .from('bitemporal_obligations')
          .update({ status: nextStatus })
          .eq('id', ob.id);
      } catch (_) {}

      // Dispatch SLA breach outbox event
      await emitSystemEvent('SLA_BREACH', {
        obligationId: ob.id,
        title: ob.title,
        priority: ob.priority,
        breachedAt: nowIso,
        assignedCaregiverId: ob.assigned_caregiver_id
      }, { facilityId, idempotencyKey: `sla-${ob.id}-${nowIso.slice(0, 13)}` });
    }

    if (isUnassigned && ['critical', 'emergency'].includes(ob.priority)) {
      unassignedCount += 1;
      actions.push({
        type: 'UNASSIGNED_CRITICAL_ACTION',
        obligationId: ob.id,
        title: ob.title,
        priority: ob.priority
      });

      if (typeof onNotify === 'function' && !isOverdue) {
        onNotify(ob);
      }

      await emitSystemEvent('CRITICAL_UNASSIGNED_OBLIGATION', {
        obligationId: ob.id,
        title: ob.title,
        priority: ob.priority
      }, { facilityId });
    }
  }

  // Audit trail record for SLA watchdog sweep
  try {
    await supabase.from('audit_trail').insert({
      facility_id: facilityId,
      gateway_tag: '[A] SLA Watchdog Daemon',
      action_name: 'SLA_WATCHDOG_SWEEP_EXECUTED',
      payload: {
        checkedAt: nowIso,
        activeCheckedCount: activeObs.length,
        breachedCount,
        unassignedCount,
        actionsExecuted: actions.length
      }
    });
  } catch (_) {}

  // Trigger processing of outbox queue
  await processOutboxQueue(dispatchOutboxEvent);

  return {
    success: true,
    timestamp: nowIso,
    summary: {
      activeCheckedCount: activeObs.length,
      breachedCount,
      unassignedCount,
      criticalUnassignedCount: unassignedCount
    },
    actions
  };
}
