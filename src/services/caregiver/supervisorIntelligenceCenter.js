/**
 * SambungJaga AI — Supervisor Intelligence Center
 *
 * Handles:
 * - Evidence review
 * - Family complaint review
 * - Supervisor decision control
 * - Priority review queue
 * - Clinical quality indicators
 */

import {
  supabase
} from '../../supabase/client/client';

import {
  reviewEvidenceBySupervisor
} from './evidenceVerifier';

import {
  getOrchestratedPriorityReviewQueue
} from './priorityReviewOrchestrator';

import {
  updateComplaintStatus
} from '../ai/familyLiaisonAgent';

import {
  evaluateClinicalQualityMetrics
} from '../monitoring/clinicalQualityEvaluator';

import {
  evaluateAssignmentQuality
} from '../ai/assignmentQualityMonitor';

import {
  generateFacilityPatternIntelligence
} from '../ai/facilityPatternIntelligence';


/**
 * Fetch supervisor dashboard.
 */

export async function fetchSupervisorIntelligenceDashboard({
  obligations = [],
  residents = [],
  staff = [],
  facilityId = null
}) {
  if (!facilityId) {
    throw new Error('Facility ID wajib tersedia.');
  }

  const reviewQueue =
    await getOrchestratedPriorityReviewQueue({
      facilityId
    });

  const clinicalQuality =
    evaluateClinicalQualityMetrics({
      obligations
    });

  const assignmentQuality =
    evaluateAssignmentQuality(
      [],
      obligations,
      staff
    );

  const facilityInsights =
    generateFacilityPatternIntelligence({
      obligations,
      residents,
      staff,
      facilityId
    });

  return {
    facilityId,

    timestamp:
      new Date().toISOString(),

    pendingReviewCount:
      reviewQueue.length,

    reviewQueue,

    clinicalQuality,

    assignmentQuality,

    facilityInsights
  };
}


/**
 * Execute an authorized supervisor decision.
 *
 * The supervisor ID and facility are context only.
 * Database RPC remains responsible for authorization.
 */

export async function executeSupervisorDecision({
  reviewItem = {},

  decision = 'APPROVED',

  supervisorNotes = '',

  supervisorId = null,

  facilityId = null
} = {}) {
  const {
    id,
    type,
    payload = {}
  } = reviewItem;

  const consequencesExecuted = [];

  try {
    if (!id || !type) {
      return {
        success: false,
        error: 'Item peninjauan tidak lengkap.'
      };
    }

    if (!facilityId) {
      return {
        success: false,
        error: 'Facility ID wajib tersedia.'
      };
    }

    if (
      !['APPROVED', 'REJECTED', 'OVERRIDDEN'].includes(decision)
    ) {
      return {
        success: false,
        error: 'Keputusan supervisor tidak valid.'
      };
    }

    /*
     * Evidence review.
     */

    if (type === 'EVIDENCE_VERIFICATION') {
      const mappedDecision =
        decision === 'APPROVED'
          ? 'approved'
          : decision === 'REJECTED'
            ? 'rejected'
            : 'resubmission_required';

      const result =
        await reviewEvidenceBySupervisor({
          evidenceId:
            payload.id ||
            payload.evidence_id,

          obligationId:
            payload.obligation_id,

          decision: mappedDecision,

          rejectionReason:
            mappedDecision === 'approved'
              ? null
              : supervisorNotes
        });

      if (result?.success !== true) {
        return {
          success: false,

          error:
            result?.error ||
            'Database belum mengonfirmasi keputusan supervisor.'
        };
      }

      consequencesExecuted.push(
        `Bukti ${result.evidenceStatus || mappedDecision}; kewajiban ${result.targetObligationStatus || 'diperbarui oleh RPC'}.`
      );

      // The evidence RPC is responsible for its own authoritative audit record.
      return {
        success: true,

        reviewItemId: id,

        decision,

        consequencesExecuted,

        message:
          'Keputusan supervisor dikonfirmasi oleh database.'
      };
    }

    /*
     * Handover must be signed by each actual staff account.
     */

    if (type === 'UNCONFIRMED_HANDOVER') {
      return {
        success: false,

        error:
          'Serah terima harus ditandatangani oleh akun petugas keluar dan petugas masuk masing-masing. Supervisor tidak boleh membuat tanda tangan pengganti.'
      };
    }

    /*
     * Family complaint.
     */

    if (type === 'FAMILY_COMPLAINT') {
      if (
        decision === 'OVERRIDDEN' &&
        !String(supervisorNotes || '').trim()
      ) {
        return {
          success: false,
          error: 'Catatan alasan keputusan wajib diisi.'
        };
      }

      const result =
        await updateComplaintStatus({
          complaintId: payload.id,

          status:
            decision === 'APPROVED'
              ? 'resolved'
              : 'closed',

          resolutionNotes: supervisorNotes,

          supervisorId,

          facilityId
        });

      if (
        result?.success !== true ||
        !result?.complaint
      ) {
        return {
          success: false,

          error:
            result?.error ||
            'Database belum mengonfirmasi perubahan status pengaduan.'
        };
      }

      consequencesExecuted.push(
        `Pengaduan keluarga diperbarui menjadi ${result.complaint.status}.`
      );

    } else if (type !== 'EVIDENCE_VERIFICATION') {
      return {
        success: false,

        error:
          `Jenis item ${type} belum memiliki handler keputusan yang terverifikasi.`
      };
    }

    /*
     * Audit record.
     */

    const { error: auditError } = await supabase
      .from('audit_trail')
      .insert({
        facility_id: facilityId,

        gateway_tag:
          '[SUPERVISOR] Supervisor Intelligence Center',

        action_name:
          `SUPERVISOR_DECISION_${decision}`,

        payload: {
          reviewItemId: id,
          itemType: type,
          decision,
          supervisorNotes,
          consequencesExecuted
        }
      });

    if (auditError) {
      return {
        success: false,

        error:
          `Perubahan tercatat, tetapi audit trail gagal disimpan: ${auditError.message}`
      };
    }

    return {
      success: true,

      reviewItemId: id,

      decision,

      consequencesExecuted,

      message:
        'Keputusan supervisor berhasil disimpan dan dicatat.'
    };

  } catch (error) {
    console.error(
      '[Supervisor Decision Execution] Failed:',
      error
    );

    return {
      success: false,

      error:
        error?.message ||
        'Keputusan supervisor gagal dieksekusi.'
    };
  }
}