import { API_ROUTES } from '@/constants/routes';
import { TreatmentSequence, TreatmentSequenceStepStatus } from '@/lib/types';
import api from '@/services/api';

// In-memory store — resets on page refresh (mock only)
const MOCK_SEQUENCES: TreatmentSequence[] = [
  {
    id: 'ts_001',
    patient_id: 'demo',
    service_id: 'srv_implant',
    service_name: 'Implante Dental',
    service_color: '#6366f1',
    status: 'active',
    started_at: '2026-03-01',
    created_at: '2026-03-01T10:00:00Z',
    steps: [
      {
        id: 'step_001_1',
        step_number: 1,
        step_name: 'Extracción dental',
        scheduled_date: '2026-03-01',
        status: 'completed',
        completed_at: '2026-03-01T11:00:00Z',
      },
      {
        id: 'step_001_2',
        step_number: 2,
        step_name: 'Colocación del implante',
        scheduled_date: '2026-04-01',
        status: 'scheduled',
      },
      {
        id: 'step_001_3',
        step_number: 3,
        step_name: 'Colocación de corona',
        scheduled_date: '2026-07-01',
        status: 'pending',
      },
    ],
  },
  {
    id: 'ts_002',
    patient_id: 'demo',
    service_id: 'srv_ortho',
    service_name: 'Ortodoncia',
    service_color: '#f59e0b',
    status: 'active',
    started_at: '2026-01-15',
    created_at: '2026-01-15T09:00:00Z',
    steps: [
      {
        id: 'step_002_1',
        step_number: 1,
        step_name: 'Evaluación inicial y moldes',
        scheduled_date: '2026-01-15',
        status: 'completed',
        completed_at: '2026-01-15T10:00:00Z',
      },
      {
        id: 'step_002_2',
        step_number: 2,
        step_name: 'Colocación de brackets',
        scheduled_date: '2026-02-01',
        status: 'completed',
        completed_at: '2026-02-01T10:00:00Z',
      },
      {
        id: 'step_002_3',
        step_number: 3,
        step_name: 'Control mensual #1',
        scheduled_date: '2026-03-01',
        status: 'missed',
      },
      {
        id: 'step_002_4',
        step_number: 4,
        step_name: 'Control mensual #2',
        scheduled_date: '2026-04-01',
        status: 'pending',
      },
    ],
  },
];

export async function getTreatmentSequences(patientId: string): Promise<TreatmentSequence[]> {
  try {
    const res = await api.get(API_ROUTES.TREATMENT_PLANS.GET_BY_PATIENT, { patient_id: patientId });
    const raw: TreatmentSequence[] = Array.isArray(res)
      ? res
      : Array.isArray(res?.[0])
        ? res[0]
        : [];
    return raw;
  } catch {
    return [];
  }
}

export async function createTreatmentSequence(
  data: Omit<TreatmentSequence, 'id' | 'created_at'>
): Promise<TreatmentSequence> {
  const newSeq: TreatmentSequence = {
    ...data,
    id: `ts_${Date.now()}`,
    created_at: new Date().toISOString(),
  };
  MOCK_SEQUENCES.push(newSeq);
  return newSeq;
}

export async function updateSequenceStepStatus(
  sequenceId: string,
  stepId: string,
  status: TreatmentSequenceStepStatus
): Promise<void> {
  const seq = MOCK_SEQUENCES.find(s => s.id === sequenceId);
  if (seq) {
    const step = seq.steps.find(s => s.id === stepId);
    if (step) {
      step.status = status;
      if (status === 'completed') {
        step.completed_at = new Date().toISOString();
      }
    }
  }
}

export async function updateTreatmentSequenceStep(
  sequenceId: string,
  stepId: string,
  patch: Partial<Pick<TreatmentSequence['steps'][number], 'step_name' | 'scheduled_date' | 'notes' | 'status'>>
): Promise<void> {
  const seq = MOCK_SEQUENCES.find(s => s.id === sequenceId);
  if (seq) {
    const step = seq.steps.find(s => s.id === stepId);
    if (step) Object.assign(step, patch);
  }
}

export async function addTreatmentSequenceStep(
  sequenceId: string,
  step: Omit<TreatmentSequence['steps'][number], 'id'>
): Promise<TreatmentSequence['steps'][number]> {
  const seq = MOCK_SEQUENCES.find(s => s.id === sequenceId);
  const newStep = { ...step, id: `step_${Date.now()}` };
  if (seq) seq.steps.push(newStep);
  return newStep;
}

export async function deleteTreatmentSequenceStep(
  sequenceId: string,
  stepId: string
): Promise<void> {
  const seq = MOCK_SEQUENCES.find(s => s.id === sequenceId);
  if (seq) {
    seq.steps = seq.steps.filter(s => s.id !== stepId);
    // Re-number remaining steps
    seq.steps.forEach((s, i) => { s.step_number = i + 1; });
  }
}
