import { publishVoiceBridge } from '@/lib/voice/screen-bridge';
import { activeVoiceDomains, updateVoiceDomains } from '@/lib/voice/session';

import type { LedgerVoiceBridge, LedgerVoiceRow } from '@/lib/types';

/** El estado de cuenta simulado (lo que publica PatientLedger): un presupuesto, una factura y un pago. */
export interface SimLedger { bridge: LedgerVoiceBridge; log: string[] }

const OWNER = {};
const none = { invoice: false, edit: false, creditNote: false, print: false, email: false, remove: false, enCurso: false, finalizado: false, toEnCurso: false, toPresupuesto: false };

export function publishSimLedger({ currencies = ['UYU', 'USD'], withPeriod = true } = {}): SimLedger {
  const log: string[] = [];
  const rows: LedgerVoiceRow[] = [
    { id: 'l1', date: '2026-03-17', kind: 'item', label: 'Limpieza y profilaxis', docNo: 'P-0001', status: 'presupuestado', debe: 1500, haber: 0, balance: 0, can: { ...none, invoice: true, edit: true, print: true, email: true, remove: true, enCurso: true } },
    { id: 'l2', date: '2026-03-23', kind: 'item', label: 'Restauración pieza 16', docNo: 'F-0012', status: 'facturado', debe: 4000, haber: 0, balance: 4000, can: { ...none, edit: true, creditNote: true, print: true, email: true, remove: true, finalizado: true, toPresupuesto: true } },
    { id: 'l3', date: '2026-03-28', kind: 'payment', label: 'Pago en efectivo', docNo: 'R-0005', debe: 0, haber: 1500, balance: 2500, can: { ...none, edit: true, print: true, email: true, remove: true } },
  ];
  const bridge: LedgerVoiceBridge = {
    patientName: 'Ana Gómez',
    currency: currencies[0],
    currencies,
    setCurrency: (c) => { bridge.currency = c; log.push(`currency:${c}`); },
    sortOrder: 'newest-last',
    setSortOrder: (o) => { bridge.sortOrder = o; log.push(`sort:${o}`); },
    setDateRange: withPeriod ? (from, to) => log.push(`range:${from.toISOString().slice(0, 10)}..${to.toISOString().slice(0, 10)}`) : null,
    clearDateRange: withPeriod ? () => log.push('all-time') : null,
    search: (text) => log.push(`search:${text}`),
    rows,
    totals: { debe: 4000, haber: 1500, balance: 2500 },
    create: { quote: () => log.push('create:quote'), treatment: () => log.push('create:treatment'), payment: () => log.push('create:payment') },
    select: (id) => log.push(`select:${id}`),
    act: (id, action) => log.push(`${action}:${id}`),
    refresh: () => log.push('refresh'),
    editing: false,
    root: () => null,
  };
  publishVoiceBridge('ledger', bridge, OWNER);
  // Como useVoiceScreen(['ledger']): el estado de cuenta a la vista es lo de arriba.
  updateVoiceDomains(['ledger', ...activeVoiceDomains().filter((d) => d !== 'ledger')]);
  return { bridge, log };
}

export function clearSimLedger() { publishVoiceBridge('ledger', null, OWNER); }
