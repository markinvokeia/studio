import { computeDiscountAmount, computeGrossTotal, roundCurrency } from '@/lib/discounts';
import { normalizeSpeech } from '@/lib/voice/parse';
import { publishVoiceBridge } from '@/lib/voice/screen-bridge';
import { activeVoiceDomains, updateVoiceDomains } from '@/lib/voice/session';

import type {
  BillingItemsVoiceBridge,
  BillingPatientVoiceBridge,
  BillingPaymentVoiceBridge,
  BillingVoiceBridge,
  BillingVoiceLine,
  BillingVoiceService,
  DiscountMode,
} from '@/lib/types';

/**
 * El cobro rápido simulado (lo que publican billing-wizard-modal y sus pasos): paciente →
 * servicios → pago → listo, con descuentos por línea o por total, monedas y medios de pago.
 */

export const SERVICES: BillingVoiceService[] = [
  { id: 'sv-limp', name: 'Limpieza', price: 1500 },
  { id: 'sv-cons', name: 'Consulta', price: 1000 },
  { id: 'sv-ext1', name: 'Extracción simple', price: 2500 },
  { id: 'sv-ext2', name: 'Extracción compleja', price: 4000 },
  { id: 'sv-blan', name: 'Blanqueamiento', price: 8000 },
  { id: 'sv-rx', name: 'Radiografía', price: 600 },
];

export const METHODS = [
  { id: 'm1', name: 'Efectivo' },
  { id: 'm2', name: 'Tarjeta de crédito' },
  { id: 'm3', name: 'Tarjeta de débito' },
  { id: 'm4', name: 'Transferencia' },
];

interface Line { id: string; serviceId: string; name: string; quantity: number; unitPrice: number; discount: { mode: DiscountMode; value: number } | null }

export interface SimBilling {
  state: {
    step: BillingVoiceBridge['step'];
    patient: { id: string; name: string } | null;
    lines: Line[];
    currency: string;
    sedeId: string;
    scope: 'line' | 'total' | null;
    canApply: boolean;
    maxPct: number | null;
    documentDiscount: { mode: DiscountMode; value: number } | null;
    payment: { pending: number; entries: Array<{ method: string | null; amount: number; currency: string }>; notes: string; substep: 'credits' | 'payment' };
  };
  log: string[];
  total: () => number;
  close: () => void;
}

const OWNER = {};
let nextLine = 1;

