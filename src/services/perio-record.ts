import { API_ROUTES } from '@/constants/routes';
import { normalizeTeeth } from '@/lib/perio/teeth';
import type { PerioClosing, PerioDiagnosis, PerioExam, PerioScreening, PerioExamStatus, PerioExamType, PerioStats, PerioTooth } from '@/lib/types';
import { api, REQUEST_TIMEOUT_MS } from '@/services/api';

// Flujo n8n "Perio Record" (docs/n8n-flows/flow-perio-record.json) sobre las tablas de
// database/scripts/163 (el diagnóstico, 164; el cierre, 165). El periodontograma se autoguarda entero (piezas y sitios); el estado,
// la completitud y los índices los calcula la base.

/** n8n a veces envuelve la respuesta en un array */
const unwrap = <T>(data: unknown): T => (Array.isArray(data) ? data[0] : data) as T;

const STATUSES: PerioExamStatus[] = ['probing', 'probed', 'diagnosed', 'closed', 'void'];
const TYPES: PerioExamType[] = ['initial', 'reevaluation', 'maintenance', 'screening', 'implants'];
const optional = (value: unknown): string | undefined => (value == null || value === '' ? undefined : String(value));
const numberOrNull = (value: unknown): number | null => (value == null || value === '' ? null : Number(value));

function normalizeStats(raw: Partial<PerioStats> | null | undefined): PerioStats | null {
  if (!raw) return null;
  const n = (v: unknown) => Number(v) || 0;
  return {
    sites: n(raw.sites),
    bopPct: n(raw.bopPct),
    plaquePct: n(raw.plaquePct),
    meanPd: numberOrNull(raw.meanPd),
    meanCal: numberOrNull(raw.meanCal),
    n4: n(raw.n4),
    n5: n(raw.n5),
    n6: n(raw.n6),
    b4: n(raw.b4),
    b5: n(raw.b5),
    teeth5: n(raw.teeth5),
    maxInterproximalCal: numberOrNull(raw.maxInterproximalCal),
  };
}

function normalizeDiagnosis(raw: Partial<PerioDiagnosis> | null | undefined): PerioDiagnosis | null {
  if (!raw || typeof raw !== 'object') return null;
  return {
    teethLost: numberOrNull(raw.teethLost),
    boneLossPct: numberOrNull(raw.boneLossPct),
    age: numberOrNull(raw.age),
    cigarettes: Number(raw.cigarettes) || 0,
    diabetes: raw.diabetes === 'controlled' || raw.diabetes === 'uncontrolled' ? raw.diabetes : 'no',
    isCase: raw.isCase !== false,
    stability: raw.stability ?? 'stable',
    stage: raw.stage ?? null,
    extent: raw.extent ?? null,
    grade: raw.grade ?? null,
    risk: raw.risk ?? 'low',
    maintenanceMonths: Number(raw.maintenanceMonths) || 6,
    psrMax: raw.psrMax == null ? null : Number(raw.psrMax),
    implants: Array.isArray(raw.implants) ? raw.implants.map((i) => ({ tooth: Number(i.tooth), status: i.status })) : undefined,
    plan: Array.isArray(raw.plan) ? raw.plan.map((i) => ({ ...i, tooth: i.tooth == null ? undefined : Number(i.tooth), include: i.include !== false, today: !!i.today })) : [],
    manual: raw.manual && typeof raw.manual === 'object' ? raw.manual : {},
    confirmedAt: raw.confirmedAt ?? null,
  };
}

