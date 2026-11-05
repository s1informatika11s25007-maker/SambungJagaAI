/**
 * SambungJaga AI — Semantic Cross-Source Deduplication Engine
 *
 * Prevents duplicate epistemic facts and care obligations from being recorded
 * across different sources (voice report, IoT sensor, text note, family portal)
 * within a bitemporal time window.
 */

import { supabase } from '../../supabase/client/client';

export function calculateTextSimilarity(textA = '', textB = '') {
  const cleanA = textA.toLowerCase().replace(/[^\w\s]/g, '').trim();
  const cleanB = textB.toLowerCase().replace(/[^\w\s]/g, '').trim();

  if (cleanA === cleanB) return 1.0;
  if (!cleanA || !cleanB) return 0.0;

  const wordsA = new Set(cleanA.split(/\s+/));
  const wordsB = new Set(cleanB.split(/\s+/));

  const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
  const union = new Set([...wordsA, ...wordsB]);

  return intersection.size / union.size;
}

export async function isSemanticDuplicateFact({
  residentId,
  factKey,
  factText = '',
  timeWindowMinutes = 15
} = {}) {
  if (!residentId || !factKey) return false;

  const cutoffIso = new Date(Date.now() - timeWindowMinutes * 60 * 1000).toISOString();

  try {
    const { data: recentFacts } = await supabase
      .from('epistemic_facts')
      .select('*')
      .eq('resident_id', residentId)
      .eq('fact_key', factKey)
      .gte('observed_at', cutoffIso);

    if (!recentFacts || recentFacts.length === 0) return false;

    for (const existing of recentFacts) {
      const existingText = typeof existing.fact_value === 'string'
        ? existing.fact_value
        : (existing.fact_value?.text || existing.fact_value?.value || JSON.stringify(existing.fact_value));

      const similarity = calculateTextSimilarity(factText, existingText);
      if (similarity >= 0.70) {
        return {
          isDuplicate: true,
          matchedFactId: existing.id,
          similarityScore: similarity
        };
      }
    }
  } catch (err) {
    console.warn('[Semantic Deduplicator] DB check fallback:', err);
  }

  return { isDuplicate: false };
}
