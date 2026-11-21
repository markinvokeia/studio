import { addDays, format } from 'date-fns';

import { publishVoiceBridge } from '@/lib/voice/screen-bridge';
import { useVoiceCommand } from '@/stores/voice-command-store';

import type { DoctorAgentVoiceBridge, DoctorAgentVoiceReply, WorkspaceVoiceBridge } from '@/lib/types';

/**
 * Mi consultorio simulado (lo que publica doctor-workspace.tsx). Las citas del «día» se ponen
 * mañana para que «el siguiente» no dependa de la hora en que corre la prueba.
 */
export interface SimWorkspace {
  bridge: WorkspaceVoiceBridge;
  log: string[];
  /** Lo que se le preguntó al agente clínico (con el id de la cita). */
  agentLog: string[];
  /** Respuesta del agente a mano para la próxima pregunta (si no, la del guion). */
  nextAgentReply: (reply: Partial<DoctorAgentVoiceReply> | null) => void;
}

const OWNER = {};
const AGENT_OWNER = {};

const reply = (r: Partial<DoctorAgentVoiceReply>): DoctorAgentVoiceReply => ({ texts: [], speech: '', intent: 'clinical_question', acted: false, problems: [], suggestions: [], ...r });

/** El guion del agente clínico (como contesta el de verdad, sin backend). */
function scripted(query: string, patient: string, log: string[]): DoctorAgentVoiceReply {
  const q = query.toLowerCase();
  if (/resum|summar/.test(q)) return reply({ intent: 'clinical_summary', texts: [`${patient}: limpieza hace 6 meses; restauración pendiente en el 16.`], speech: `${patient}: limpieza hace 6 meses.` });
  if (/alerg/.test(q)) return reply({ texts: ['Alérgica a la penicilina.'], speech: 'Alérgica a la penicilina.' });
  if (/odontograma|odontogram|caries/.test(q)) { log.push('agent:odontogram'); return reply({ intent: 'session_structuring', acted: true, texts: ['Abrí el odontograma con caries en el 16.'], speech: 'Abrí el odontograma con caries en el 16.' }); }
  if (/^(?:s[ií]|yes)(?:\s|$)|gu[aá]rd|save/.test(q)) { log.push('agent:save'); return reply({ intent: 'session_structuring', acted: true, texts: ['Guardé la sesión.'], speech: 'Guardé la sesión.' }); }
  if (/revis|review/.test(q)) { log.push('agent:review'); return reply({ intent: 'session_structuring', acted: true, texts: ['Abrí la sesión para que la revises.'], speech: 'Abrí la sesión para que la revises.' }); }
  if (/hice|realic|did|limpieza|cleaning|restaur/.test(q)) { log.push('agent:prepare'); return reply({ intent: 'session_structuring', acted: true, texts: ['Preparé la sesión: limpieza y restauración en el 16. ¿La guardo o preferís revisarla?'], speech: 'Preparé la sesión. ¿La guardo o preferís revisarla?' }); }
  if (/fecha de hoy y la caja|proveedor|clima|weather|supplier/.test(q)) return reply({ intent: 'unknown', texts: ['Eso no es del paciente.'], speech: 'Eso no es del paciente.' });
  return reply({ texts: ['Sin novedades para este paciente.'], speech: 'Sin novedades para este paciente.' });
}

