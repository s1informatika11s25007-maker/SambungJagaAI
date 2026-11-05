import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabase/client/client';
import { appendAuditEntry } from '../../services/audit/auditTrailService';
import { verifyEvidenceSubmission } from '../../services/caregiver/evidenceVerifier';
import { evaluateAuthorityEnvelope } from '../../services/handover/authorityEnvelope';
import { detectFactContradiction } from '../../services/trace/epistemicLedger';
import { validatePromptInjection } from '../../utils/common/validators';
import { OBLIGATION_STATUS, AUTHORITY_ENVELOPE } from '../../types/core/architecture';
import { runCareSuperagent } from '../../services/ai/aiSuperagent';
import { planAutopilot, executeAutopilot, startAutonomousAutopilotLoop, stopAutonomousAutopilotLoop } from '../../services/automation/autopilot';
import { runStuckProcessRecovery } from '../../services/automation/stuckProcessRecovery';
import { runDataReconciliation } from '../../services/automation/dataReconciler';
import { fetchAllData, deriveRules, enrichObligations, updateObligationStatus, assignObligationCaregiver } from '../../services/data/dataService';
import { playA3ReviewAlert, playSuccessChime } from '../../services/dashboard/audioAlertService';
import { runSlaWatchdogSweep } from '../../services/automation/slaWatchdog';
import { handleCaregiverAbsence, findOptimalCaregiverForTask } from '../../services/ai/workforceAgent';
import { analyzeEvidenceIntelligence } from '../../services/caregiver/evidenceIntelligence';
import { synthesizeAutonomousHandoverDraft } from '../../services/handover/handoverContractService';
import { submitFamilyVisitRequest, submitFamilyComplaint } from '../../services/ai/familyLiaisonAgent';
import { checkCertificationExpirations, reconcileAttendanceWithRoster, draftShiftRoster, offboardStaffMember, generateMonthlyHrReport } from '../../services/ai/hrAutonomousAgent';
import { saveToIndexedDb, processOfflineQueueSync, getAllFromIndexedDb } from '../../services/offline/indexedDbStorage';
import {
  acquireWebLock,
  showSupervisorWebPushNotification,
} from '../../services/ai/nativeChromeService';

/**
 * Custom React Hook for SambungJaga AI Core State & Supabase Database Integrations.
 *
 * Client Architecture:
 * The browser UI acts strictly as a Client: emits events to PostgreSQL outbox tables,
 * reads state from Supabase, and listens to Realtime DB subscriptions.
 *
 * All background outbox queue consumption and 24/7 scheduled tasks run EXCLUSIVELY
 * on the Server Worker (`scripts/server-worker.js`) and Vercel Cron (`api/cron-worker.js`).
 * No worker loops run inside the browser React lifecycle!
 */
