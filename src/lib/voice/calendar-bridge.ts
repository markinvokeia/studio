import type { Gap } from '@/components/calendar/calendar-gaps';
import type { CalendarGroupBy, CalendarView } from '@/components/calendar/calendar-types';
import type { Appointment, AppointmentStatus, Calendar, CalendarItemScope, CalendarReminder, CalendarSettings, CancellationReason, Sede, Service, User } from '@/lib/types';
import type { CalendarOpenTarget } from '@/lib/voice/commands/calendar-parse';
import type { SlotDialogVoiceControl, SlotDialogVoiceStatus } from '@/lib/voice/dialog-voice';
import type { PatientActionKind } from '@/lib/voice/patient-info';
import type { PatientFacts, PatientFactsNeed } from '@/services/patient-facts';

/**
 * Puente entre los comandos de voz del calendario y la pantalla de citas. La página (muy grande y
 * con todo su estado local) publica en cada render lo que se ve (`state`) y las acciones que la
 * voz puede pedir (`actions`), que son sus propias funciones: la voz nunca toca el estado de la
 * página por su cuenta. Fuera del calendario no hay puente y los comandos lo dicen.
 */

export interface CalendarVoiceRange {
  start: Date;
  end: Date;
}

export interface CalendarVoiceState {
  /** Ya cargaron agendas, doctores y servicios. */
  ready: boolean;
  view: CalendarView;
  /** Modo personalizado: se ve una agenda por vez. */
  customMode: boolean;
  /** Rango que muestra el calendario y el último que terminó de cargar sus citas. */
  range: CalendarVoiceRange | null;
  loadedRange: CalendarVoiceRange | null;
  loading: boolean;
  /** Las citas cargadas del rango (todas) y las que se ven con los filtros de la pantalla. */
  appointments: Appointment[];
  visibleAppointments: Appointment[];
  doctors: User[];
  calendars: Calendar[];
  sedes: Sede[];
  services: Service[];
  selectedDoctorIds: string[];
  selectedCalendarIds: string[];
  /** Modo personalizado: la agenda que se está viendo. */
  activeCalendarId: string | null;
  groupBy: CalendarGroupBy;
  gapsActive: boolean;
  /** Huecos del rango visible (solo con gapsActive). */
  gaps: Gap[];
  searchActive: boolean;
  /** Formulario de cita abierto: el modal o la tarjeta en el calendario. */
  form: { kind: 'dialog' | 'inline' | null; saving: boolean };
  /** Recordatorios y notas cargados del rango. */
  reminders: CalendarReminder[];
  /** Sede que pinta la grilla ('' = toda la clínica): ahí bloquea/habilita si no se dice otra. */
  timelineSedeId: string;
  /** Diálogo "Bloquear / Habilitar horario" abierto y lo que avisa. */
  slotDialog: { kind: 'block' | 'enable'; status: SlotDialogVoiceStatus | null } | null;
  /** Formulario de recordatorio/nota abierto. */
  reminderForm: { saving: boolean; error: string | null } | null;
  /** Zoom de la grilla (0.3–2.5; 1 = 100 %). */
  zoom: number;
  /** Panel de agendas (izquierda, modo personalizado). */
  agendasPanel: { open: boolean; pinned: boolean };
  /** Preferencias del usuario (engranaje), null mientras cargan. */
  settings: CalendarSettings | null;
  /** El engranaje está abierto. */
  settingsOpen: boolean;
  /** Diálogo Exportar agenda abierto y lo que avisa. */
  exportDialog: CalendarVoiceExportStatus | null;
  /** Puede ver la cuenta del paciente (lo financiero). */
  canViewAccounts: boolean;
  /** Operaciones en lotes abierto. */
  bulkMode: boolean;
}

/** Lo que muestra el diálogo Exportar agenda (para leerlo y saber si terminó). */
export interface CalendarVoiceExportStatus {
  /** Formato extendido: varias agendas; básico: una. */
  extended: boolean;
  preset: 'day' | 'week' | 'month' | 'custom';
  from: string | null;
  to: string | null;
  calendarIds: string[];
  exporting: boolean;
  /** Se descargó (o no había citas): el diálogo se cerró. */
  done: 'exported' | 'empty' | 'error' | null;
}

/** Pedido al diálogo Exportar agenda (lo que no viene, no se toca). */
export interface CalendarVoiceExportControl {
  preset?: 'day' | 'week' | 'month' | 'custom';
  /** Día de referencia (día/semana/mes). */
  anchor?: string;
  from?: string;
  to?: string;
  calendarIds?: string[];
  /** Aprieta Exportar. */
  submit?: boolean;
}

/** Un paciente del buscador (el widget de la derecha). */
export interface CalendarVoicePatient {
  id: string;
  name: string;
  phone: string;
  email: string;
  document?: string;
}

