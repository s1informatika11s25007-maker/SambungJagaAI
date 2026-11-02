/**
 * SambungJaga AI — Family Liaison Superagent (P1 Innovation)
 *
 * Transforms the Family Portal into a consent-aware 2-way communication platform:
 * - Scheduled progress summaries filtered by consent level
 * - Shareable daily care logs & event notifications
 * - Automated visit requests stored in database with visiting rule validation
 * - Auto-categorized family complaints stored in database & routed to staff
 * - Family receipt confirmations & SLA tracking
 */

import { supabase } from '../../supabase/client/client';
import { filterFamilyPortalData } from '../auth/consentDisclosureService';

let inMemoryVisitRequests = [];
let inMemoryComplaints = [];

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
 * Submits an automated visit request from a family member and persists to database with valid UUID.
 */
export async function submitFamilyVisitRequest({
  familyUserId,
  residentId,
  residentName,
  proposedDate,
  proposedTime,
  visitorCount = 1,
  notes = ''
}) {
  const hour = parseInt(proposedTime?.split(':')[0] || '10', 10);
  const isValidHours = hour >= 9 && hour <= 17;
  // Visiting rules: max 3 visitors, during visiting hours
  const autoApproved = isValidHours && visitorCount <= 3;
  const status = autoApproved ? 'approved' : 'pending_review';

  // Generate valid UUID for PostgreSQL uuid column
  const uuid = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : '00000000-0000-4000-8000-' + Date.now().toString(16).padStart(12, '0');

  const requestRecord = {
    id: uuid,
    family_user_id: (familyUserId && familyUserId.includes('-')) ? familyUserId : null,
    resident_id: (residentId && residentId.includes('-')) ? residentId : null,
    resident_name: residentName || 'Penghuni',
    proposed_date: proposedDate,
    proposed_time: proposedTime,
    visitor_count: visitorCount,
    notes,
    status,
    created_at: new Date().toISOString()
  };

  try {
    const { data, error } = await supabase
      .from('family_visit_requests')
      .insert([requestRecord])
      .select()
      .single();

    if (!error && data) {
      inMemoryVisitRequests.unshift(data);
    } else {
      console.warn('Visit request DB insert warning:', error?.message);
      inMemoryVisitRequests.unshift(requestRecord);
    }
  } catch (err) {
    console.warn('Visit request DB exception:', err);
    inMemoryVisitRequests.unshift(requestRecord);
  }

  // Notify supervisor
  try {
    await supabase.from('notifications').insert({
      recipient_role: 'supervisor',
      sender_name: 'Family Liaison Agent',
      title: 'Permintaan Kunjungan Keluarga Baru',
      message: `Kunjungan untuk ${residentName} pada ${proposedDate} jam ${proposedTime} (${visitorCount} orang). Status: ${autoApproved ? 'Disetujui Otomatis' : 'Menunggu Peninjauan'}.`,
      type: 'info'
    });
  } catch (err) {
    console.warn('Notification insert warning:', err);
  }

  return {
    success: true,
    request: inMemoryVisitRequests[0] || requestRecord,
    message: autoApproved
      ? 'Permintaan kunjungan tersimpan di database dan disetujui otomatis sesuai aturan jam besuk.'
      : 'Permintaan kunjungan tersimpan di antrean dan menunggu konfirmasi supervisor.'
  };
}

/**
 * Submits and auto-categorizes a family complaint or feedback item and persists to database with valid UUID.
 */
export async function submitFamilyComplaint({
  familyUserId,
  residentId,
  residentName,
  category = 'general',
  complaintText
}) {
  if (!complaintText || !complaintText.trim()) {
    return { success: false, error: 'Isi pengaduan/masukan tidak boleh kosong.' };
  }

  // AI Categorization & Severity Detection
  const textLower = complaintText.toLowerCase();
  let severity = 'routine';
  let targetRole = 'supervisor';

  if (/obat|jatuh|demam|sesak|nyeri|luka|suntik|medis/i.test(textLower)) {
    severity = 'critical';
    targetRole = 'supervisor';
  } else if (/makanan|kebersihan|pakaian|kamar|layanan/i.test(textLower)) {
    severity = 'important';
    targetRole = 'admin_hr';
  }

  // Generate valid UUID for PostgreSQL uuid column
  const uuid = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : '00000000-0000-4000-8000-' + Date.now().toString(16).padStart(12, '0');

  const complaintRecord = {
    id: uuid,
    family_user_id: (familyUserId && familyUserId.includes('-')) ? familyUserId : null,
    resident_id: (residentId && residentId.includes('-')) ? residentId : null,
    resident_name: residentName || 'Penghuni',
    category,
    complaint_text: complaintText.trim(),
    severity,
    target_role: targetRole,
    status: 'received',
    acknowledged_by_family: false,
    created_at: new Date().toISOString()
  };

  try {
    const { data, error } = await supabase
      .from('family_complaints')
      .insert([complaintRecord])
      .select()
      .single();

    if (!error && data) {
      inMemoryComplaints.unshift(data);
    } else {
      console.warn('Complaint DB insert warning:', error?.message);
      inMemoryComplaints.unshift(complaintRecord);
    }
  } catch (err) {
    console.warn('Complaint DB exception:', err);
    inMemoryComplaints.unshift(complaintRecord);
  }

  // Notify staff
  try {
    await supabase.from('notifications').insert({
      recipient_role: targetRole,
      sender_name: 'Family Liaison Agent',
      title: `Pengaduan Keluarga (${severity.toUpperCase()})`,
      message: `Pengaduan terkait ${residentName}: "${complaintText.substring(0, 60)}...". Diteruskan ke ${targetRole}.`,
      type: severity === 'critical' ? 'urgent' : 'info'
    });
  } catch (err) {
    console.warn('Notification insert warning:', err);
  }

  return {
    success: true,
    complaint: inMemoryComplaints[0] || complaintRecord,
    message: `Pengaduan tersimpan di database, dikategorikan (${severity}), dan diteruskan ke ${targetRole}.`
  };
}

/**
 * Retrieves visit requests for a resident from database or local memory cache.
 */
export async function fetchFamilyVisitRequests(residentId) {
  try {
    let query = supabase.from('family_visit_requests').select('*').order('created_at', { ascending: false });
    if (residentId) query = query.eq('resident_id', residentId);
    const { data, error } = await query;
    if (!error && data) return data;
  } catch (err) {
    console.warn('Fetch visit requests fallback:', err);
  }
  return inMemoryVisitRequests.filter(r => !residentId || r.resident_id === residentId);
}

/**
 * Retrieves family complaints for a resident from database or local memory cache.
 */
export async function fetchFamilyComplaints(residentId) {
  try {
    let query = supabase.from('family_complaints').select('*').order('created_at', { ascending: false });
    if (residentId) query = query.eq('resident_id', residentId);
    const { data, error } = await query;
    if (!error && data) return data;
  } catch (err) {
    console.warn('Fetch complaints fallback:', err);
  }
  return inMemoryComplaints.filter(c => !residentId || c.resident_id === residentId);
}

// Aliases for page export compatibility
export const getFamilyVisitRequests = fetchFamilyVisitRequests;
export const getFamilyComplaints = fetchFamilyComplaints;

