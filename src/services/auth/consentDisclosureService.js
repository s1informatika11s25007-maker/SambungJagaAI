/** Family data is minimized in SQL views; this client enforces the same disclosure boundary. */
export async function filterFamilyPortalData(resident, obligations = []) {
  const hasVerifiedLink = Boolean(
    resident?.id
    && resident?.facility_id
    && resident?.disclosure_level === 'filtered_summary'
  );

  if (!hasVerifiedLink) {
    return {
      filteredObligations: [],
      pdpComplianceNote: 'Ringkasan aktivitas belum dibagikan untuk akun ini. Hubungi administrator fasilitas untuk memeriksa relasi akses dan persetujuan pengungkapan.'
    };
  }

  const filteredObligations = obligations
    .filter((item) => item?.resident_id === resident.id)
    .map((item) => ({
      id: item.id,
      title: 'Pembaruan jadwal perawatan',
      status: item.status,
      updated_at: item.sys_created_at || item.updated_at || item.valid_from,
      friendlyDescription: 'Ada pembaruan aktivitas yang dapat dilihat melalui akun keluarga.'
    }));

  return {
    filteredObligations,
    pdpComplianceNote: 'Portal hanya menerima ringkasan minimal yang dibagikan fasilitas melalui relasi akun keluarga. Informasi klinis rinci tidak ditampilkan.'
  };
}
