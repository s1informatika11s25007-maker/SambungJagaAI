import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabase/client/client';
import { submitEvidenceAndCloseObligationAtomic } from '../../services/caregiver/evidenceVerifier';
import { OBLIGATION_STATUS } from '../../types/core/architecture';
import { runCareSuperagent } from '../../services/ai/aiSuperagent';
import { planAutopilot, executeAutopilot } from '../../services/automation/autopilot';
import { fetchAllData, deriveRules, enrichObligations, updateObligationStatus, assignObligationCaregiver } from '../../services/data/dataService';
import { playSuccessChime } from '../../services/dashboard/audioAlertService';
import { saveToIndexedDb, processOfflineQueueSync, getAllFromIndexedDb } from '../../services/offline/indexedDbStorage';

const DEFAULT_RESIDENTS = [
  { id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b01', full_name: 'Ibu Hj. Aminah (78 th)', room_number: 'Kamar 102 — Dahlia', medical_condition_summary: 'Diabetes Melitus Tipe 2, Hipertensi', facility_id: 'FAC-001', care_level: 'partial_care', status: 'active', disclosure_level: 'filtered_summary' },
  { id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b02', full_name: 'Bapak Drs. Bambang (82 th)', room_number: 'Kamar 105 — Dahlia', medical_condition_summary: 'Hipertensi, Demensia Ringan', facility_id: 'FAC-001', care_level: 'partial_care', status: 'active', disclosure_level: 'filtered_summary' },
  { id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b03', full_name: 'Ibu Sri Rahayu (74 th)', room_number: 'Kamar 201 — Mawar', medical_condition_summary: 'Osteoarthritis, Pemulihan Fraktur', facility_id: 'FAC-001', care_level: 'total_care', status: 'active', disclosure_level: 'filtered_summary' },
  { id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b04', full_name: 'Bapak Ir. H. Ahmad Dahlan (80 th)', room_number: 'Kamar 201 — Anggrek', medical_condition_summary: 'PPOK (COPD) Stabil & Osteoarthritis', facility_id: 'FAC-001', care_level: 'partial_care', status: 'active', disclosure_level: 'filtered_summary' },
  { id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b05', full_name: 'Opa Fransiscus Xaverius (85 th)', room_number: 'Kamar 301 — Melati', medical_condition_summary: 'Gagal Jantung Kongestif Kelas II', facility_id: 'FAC-001', care_level: 'partial_care', status: 'active', disclosure_level: 'filtered_summary' }
];

const DEFAULT_STAFF = [
  { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', full_name: 'Suster Dewi Pertiwi, Amd.Kep', role: 'caregiver', shift_status: 'on_duty', facility_id: 'FAC-001', is_active: true },
  { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', full_name: 'Perawat Budi Santoso, S.Kep', role: 'caregiver', shift_status: 'on_duty', facility_id: 'FAC-001', is_active: true },
  { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', full_name: 'Perawat Siti Rahmawati, A.Md.Kep', role: 'caregiver', shift_status: 'on_duty', facility_id: 'FAC-001', is_active: true },
  { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a05', full_name: 'Pengasuh Maya Indah', role: 'caregiver', shift_status: 'on_duty', facility_id: 'FAC-001', is_active: true }
];

const DEFAULT_HANDOVER_CONTRACTS = [
  {
    id: '66eebc99-9c0b-4ef8-bb6d-6bb9bd380601',
    outgoing_staff_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01',
    incoming_staff_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a04',
    shift_name: 'Serah Terima Shift Pagi ke Siang (14:00 WIB)',
    open_obligations_summary: [],
    contract_status: 'confirmed',
    hash_signature: 'handover-sha256-8a9b7c6d5e4f3a2b1c0d',
    facility_id: 'FAC-001'
  },
  {
    id: '66eebc99-9c0b-4ef8-bb6d-6bb9bd380602',
    outgoing_staff_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01',
    incoming_staff_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02',
    shift_name: 'Serah Terima Shift Malam ke Pagi (07:00 WIB)',
    open_obligations_summary: [],
    contract_status: 'confirmed',
    hash_signature: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    facility_id: 'FAC-001'
  },
  {
    id: '66eebc99-9c0b-4ef8-bb6d-6bb9bd380603',
    outgoing_staff_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01',
    incoming_staff_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03',
    shift_name: 'Serah Terima Shift Siang ke Sore (15:00 WIB)',
    open_obligations_summary: [],
    contract_status: 'pending_receiver',
    hash_signature: 'b3b18366669378b937d2b2b5ca94a4b428c65a6935d84a4e95f103253e711244',
    facility_id: 'FAC-001'
  }
];

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
  const [autopilotPlan, setAutopilotPlan] = useState([]);

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
  const markRoleNotificationsAsShown = useCallback(async (_role, userId = null) => {
    const targetUserId = userId || currentUser?.authUserId || currentUser?.user_id || currentUser?.id;
    const nowIso = new Date().toISOString();

    if (!targetUserId) return { success: false, error: 'Identitas akun penerima tidak tersedia; pembaruan notifikasi ditolak.' };
    const query = supabase.from('notifications').update({ status: 'read', is_shown: true, is_read: true, read_at: nowIso }).eq('recipient_user_id', targetUserId);

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
      // Keep only a non-sensitive navigation hint locally. The account profile is
      // restored from the authenticated Supabase session and must not be cached in localStorage.
      localStorage.removeItem('currentUser');
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

      const fetchedResidents = dataset.residents || [];
      const fetchedStaff = dataset.staff_profiles || [];
      const rawObligations = dataset.bitemporal_obligations || [];

      const rawResidents = fetchedResidents.length > 0 ? fetchedResidents : DEFAULT_RESIDENTS;
      const hasCaregiver = fetchedStaff.some((s) => s.role === 'caregiver');
      const rawStaff = fetchedStaff.length > 0
        ? (hasCaregiver ? fetchedStaff : [...fetchedStaff, ...DEFAULT_STAFF])
        : DEFAULT_STAFF;

      const fetchedHandovers = dataset.handover_contracts || [];
      const rawHandover = fetchedHandovers.length > 0 ? fetchedHandovers : DEFAULT_HANDOVER_CONTRACTS;

      setResidents(rawResidents);
      setStaff(rawStaff);
      setObligations(enrichObligations(rawObligations, rawResidents, rawStaff));
      setEpistemicFacts(dataset.epistemic_facts || []);
      setNotifications(dataset.notifications || []);
      setAuditTrail(dataset.audit_trail || []);
      setHandoverContracts(rawHandover);
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

  // Captures caregiver report and persists the fact + proposed obligations atomically.
  const captureCareReport = async ({ text, audioBlob = null, sourceType = 'text', residentId = 'auto', actorName = 'Caregiver' }) => {
    if (!text && !audioBlob) return { success: false, error: 'Input tidak boleh kosong.' };

    const selectedResident = residentId === 'auto'
      ? null
      : residents.find((item) => item.id === residentId) || null;

    const facilityId = currentUser?.facility_id || selectedResident?.facility_id || null;
    if (!facilityId) {
      return { success: false, error: 'Fasilitas akun belum terverifikasi. Laporan tidak disimpan; hubungi administrator fasilitas.' };
    }

    // Offline mode is supported only when encryption is active; saveToIndexedDb now fails closed.
    if (isOffline) {
      if (!selectedResident?.id) {
        return { success: false, needsResidentConfirmation: true, error: 'Pilih penghuni terlebih dahulu sebelum menyimpan laporan offline.' };
      }
      if (typeof crypto === 'undefined' || !crypto.randomUUID) {
        return { success: false, error: 'Browser tidak mendukung secure UUID; laporan offline tidak disimpan.' };
      }
      const offlineItem = {
        id: crypto.randomUUID(),
        facility_id: facilityId,
        resident_id: selectedResident?.id || null,
        fact_key: 'offline_report',
        payload: { text, sourceType, residentId: selectedResident?.id || null, actorName },
        client_created_at: new Date().toISOString()
      };

      try {
        await saveToIndexedDb('offline_reports', offlineItem);
        setOfflineQueue((previous) => [...previous, offlineItem]);
        return {
          success: true,
          isOfflineSaved: true,
          message: 'Laporan disimpan terenkripsi pada perangkat dan menunggu sinkronisasi.'
        };
      } catch (error) {
        return { success: false, error: `Penyimpanan offline aman gagal: ${error.message}` };
      }
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
      const matchedResident = residents.find((item) => item.id === matchedResidentId) || selectedResident;
      if (!matchedResidentId || !matchedResident) {
        return {
          success: false,
          needsResidentConfirmation: true,
          residentCandidates: agentResult.residentCandidates || [],
          error: 'Penghuni belum dapat diidentifikasi dengan yakin. Pilih dan konfirmasi penghuni sebelum laporan disimpan.'
        };
      }
      if (agentResult.isAmbiguous) {
        return {
          success: false,
          needsResidentConfirmation: true,
          residentCandidates: agentResult.residentCandidates || [],
          error: 'Identitas penghuni masih ambigu. Konfirmasi penghuni secara manual sebelum membuat catatan perawatan.'
        };
      }

      const proposed = Array.isArray(agentResult.proposedObligations)
        ? agentResult.proposedObligations.slice(0, 3).map((item) => ({
            title: item.title,
            description: item.description,
            priority: item.priority,
            required_evidence_grade: item.required_evidence_grade || 'E1',
            valid_until_minutes: item.valid_until_minutes || 120
          }))
        : [];

      const { data: persisted, error: persistError } = await supabase.rpc('fn_record_care_fact_and_obligation', {
        p_resident_id: matchedResidentId,
        p_fact_key: 'caregiver_report',
        p_fact_value: {
          text_raw: text || null,
          source_type: sourceType,
          source_actor_name: actorName,
          structured: agentResult.structuredFacts || null,
          confidence: Number.isFinite(Number(agentResult.confidence ?? agentResult.confidenceScore))
            ? Math.max(0, Math.min(1, Number(agentResult.confidence ?? agentResult.confidenceScore)))
            : null,
          reported_at: new Date().toISOString()
        },
        p_source_type: sourceType === 'voice' ? 'voice_stt' : 'text_input',
        p_source_actor_id: currentUser?.id || null,
        p_close_obligation_id: null,
        p_close_note: null,
        p_proposed_obligations: proposed
      });

      if (persistError) {
        throw new Error(`Database menolak penyimpanan laporan: ${persistError.message}`);
      }
      if (!persisted || persisted.success !== true || !persisted.fact_id) {
        throw new Error('Database tidak memberikan acknowledgement penyimpanan fakta.');
      }

      // Refresh persisted records; UI state is a projection of the database, not the source of truth.
      const [factResult, obligationResult] = await Promise.all([
        supabase.from('epistemic_facts').select('*').eq('id', persisted.fact_id).maybeSingle(),
        persisted.mission_id
          ? supabase.from('bitemporal_obligations').select('*').eq('mission_id', persisted.mission_id)
          : Promise.resolve({ data: [], error: null })
      ]);

      if (factResult.error) throw new Error(`Laporan tersimpan, tetapi pembacaan ulang fakta gagal: ${factResult.error.message}`);
      if (obligationResult.error) throw new Error(`Laporan tersimpan, tetapi pembacaan ulang tugas gagal: ${obligationResult.error.message}`);
      if (factResult.data) setEpistemicFacts((previous) => [factResult.data, ...previous.filter((item) => item.id !== factResult.data.id)]);
      if (obligationResult.data?.length) {
        setObligations((previous) => enrichObligations([...obligationResult.data, ...previous.filter((item) => !obligationResult.data.some((saved) => saved.id === item.id))], residents, staff));
      }

      playSuccessChime();
      return { success: true, agentResult, persisted, message: 'Laporan dan fakta tersimpan di database. Usulan tugas dibuat sesuai hasil RPC.' };
    } catch (err) {
      console.warn('Care report persistence failed:', err);
      return { success: false, error: err.message || 'Laporan gagal disimpan.' };
    }
  };

  // Evidence Submission Handler — the actual image must reach private Storage before RPC commit.
  const submitEvidenceAndClose = async ({ obligationId, evidenceGrade = 'E1', imageDataUrl = null, payload = {}, evidencePayload = {} }) => {
    const obligation = obligations.find((item) => item.id === obligationId);
    const facilityId = obligation?.facility_id || currentUser?.facility_id || null;
    if (!obligation || !facilityId) {
      return { success: false, error: 'Tugas atau fasilitas terverifikasi tidak ditemukan.' };
    }
    if (evidenceGrade === 'E1' && !imageDataUrl) {
      return { success: false, error: 'Bukti E1 wajib menyertakan file foto yang telah diproses.' };
    }

    const result = await submitEvidenceAndCloseObligationAtomic({
      obligationId,
      evidenceGrade,
      evidencePayload: { ...payload, ...evidencePayload },
      imageDataUrl,
      facilityId
    });

    if (!result.success) return result;

    setObligations((previous) => previous.map((item) => item.id === obligationId
      ? { ...item, status: 'evidence_submitted', evidence_submitted: true }
      : item));
    playSuccessChime();
    return { ...result, message: 'Bukti tersimpan di Private Storage dan menunggu persetujuan supervisor.' };
  };

  // Supervisor Approval Handler — only the database RPC can authorize closure.
  const approveAuthorityAction = async (obligationId) => {
    if (activeRole !== 'supervisor') {
      return { success: false, error: 'Hanya supervisor terautentikasi yang boleh menyetujui penutupan tugas.' };
    }
    try {
      const { data, error } = await supabase.rpc('approve_obligation_closure', {
        p_obligation_id: obligationId
      });
      if (error) return { success: false, error: error.message };
      if (!data || data.success !== true) return { success: false, error: data?.message || 'Approval tidak dikonfirmasi database.' };
      setObligations((previous) => previous.map((item) => item.id === obligationId
        ? { ...item, status: 'verified_closed', evidence_submitted: true }
        : item));
      playSuccessChime();
      return { success: true, updated: data.obligation || data };
    } catch (err) {
      console.warn('Approve action error:', err);
      return { success: false, error: err.message || 'Gagal menyetujui tugas.' };
    }
  };

  const createObligation = async (newObligationData) => {
    const resident = residents.find((item) => item.id === newObligationData.resident_id);
    if (!resident || !(resident.facility_id || currentUser?.facility_id)) {
      return { success: false, error: 'Penghuni dan fasilitas aktif harus terverifikasi sebelum tugas dibuat.' };
    }
    if (!newObligationData.title?.trim()) {
      return { success: false, error: 'Judul tugas wajib diisi.' };
    }
    try {
      const { data, error } = await supabase.rpc('create_care_obligation', {
        p_resident_id: newObligationData.resident_id,
        p_title: newObligationData.title.trim(),
        p_description: newObligationData.description || null,
        p_priority: newObligationData.priority || 'important',
        p_required_evidence_grade: newObligationData.required_evidence_grade || newObligationData.evidence_grade || 'E1',
        p_assigned_caregiver_id: newObligationData.assigned_caregiver_id || null,
        p_valid_until_minutes: Number(newObligationData.valid_until_minutes) || 240
      });
      if (error) return { success: false, error: error.message };
      if (!data?.success || !data.obligation?.id) {
        return { success: false, error: data?.message || 'Database tidak mengonfirmasi pembuatan tugas.' };
      }
      const enriched = enrichObligations([data.obligation], residents, staff)[0];
      setObligations((previous) => [enriched, ...previous.filter((item) => item.id !== enriched.id)]);
      return { success: true, data: enriched };
    } catch (err) {
      console.warn('Create obligation error:', err);
      return { success: false, error: err.message || 'Gagal membuat tugas baru.' };
    }
  };

  const deleteNotification = async (notificationId) => {
    const { error } = await supabase.from('notifications').delete().eq('id', notificationId);
    if (error) return { success: false, error: error.message };
    setNotifications((previous) => previous.filter((item) => item.id !== notificationId));
    return { success: true };
  };

  const clearRoleNotifications = async (_role, userId = null) => {
    const targetUserId = userId || currentUser?.authUserId || currentUser?.user_id || currentUser?.id;
    let query = supabase.from('notifications').delete();
    if (targetUserId) {
      query = query.eq('recipient_user_id', targetUserId);
    } else {
      return { success: false, error: 'Identitas akun penerima tidak tersedia; penghapusan notifikasi ditolak.' };
    }

    const { error } = await query;
    if (error) return { success: false, error: error.message };

    setNotifications((previous) => previous.filter((item) => {
      return item.recipient_user_id !== targetUserId;
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
    const incomingStaffId = contractData?.incoming_staff_id || contractData?.incomingStaffId;
    const shiftName = contractData?.shift_name || contractData?.shiftName;
    if (!incomingStaffId || !shiftName) {
      return { success: false, error: 'Petugas penerima dan nama shift wajib dipilih.' };
    }

    try {
      const { data, error } = await supabase.rpc('create_handover_contract', {
        p_incoming_staff_id: incomingStaffId,
        p_shift_name: shiftName
      });
      if (error) throw error;
      if (!data?.success || !data?.contract?.id) {
        return { success: false, error: data?.message || 'Server tidak mengonfirmasi penyimpanan kontrak.' };
      }
      setHandoverContracts((previous) => [data.contract, ...previous.filter((item) => item.id !== data.contract.id)]);
      return { success: true, data: data.contract, message: data.message };
    } catch (err) {
      console.warn('Create handover contract error:', err);
      return { success: false, error: err?.message || 'Gagal membuat draft handover contract.' };
    }
  };

  // Synchronizes Offline IndexedDB Stores with Server Database Commit Acknowledgement
  const syncOfflineLedger = async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { success: false, error: 'Perangkat masih offline. Hubungkan ke jaringan untuk sinkronisasi.' };
    }
    if (!currentUser?.facility_id || !currentUser?.id) {
      return { success: false, error: 'Profil staf dan fasilitas belum terverifikasi.' };
    }

    try {
      const reportsSync = await processOfflineQueueSync('offline_reports', async (item) => {
        if (!item.id || !item.resident_id || item.facility_id !== currentUser.facility_id) {
          return { success: false, acknowledged: false, error: 'Identitas laporan/penghuni/fasilitas tidak valid.' };
        }
        const { data, error } = await supabase.rpc('sync_offline_care_report', {
          p_client_submission_id: item.id,
          p_resident_id: item.resident_id,
          p_fact_value: {
            text: item.payload?.text || item.text || '',
            source_type: item.payload?.sourceType || 'text',
            actor_name: item.payload?.actorName || 'Caregiver',
            client_created_at: item.client_created_at
          }
        });
        if (error) return { success: false, acknowledged: false, error: error.message };
        return {
          success: data?.success === true,
          acknowledged: data?.acknowledged === true,
          error: data?.message || 'Server belum mengonfirmasi laporan offline.'
        };
      });

      const remainingReports = await getAllFromIndexedDb('offline_reports');
      const remainingVoice = await getAllFromIndexedDb('offline_voice');
      const remainingOutbox = await getAllFromIndexedDb('offline_outbox');
      const remaining = [...remainingReports, ...remainingVoice, ...remainingOutbox];
      setOfflineQueue(remaining);

      if (reportsSync.syncedCount > 0) {
        const dataset = await fetchAllData(activeRole);
        if (dataset) {
          setObligations(enrichObligations(dataset.bitemporal_obligations || [], dataset.residents || [], dataset.staff_profiles || []));
          setEpistemicFacts(dataset.epistemic_facts || []);
        }
      }

      const failedCount = reportsSync.failedCount || 0;
      const unsupportedPending = remainingVoice.length + remainingOutbox.length;
      return {
        success: failedCount === 0 && unsupportedPending === 0,
        syncedCount: reportsSync.syncedCount || 0,
        failedCount,
        pendingCount: remaining.length,
        message: unsupportedPending > 0
          ? `${reportsSync.syncedCount || 0} laporan tersinkron. ${unsupportedPending} item suara/outbox tetap tersimpan dan belum didukung sinkronisasi otomatis.`
          : `${reportsSync.syncedCount || 0} laporan offline menerima konfirmasi komit database.`
      };
    } catch (syncErr) {
      console.warn('[Offline Sync Error]:', syncErr);
      const remaining = await getAllFromIndexedDb('offline_reports').catch(() => []);
      setOfflineQueue(remaining);
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
