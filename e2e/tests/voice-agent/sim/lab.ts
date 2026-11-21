import { publishVoiceBridge } from '@/lib/voice/screen-bridge';

import type { LabOrdersPageVoiceBridge } from '@/lib/types';

/**
 * Órdenes de laboratorio simuladas: el backend (etapas, detalle, cambio de etapa, búsqueda) con
 * datos fijos y la pantalla (lo que publica src/app/[locale]/lab-orders/page.tsx).
 */
export const LAB_STAGES = [
  { id: 1, name: 'Pendiente', kind: 'initial', sort_order: 1, is_active: true },
  { id: 2, name: 'En laboratorio', kind: 'intermediate', sort_order: 2, is_active: true },
  { id: 3, name: 'Recibida en clínica', kind: 'intermediate', sort_order: 3, is_active: true },
  { id: 4, name: 'Entregada', kind: 'final', sort_order: 4, is_active: true },
  { id: 5, name: 'Cancelada', kind: 'final', sort_order: 5, is_active: true },
];

interface SimOrder { id: number; patient_id: string; patient_name: string; laboratory_id: string; laboratory_name: string; work_summary: string; current_stage_id: number; due_date: string | null; is_urgent: boolean }

export interface SimLab {
  orders: SimOrder[];
  moves: Array<{ id: number; to: number }>;
  bridge: LabOrdersPageVoiceBridge;
  handle: (url: string, init: RequestInit) => Response | null;
}

const OWNER = {};

export function createSimLab(): SimLab {
  const orders: SimOrder[] = [
    { id: 45, patient_id: 'p1', patient_name: 'Ana Gómez', laboratory_id: 'l1', laboratory_name: 'Dental Sur', work_summary: 'Corona', current_stage_id: 1, due_date: null, is_urgent: false },
    { id: 46, patient_id: 'p2', patient_name: 'Juan Pérez', laboratory_id: 'l2', laboratory_name: 'Prótesis Norte', work_summary: 'Puente', current_stage_id: 2, due_date: '2026-12-01', is_urgent: false },
    { id: 47, patient_id: 'p3', patient_name: 'Ana Martínez', laboratory_id: 'l1', laboratory_name: 'Dental Sur', work_summary: 'Placa', current_stage_id: 2, due_date: '2026-12-05', is_urgent: true },
  ];
  const moves: SimLab['moves'] = [];
  const stageOf = (id: number) => LAB_STAGES.find((s) => s.id === id)!;
  const raw = (o: SimOrder) => {
    const st = stageOf(o.current_stage_id);
    return { ...o, stage_name: st.name, stage_kind: st.kind, is_pending: st.kind !== 'final', created_at: '2026-11-01T10:00:00Z', stage_entered_at: '2026-11-10T10:00:00Z', days_in_stage: 3, due_stage_id: o.due_date ? 2 : null };
  };
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  const bridge: LabOrdersPageVoiceBridge = {
    rows: orders.map((o) => ({ id: o.id, patient: o.patient_name, laboratory: o.laboratory_name, stage: stageOf(o.current_stage_id).name, work: o.work_summary, due: o.due_date, overdue: false, urgent: o.is_urgent })),
    selectedId: null,
    select: (id) => { bridge.selectedId = id; },
  };
  publishVoiceBridge('lab_orders.page', bridge, OWNER);
  return {
    orders,
    moves,
    bridge,
    handle: (url, init) => {
      const u = new URL(url);
      if (u.pathname.endsWith('/lab-stages')) return json(LAB_STAGES);
      if (u.pathname.endsWith('/lab-orders/detail')) {
        const o = orders.find((x) => x.id === Number(u.searchParams.get('id')));
        return json(o ? [{ detail: { ...raw(o), history: [], changes: [] } }] : [{}]);
      }
      if (u.pathname.endsWith('/lab-orders/change-stage')) {
        const body = JSON.parse(String(init.body ?? '{}')) as { id: number; to_stage_id: number; due_date?: string };
        const o = orders.find((x) => x.id === body.id)!;
        o.current_stage_id = body.to_stage_id;
        if (body.due_date) o.due_date = body.due_date;
        moves.push({ id: body.id, to: body.to_stage_id });
        return json([raw(o)]);
      }
      if (u.pathname.endsWith('/lab-orders/save')) {
        const body = JSON.parse(String(init.body ?? '{}')) as { id: number; is_urgent?: boolean };
        const o = orders.find((x) => x.id === body.id);
        if (o && typeof body.is_urgent === 'boolean') o.is_urgent = body.is_urgent;
        return json(o ? [raw(o)] : [{}]);
      }
      if (u.pathname.endsWith('/lab-orders/search')) return json(orders.map((o) => ({ row_data: raw(o), total_count: orders.length })));
      if (u.pathname.endsWith('/lab-orders/laboratories')) return json([{ id: 'l1', name: 'Dental Sur' }, { id: 'l2', name: 'Prótesis Norte' }]);
      if (u.pathname.endsWith('/lab-orders/lab-categories')) return json([]);
      return null;
    },
  };
}

export function clearSimLab() { publishVoiceBridge('lab_orders.page', null, OWNER); }
