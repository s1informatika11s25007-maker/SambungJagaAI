import { describe, it, expect } from 'vitest';
import {
  draftShiftRoster,
  reconcileAttendanceWithRoster,
  getTrainingComplianceMatrix,
  validateAcuityStaffingRatio,
  publishAndPersistShiftRoster,
  recordClockIn,
  recordClockOut,
  submitLeaveRequest,
  calculateMonthlyPayroll,
  forecastStaffingNeeds,
  generateMonthlyHrReport,
  onboardStaffMember,
  offboardStaffMember
} from '../../src/services/ai/hrAutonomousAgent';
import { calculateCaregiverWorkload } from '../../src/services/ai/workforceAgent';

describe('P0 Autonomous HR Operations Agent Audit Tests', () => {
  const mockStaff = [
    { id: 'cg-1', full_name: 'Siti Caregiver', role: 'caregiver', shift_status: 'on_duty', attendance_status: 'present', competencies: ['BCLS_CPR'], is_active: true },
    { id: 'cg-2', full_name: 'Budi Caregiver', role: 'caregiver', shift_status: 'on_duty', attendance_status: 'present', competencies: ['ELDERLY_CARE_VITAL'], is_active: true },
    { id: 'cg-3', full_name: 'Rina Caregiver', role: 'caregiver', shift_status: 'off_duty', attendance_status: 'present', competencies: ['MEDICATION_SAFETY'], is_active: true }
  ];

  const mockResidents = [
    { id: 'res-1', full_name: 'Ibu Aminah', care_level: 'total_care' },
    { id: 'res-2', full_name: 'Bapak Bambang', care_level: 'partial_care' }
  ];

  it('1. Shift Roster Draft - should draft shift roster based on staff competencies and resident care levels', () => {
    const draft = draftShiftRoster(mockStaff, mockResidents);
    expect(draft.success).toBe(true);
    expect(draft.shiftDistribution.pagi.length).toBeGreaterThan(0);
  });

  it('2. Attendance Reconciliation - should detect unannounced absence against published roster', () => {
    const testStaff = [
      { id: 'cg-1', full_name: 'Siti Caregiver', role: 'caregiver', shift_status: 'on_duty', attendance_status: 'absent', is_active: true }
    ];
    const disc = reconcileAttendanceWithRoster(testStaff);
    expect(disc.length).toBe(1);
    expect(disc[0].issue).toBe('UNANNOUNCED_ABSENCE');
  });

  it('3. Training Compliance Matrix - should calculate compliance rate for required clinical trainings', () => {
    const matrix = getTrainingComplianceMatrix(mockStaff);
    expect(matrix.length).toBe(3);
    expect(matrix[0].complianceRate).toBeDefined();
  });

  it('4. Acuity-Aware Staffing Ratio Validator - should calculate acuity points (Total Care=3.0, Partial=1.5)', () => {
    const ratio = validateAcuityStaffingRatio(mockResidents, mockStaff);
    expect(ratio.totalAcuityPoints).toBe(4.5); // Total Care (3.0) + Partial Care (1.5)
    expect(ratio.caregiversOnDuty).toBe(2);
    expect(ratio.isSafe).toBe(true);
  });

  it('5. Dynamic Workload Balancing - should compute workload based on resident care level and task priority', () => {
    const mockObligations = [
      { id: 'ob-1', assigned_caregiver_id: 'cg-1', resident_id: 'res-1', priority: 'critical', estimated_duration_minutes: 45, status: 'open' }
    ];
    const workload = calculateCaregiverWorkload('cg-1', mockObligations, mockResidents);
    expect(workload.activeTaskCount).toBe(1);
    expect(workload.workloadScore).toBe(6); // critical weight (3) * total_care multiplier (2.0) = 6
    expect(workload.estimatedMinutes).toBe(45);
  });

  it('6. Onboarding & Offboarding - should onboard and offboard staff with Auth session handling', async () => {
    const onboard = await onboardStaffMember({ fullName: 'Ahmad Perawat Baru', role: 'caregiver' });
    expect(onboard.success).toBe(true);

    const offboard = await offboardStaffMember(onboard.staff.id);
    expect(offboard.success).toBe(true);
    expect(offboard.staff.is_active).toBe(false);
  });

  it('7. Monthly Payroll & Staffing Forecast - should calculate payroll and 30-day forecast', () => {
    const payroll = calculateMonthlyPayroll(mockStaff[0], 160, 10);
    expect(payroll.totalGrossPay).toBeGreaterThan(5000000);

    const forecast = forecastStaffingNeeds(mockResidents, 2);
    expect(forecast.forecastDaysAhead).toBe(30);
    expect(forecast.recommendedCaregiversPerShift).toBeGreaterThan(0);
  });
});
