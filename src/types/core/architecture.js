/**
 * SambungJaga AI — Care Superagent Architecture Primitives & Constants
 *
 * @module types/architecture
 * @description Centralized domain types, status enums, authority envelope definitions, and core innovations metadata.
 */

/**
 * Epistemic Status States (P3 Epistemic Fact Ledger)
 * @readonly
 * @enum {string}
 */
export const EPISTEMIC_STATUS = {
  OBSERVED: 'observed',     // Diamati langsung (sensor IoT / foto)
  REPORTED: 'reported',     // Dilaporkan oleh pengasuh/keluarga
  INFERRED: 'inferred',     // Disimpulkan oleh AI dari kombinasi fakta
  CONTRADICTED: 'contradicted', // Terdeteksi kontradiksi data
  STALE: 'stale'            // Data kedaluwarsa
};

/**
 * UI Badges and Labels for Epistemic States
 */
export const EPISTEMIC_LABELS = {
  [EPISTEMIC_STATUS.OBSERVED]: { label: 'Diamati', color: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold' },
  [EPISTEMIC_STATUS.REPORTED]: { label: 'Dilaporkan', color: 'bg-sky-100 text-sky-800 border-sky-300 font-bold' },
  [EPISTEMIC_STATUS.INFERRED]: { label: 'Disimpulkan AI', color: 'bg-purple-100 text-purple-800 border-purple-300 font-bold' },
  [EPISTEMIC_STATUS.CONTRADICTED]: { label: 'Kontradiksi!', color: 'bg-rose-100 text-rose-800 border-rose-300 font-extrabold animate-pulse' },
  [EPISTEMIC_STATUS.STALE]: { label: 'Basi', color: 'bg-amber-100 text-amber-800 border-amber-300 font-bold' }
};

/**
 * Evidence Grades (P2 Evidence-Grade Closure)
 * @readonly
 * @enum {string}
 */
export const EVIDENCE_GRADE = {
  E0: 'E0', // Klaim verbal/teks tanpa lampiran
  E1: 'E1', // Artefak Digital (Foto tanpa wajah, QR hash)
  E2: 'E2', // Konfirmasi Orang Kedua (Dual Signoff)
  E3: 'E3'  // Verifikasi Sistem / Sensor IoT
};

/**
 * Descriptions and Requirements for Evidence Grades
 */
export const EVIDENCE_GRADE_LABELS = {
  E0: { name: 'E0 - Klaim Verbal', desc: 'Laporan teks/suara', requirement: 'Risiko Sangat Rendah' },
  E1: { name: 'E1 - Artefak Digital', desc: 'Foto objek / QR Hash', requirement: 'Risiko Rutin' },
  E2: { name: 'E2 - Konfirmasi Ganda', desc: 'Dua orang pengasuh', requirement: 'Risiko Tinggi' },
  E3: { name: 'E3 - Sensor IoT System', desc: 'Verifikasi Sensor Otomatis', requirement: 'Kritis / Vital' }
};

/**
 * Authority Envelope Levels (P6 Authority Envelope)
 * @readonly
 * @enum {string}
 */
export const AUTHORITY_ENVELOPE = {
  A0: 'A0', // Baca data (Read-Only)
  A1: 'A1', // Aksi Reversibel System
  A2: 'A2', // Notifikasi & Peringatan (WhatsApp Alert)
  A3: 'A3'  // Action Klinis/Ireversibel (Membutuhkan Mandatory Human Review)
};

/**
 * Care Obligation Statuses
 * @readonly
 * @enum {string}
 */
export const OBLIGATION_STATUS = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  VERIFIED_CLOSED: 'verified_closed',
  ESCALATED: 'escalated',
  BREACHED: 'breached'
};

/**
 * Obligation Priority Levels
 * @readonly
 * @enum {string}
 */
export const OBLIGATION_PRIORITY = {
  ROUTINE: 'routine',
  IMPORTANT: 'important',
  CRITICAL: 'critical',
  EMERGENCY: 'emergency'
};

/**
 * System Actors & Roles List
 */
export const ACTORS = [
  { id: 'supervisor', title: 'Supervisor Klinis', subtitle: 'Pusat Kontrol & Triage' },
  { id: 'caregiver', title: 'Pengasuh / Perawat', subtitle: 'PWA Mobile (Offline-first)' },
  { id: 'family', title: 'Keluarga Pasien', subtitle: 'Consent-Filtered Portal' },
  { id: 'admin_hr', title: 'Admin Panti / HR', subtitle: 'Competency & Coverage' },
  { id: 'orchestrator', title: 'Care Superagent', subtitle: 'Orchestrator & Kernel Viewer' }
];

/**
 * Core Innovations P1–P6 Metadata
 */
export const CORE_INNOVATIONS = [
  { code: 'P1', title: 'Bitemporal Obligation Ledger', desc: 'Waktu berlaku (Valid Time) vs Waktu Catat (Transaction Time) + Retroactive Replay' },
  { code: 'P2', title: 'Evidence-Grade Closure', desc: 'Verifikasi berjenjang E0-E3 + Random Spot Challenge Engine' },
  { code: 'P3', title: 'Epistemic Fact Ledger', desc: 'Penjejakan 5 status fakta: Diamati, Dilaporkan, Disimpulkan, Kontradiksi, Basi' },
  { code: 'P4', title: 'Failure-Set Search', desc: 'Simulasi kombinasi kegagalan terkecil yang menelantarkan kewajiban kritis' },
  { code: 'P5', title: 'Tamper-Evident Offline Ledger', desc: 'Hash-chain lokal pada PWA dengan atestasi perangkat anti-backdate' },
  { code: 'P6', title: 'Authority Envelope', desc: 'Pencegahan aksi ilegal AI: A0 (Baca), A1 (Reversibel), A2 (Alert), A3 (Klinis -> Mandatory Human Approval)' }
];

/**
 * Resident Care Dependency Levels (Validated by clinical professional)
 */
export const CARE_LEVEL = {
  MANDIRI: 'mandiri',             // Mandiri (Independent)
  PARTIAL_CARE: 'partial_care',   // Perawatan Parsial (Assisted)
  TOTAL_CARE: 'total_care'        // Perawatan Total (High Dependency)
};

/**
 * Agent Execution Policy Levels (A0 - A3)
 */
export const AGENT_POLICY = {
  A0_READ_ONLY: 'A0',                // Query and read state
  A1_ADMIN_STATE_CHANGE: 'A1',       // Reversible admin task, queueing, auto-assign
  A2_NOTIFICATION_DISPATCH: 'A2',    // Notification, WhatsApp alert
  A3_HUMAN_APPROVAL_REQUIRED: 'A3'   // Mandatory Human Approval (Clinical, irreversible, high risk)
};

/**
 * System Event Queue Types
 */
export const SYSTEM_EVENT_TYPES = {
  FACT_CREATED: 'FACT_CREATED',
  OBLIGATION_CREATED: 'OBLIGATION_CREATED',
  OBLIGATION_CLOSED: 'OBLIGATION_CLOSED',
  STAFF_ABSENT: 'STAFF_ABSENT',
  SLA_BREACH: 'SLA_BREACH',
  EVIDENCE_SUBMITTED: 'EVIDENCE_SUBMITTED',
  HANDOVER_INITIATED: 'HANDOVER_INITIATED',
  FAMILY_COMPLAINT: 'FAMILY_COMPLAINT',
  FAMILY_VISIT_REQUEST: 'FAMILY_VISIT_REQUEST'
};