export function useSambungJaga() {
  const [activeRole, setActiveRole] = useState(() => {
    return localStorage.getItem('activeRole') || 'supervisor';
  });
  const [currentUser, setCurrentUser] = useState(null);
  const [residents, setResidents] = useState([]);
  const [staff, setStaff] = useState([]);
  const [obligations, setObligations] = useState([]);
  const [epistemicFacts, setEpistemicFacts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [auditTrail, setAuditTrail] = useState([]);
  const [handoverContracts, setHandoverContracts] = useState([]);
  const [rules, setRules] = useState([]);
  const [spotChallenges, setSpotChallenges] = useState([]);
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const [offlineQueue, setOfflineQueue] = useState([]);
  const [selectedTrace, setSelectedTrace] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userAvatar, setUserAvatar] = useState('');
  const [autopilotPlan, setAutopilotPlan] = useState(null);

  // Helper Methods Declared BEFORE Effects to Prevent ReferenceError & TDZ Bugs
  const escalateObligation = useCallback(async (id) => {
    const res = await updateObligationStatus(id, OBLIGATION_STATUS.ESCALATED);
    if (res.success) {
      setObligations(prev => prev.map(o => o.id === id ? { ...o, status: OBLIGATION_STATUS.ESCALATED } : o));
    }
    return res;
  }, []);

  const assignObligation = useCallback(async (id, staffId) => {
    const res = await assignObligationCaregiver(id, staffId);
    if (res.success) {
      setObligations(prev => prev.map(o => o.id === id ? { ...o, assigned_caregiver_id: staffId } : o));
    }
    return res;
  }, []);

  // Correct Identity Targeting: Prioritizes Auth UUID (authUserId / user_id) before Staff Profile ID
  const markRoleNotificationsAsShown = useCallback(async (role, userId = null) => {
    const targetUserId = userId || currentUser?.authUserId || currentUser?.user_id || currentUser?.id;
    const nowIso = new Date().toISOString();

    let query = supabase.from('notifications').update({ status: 'read', is_shown: true, is_read: true, read_at: nowIso });
    if (targetUserId) {
      query = query.or(`recipient_user_id.eq.${targetUserId},and(recipient_user_id.is.null,recipient_role.eq.${role})`);
    } else {
      query = query.eq('recipient_role', role);
    }

    const { data, error } = await query.select('*');
    if (error) return { success: false, error: error.message };

    setNotifications((previous) => {
      const byId = new Map((data || []).map((item) => [item.id, item]));
      return previous.map((item) => byId.has(item.id) ? byId.get(item.id) : item);
    });
    return { success: true };
  }, [currentUser?.authUserId, currentUser?.user_id, currentUser?.id]);

  useEffect(() => {
    localStorage.setItem('activeRole', activeRole);
  }, [activeRole]);

  // Online / Offline Window Listener & Load Offline Records
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Load offline pending items on mount
    getAllFromIndexedDb('offline_reports').then(items => {
      if (items && items.length > 0) setOfflineQueue(items);
    }).catch(() => {});

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Login as a specific account object
  const loginUserAccount = (accountObj) => {
    if (accountObj) {
      setCurrentUser(accountObj);
      setActiveRole(accountObj.role);
      localStorage.setItem('currentUser', JSON.stringify(accountObj));
      localStorage.setItem('activeRole', accountObj.role);
      localStorage.setItem('isLoggedIn', 'true');
      if (accountObj.avatar) {
        setUserAvatar(accountObj.avatar);
      }
    }
  };

  const logoutUserAccount = () => {
    setCurrentUser(null);
    setActiveRole('supervisor');
    setUserAvatar('');
    setResidents([]);
    setStaff([]);
    setObligations([]);
    setEpistemicFacts([]);
    setNotifications([]);
    setAuditTrail([]);
    setHandoverContracts([]);
    setRules([]);
    setSpotChallenges([]);
    setOfflineQueue([]);
    localStorage.removeItem('currentUser');
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('activeRole');
  };

  // Initial Data Fetch
  useEffect(() => {
    let isSubscribed = true;

    async function loadData() {
      setIsLoading(true);
      const dataset = await fetchAllData(activeRole);
      if (!isSubscribed) return;

      const rawResidents = dataset.residents || [];
      const rawStaff = dataset.staff_profiles || [];
      const rawObligations = dataset.bitemporal_obligations || [];

      setResidents(rawResidents);
      setStaff(rawStaff);
      setObligations(enrichObligations(rawObligations, rawResidents, rawStaff));
      setEpistemicFacts(dataset.epistemic_facts || []);
      setNotifications(dataset.notifications || []);
      setAuditTrail(dataset.audit_trail || []);
      setHandoverContracts(dataset.handover_contracts || []);
      setRules(dataset.care_rules?.length ? dataset.care_rules : deriveRules(rawObligations, rawResidents, rawStaff));
      setIsLoading(false);
    }

    loadData();

    return () => {
      isSubscribed = false;
    };
  }, [activeRole]);

  // Realtime Supabase Database Subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('sambungjaga_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bitemporal_obligations' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setObligations((previous) => enrichObligations([payload.new, ...previous], residents, staff));
          } else if (payload.eventType === 'UPDATE') {
            setObligations((previous) =>
              previous.map((item) =>
                item.id === payload.new.id
                  ? enrichObligations([payload.new], residents, staff)[0]
                  : item
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setObligations((previous) => previous.filter((item) => item.id !== payload.old.id));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setNotifications((previous) => [payload.new, ...previous]);
          } else if (payload.eventType === 'UPDATE') {
            setNotifications((previous) =>
              previous.map((item) => (item.id === payload.new.id ? payload.new : item))
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [residents, staff]);

  // Captures new caregiver report (voice/text) using Superagent, with IndexedDB offline support
  const captureCareReport = async ({ text, audioBlob = null, sourceType = 'text', residentId = 'auto', actorName = 'Caregiver' }) => {
    if (!text && !audioBlob) return { success: false, error: 'Input tidak boleh kosong.' };

    const selectedResident = residentId === 'auto'
      ? null
      : residents.find((item) => item.id === residentId) || null;

    // Offline Save Flow
    if (isOffline) {
      const offlineItem = {
        id: `offline-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        facility_id: selectedResident?.facility_id || 'FAC-001',
        resident_id: selectedResident?.id || null,
        fact_key: 'offline_report',
        payload: { text, sourceType, residentId: selectedResident?.id || null },
        client_created_at: new Date().toISOString()
      };

      await saveToIndexedDb('offline_reports', offlineItem);
      setOfflineQueue(prev => [...prev, offlineItem]);

      return {
        success: true,
        isOfflineSaved: true,
        message: 'Laporan disimpan terenkripsi di IndexedDB lokal (Mode Offline) dan siap disinkronkan saat terhubung.'
      };
    }

    try {
      const agentResult = await runCareSuperagent(text, {
        resident: selectedResident,
        residents,
        activeObligations: obligations,
        epistemicFacts,
        sourceType
      });

      const matchedResidentId = agentResult.detectedResidentId || selectedResident?.id || null;
      const matchedResident = residents.find((item) => item.id === matchedResidentId) || null;

      // Epistemic fact record
      const newFact = {
        id: `fact-${Date.now()}`,
        facility_id: matchedResident?.facility_id || 'FAC-001',
        resident_id: matchedResidentId,
        fact_key: 'caregiver_voice_report',
        fact_value: { text_raw: text, source_type: sourceType, structured: agentResult.structuredFacts },
        confidence_score: agentResult.structuredFacts ? 0.95 : 0.80,
        sys_created_at: new Date().toISOString()
      };

      setEpistemicFacts((previous) => [newFact, ...previous]);

      // Proposed care obligations
      if (agentResult.proposedObligations && agentResult.proposedObligations.length > 0) {
        const createdList = agentResult.proposedObligations.map((ob, idx) => ({
          id: `ob-${Date.now()}-${idx}`,
          facility_id: matchedResident?.facility_id || 'FAC-001',
          resident_id: matchedResidentId,
          resident_name: matchedResident?.full_name || 'Penghuni',
          assigned_caregiver_id: currentUser?.authUserId || currentUser?.user_id || currentUser?.id || null,
          title: ob.title,
          description: ob.description,
          status: ob.requires_human_review ? 'pending_review' : 'open',
          priority: ob.priority || 'important',
          evidence_grade: ob.required_evidence_grade || 'E1',
          valid_from: new Date().toISOString(),
          valid_until: new Date(Date.now() + (ob.valid_until_minutes || 120) * 60000).toISOString()
        }));

        setObligations((previous) => enrichObligations([...createdList, ...previous], residents, staff));
      }

      playSuccessChime();
      return { success: true, agentResult };
    } catch (err) {
      console.warn('Superagent capture error:', err);
      return { success: false, error: err.message };
    }
  };

  // Evidence Submission Handler
  const submitEvidenceAndClose = async ({ obligationId, evidenceGrade = 'E1', imageDataUrl = null, evidencePayload = {} }) => {
    try {
      const res = await verifyEvidenceSubmission(evidenceGrade, evidenceGrade, { imageDataUrl, ...evidencePayload });
      if (res.success) {
        setObligations((previous) =>
          previous.map((item) =>
            item.id === obligationId
              ? { ...item, status: 'evidence_submitted', evidence_submitted: true }
              : item
          )
        );
        playSuccessChime();
        return { success: true, message: 'Bukti berhasil diunggah dan dikirim untuk tinjauan.' };
      }
      return res;
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // Supervisor Approval Handler
  const approveAuthorityAction = async (obligationId) => {
    try {
      const { data, error } = await supabase
        .from('bitemporal_obligations')
        .update({ status: 'verified_closed', evidence_submitted: true })
        .eq('id', obligationId)
        .select()
        .single();

      if (!error && data) {
        setObligations((previous) =>
          previous.map((item) => (item.id === obligationId ? { ...item, status: 'verified_closed' } : item))
        );
        playSuccessChime();
        return { success: true, updated: data };
      }
    } catch (err) {
      console.warn('Approve action error:', err);
    }
    return { success: false, error: 'Gagal menyetujui tugas.' };
  };

  const createObligation = async (newObligationData) => {
    try {
      const { data, error } = await supabase
        .from('bitemporal_obligations')
        .insert({
          facility_id: newObligationData.facility_id || 'FAC-001',
          resident_id: newObligationData.resident_id,
          assigned_caregiver_id: newObligationData.assigned_caregiver_id || null,
          title: newObligationData.title,
          description: newObligationData.description || '',
          status: 'open',
          priority: newObligationData.priority || 'important',
          evidence_grade: newObligationData.evidence_grade || 'E1',
          valid_from: new Date().toISOString(),
          valid_until: new Date(Date.now() + 4 * 3600 * 1000).toISOString()
        })
        .select()
        .single();

      if (!error && data) {
        const enriched = enrichObligations([data], residents, staff)[0];
        setObligations((previous) => [enriched, ...previous]);
        return { success: true, data: enriched };
      }
    } catch (err) {
      console.warn('Create obligation error:', err);
    }
    return { success: false, error: 'Gagal membuat tugas baru.' };
  };

  const deleteNotification = async (notificationId) => {
    const { error } = await supabase.from('notifications').delete().eq('id', notificationId);
    if (error) return { success: false, error: error.message };
    setNotifications((previous) => previous.filter((item) => item.id !== notificationId));
    return { success: true };
  };

  const clearRoleNotifications = async (role, userId = null) => {
    const targetUserId = userId || currentUser?.authUserId || currentUser?.user_id || currentUser?.id;
    let query = supabase.from('notifications').delete();
    if (targetUserId) {
      query = query.or(`recipient_user_id.eq.${targetUserId},and(recipient_user_id.is.null,recipient_role.eq.${role})`);
    } else {
      query = query.eq('recipient_role', role);
    }

    const { error } = await query;
    if (error) return { success: false, error: error.message };

    setNotifications((previous) => previous.filter((item) => {
      if (targetUserId && item.recipient_user_id === targetUserId) return false;
      return item.recipient_role !== role;
    }));
    return { success: true };
  };

  // Sign Handover Contract
  const signHandoverContract = async (contractId, signerRole) => {
    try {
      const { data, error } = await supabase.rpc('sign_handover_contract', {
        p_contract_id: contractId,
        p_signer_role: signerRole
      });

      if (!error && data) {
        setHandoverContracts((previous) =>
          previous.map((item) => (item.id === contractId ? { ...item, ...data.contract } : item))
        );
        playSuccessChime();
        return { success: true, contract: data.contract };
      }
    } catch (err) {
      console.warn('Sign handover contract error:', err);
    }
    return { success: false, error: 'Gagal menandatangani kontrak handover.' };
  };

  const createHandoverContract = async (contractData) => {
    try {
      const { data, error } = await supabase
        .from('handover_contracts')
        .insert({
          facility_id: contractData.facility_id || 'FAC-001',
          shift_name: contractData.shift_name || 'Siang',
          outgoing_staff_id: contractData.outgoing_staff_id,
          incoming_staff_id: contractData.incoming_staff_id,
          contract_status: 'draft',
          open_obligations_summary: contractData.open_obligations_summary || {}
        })
        .select()
        .single();

      if (!error && data) {
        setHandoverContracts((previous) => [data, ...previous]);
        return { success: true, data };
      }
    } catch (err) {
      console.warn('Create handover contract error:', err);
    }
    return { success: false, error: 'Gagal membuat draft handover contract.' };
  };

  // Synchronizes Offline IndexedDB Stores with Server Database Commit Acknowledgement
  const syncOfflineLedger = async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { success: false, error: 'Perangkat masih offline. Hubungkan ke jaringan untuk sinkronisasi.' };
    }

    try {
      const reportsSync = await processOfflineQueueSync('offline_reports');
      const voiceSync = await processOfflineQueueSync('offline_voice');
      const outboxSync = await processOfflineQueueSync('offline_outbox');

      const totalSynced = (reportsSync.syncedCount || 0) + (voiceSync.syncedCount || 0) + (outboxSync.syncedCount || 0);

      // Refresh data after successful sync
      const dataset = await fetchAllData(activeRole);
      if (dataset) {
        setObligations(enrichObligations(dataset.bitemporal_obligations || [], dataset.residents || [], dataset.staff_profiles || []));
        setEpistemicFacts(dataset.epistemic_facts || []);
      }

      setOfflineQueue([]);
      return {
        success: true,
        syncedCount: totalSynced,
        message: `Berhasil mengunggah & menyinkronkan ${totalSynced} laporan offline ke server dengan konfirmasi komit DB.`
      };
    } catch (syncErr) {
      console.warn('[Offline Sync Error]:', syncErr);
      return { success: false, error: syncErr.message };
    }
  };

  const runAutopilot = async () => {
    const plan = planAutopilot({ obligations, staff, activeRole });
    setAutopilotPlan(plan);
    const result = await executeAutopilot(plan, {
      escalateObligation,
      assignObligation,
      markRoleNotificationsAsShown,
      activeRole
    });
    return result;
  };

  return {
    activeRole,
    setActiveRole,
    currentUser,
    setCurrentUser,
    loginUserAccount,
    logoutUserAccount,
    residents,
    staff,
    obligations,
    epistemicFacts,
    notifications,
    deleteNotification,
    clearRoleNotifications,
    markRoleNotificationsAsShown,
    auditTrail,
    handoverContracts,
    rules,
    setRules,
    spotChallenges,
    isOffline,
    setIsOffline,
    offlineQueue,
    syncOfflineLedger,
    captureCareReport,
    submitEvidenceAndClose,
    approveAuthorityAction,
    createObligation,
    signHandoverContract,
    createHandoverContract,
    selectedTrace,
    setSelectedTrace,
    isLoading,
    userAvatar,
    setUserAvatar,
    autopilotPlan,
    runAutopilot
  };
}
