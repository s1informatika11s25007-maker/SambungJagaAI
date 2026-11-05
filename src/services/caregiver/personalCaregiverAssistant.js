/**
 * SambungJaga AI — Personal Caregiver Follow-Up Assistant & Workload Planner
 *
 * Generates personalized caregiver task reminders, shift checklists, upcoming
 * deadline countdowns, and integrates workload planning from workforceAgent.js.
 */

import { calculateCaregiverWorkload } from '../ai/workforceAgent';

export function generatePersonalCaregiverDashboard({
  caregiverId,
  obligations = [],
  residents = [],
  staff = []
}) {
  const myObligations = obligations.filter(o => o.assigned_caregiver_id === caregiverId && o.status !== 'verified_closed');
  const workload = calculateCaregiverWorkload(caregiverId, obligations, residents);

  const now = Date.now();
  const upcomingDeadlines = myObligations.map(o => {
    const validUntilMs = o.valid_until ? new Date(o.valid_until).getTime() : now + 60 * 60 * 1000;
    const minutesRemaining = Math.floor((validUntilMs - now) / 60000);
    const isOverdue = minutesRemaining < 0;

    return {
      obligationId: o.id,
      title: o.title,
      residentId: o.resident_id,
      residentName: residents.find(r => r.id === o.resident_id)?.full_name || 'Lansia',
      priority: o.priority,
      minutesRemaining,
      isOverdue,
      urgencyLabel: isOverdue ? 'TERLAMBAT' : (minutesRemaining <= 15 ? 'DARURAT (15m)' : `${minutesRemaining}m tersisa`)
    };
  }).sort((a, b) => a.minutesRemaining - b.minutesRemaining);

  return {
    caregiverId,
    activeTaskCount: myObligations.length,
    workloadScore: workload.score,
    workloadStatus: workload.status,
    upcomingDeadlines,
    personalChecklist: upcomingDeadlines.slice(0, 5)
  };
}
