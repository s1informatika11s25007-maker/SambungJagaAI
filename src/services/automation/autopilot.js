/**
 * Database-backed operations assistant. It performs reversible administration only:
 * assigning unassigned work, escalating overdue high-priority work, and inbox cleanup.
 * It never approves care, signs contracts, fabricates evidence, or syncs unsigned offline data.
 */
const isOpen = (item) => item.status === 'open' || item.status === 'in_progress';
const isHighPriority = (item) => item.priority === 'critical' || item.priority === 'emergency';

export function planAutopilot({
  activeRole, obligations = [], notifications = [], staff = [], now = Date.now()
} = {}) {
  const steps = [];
  const myUnreadNotifications = notifications.filter((item) => item.recipient_role === activeRole && !item.is_read);

  if (activeRole === 'supervisor' || activeRole === 'admin_hr') {
    const overdue = obligations.filter((item) => isOpen(item)
      && isHighPriority(item)
      && item.valid_until
      && new Date(item.valid_until).getTime() < now);
    if (overdue.length) {
      steps.push({
        id: 'escalate_overdue',
        label: `Eskalasi ${overdue.length} tugas prioritas tinggi yang terlambat`,
        targets: overdue.map((item) => item.id)
      });
    }

    const pool = staff.filter((person) => person.role === 'caregiver' && person.shift_status === 'on_duty');
    const load = Object.fromEntries(pool.map((person) => [person.id, obligations.filter((item) => isOpen(item) && item.assigned_caregiver_id === person.id).length]));
    const assignments = [];
    obligations.filter((item) => isOpen(item) && !item.assigned_caregiver_id).forEach((item) => {
      const required = Array.isArray(item.required_competencies) ? item.required_competencies : [];
      const eligible = pool.filter((person) => required.every((skill) => (person.competencies || []).includes(skill)));
      if (!eligible.length) return;
      const selected = eligible.reduce((best, person) => load[person.id] < load[best.id] ? person : best);
      load[selected.id] += 1;
      assignments.push({ id: item.id, staffId: selected.id });
    });
    if (assignments.length) {
      steps.push({ id: 'assign_unassigned', label: `Alokasikan ${assignments.length} tugas kepada petugas yang memenuhi kualifikasi`, targets: assignments });
    }
  }

  if (myUnreadNotifications.length) {
    steps.push({ id: 'tidy_notifications', label: `Tandai ${myUnreadNotifications.length} notifikasi sebagai terbaca` });
  }
  return steps;
}

export async function executeAutopilot(steps, handlers) {
  const results = [];
  const run = async (step, execute) => {
    try {
      const outcome = await execute();
      const success = outcome?.success === true;
      results.push({ id: step.id, label: step.label, ok: success, detail: success ? 'Tersimpan di database' : outcome?.error || 'Tidak berhasil disimpan' });
    } catch (error) {
      results.push({ id: step.id, label: step.label, ok: false, detail: error?.message || 'Tidak berhasil disimpan' });
    }
  };

  for (const step of steps || []) {
    if (step.id === 'escalate_overdue') {
      for (const id of step.targets) await run(step, () => handlers.escalateObligation(id));
    } else if (step.id === 'assign_unassigned') {
      for (const target of step.targets) await run(step, () => handlers.assignObligation(target.id, target.staffId));
    } else if (step.id === 'tidy_notifications') {
      await run(step, () => handlers.markRoleNotificationsAsShown(handlers.activeRole));
    }
  }

  const done = results.filter((result) => result.ok).length;
  const summary = results.length
    ? `${done} dari ${results.length} tindakan tersimpan${done < results.length ? ' — tindakan lain perlu diperiksa manual' : ''}.`
    : 'Tidak ada tindakan operasional yang memenuhi syarat saat ini.';
  return { success: done === results.length, results, summary };
}
