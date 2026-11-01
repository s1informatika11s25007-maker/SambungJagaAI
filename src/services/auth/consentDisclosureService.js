/** Family data is minimized in SQL views; this client adds friendly labels only. */
export async function filterFamilyPortalData(_resident, obligations = []) {
  return {
    filteredObligations: obligations.map((item) => ({
      id: item.id,
      title: 'Pembaruan jadwal perawatan',
      status: item.status,
      updated_at: item.sys_created_at || item.updated_at || item.valid_from,
      friendlyDescription: 'Ada pembaruan aktivitas yang dapat dilihat melalui akun keluarga.'
    })),
    pdpComplianceNote: 'Portal hanya menerima ringkasan minimal yang dibagikan fasilitas melalui relasi akun keluarga. Informasi rinci tetap dikelola tim perawatan.'
  };
}
