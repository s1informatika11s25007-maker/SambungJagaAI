/**
 * Checks historical coverage for a configured replay service.
 * A local count is never represented as a successful rule evaluation.
 */
import { supabase } from '../../supabase/client/client';

const replayCache = new Map();
const isValidCount = (value) => (typeof value === 'number' || (typeof value === 'string' && value.trim() !== ''))
  && Number.isFinite(Number(value)) && Number(value) >= 0;

export async function runRuleReplayAnalysis(replayDays, obligations, ruleVersion = 'v1.0.0') {
  const safeDays = Math.max(1, Math.min(Number(replayDays) || 7, 90));
  const recordFingerprint = (obligations || []).map((item) => `${item.id}:${item.status}:${item.updated_at || item.sys_created_at || item.valid_from}`).join('|');
  const cacheKey = `${safeDays}_${ruleVersion}_${recordFingerprint}`;
  if (replayCache.has(cacheKey)) return replayCache.get(cacheKey);

  try {
    const { data, error } = await supabase.functions.invoke('ai_rule_replay', {
      body: { replayDays: safeDays, obligations, ruleVersion }
    });
    if (!error && data) {
      const verified = data.verified === true
        && isValidCount(data.replayedRecords)
        && isValidCount(data.discrepanciesFound);
      const result = {
        ...data,
        verified,
        analysis: verified
          ? String(data.analysis || 'Replay dijalankan oleh layanan dan mengembalikan hasil terstruktur.')
          : 'Layanan mengembalikan data yang belum cukup untuk membuktikan hasil replay. Konflik tidak dapat dinyatakan nol atau aman.'
      };
      replayCache.set(cacheKey, result);
      return result;
    }
  } catch (error) {
    console.warn('Rule replay service unavailable:', error);
  }

  const cutoff = Date.now() - safeDays * 24 * 60 * 60 * 1000;
  const recordsInWindow = (obligations || []).filter((item) => {
    const date = new Date(item.sys_created_at || item.created_at || item.valid_from).getTime();
    return Number.isFinite(date) && date >= cutoff;
  }).length;
  const result = {
    replayedRecords: recordsInWindow,
    ruleVersion,
    discrepanciesFound: null,
    verified: false,
    source: 'local_record_count_only',
    analysis: `Ditemukan ${recordsInWindow} catatan dalam rentang ${safeDays} hari. Ini hanya hitungan data lokal; mesin replay belum tersedia sehingga aturan belum dievaluasi dan konflik belum dapat disimpulkan.`
  };
  replayCache.set(cacheKey, result);
  return result;
}
