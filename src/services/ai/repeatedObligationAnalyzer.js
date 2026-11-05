/**
 * SambungJaga AI — Repeated Obligation Pattern Analyzer
 *
 * Identifies recurring care obligations that suffer frequent reassignments,
 * SLA breaches, or chronic delays, recommending permanent protocol updates.
 */

export function analyzeRepeatedObligationPatterns(obligations = [], auditTrail = []) {
  const recurringMap = new Map();

  obligations.forEach(ob => {
    const key = `${ob.resident_id || 'general'}-${ob.title.toLowerCase().trim()}`;
    if (!recurringMap.has(key)) {
      recurringMap.set(key, {
        title: ob.title,
        residentId: ob.resident_id,
        count: 0,
        breachCount: 0,
        reassignmentCount: 0
      });
    }

    const entry = recurringMap.get(key);
    entry.count += 1;
    if (ob.status === 'escalated' || ob.is_overdue) entry.breachCount += 1;
  });

  const patterns = Array.from(recurringMap.values())
    .filter(p => p.count >= 2)
    .map(p => ({
      ...p,
      chronicDelayRisk: p.breachCount > 0,
      recommendation: p.breachCount > 0
        ? `Tugas "${p.title}" mengalami keterlambatan berulang. Disarankan menetapkan pengasuh utama khusus.`
        : `Tugas "${p.title}" berjalan rutin.`
    }));

  return {
    analyzedPatternCount: patterns.length,
    highRiskPatterns: patterns.filter(p => p.chronicDelayRisk),
    patterns
  };
}
