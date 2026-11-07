/**
 * SambungJaga AI — Priority Review Orchestrator
 *
 * Dynamically routes and orders all pending supervisor reviews, SLA breaches,
 * and spot challenges based on clinical risk score and urgency level.
 */

import { fetchUnifiedClinicalReviewQueue } from './unifiedClinicalReviewInbox';

export async function getOrchestratedPriorityReviewQueue({ facilityId = 'FAC-001', obligations = [] } = {}) {
  const rawQueue = await fetchUnifiedClinicalReviewQueue({ facilityId, obligations });

  // Order queue strictly by clinical priority
  return rawQueue.sort((a, b) => {
    const riskMap = { emergency: 0, critical: 1, important: 2, routine: 3 };
    const rA = riskMap[a.priority] ?? 2;
    const rB = riskMap[b.priority] ?? 2;
    if (rA !== rB) return rA - rB;
    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
  });
}
