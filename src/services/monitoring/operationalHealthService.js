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

export async function getSystemHealthOverview({ facilityId = 'FAC-001' } = {}) {
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
    status: (dbConnected && agentMesh.overallStatus === 'HEALTHY' && dlqItems.length === 0) ? 'HEALTHY' : 'WARNING',
    uptimeSeconds,
    database: {
      connected: dbConnected,
      latencyMs: dbLatencyMs
    },
    agentMesh,
    outboxQueue: outbox,
    deadLetterQueue: {
      count: dlqItems.length,
      items: dlqItems.slice(0, 10)
    }
  };
}

export const getSystemOperationalHealthOverview = getSystemHealthOverview;
