'use client';

import * as React from 'react';

import { API_ROUTES } from '@/constants/routes';
import { api } from '@/services/api';
import type { PatientFinanceView, UserPreferences, UserPreferencesResponse } from '@/lib/types';

const CACHE_KEY_PREFIX = 'patient-finance-view';

function readCachedView(userId: string | number): PatientFinanceView | null {
  try {
    const raw = window.localStorage.getItem(`${CACHE_KEY_PREFIX}:${userId}`);
    if (raw === 'unified' || raw === 'tabs') return raw;
  } catch {}
  return null;
}

function writeCachedView(userId: string | number, view: PatientFinanceView) {
  try {
    window.localStorage.setItem(`${CACHE_KEY_PREFIX}:${userId}`, view);
  } catch {}
}

export function useFinanceViewPreference(userId?: string | number): [PatientFinanceView, (view: PatientFinanceView) => void] {
  const [financeView, setFinanceViewState] = React.useState<PatientFinanceView>('unified');

  React.useEffect(() => {
    if (!userId) return;
    const cached = readCachedView(userId);
    if (cached) setFinanceViewState(cached);
  }, [userId]);

  React.useEffect(() => {
    if (!userId) return;
    api.get(API_ROUTES.USER_PREFERENCES)
      .then((res: unknown) => {
        const prefs = (res as UserPreferencesResponse | null)?.preferences;
        if (prefs?.finance_view === 'unified' || prefs?.finance_view === 'tabs') {
          setFinanceViewState(prefs.finance_view);
          writeCachedView(userId, prefs.finance_view);
        }
      })
      .catch(() => {});
  }, [userId]);

  const setFinanceView = React.useCallback(
    (view: PatientFinanceView) => {
      setFinanceViewState(view);
      if (userId) {
        writeCachedView(userId, view);
        api.post(API_ROUTES.USER_PREFERENCES, { finance_view: view } satisfies UserPreferences).catch(() => {});
      }
    },
    [userId],
  );

  return [financeView, setFinanceView];
}
