'use client';

import * as React from 'react';
import { create } from 'zustand';

import { useAuth } from '@/context/AuthContext';
import { api } from '@/services/api';
import { useHelpAssistant } from '@/stores/help-assistant-store';

import { API_ROUTES } from '@/constants/routes';
import type { MascotHome } from '@/components/invoke-mascot';
import type { UserPreferences, UserPreferencesResponse } from '@/lib/types';

const CACHE_KEY_PREFIX = 'show-mascot';

function readCached(userId: string): boolean | null {
  try {
    const raw = window.localStorage.getItem(`${CACHE_KEY_PREFIX}:${userId}`);
    return raw === 'true' ? true : raw === 'false' ? false : null;
  } catch {
    return null;
  }
}

function writeCached(userId: string, value: boolean) {
  try { window.localStorage.setItem(`${CACHE_KEY_PREFIX}:${userId}`, String(value)); } catch { /* modo privado */ }
}

/** Store compartido: el switch de Preferencias apaga la mascota al instante. */
const useMascotPrefStore = create<{ value: boolean; loadedFor: string | null; set: (v: boolean) => void; setLoaded: (userId: string, v: boolean) => void }>((set) => ({
  value: true,
  loadedFor: null,
  set: (value) => set({ value }),
  setLoaded: (loadedFor, value) => set({ loadedFor, value }),
}));

/**
 * "Mostrar asistente animado" (users/preferences → show_mascot). Por defecto
 * prendido. Apagada (o escondida desde sus iconos), la mascota no está en
 * pantalla y en el riel queda su ícono dormido para despertarla.
 */
export function useMascotPreference(userId?: string | number): [boolean, (value: boolean) => void] {
  const id = userId === undefined || userId === null ? null : String(userId);
  const value = useMascotPrefStore((s) => s.value);
  const loadedFor = useMascotPrefStore((s) => s.loadedFor);

  React.useEffect(() => {
    if (!id || loadedFor === id) return;
    const cached = readCached(id);
    useMascotPrefStore.getState().setLoaded(id, cached ?? true);
    api.get(API_ROUTES.USER_PREFERENCES)
      .then((res: unknown) => {
        const pref = (res as UserPreferencesResponse | null)?.preferences?.show_mascot;
        if (typeof pref === 'boolean') {
          useMascotPrefStore.getState().set(pref);
          writeCached(id, pref);
        }
      })
      .catch(() => { /* se queda con el valor cacheado */ });
  }, [id, loadedFor]);

  const setValue = React.useCallback((next: boolean) => {
    useMascotPrefStore.getState().set(next);
    if (!id) return;
    writeCached(id, next);
    api.post(API_ROUTES.USER_PREFERENCES, { show_mascot: next } satisfies UserPreferences).catch(() => { /* reintenta en la próxima carga */ });
  }, [id]);

  return [value, setValue];
}

const HOME_KEY = 'invoke-mascot:home';
const HOME_SIDES = ['left', 'right', 'top', 'bottom'];

function readHome(): MascotHome | null {
  try {
    const raw = typeof window === 'undefined' ? null : window.localStorage.getItem(HOME_KEY);
    const home = raw ? (JSON.parse(raw) as MascotHome) : null;
    return home && HOME_SIDES.includes(home.side) && Number.isFinite(home.x) && Number.isFinite(home.y) ? home : null;
  } catch {
    return null;
  }
}

/**
 * Dónde dejó la persona la mascota arrastrándola (en este navegador). Define
 * dónde descansa y detrás de qué se esconde: el riel, el menú o el panel.
 */
export const useMascotHome = create<{ home: MascotHome | null; setHome: (home: MascotHome | null) => void }>((set) => ({
  home: readHome(),
  setHome: (home) => {
    try {
      if (home) window.localStorage.setItem(HOME_KEY, JSON.stringify(home));
      else window.localStorage.removeItem(HOME_KEY);
    } catch { /* sin storage queda en memoria */ }
    set({ home });
  },
}));

/**
 * ¿La mascota está en pantalla? La clínica la permite (Preferencias de Clínica →
 * "Mascota visible") y la persona no la escondió. Sin ella, las guías muestran el
 * texto del paso en un globo propio junto al elemento.
 */
export function useMascotOnStage(): boolean {
  const { user } = useAuth();
  const [userShow] = useMascotPreference(user?.id);
  const clinicVisible = useHelpAssistant((s) => s.clinicMascotVisible);
  return clinicVisible && userShow;
}
