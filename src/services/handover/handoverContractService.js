/**
 * SambungJaga AI — Handover Contract Agent (Two-Sided)
 *
 * @module services/handoverContractService
 * @description Validates cross-shift care continuity via Supabase Edge Function with smart in-memory caching
 * and automated 1-click shift synthesis from live obligation graph.
 */

import { supabase } from '../../supabase/client/client';

// In-Memory Cache for Handover Contract Analysis
const handoverCache = new Map();

/**
 * Runs intelligent clinical analysis on a handover contract using Groq Edge Function
 * with deterministic local clinical fallback.
 */
export async function runHandoverAnalysis(contract, outgoingStaff, incomingStaff, openObligations = []) {
  const cacheKey = `${contract?.id || 'c'}_${contract?.updated_at || 't'}_${(openObligations || []).map(o => o.id || o.title).join('-')}`;

  if (handoverCache.has(cacheKey)) {
    return handoverCache.get(cacheKey);
  }

  try {
    const { data, error } = await supabase.functions.invoke('ai_handover_contract', {
      body: { contract, outgoingStaff, incomingStaff, openObligations }
    });

    if (!error && data && data.summaryAnalysis) {
      handoverCache.set(cacheKey, data);
      return data;
    }
  } catch (err) {
    console.warn("AI Handover Contract Edge Function fallback triggered:", err);
  }

  // The local fallback is only a factual workload summary, never a clinical validation.
  const criticalObs = (openObligations || []).filter((item) => ['critical', 'emergency'].includes(item.priority));
  const importantObs = (openObligations || []).filter((item) => item.priority === 'important');
  const fallbackResult = {
    summaryAnalysis: `Ringkasan lokal mencatat ${openObligations.length} tugas terbuka (${criticalObs.length} prioritas tinggi, ${importantObs.length} penting). Kesesuaian klinis dan kelengkapan serah terima belum diverifikasi oleh layanan analisis.`,
    riskLevel: 'UNASSESSED',
    criticalNotes: criticalObs.map((item) => `Perlu ditinjau oleh petugas berwenang: ${item.title}`),
    isValidated: false,
    source: 'local_workload_summary'
  };
  handoverCache.set(cacheKey, fallbackResult);
  return fallbackResult;
}
