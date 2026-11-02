/**
 * SambungJaga AI — Autonomous SLA Watchdog (P0 Innovation)
 *
 * Runs background monitoring 24/7 (via automated scheduler/loop).
 * Detects missed deadlines, critical unassigned tasks, stuck processes,
 * escalates overdue obligations, and logs all actions into audit trail.
 */

import { supabase } from '../../supabase/client/client';
import { emitSystemEvent, processOutboxQueue, getOutboxStatus } from './eventBus';
import { OBLIGATION_STATUS, SYSTEM_EVENT_TYPES } from '../../types/core/architecture';

// Notification cooldown cache to prevent notification spamming
const notificationCooldownMap = new Map();

function isNotificationInCooldown(key, cooldownMs = 15 * 60 * 1000) {
  const lastTime = notificationCooldownMap.get(key);
  const now = Date.now();
  if (lastTime && (now - lastTime) < cooldownMs) {
    return true;
  }
  notificationCooldownMap.set(key, now);
  return false;
}

/**
 * Runs a complete SLA Watchdog check sweep across all active obligations.
 */
export async function runSlaWatchdogSweep({
  obligations = [],
  staff = [],
  residents = [],
  onEscalate = null,
  onNotify = null,
  actorName = 'SLA Watchdog Agent'
}) {
  const now = Date.now();
  let targetObligations = obligations;

  // Attempt database query for active obligations if available
  try {
    const { data, error } = await supabase.from('bitemporal_obligations')
      .select('*')
      .not('status', 'in', '("verified_closed","breached")');
    if (!error && data && data.length > 0) {
      targetObligations = data;
    }
  } catch (err) {
    console.warn('SLA Watchdog DB query fallback to state:', err);
  }

  const summary = {
    checkedCount: targetObligations.length,
    breachedCount: 0,
    escalatedCount: 0,
    criticalUnassignedCount: 0,
    stuckProcessCount: 0,
    notificationsDispatched: 0,
    actionsLogged: 0,
    timestamp: new Date().toISOString()
  };

  const actions = [];

  for (const ob of targetObligations) {
    if (['verified_closed', 'breached'].includes(ob.status)) continue;

    const validUntilMs = ob.valid_until ? new Date(ob.valid_until).getTime() : null;
    const validFromMs = ob.valid_from ? new Date(ob.valid_from).getTime() : (ob.sys_created_at ? new Date(ob.sys_created_at).getTime() : now);
    const isOverdue = validUntilMs && validUntilMs < now;
    const isCritical = ['critical', 'emergency'].includes(ob.priority);
    const isUnassigned = !ob.assigned_caregiver_id;
    const isPendingEvidenceReview = ob.status === 'in_progress' && ob.evidence_submitted && (now - validFromMs > 60 * 60 * 1000);

    // 1. Critical Unassigned Task Detection
    if (isCritical && isUnassigned) {
      summary.criticalUnassignedCount += 1;
      const cooldownKey = `critical-unassigned-${ob.id}`;

      if (!isNotificationInCooldown(cooldownKey, 15 * 60 * 1000)) { // 15 mins cooldown
        actions.push({
          type: 'CRITICAL_UNASSIGNED',
          obligationId: ob.id,
          title: ob.title,
          priority: ob.priority,
          message: `Tugas kritis "${ob.title}" belum memiliki penanggung jawab!`
        });

        await emitSystemEvent(SYSTEM_EVENT_TYPES.SLA_BREACH, {
          obligationId: ob.id,
          issue: 'CRITICAL_UNASSIGNED'
        });

        if (onNotify) {
          await onNotify({
            recipientRole: 'supervisor',
            senderName: actorName,
            title: 'PERINGATAN WATCHDOG: Tugas Kritis Tanpa Penanggung Jawab',
            message: `Tugas "${ob.title}" (${ob.priority}) membutuhkan alokasi petugas segera.`,
            type: 'urgent'
          });
          summary.notificationsDispatched += 1;
        }
      }
    }

    // 2. Overdue SLA Detection & Multi-tiered Escalation
    if (isOverdue) {
      summary.breachedCount += 1;

      if (ob.status !== OBLIGATION_STATUS.ESCALATED) {
        summary.escalatedCount += 1;
        const cooldownKey = `escalate-${ob.id}`;

        if (!isNotificationInCooldown(cooldownKey, 10 * 60 * 1000)) {
          actions.push({
            type: 'ESCALATE_OVERDUE',
            obligationId: ob.id,
            title: ob.title,
            priority: ob.priority,
            message: `Tugas "${ob.title}" melewati tenggat ${new Date(ob.valid_until).toLocaleTimeString('id-ID')} dan dieskalasi.`
          });

          if (onEscalate) {
            await onEscalate(ob.id);
          }

          if (onNotify) {
            const recipient = isCritical ? 'admin_hr' : 'supervisor';
            await onNotify({
              recipientRole: recipient,
              senderName: actorName,
              title: 'ESKALASI OTOMATIS WATCHDOG',
              message: `Tugas "${ob.title}" melewati tenggat waktu dan telah dieskalasi ke ${recipient}.`,
              type: 'urgent'
            });
            summary.notificationsDispatched += 1;
          }
        }
      }
    }

    // 3. Unfinished / Stuck Process Detection (Evidence review stalled > 1h)
    if (isPendingEvidenceReview) {
      summary.stuckProcessCount += 1;
      const cooldownKey = `stuck-evidence-${ob.id}`;

      if (!isNotificationInCooldown(cooldownKey, 30 * 60 * 1000)) {
        actions.push({
          type: 'STUCK_PROCESS',
          obligationId: ob.id,
          title: ob.title,
          message: `Bukti tugas "${ob.title}" belum ditinjau supervisor lebih dari 1 jam.`
        });

        if (onNotify) {
          await onNotify({
            recipientRole: 'supervisor',
            senderName: actorName,
            title: 'PERINGATAN PROSES TERTAHAN: Bukti Belum Ditinjau',
            message: `Tugas "${ob.title}" sudah melampirkan bukti lebih dari 1 jam namun belum ditinjau.`,
            type: 'info'
          });
          summary.notificationsDispatched += 1;
        }
      }
    }
  }

  // 4. Process Outbox & DLQ
  const outboxResult = await processOutboxQueue(async (item) => {
    return { success: true };
  });

  summary.outboxStatus = getOutboxStatus();
  summary.actionsLogged = actions.length;

  // Persist execution log in Supabase if online
  try {
    await supabase.from('agent_execution_logs').insert({
      mission_id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `watchdog-${Date.now()}`,
      agent_name: 'AutonomousSLAWatchdog',
      model_used: 'rule-based-watchdog-v1',
      status: 'success',
      input_payload: { activeObligationCount: targetObligations.length },
      output_payload: summary
    });
  } catch (err) {
    console.warn('Watchdog log persistence fallback:', err);
  }

  return {
    success: true,
    summary,
    actions
  };
}
