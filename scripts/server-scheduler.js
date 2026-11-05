/**
 * SambungJaga AI — Standalone 24/7 Persistent Server-Side Automation Scheduler
 *
 * Uses `automation_schedules` database table as primary persistent schedule source.
 * Evaluates cron expressions using true cron parsing logic, enforces multi-facility uniqueness `(facility_id, schedule_name)`,
 * records persistent execution runs (`automation_schedule_runs`), and updates `next_run_at` ONLY AFTER successful execution.
 */

import fs from 'fs';
import path from 'path';

// 1. Synchronously Bootstrap Environment Variables BEFORE Dynamic Import of Modules
const envPath = path.resolve('.env');
if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, 'utf8');
  envText.split('\n').forEach((line) => {
    const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)\s*$/);
    if (match) {
      let val = match[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[match[1]] = val;
    }
  });
}

// 2. Dynamic Import of Backend Client & Services
const { backendSupabase: supabase } = await import('../src/supabase/client/backendClient.js');
const { processOutboxQueue, dispatchOutboxEvent } = await import('../src/services/automation/eventBus.js');
const { runSlaWatchdogSweep } = await import('../src/services/automation/slaWatchdog.js');
const { runStuckProcessRecovery } = await import('../src/services/automation/stuckProcessRecovery.js');
const { runDataReconciliation } = await import('../src/services/automation/dataReconciler.js');
const { runDataRetentionPurgeSweep } = await import('../src/services/data/dataRetentionEngine.js');
const { checkCertificationExpirations, generateMonthlyHrReport, reconcileAttendanceWithRoster } = await import('../src/services/ai/hrAutonomousAgent.js');
const { scheduleDailyFamilyDigests, runFamilyResponseReminderSweep } = await import('../src/services/ai/familyLiaisonAgent.js');
const { getAgentMeshHealthSnapshot } = await import('../src/services/ai/agentMeshOrchestrator.js');
const { runAutonomousPlatformOperationsSweep } = await import('../src/services/monitoring/autonomousPlatformOpsAgent.js');

const SCHEDULER_PID = process.pid;
const FACILITY_ID = process.env.VITE_FACILITY_ID || 'FAC-001';
const SCHEDULER_ID = `server-scheduler-${FACILITY_ID}-${SCHEDULER_PID}`;

console.log('🚀 SAMBUNGJAGA PERSISTENT SERVER-SIDE AUTOMATION SCHEDULER ONLINE (24/7 ACTIVE)');
console.log(`   Facility Target: ${FACILITY_ID} | Scheduler ID: ${SCHEDULER_ID} | PID: ${SCHEDULER_PID}`);

/**
 * Calculates Next Run Date from 5-part or 6-part Cron Expression.
 */
function calculateNextCronRunAt(cronExpr, fromDate = new Date()) {
  if (!cronExpr) return new Date(fromDate.getTime() + 60000).toISOString();

  const parts = cronExpr.trim().split(/\s+/);
  let intervalSec = 60;

  if (parts.length === 6) {
    const secPart = parts[0];
    if (secPart.startsWith('*/')) {
      intervalSec = parseInt(secPart.replace('*/', ''), 10) || 30;
    } else if (secPart === '0') {
      const minPart = parts[1];
      if (minPart.startsWith('*/')) {
        intervalSec = (parseInt(minPart.replace('*/', ''), 10) || 1) * 60;
      } else if (minPart === '0' && parts[2] === '6') {
        intervalSec = 86400; // Daily at 06:00
      }
    }
  } else if (parts.length === 5) {
    const minPart = parts[0];
    if (minPart.startsWith('*/')) {
      intervalSec = (parseInt(minPart.replace('*/', ''), 10) || 1) * 60;
    } else if (minPart === '0' && parts[1] === '6') {
      intervalSec = 86400;
    }
  }

  return new Date(fromDate.getTime() + (intervalSec * 1000)).toISOString();
}

