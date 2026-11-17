'use client';

import * as React from 'react';

import type { LabOrder } from '@/lib/types';

/**
 * Aviso local (esta pestaña) de que una orden cambió fuera de la pantalla de órdenes, por
 * ejemplo por un comando de voz: la pantalla la recarga y la resalta para que se vea moverse.
 * Los cambios de otros usuarios llegan por useLabOrdersLive (SSE).
 */
const EVENT = 'invoke:lab-order-changed';

export function emitLabOrderChanged(order: LabOrder) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<LabOrder>(EVENT, { detail: order }));
}

export function useLabOrderChanged(onChange: (order: LabOrder) => void) {
  const onChangeRef = React.useRef(onChange);
  React.useLayoutEffect(() => { onChangeRef.current = onChange; });
  React.useEffect(() => {
    const handler = (event: Event) => onChangeRef.current((event as CustomEvent<LabOrder>).detail);
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, []);
}

/** Lo que un comando de voz pide ver en la pantalla de órdenes ("mostrame las atrasadas"). */
export interface LabOrdersViewRequest {
  /** Quita los filtros que había antes de aplicar estos. */
  clear?: boolean;
  overdue?: boolean;
  urgent?: boolean;
  dueToday?: boolean;
  laboratory?: { id: string; name: string } | null;
  patient?: { id: string; name: string } | null;
  view?: 'list' | 'board';
}

const VIEW_EVENT = 'invoke:lab-orders-view-request';
/** Pedido hecho antes de que la pantalla esté montada (se navegó a /lab-orders). */
let pendingView: LabOrdersViewRequest | null = null;

export function requestLabOrdersView(request: LabOrdersViewRequest) {
  if (typeof window === 'undefined') return;
  pendingView = request;
  window.dispatchEvent(new CustomEvent<LabOrdersViewRequest>(VIEW_EVENT, { detail: request }));
}

/** La pantalla de órdenes aplica los pedidos (también el que quedó pendiente al navegar). */
export function useLabOrdersViewRequest(apply: (request: LabOrdersViewRequest) => void) {
  const applyRef = React.useRef(apply);
  React.useLayoutEffect(() => { applyRef.current = apply; });
  React.useEffect(() => {
    const take = (request: LabOrdersViewRequest) => {
      pendingView = null;
      applyRef.current(request);
    };
    if (pendingView) take(pendingView);
    const handler = (event: Event) => take((event as CustomEvent<LabOrdersViewRequest>).detail);
    window.addEventListener(VIEW_EVENT, handler);
    return () => window.removeEventListener(VIEW_EVENT, handler);
  }, []);
}
