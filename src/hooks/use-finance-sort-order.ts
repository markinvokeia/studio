'use client';

import * as React from 'react';
import type { SortingState } from '@tanstack/react-table';

import type { FinanceSortOrder } from '@/lib/types';

const STORAGE_KEY = 'patient-finance-sort-order';
const DEFAULT_ORDER: FinanceSortOrder = 'newest-last';

// Shared by every mounted consumer (patient page, detail sheet, ledger sheet) so a change
// in one is reflected in the others at once. `memoryOrder` keeps the choice working for the
// session even when localStorage is unavailable (private mode, blocked site data).
let memoryOrder: FinanceSortOrder | null = null;
const listeners = new Set<() => void>();

function isFinanceSortOrder(value: unknown): value is FinanceSortOrder {
  return value === 'newest-first' || value === 'newest-last';
}

function readOrder(): FinanceSortOrder {
  if (memoryOrder) return memoryOrder;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (isFinanceSortOrder(raw)) return raw;
  } catch {}
  return DEFAULT_ORDER;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab changed it: drop the in-memory copy so the stored value wins.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    memoryOrder = null;
    listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

function writeOrder(order: FinanceSortOrder) {
  memoryOrder = order;
  try {
    window.localStorage.setItem(STORAGE_KEY, order);
  } catch {}
  listeners.forEach((l) => l());
}

/** The user's patient-finance display order, persisted in localStorage and shared across views. */
export function useFinanceSortOrder(): [FinanceSortOrder, (order: FinanceSortOrder) => void] {
  const order = React.useSyncExternalStore(subscribe, readOrder, () => DEFAULT_ORDER);
  return [order, writeOrder];
}

/**
 * Default date sorting for a patient finance `DataTable`, driven by `useFinanceSortOrder`.
 * A header click still overrides it until the preference changes again. With `enabled`
 * false (e.g. the providers page) it leaves the table's sorting untouched.
 */
export function useFinanceTableSorting(dateColumnId: string, enabled: boolean) {
  const [sortOrder, setSortOrder] = useFinanceSortOrder();
  const defaultSorting = React.useCallback(
    (order: FinanceSortOrder): SortingState => (enabled ? [{ id: dateColumnId, desc: order === 'newest-first' }] : []),
    [dateColumnId, enabled],
  );
  const [sorting, setSorting] = React.useState<SortingState>(() => defaultSorting(sortOrder));
  React.useEffect(() => { setSorting(defaultSorting(sortOrder)); }, [defaultSorting, sortOrder]);

  return {
    sortOrder,
    setSortOrder,
    sorting,
    setSorting,
    /** Open on the last page, scrolled to the bottom, so the newest row is in view. */
    startAtEnd: enabled && sortOrder === 'newest-last',
  };
}