export interface CalendarVoiceSlotRequest {
  kind: 'block' | 'enable';
  day: Date;
  /** Sede; undefined = la de la grilla. */
  sedeId?: string;
  startMin: number;
  endMin: number;
}

export interface CalendarVoiceReminderRequest {
  type: 'reminder' | 'note';
  start: Date;
  title: string | null;
}

export interface CalendarVoiceFormRequest {
  mode: 'create' | 'reschedule' | 'edit';
  /** reschedule / edit: la cita a mover o editar. */
  appointment?: Appointment;
  start: Date;
  patient?: User | null;
  doctor?: User | null;
  calendar?: Calendar | null;
  services?: Service[];
}

/** Cambios por voz al formulario abierto (lo que no viene, no se toca). */
export interface CalendarVoiceFormPatch {
  doctor?: User | null;
  services?: Service[];
  start?: Date;
  /** Hora de fin (HH:mm) del mismo día. */
  endTime?: string;
  calendar?: Calendar | null;
  patient?: User | null;
  /** Notas completas (ya combinadas con las que había si se agregó). */
  notes?: string;
}

/** Lo que tiene ahora el formulario abierto (para agregar notas o servicios sin pisar). */
export interface CalendarVoiceFormSnapshot {
  notes: string;
  services: Service[];
  doctor: User | null;
  calendar: Calendar | null;
  patient: User | null;
  start: Date | null;
  endTime: string | null;
}

export interface CalendarVoiceActions {
  goToDate: (date: Date) => void;
  setView: (view: CalendarView) => void;
  setSelectedDoctorIds: (ids: string[]) => void;
  setSelectedCalendarIds: (ids: string[]) => void;
  /** Modo personalizado: qué agenda se ve. */
  setActiveCalendar: (id: string) => void;
  setGroupBy: (groupBy: CalendarGroupBy) => void;
  openSearch: (query: string) => void;
  closeSearch: () => void;
  setGapsActive: (on: boolean) => void;
  /** Salta a la cita, la resalta y abre su detalle (lo mismo que elegirla en el buscador). */
  focusAppointment: (appointment: Appointment) => void;
  /** Búsqueda global de citas (sin fecha), ya mapeadas como las del calendario. */
  searchAppointments: (query: string) => Promise<Appointment[]>;
  /** Cambia el estado con las mismas reglas y avisos que el menú. true si se aplicó. */
  changeStatus: (appointment: Appointment, status: AppointmentStatus, extra?: { cancellation_reason?: CancellationReason }) => Promise<boolean>;
  /** Abre el formulario de siempre (modal o tarjeta según el modo), ya completo. */
  openAppointmentForm: (request: CalendarVoiceFormRequest) => 'dialog' | 'inline';
  /** Cambia doctor, tratamientos o día y hora del formulario abierto (como si se eligieran a mano). */
  patchAppointmentForm: (patch: CalendarVoiceFormPatch) => void;
  /** "Guardar" del formulario abierto (con todas sus validaciones). */
  submitAppointmentForm: () => void;
  /** Cierra el formulario abierto sin guardar. */
  closeAppointmentForm: () => void;
  /** Lo que tiene el formulario abierto, o null. */
  readAppointmentForm: () => CalendarVoiceFormSnapshot | null;
  // ── Menú de la cita (mismas funciones y avisos que el clic derecho; true si se aplicó) ──
  changeColor: (appointment: Appointment, colorId: string) => Promise<boolean>;
  reassign: (appointment: Appointment, change: { doctor?: User; calendar?: Calendar }) => Promise<boolean>;
  retime: (appointment: Appointment, start: Date, end: Date) => Promise<boolean>;
  deleteAppointment: (appointment: Appointment) => Promise<boolean>;
  /** Historia, documentos, cuenta, citas, datos del paciente, sesión clínica o cobro rápido. */
  openAppointmentTool: (appointment: Appointment, target: CalendarOpenTarget) => 'ok' | 'noPatient' | 'denied';
  // ── Bloquear / habilitar horario ──
  /** Abre el diálogo de siempre con esa franja; 'unavailable' si la agenda no pinta horarios. */
  openSlotDialog: (request: CalendarVoiceSlotRequest) => 'opened' | 'unavailable';
  controlSlotDialog: (control: Omit<SlotDialogVoiceControl, 'seq'>) => void;
  closeSlotDialog: () => void;
  // ── Recordatorios y notas ──
  openReminderForm: (request: CalendarVoiceReminderRequest) => void;
  submitReminderForm: () => void;
  closeReminderForm: () => void;
  markReminderDone: (reminder: CalendarReminder) => Promise<boolean>;
  deleteReminder: (reminder: CalendarReminder, scope: CalendarItemScope) => Promise<boolean>;
  // ── Barra ──
  print: () => void;
  refresh: () => void;
  /** Hoy / flechas: lo mismo que los botones (avanzan según la vista). */
  today: () => void;
  setZoom: (zoom: number) => void;
  setAgendasPanel: (change: { open?: boolean; pinned?: boolean }) => void;
  /** Sale de Operaciones en lotes. */
  exitBulk: () => void;
  // ── Engranaje (preferencias del usuario: se guardan como al tocarlas) ──
  updateSettings: (patch: Partial<CalendarSettings>) => Promise<boolean>;
  setSettingsOpen: (open: boolean) => void;
  // ── Exportar agenda ──
  controlExport: (control: CalendarVoiceExportControl) => void;
  closeExport: () => void;
  // ── Pacientes ──
  /** Buscador de pacientes (nombre, documento, email o teléfono). */
  searchPatients: (query: string) => Promise<CalendarVoicePatient[]>;
  /** Abre la ficha del paciente (lo mismo que elegirlo en el widget). */
  openPatient: (patient: CalendarVoicePatient) => void;
  /** Pregunta al agente clínico (Mi consultorio) sobre el paciente de la cita. */
  askPatientAi: (appointment: Appointment, question: string) => Promise<{ answer: string; speech: string } | null>;
  /** Lo que se sabe del paciente (historial de citas, finanzas, presupuestos, facturas, pagos, tratamientos). */
  getPatientFacts: (patient: { id: string; name: string }, needs: PatientFactsNeed[]) => Promise<PatientFacts>;
  /**
   * Nuevo presupuesto, factura o tratamiento, sesión clínica o cobro rápido del paciente (los mismos
   * diálogos que el menú). La sesión clínica necesita una cita; el cobro la usa si hay.
   */
  openPatientAction: (patient: { id: string; name: string }, action: PatientActionKind, appointment?: Appointment | null) => 'ok' | 'needsAppointment' | 'denied';
}

