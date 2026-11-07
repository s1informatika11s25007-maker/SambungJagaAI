/**
 * Tenant-scoped offline report adapter. The server derives staff identity and
 * facility from the authenticated session; client-supplied tenant IDs are
 * checked by the RPC and are never trusted as authorization claims.
 */
export async function uploadOfflineCareReport(item, supabase) {
  if (!item?.id || !item?.facility_id || !item?.resident_id) {
    return { success: false, acknowledged: false, error: 'ID laporan, fasilitas, dan penghuni wajib tersedia.' };
  }
  const text = item.payload?.text || item.text || item.noteText || item.transcript || '';
  if (!String(text).trim()) {
    return { success: false, acknowledged: false, error: 'Laporan offline tidak memiliki transkrip/catatan untuk disinkronkan.' };
  }

  const { data, error } = await supabase.rpc('sync_offline_care_report', {
    p_client_submission_id: item.id,
    p_resident_id: item.resident_id,
    p_fact_value: {
      text: String(text).trim().slice(0, 4000),
      source_type: item.source_type || item.sourceType || (item.transcript ? 'voice_transcript' : 'text'),
      actor_name: item.actor_name || item.actorName || 'Caregiver',
      client_created_at: item.client_created_at || item.recordedAt || item.createdAt || null
    }
  });

  if (error) {
    return { success: false, acknowledged: false, error: error.message };
  }
  const acknowledged = data?.success === true && data?.acknowledged === true;
  return acknowledged
    ? { success: true, acknowledged: true, data }
    : { success: false, acknowledged: false, error: data?.message || 'Server belum mengonfirmasi commit laporan offline.' };
}
