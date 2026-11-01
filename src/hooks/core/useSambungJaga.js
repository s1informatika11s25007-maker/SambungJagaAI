import { useState, useEffect } from 'react';
import { supabase } from '../../supabase/client/client';
import { appendAuditEntry } from '../../services/audit/auditTrailService';
import { verifyEvidenceSubmission } from '../../services/caregiver/evidenceVerifier';
import { evaluateAuthorityEnvelope } from '../../services/handover/authorityEnvelope';
import { detectFactContradiction } from '../../services/trace/epistemicLedger';
import { validatePromptInjection } from '../../utils/common/validators';
import { OBLIGATION_STATUS, AUTHORITY_ENVELOPE } from '../../types/core/architecture';
import { runCareSuperagent } from '../../services/ai/aiSuperagent';
import { planAutopilot, executeAutopilot } from '../../services/automation/autopilot';
import { fetchAllData, deriveRules, enrichObligations } from '../../services/data/dataService';
import { playA3ReviewAlert, playSuccessChime } from '../../services/dashboard/audioAlertService';
import {
  acquireWebLock,
  showSupervisorWebPushNotification,
} from '../../services/ai/nativeChromeService';

/**
 * Custom React Hook for SambungJaga AI Core State & Supabase Database Integrations.
 * Operational records load from Supabase. Offline reports remain volatile and are never reported as synced.
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

  useEffect(() => {
    localStorage.setItem('activeRole', activeRole);
  }, [activeRole]);

  // Online / Offline Window Listener
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
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
    setSelectedTrace(null);
    localStorage.removeItem('currentUser');
    localStorage.removeItem('activeRole');
    localStorage.setItem('isLoggedIn', 'false');
  };

  // Apply only the rows permitted for the authenticated account. Family responses are already
  // projected to minimal public views and are never written to the shared staff cache.
  const applyServerData = (res) => {
    const isFamily = currentUser?.role === 'family';
    const put = (rows, setter) => {
      if (rows === null) return;
      setter(rows);
    };
    const resRows = res.residents ?? residents;
    const staffRows = res.staff_profiles ?? staff;
    put(res.residents, setResidents);
    put(res.staff_profiles, setStaff);
    if (res.bitemporal_obligations !== null) {
      const formatted = enrichObligations(res.bitemporal_obligations, resRows, staffRows);
      setObligations(formatted);
    }
    if (Array.isArray(res.care_rules)) {
      setRules(res.care_rules);
    } else if (!isFamily && res.bitemporal_obligations !== null) {
      setRules(deriveRules(res.bitemporal_obligations, resRows, staffRows));
    }
    put(res.epistemic_facts, setEpistemicFacts);
    put(res.handover_contracts, setHandoverContracts);
    put(res.audit_trail, setAuditTrail);
    put(res.notifications, setNotifications);
  };

  const refreshData = async () => {
    if (!currentUser?.id || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
    applyServerData(await fetchAllData(currentUser.role));
  };

  // Hydrate only after Supabase has restored the authenticated account. Family sessions never
  // hydrate staff IndexedDB caches, preventing cross-role data from flashing in the portal.
  useEffect(() => {
    let active = true;
    async function loadData() {
      setIsLoading(true);
      const isFamily = currentUser?.role === 'family';
      if (!currentUser?.id) {
        setResidents([]); setStaff([]); setObligations([]); setEpistemicFacts([]);
        setNotifications([]); setAuditTrail([]); setHandoverContracts([]); setRules([]);
        setIsLoading(false);
        return;
      }
      // Reset role-scoped state before every account switch. The old IndexedDB cache was
      // keyed globally (not per auth user), so hydrating it could reveal another staff account's data.
      setResidents([]); setObligations([]); setNotifications([]);
      setStaff([]); setEpistemicFacts([]); setAuditTrail([]);
      setHandoverContracts([]); setRules([]); setSpotChallenges([]);
      if (isFamily) {
        setStaff([]); setEpistemicFacts([]); setAuditTrail([]); setHandoverContracts([]); setRules([]);
      }
      await refreshData();
      if (active) setIsLoading(false);
    }
    loadData();
    return () => { active = false; };
  }, [currentUser?.id, currentUser?.role]);

  // Realtime listens on the original domain tables (not PostgREST views).
  useEffect(() => {
    if (!currentUser?.id) return undefined;
    let timer;
    let channel;
    const trigger = () => { clearTimeout(timer); timer = setTimeout(() => refreshData(), 700); };
    try {
      channel = supabase.channel(`sambungjaga-live-${currentUser.id}`);
      [
        ['kernel_domain', 'bitemporal_obligations'],
        ['kernel_domain', 'epistemic_facts'],
        ['kernel_domain', 'handover_contracts'],
        ['public', 'notifications'],
        ['audit_domain', 'audit_trail']
      ].forEach(([schema, table]) => channel.on('postgres_changes', { event: '*', schema, table }, trigger));
      channel.subscribe();
    } catch (err) {
      console.warn('Realtime unavailable, using manual refresh:', err);
    }
    const onFocus = () => refreshData();
    window.addEventListener('focus', onFocus);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', onFocus);
      try { if (channel) supabase.removeChannel(channel); } catch { /* ignore */ }
    };
  }, [currentUser?.id, currentUser?.role]);

  // Background reassignment is intentionally disabled: operational changes run through audited Autopilot.

  // Notification handlers write to Supabase before changing the visible state.
  const addNotification = async ({ recipientRole, senderName, title, message, type = 'info' }) => {
    if (!currentUser?.id) return { success: false, error: 'Sesi pengguna belum tersedia.' };
    const { data, error } = await supabase.from('notifications').insert({
      recipient_role: recipientRole,
      sender_name: senderName || 'Sistem SambungJaga',
      title, message, type, is_read: false, is_shown: false
    }).select('*').single();
    if (error || !data) return { success: false, error: error?.message || 'Notifikasi belum tersimpan.' };
    setNotifications((previous) => {
      const updated = [data, ...previous];
      return updated;
    });
    if (recipientRole === 'supervisor' && type === 'urgent') {
      showSupervisorWebPushNotification(title, { body: message });
    }
    return { success: true, notification: data };
  };

  const deleteNotification = async (notificationId) => {
    const { error } = await supabase.from('notifications').delete().eq('id', notificationId);
    if (error) return { success: false, error: error.message };
    setNotifications((previous) => {
      const updated = previous.filter((item) => item.id !== notificationId);
      return updated;
    });
    return { success: true };
  };

  const clearRoleNotifications = async (role) => {
    const { error } = await supabase.from('notifications').delete().eq('recipient_role', role);
    if (error) return { success: false, error: error.message };
    setNotifications((previous) => {
      const updated = previous.filter((item) => item.recipient_role !== role);
      return updated;
    });
    return { success: true };
  };

  const markRoleNotificationsAsShown = async (role) => {
    const { data, error } = await supabase.from('notifications')
      .update({ is_shown: true, is_read: true }).eq('recipient_role', role).select('*');
    if (error) return { success: false, error: error.message };
    setNotifications((previous) => {
      const byId = new Map((data || []).map((item) => [item.id, item]));
      const updated = previous.map((item) => byId.has(item.id) ? byId.get(item.id) : item);
      return updated;
    });
    return { success: true };
  };

  // The database trigger creates the real SHA-256 chain. Local entries remain unverified.
  const logAudit = (gatewayTag, actionName, actorName, payload) => {
    const pendingTrail = appendAuditEntry(auditTrail, gatewayTag, actionName, actorName, payload);
    const pendingEntry = pendingTrail[pendingTrail.length - 1];
    setAuditTrail(pendingTrail);
    supabase.from('audit_trail').insert({
      actor_id: currentUser?.id || null,
      gateway_tag: gatewayTag,
      action_name: actionName,
      payload: payload || {},
      prev_entry_hash: 'server-generated',
      entry_hash: 'server-generated'
    }).select('*').single().then(({ data, error }) => {
      if (error || !data) return;
      setAuditTrail((previous) => {
        const updated = previous.map((entry) => entry.id === pendingEntry.id
          ? { ...data, actor_name: actorName || 'System Gateway', persisted: true }
          : entry);
        return updated;
      });
    }).catch((error) => console.warn('Audit entry not persisted:', error?.message));
  };

  // 1. Submit Voice / Text Capture (Zero-Friction & Autonomous Task Generation Engine)
  const captureCareReport = async ({ text, sourceType, residentId, actorName }) => {
    const injectionCheck = await validatePromptInjection(text);
    if (injectionCheck.isInjection) {
      logAudit('[A] Prompt Injection Filter Gateway', 'REJECT_INJECTION_ATTEMPT', actorName, { text_blocked: text });
      return {
        success: false,
        error: `Peringatan Keamanan: Terdeteksi percobaan Prompt Injection (${injectionCheck.matchedRule}). Laporan ditolak.`
      };
    }

    const activeObs = obligations.filter(o => o.status !== OBLIGATION_STATUS.VERIFIED_CLOSED);
    const initialResident = residentId && residentId !== 'auto' ? residents.find(r => r.id === residentId) || null : null;

    const aiContext = {
      residents,
      resident: initialResident,
      activeObligations: activeObs
    };

    const aiResponse = await runCareSuperagent(text, aiContext);

    let resolvedResident = initialResident;
    if ((!residentId || residentId === 'auto') && aiResponse?.detectedResidentId) {
      const detected = residents.find(r => r.id === aiResponse.detectedResidentId);
      if (detected) resolvedResident = detected;
    }

    if (!resolvedResident) {
      return { success: false, needsResident: true, message: 'Penghuni belum teridentifikasi. Pilih nama penghuni atau sebutkan nama yang tercatat sebelum laporan disimpan.' };
    }

    if (aiResponse) {
      logAudit('[A] Care Superagent Orchestrator', 'AI_ANALYSIS_COMPLETED', 'SambungJaga AI', {
        input: text,
        resolvedResident: resolvedResident?.full_name,
        response: aiResponse
      });
    }

    let dbStatus = 'reported';
    const contradictionCheck = detectFactContradiction(epistemicFacts, { fact_key: 'caregiver_voice_report', fact_value: { text_raw: text } });
    if (contradictionCheck.hasContradiction) {
      dbStatus = 'contradicted';
    }

    let newFact = null;
    if (!isOffline) {
      const { data: insertedFact, error } = await supabase.from('epistemic_facts').insert([{
        resident_id: resolvedResident.id,
        fact_key: 'caregiver_voice_report',
        fact_value: { text_raw: text },
        status: dbStatus,
        confidence_score: 0.95,
        source_type: sourceType || 'voice_stt',
        source_actor_id: currentUser?.id || null,
        provenance_chain: [`Zero-Friction Voice Capture`, `Source: ${sourceType || 'voice_stt'}`, `Device attestation: not configured`]
      }]).select().single();

      if (!error && insertedFact) {
        newFact = insertedFact;
      }
    }

    if (!newFact && !isOffline) {
      return { success: false, error: 'Laporan belum tersimpan ke database. Periksa izin akses dan koneksi, lalu coba kembali.' };
    }
    if (!newFact && isOffline) {
      newFact = {
        id: `offline-fact-${Date.now()}`, resident_id: resolvedResident.id,
        resident_name: resolvedResident.full_name, fact_key: 'caregiver_voice_report',
        fact_value: { text_raw: text }, status: dbStatus, source_type: sourceType || 'voice_stt',
        observed_at: new Date().toISOString(), persisted: false
      };
    }

    setEpistemicFacts(prev => {
      const updated = [newFact, ...prev];
      return updated;
    });

    logAudit('[A] Perception & Epistemic Gateway', 'ADD_EPISTEMIC_FACT', actorName, { fact_id: newFact.id, status: newFact.status });

    // A narrative report is not evidence of completion. Closure stays in the evidence-verification flow.
    const autoClosedTitle = null;

    const createdAutoObs = [];
    if (Array.isArray(aiResponse?.proposedObligations) && aiResponse.proposedObligations.length > 0) {
      for (const proposed of aiResponse.proposedObligations) {
        const createRes = await createObligation({
          resident_id: resolvedResident.id,
          title: proposed.title,
          description: proposed.description,
          priority: proposed.priority || 'critical',
          required_evidence_grade: proposed.required_evidence_grade || 'E1',
          assigned_caregiver_id: currentUser?.id || null
        }, 'SambungJaga Autonomous AI Agent');

        if (createRes.success) {
          createdAutoObs.push(proposed.title);
          logAudit('[A] Autonomous Task Generation Engine', 'AUTONOMOUS_OBLIGATION_CREATED', 'SambungJaga AI', {
            title: proposed.title,
            priority: proposed.priority
          });
        }
      }
    }

    addNotification({
      recipientRole: 'supervisor',
      senderName: actorName || 'Caregiver',
      title: 'Laporan Observasi Diterima',
      message: `Laporan untuk ${resolvedResident?.full_name}: "${text.length > 40 ? text.substring(0, 40) + '...' : text}". ${createdAutoObs.length > 0 ? `Tugas tinjauan dibuat: ${createdAutoObs.join(', ')}.` : 'Menunggu peninjauan petugas.'}`,
      type: 'info'
    });

    if (isOffline) {
      const offlineEntry = {
        id: `off-${Date.now()}`,
        sequence: offlineQueue.length + 1,
        status: 'pending_sync',
        payload: newFact,
        timestamp: new Date().toISOString()
      };
      setOfflineQueue(prev => [...prev, offlineEntry]);

      return {
        success: true,
        offline: true,
        message: 'Laporan hanya berada di antrean sementara selama sesi ini dan belum tersimpan ke server. Jangan tutup atau muat ulang aplikasi sebelum koneksi pulih; kirim ulang setelah online.'
      };
    }

    return {
      success: true,
      fact: newFact,
      resolvedResident,
      autoClosedTitle,
      createdAutoObs,
      message: `Laporan tersimpan untuk ${resolvedResident.full_name}. ${createdAutoObs.length > 0 ? `${createdAutoObs.length} tugas tinjauan dibuat dan menunggu verifikasi petugas.` : 'Menunggu peninjauan petugas.'}`
    };
  };

  // Evidence is persisted first; caregiver-submitted evidence can remain pending supervisor review.
  const submitEvidenceAndClose = async ({ obligationId, evidenceGrade, payload, actorName }) => {
    const obligation = obligations.find((item) => item.id === obligationId);
    if (!obligation) return { success: false, error: 'Kewajiban tidak ditemukan.' };
    if (!currentUser?.id || !['caregiver','supervisor','admin_hr'].includes(currentUser.role)) {
      return { success: false, error: 'Akun ini tidak memiliki hak untuk mengirim bukti.' };
    }
    const verification = await verifyEvidenceSubmission(obligation.required_evidence_grade, evidenceGrade, payload, obligation);
    if (!verification.success) {
      logAudit('[A] Evidence-Grade Verifier', 'REJECT_EVIDENCE', actorName, { obligation_id: obligationId, reason: verification.reason });
      return { success: false, error: verification.reason };
    }

    const isSupervisor = ['supervisor','admin_hr'].includes(currentUser.role);
    const requiresSupervisorReview = !isSupervisor || verification.verified !== true
      || obligation.requires_human_review !== false || ['critical','emergency'].includes(obligation.priority);
    const { data: evidenceRow, error: evidenceError } = await supabase.from('evidence_verifications').insert({
      obligation_id: obligationId,
      submitter_id: currentUser.id,
      evidence_grade: evidenceGrade,
      evidence_payload: payload || {},
      verifier_status: requiresSupervisorReview ? 'pending_review' : 'verified',
      is_spot_challenged: Boolean(verification.triggerSpotChallenge)
    }).select('*').single();
    if (evidenceError || !evidenceRow) {
      return { success: false, error: evidenceError?.message || 'Bukti belum berhasil disimpan.' };
    }

    const nextStatus = requiresSupervisorReview ? OBLIGATION_STATUS.IN_PROGRESS : OBLIGATION_STATUS.VERIFIED_CLOSED;
    const { data: updatedRow, error: updateError } = await supabase.from('bitemporal_obligations')
      .update({ status: nextStatus }).eq('id', obligationId).select('*').maybeSingle();
    if (updateError || !updatedRow) {
      return { success: false, error: updateError?.message || 'Bukti tersimpan, tetapi status tugas belum berubah. Hubungi supervisor.' };
    }
    setObligations((previous) => previous.map((item) => item.id === obligationId ? { ...item, ...updatedRow } : item));
    if (!requiresSupervisorReview) playSuccessChime();
    logAudit('[A] Evidence-Grade Verifier', requiresSupervisorReview ? 'EVIDENCE_SUBMITTED_FOR_REVIEW' : 'VERIFIED_CLOSURE', actorName, {
      obligation_id: obligationId, evidence_id: evidenceRow.id, evidence_grade: evidenceGrade
    });

    if (verification.triggerSpotChallenge) {
      const challengeReason = verification.spotChallengeReason || 'Pemeriksaan acak bukti';
      const { error: challengeError } = await supabase.from('spot_challenges').insert({
        evidence_id: evidenceRow.id, challenge_reason: challengeReason, status: 'pending'
      });
      if (!challengeError) setSpotChallenges((previous) => [{ id: evidenceRow.id, evidence_id: evidenceRow.id, challenge_reason: challengeReason, status: 'pending' }, ...previous]);
    }
    await addNotification({
      recipientRole: 'supervisor', senderName: actorName || currentUser.name,
      title: requiresSupervisorReview ? 'Bukti menunggu tinjauan supervisor' : 'Tugas ditutup dengan bukti',
      message: requiresSupervisorReview
        ? `Bukti untuk "${obligation.title}" tersimpan dan membutuhkan pemeriksaan supervisor.`
        : `Tugas "${obligation.title}" ditutup setelah bukti tersimpan.`,
      type: requiresSupervisorReview ? 'urgent' : 'success'
    });
    return {
      success: true,
      requiresHumanApproval: requiresSupervisorReview,
      message: requiresSupervisorReview
        ? 'Bukti tersimpan. Tugas menunggu pemeriksaan supervisor sebelum dapat ditutup.'
        : 'Bukti tersimpan dan kewajiban berhasil ditutup.'
    };
  };

  // Supervisor approval is a single database transaction: evidence, authority envelope,
  // obligation status, and audit record succeed or fail together.
  const approveAuthorityAction = async (payload) => {
    if (!['supervisor','admin_hr'].includes(currentUser?.role)) {
      return { success: false, error: 'Hanya supervisor/admin yang dapat menyetujui tindakan.' };
    }
    const targetId = typeof payload === 'string' ? payload : payload?.obligationId;
    const obligation = obligations.find((item) => item.id === targetId);
    if (!obligation) return { success: false, error: 'Kewajiban tidak ditemukan.' };

    const { data, error } = await supabase.rpc('approve_obligation_closure', {
      p_obligation_id: targetId
    });
    if (error || data?.success !== true || !data?.obligation) {
      return { success: false, error: error?.message || data?.message || 'Persetujuan belum tercatat di database.' };
    }

    const updatedRow = data.obligation;
    const name = payload?.supervisorName || currentUser.name || currentUser.full_name || 'Supervisor';
    setObligations((previous) => previous.map((item) => item.id === targetId ? { ...item, ...updatedRow } : item));
    logAudit('[A] P6 Authority Envelope Gate', 'HUMAN_APPROVAL_GRANTED', name, {
      obligation_id: targetId,
      evidence_id: data.evidence_id || null
    });
    await addNotification({
      recipientRole: 'caregiver', senderName: name,
      title: 'Tinjauan supervisor selesai', message: `Tugas "${obligation.title}" telah ditinjau dan ditutup.`, type: 'success'
    });
    playSuccessChime();
    return { success: true, message: 'Bukti ditinjau supervisor dan kewajiban berhasil diperbarui.' };
  };

  // 4. Create New Obligation
  const createObligation = async (newObData, actorName) => {
    if (!newObData?.resident_id || !newObData?.title?.trim()) {
      return { success: false, error: 'Pilih penghuni dan isi judul tugas.' };
    }
    const validFrom = new Date().toISOString();
    const validUntil = new Date(Date.now() + 180 * 60 * 1000).toISOString();
    const missionId = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID() : `mission-${Date.now()}`;
    const { data: insertedData, error } = await supabase.from('bitemporal_obligations').insert({
      mission_id: newObData.mission_id || missionId,
      resident_id: newObData.resident_id,
      title: newObData.title.trim(),
      description: newObData.description || null,
      priority: newObData.priority || 'routine',
      status: 'open',
      valid_from: validFrom,
      valid_until: validUntil,
      rule_version_id: 'v1.0.0',
      required_evidence_grade: newObData.required_evidence_grade || 'E1',
      assigned_caregiver_id: newObData.assigned_caregiver_id || null,
      requires_human_review: true
    }).select('*').single();
    if (error || !insertedData) {
      return { success: false, error: error?.message || 'Tugas belum berhasil disimpan.' };
    }
    const resident = residents.find((item) => item.id === insertedData.resident_id);
    const person = staff.find((item) => item.id === insertedData.assigned_caregiver_id);
    const obligation = { ...insertedData, resident_name: resident?.full_name || null, assigned_caregiver_name: person?.full_name || null };
    setObligations((previous) => {
      const updated = [obligation, ...previous];
      return updated;
    });
    logAudit('[A] Action Contract Builder', 'CREATE_OBLIGATION', actorName, { obligation_id: obligation.id, title: obligation.title });
    await addNotification({
      recipientRole: 'caregiver', senderName: actorName || 'Supervisor',
      title: 'Tugas baru ditugaskan', message: `Tugas baru: "${obligation.title}". Menunggu verifikasi petugas.`, type: 'urgent'
    });
    return { success: true, obligation };
  };

    const createHandoverContract = async ({ incomingStaffId, shiftName }) => {
    if (!currentUser?.id || !['caregiver', 'supervisor', 'admin_hr'].includes(currentUser.role)) {
      return { success: false, error: 'Akun ini tidak dapat membuat kontrak serah terima.' };
    }
    const incoming = staff.find((person) => person.id === incomingStaffId && person.role === 'caregiver' && person.shift_status === 'on_duty');
    if (!incoming || incoming.id === currentUser.id) {
      return { success: false, error: 'Pilih petugas penerima yang benar-benar aktif dan berbeda dari pengirim.' };
    }
    const openSummary = obligations
      .filter((item) => item.assigned_caregiver_id === currentUser.id && ['open', 'in_progress', 'escalated'].includes(item.status))
      .map((item) => ({
        id: item.id,
        title: item.title,
        priority: item.priority,
        grade: item.required_evidence_grade || 'E1',
        resident_name: item.resident_name || 'Penghuni'
      }));
    const { data, error } = await supabase.from('handover_contracts').insert({
      outgoing_staff_id: currentUser.id,
      incoming_staff_id: incoming.id,
      shift_name: String(shiftName || `Serah terima ${new Date().toLocaleDateString('id-ID')}`).trim().slice(0, 160),
      open_obligations_summary: openSummary,
      competency_gaps_identified: [],
      outgoing_signed_at: null,
      incoming_signed_at: null,
      contract_status: 'pending_outgoing'
    }).select('*').single();
    if (error || !data) return { success: false, error: error?.message || 'Kontrak belum berhasil disimpan.' };
    setHandoverContracts((previous) => [data, ...previous]);
    return { success: true, contract: data, message: 'Draf kontrak tersimpan. Pengirim perlu menandatangani sebelum diteruskan ke penerima.' };
  };

  const signHandoverContract = async ({ contractId, signerRole, signerName, signerId }) => {
    if (!signerId || signerId !== currentUser?.id) return { success: false, error: 'Identitas penanda tangan tidak sesuai sesi.' };
    const { data, error } = await supabase.rpc('sign_handover_contract', {
      p_contract_id: contractId,
      p_signer_role: signerRole
    });
    if (error || !data?.success || !data?.contract) {
      return { success: false, error: error?.message || data?.message || 'Tanda tangan belum tercatat.' };
    }
    setHandoverContracts((previous) => previous.map((item) => item.id === contractId ? data.contract : item));
    if (signerRole === 'incoming') {
      await addNotification({
        recipientRole: 'supervisor', senderName: signerName || currentUser.full_name,
        title: 'Serah terima shift dikonfirmasi', message: 'Penerima yang ditunjuk telah menandatangani kontrak serah terima.', type: 'success'
      });
    }
    return { success: true, contract: data.contract, message: signerRole === 'incoming' ? 'Tanda tangan penerima tersimpan. Kontrak terkonfirmasi.' : 'Tanda tangan pengirim tersimpan. Kontrak menunggu penerima.' };
  };

  const syncOfflineLedger = async () => {
    if (offlineQueue.length === 0) return { success: true, message: 'Tidak ada catatan offline.' };
    return {
      success: false,
      error: 'Catatan tetap tersimpan di antrean perangkat. Sinkronisasi ditahan sampai kunci tanda tangan perangkat dan verifikasi server dikonfigurasi; sistem tidak membuat tanda tangan palsu.'
    };
  };

  const patchObligation = (id, patch) => {
    setObligations((prev) => {
      const updated = prev.map((o) => (o.id === id ? { ...o, ...patch } : o));
      return updated;
    });
  };

  const assignObligation = async (obligationId, staffId) => {
    const person = staff.find((item) => item.id === staffId);
    const obligation = obligations.find((item) => item.id === obligationId);
    if (!person || !obligation) return { success: false, error: 'Data tugas / staf tidak ditemukan.' };
    const { data, error } = await supabase.from('bitemporal_obligations')
      .update({ assigned_caregiver_id: staffId }).eq('id', obligationId).select('id').maybeSingle();
    if (error || !data) return { success: false, error: error?.message || 'Alokasi belum tersimpan di database.' };
    patchObligation(obligationId, { assigned_caregiver_id: staffId, assigned_caregiver_name: person.full_name });
    logAudit('[A] Autopilot Orchestrator', 'AUTO_ASSIGN', 'Autopilot', { obligation_id: obligationId, assigned_to: person.full_name });
    await addNotification({ recipientRole: person.role, senderName: 'Autopilot', title: 'Tugas baru ditugaskan', message: `Anda ditugaskan: "${obligation.title}".`, type: 'info' });
    return { success: true };
  };

  const escalateObligation = async (obligationId) => {
    const obligation = obligations.find((item) => item.id === obligationId);
    if (!obligation) return { success: false, error: 'Tugas tidak ditemukan.' };
    const { data, error } = await supabase.from('bitemporal_obligations')
      .update({ status: OBLIGATION_STATUS.ESCALATED }).eq('id', obligationId).select('id').maybeSingle();
    if (error || !data) return { success: false, error: error?.message || 'Eskalasi belum tersimpan di database.' };
    patchObligation(obligationId, { status: OBLIGATION_STATUS.ESCALATED });
    logAudit('[A] Autopilot Orchestrator', 'AUTO_ESCALATE_OVERDUE', 'Autopilot', { obligation_id: obligationId, title: obligation.title });
    await addNotification({ recipientRole: 'supervisor', senderName: 'Autopilot', title: 'Tugas dieskalasi', message: `"${obligation.title}" melewati batas waktu dan dieskalasi untuk ditinjau.`, type: 'urgent' });
    return { success: true };
  };


  // 7. One-tap Autopilot
  const autopilotPlan = planAutopilot({ activeRole, currentUser, obligations, notifications, handoverContracts, offlineQueue, isOffline, staff });

  const runAutopilot = async () => {
    const actorName = currentUser?.name || currentUser?.full_name || activeRole;
    const outcome = await executeAutopilot(autopilotPlan, {
      markRoleNotificationsAsShown,
      assignObligation,
      escalateObligation,
      activeRole,
      actorName,
      actorId: currentUser?.id || null
    });
    logAudit('[A] Autopilot Orchestrator', 'AUTOPILOT_RUN', actorName, { summary: outcome.summary, steps: outcome.results.length });
    refreshData();
    return outcome;
  };

  return {
    refreshData,
    autopilotPlan,
    runAutopilot,
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
    addNotification,
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
    setUserAvatar
  };
}