export function publishSimWorkspace({ blocked = null as WorkspaceVoiceBridge['blocked'] } = {}): SimWorkspace {
  const agentLog: string[] = [];
  let manual: Partial<DoctorAgentVoiceReply> | null | undefined;
  const log: string[] = [];
  const d1 = format(addDays(new Date(), 1), 'yyyy-MM-dd');
  const d2 = format(addDays(new Date(), 2), 'yyyy-MM-dd');
  const day = [
    { id: 'w1', date: d1, time: '09:00', patient: 'Ana Gómez', service: 'Limpieza', status: 'confirmed' },
    { id: 'w2', date: d1, time: '10:00', patient: 'Juan Pérez', service: 'Consulta', status: 'confirmed' },
    { id: 'w3', date: d1, time: '10:30', patient: 'Carlos López', service: 'Extracción', status: 'pending' },
    { id: 'w4', date: d1, time: '15:30', patient: 'Sofía Castro', service: 'Control', status: 'confirmed' },
  ];
  const next = [{ id: 'w9', date: d2, time: '11:00', patient: 'María Rodríguez', service: 'Blanqueamiento', status: 'confirmed' }];
  const act = (name: string) => () => log.push(name);
  const bridge: WorkspaceVoiceBridge = {
    loading: false,
    appointments: day,
    selectedId: null,
    select: (id) => { bridge.selectedId = id; log.push(`select:${id}`); refreshActions(); publishAgent(); },
    preset: 'today',
    setPreset: (preset) => { bridge.preset = preset; bridge.appointments = preset === 'tomorrow' ? next : day; log.push(`preset:${preset}`); },
    setRange: (from, to) => { bridge.preset = 'custom'; log.push(`range:${format(from, 'yyyy-MM-dd')}..${format(to, 'yyyy-MM-dd')}`); },
    viewMode: 'mine',
    setViewMode: (m) => { bridge.viewMode = m; log.push(`view:${m}`); },
    calendars: [{ id: 'c1', name: 'Sillón 1' }, { id: 'c2', name: 'Sillón 2' }],
    calendarId: '',
    setCalendar: (id) => { bridge.viewMode = 'calendar'; bridge.calendarId = id; log.push(`calendar:${id}`); },
    refresh: act('refresh'),
    panel: 'sessions',
    setPanel: (p) => { bridge.panel = p; log.push(`panel:${p}`); },
    actions: { session: null, prescribe: null, labOrder: null, aesthetic: null, perio: null, patientFile: null },
    blocked: 'noAppointment',
  };
  const refreshActions = () => {
    const has = !!bridge.selectedId;
    const ok = has && !blocked;
    bridge.blocked = !has ? 'noAppointment' : blocked;
    bridge.actions = {
      session: ok ? act('session') : null,
      prescribe: has ? act('prescribe') : null,
      labOrder: has ? act('labOrder') : null,
      aesthetic: ok ? act('aesthetic') : null,
      perio: ok ? act('perio') : null,
      patientFile: has ? (view) => log.push(`file:${view ?? '-'}`) : null,
    };
  };
  // Como DoctorAgentChat en modo voz: con una cita elegida, el agente y el caso clínico.
  const publishAgent = () => {
    const appt = bridge.appointments.find((a) => a.id === bridge.selectedId);
    if (!appt) { publishVoiceBridge('workspace.agent', null, AGENT_OWNER); useVoiceCommand.setState({ clinicalCase: null }); return; }
    const agent: DoctorAgentVoiceBridge = {
      appointmentId: appt.id,
      patientName: appt.patient,
      busy: false,
      ask: async (query) => {
        agentLog.push(`${appt.id}:${query}`);
        await new Promise((r) => setTimeout(r, 5));
        if (manual !== undefined) { const m = manual; manual = undefined; return m ? reply(m) : null; }
        return scripted(query, appt.patient, log);
      },
    };
    publishVoiceBridge('workspace.agent', agent, AGENT_OWNER);
    const current = useVoiceCommand.getState().clinicalCase;
    if (current?.appointmentId !== appt.id) useVoiceCommand.setState({ clinicalCase: { appointmentId: appt.id, patient: appt.patient, open: true } });
  };
  publishVoiceBridge('workspace', bridge, OWNER);
  return { bridge, log, agentLog, nextAgentReply: (r) => { manual = r; } };
}

export function clearSimWorkspace() {
  publishVoiceBridge('workspace', null, OWNER);
  publishVoiceBridge('workspace.agent', null, AGENT_OWNER);
  useVoiceCommand.setState({ clinicalCase: null });
}
