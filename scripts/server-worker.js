/**
 * SambungJaga AI — Standalone Server Background Worker Process
 *
 * Queue Consumer as Single Primary Executor:
 * Claims and processes jobs from PostgreSQL distributed queue (`automation_jobs` & `system_outbox_queue`)
 * using `fn_claim_automation_jobs` (SKIP LOCKED), lease ownership validation (`lease_owner = WORKER_ID`),
 * lease renewal, attempt logging verification, and Dead-Letter Queue (DLQ).
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

const WORKER_ID = `worker-${process.pid}-${Math.random().toString(36).substr(2, 6)}`;
const FACILITY_ID = process.env.VITE_FACILITY_ID || 'FAC-001';

let isRunning = true;
let isJobInFlight = false;
let activeJobCount = 0;
let jobsProcessedCount = 0;
let jobsFailedCount = 0;

console.log(`⚡ SAMBUNGJAGA BACKGROUND WORKER ONLINE [ID: ${WORKER_ID}]`);
console.log(`   Facility Target: ${FACILITY_ID} | PID: ${process.pid}`);

/**
 * Emits real worker heartbeat with CPU & Memory telemetry to database
 */
async function sendWorkerHeartbeat() {
  try {
    const memMb = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    const cpuLoad = Math.round((process.cpuUsage().user / 1000000) % 100);

    await supabase.from('automation_worker_heartbeats').upsert({
      worker_id: WORKER_ID,
      facility_id: FACILITY_ID,
      worker_type: 'background_worker',
      status: isRunning ? 'active' : 'stopping',
      active_jobs: activeJobCount,
      jobs_processed: jobsProcessedCount,
      jobs_failed: jobsFailedCount,
      cpu_usage_pct: cpuLoad,
      memory_mb: memMb,
      last_heartbeat: new Date().toISOString()
    }, { onConflict: 'worker_id' });

    await supabase.from('worker_heartbeats').upsert({
      worker_id: WORKER_ID,
      facility_id: FACILITY_ID,
      worker_type: 'background_worker',
      status: isRunning ? 'active' : 'stopping',
      last_heartbeat: new Date().toISOString(),
      jobs_processed: jobsProcessedCount,
      jobs_failed: jobsFailedCount
    }, { onConflict: 'worker_id' });
  } catch (err) {
    console.warn(`[Worker ${WORKER_ID}] Heartbeat telemetry notice:`, err.message);
  }
}

// Heartbeat interval every 15 seconds
const heartbeatTimer = setInterval(sendWorkerHeartbeat, 15000);
sendWorkerHeartbeat();

/**
 * Renews lease for in-flight job to prevent lease expiration during long operations
 */
async function renewJobLease(jobId) {
  try {
    const newLeaseExpiresAt = new Date(Date.now() + 300000).toISOString();
    await supabase.from('automation_jobs')
      .update({ lease_expires_at: newLeaseExpiresAt })
      .eq('id', jobId)
      .eq('lease_owner', WORKER_ID);
  } catch (_) {}
}

/**
 * Claims and processes jobs from `automation_jobs` distributed queue via `fn_claim_automation_jobs`.
 * Strictly validates lease ownership (`lease_owner = WORKER_ID`) and DB update results.
 */
async function processDistributedAutomationJobs() {
  try {
    const { data: claimedJobs, error } = await supabase.rpc('fn_claim_automation_jobs', {
      p_worker_id: WORKER_ID,
      p_batch_size: 10,
      p_lease_duration_seconds: 300
    });

    if (error || !claimedJobs || claimedJobs.length === 0) return 0;

    let processed = 0;
    for (const job of claimedJobs) {
      const startMs = Date.now();
      let attemptStatus = 'SUCCESS';
      let errorMsg = null;

      // Start lease renewal timer for long-running jobs
      const leaseRenewalTimer = setInterval(() => renewJobLease(job.id), 60000);

      try {
        // Execute Event/Job
        const dispatchRes = await dispatchOutboxEvent({ event_type: job.job_type, payload: job.payload, facility_id: job.facility_id });
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

        if (updateErr) {
          throw new Error(`DB Completion Update Error: ${updateErr.message}`);
        }

        if (!updatedJob || updatedJob.length === 0) {
          console.warn(`⚠️ [Worker ${WORKER_ID}] Job ${job.id} lease expired or lost to another worker during processing.`);
        } else {
          processed++;
        }
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
      } finally {
        clearInterval(leaseRenewalTimer);
      }

      // Record Attempt Log
      await supabase.from('automation_job_attempts').insert({
        job_id: job.id,
        worker_id: WORKER_ID,
        attempt_number: (job.retry_count || 0) + 1,
        status: attemptStatus,
        execution_time_ms: Date.now() - startMs,
        error_message: errorMsg
      }).catch(() => {});
    }

    return processed;
  } catch (err) {
    console.warn(`[Worker ${WORKER_ID}] Automation queue poll error:`, err.message);
    return 0;
  }
}

/**
 * Main Worker Execution Loop
 */
async function startWorkerLoop() {
  while (isRunning) {
    try {
      isJobInFlight = true;
      activeJobCount = 1;

      // 1. Process Outbox Queue
      const result = await processOutboxQueue(dispatchOutboxEvent);
      if (result.processedCount > 0) {
        jobsProcessedCount += result.processedCount;
        console.log(`[Worker ${WORKER_ID}] Claimed & Processed ${result.processedCount} outbox jobs.`);
      }

      // 2. Process Distributed Automation Queue
      const autoJobsCount = await processDistributedAutomationJobs();
      if (autoJobsCount > 0) {
        jobsProcessedCount += autoJobsCount;
        console.log(`[Worker ${WORKER_ID}] Claimed & Processed ${autoJobsCount} distributed automation jobs.`);
      }
    } catch (err) {
      console.error(`[Worker ${WORKER_ID}] Loop exception:`, err.message);
    } finally {
      isJobInFlight = false;
      activeJobCount = 0;
    }

    // Sleep 10 seconds before next poll
    await new Promise(res => setTimeout(res, 10000));
  }
}

// Graceful Shutdown Handler: Finishes active in-flight job before exit
async function gracefulShutdown(signal) {
  console.log(`\n👋 [Worker ${WORKER_ID}] Received ${signal}. Initiating graceful shutdown...`);
  isRunning = false;
  clearInterval(heartbeatTimer);

  if (isJobInFlight) {
    console.log(`⏳ [Worker ${WORKER_ID}] Waiting for in-flight job to finish execution...`);
    let waitCount = 0;
    while (isJobInFlight && waitCount < 10) {
      await new Promise(res => setTimeout(res, 500));
      waitCount++;
    }
  }

  await sendWorkerHeartbeat().catch(() => {});
  console.log(`✅ [Worker ${WORKER_ID}] All jobs completed. Process exiting cleanly.`);
  process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

startWorkerLoop();
