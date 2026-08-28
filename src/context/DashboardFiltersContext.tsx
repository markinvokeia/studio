'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { endOfMonth, startOfMonth } from 'date-fns';

import { useAuth } from '@/context/AuthContext';
import type { DashboardCurrency } from '@/lib/types';

interface DashboardFiltersContextType {
  /** `null` = Consolidado (todas las sucursales). */
  sedeId: string | null;
  setSedeId: (sedeId: string | null) => void;
  dateRange: DateRange | undefined;
  setDateRange: (range: DateRange | undefined) => void;
  currency: DashboardCurrency;
  setCurrency: (currency: DashboardCurrency) => void;
}

const DashboardFiltersContext = createContext<DashboardFiltersContextType | undefined>(undefined);

const STORAGE_PREFIX = 'dashboard-filters';

function storageKey(userId: string | undefined, field: string) {
  return `${STORAGE_PREFIX}:${userId ?? 'anon'}:${field}`;
}

function readStored(userId: string | undefined, field: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(storageKey(userId, field));
  } catch {
    return null;
  }
}

function writeStored(userId: string | undefined, field: string, value: string | null) {
  if (typeof window === 'undefined') return;
  try {
    if (value === null) window.localStorage.removeItem(storageKey(userId, field));
    else window.localStorage.setItem(storageKey(userId, field), value);
  } catch {
    /* Modo privado o almacenamiento bloqueado: el filtro simplemente no se recuerda. */
  }
}

export function DashboardFiltersProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;

  const [sedeId, setSedeIdState] = useState<string | null>(null);
  const [currency, setCurrencyState] = useState<DashboardCurrency>('UYU');
  // Se deja indefinido en el primer render y se completa al montar: construir la fecha
  // durante el render del servidor produce un desajuste de hidratación.
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  useEffect(() => {
    const now = new Date();
    setDateRange({ from: startOfMonth(now), to: endOfMonth(now) });
  }, []);

  // Los filtros persistidos son por usuario: dos cuentas en el mismo navegador no se pisan.
  useEffect(() => {
    setSedeIdState(readStored(userId, 'sedeId'));
    const storedCurrency = readStored(userId, 'currency');
    setCurrencyState(storedCurrency === 'USD' ? 'USD' : 'UYU');
  }, [userId]);

  const setSedeId = useCallback(
    (next: string | null) => {
      setSedeIdState(next);
      writeStored(userId, 'sedeId', next);
    },
    [userId],
  );

  const setCurrency = useCallback(
    (next: DashboardCurrency) => {
      setCurrencyState(next);
      writeStored(userId, 'currency', next);
    },
    [userId],
  );

  const value = useMemo(
    () => ({ sedeId, setSedeId, dateRange, setDateRange, currency, setCurrency }),
    [sedeId, setSedeId, dateRange, currency, setCurrency],
  );

  return <DashboardFiltersContext.Provider value={value}>{children}</DashboardFiltersContext.Provider>;
}

export function useDashboardFilters() {
  const context = useContext(DashboardFiltersContext);
  if (!context) {
    throw new Error('useDashboardFilters must be used within a DashboardFiltersProvider');
  }
  return context;
}
