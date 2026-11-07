/**
 * SambungJaga AI — Unified Vercel Serverless Cron Automation Endpoint
 *
 * Combines both Scheduler Sweep and Outbox Worker Execution in a single serverless invocation.
 * Strictly compatible with all Vercel deployment plans (Hobby, Pro, Enterprise) and external cron webhooks.
 *
 * Authorization: requires Authorization: Bearer <CRON_SECRET> for every caller.
 */

import { createClient } from '@supabase/supabase-js';
import { authorizeCronRequest } from '../src/services/security/cronAuth.js';
import { dispatchOutboxEvent } from '../src/services/automation/eventBus.js';
import { runSlaWatchdogSweep } from '../src/services/automation/slaWatchdog.js';
import { runStuckProcessRecovery } from '../src/services/automation/stuckProcessRecovery.js';
import { runDataReconciliation } from '../src/services/automation/dataReconciler.js';
import { runDataRetentionPurgeSweep } from '../src/services/data/dataRetentionEngine.js';
import { checkCertificationExpirations, reconcileAttendanceWithRoster } from '../src/services/ai/hrAutonomousAgent.js';
import { scheduleDailyFamilyDigests, runFamilyResponseReminderSweep } from '../src/services/ai/familyLiaisonAgent.js';
import { runAutonomousPlatformOperationsSweep } from '../src/services/monitoring/autonomousPlatformOpsAgent.js';

export default async function handler(req, res) {
  if (!authorizeCronRequest(req, res)) return;

  const supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ success: false, error: 'Server Configuration Error: Supabase URL/Key missing' });
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const WORKER_ID = `vercel-cron-auto-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  const FACILITY_ID = process.env.FACILITY_ID || process.env.VITE_FACILITY_ID || null;

  const executionLog = {
    startedAt: new Date().toISOString(),
    workerJobsProcessed: 0,
    schedulesExecuted: 0,
    errors: []
  };

  try {
    // A. SCHEDULER SWEEP: Execute Due Automation Schedules
    const nowIso = new Date().toISOString();
    const { data: dueSchedules } = await supabase
      .from('automation_schedules')
      .select('*')
      .eq('is_active', true)
      .lte('next_run_at', nowIso);

    if (dueSchedules && dueSchedules.length > 0) {
      for (const sch of dueSchedules) {
        const nextRunAt = new Date(Date.now() + 3600000).toISOString(); // 1 hour interval
        const { data: locked } = await supabase
          .from('automation_schedules')
          .update({ last_run_at: nowIso, next_run_at: nextRunAt, updated_at: nowIso })
          .eq('id', sch.id)
          .lte('next_run_at', nowIso)
          .select();

        if (!locked || locked.length === 0) continue;

        try {
          if (sch.schedule_name === 'SLA_WATCHDOG_SWEEP') {
            await runSlaWatchdogSweep({ actorName: 'Vercel Cron Automation', facilityId: sch.facility_id });
          } else if (sch.schedule_name === 'STUCK_PROCESS_RECOVERY') {
            await runStuckProcessRecovery();
          } else if (sch.schedule_name === 'ATTENDANCE_DISCREPANCY_SWEEP') {
            const { data: staff } = await supabase.from('staff_profiles').select('*').eq('facility_id', sch.facility_id);
            reconcileAttendanceWithRoster(staff || []);
          } else if (sch.schedule_name === 'DATA_RECONCILIATION_SWEEP') {
            await runDataReconciliation();
          } else if (sch.schedule_name === 'DAILY_MAINTENANCE_AND_DIGESTS') {
            const { data: residents } = await supabase.from('residents').select('*').eq('facility_id', sch.facility_id);
            const { data: obligations } = await supabase.from('bitemporal_obligations').select('*').eq('facility_id', sch.facility_id);
            const { data: staff } = await supabase.from('staff_profiles').select('*').eq('facility_id', sch.facility_id);

            await scheduleDailyFamilyDigests({ residents: residents || [], obligations: obligations || [] });
            await runFamilyResponseReminderSweep({ facilityId: sch.facility_id });
            await checkCertificationExpirations(staff || []);
            await runDataRetentionPurgeSweep();
            await runAutonomousPlatformOperationsSweep({ facilityId: sch.facility_id });
          }
          executionLog.schedulesExecuted++;
        } catch (schErr) {
          executionLog.errors.push(`Schedule [${sch.schedule_name}]: ${schErr.message}`);
        }
      }
    }

    // B. WORKER QUEUE: Claim and Process Distributed Automation Jobs
    const { data: claimedJobs } = await supabase.rpc('fn_claim_automation_jobs', {
      p_worker_id: WORKER_ID,
      p_batch_size: 10,
      p_lease_duration_seconds: 120
    });

    if (claimedJobs && claimedJobs.length > 0) {
      for (const job of claimedJobs) {
        try {
          const dispatchRes = await dispatchOutboxEvent({
            event_type: job.job_type,
            payload: job.payload,
            facility_id: job.facility_id
          });

          if (dispatchRes && dispatchRes.success === true) {
            await supabase.from('automation_jobs').update({
              status: 'completed',
              lease_owner: null,
              lease_expires_at: null
            }).eq('id', job.id).eq('lease_owner', WORKER_ID);

            executionLog.workerJobsProcessed++;
          }
        } catch (jobErr) {
          executionLog.errors.push(`Job [${job.job_type}]: ${jobErr.message}`);
        }
      }
    }

    // Heartbeat log for monitoring
    if (FACILITY_ID) {
      const { error: heartbeatError } = await supabase.from('automation_worker_heartbeats').upsert({
        worker_id: WORKER_ID,
        facility_id: FACILITY_ID,
        worker_type: 'vercel_serverless_cron',
        status: 'active',
        jobs_processed: executionLog.workerJobsProcessed,
        last_heartbeat: new Date().toISOString()
      }, { onConflict: 'worker_id' });
      if (heartbeatError) executionLog.errors.push(`Heartbeat: ${heartbeatError.message}`);
    }

    return res.status(200).json({
      success: true,
      executionLog,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
