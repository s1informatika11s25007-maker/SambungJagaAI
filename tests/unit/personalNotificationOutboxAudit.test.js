import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { sendWhatsAppNotification, sendEmailNotification, sendSmsNotification, updateNotificationDeliveryReceipt } from '../../src/services/notifications/messagingProviders';

describe('P0 Personal Notifications & Transactional Messaging Outbox Audit Tests', () => {
  it('should verify SQL migration includes personal recipient_user_id and delivery receipt fields', () => {
    const sqlPath = path.resolve('supabase/migrations/20261102000000_autonomous_platform_foundations.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    expect(sql).toContain('recipient_user_id UUID');
    expect(sql).toContain('delivery_status TEXT');
    expect(sql).toContain('delivered_at TIMESTAMPTZ');
    expect(sql).toContain('read_at TIMESTAMPTZ');
    expect(sql).toContain('idx_notifications_recipient_user_id');
  });

  it('should send WhatsApp notification and return delivery receipt', async () => {
    const res = await sendWhatsAppNotification({
      recipientPhone: '+6281234567890',
      message: 'Notifikasi penugasan perawat personal'
    });

    expect(res.success).toBe(true);
    expect(res.channel).toBe('whatsapp');
    expect(res.deliveredAt).toBeDefined();
  });

  it('should send Email and SMS notifications with delivery receipts', async () => {
    const emailRes = await sendEmailNotification({
      recipientEmail: 'caregiver@sambungjaga.com',
      subject: 'Tugas Perawatan Baru',
      body: 'Detail tugas'
    });
    expect(emailRes.success).toBe(true);

    const smsRes = await sendSmsNotification({
      recipientPhone: '+6281234567890',
      message: 'Peringatan Darurat SLA'
    });
    expect(smsRes.success).toBe(true);
  });
});
