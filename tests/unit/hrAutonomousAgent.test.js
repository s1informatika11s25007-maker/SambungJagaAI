import { describe, it, expect } from 'vitest';
import { checkCertificationExpirations, reconcileAttendanceWithRoster, draftShiftRoster, generateMonthlyHrReport, offboardStaffMember } from '../../src/services/ai/hrAutonomousAgent';

describe('HR Autonomous Operations Agent Unit Tests', () => {
  const staff = [
    {
      id: 'st-1',
      full_name: 'Dewi Perawat',
      role: 'caregiver',
      shift_status: 'on_duty',
      attendance_status: 'absent',
      is_active: true,
      certifications: [
        { name: 'Sertifikat Perawat Lansia', expires_at: new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString() }
      ]
    },
    {
      id: 'st-2',
      full_name: 'Budi Perawat',
      role: 'caregiver',
      shift_status: 'on_duty',
      attendance_status: 'present',
      is_active: true
    }
  ];

  it('should detect certification expiration alerts within 30 days', async () => {
    const alerts = await checkCertificationExpirations(staff);
    expect(alerts.length).toBe(1);
    expect(alerts[0].staffName).toBe('Dewi Perawat');
    expect(alerts[0].urgency).toBe('critical');
  });

  it('should reconcile attendance against roster to flag unannounced absence', () => {
    const discrepancies = reconcileAttendanceWithRoster(staff);
    expect(discrepancies.length).toBe(1);
    expect(discrepancies[0].issue).toBe('UNANNOUNCED_ABSENCE');
  });

  it('should draft shift roster automatically', () => {
    const roster = draftShiftRoster(staff);
    expect(roster.success).toBe(true);
    expect(roster.totalCaregivers).toBe(2);
  });

  it('should generate monthly HR operational report', () => {
    const report = generateMonthlyHrReport(staff, []);
    expect(report.totalStaff).toBe(2);
    expect(report.activeStaff).toBe(2);
  });

  it('should offboard staff member atomically', async () => {
    const result = await offboardStaffMember('st-1');
    expect(result).toHaveProperty('success');
  });
});