export interface CalendarVoiceBridge {
  state: CalendarVoiceState;
  actions: CalendarVoiceActions;
}

let current: CalendarVoiceBridge | null = null;
/** Quién publicó el puente actual (cada montaje de la pantalla tiene el suyo). */
let currentOwner: object | null = null;
const listeners = new Set<() => void>();

export function getCalendarVoice(): CalendarVoiceBridge | null {
  return current;
}

/**
 * La pantalla del calendario publica su estado y sus acciones después de cada render
 * (useLayoutEffect sin dependencias) y null al desmontarse.
 */
export function publishCalendarVoice(next: CalendarVoiceBridge | null, owner: object | null = null) {
  current = next;
  currentOwner = next ? owner : null;
  listeners.forEach((listener) => listener());
}

/**
 * La pantalla se desmonta: borra el puente solo si sigue siendo el suyo. Al cambiar de idioma o
 * recargar en caliente, la pantalla vieja se desmonta DESPUÉS de que la nueva publicó el suyo: sin
 * esto lo borraría y la voz creería que no hay agenda abierta.
 */
export function clearCalendarVoice(owner: object) {
  if (currentOwner !== owner) return;
  current = null;
  currentOwner = null;
  listeners.forEach((listener) => listener());
}

const covers = (range: CalendarVoiceRange | null, date: Date) => !!range && date >= range.start && date <= range.end;

/** El calendario muestra ese día y ya cargó sus citas. */
export function isDayLoaded(state: CalendarVoiceState, day: Date): boolean {
  const end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59);
  return covers(state.range, day) && covers(state.loadedRange, day) && covers(state.loadedRange, end) && !state.loading;
}

/**
 * Espera a que la pantalla cumpla `predicate` (se revisa en cada render publicado). Devuelve el
 * estado, o null si pasó el tiempo o se canceló el comando.
 */
export function waitForCalendar(
  predicate: (state: CalendarVoiceState) => boolean,
  { signal, timeoutMs = 8000, settleMs = 0 }: { signal?: AbortSignal; timeoutMs?: number; settleMs?: number } = {},
): Promise<CalendarVoiceState | null> {
  return new Promise((resolve) => {
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    const finish = (value: CalendarVoiceState | null) => {
      clearTimeout(timer);
      clearTimeout(settleTimer);
      listeners.delete(check);
      signal?.removeEventListener('abort', onAbort);
      resolve(value);
    };
    const check = () => {
      const state = current?.state;
      clearTimeout(settleTimer);
      if (!state || !predicate(state)) return;
      // Con settleMs se espera a que siga cumpliéndose (el rango cambia en dos pasos).
      if (!settleMs) { finish(state); return; }
      settleTimer = setTimeout(() => {
        const latest = current?.state;
        if (latest && predicate(latest)) finish(latest);
      }, settleMs);
    };
    const onAbort = () => finish(null);
    const timer = setTimeout(() => finish(null), timeoutMs);
    signal?.addEventListener('abort', onAbort, { once: true });
    listeners.add(check);
    check();
  });
}
