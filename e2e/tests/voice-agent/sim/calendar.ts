import { addDays, addMinutes, endOfWeek, format, set, startOfToday, startOfWeek, subYears } from 'date-fns';

import { publishCalendarVoice, type CalendarVoiceActions, type CalendarVoiceFormSnapshot, type CalendarVoiceState } from '@/lib/voice/calendar-bridge';
import { DEFAULT_CALENDAR_SETTINGS } from '@/components/calendar/calendar-settings-utils';

import type { Appointment, Calendar, CalendarSettings, Sede, Service, User } from '@/lib/types';
import type { PatientFacts } from '@/services/patient-facts';

/**
 * La agenda simulada: el mismo estado y las mismas acciones que publica la página de citas
 * (src/app/[locale]/appointments/page.tsx → publishCalendarVoice), con datos fijos y un registro
 * de cada acción que pidió la voz (`log`). Lo que cambia algo se aplica al estado, como la página.
 */

export interface LoggedAction {
  action: keyof CalendarVoiceActions;
  args: unknown[];
}

export const DOCTORS: User[] = [
  { id: 'd1', name: 'Dr. Martín Pérez' },
  { id: 'd2', name: 'Dra. Laura Ruiz' },
  { id: 'd3', name: 'Dr. Pablo Gómez' },
].map((d) => ({ ...d, email: '', phone_number: '', is_active: true, avatar: '' }) as unknown as User);

export const SEDES: Sede[] = [
  { id: 's1', name: 'Centro' },
  { id: 's2', name: 'Pocitos' },
] as unknown as Sede[];

export const CALENDARS: Calendar[] = [
  { id: 'c1', name: 'Sillón 1', sede_id: 's1', sede_name: 'Centro' },
  { id: 'c2', name: 'Sillón 2', sede_id: 's1', sede_name: 'Centro' },
  { id: 'c3', name: 'Ortodoncia', sede_id: 's2', sede_name: 'Pocitos' },
] as unknown as Calendar[];

export const SERVICES: Service[] = [
  { id: 'sv1', name: 'Limpieza', duration: 30 },
  { id: 'sv2', name: 'Control', duration: 20 },
  { id: 'sv3', name: 'Blanqueamiento', duration: 60 },
  { id: 'sv4', name: 'Extracción', duration: 45 },
  { id: 'sv5', name: 'Endodoncia', duration: 90 },
] as unknown as Service[];

export interface FixturePatient { id: string; name: string; phone: string; email: string; document: string }

/** Pacientes del buscador (el widget de la derecha). */
export const PATIENTS: FixturePatient[] = [
  { id: 'p1', name: 'Ana Gómez', phone: '099111111', email: 'ana@gmail.com', document: '11111111' },
  { id: 'p2', name: 'Juan Pérez', phone: '099222222', email: 'juan@gmail.com', document: '22222222' },
  { id: 'p3', name: 'Ana Martínez', phone: '099333333', email: 'anam@gmail.com', document: '33333333' },
  { id: 'p4', name: 'Carlos López', phone: '099444444', email: 'carlos@gmail.com', document: '44444444' },
  { id: 'p5', name: 'María Rodríguez', phone: '099555555', email: 'maria@gmail.com', document: '55555555' },
  { id: 'p6', name: 'Lucía Fernández', phone: '099666666', email: 'lucia@gmail.com', document: '66666666' },
  { id: 'p7', name: 'Pedro Sánchez', phone: '099777777', email: 'pedro@gmail.com', document: '77777777' },
  { id: 'p8', name: 'Roberto Díaz', phone: '099888888', email: 'roberto@gmail.com', document: '12345678' },
  { id: 'p9', name: 'Sofía Castro', phone: '099123456', email: 'sofia@gmail.com', document: '45678912' },
];

const doctor = (id: string) => DOCTORS.find((d) => d.id === id)!;
const calendar = (id: string) => CALENDARS.find((c) => c.id === id)!;
const patient = (name: string) => PATIENTS.find((p) => p.name === name)!;

function appointment(id: string, who: string, day: Date, hh: number, mm: number, minutes: number, doctorId: string, calendarId: string, status = 'scheduled'): Appointment {
  const start = set(day, { hours: hh, minutes: mm, seconds: 0, milliseconds: 0 });
  const end = addMinutes(start, minutes);
  const p = patient(who);
  const iso = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm:ss");
  return {
    id,
    patientId: p.id,
    patientName: p.name,
    doctorId,
    doctorName: doctor(doctorId).name,
    calendar_source_id: calendarId,
    calendar_name: calendar(calendarId).name,
    status,
    summary: `${p.name} · Control`,
    date: format(start, 'yyyy-MM-dd'),
    time: format(start, 'HH:mm'),
    start: { dateTime: iso(start) },
    end: { dateTime: iso(end) },
  } as unknown as Appointment;
}

