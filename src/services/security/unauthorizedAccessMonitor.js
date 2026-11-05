/**
 * SambungJaga AI — Unauthorized Access & Multi-Tenant Violation Monitor
 *
 * Tracks failed authentication attempts, multi-tenant boundary violation attempts,
 * and unverified API requests across the platform.
 */

import { triggerSecurityIncident, INCIDENT_SEVERITY } from './incidentResponseEngine.js';

const failedAttemptsMap = new Map();

export async function recordFailedAccessAttempt({ userId, ipAddress, attemptType = 'INVALID_AUTH', facilityId = 'FAC-001' }) {
  const key = userId || ipAddress || 'unknown';
  const count = (failedAttemptsMap.get(key) || 0) + 1;
  failedAttemptsMap.set(key, count);

  if (count >= 5) {
    await triggerSecurityIncident({
      incidentType: 'REPEATED_UNAUTHORIZED_ACCESS_ATTEMPTS',
      severity: INCIDENT_SEVERITY.HIGH,
      actorUserId: userId,
      details: { attemptCount: count, ipAddress, attemptType },
      facilityId
    });
  }

  return { failedAttempts: count, lockoutWarning: count >= 3 };
}

export async function detectUnauthorizedAccessViolations({ facilityId = 'FAC-001' } = {}) {
  const violations = [];
  for (const [key, count] of failedAttemptsMap.entries()) {
    if (count >= 3) {
      violations.push({ targetKey: key, attemptCount: count, facilityId });
    }
  }
  return violations;
}
