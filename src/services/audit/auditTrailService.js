/** Client audit helpers. Cryptographic hashes are generated only by the database trigger. */
export function appendAuditEntry(auditTrail, gatewayTag, actionName, actorName, payload) {
  const currentTrail = Array.isArray(auditTrail) ? auditTrail : [];
  return [...currentTrail, {
    id: `local-audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    sequence_id: null,
    actor_id: null,
    actor_name: actorName || 'System Gateway',
    gateway_tag: gatewayTag,
    action_name: actionName,
    payload: payload || {},
    prev_entry_hash: null,
    entry_hash: null,
    created_at: new Date().toISOString(),
    persisted: false
  }];
}

export function verifyAuditChainIntegrity(auditTrail) {
  if (!Array.isArray(auditTrail) || auditTrail.length === 0) {
    return { valid: null, verified: false, totalRecords: 0, reason: 'Belum ada entri audit untuk diperiksa.' };
  }
  const persisted = auditTrail
    .filter((entry) => Number.isFinite(Number(entry.sequence_id)) && entry.entry_hash && entry.prev_entry_hash)
    .sort((a, b) => Number(a.sequence_id) - Number(b.sequence_id));
  const localCount = auditTrail.length - persisted.length;
  if (localCount > 0 || persisted.length !== auditTrail.length) {
    return {
      valid: null,
      verified: false,
      totalRecords: auditTrail.length,
      persistedRecords: persisted.length,
      localRecords: localCount,
      reason: `${localCount} entri belum memiliki hash server. Verifikasi penuh belum dapat dilakukan.`
    };
  }
  const genesis = 'GENESIS_HASH_SAMBUNGJAGA_00000000000000000000000000000000';
  let previous = genesis;
  for (let index = 0; index < persisted.length; index += 1) {
    const entry = persisted[index];
    if (entry.prev_entry_hash !== previous) {
      return {
        valid: false, verified: true, totalRecords: persisted.length,
        brokenIndex: index, reason: `Rantai hash terputus pada sekuens #${entry.sequence_id}.`
      };
    }
    previous = entry.entry_hash;
  }
  return { valid: true, verified: true, totalRecords: persisted.length, persistedRecords: persisted.length };
}
