'use client';

import * as React from 'react';

export type TableDensity = 'comfortable' | 'normal' | 'compact';

const STORAGE_KEY = 'table-density';
const DEFAULT_DENSITY: TableDensity = 'normal';

function isDensity(value: unknown): value is TableDensity {
  return value === 'comfortable' || value === 'normal' || value === 'compact';
}

function readStored(): TableDensity {
  if (typeof window === 'undefined') return DEFAULT_DENSITY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (isDensity(raw)) return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_DENSITY;
}

function apply(density: TableDensity) {
  if (typeof document === 'undefined') return;
  // Normal is the default (no attribute); only set it for the non-default levels.
  if (density === DEFAULT_DENSITY) {
    document.documentElement.removeAttribute('data-density');
  } else {
    document.documentElement.setAttribute('data-density', density);
  }
}

/**
 * Reads/writes the user's table density preference from localStorage and keeps the
 * `data-density` attribute on <html> in sync (the inline script in layout applies it
 * before paint; this re-applies on mount and on every change).
 */
export function useTableDensity(): [TableDensity, (density: TableDensity) => void] {
  const [density, setDensityState] = React.useState<TableDensity>(DEFAULT_DENSITY);

  React.useEffect(() => {
    const stored = readStored();
    setDensityState(stored);
    apply(stored);
  }, []);

  const setDensity = React.useCallback((next: TableDensity) => {
    setDensityState(next);
    apply(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  return [density, setDensity];
}