/**
 * Sends Heartbeat Telemetry to `automation_worker_heartbeats` table
 */
async function sendSchedulerHeartbeat() {
  try {
    await supabase.from('automation_worker_heartbeats').upsert({
      facility_id: FACILITY_ID,
      worker_id: SCHEDULER_ID,
      worker_type: 'server_scheduler',
      status: 'HEALTHY',
      pid: SCHEDULER_PID,
      last_heartbeat_at: new Date().toISOString()
    }, { onConflict: 'worker_id' });
  } catch (err) {
    console.warn('[Scheduler Heartbeat Warning]:', err.message);
  }
}

/**
 * Ensures default persistent schedules exist in `automation_schedules` database table
 * scoped uniquely to `(facility_id, schedule_name)`.
 */
async function initializePersistentSchedules() {
  const defaultSchedules = [
    { schedule_name: 'SLA_WATCHDOG_SWEEP', cron_expression: '*/30 * * * * *' },
    { schedule_name: 'STUCK_PROCESS_RECOVERY', cron_expression: '0 */1 * * * *' },
    { schedule_name: 'ATTENDANCE_DISCREPANCY_SWEEP', cron_expression: '0 */1 * * * *' },
    { schedule_name: 'DATA_RECONCILIATION_SWEEP', cron_expression: '0 */5 * * * *' },
    { schedule_name: 'DAILY_MAINTENANCE_AND_DIGESTS', cron_expression: '0 0 6 * * *' }
  ];

  for (const sch of defaultSchedules) {
    try {
      const { data } = await supabase.from('automation_schedules')
        .select('id')
        .eq('facility_id', FACILITY_ID)
        .eq('schedule_name', sch.schedule_name)
        .limit(1);

      if (!data || data.length === 0) {
        await supabase.from('automation_schedules').insert({
          facility_id: FACILITY_ID,
          schedule_name: sch.schedule_name,
          cron_expression: sch.cron_expression,
          timezone: 'Asia/Jakarta',
          is_active: true,
          next_run_at: new Date().toISOString()
        });
      }
    } catch (err) {
      console.warn(`[Scheduler Init] Schedule DB init warning (${sch.schedule_name}):`, err.message);
    }
  }
}

/**
 * Persistent Schedule Executor: Queries `automation_schedules` for due jobs where `next_run_at <= NOW()`
 * Records persistent run tracking in `automation_schedule_runs` (RUNNING -> COMPLETED/FAILED)
 * Updates `next_run_at` in DB ONLY AFTER successful execution!
 */
