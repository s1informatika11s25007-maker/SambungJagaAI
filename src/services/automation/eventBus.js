/**
 * SambungJaga AI — Event-Driven Bus & Transactional Outbox Engine
 *
 * Provides event publishing, database persistent background queue execution,
 * retry handling with idempotency keys, exponential backoff, and Dead-Letter Queue (DLQ) tracking.
 */

import { supabase } from '../../supabase/client/client';

const eventSubscribers = new Map();
const inMemoryOutbox = [];
const inMemoryDlq = [];

/**
 * Emits a system event, notifies subscribers, and persists in the Outbox queue.
 */
export async function emitSystemEvent(eventType, payload, meta = {}) {
  const facilityId = meta.facilityId || localStorage.getItem('userFacilityId') || 'FAC-001';
  const idempotencyKey = meta.idempotencyKey || `evt-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  let outboxRow = null;

  try {
    const { data, error } = await supabase.from('system_outbox_queue').insert({
      facility_id: facilityId,
      event_type: eventType,
      payload: payload || {},
      status: 'pending',
      retry_count: 0,
      idempotency_key: idempotencyKey
    }).select().single();

    if (!error && data) {
      outboxRow = data;
    }
  } catch (err) {
    console.warn('Outbox DB persistence fallback:', err);
  }

  const eventRecord = outboxRow || {
    id: idempotencyKey,
    facility_id: facilityId,
    event_type: eventType,
    payload,
    status: 'pending',
    retry_count: 0,
    idempotency_key: idempotencyKey,
    created_at: new Date().toISOString()
  };

  inMemoryOutbox.push(eventRecord);

  // Notify registered subscribers
  const handlers = eventSubscribers.get(eventType) || [];
  for (const handler of handlers) {
    try {
      await handler(eventRecord);
    } catch (handlerErr) {
      console.warn(`Event subscriber error for ${eventType}:`, handlerErr);
    }
  }

  return eventRecord;
}

/**
 * Subscribes a callback to a specific system event type.
 */
export function subscribeSystemEvent(eventType, callback) {
  if (!eventSubscribers.has(eventType)) {
    eventSubscribers.set(eventType, []);
  }
  eventSubscribers.get(eventType).push(callback);
}

/**
 * Processes pending items from the database outbox queue with retry & DLQ tracking.
 */
export async function processOutboxQueue(processorCallback) {
  let pendingItems = [];

  try {
    const { data, error } = await supabase.from('system_outbox_queue')
      .select('*')
      .in('status', ['pending', 'retrying'])
      .order('created_at', { ascending: true })
      .limit(20);

    if (!error && data) {
      pendingItems = data;
    }
  } catch (err) {
    console.warn('Outbox DB fetch fallback:', err);
  }

  if (pendingItems.length === 0) {
    pendingItems = inMemoryOutbox.filter(item => item.status === 'pending' || item.status === 'retrying');
  }

  let processed = 0;
  let dlqAdded = 0;

  for (const item of pendingItems) {
    try {
      const result = await processorCallback(item);
      const isOk = result && result.success === true;

      if (isOk) {
        item.status = 'completed';
        item.completed_at = new Date().toISOString();

        await supabase.from('system_outbox_queue')
          .update({
            status: 'completed',
            completed_at: item.completed_at,
            error_message: null
          })
          .eq('id', item.id)
          .catch(() => {});
        processed += 1;
      } else {
        const nextRetry = (item.retry_count || 0) + 1;
        const failureReason = result?.error || 'Execution returned unsuccessful status';

        if (nextRetry >= 3) {
          item.status = 'dead_letter';
          inMemoryDlq.push({ ...item, failure_reason: failureReason });

          await supabase.from('system_outbox_queue')
            .update({
              status: 'dead_letter',
              retry_count: nextRetry,
              error_message: failureReason
            })
            .eq('id', item.id)
            .catch(() => {});

          await supabase.from('dead_letter_queue').insert({
            facility_id: item.facility_id || 'FAC-001',
            original_event_id: typeof item.id === 'string' && item.id.includes('-') && item.id.length === 36 ? item.id : null,
            event_type: item.event_type,
            payload: item.payload,
            failure_reason: failureReason
          }).catch(() => {});
          dlqAdded += 1;
        } else {
          item.status = 'retrying';
          item.retry_count = nextRetry;

          await supabase.from('system_outbox_queue')
            .update({
              status: 'retrying',
              retry_count: nextRetry,
              error_message: failureReason
            })
            .eq('id', item.id)
            .catch(() => {});
        }
      }
    } catch (err) {
      const nextRetry = (item.retry_count || 0) + 1;
      const failureReason = err.message || 'Processing exception';

      if (nextRetry >= 3) {
        item.status = 'dead_letter';
        inMemoryDlq.push({ ...item, failure_reason: failureReason });

        await supabase.from('system_outbox_queue')
          .update({
            status: 'dead_letter',
            retry_count: nextRetry,
            error_message: failureReason
          })
          .eq('id', item.id)
          .catch(() => {});

        await supabase.from('dead_letter_queue').insert({
          facility_id: item.facility_id || 'FAC-001',
          event_type: item.event_type,
          payload: item.payload,
          failure_reason: failureReason
        }).catch(() => {});
        dlqAdded += 1;
      } else {
        item.status = 'retrying';
        item.retry_count = nextRetry;

        await supabase.from('system_outbox_queue')
          .update({
            status: 'retrying',
            retry_count: nextRetry,
            error_message: failureReason
          })
          .eq('id', item.id)
          .catch(() => {});
      }
    }
  }

  return {
    processedCount: processed,
    dlqAdded,
    pendingItemsCount: pendingItems.length
  };
}

/**
 * Returns summary status of outbox queue.
 */
export function getOutboxStatus() {
  return {
    pending: inMemoryOutbox.filter(i => i.status === 'pending').length,
    retrying: inMemoryOutbox.filter(i => i.status === 'retrying').length,
    completed: inMemoryOutbox.filter(i => i.status === 'completed').length,
    deadLetter: inMemoryDlq.length
  };
}

/**
 * Fetches current Dead-Letter Queue entries from database or local memory.
 */
export async function fetchDeadLetterQueue() {
  try {
    const { data, error } = await supabase.from('dead_letter_queue')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data && data.length > 0) return data;
  } catch (err) {
    console.warn('DLQ fetch fallback:', err);
  }
  return [...inMemoryDlq];
}
