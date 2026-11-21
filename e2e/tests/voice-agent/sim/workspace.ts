import { addDays, format } from 'date-fns';

import { publishVoiceBridge } from '@/lib/voice/screen-bridge';

import type { WorkspaceVoiceBridge } from '@/lib/types';

/**
 * Mi consultorio simulado (lo que publica doctor-workspace.tsx). Las citas del «día» se ponen
 * mañana para que «el siguiente» no dependa de la hora en que corre la prueba.
 */
export interface SimWorkspace { bridge: WorkspaceVoiceBridge; log: string[] }

const OWNER = {};

export function publishSimWorkspace({ blocked = null as WorkspaceVoiceBridge['blocked'] } = {}): SimWorkspace {
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
    select: (id) => { bridge.selectedId = id; log.push(`select:${id}`); refreshActions(); },
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
  publishVoiceBridge('workspace', bridge, OWNER);
  return { bridge, log };
}

export function clearSimWorkspace() {
  publishVoiceBridge('workspace', null, OWNER);
}
