import { supabase } from '../../supabase/client/client';

const simulationCache = new Map();
const OPEN_STATUSES = new Set(['open', 'in_progress', 'escalated']);

function combinations(items, size) {
  const result = [];
  const visit = (start, chosen) => {
    if (chosen.length === size) {
      result.push(chosen);
      return;
    }
    for (let index = start; index <= items.length - (size - chosen.length); index += 1) {
      visit(index + 1, [...chosen, items[index]]);
    }
  };
  visit(0, []);
  return result;
}

function canCover(obligation, remainingStaff) {
  const required = Array.isArray(obligation.required_competencies) ? obligation.required_competencies : [];
  if (!required.length) return null;
  return remainingStaff.some((person) => {
    const skills = Array.isArray(person.competencies) ? person.competencies : [];
    return required.every((skill) => skills.includes(skill));
  });
}

/** Deterministic scenario analysis over the currently loaded database records. */
export async function runFailureSetSimulation(staffList = [], obligations = []) {
  if (!Array.isArray(staffList) || !Array.isArray(obligations)) {
    throw new Error('Data staf atau kewajiban tidak valid.');
  }

  const fingerprint = [
    staffList.map((person) => `${person.id}:${person.shift_status}:${(person.competencies || []).join(',')}`).sort().join('|'),
    obligations.map((item) => `${item.id}:${item.status}:${item.priority}:${(item.required_competencies || []).join(',')}`).sort().join('|')
  ].join('::');
  if (simulationCache.has(fingerprint)) return simulationCache.get(fingerprint);

  try {
    const { data, error } = await supabase.functions.invoke('ai_failure_simulator', {
      body: { staffList, obligations }
    });
    if (!error && data?.verified === true && Array.isArray(data.minimalFailureSets)) {
      const result = {
        status: 'verified',
        source: 'server_analysis',
        simulationTimestamp: new Date().toISOString(),
        minimalFailureSets: data.minimalFailureSets,
        recommendation: String(data.recommendation || 'Analisis server selesai.'),
        scenariosTested: Number.isFinite(Number(data.scenariosTested)) ? Number(data.scenariosTested) : null,
        unassessableObligations: Number.isFinite(Number(data.unassessableObligations)) ? Number(data.unassessableObligations) : 0,
        rosterTruncated: false
      };
      simulationCache.set(fingerprint, result);
      return result;
    }
  } catch (error) {
    console.warn('Failure simulation service unavailable; using deterministic local analysis:', error);
  }

  const activeStaff = staffList.filter((person) => person.role === 'caregiver' && person.shift_status === 'on_duty' && person.id);
  const critical = obligations.filter((item) => OPEN_STATUSES.has(item.status) && ['critical', 'emergency'].includes(item.priority));
  const assessable = critical.filter((item) => Array.isArray(item.required_competencies) && item.required_competencies.length > 0);
  const unassessableObligations = critical.length - assessable.length;

  if (activeStaff.length < 1 || assessable.length === 0) {
    const result = {
      status: 'insufficient_data',
      source: 'local_rule_analysis',
      simulationTimestamp: new Date().toISOString(),
      minimalFailureSets: [],
      scenariosTested: 0,
      unassessableObligations,
      recommendation: critical.length === 0
        ? 'Belum ada tugas prioritas tinggi yang dapat diuji. Sistem tidak menyimpulkan kondisi aman.'
        : 'Data kompetensi aktif belum cukup untuk menguji cakupan tugas prioritas tinggi. Lengkapi kompetensi staf dan persyaratan tugas terlebih dahulu.'
    };
    simulationCache.set(fingerprint, result);
    return result;
  }

  const scenarios = [];
  let scenariosTested = 0;
  const upperBound = Math.min(2, activeStaff.length);
  // Evaluate full caregiver roster without arbitrary truncation
  const testRoster = activeStaff;
  for (let size = 1; size <= upperBound; size += 1) {
    for (const absent of combinations(testRoster, size)) {
      scenariosTested += 1;
      const absentIds = new Set(absent.map((person) => person.id));
      const remaining = testRoster.filter((person) => !absentIds.has(person.id));
      const abandonedObligations = assessable.filter((obligation) => canCover(obligation, remaining) === false);
      if (abandonedObligations.length) {
        scenarios.push({
          size,
          absentStaff: absent.map((person) => person.full_name || person.name || 'Staf'),
          impactedObligationsCount: abandonedObligations.length,
          abandonedObligations,
          riskLevel: abandonedObligations.some((item) => item.priority === 'emergency') ? 'EMERGENCY_GAP' : 'HIGH_CRITICAL_GAP'
        });
      }
    }
  }

  const result = {
    status: 'checked',
    source: 'local_rule_analysis',
    simulationTimestamp: new Date().toISOString(),
    minimalFailureSets: scenarios,
    scenariosTested,
    unassessableObligations,
    rosterTruncated: false,
    recommendation: scenarios.length
      ? `Ditemukan ${scenarios.length} skenario ketidakcukupan kompetensi pada model absensi 1–${upperBound} petugas pada seluruh roster (${testRoster.length} perawat). Supervisor perlu meninjau penugasan.`
      : `Tidak ditemukan celah kompetensi pada ${scenariosTested} skenario yang diuji pada seluruh ${testRoster.length} perawat di roster.`,
    limitations: [
      'Analisis memeriksa absensi satu atau dua petugas aktif pada seluruh roster perawat.',
      'Tugas tanpa daftar kompetensi wajib tidak dapat dinilai.'
    ]
  };
  simulationCache.set(fingerprint, result);
  return result;
}