/** Las citas de prueba, relativas a hoy (ver docs/voz-agenda-pruebas.md §Datos). */
export function fixtureAppointments(today = startOfToday()): Appointment[] {
  const tomorrow = addDays(today, 1);
  return [
    appointment('a1', 'Ana Gómez', today, 9, 0, 30, 'd1', 'c1'),
    appointment('a2', 'Juan Pérez', today, 10, 0, 30, 'd2', 'c2', 'confirmed'),
    appointment('a3', 'Ana Martínez', today, 10, 30, 30, 'd1', 'c1'),
    appointment('a4', 'Carlos López', today, 15, 0, 60, 'd3', 'c3'),
    appointment('a5', 'María Rodríguez', tomorrow, 11, 0, 30, 'd1', 'c1'),
    appointment('a6', 'Lucía Fernández', tomorrow, 16, 0, 45, 'd2', 'c2'),
    appointment('a7', 'Pedro Sánchez', addDays(today, 7), 10, 0, 30, 'd1', 'c1'),
    appointment('a8', 'Roberto Díaz', subYears(today, 2), 9, 0, 30, 'd1', 'c1', 'completed'),
  ];
}

/**
 * Registros de los pacientes (lo que mostraría su perfil): Juan Pérez vino 5 veces, faltó 2 (la
 * última el 2026-09-10), canceló 1 tarde, debe 1.200 UYU, último pago 500 UYU el 2026-10-05, 2
 * presupuestos (1 sin facturar) y un tratamiento de ortodoncia en curso (3 de 10 sesiones).
 * Sofía Castro no tiene nada.
 */
export const PATIENT_FACTS: Record<string, Omit<PatientFacts, 'patientId' | 'patientName'>> = {
  p2: {
    appointments: [
      { start: '2026-03-01T10:00', status: 'completed' },
      { start: '2026-04-01T10:00', status: 'completed' },
      { start: '2026-05-01T10:00', status: 'no_show' },
      { start: '2026-06-01T10:00', status: 'completed' },
      { start: '2026-07-01T10:00', status: 'cancelled', cancellationReason: 'late' },
      { start: '2026-08-01T10:00', status: 'completed' },
      { start: '2026-09-10T10:00', status: 'no_show' },
      { start: '2026-10-01T10:00', status: 'attended_late' },
    ],
    financial: [{ currency: 'UYU', debt: 1200, paid: 4500, invoiced: 5700, credit: 0 }],
    payments: [
      { date: '2026-08-01', amount: 2000, currency: 'UYU', method: 'Efectivo' },
      { date: '2026-10-05', amount: 500, currency: 'UYU', method: 'Tarjeta' },
    ],
    quotes: [
      { docNo: 'P-10', status: 'accepted', billingStatus: 'fully_invoiced', paymentStatus: 'paid', total: 3000, currency: 'UYU', date: '2026-03-01' },
      { docNo: 'P-11', status: 'accepted', billingStatus: 'not_invoiced', paymentStatus: 'unpaid', total: 2500, currency: 'UYU', date: '2026-09-01' },
    ],
    invoices: [
      { docNo: 'F-1', status: 'paid', paymentStatus: 'paid', total: 3000, paid: 3000, currency: 'UYU', date: '2026-03-02' },
      { docNo: 'F-2', status: 'sent', paymentStatus: 'partial', total: 2700, paid: 1500, currency: 'UYU', date: '2026-08-02' },
    ],
    treatments: [{ name: 'Ortodoncia', status: 'active', done: 3, total: 10, nextStep: 'Control mensual', nextDate: null }],
  },
  p9: { appointments: [], financial: [], payments: [], quotes: [], invoices: [], treatments: [] },
};

export interface SimCalendar {
  state: CalendarVoiceState;
  log: LoggedAction[];
  /** Lo que tiene el formulario abierto (si hay). */
  form: CalendarVoiceFormSnapshot | null;
  /** Lo último guardado con el formulario (Guardar). */
  savedForms: CalendarVoiceFormSnapshot[];
  appointments: Appointment[];
  /** Respuesta del agente clínico (Mi consultorio) para askPatientAi. */
  patientAiAnswer: string | null;
  /** El próximo guardado de preferencias falla. */
  failNextSettingsSave: boolean;
  publish: () => void;
  calls: (action: keyof CalendarVoiceActions) => unknown[][];
}

