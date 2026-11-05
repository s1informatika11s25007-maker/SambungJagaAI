/**
 * SambungJaga AI — PDP Privacy Anonymization & Data Masking Engine
 *
 * Anonymizes PII (Resident Names, Room Numbers, NIK, Phone Numbers)
 * BEFORE passing text prompts to external AI models (Groq/OpenAI/Gemini).
 */

export function maskSensitiveDataForAiPrompt(promptText = '', residents = []) {
  if (!promptText || typeof promptText !== 'string') return { maskedPrompt: promptText, maskMap: new Map() };

  let maskedPrompt = promptText;
  const maskMap = new Map();

  // 1. Anonymize Resident Names & Room Numbers
  residents.forEach((res, index) => {
    if (res.full_name && res.full_name.trim()) {
      const anonId = `RESIDENT_${res.id ? res.id.slice(0, 6) : index + 1}`;
      const nameRegex = new RegExp(res.full_name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      if (nameRegex.test(maskedPrompt)) {
        maskMap.set(anonId, res.full_name);
        maskedPrompt = maskedPrompt.replace(nameRegex, anonId);
      }
    }

    if (res.room_number) {
      const roomRegex = new RegExp(`kamar\\s+${res.room_number}`, 'gi');
      maskedPrompt = maskedPrompt.replace(roomRegex, `kamar ROOM_ANON`);
    }
  });

  // 2. Anonymize Phone Numbers
  maskedPrompt = maskedPrompt.replace(/(\+62|62|0)8[1-9][0-9]{7,10}/g, '[PHONE_ANONYMIZED]');

  // 3. Anonymize NIK / KTP Numbers (16 digits)
  maskedPrompt = maskedPrompt.replace(/\b\d{16}\b/g, '[NIK_ANONYMIZED]');

  return {
    maskedPrompt,
    maskMap,
    isAnonymized: maskMap.size > 0
  };
}

export function unmaskAiResponseData(aiResponseText = '', maskMap = new Map()) {
  if (!aiResponseText || maskMap.size === 0) return aiResponseText;

  let unmasked = aiResponseText;
  maskMap.forEach((originalName, anonId) => {
    unmasked = unmasked.replace(new RegExp(anonId, 'g'), originalName);
  });

  return unmasked;
}
