/**
 * SambungJaga AI — Family Liaison Superagent (P1 Innovation)
 *
 * Provides a 2-way consent-aware Family Portal with Database Persistence:
 * - Scheduled progress summaries filtered by PDP consent level
 * - Digital disclosure receipt confirmations in database
 * - Structured visit requests with rule validation, ticket tracking & visitor verification
 * - Family notification channel preferences & quiet hours in `notification_preferences` table
 * - Auto-categorized complaints with full ticket lifecycle tracking to resolution
 * - Consent remains fail-closed until a database-backed authorization workflow is configured
 * - Scheduled personalized family digests & response reminder sweep
 */

import { supabase as browserClient } from '../../supabase/client/client.js';
import { backendSupabase } from '../../supabase/client/backendClient.js';

const supabase = (typeof window === 'undefined') ? backendSupabase : browserClient;
import { filterFamilyPortalData } from '../auth/consentDisclosureService.js';

const familyPreferencesMap = new Map();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (value) => typeof value === 'string' && UUID_RE.test(value);

/**
 * 37. Konfirmasi Penerimaan Informasi — Digitally confirms receipt/read status of clinical digests.
 */
export async function confirmDisclosureReceipt({ digestId, familyUserId, residentId, facilityId }) {
  if (!digestId || !isUuid(familyUserId) || !isUuid(residentId) || !facilityId) {
    return { success: false, error: 'Identitas keluarga, penghuni, fasilitas, dan ringkasan wajib valid.' };
  }
  const confirmationRecord = {
    digest_id: String(digestId).slice(0, 120),
    family_user_id: familyUserId,
    resident_id: residentId,
    facility_id: facilityId,
    confirmed_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('family_disclosure_receipts')
    .upsert(confirmationRecord, { onConflict: 'family_user_id,digest_id' })
    .select()
    .single();
  if (error || !data) {
    return { success: false, error: error?.message || 'Server belum mengonfirmasi tanda terima.' };
  }

  return {
    success: true,
    confirmationRecord: {
      digestId: data.digest_id,
      familyUserId: data.family_user_id,
      residentId: data.resident_id,
      confirmedAt: data.confirmed_at
    },
    message: 'Konfirmasi penerimaan informasi perawatan berhasil dicatat.'
  };
}

/**
 * 39. Preferensi Notifikasi — Saves family channel preferences & quiet hours into DB table `notification_preferences`.
 */
export async function updateFamilyNotificationPreferences(familyUserId, preferences = {}) {
  const facilityId = preferences.facilityId;
  if (!isUuid(familyUserId) || !facilityId) {
    return { success: false, error: 'Identitas akun dan fasilitas terverifikasi wajib tersedia.' };
  }

  const dbPayload = {
    user_id: familyUserId,
    facility_id: facilityId,
    allow_in_app: preferences.inApp ?? true,
    allow_push: preferences.pushNotification ?? true,
    allow_email: preferences.email ?? false,
    allow_whatsapp: preferences.whatsapp ?? false,
    quiet_hours_enabled: preferences.quietHoursEnabled ?? false,
    quiet_hours_start: preferences.quietHoursStart || '22:00',
    quiet_hours_end: preferences.quietHoursEnd || '06:00',
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('notification_preferences')
    .upsert(dbPayload, { onConflict: 'user_id' })
    .select()
    .single();
  if (error || !data) {
    return { success: false, error: error?.message || 'Preferensi belum tersimpan di server.' };
  }

  const returnedObj = {
    ...data,
    inApp: data.allow_in_app,
    pushNotification: data.allow_push,
    email: data.allow_email,
    whatsapp: data.allow_whatsapp,
    quietHoursEnabled: data.quiet_hours_enabled,
    quietHoursStart: data.quiet_hours_start,
    quietHoursEnd: data.quiet_hours_end,
    success: true
  };
  familyPreferencesMap.set(familyUserId, returnedObj);
  return returnedObj;
}

export function getFamilyNotificationPreferences(familyUserId) {
  if (familyPreferencesMap.has(familyUserId || 'default')) {
    return familyPreferencesMap.get(familyUserId || 'default');
  }

  return {
    inApp: true,
    pushNotification: true,
    email: false,
    whatsapp: false,
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '06:00'
  };
}

/**
 * 41. Complaint Tracking Sampai Selesai — Manages full lifecycle tracking of family complaints in database.
 */
export async function updateComplaintStatus({
  complaintId,
  status = 'resolved',
  resolutionNotes = '',
  supervisorId,
  facilityId
}) {
  const allowedStatuses = new Set(['pending', 'received', 'investigating', 'action_taken', 'resolved', 'closed']);
  if (!isUuid(complaintId) || !isUuid(supervisorId) || !facilityId || !allowedStatuses.has(status)) {
    return { success: false, error: 'Identitas pengaduan/pengawas/fasilitas atau status tidak valid.' };
  }

  const { data, error } = await supabase
    .from('family_complaints')
    .update({
      status,
      resolution_notes: resolutionNotes,
      resolved_by: supervisorId,
      resolved_at: ['resolved', 'closed'].includes(status) ? new Date().toISOString() : null
    })
    .eq('id', complaintId)
    .eq('facility_id', facilityId)
    .select()
    .single();

  if (error || !data) {
    return { success: false, error: error?.message || 'Pengaduan tidak ditemukan atau perubahan belum tersimpan.' };
  }

  const audit = await supabase.from('audit_trail').insert({
    facility_id: facilityId,
    gateway_tag: '[A] Family Liaison Agent',
    action_name: 'FAMILY_COMPLAINT_STATUS_UPDATED',
    payload: { complaintId, status, resolutionNotes, supervisorId }
  });

  return {
    success: true,
    complaint: data,
    status: data.status,
    auditLogged: !audit.error,
    auditWarning: audit.error?.message
  };
}

/**
 * 42. Consent Lifecycle Penuh — Manages patient/family consent state machine in database.
 */
export function updateConsentState({ residentId, consentType = 'MEDICAL_DISCLOSURE' }) {
  return {
    residentId,
    consentType,
    consentStatus: 'PENDING',
    success: false,
    error: 'Penyimpanan persetujuan belum dikonfigurasi pada database. Akses sensitif tetap ditolak sampai persetujuan dicatat melalui proses resmi.',
    updated_at: new Date().toISOString()
  };
}

export function getConsentState(residentId, consentType = 'MEDICAL_DISCLOSURE') {
  return {
    residentId,
    consentType,
    consentStatus: 'PENDING',
    validUntil: null,
    persisted: false
  };
}

/**
 * 43. Personalized Family Digest Terjadwal — Persists scheduled PDP-filtered digests to `system_outbox_queue` & `notification_outbox`.
 */
export async function generateScheduledFamilyDigest({ resident, obligations = [], familyUserId = null }) {
  if (!resident?.id || !resident?.facility_id) {
    return { success: false, outboxSaved: false, error: 'Identitas penghuni dan fasilitas wajib berasal dari database.' };
  }
  const summary = await generateFamilyProgressSummary(resident, obligations);
  const digestId = `digest-sched-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  const facilityId = resident.facility_id;
  const idempotencyKey = `digest-sched-${resident.id}-${new Date().toISOString().slice(0, 10)}`;

  const { data: queuedEvent, error: queueError } = await supabase
    .from('system_outbox_queue')
    .insert({
      facility_id: facilityId,
      event_type: 'FAMILY_DIGEST_SCHEDULED',
      payload: { ...summary, digestId, familyUserId },
      status: 'pending',
      idempotency_key: idempotencyKey,
      scheduled_at: new Date().toISOString()
    })
    .select('id')
    .single();

  if (queueError || !queuedEvent) {
    return { success: false, digestId, idempotencyKey, outboxSaved: false, error: queueError?.message || 'Digest belum masuk antrean.' };
  }

  let notificationQueued = false;
  if (familyUserId) {
    const { error: notificationError } = await supabase.from('notification_outbox').insert({
      facility_id: facilityId,
      recipient_user_id: familyUserId,
      channel: 'family_portal',
      template_id: 'DAILY_FAMILY_DIGEST',
      status: 'queued',
      payload: summary
    });
    notificationQueued = !notificationError;
  }

  return {
    success: true,
    digestId,
    idempotencyKey,
    outboxSaved: true,
    notificationQueued,
    scheduledFor: new Date().toISOString().split('T')[0],
    digestContent: summary,
    dispatchStatus: 'QUEUED'
  };
}

export async function scheduleDailyFamilyDigests({ residents = [], obligations = [] }) {
  const digests = [];
  for (const resident of residents) {
    const digest = await generateScheduledFamilyDigest({ resident, obligations });
    digests.push(digest);
  }
  return {
    scheduledCount: digests.length,
    digests
  };
}

/**
 * 44. Family Response Reminder — Dispatches actual reminders to family members and supervisors for pending items.
 */
export async function runFamilyResponseReminderSweep({ facilityId } = {}) {
  if (!facilityId) {
    return { success: false, status: 'CONFIGURATION_ERROR', error: 'facilityId wajib ditentukan.' };
  }

  const { data: pendingVisits, error: visitError } = await supabase
    .from('family_visit_requests')
    .select('*')
    .eq('facility_id', facilityId)
    .eq('status', 'pending_review');
  if (visitError) return { success: false, status: 'QUERY_FAILED', error: visitError.message };

  const { data: pendingComplaints, error: complaintError } = await supabase
    .from('family_complaints')
    .select('*')
    .eq('facility_id', facilityId)
    .in('status', ['received', 'pending', 'investigating']);
  if (complaintError) return { success: false, status: 'QUERY_FAILED', error: complaintError.message };

  let remindersSent = 0;
  const errors = [];
  for (const visit of (pendingVisits || [])) {
    const { error } = await supabase.from('notifications').insert({
      facility_id: facilityId,
      recipient_role: 'supervisor',
      sender_name: 'Family Liaison Agent',
      title: `REMINDER: Permintaan Kunjungan (${visit.ticket_number})`,
      message: `Permintaan kunjungan untuk ${visit.resident_name} (${visit.proposed_date}) memerlukan peninjauan supervisor.`,
      type: 'urgent'
    });
    if (error) errors.push(error.message);
    else remindersSent++;
  }

  for (const complaint of (pendingComplaints || [])) {
    const { error } = await supabase.from('notifications').insert({
      facility_id: facilityId,
      recipient_role: complaint.target_role || 'supervisor',
      sender_name: 'Family Liaison Agent',
      title: `REMINDER: Pengaduan Keluarga (${complaint.ticket_number})`,
      message: `Pengaduan terkait ${complaint.resident_name} (${complaint.severity}) belum ditindaklanjuti.`,
      type: 'urgent'
    });
    if (error) errors.push(error.message);
    else remindersSent++;
  }

  return {
    success: errors.length === 0,
    checkedAt: new Date().toISOString(),
    facilityId,
    pendingVisitsCount: pendingVisits?.length || 0,
    pendingComplaintsCount: pendingComplaints?.length || 0,
    remindersSent,
    errors,
    status: errors.length === 0 ? 'COMPLETED' : 'PARTIAL_FAILURE'
  };
}

/**
 * Generates a scheduled progress summary for family members based strictly on recorded facts and consent.
 */
export async function generateFamilyProgressSummary(resident, obligations = []) {
  if (!resident) {
    return { summaryText: 'Data lansia tidak tersedia.', completedCount: 0, totalCount: 0 };
  }

  const disclosure = await filterFamilyPortalData(resident, obligations);
  const totalObs = disclosure.filteredObligations.length;
  const completed = disclosure.filteredObligations.filter(o => o.status === 'verified_closed').length;

  const summaryText = totalObs > 0
    ? `Ringkasan Aktivitas ${resident.full_name}: ${completed} dari ${totalObs} rencana kegiatan hari ini telah dilaksanakan oleh tim perawatan.`
    : `Belum ada catatan aktivitas harian yang dijadwalkan untuk ${resident.full_name}.`;

  return {
    residentId: resident.id,
    residentName: resident.full_name,
    summaryText,
    completedCount: completed,
    totalCount: totalObs,
    pdpNote: disclosure.pdpComplianceNote,
    generatedAt: new Date().toISOString()
  };
}

/**
 * Submits an automated visit request from a family member and evaluates visiting rules.
 */
export async function submitFamilyVisitRequest({
  familyUserId,
  residentId,
  residentName,
  proposedDate,
  proposedTime,
  visitorCount = 1,
  notes = '',
  facilityId
}) {
  if (!isUuid(familyUserId) || !isUuid(residentId) || !facilityId || !residentName) {
    return { success: false, error: 'Akun keluarga, penghuni, dan fasilitas harus terverifikasi.' };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(proposedDate || '') || !/^([01]\d|2[0-3]):[0-5]\d$/.test(proposedTime || '')) {
    return { success: false, error: 'Tanggal atau jam kunjungan tidak valid.' };
  }
  if (new Date(`${proposedDate}T${proposedTime}:00`) < new Date() || !Number.isInteger(Number(visitorCount)) || visitorCount < 1 || visitorCount > 5) {
    return { success: false, error: 'Tanggal tidak boleh di masa lalu dan jumlah pengunjung harus 1–5 orang.' };
  }

  const ticketNumber = `TKT-VISIT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
  const requestRecord = {
    ticket_number: ticketNumber,
    facility_id: facilityId,
    family_user_id: familyUserId,
    resident_id: residentId,
    resident_name: residentName,
    proposed_date: proposedDate,
    proposed_time: proposedTime,
    visitor_count: Number(visitorCount),
    notes: String(notes || '').slice(0, 1000),
    status: 'pending_review'
  };

  const { data, error } = await supabase
    .from('family_visit_requests')
    .insert(requestRecord)
    .select()
    .single();
  if (error || !data) {
    return { success: false, dbSaved: false, error: error?.message || 'Permintaan kunjungan belum diterima server.' };
  }

  return {
    success: true,
    dbSaved: true,
    ticketNumber,
    request: data,
    message: `Permintaan kunjungan (${ticketNumber}) diterima dan menunggu peninjauan supervisor.`
  };
}

/**
 * Submits and auto-categorizes a family complaint or feedback item.
 */
export async function submitFamilyComplaint({
  familyUserId,
  residentId,
  residentName,
  category = 'general',
  complaintText,
  facilityId
}) {
  if (!complaintText || !String(complaintText).trim()) {
    return { success: false, error: 'Isi pengaduan/masukan tidak boleh kosong.' };
  }
  if (!isUuid(familyUserId) || !isUuid(residentId) || !facilityId || !residentName) {
    return { success: false, error: 'Akun keluarga, penghuni, dan fasilitas harus terverifikasi.' };
  }

  const textLower = complaintText.toLowerCase();
  let severity = 'routine';
  let targetRole = 'supervisor';
  if (/obat|jatuh|demam|sesak|nyeri|luka|suntik|medis/i.test(textLower)) {
    severity = 'critical';
  } else if (/makanan|kebersihan|pakaian|kamar|layanan/i.test(textLower)) {
    severity = 'important';
    targetRole = 'admin_hr';
  }

  const ticketNumber = `TKT-CMP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
  const complaintRecord = {
    ticket_number: ticketNumber,
    facility_id: facilityId,
    family_user_id: familyUserId,
    resident_id: residentId,
    resident_name: residentName,
    category,
    complaint_text: String(complaintText).trim().slice(0, 4000),
    severity,
    target_role: targetRole,
    status: 'received',
    acknowledged_by_family: false
  };

  const { data, error } = await supabase
    .from('family_complaints')
    .insert(complaintRecord)
    .select()
    .single();
  if (error || !data) {
    return { success: false, dbSaved: false, error: error?.message || 'Pengaduan belum diterima server.' };
  }

  return {
    success: true,
    dbSaved: true,
    ticketNumber,
    complaint: data,
    message: `Pengaduan (${ticketNumber}) diterima dengan tingkat ${severity} dan menunggu tindak lanjut petugas.`
  };
}

export async function fetchFamilyVisitRequests(residentId) {
  try {
    let query = supabase.from('family_visit_requests').select('*').order('created_at', { ascending: false });
    if (residentId) query = query.eq('resident_id', residentId);
    const { data, error } = await query;
    if (!error && data) return data;
  } catch (error) {
    console.warn('[Family visits] Database read failed:', error);
  }
  return [];
}

export async function fetchFamilyComplaints(residentId) {
  try {
    let query = supabase.from('family_complaints').select('*').order('created_at', { ascending: false });
    if (residentId) query = query.eq('resident_id', residentId);
    const { data, error } = await query;
    if (!error && data) return data;
  } catch (error) {
    console.warn('[Family complaints] Database read failed:', error);
  }
  return [];
}

export const getFamilyVisitRequests = fetchFamilyVisitRequests;
export const getFamilyComplaints = fetchFamilyComplaints;