export function openSimBilling({ patient = null as { id: string; name: string } | null, scope = 'line' as 'line' | 'total' | null, canApply = true, maxPct = 20 as number | null } = {}): SimBilling {
  const log: string[] = [];
  const sim: SimBilling = {
    state: {
      step: patient ? 'items' : 'patient',
      patient,
      lines: [],
      currency: 'UYU',
      sedeId: 's1',
      scope,
      canApply,
      maxPct,
      documentDiscount: null,
      payment: { pending: 0, entries: [], notes: '', substep: 'payment' },
    },
    log,
    total: () => totals().total,
    close: () => { publishAll(true); updateVoiceDomains(activeVoiceDomains().filter((d) => d !== 'billing')); },
  };
  const st = sim.state;
  const lineTotal = (l: Line) => roundCurrency(computeGrossTotal(l.unitPrice, l.quantity) - (st.scope === 'line' ? computeDiscountAmount(computeGrossTotal(l.unitPrice, l.quantity), l.discount) : 0));
  const totals = () => {
    const gross = roundCurrency(st.lines.reduce((s, l) => s + computeGrossTotal(l.unitPrice, l.quantity), 0));
    const net = roundCurrency(st.lines.reduce((s, l) => s + lineTotal(l), 0));
    const doc = st.scope === 'total' ? computeDiscountAmount(gross, st.documentDiscount) : 0;
    return { gross, discount: roundCurrency(gross - net + doc), total: roundCurrency(net - doc) };
  };
  const toPayment = () => {
    st.step = 'payment';
    st.payment = { pending: totals().total, entries: [{ method: null, amount: totals().total, currency: st.currency }], notes: '', substep: 'payment' };
  };
  const publishAll = (closed = false) => {
    if (closed) {
      for (const key of ['billing', 'billing.patient', 'billing.items', 'billing.payment']) publishVoiceBridge(key, null, OWNER);
      return;
    }
    const canContinue = st.lines.length > 0 && !!st.patient && !!st.sedeId;
    const wizard: BillingVoiceBridge = {
      step: st.step,
      patientName: st.patient?.name ?? null,
      next: st.step === 'patient' && st.patient ? () => { st.step = 'items'; log.push('next'); publishAll(); } : null,
      invoiceAndPay: st.step === 'items' && canContinue ? () => { log.push('invoice-and-pay'); toPayment(); publishAll(); } : null,
      invoiceOnly: (st.step === 'items' && canContinue) || st.step === 'payment' ? () => { log.push('invoice-only'); st.step = 'confirmation'; publishAll(); } : null,
      payOnly: null,
      close: () => { log.push('close'); sim.close(); },
    };
    publishVoiceBridge('billing', wizard, OWNER);
    const patientBridge: BillingPatientVoiceBridge = {
      selected: st.patient?.name ?? null,
      select: (p) => { st.patient = { id: p.id, name: p.name }; log.push(`patient:${p.id}`); publishAll(); },
    };
    publishVoiceBridge('billing.patient', st.step === 'patient' ? patientBridge : null, OWNER);
    const t = totals();
    const lines: BillingVoiceLine[] = st.lines.map((l) => ({ id: l.id, name: l.name, quantity: l.quantity, unitPrice: l.unitPrice, total: lineTotal(l), discount: l.discount }));
    const change = (id: string, patch: Partial<Line>) => { st.lines = st.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)); publishAll(); };
    const items: BillingItemsVoiceBridge = {
      lines,
      currency: st.currency,
      currencies: ['UYU', 'USD'],
      gross: t.gross,
      discountAmount: t.discount,
      total: t.total,
      discounts: { scope: st.scope, canApply: st.canApply, maxPct: st.maxPct, document: st.documentDiscount },
      sedes: [{ id: 's1', name: 'Centro' }, { id: 's2', name: 'Pocitos' }],
      sedeId: st.sedeId,
      searchServices: async (q) => {
        const key = normalizeSpeech(q);
        return SERVICES.filter((s) => normalizeSpeech(s.name).includes(key) || key.split(' ').every((w) => normalizeSpeech(s.name).includes(w)));
      },
      add: (service, options) => {
        st.lines = [...st.lines, { id: `l${nextLine++}`, serviceId: service.id, name: service.name, quantity: options?.quantity ?? 1, unitPrice: options?.price ?? service.price, discount: null }];
        log.push(`add:${service.id}x${options?.quantity ?? 1}@${options?.price ?? service.price}`);
        publishAll();
      },
      setQuantity: (id, quantity) => { log.push(`qty:${id}=${quantity}`); change(id, { quantity }); },
      setPrice: (id, price) => { log.push(`price:${id}=${price}`); change(id, { unitPrice: price }); },
      remove: (id) => { log.push(`remove:${id}`); st.lines = st.lines.filter((l) => l.id !== id); publishAll(); },
      setLineDiscount: (id, discount) => { log.push(`line-discount:${id}=${discount ? `${discount.value}${discount.mode === 'percent' ? '%' : ''}` : 'none'}`); change(id, { discount }); },
      setDocumentDiscount: (discount) => { st.documentDiscount = discount; log.push(`doc-discount=${discount ? `${discount.value}${discount.mode === 'percent' ? '%' : ''}` : 'none'}`); publishAll(); },
      setCurrency: (c) => { st.currency = c; log.push(`currency:${c}`); publishAll(); },
      setSede: (id) => { st.sedeId = id; log.push(`sede:${id}`); publishAll(); },
    };
    publishVoiceBridge('billing.items', st.step === 'items' ? items : null, OWNER);
    const p = st.payment;
    const covered = p.entries.reduce((s, e) => s + e.amount, 0);
    const payment: BillingPaymentVoiceBridge = {
      substep: p.substep,
      pending: p.pending,
      remaining: Math.max(0, roundCurrency(p.pending - covered)),
      currency: st.currency,
      currencies: ['UYU', 'USD'],
      methods: METHODS,
      entries: p.entries.map((e) => ({ ...e })),
      setEntry: (i, patch) => { p.entries[i] = { ...p.entries[i], ...patch }; log.push(`entry${i}:${JSON.stringify(patch)}`); publishAll(); },
      addEntry: () => { p.entries.push({ method: null, amount: Math.max(0, p.pending - covered), currency: st.currency }); log.push('add-entry'); publishAll(); },
      removeEntry: (i) => { p.entries.splice(i, 1); log.push(`remove-entry${i}`); publishAll(); },
      setNotes: (text) => { p.notes = text; log.push(`notes:${text}`); publishAll(); },
      submit: () => { log.push('submit'); st.step = 'confirmation'; publishAll(); },
    };
    publishVoiceBridge('billing.payment', st.step === 'payment' ? payment : null, OWNER);
  };
  publishAll();
  // Como el modal: mientras está abierto registra su módulo de voz (primero, por encima de la página).
  updateVoiceDomains(['billing', ...activeVoiceDomains().filter((d) => d !== 'billing')]);
  return sim;
}
