import { publishVoiceBridge } from '@/lib/voice/screen-bridge';

import type { DocumentsVoiceBridge } from '@/lib/types';

/** Tablas de documentos simuladas (lo que publican InvoicesTable, PaymentsTable, RecentQuotesTable). */
export interface SimDocuments { tables: DocumentsVoiceBridge[]; log: string[] }

const OWNER = {};
let keys: string[] = [];

function table(kind: DocumentsVoiceBridge['kind'], rows: DocumentsVoiceBridge['rows'], log: string[], { compact = false, isSales = true } = {}): DocumentsVoiceBridge {
  const act = (name: string) => (id: string) => log.push(`${kind}.${name}:${id}`);
  return {
    kind, isSales, compact, rows,
    actions: {
      select: act('select'), print: act('print'), email: act('email'), allocate: kind === 'payment' ? act('allocate') : null,
      edit: (id) => { const r = rows.find((x) => x.id === id); if (r?.status === 'draft' || kind !== 'invoice') log.push(`${kind}.edit:${id}`); },
      confirm: kind === 'payment' ? null : act('confirm'),
      reject: kind === 'quote' ? act('reject') : null,
      pay: kind === 'payment' ? null : act('pay'),
    },
    create: () => log.push(`${kind}.create`),
    refresh: () => log.push(`${kind}.refresh`),
    exportList: () => log.push(`${kind}.export`),
    filters: kind === 'invoice' ? [{ label: 'Pagadas', value: 'paid' }, { label: 'Pendientes', value: 'unpaid' }, { label: 'Todas', value: 'all' }] : [],
    setFilter: kind === 'invoice' ? (v) => log.push(`${kind}.filter:${v}`) : null,
  };
}

export function publishSimDocuments(route: string): SimDocuments | null {
  const log: string[] = [];
  const invoices: DocumentsVoiceBridge['rows'] = [
    { id: '120', docNo: 'F-120', party: 'Juan Pérez', total: 2700, paid: 1500, currency: 'UYU', status: 'booked', paymentStatus: 'partial', date: '2026-11-10' },
    { id: '121', docNo: 'F-121', party: 'Ana Gómez', total: 1500, paid: 1500, currency: 'UYU', status: 'booked', paymentStatus: 'paid', date: '2026-11-12' },
    { id: '122', docNo: 'F-122', party: 'Carlos López', total: 4000, paid: 0, currency: 'UYU', status: 'draft', paymentStatus: 'unpaid', date: '2026-11-15' },
    { id: '123', docNo: 'F-123', party: 'Ana Martínez', total: 800, paid: 0, currency: 'USD', status: 'booked', paymentStatus: 'unpaid', date: '2026-11-18' },
  ];
  const payments: DocumentsVoiceBridge['rows'] = [
    { id: '45', docNo: 'R-45', party: 'Juan Pérez', total: 1500, paid: null, currency: 'UYU', status: '', paymentStatus: null, date: '2026-11-11' },
  ];
  const quotes: DocumentsVoiceBridge['rows'] = [
    { id: '10', docNo: 'P-10', party: 'Juan Pérez', total: 3000, paid: null, currency: 'UYU', status: 'draft', paymentStatus: 'unpaid', date: '2026-11-01' },
    { id: '11', docNo: 'P-11', party: 'Sofía Castro', total: 2500, paid: null, currency: 'UYU', status: 'accepted', paymentStatus: 'unpaid', date: '2026-11-02' },
  ];
  let list: DocumentsVoiceBridge[] = [];
  if (route === '/sales/invoices') list = [table('invoice', invoices, log), table('payment', payments, log, { compact: true })];
  else if (route === '/sales/quotes') list = [table('quote', quotes, log)];
  else if (route === '/sales/payments') list = [table('payment', payments, log)];
  else if (route === '/purchases/invoices') list = [table('invoice', invoices.map((r) => ({ ...r, party: r.party === 'Juan Pérez' ? 'Dental Sur' : 'Prótesis Norte' })), log, { isSales: false })];
  else return null;
  keys = list.map((t, i) => `documents.${t.kind}.sim${i}`);
  list.forEach((t, i) => publishVoiceBridge(keys[i], t, OWNER));
  return { tables: list, log };
}

export function clearSimDocuments() {
  for (const key of keys) publishVoiceBridge(key, null, OWNER);
  keys = [];
}
