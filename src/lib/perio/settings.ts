'use client';

import React from 'react';

import { fetchSystemConfigs, saveSystemConfig } from '@/services/system-config';

import type { PerioRisk } from '@/lib/types';

// Clinic settings of the periodontogram, in system_configurations (key perio_settings, JSON):
// probing order, the sign the margin is typed with, and the maintenance interval of each risk.
// Without the key (or without access to the configs) the defaults apply.

export const PERIO_SETTINGS_KEY = 'perio_settings';

export interface PerioSettings {
  order: 'arch' | 'buccalFirst';
  /**
   * recessionPositive: recession is typed positive (margin below the CEJ), enlargement negative.
   * recessionNegative: the other way round. The record always keeps recession positive.
   */
  marginSign: 'recessionPositive' | 'recessionNegative';
  intervals: Record<PerioRisk, number>;
}

export const DEFAULT_PERIO_SETTINGS: PerioSettings = {
  order: 'arch',
  marginSign: 'recessionPositive',
  intervals: { high: 3, moderate: 4, low: 6 },
};

export function parsePerioSettings(raw: unknown): PerioSettings {
  let value: Partial<PerioSettings> = {};
  try { value = typeof raw === 'string' ? JSON.parse(raw) : (raw as Partial<PerioSettings>) ?? {}; } catch { value = {}; }
  const months = (v: unknown, fallback: number) => (Number.isFinite(Number(v)) && Number(v) >= 1 && Number(v) <= 24 ? Number(v) : fallback);
  return {
    order: value.order === 'buccalFirst' ? 'buccalFirst' : 'arch',
    marginSign: value.marginSign === 'recessionNegative' ? 'recessionNegative' : 'recessionPositive',
    intervals: {
      high: months(value.intervals?.high, DEFAULT_PERIO_SETTINGS.intervals.high),
      moderate: months(value.intervals?.moderate, DEFAULT_PERIO_SETTINGS.intervals.moderate),
      low: months(value.intervals?.low, DEFAULT_PERIO_SETTINGS.intervals.low),
    },
  };
}

/** +1 when the margin is typed as stored, −1 when the clinic types recession as negative */
export const marginSignOf = (s: PerioSettings) => (s.marginSign === 'recessionNegative' ? -1 : 1);

let cache: PerioSettings | null = null;

export async function fetchPerioSettings(): Promise<PerioSettings> {
  try {
    const configs = await fetchSystemConfigs();
    cache = parsePerioSettings(configs.find((c) => c.key === PERIO_SETTINGS_KEY)?.value);
  } catch {
    cache = DEFAULT_PERIO_SETTINGS;
  }
  return cache;
}

export async function savePerioSettings(settings: PerioSettings): Promise<void> {
  await saveSystemConfig({
    key: PERIO_SETTINGS_KEY,
    value: JSON.stringify(settings),
    data_type: 'json',
    description: 'Periodontograma: orden de sondaje, signo del margen e intervalos de mantenimiento por riesgo',
  });
  cache = settings;
}

/** The clinic's settings (defaults until they load or if they cannot be read) */
export function usePerioSettings() {
  const [settings, setSettings] = React.useState<PerioSettings>(cache ?? DEFAULT_PERIO_SETTINGS);
  React.useEffect(() => {
    let active = true;
    fetchPerioSettings().then((s) => { if (active) setSettings(s); });
    return () => { active = false; };
  }, []);
  return { settings, setSettings };
}

export const PerioSettingsContext = React.createContext<PerioSettings>(DEFAULT_PERIO_SETTINGS);
export const usePerioSettingsContext = () => React.useContext(PerioSettingsContext);