function weekRange(date: Date) {
  return { start: startOfWeek(date, { weekStartsOn: 1 }), end: endOfWeek(date, { weekStartsOn: 1 }) };
}

export function createSimCalendar({ customMode = true }: { customMode?: boolean } = {}): SimCalendar {
  const appointments = fixtureAppointments();
  const settings: CalendarSettings = { ...DEFAULT_CALENDAR_SETTINGS, id: 'cs1', mode: customMode ? 'custom' : 'invoke' };
  const range = weekRange(startOfToday());
  const sim = {} as SimCalendar;
  const state: CalendarVoiceState = {
    ready: true,
    view: 'week',
    customMode,
    range,
    loadedRange: range,
    loading: false,
    appointments,
    visibleAppointments: appointments,
    doctors: DOCTORS,
    calendars: CALENDARS,
    sedes: SEDES,
    services: SERVICES,
    selectedDoctorIds: DOCTORS.map((d) => String(d.id)),
    selectedCalendarIds: CALENDARS.map((c) => String(c.id)),
    activeCalendarId: 'c1',
    groupBy: 'none',
    gapsActive: false,
    gaps: [],
    searchActive: false,
    form: { kind: null, saving: false },
    reminders: [],
    timelineSedeId: '',
    slotDialog: null,
    reminderForm: null,
    zoom: 1,
    agendasPanel: { open: false, pinned: false },
    settings,
    settingsOpen: false,
    exportDialog: null,
    canViewAccounts: true,
    bulkMode: false,
  };

  const visible = () => {
    const inRange = (a: Appointment) => {
      const s = new Date(String(a.start?.dateTime));
      return !!state.range && s >= state.range.start && s <= addDays(state.range.end, 1);
    };
    return appointments.filter((a) => inRange(a)
      && (!state.selectedCalendarIds.length || state.selectedCalendarIds.includes(String(a.calendar_source_id)))
      && (!state.selectedDoctorIds.length || state.selectedDoctorIds.includes(String(a.doctorId))));
  };
  const publish = () => {
    state.visibleAppointments = visible();
    state.appointments = appointments.filter((a) => !!state.range && new Date(String(a.start?.dateTime)) >= state.range.start && new Date(String(a.start?.dateTime)) <= addDays(state.range.end, 1));
    publishCalendarVoice({ state, actions });
  };
  const log = (action: keyof CalendarVoiceActions, ...args: unknown[]) => { sim.log.push({ action, args }); };
  const later = (fn: () => void, ms = 5) => setTimeout(() => { fn(); publish(); }, ms);
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  const actions: CalendarVoiceActions = {
    goToDate: (date) => { log('goToDate', date); const r = weekRange(date); state.range = r; state.loadedRange = r; publish(); },
    setView: (view) => { log('setView', view); state.view = view; publish(); },
    setSelectedDoctorIds: (ids) => { log('setSelectedDoctorIds', ids); state.selectedDoctorIds = ids; publish(); },
    setSelectedCalendarIds: (ids) => { log('setSelectedCalendarIds', ids); state.selectedCalendarIds = ids; publish(); },
    setActiveCalendar: (id) => { log('setActiveCalendar', id); state.activeCalendarId = id; publish(); },
    setGroupBy: (groupBy) => { log('setGroupBy', groupBy); state.groupBy = groupBy; publish(); },
    openSearch: (query) => { log('openSearch', query); state.searchActive = true; publish(); },
    closeSearch: () => { log('closeSearch'); state.searchActive = false; publish(); },
    setGapsActive: (on) => { log('setGapsActive', on); state.gapsActive = on; publish(); },
    focusAppointment: (appt) => { log('focusAppointment', appt.id); },
    searchAppointments: async (query) => {
      log('searchAppointments', query);
      const words = norm(query).split(' ').filter((w) => w.length > 2);
      return appointments.filter((a) => words.some((w) => norm(a.patientName).includes(w)));
    },
    changeStatus: async (appt, status, extra) => {
      log('changeStatus', appt.id, status, extra);
      const target = appointments.find((a) => a.id === appt.id);
      if (target) (target as { status: string }).status = status;
      publish();
      return true;
    },
    openAppointmentForm: (request) => {
      log('openAppointmentForm', request.mode, request.appointment?.id ?? null);
      const end = request.appointment?.end?.dateTime ? format(new Date(String(request.appointment.end.dateTime)), 'HH:mm') : null;
      sim.form = {
        notes: request.appointment?.notes ?? '',
        services: request.services ?? [],
        doctor: request.doctor ?? (request.appointment ? doctor(String(request.appointment.doctorId)) : null),
        calendar: request.calendar ?? (request.appointment ? calendar(String(request.appointment.calendar_source_id)) : null),
        patient: request.patient ?? (request.appointment ? ({ id: request.appointment.patientId, name: request.appointment.patientName } as unknown as User) : null),
        start: request.start,
        endTime: end,
      };
      state.form = { kind: 'dialog', saving: false };
      publish();
      return 'dialog';
    },
    patchAppointmentForm: (patch) => {
      log('patchAppointmentForm', patch);
      if (!sim.form) return;
      sim.form = {
        ...sim.form,
        ...(patch.doctor !== undefined ? { doctor: patch.doctor } : {}),
        ...(patch.services ? { services: patch.services } : {}),
        ...(patch.start ? { start: patch.start } : {}),
        ...(patch.endTime ? { endTime: patch.endTime } : {}),
        ...(patch.calendar !== undefined ? { calendar: patch.calendar } : {}),
        ...(patch.patient ? { patient: patch.patient } : {}),
        ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
      };
      publish();
    },
    submitAppointmentForm: () => {
      log('submitAppointmentForm', sim.form);
      state.form = { kind: state.form.kind, saving: true };
      publish();
      later(() => {
        if (sim.form) sim.savedForms.push(sim.form);
        sim.form = null;
        state.form = { kind: null, saving: false };
      }, 20);
    },
    closeAppointmentForm: () => { log('closeAppointmentForm'); sim.form = null; state.form = { kind: null, saving: false }; publish(); },
    readAppointmentForm: () => sim.form,
    changeColor: async (appt, colorId) => { log('changeColor', appt.id, colorId); return true; },
    reassign: async (appt, change) => { log('reassign', appt.id, change.doctor?.id ?? null, change.calendar?.id ?? null); return true; },
    retime: async (appt, start, end) => { log('retime', appt.id, format(start, 'yyyy-MM-dd HH:mm'), format(end, 'HH:mm')); return true; },
    deleteAppointment: async (appt) => { log('deleteAppointment', appt.id); return true; },
    openAppointmentTool: (appt, target) => { log('openAppointmentTool', appt.id, target); return target === 'accounts' && !state.canViewAccounts ? 'denied' : 'ok'; },
    openSlotDialog: (request) => {
      log('openSlotDialog', request.kind, format(request.day, 'yyyy-MM-dd'), request.startMin, request.endMin);
      state.slotDialog = { kind: request.kind, status: { canSubmit: true, checking: false, saving: false, noChange: false, missingPermission: false, locked: 0, affected: 0, startMin: request.startMin, endMin: request.endMin, error: null } };
      publish();
      return 'opened';
    },
    controlSlotDialog: (control) => {
      log('controlSlotDialog', control);
      if (!state.slotDialog?.status) return;
      if (control.startMin !== undefined) state.slotDialog.status.startMin = control.startMin;
      if (control.endMin !== undefined) state.slotDialog.status.endMin = control.endMin;
      if (control.submit) {
        state.slotDialog.status.saving = true;
        later(() => { state.slotDialog = null; }, 20);
      }
      publish();
    },
    closeSlotDialog: () => { log('closeSlotDialog'); state.slotDialog = null; publish(); },
    openReminderForm: (request) => { log('openReminderForm', request.type, format(request.start, 'yyyy-MM-dd HH:mm'), request.title); state.reminderForm = { saving: false, error: null }; publish(); },
    submitReminderForm: () => { log('submitReminderForm'); state.reminderForm = { saving: true, error: null }; publish(); later(() => { state.reminderForm = null; }, 20); },
    closeReminderForm: () => { log('closeReminderForm'); state.reminderForm = null; publish(); },
    markReminderDone: async (r) => { log('markReminderDone', r.id); return true; },
    deleteReminder: async (r, scope) => { log('deleteReminder', r.id, scope); return true; },
    print: () => { log('print'); },
    refresh: () => { log('refresh'); },
    today: () => { log('today'); actions.goToDate(startOfToday()); },
    setZoom: (zoom) => { log('setZoom', zoom); state.zoom = zoom; publish(); },
    exitBulk: () => { log('exitBulk'); state.bulkMode = false; publish(); },
    setAgendasPanel: (change) => {
      log('setAgendasPanel', change);
      state.agendasPanel = {
        open: change.open ?? (change.pinned ? true : state.agendasPanel.open),
        pinned: change.pinned ?? state.agendasPanel.pinned,
      };
      publish();
    },
    updateSettings: async (patch) => {
      log('updateSettings', patch);
      if (sim.failNextSettingsSave) { sim.failNextSettingsSave = false; return false; }
      state.settings = { ...state.settings!, ...patch };
      if (patch.mode) state.customMode = patch.mode === 'custom';
      publish();
      return true;
    },
    setSettingsOpen: (open) => { log('setSettingsOpen', open); state.settingsOpen = open; publish(); },
    controlExport: (control) => {
      log('controlExport', control);
      const today = format(startOfToday(), 'yyyy-MM-dd');
      const current = state.exportDialog ?? { extended: true, preset: 'day' as const, from: today, to: today, calendarIds: [String(state.activeCalendarId ?? 'c1')], exporting: false, done: null };
      const preset = control.preset ?? current.preset;
      const anchor = control.anchor ?? current.from ?? today;
      let from = current.from;
      let to = current.to;
      if (preset === 'custom') { from = control.from ?? from; to = control.to ?? to; }
      else if (control.preset || control.anchor) {
        const a = new Date(`${anchor}T00:00:00`);
        if (preset === 'day') { from = anchor; to = anchor; }
        if (preset === 'week') { const w = weekRange(a); from = format(w.start, 'yyyy-MM-dd'); to = format(w.end, 'yyyy-MM-dd'); }
        if (preset === 'month') { from = format(new Date(a.getFullYear(), a.getMonth(), 1), 'yyyy-MM-dd'); to = format(new Date(a.getFullYear(), a.getMonth() + 1, 0), 'yyyy-MM-dd'); }
      }
      state.exportDialog = { ...current, preset, from, to, calendarIds: control.calendarIds ?? current.calendarIds };
      if (control.submit) {
        state.exportDialog = { ...state.exportDialog, exporting: true };
        later(() => { state.exportDialog = null; }, 20);
      }
      publish();
    },
    closeExport: () => { log('closeExport'); state.exportDialog = null; publish(); },
    searchPatients: async (query) => {
      log('searchPatients', query);
      // Como el buscador real: el texto entero tiene que estar en el nombre (o ser el documento, teléfono o email).
      const q = norm(query).trim();
      const compact = q.replace(/\s/g, '');
      return PATIENTS.filter((p) => norm(p.name).includes(q) || norm(p.name).split(' ').includes(q) || p.document === compact || p.phone === compact || p.email === query.trim().toLowerCase())
        .map((p) => ({ id: p.id, name: p.name, phone: p.phone, email: p.email, document: p.document }));
    },
    openPatient: (p) => { log('openPatient', p.id); },
    getPatientFacts: async (patient, needs) => {
      log('getPatientFacts', patient.id, [...needs].sort());
      const facts = PATIENT_FACTS[patient.id] ?? {};
      return {
        patientId: patient.id,
        patientName: patient.name,
        ...(needs.includes('appointments') ? { appointments: facts.appointments ?? [] } : {}),
        ...(needs.includes('financial') ? { financial: facts.financial ?? [] } : {}),
        ...(needs.includes('ledger') ? { payments: facts.payments ?? [], quotes: facts.quotes ?? [], invoices: facts.invoices ?? [] } : {}),
        ...(needs.includes('treatments') ? { treatments: facts.treatments ?? [] } : {}),
      };
    },
    openPatientAction: (patient, action, appointment) => {
      log('openPatientAction', patient.id, action, appointment?.id ?? null);
      return action === 'session' && !appointment ? 'needsAppointment' : 'ok';
    },
    askPatientAi: async (appt, question) => {
      log('askPatientAi', appt.id, question);
      return sim.patientAiAnswer ? { answer: sim.patientAiAnswer, speech: sim.patientAiAnswer } : null;
    },
  };

  Object.assign(sim, {
    state,
    log: [],
    form: null,
    savedForms: [],
    appointments,
    patientAiAnswer: null,
    failNextSettingsSave: false,
    publish,
    calls: (action: keyof CalendarVoiceActions) => sim.log.filter((l) => l.action === action).map((l) => l.args),
  });
  publish();
  return sim;
}
