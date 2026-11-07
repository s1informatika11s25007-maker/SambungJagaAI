/**
 * SambungJaga AI — Optional Chrome Built-in Gemini Nano Adapter
 *
 * AI is restricted to summarization and human-review suggestions.
 * Deterministic matching remains authoritative.
 */

export async function isGeminiNanoAvailable() {
  if (
    typeof window === 'undefined' ||
    !window.ai?.languageModel
  ) {
    return false;
  }

  try {
    const availability =
      await window.ai.languageModel.availability();

    return (
      availability === 'readily' ||
      availability === 'after-download'
    );

  } catch (error) {
    console.warn(
      '[Gemini Nano] Availability check failed:',
      error
    );

    return false;
  }
}


/**
 * Runs on-device report analysis.
 */

export async function runGeminiNanoSuperagent(
  prompt,
  context = {}
) {
  if (!(await isGeminiNanoAvailable())) {
    return null;
  }

  let session;

  try {
    const residentDirectory =
      (context?.residents || [])
        .map(
          resident =>
            `${resident.full_name || 'Nama tidak tersedia'} (${resident.room_number || 'kamar tidak tersedia'})`
        )
        .join('; ');

    const openTasks =
      (context?.activeObligations || [])
        .map(
          item =>
            `${item.title || 'Tugas'} [${item.status || 'status tidak tersedia'}]`
        )
        .join('; ');

    const systemPrompt = [
      'Anda adalah asisten pencatatan laporan perawatan SambungJaga.',
      'Gunakan Bahasa Indonesia yang jelas dan ringkas.',

      `Direktori penghuni untuk konteks saja: ${residentDirectory || 'tidak tersedia'}.`,

      `Tugas aktif untuk konteks saja: ${openTasks || 'tidak tersedia'}.`,

      'Ringkas laporan dan identifikasi fakta yang benar-benar disebutkan.',

      'Jangan membuat diagnosis atau interpretasi klinis.',

      'Jangan memberikan dosis, instruksi klinis, atau perubahan terapi.',

      'Jangan menentukan identitas penghuni secara otoritatif.',

      'Resolver deterministik aplikasi yang menentukan identitas penghuni.',

      'Jangan menyetujui atau menutup kewajiban perawatan.',

      'Semua keputusan membutuhkan petugas berwenang.',

      'Kembalikan JSON saja dengan bentuk:',

      '{"result":"ringkasan laporan","proposedObligations":[{"title":"judul tugas peninjauan","description":"alasan netral","priority":"routine|important|critical","required_evidence_grade":"E0|E1","valid_until_minutes":120}],"modelsChainUsed":["gemini-nano"]}',

      'Jika tidak ada tindak lanjut jelas, gunakan array kosong.'
    ].join('\n');

    session =
      await window.ai.languageModel.create({
        systemPrompt,
        temperature: 0.1
      });

    const response = await session.prompt(
      `Laporan caregiver: ${String(prompt || '').slice(0, 5000)}`
    );

    let parsed;

    try {
      parsed = JSON.parse(response);
    } catch {
      parsed = {
        result: String(response || '')
      };
    }

    return {
      result:
        String(
          parsed?.result ||
          'Laporan dianalisis dan menunggu tindak lanjut petugas.'
        ),

      proposedObligations:
        Array.isArray(parsed?.proposedObligations)
          ? parsed.proposedObligations.slice(0, 3)
          : [],

      modelsChainUsed: [
        'gemini-nano'
      ]
    };

  } catch (error) {
    console.warn(
      '[Gemini Nano] On-device analysis unavailable:',
      error
    );

    return null;

  } finally {
    try {
      session?.destroy?.();
    } catch {
      // Browser AI runtime cleanup may fail.
    }
  }
}


/**
 * Optional handover summary helper.
 */

export async function summarizeHandoverGeminiNano(
  handoverLogsText
) {
  if (
    typeof window === 'undefined' ||
    !window.ai?.summarizer
  ) {
    return null;
  }

  let summarizer;

  try {
    summarizer =
      await window.ai.summarizer.create({
        type: 'headline',
        length: 'short'
      });

    const summary =
      await summarizer.summarize(
        String(handoverLogsText || '').slice(0, 8000)
      );

    return String(summary || '').trim() || null;

  } catch (error) {
    console.warn(
      '[Gemini Nano] Handover summary unavailable:',
      error
    );

    return null;

  } finally {
    try {
      summarizer?.destroy?.();
    } catch {
      // Ignore cleanup errors.
    }
  }
}