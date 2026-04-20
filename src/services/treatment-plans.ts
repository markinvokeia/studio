import { API_ROUTES } from '@/constants/routes';
import type {
  AbandonedPlan,
  AvailabilityResult,
  StepDeletePayload,
  StepOperationResult,
  StepSchedulePayload,
  StepStatusPayload,
  StepUpsertPayload,
  TreatmentSequence,
} from '@/lib/types';
import api from '@/services/api';

// ── Patient sequences ─────────────────────────────────────────────────────────

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
  const res = await api.post(API_ROUTES.TREATMENT_PLANS.CREATE, data);
  return res as TreatmentSequence;
}

// ── Step CRUD ─────────────────────────────────────────────────────────────────

/**
 * Create or update a treatment step.
 * When cascade_mode !== 'none' and cascade_days !== 0,
 * subsequent steps (and their appointments) are shifted by cascade_days.
 * Returns all steps for the sequence after the operation.
 */
export async function upsertTreatmentStep(
  payload: StepUpsertPayload
): Promise<StepOperationResult> {
  try {
    const res = await api.post(API_ROUTES.TREATMENT_PLANS.STEP_UPSERT, payload);
    return res as StepOperationResult;
  } catch (err) {
    return { success: false, error: (err as Error).message ?? 'Unknown error' };
  }
}

/**
 * Delete a treatment step.
 * Optionally closes the date gap by pulling subsequent steps forward (cascade_days < 0).
 * Optionally cancels the linked appointment.
 */
export async function deleteTreatmentStep(
  payload: StepDeletePayload
): Promise<StepOperationResult> {
  try {
    const res = await api.delete(API_ROUTES.TREATMENT_PLANS.STEP_DELETE, payload);
    return res as StepOperationResult;
  } catch (err) {
    return { success: false, error: (err as Error).message ?? 'Unknown error' };
  }
}

/**
 * Change the status of a step.
 * Optionally syncs the linked appointment status / milestone_status.
 * Auto-completes the sequence if all non-cancelled steps are done.
 */
export async function changeStepStatus(
  payload: StepStatusPayload
): Promise<StepOperationResult> {
  try {
    const res = await api.post(API_ROUTES.TREATMENT_PLANS.STEP_STATUS, payload);
    return res as StepOperationResult;
  } catch (err) {
    return { success: false, error: (err as Error).message ?? 'Unknown error' };
  }
}

/**
 * Create a calendar appointment for a step that doesn't have one yet.
 * Links the appointment back to the step (appointment_id) and sets status = 'scheduled'.
 */
export async function scheduleStep(
  payload: StepSchedulePayload
): Promise<StepOperationResult> {
  try {
    const res = await api.post(API_ROUTES.TREATMENT_PLANS.STEP_SCHEDULE, payload);
    return res as StepOperationResult;
  } catch (err) {
    return { success: false, error: (err as Error).message ?? 'Unknown error' };
  }
}

// ── Availability validation ───────────────────────────────────────────────────

export type ValidateAvailabilityPayload = {
  service_id?: string | number;
  doctor_id: string;
  steps: {
    step_id: string;
    step_name: string;
    scheduled_date: string;
    duration_minutes: number;
    schedule_mode: 'calendar' | 'manual';
  }[];
};

export async function validateStepsAvailability(
  payload: ValidateAvailabilityPayload
): Promise<{ results: AvailabilityResult[] }> {
  try {
    const res = await api.post(API_ROUTES.TREATMENT_PLANS.VALIDATE_AVAILABILITY, payload);
    return res as { results: AvailabilityResult[] };
  } catch {
    // Fallback: mark everything as available
    return {
      results: payload.steps.map(s => ({ step_id: s.step_id, status: 'available', alternatives: [] })),
    };
  }
}

// ── Abandon check ─────────────────────────────────────────────────────────────

export async function checkAbandonedPlans(opts?: {
  patientId?: string;
  daysOverdue?: number;
  autoMarkMissed?: boolean;
}): Promise<AbandonedPlan[]> {
  try {
    const params: Record<string, string> = {};
    if (opts?.patientId) params.patient_id = opts.patientId;
    if (opts?.daysOverdue != null) params.days_overdue = String(opts.daysOverdue);
    if (opts?.autoMarkMissed) params.auto_mark_missed = 'true';
    const res = await api.get(API_ROUTES.TREATMENT_PLANS.PLAN_ABANDON_CHECK, params);
    return (res as { abandoned: AbandonedPlan[] }).abandoned ?? [];
  } catch {
    return [];
  }
}
