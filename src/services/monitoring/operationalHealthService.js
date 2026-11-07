/**
 * SambungJaga AI — Operational Health Monitoring Service
 *
 * Aggregates real-time system metrics: agent mesh health, outbox queue depth,
 * DLQ items, SLA watchdog status, stuck process recoveries, and database latency.
 */

import { supabase } from '../../supabase/client/client.js';
import { getAgentMeshHealthSnapshot } from '../ai/agentMeshOrchestrator.js';
import { getOutboxStatus, fetchDeadLetterQueue } from '../automation/eventBus.js';

let systemStartTime = Date.now();

export async function getSystemHealthOverview({ facilityId = null } = {}) {
  const pingStart = Date.now();
  let dbConnected = false;
  let dbLatencyMs = 0;

  try {
    const { error } = await supabase.from('notifications').select('id').limit(1);
    if (!error) {
      dbConnected = true;
      dbLatencyMs = Date.now() - pingStart;
    }
  } catch (_) {
    dbConnected = false;
  }

  const agentMesh = getAgentMeshHealthSnapshot();
  const outbox = getOutboxStatus();
  const dlqItems = await fetchDeadLetterQueue();

  const uptimeSeconds = Math.floor((Date.now() - systemStartTime) / 1000);

  return {
    timestamp: new Date().toISOString(),
    facilityId,
    status: (dbConnected && agentMesh.overallStatus === 'HEALTHY' && dlqItems.length === 0) ? 'HEALTHY' : 'NOT_FULLY_VERIFIED',
    telemetryScope: 'current browser/process only; distributed server metrics require backend heartbeat queries',
    uptimeSeconds,
    database: {
      connected: dbConnected,
      latencyMs: dbLatencyMs
    },
    agentMesh,
    outboxQueue: { ...outbox, scope: 'in_process_memory_only' },
    deadLetterQueue: {
      count: dlqItems.length,
      scope: 'local_process_only_when_no_facility_scope_is_provided',
      items: dlqItems.slice(0, 10)
    }
  };
}

export const getSystemOperationalHealthOverview = getSystemHealthOverview;