function normalizeExam(raw: PerioExam): PerioExam {
  return {
    ...raw,
    id: String(raw.id),
    doctorId: optional(raw.doctorId),
    doctorName: optional(raw.doctorName),
    appointmentId: optional(raw.appointmentId),
    guideExamId: optional(raw.guideExamId),
    examType: TYPES.includes(raw.examType) ? raw.examType : 'maintenance',
    title: raw.title ?? '',
    notes: raw.notes ?? '',
    status: STATUSES.includes(raw.status) ? raw.status : 'probing',
    completeness: Number(raw.completeness) || 0,
    stats: normalizeStats(raw.stats),
    closedAt: optional(raw.closedAt),
    closedByName: optional(raw.closedByName),
    diagnosis: normalizeDiagnosis(raw.diagnosis),
    patientBirthday: optional(raw.patientBirthday),
    patientPhone: optional(raw.patientPhone),
    patientEmail: optional(raw.patientEmail),
    invoice: raw.invoice
      ? { ...raw.invoice, id: String(raw.invoice.id), total: Number(raw.invoice.total) || 0, paidAmount: Number(raw.invoice.paidAmount) || 0, serviceIds: raw.invoice.serviceIds ?? [] }
      : null,
    closing: raw.closing && typeof raw.closing === 'object' ? raw.closing : null,
    screening: raw.screening && typeof raw.screening === 'object' ? { codes: raw.screening.codes ?? {}, star: Array.isArray(raw.screening.star) ? raw.screening.star : [] } : null,
    amendments: Array.isArray(raw.amendments) ? raw.amendments.map((a) => ({ ...a, id: String(a.id) })) : [],
    teeth: normalizeTeeth((raw.teeth ?? []).map((t) => ({ ...t, tooth: Number(t.tooth), mobility: numberOrNull(t.mobility) }))),
  };
}

/** The patient's periodontograms, oldest first */
export async function fetchPerioExams(patientId: string): Promise<PerioExam[]> {
  const data = unwrap<{ exams?: PerioExam[] }>(await api.get(API_ROUTES.PERIO_RECORD.EXAMS, { patient_id: patientId }));
  return (data?.exams ?? []).map(normalizeExam);
}

/** What the session edits and autosaves */
export interface PerioExamInput {
  date: string;
  title: string;
  examType: PerioExamType;
  guideExamId?: string;
  doctorId?: string;
  appointmentId?: string;
  notes: string;
  teeth: PerioTooth[];
  diagnosis: PerioDiagnosis | null;
  closing: PerioClosing | null;
  screening: PerioScreening | null;
}

export async function savePerioExam(patientId: string, input: PerioExamInput, examId?: string): Promise<PerioExam> {
  const exam = {
    id: examId ?? null,
    patientId,
    date: input.date,
    title: input.title,
    examType: input.examType,
    guideExamId: input.guideExamId ?? null,
    doctorId: input.doctorId ?? null,
    appointmentId: input.appointmentId ?? null,
    notes: input.notes,
    teeth: input.teeth,
    diagnosis: input.diagnosis,
    closing: input.closing,
    screening: input.screening,
  };
  const data = unwrap<{ exam: PerioExam }>(await api.post(API_ROUTES.PERIO_RECORD.EXAM_SAVE, { exam }, undefined, undefined, { timeoutMs: REQUEST_TIMEOUT_MS.mutation }));
  return normalizeExam(data.exam);
}

export async function closePerioExam(examId: string): Promise<PerioExam> {
  const data = unwrap<{ exam: PerioExam }>(await api.post(API_ROUTES.PERIO_RECORD.EXAM_CLOSE, { id: Number(examId) }, undefined, undefined, { timeoutMs: REQUEST_TIMEOUT_MS.mutation }));
  return normalizeExam(data.exam);
}

/** Links the invoice just created from the closing; it works on a closed exam too */
export async function linkPerioInvoice(examId: string, invoiceId: string): Promise<PerioExam> {
  const data = unwrap<{ exam: PerioExam }>(await api.post(API_ROUTES.PERIO_RECORD.EXAM_LINK_INVOICE, { id: Number(examId), invoice_id: Number(invoiceId) }, undefined, undefined, { timeoutMs: REQUEST_TIMEOUT_MS.mutation }));
  return normalizeExam(data.exam);
}

/** Amendment of a closed exam (with its reason) */
export async function amendPerioExam(examId: string, body: string): Promise<PerioExam> {
  const data = unwrap<{ exam: PerioExam }>(await api.post(API_ROUTES.PERIO_RECORD.EXAM_AMEND, { id: Number(examId), body }, undefined, undefined, { timeoutMs: REQUEST_TIMEOUT_MS.mutation }));
  return normalizeExam(data.exam);
}

export async function deletePerioExam(examId: string): Promise<void> {
  await api.post(API_ROUTES.PERIO_RECORD.EXAM_DELETE, { id: Number(examId) }, undefined, undefined, { timeoutMs: REQUEST_TIMEOUT_MS.mutation });
}
