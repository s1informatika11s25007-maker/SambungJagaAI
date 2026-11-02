/**
 * SambungJaga AI — Agent Permission Framework (A0 - A3)
 *
 * A0: Read-only query (No state change)
 * A1: Reversible administrative state change (draft, queue, auto-assign)
 * A2: Notification dispatch (Alert, notification)
 * A3: Mandatory Human Supervisor Approval required (clinical decision, evidence sign-off, high-risk reassignment)
 */

import { AGENT_POLICY } from '../../types/core/architecture';

/**
 * Audit log buffer for agent permission evaluations
 */
const permissionEvaluationLogs = [];

/**
 * Evaluates whether an agent action requires human approval or can execute autonomously.
 * @param {string} policyLevel - 'A0' | 'A1' | 'A2' | 'A3'
 * @param {Object} actionContext - Action details
 * @returns {{ allowedAutonomous: boolean, policy: string, requiresApproval: boolean, reason: string }}
 */
export function evaluateAgentPermission(policyLevel, actionContext = {}) {
  const isClinical = Boolean(actionContext.isClinical || actionContext.priority === 'critical' || actionContext.priority === 'emergency');
  const isIrreversible = Boolean(actionContext.isIrreversible || actionContext.actionType === 'CLOSE_OBLIGATION' || actionContext.actionType === 'CLINICAL_DECISION');

  let result;

  if (policyLevel === AGENT_POLICY.A3_HUMAN_APPROVAL_REQUIRED || isClinical || isIrreversible) {
    result = {
      allowedAutonomous: false,
      policy: AGENT_POLICY.A3_HUMAN_APPROVAL_REQUIRED,
      requiresApproval: true,
      reason: 'Tindakan ini berkategori A3 (Keputusan klinis / ireversibel / prioritas tinggi). Membutuhkan persetujuan supervisor manusia.'
    };
  } else if (policyLevel === AGENT_POLICY.A2_NOTIFICATION_DISPATCH) {
    result = {
      allowedAutonomous: true,
      policy: AGENT_POLICY.A2_NOTIFICATION_DISPATCH,
      requiresApproval: false,
      reason: 'Tindakan A2 (Notifikasi & Pengingat) berjalan otomatis.'
    };
  } else if (policyLevel === AGENT_POLICY.A1_ADMIN_STATE_CHANGE) {
    result = {
      allowedAutonomous: true,
      policy: AGENT_POLICY.A1_ADMIN_STATE_CHANGE,
      requiresApproval: false,
      reason: 'Tindakan A1 (Administratif reversibel) berjalan otomatis oleh agent.'
    };
  } else {
    result = {
      allowedAutonomous: true,
      policy: AGENT_POLICY.A0_READ_ONLY,
      requiresApproval: false,
      reason: 'Tindakan A0 (Baca data) berjalan secara otomatis.'
    };
  }

  // Record audit trace of permission enforcement
  const logEntry = {
    evaluatedAt: new Date().toISOString(),
    agentName: actionContext.agentName || 'SystemAgent',
    actionType: actionContext.actionType || 'GENERIC_ACTION',
    requestedPolicy: policyLevel,
    enforcedPolicy: result.policy,
    allowedAutonomous: result.allowedAutonomous,
    requiresApproval: result.requiresApproval,
    reason: result.reason
  };

  permissionEvaluationLogs.unshift(logEntry);
  if (permissionEvaluationLogs.length > 100) permissionEvaluationLogs.pop();

  return result;
}

/**
 * Returns recent agent permission evaluation audit trace.
 */
export function getPermissionEvaluationLogs() {
  return [...permissionEvaluationLogs];
}
