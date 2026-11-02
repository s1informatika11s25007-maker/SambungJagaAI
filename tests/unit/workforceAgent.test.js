import { describe, it, expect } from 'vitest';
import { calculateCaregiverWorkload, findOptimalCaregiverForTask, handleCaregiverAbsence } from '../../src/services/ai/workforceAgent';

describe('Workforce Intelligence Agent Unit Tests', () => {
  const mockStaff = [
    { id: 'cg-1', full_name: 'Dewi Perawat', role: 'caregiver', shift_status: 'on_duty', attendance_status: 'present', competencies: ['vital_signs', 'medication_admin'] },
    { id: 'cg-2', full_name: 'Budi Perawat', role: 'caregiver', shift_status: 'on_duty', attendance_status: 'present', competencies: ['vital_signs', 'wound_care'] },
    { id: 'cg-3', full_name: 'Siti Perawat', role: 'caregiver', shift_status: 'off_duty', attendance_status: 'absent', competencies: ['vital_signs'] }
  ];

  const mockResidents = [
    { id: 'res-1', full_name: 'Oma Aminah', care_level: 'total_care' },
    { id: 'res-2', full_name: 'Opa Bambang', care_level: 'partial_care' }
  ];

  const mockObligations = [
    { id: 'ob-1', resident_id: 'res-1', assigned_caregiver_id: 'cg-1', priority: 'critical', status: 'open', estimated_duration_minutes: 30 },
    { id: 'ob-2', resident_id: 'res-2', assigned_caregiver_id: 'cg-2', priority: 'routine', status: 'open', estimated_duration_minutes: 20 }
  ];

  it('should calculate caregiver workload score considering care level and priority weights', () => {
    const workload = calculateCaregiverWorkload('cg-1', mockObligations, mockResidents);
    expect(workload.activeTaskCount).toBe(1);
    expect(workload.workloadScore).toBeGreaterThan(0);
    expect(workload.estimatedMinutes).toBe(30);
  });

  it('should find optimal caregiver matching required competencies and lowest workload', () => {
    const task = { id: 'new-task', required_competencies: ['vital_signs', 'wound_care'] };
    const match = findOptimalCaregiverForTask({
      task,
      staff: mockStaff,
      obligations: mockObligations,
      residents: mockResidents
    });

    expect(match.candidate).not.toBeNull();
    expect(match.candidate.id).toBe('cg-2');
  });

  it('should handle sudden caregiver absence and prepare re-allocation draft', async () => {
    const result = await handleCaregiverAbsence({
      absentStaffId: 'cg-1',
      staff: mockStaff,
      obligations: mockObligations,
      residents: mockResidents
    });

    expect(result.success).toBe(true);
    expect(result.affectedCount).toBe(1);
    expect(result.reallocations.length).toBeGreaterThan(0);
  });
});
