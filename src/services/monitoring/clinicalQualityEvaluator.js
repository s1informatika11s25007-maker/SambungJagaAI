/**
 * SambungJaga AI — Clinical Quality Evaluator
 *
 * Aggregates facility clinical compliance, SLA adherence rate, evidence quality score,
 * and PDP privacy compliance rating into an overall Clinical Quality Index (CQI).
 */

export function evaluateClinicalQualityMetrics({
  obligations = [],
  evidenceVerifications = [],
  auditTrail = []
}) {
  const totalObs = obligations.length || 1;
  const closedObs = obligations.filter(o => o.status === 'verified_closed').length;
  const overdueObs = obligations.filter(o => o.is_overdue || o.status === 'escalated').length;

  const SLAComplianceRate = Math.round(((totalObs - overdueObs) / totalObs) * 100);
  const careClosureRate = Math.round((closedObs / totalObs) * 100);
  const evidenceVerificationRate = evidenceVerifications.length
    ? Math.round((evidenceVerifications.filter(e => e.verifier_status === 'verified').length / evidenceVerifications.length) * 100)
    : 100;

  const clinicalQualityIndex = Math.round(
    (SLAComplianceRate * 0.35) + (careClosureRate * 0.35) + (evidenceVerificationRate * 0.30)
  );

  return {
    clinicalQualityIndex,
    SLAComplianceRate,
    careClosureRate,
    evidenceVerificationRate,
    grade: clinicalQualityIndex >= 90 ? 'EXCELLENT (A)' : (clinicalQualityIndex >= 75 ? 'GOOD (B)' : 'NEEDS_IMPROVEMENT (C)')
  };
}
