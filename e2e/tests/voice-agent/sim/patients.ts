import { publishVoiceBridge } from '@/lib/voice/screen-bridge';

import { PATIENT_FACTS, PATIENTS } from './calendar';

import type { PatientsVoiceBridge } from '@/lib/types';

/** Pacientes simulado (lo que publica src/app/[locale]/patients/page.tsx). */
export interface SimPatients { bridge: PatientsVoiceBridge; log: string[] }

const OWNER = {};
const rowsOf = (list: typeof PATIENTS) => list.map((p) => ({ id: p.id, name: p.name, document: p.document, phone: p.phone, email: p.email }));

export function publishSimPatients(): SimPatients {
  const log: string[] = [];
  const act = (name: string) => () => log.push(name);
  const actions = (on: boolean): PatientsVoiceBridge['actions'] => {
    const keys = ['edit', 'appointment', 'quote', 'invoice', 'prepaid', 'bill', 'session', 'aesthetic', 'perio', 'odontogram', 'document', 'instruction', 'prescription', 'printSummary', 'discharge'] as const;
    return Object.fromEntries(keys.map((k) => [k, on ? act(k) : null])) as PatientsVoiceBridge['actions'];
  };
  const bridge: PatientsVoiceBridge = {
    loading: false,
    rows: rowsOf(PATIENTS.slice(0, 5)),
    total: PATIENTS.length,
    search: (text) => {
      log.push(`search:${text}`);
      const q = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      const found = PATIENTS.filter((p) => p.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q) || p.document === q);
      bridge.rows = rowsOf(found);
      bridge.total = found.length;
    },
    select: (id) => { const p = PATIENTS.find((x) => x.id === id); if (!p) return; bridge.selected = { id, name: p.name }; bridge.actions = actions(true); log.push(`select:${id}`); },
    filters: { debtors: false, active: true, date: 'allTime' },
    setDebtors: (on) => { bridge.filters.debtors = on; log.push(`debtors:${on}`); },
    setActive: (on) => { bridge.filters.active = on; log.push(`active:${on}`); },
    setDatePreset: (p) => { bridge.filters.date = p; log.push(`date:${p}`); },
    clearFilters: act('clear'),
    refresh: act('refresh'),
    create: act('create'),
    selected: null,
    getFacts: async (patient, needs) => {
      const facts = PATIENT_FACTS[patient.id] ?? {};
      log.push(`facts:${patient.id}:${needs.join(',')}`);
      return { patientId: patient.id, patientName: patient.name, ...facts };
    },
    tab: 'info',
    setTab: (tab) => { bridge.tab = tab; log.push(`tab:${tab}`); },
    closeDetail: () => { bridge.selected = null; bridge.actions = actions(false); log.push('close'); },
    actions: actions(false),
  };
  publishVoiceBridge('patients', bridge, OWNER);
  return { bridge, log };
}

export function clearSimPatients() { publishVoiceBridge('patients', null, OWNER); }
