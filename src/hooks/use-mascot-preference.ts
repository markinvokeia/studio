'use client';

import * as React from 'react';
import { create } from 'zustand';

import { api } from '@/services/api';

import { API_ROUTES } from '@/constants/routes';
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
 * prendido. Desactivada, la mascota hiberna y no reacciona.
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
