import { publishVoiceBridge } from '@/lib/voice/screen-bridge';

import type { AlertsVoiceBridge } from '@/lib/types';

/** El Centro de alertas simulado (lo que publica src/app/[locale]/alerts/page.tsx). */
export interface SimAlerts { bridge: AlertsVoiceBridge; log: string[] }

const OWNER = {};

export function publishSimAlerts(): SimAlerts {
  const log: string[] = [];
  const a = (id: string, title: string, patient: string, category: string, priority: AlertsVoiceBridge['alerts'][number]['priority'], extra: Partial<AlertsVoiceBridge['alerts'][number]> = {}) =>
    ({ id, title, summary: '', patient, category, priority, status: 'PENDING', date: '2026-11-20', canEmail: true, canWhatsApp: true, hasPatient: !!patient, ...extra });
  const bridge: AlertsVoiceBridge = {
    loading: false,
    alerts: [
      a('al1', 'Cumpleaños', 'Juan Pérez', 'Cumpleaños', 'LOW'),
      a('al2', 'Factura vencida', 'Carlos López', 'Cobranza', 'HIGH'),
      a('al3', 'Cumpleaños', 'Ana Gómez', 'Cumpleaños', 'LOW', { canWhatsApp: false }),
      a('al4', 'Orden de laboratorio atrasada', '', 'Laboratorio', 'CRITICAL', { canEmail: false, canWhatsApp: false }),
      a('al5', 'Control pendiente', 'Sofía Castro', 'Recordatorios', 'MEDIUM', { canEmail: false }),
    ],
    counts: { total: 5, critical: 1, high: 1, medium: 1 },
    statusFilter: 'PENDING',
    priorityFilter: '',
    setStatusFilter: (v) => { bridge.statusFilter = v; log.push(`status:${v || 'all'}`); },
    setPriorityFilter: (v) => { bridge.priorityFilter = v; log.push(`priority:${v || 'all'}`); },
    refresh: () => log.push('refresh'),
    selected: [],
    setSelected: (ids) => { bridge.selected = ids; log.push(`selected:${ids.join(',')}`); },
    permissions: { complete: true, ignore: true, snooze: true, call: true, note: true, email: true, whatsapp: true },
    complete: async (ids) => { log.push(`complete:${ids.join(',')}`); },
    ignore: async (ids, reason) => { log.push(`ignore:${ids.join(',')}:${reason}`); },
    snooze: async (ids, until) => { log.push(`snooze:${ids.join(',')}:${until}`); },
    registerCall: async (ids, at) => { log.push(`call:${ids.join(',')}:${at.slice(0, 10)}`); },
    addNote: async (ids, text) => { log.push(`note:${ids.join(',')}:${text}`); },
    email: (id) => log.push(`email:${id}`),
    whatsapp: async (ids) => { log.push(`whatsapp:${ids.join(',')}`); },
    openPatient: (id) => log.push(`patient:${id}`),
  };
  publishVoiceBridge('alerts', bridge, OWNER);
  return { bridge, log };
}

export function clearSimAlerts() { publishVoiceBridge('alerts', null, OWNER); }
