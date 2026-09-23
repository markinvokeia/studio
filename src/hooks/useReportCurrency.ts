'use client';

import { useEffect, useRef, useState } from 'react';

import { useCurrencySettings } from '@/hooks/useCurrencySettings';
import { useClinicInfoStore } from '@/stores/clinic-info-store';

/** Valor del filtro que significa "todas las monedas". */
export const ALL_CURRENCIES = 'all';

export interface ReportCurrencyState {
  /** Filtro de la consulta: un código, o `'all'`. */
  currency: string;
  setCurrency: (value: string) => void;
  /** Moneda del gráfico cuando el filtro está en `'all'`. */
  chartCurrency: string;
  setChartCurrency: (value: string) => void;
  /**
   * Moneda que se está mostrando: la del filtro si es concreta, y si no, la
   * elegida en el conmutador del gráfico.
   */
  activeCurrency: string;
  /** La clínica opera con dos monedas. Con una sola, no hay nada que filtrar. */
  isDual: boolean;
  options: string[];
}

/**
 * Estado de moneda compartido por los 19 reportes, que antes repetían el mismo
 * par de `useState` con `'UYU'` escrito a mano.
 *
 * Con una sola moneda configurada el filtro se fija en ella y nunca vale
 * `'all'`: no tiene sentido ofrecer "todas" cuando solo hay una.
 */
export interface UseReportCurrencyOptions {
  /**
   * El reporte ofrece la opción "todas las monedas". Los que comparan una
   * única moneda a la vez (KPIs, deudores, estado de resultados) pasan
   * `false`: ahí el filtro siempre vale un código concreto.
   */
  includeAll?: boolean;
}

export function useReportCurrency({ includeAll = true }: UseReportCurrencyOptions = {}): ReportCurrencyState {
  const { code, options, isDual } = useCurrencySettings();
  const isLoaded = useClinicInfoStore((s) => s.isLoaded);

  const initial = isDual && includeAll ? ALL_CURRENCIES : code;
  const [currency, setCurrency] = useState<string>(initial);
  const [chartCurrency, setChartCurrency] = useState<string>(code);

  // La moneda de la clínica llega del backend, así que el primer render puede
  // ocurrir con el valor por defecto. Se siembra una sola vez, cuando el dato
  // real está disponible, para no pisar lo que el usuario haya elegido después.
  const seeded = useRef(false);
  useEffect(() => {
    if (!isLoaded || seeded.current) return;
    seeded.current = true;
    setCurrency(isDual && includeAll ? ALL_CURRENCIES : code);
    setChartCurrency(code);
  }, [isLoaded, isDual, code, includeAll]);

  return {
    currency,
    setCurrency,
    chartCurrency,
    setChartCurrency,
    activeCurrency: currency !== ALL_CURRENCIES ? currency : chartCurrency,
    isDual,
    options,
  };
}
