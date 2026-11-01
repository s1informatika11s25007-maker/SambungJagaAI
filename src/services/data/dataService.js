/** Supabase data access. `null` means the request failed; `[]` is a valid empty result. */
import { supabase } from '../../supabase/client/client';

const STAFF_TABLES = [
  ['residents', null],
  ['staff_profiles', null],
  ['bitemporal_obligations', null],
  ['epistemic_facts', null],
  ['handover_contracts', null],
  ['audit_trail', { col: 'sequence_id', asc: true }],
  ['notifications', { col: 'created_at', asc: false }],
  ['care_rules', { col: 'created_at', asc: false }]
];

const FAMILY_TABLES = [
  ['family_residents', 'residents', null],
  ['family_obligation_summaries', 'bitemporal_obligations', { col: 'sys_created_at', asc: false }]
];

export async function fetchTable(name, order = null) {
  try {
    let query = supabase.from(name).select('*');
    if (order) query = query.order(order.col, { ascending: order.asc });
    const { data, error } = await query;
    return error ? null : (data || []);
  } catch {
    return null;
  }
}

export async function fetchAllData(role = 'caregiver') {
  const family = role === 'family';
  const plan = family
    ? FAMILY_TABLES
    : STAFF_TABLES.map(([name, order]) => [name, name, order]);
  const rows = await Promise.all(plan.map(([table, , order]) => fetchTable(table, order)));
  const result = family
    ? { residents: null, staff_profiles: [], bitemporal_obligations: null, epistemic_facts: [], handover_contracts: [], audit_trail: [], notifications: [], care_rules: [] }
    : {};

  plan.forEach(([, key], index) => { result[key] = rows[index]; });
  if (family) {
    result.residents = result.family_residents;
    result.bitemporal_obligations = result.family_obligation_summaries;
    delete result.family_residents;
    delete result.family_obligation_summaries;
  }
  return result;
}

/** Used only as a compatibility display when the persistent rule table has not been migrated. */
export function deriveRules(obligations = [], residents = [], staff = []) {
  const approver = staff.find((person) => person.role === 'supervisor')?.full_name || null;
  return obligations.map((obligation, index) => {
    const resident = residents.find((person) => person.id === obligation.resident_id)?.full_name || 'Penghuni';
    return {
      id: `derived-${obligation.id}`,
      code: `DERIVED-${index + 1}`,
      version: obligation.rule_version_id || null,
      title: obligation.title || 'Kewajiban tercatat',
      expression: `IF (Resident = "${resident}") THEN REQUIRE (${obligation.title || 'kewajiban'})`,
      description: 'Ringkasan turunan dari kewajiban aktif; bukan aturan tersimpan yang dapat diedit.',
      status: 'derived',
      effective_from: obligation.valid_from || obligation.sys_created_at || null,
      approved_by: approver
    };
  });
}

export function enrichObligations(obligations = [], residents = [], staff = []) {
  return obligations.map((obligation) => ({
    ...obligation,
    resident_name: residents.find((resident) => resident.id === obligation.resident_id)?.full_name || obligation.resident_name || null,
    assigned_caregiver_name: staff.find((person) => person.id === obligation.assigned_caregiver_id)?.full_name || obligation.assigned_caregiver_name || null
  }));
}