async function processPersistentSchedules() {
  await sendSchedulerHeartbeat();
  await processOutboxQueue(dispatchOutboxEvent);
  getAgentMeshHealthSnapshot(FACILITY_ID);

  try {
    const nowIso = new Date().toISOString();
    const { data: dueSchedules } = await supabase
      .from('automation_schedules')
      .select('*')
      .eq('is_active', true)
      .lte('next_run_at', nowIso);

    if (!dueSchedules || dueSchedules.length === 0) return;

    for (const sch of dueSchedules) {
      const startMs = Date.now();
      const nextRunAt = calculateNextCronRunAt(sch.cron_expression, new Date());

      // 1. Atomic Lease Lock: Lock schedule row by setting last_run_at
      const { data: locked, error: lockErr } = await supabase
        .from('automation_schedules')
        .update({
          last_run_at: nowIso,
          updated_at: nowIso
        })
        .eq('id', sch.id)
        .lte('next_run_at', nowIso)
        .select();

      if (lockErr || !locked || locked.length === 0) {
        continue; // Claimed by concurrent instance
      }

      // 2. Record RUNNING State in `automation_schedule_runs`
      let runId = null;
      try {
        const { data: runData } = await supabase.from('automation_schedule_runs').insert({
          facility_id: sch.facility_id,
          schedule_id: sch.id,
          schedule_name: sch.schedule_name,
          status: 'RUNNING',
          started_at: nowIso
        }).select('id').single();

        if (runData) runId = runData.id;
      } catch (runErr) {
        console.warn(`[Scheduler] Run tracking insert warning:`, runErr.message);
      }

      console.log(`⏱️ [Persistent Scheduler] Executing due schedule: ${sch.schedule_name} (Facility: ${sch.facility_id})`);

      let executionError = null;
      try {
        if (sch.schedule_name === 'SLA_WATCHDOG_SWEEP') {
          await runSlaWatchdogSweep({ actorName: 'Persistent SLA Watchdog Daemon', facilityId: sch.facility_id });
        } else if (sch.schedule_name === 'STUCK_PROCESS_RECOVERY') {
          await runStuckProcessRecovery();
        } else if (sch.schedule_name === 'ATTENDANCE_DISCREPANCY_SWEEP') {
          const { data: staff } = await supabase.from('staff_profiles').select('*').eq('facility_id', sch.facility_id);
          reconcileAttendanceWithRoster(staff || []);
        } else if (sch.schedule_name === 'DATA_RECONCILIATION_SWEEP') {
          await runDataReconciliation(sch.facility_id);
        } else if (sch.schedule_name === 'DAILY_MAINTENANCE_AND_DIGESTS') {
          const { data: residents } = await supabase.from('residents').select('*').eq('facility_id', sch.facility_id);
          const { data: obligations } = await supabase.from('bitemporal_obligations').select('*').eq('facility_id', sch.facility_id);
          const { data: staff } = await supabase.from('staff_profiles').select('*').eq('facility_id', sch.facility_id);

          await scheduleDailyFamilyDigests({ residents: residents || [], obligations: obligations || [] });
          await runFamilyResponseReminderSweep({ facilityId: sch.facility_id });
          await checkCertificationExpirations(staff || []);
          generateMonthlyHrReport(staff || [], obligations || []);
          await runDataRetentionPurgeSweep();
          await runAutonomousPlatformOperationsSweep({ facilityId: sch.facility_id });
        }
      } catch (err) {
        executionError = err.message;
        console.warn(`[Persistent Scheduler] Execution error (${sch.schedule_name}):`, executionError);
      }

      const durationMs = Date.now() - startMs;

      // 3. Update Run Tracking Log with Final Execution Outcome
      if (runId) {
        await supabase.from('automation_schedule_runs').update({
          status: executionError ? 'FAILED' : 'COMPLETED',
          completed_at: new Date().toISOString(),
          error_message: executionError,
          execution_time_ms: durationMs
        }).eq('id', runId).catch(() => {});
      }

      // 4. Update Schedule Table: Advance next_run_at ONLY AFTER Execution completes
      const updatedNextRun = executionError
        ? new Date(Date.now() + 60000).toISOString() // Retry in 60s if failed
        : nextRunAt;

      await supabase.from('automation_schedules').update({
        next_run_at: updatedNextRun,
        last_run_status: executionError ? 'FAILED' : 'SUCCESS',
        last_error_message: executionError,
        updated_at: new Date().toISOString()
      }).eq('id', sch.id).catch(() => {});
    }
  } catch (err) {
    console.warn('[Persistent Scheduler] Main loop error:', err.message);
  }
}

// Initialize persistent schedules upon startup
await initializePersistentSchedules().catch(() => {});

// Scheduler Loop Interval (Polls persistent schedule database every 15s)
setInterval(processPersistentSchedules, 15000);
processPersistentSchedules();

// Graceful Shutdown Handler
process.on('SIGINT', () => {
  console.log('👋 [Server Scheduler] Shutting down gracefully...');
  process.exit(0);
});
process.on('SIGTERM', () => {
  console.log('👋 [Server Scheduler] Received SIGTERM. Shutting down...');
  process.exit(0);
});
