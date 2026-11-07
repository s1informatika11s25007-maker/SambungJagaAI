/**
 * SambungJaga AI — Messaging Report Adapter
 *
 * In-app simulator is NOT a live WhatsApp integration.
 * Actual inbound messages must use authenticated server-side gateway.
 */

import {
  supabase
} from '../../supabase/client/client.js';


/**
 * Server-side WhatsApp webhook gateway adapter.
 */

export async function handleWhatsAppInboundWebhook({
  messageText,
  senderName = 'Staf Perawat (WhatsApp)',
  senderPhone = null,
  audioUrl = null,
  facilityId = null
} = {}) {
  if (
    !String(messageText || '').trim() &&
    !audioUrl
  ) {
    return {
      success: false,
      error: 'Pesan atau URL audio WhatsApp wajib disertakan.'
    };
  }

  if (!facilityId) {
    return {
      success: false,
      error: 'Facility ID wajib diverifikasi dari konfigurasi server.'
    };
  }

  const startedAt = Date.now();

  try {
    const { data, error } = await supabase.functions.invoke(
      'ai_messaging_gateway',
      {
        body: {
          channel: 'whatsapp_webhook',
          messageText: String(messageText || '').trim(),
          senderName,
          senderPhone,
          audioUrl,
          facilityId
        }
      }
    );

    if (error) {
      return {
        success: false,
        error: `Gateway WhatsApp gagal: ${error.message}`
      };
    }

    if (data?.success !== true) {
      return {
        success: false,

        error:
          data?.error ||
          'Gateway WhatsApp tidak mengonfirmasi pemrosesan pesan.'
      };
    }

    return {
      success: true,

      replyMessage:
        data.replyMessage ||
        'Pesan diterima oleh gateway.',

      processingTimeMs:
        data.processingTimeMs ||
        Date.now() - startedAt,

      processedAt:
        data.processedAt ||
        new Date().toISOString()
    };

  } catch (error) {
    return {
      success: false,

      error:
        error?.message ||
        'Gateway WhatsApp tidak dapat dihubungi.'
    };
  }
}


/**
 * Local UI simulator.
 *
 * Success requires confirmation from the same caregiver callback.
 */

export async function processWhatsAppVoiceReport({
  messageText,
  senderName = 'Caregiver (simulator)',
  context = {},
  onCaptureSubmit
} = {}) {
  const text = String(
    messageText || ''
  ).trim();

  if (!text) {
    return {
      success: false,
      error: 'Pesan laporan tidak boleh kosong.'
    };
  }

  if (typeof onCaptureSubmit !== 'function') {
    return {
      success: false,
      error: 'Handler pencatatan caregiver tidak tersedia.'
    };
  }

  const startedAt = Date.now();

  let captureResult;

  try {
    captureResult = await onCaptureSubmit({
      text,
      sourceType: 'text_input',
      actorName: `${senderName} [simulator]`
    });

  } catch (error) {
    return {
      success: false,

      error:
        error?.message ||
        'Laporan dari simulator gagal diproses.'
    };
  }

  if (captureResult?.success !== true) {
    return {
      success: false,

      error:
        captureResult?.error ||
        'Database belum mengonfirmasi penyimpanan laporan.',

      captureResult,

      processingTimeMs:
        Date.now() - startedAt,

      replyMessage:
        `Laporan belum tersimpan. ${
          captureResult?.error ||
          'Identitas penghuni atau penyimpanan perlu diperiksa.'
        }`
    };
  }

  const offline =
    captureResult?.isOfflineSaved === true;

  const residentName =
    captureResult?.agentResult?.detectedResidentName ||
    captureResult?.residentMatch?.resident?.full_name ||
    null;

  const replyLines = [
    `Halo ${senderName}.`,

    offline
      ? 'Laporan disimpan pada antrean lokal dan menunggu sinkronisasi.'
      : 'Database mengonfirmasi laporan tersimpan.',

    residentName
      ? `Penghuni: ${residentName}.`
      : null,

    'Usulan tindak lanjut tetap memerlukan pemeriksaan petugas berwenang.'
  ].filter(Boolean);

  return {
    success: true,

    replyMessage:
      replyLines.join('\n'),

    processingTimeMs:
      Date.now() - startedAt,

    captureResult,

    contextReceived:
      Boolean(context?.residents?.length)
  };
}