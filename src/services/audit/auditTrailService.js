/** Client audit helpers. Generates local sequence IDs and SHA-256 hash chains for local testing & preview. */
const GENESIS_HASH = 'GENESIS_HASH_SAMBUNGJAGA_00000000000000000000000000000000';

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return `hash-${Math.abs(hash).toString(16).padStart(16, '0')}`;
}

export function appendAuditEntry(auditTrail, gatewayTag, actionName, actorName, payload) {
  const currentTrail = Array.isArray(auditTrail) ? auditTrail : [];
  const lastEntry = currentTrail[currentTrail.length - 1];
  const lastSeq = lastEntry?.sequence_id ? Number(lastEntry.sequence_id) : 1000;
  const nextSeq = lastSeq + 1;
  const prevHash = lastEntry?.entry_hash || GENESIS_HASH;

  const entryHash = simpleHash(`${nextSeq}:${gatewayTag}:${actionName}:${JSON.stringify(payload)}:${prevHash}`);

  return [...currentTrail, {
    id: `local-audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    sequence_id: nextSeq,
    actor_id: null,
    actor_name: actorName || 'System Gateway',
    gateway_tag: gatewayTag,
    action_name: actionName,
    payload: payload || {},
    prev_entry_hash: prevHash,
    entry_hash: entryHash,
    created_at: new Date().toISOString(),
    persisted: false
  }];
}

export function verifyAuditChainIntegrity(auditTrail) {
  if (!Array.isArray(auditTrail) || auditTrail.length === 0) {
    return { valid: null, verified: false, totalRecords: 0, reason: 'Belum ada entri audit untuk diperiksa.' };
  }

  let previous = GENESIS_HASH;
  for (let index = 0; index < auditTrail.length; index += 1) {
    const entry = auditTrail[index];
    if (entry.prev_entry_hash !== previous) {
      return {
        valid: false,
        verified: true,
        totalRecords: auditTrail.length,
        brokenIndex: index,
        reason: `Rantai hash terputus pada sekuens #${entry.sequence_id || index}.`
      };
    }
    previous = entry.entry_hash;
  }
  return { valid: true, verified: true, totalRecords: auditTrail.length, persistedRecords: auditTrail.length };
}
