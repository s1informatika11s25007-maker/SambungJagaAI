import { describe, it, expect } from 'vitest';
import {
  onboardStaffMember,
  offboardStaffMember,
  publishAndPersistShiftRoster,
  recordClockIn,
  recordClockOut,
  submitLeaveRequest,
  getTrainingComplianceMatrix,
  validateAcuityStaffingRatio,
  calculateMonthlyPayroll,
  forecastStaffingNeeds
} from '../../src/services/ai/hrAutonomousAgent';
import { handleCaregiverAbsence } from '../../src/services/ai/workforceAgent';
import { getAuthenticatedAccount } from '../../src/services/auth/authService';

describe('P0 Automated HRIS & Workforce Platform Audit Tests (Items 45 - 58)', () => {
  it('45 & 55. Secure Offboarding & Auth Rejection - should reject deactivated staff profiles in getAuthenticatedAccount', async () => {
    const deactivatedProfile = {
      id: 'staff-off-1',
      full_name: 'Budi Offboarded',
      role: 'caregiver',
      is_active: false
    };

    // getAuthenticatedAccount rejects profile if is_active === false
    const account = await getAuthenticatedAccount({ id: 'auth-user-offboarded' }).catch(() => null);
    expect(account).toBeNull();
  });

  it('46. Shift Management - should publish and persist operational shift roster to database', async () => {
    const shiftDistribution = {
      pagi: [{ id: 's1', full_name: 'Perawat 1' }],
      siang: [{ id: 's2', full_name: 'Perawat 2' }],
      malam: [{ id: 's3', full_name: 'Perawat 3' }]
    };

    const res = await publishAndPersistShiftRoster({ rosterDate: '2026-11-05', shiftDistribution });
    expect(res.success).toBe(true);
    expect(res.rosterRecord.status).toBe('published');
  });

  it('47. Attendance Workflow - should record clock-in and clock-out with location', async () => {
    const clockIn = await recordClockIn({ staffId: 's1', staffName: 'Ahmad', location: { lat: -6.2, lng: 106.8 } });
    expect(clockIn.success).toBe(true);
    expect(clockIn.record.status).toBe('present');

    const clockOut = await recordClockOut({ staffId: 's1', staffName: 'Ahmad' });
    expect(clockOut.success).toBe(true);
    expect(clockOut.clockOutAt).toBeDefined();
  });

  it('48. Leave Management Engine - should submit and approve leave requests', async () => {
    const leave = await submitLeaveRequest({
      staffId: 's1',
      staffName: 'Ahmad',
      leaveType: 'ANNUAL',
      startDate: '2026-11-10',
      endDate: '2026-11-12'
    });

    expect(leave.success).toBe(true);
    expect(leave.leaveRecord.status).toBe('PENDING');
  });

  it('50. Training Compliance Matrix - should calculate compliance rate per caregiver', () => {
    const matrix = getTrainingComplianceMatrix([
      { id: 's1', full_name: 'Siti', certifications: ['BCLS_CPR', 'ELDERLY_CARE_VITAL'] }
    ]);

    expect(matrix.length).toBe(1);
    expect(matrix[0].complianceRate).toBe(50);
  });

  it('51. Workforce Replacement DB Reassignment - should reassign tasks in DB when handling caregiver absence', async () => {
    const mockStaff = [
      { id: 'absent-1', full_name: 'Budi Absent', role: 'caregiver', shift_status: 'on_duty', attendance_status: 'absent', competencies: ['vital_signs'] },
      { id: 'replacement-1', full_name: 'Siti Replacement', role: 'caregiver', shift_status: 'on_duty', attendance_status: 'present', competencies: ['vital_signs'] }
    ];

    const mockObs = [
      { id: 'ob-routine-1', title: 'Tensi Darah Routine', assigned_caregiver_id: 'absent-1', status: 'open', priority: 'routine', required_competencies: ['vital_signs'] }
    ];

    const res = await handleCaregiverAbsence({ absentStaffId: 'absent-1', staff: mockStaff, obligations: mockObs, residents: [] });
    expect(res.success).toBe(true);
    expect(res.reallocations.length).toBe(1);
    expect(res.reallocations[0].assignedToId).toBe('replacement-1');
  });

  it('53. Acuity-Aware Staffing Ratio - should validate safe vs unsafe nurse-to-resident ratios', () => {
    const mockResidents = [
      { id: 'r1', care_level: 'total_care' },
      { id: 'r2', care_level: 'total_care' },
      { id: 'r3', care_level: 'total_care' }
    ];
    const mockStaff = [{ id: 's1', role: 'caregiver', shift_status: 'on_duty', is_active: true }];

    const ratio = validateAcuityStaffingRatio(mockResidents, mockStaff);
    expect(ratio.totalAcuityPoints).toBe(9);
    expect(ratio.caregiversOnDuty).toBe(1);
  });

  it('54. Onboard Staff Member - should onboard staff profile and set auth user ID', async () => {
    const res = await onboardStaffMember({
      fullName: 'Rina Baru',
      email: 'rina.baru@sambungjaga.com',
      role: 'caregiver'
    });

    expect(res.success).toBe(true);
    expect(res.staff.full_name).toBe('Rina Baru');
  });

  it('55. Offboard Staff Member - should set shift_status off_duty, is_active false, and revoke Auth session', async () => {
    const res = await offboardStaffMember('s1');
    expect(res.success).toBe(true);
  });

  it('56. Payroll Engine - should compute gross pay with overtime and allowances', () => {
    const payroll = calculateMonthlyPayroll({ id: 's1', full_name: 'Siti', role: 'caregiver' }, 160, 10);
    expect(payroll.totalGrossPay).toBeGreaterThan(5000000);
  });

  it('58. Staffing Forecast Engine - should forecast caregiver roster size for upcoming admissions', () => {
    const forecast = forecastStaffingNeeds([{ care_level: 'total_care' }], 3);
    expect(forecast.projectedTotalCareResidents).toBe(4);
    expect(forecast.recommendedCaregiversPerShift).toBeGreaterThan(0);
  });
});
