'use client';

import * as React from 'react';

import { useVoiceScreen } from '@/hooks/use-voice-screen';
import { useVoiceBridge } from '@/lib/voice/screen-bridge';

import type { DocumentsVoiceBridge } from '@/lib/types';

/**
 * Una tabla de documentos (facturas, pagos, presupuestos) se publica para la voz: «la factura
 * 120», «imprimí la de Juan», «cobrá la primera», «¿cuánto suman las pendientes?». La usan las
 * tablas compartidas (InvoicesTable, PaymentsTable, RecentQuotesTable), así sirve en Ventas, en
 * Compras y en la ficha del paciente. Varias tablas a la vez tienen cada una su clave.
 */
export function useDocumentsVoice<T extends { id: string | number }>(
  items: T[],
  toRow: (item: T) => DocumentsVoiceBridge['rows'][number],
  bridge: Omit<DocumentsVoiceBridge, 'rows' | 'actions'> & {
    actions: { [K in keyof DocumentsVoiceBridge['actions']]: ((item: T) => void) | null | undefined };
  },
) {
  const instance = React.useId();
  useVoiceScreen(['documents']);
  const byId = (id: string) => items.find((item) => String(item.id) === id);
  const wrap = (fn: ((item: T) => void) | null | undefined) => (fn ? (id: string) => { const item = byId(id); if (item) fn(item); } : null);
  useVoiceBridge<DocumentsVoiceBridge>(`documents.${bridge.kind}.${instance}`, {
    ...bridge,
    rows: items.map(toRow),
    actions: {
      select: wrap(bridge.actions.select),
      print: wrap(bridge.actions.print),
      email: wrap(bridge.actions.email),
      edit: wrap(bridge.actions.edit),
      confirm: wrap(bridge.actions.confirm),
      reject: wrap(bridge.actions.reject),
      pay: wrap(bridge.actions.pay),
      allocate: wrap(bridge.actions.allocate),
    },
  });
}
