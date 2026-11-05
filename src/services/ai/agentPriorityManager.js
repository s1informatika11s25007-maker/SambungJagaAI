/**
 * SambungJaga AI — Cross-Agent Priority Matrix & Preemption Manager
 *
 * Establishes strict priority preemption rules across all autonomous agents.
 * Ensures emergency clinical safety and SLA breach handling preempts routine
 * background tasks (e.g. routine family disclosures, non-urgent summaries).
 */

export const PRIORITY_TIERS = {
  P0_EMERGENCY_SAFETY: {
    level: 0,
    name: 'P0 - Emergency Safety & Clinical Gate',
    maxLatencyMs: 1500,
    preemptsLower: true
  },
  P1_CRITICAL_CARE: {
    level: 1,
    name: 'P1 - Critical Care Mission & SLA Breach',
    maxLatencyMs: 5000,
    preemptsLower: true
  },
  P2_ROUTINE_OPERATIONS: {
    level: 2,
    name: 'P2 - Routine Operations & Handover',
    maxLatencyMs: 15000,
    preemptsLower: false
  },
  P3_INFORMATIONAL: {
    level: 3,
    name: 'P3 - Informational & Family Disclosure',
    maxLatencyMs: 30000,
    preemptsLower: false
  }
};

/**
 * Evaluates priority tier of an incoming task or event.
 */
export function evaluateTaskPriority(task = {}) {
  const { eventType, priority, isEmergency, isCritical, agentName } = task;

  if (isEmergency || priority === 'emergency' || agentName === 'ClinicalSafetyGate') {
    return PRIORITY_TIERS.P0_EMERGENCY_SAFETY;
  }

  if (isCritical || priority === 'critical' || eventType === 'SLA_BREACH' || agentName === 'SLAWatchdogAgent') {
    return PRIORITY_TIERS.P1_CRITICAL_CARE;
  }

  if (priority === 'important' || eventType === 'EVIDENCE_SUBMITTED' || agentName === 'WorkforceIntelligenceAgent') {
    return PRIORITY_TIERS.P2_ROUTINE_OPERATIONS;
  }

  return PRIORITY_TIERS.P3_INFORMATIONAL;
}

/**
 * Sorts an execution queue in-place or returns a new sorted queue where higher priority tasks
 * (lower level numbers 0, 1) appear before lower priority tasks (2, 3).
 */
export function prioritizeExecutionQueue(queue = []) {
  return [...queue].sort((a, b) => {
    const pA = evaluateTaskPriority(a).level;
    const pB = evaluateTaskPriority(b).level;
    if (pA !== pB) return pA - pB;
    // Tie breaker: older created_at first
    const tA = new Date(a.created_at || a.sys_created_at || 0).getTime();
    const tB = new Date(b.created_at || b.sys_created_at || 0).getTime();
    return tA - tB;
  });
}

/**
 * Checks if incoming task should preempt current lower priority tasks in execution pool.
 */
export function shouldPreemptCurrentTask(incomingTask, currentTask) {
  if (!currentTask) return false;
  const pIncoming = evaluateTaskPriority(incomingTask);
  const pCurrent = evaluateTaskPriority(currentTask);

  return pIncoming.preemptsLower && pIncoming.level < pCurrent.level;
}
