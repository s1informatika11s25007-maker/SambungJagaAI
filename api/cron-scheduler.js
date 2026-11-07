/**
 * SambungJaga AI — Vercel Cron Serverless Scheduler Endpoint
 *
 * Triggered automatically by Vercel Cron every 1 minute.
 * Executes due persistent schedules from `automation_schedules` database table with real executors.
 * Strictly requires Bearer CRON_SECRET authorization.
 */

import { createClient } from '@supabase/supabase-js';
import { authorizeCronRequest } from '../src/services/security/cronAuth.js';
import { runSlaWatchdogSweep } from '../src/services/automation/slaWatchdog.js';
import { runStuckProcessRecovery } from '../src/services/automation/stuckProcessRecovery.js';
import { runDataReconciliation } from '../src/services/automation/dataReconciler.js';
import { runDataRetentionPurgeSweep } from '../src/services/data/dataRetentionEngine.js';
import { checkCertificationExpirations, generateMonthlyHrReport, reconcileAttendanceWithRoster } from '../src/services/ai/hrAutonomousAgent.js';
import { scheduleDailyFamilyDigests, runFamilyResponseReminderSweep } from '../src/services/ai/familyLiaisonAgent.js';
import { runAutonomousPlatformOperationsSweep } from '../src/services/monitoring/autonomousPlatformOpsAgent.js';

function parseCronIntervalSeconds(cronExpr, defaultSec = 60) {
  if (!cronExpr) return defaultSec;
  if (cronExpr.includes('*/30')) return 30;
  if (cronExpr.includes('*/5')) return 300;
  if (cronExpr.includes('0 0 6')) return 86400; // Daily at 06:00
  if (cronExpr.includes('*/1')) return 60;
  return defaultSec;
}

export default async function handler(req, res) {
  if (!authorizeCronRequest(req, res)) return;

  const supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ success: false, error: 'Server Configuration Error: Supabase URL/Key missing' });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const nowIso = new Date().toISOString();
    const { data: dueSchedules, error } = await supabase
      .from('automation_schedules')
      .select('*')
      .eq('is_active', true)
      .lte('next_run_at', nowIso);

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    let executedCount = 0;
    for (const sch of (dueSchedules || [])) {
      const intervalSec = parseCronIntervalSeconds(sch.cron_expression, 60);
      const nextRunAt = new Date(Date.now() + (intervalSec * 1000)).toISOString();

      // Atomic lock check in database
      const { data: locked, error: lockErr } = await supabase
        .from('automation_schedules')
        .update({
          last_run_at: nowIso,
          next_run_at: nextRunAt,
          updated_at: nowIso
        })
        .eq('id', sch.id)
        .lte('next_run_at', nowIso)
        .select();

      if (lockErr || !locked || locked.length === 0) continue; // Claimed concurrently

      // Execute Real Schedule Service Logic
      try {
        if (sch.schedule_name === 'SLA_WATCHDOG_SWEEP') {
          await runSlaWatchdogSweep({ actorName: 'Vercel Cron Scheduler', facilityId: sch.facility_id });
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
          generateMonthlyHrReport(staff || [], obligations || []);
          await runDataRetentionPurgeSweep();
          await runAutonomousPlatformOperationsSweep({ facilityId: sch.facility_id });
        }

        executedCount++;
      } catch (execErr) {
        console.warn(`[Vercel Cron Scheduler] Execution error for ${sch.schedule_name}:`, execErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      executedSchedules: executedCount,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
