/**
 * SambungJaga AI — Assignment Quality Monitor
 *
 * Continuously evaluates the quality, competency match, workload balance,
 * and fatigue risk of caregiver obligation allocations.
 */

import { calculateCaregiverWorkload } from './workforceAgent';

export function evaluateAssignmentQuality(assignments = [], obligations = [], staff = []) {
  if (!assignments.length) {
    return {
      overallQualityScore: 100,
      competencyMatchRate: 100,
      workloadBalanceIndex: 100,
      fatigueRiskCount: 0,
      status: 'EXCELLENT'
    };
  }

  let competencyMatches = 0;
  let fatigueRiskCount = 0;

  assignments.forEach(asgn => {
    const ob = obligations.find(o => o.id === asgn.id || o.id === asgn.obligationId);
    const person = staff.find(s => s.id === asgn.staffId || s.id === asgn.caregiverId);

    if (ob && person) {
      const req = Array.isArray(ob.required_competencies) ? ob.required_competencies : [];
      const personComp = Array.isArray(person.competencies) ? person.competencies : [];
      const isMatch = req.every(c => personComp.includes(c));
      if (isMatch) competencyMatches += 1;

      const wl = calculateCaregiverWorkload(person.id, obligations, []);
      if (wl.status === 'OVERLOADED') fatigueRiskCount += 1;
    }
  });

  const matchRate = Math.round((competencyMatches / assignments.length) * 100);
  const balanceIndex = Math.max(0, 100 - (fatigueRiskCount * 20));
  const overallScore = Math.round((matchRate * 0.6) + (balanceIndex * 0.4));

  return {
    overallQualityScore: overallScore,
    competencyMatchRate: matchRate,
    workloadBalanceIndex: balanceIndex,
    fatigueRiskCount,
    status: overallScore >= 85 ? 'EXCELLENT' : (overallScore >= 70 ? 'GOOD' : 'NEEDS_ATTENTION')
  };
}
