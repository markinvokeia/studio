import { publishVoiceBridge } from '@/lib/voice/screen-bridge';

import type { CashCountVoiceBridge, CashierSessionVoiceBridge, CashierVoiceBridge } from '@/lib/types';

/** La Caja simulada (lo que publica src/app/[locale]/cashier/page.tsx): cajas, sesión y conteo. */
export interface SimCashier {
  bridge: CashierVoiceBridge;
  log: string[];
  /** Abre la sesión (como si se hubiera entrado a una caja abierta). */
  showSession: () => void;
  /** Muestra el contador de una moneda (paso del conteo en la apertura o el cierre). */
  showCounter: (currency?: string, options?: { denominations?: number[]; coins?: number[]; last?: boolean }) => CashCountVoiceBridge;
}

const OWNER = {};

export function publishSimCashier(): SimCashier {
  const log: string[] = [];
  const bridge: CashierVoiceBridge = {
    view: 'points',
    wizardStep: null,
    cashPoints: [
      { id: 'cp1', name: 'Caja Principal', open: false, mine: false, user: '' },
      { id: 'cp2', name: 'Caja Recepción', open: true, mine: false, user: 'Laura' },
    ],
    openPoint: (id) => { log.push(`open:${id}`); },
    startClosing: null,
    viewAll: null,
  };
  const session: CashierSessionVoiceBridge = {
    name: 'Caja Principal',
    cashOnHand: [{ currency: 'UYU', amount: 12500 }],
    income: [{ currency: 'UYU', amount: 18000 }],
    outcome: [{ currency: 'UYU', amount: 2500 }],
    card: [{ currency: 'UYU', amount: 6000 }],
    movements: [
      { type: 'INGRESO', amount: 1500, currency: 'UYU', method: 'Efectivo', document: 'F-120', client: 'Juan Pérez' },
      { type: 'EGRESO', amount: 2500, currency: 'UYU', method: 'Efectivo', document: 'G-3', client: '' },
    ],
  };
  const publish = () => publishVoiceBridge('cashier', bridge, OWNER);
  publish();
  return {
    bridge,
    log,
    showSession: () => {
      bridge.view = 'active';
      bridge.startClosing = () => { log.push('start-closing'); bridge.view = 'closing'; bridge.startClosing = null; };
      bridge.viewAll = () => { log.push('view-all'); bridge.view = 'points'; };
      publishVoiceBridge('cashier.session', session, OWNER);
      publish();
    },
    showCounter: (currency = 'UYU', { denominations = [2000, 1000, 500, 200, 100], coins = [50, 10, 5], last = true } = {}) => {
      const counter: CashCountVoiceBridge = {
        currency,
        title: `Conteo ${currency}`,
        denominations,
        coins,
        quantities: {},
        total: 0,
        setQuantity: (den, qty) => { counter.quantities = { ...counter.quantities, [den]: qty }; recount(); log.push(`count:${den}=${qty}`); },
        setTotal: (amount) => { counter.quantities = { total: amount }; counter.total = amount; log.push(`total:${amount}`); },
        setAll: (qty) => { counter.quantities = Object.fromEntries([...denominations, ...coins].map((d) => [d, qty])); recount(); log.push(`all:${qty}`); },
        loadLast: last ? () => { counter.quantities = { 1000: 10, 500: 4 }; recount(); log.push('last'); } : null,
      };
      const recount = () => {
        counter.total = denominations.length
          ? Object.entries(counter.quantities).reduce((s, [d, q]) => s + Number(d) * Number(q), 0)
          : Number(counter.quantities.total) || 0;
      };
      publishVoiceBridge(`cashier.count.${currency}`, counter, OWNER);
      return counter;
    },
  };
}

export function clearSimCashier() {
  for (const key of ['cashier', 'cashier.session', 'cashier.count.UYU', 'cashier.count.USD']) publishVoiceBridge(key, null, OWNER);
}
