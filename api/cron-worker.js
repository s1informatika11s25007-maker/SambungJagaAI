/**
 * SambungJaga AI — Vercel Cron Serverless Background Worker Endpoint
 *
 * Triggered automatically by Vercel Cron every 1 minute.
 * Claims and executes jobs from PostgreSQL `automation_jobs` queue using `fn_claim_automation_jobs`.
 * Executes real event handlers (`dispatchOutboxEvent`), validates DB update results, logs attempts, and handles retries/DLQ.
 * Strictly requires Bearer CRON_SECRET authorization.
 */

import { createClient } from '@supabase/supabase-js';
import { dispatchOutboxEvent } from '../src/services/automation/eventBus.js';

export default async function handler(req, res) {
  // 1. Mandatory Authorization & CRON_SECRET Verification
  const cronSecret = process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const authHeader = req.headers['authorization'];

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid or missing Bearer CRON_SECRET token' });
  }

  const supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ success: false, error: 'Server Configuration Error: Supabase URL/Key missing' });
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const WORKER_ID = `vercel-cron-worker-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

  try {
    const { data: claimedJobs, error } = await supabase.rpc('fn_claim_automation_jobs', {
      p_worker_id: WORKER_ID,
      p_batch_size: 10,
      p_lease_duration_seconds: 120
    });

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    let processed = 0;
    for (const job of (claimedJobs || [])) {
      const startMs = Date.now();
      let attemptStatus = 'SUCCESS';
      let errorMsg = null;

      try {
        // Execute Real Event/Job Action
        const dispatchRes = await dispatchOutboxEvent({
          event_type: job.job_type,
          payload: job.payload,
          facility_id: job.facility_id
        });

        if (!dispatchRes || dispatchRes.success !== true) {
          throw new Error(dispatchRes?.error || `Job execution for '${job.job_type}' returned unsuccessful status.`);
        }

        // Strictly Validate Lease Ownership on DB Completion Update
        const { data: updatedJob, error: updateErr } = await supabase.from('automation_jobs')
          .update({
            status: 'completed',
            lease_owner: null,
            lease_expires_at: null,
            error_message: null
          })
          .eq('id', job.id)
          .eq('lease_owner', WORKER_ID)
          .select();

        if (updateErr || !updatedJob || updatedJob.length === 0) {
          throw new Error(`DB Completion Update Failed or Lease Lost: ${updateErr?.message || 'lease lost'}`);
        }

        processed++;
      } catch (execErr) {
        attemptStatus = 'FAILED';
        errorMsg = execErr.message;
        const nextRetry = (job.retry_count || 0) + 1;

        if (nextRetry >= (job.max_retries || 3)) {
          // Move to Dead-Letter Queue
          await supabase.from('automation_jobs')
            .update({ status: 'dead_letter', error_message: errorMsg, lease_owner: null, lease_expires_at: null })
            .eq('id', job.id);

          await supabase.from('automation_dead_letters').insert({
            facility_id: job.facility_id,
            original_job_id: job.id,
            job_type: job.job_type,
            payload: job.payload,
            failure_reason: errorMsg
          });
        } else {
          // Schedule Retry with Exponential Backoff
          const backoffDelayMs = Math.pow(2, nextRetry) * 30000;
          await supabase.from('automation_jobs').update({
            status: 'retrying',
            retry_count: nextRetry,
            scheduled_at: new Date(Date.now() + backoffDelayMs).toISOString(),
            lease_owner: null,
            lease_expires_at: null,
            error_message: errorMsg
          }).eq('id', job.id);
        }
      }

      // Record Attempt Log Entry in Database
      await supabase.from('automation_job_attempts').insert({
        job_id: job.id,
        worker_id: WORKER_ID,
        attempt_number: (job.retry_count || 0) + 1,
        status: attemptStatus,
        execution_time_ms: Date.now() - startMs,
        error_message: errorMsg
      }).catch(() => {});
    }

    return res.status(200).json({
      success: true,
      processedJobs: processed,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
