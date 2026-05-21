'use client';

import * as React from 'react';

import { API_ROUTES } from '@/constants/routes';
import { api } from '@/services/api';
import type { DoctorAlertStyle, UserPreferences, UserPreferencesResponse } from '@/lib/types';

const CACHE_KEY_PREFIX = 'doctor-alert-style';

function readCachedStyle(doctorId: string | number): DoctorAlertStyle | null {
  try {
    const raw = window.localStorage.getItem(`${CACHE_KEY_PREFIX}:${doctorId}`);
    if (raw === 'modal' || raw === 'toast') return raw;
  } catch {}
  return null;
}

function writeCachedStyle(doctorId: string | number, style: DoctorAlertStyle) {
  try {
    window.localStorage.setItem(`${CACHE_KEY_PREFIX}:${doctorId}`, style);
  } catch {}
}

export function useDoctorAlertStyle(doctorId?: string | number): [DoctorAlertStyle, (style: DoctorAlertStyle) => void] {
  const [alertStyle, setAlertStyleState] = React.useState<DoctorAlertStyle>('modal');

  // Read cache synchronously as soon as doctorId is available — runs in the same
  // effect flush as the notifications loading effect, so alertStyleRef is correct
  // before the alert dispatch effect fires.
  React.useEffect(() => {
    if (!doctorId) return;
    const cached = readCachedStyle(doctorId);
    if (cached) setAlertStyleState(cached);
  }, [doctorId]);

  React.useEffect(() => {
    if (!doctorId) return;
    api.get(API_ROUTES.USER_PREFERENCES)
      .then((res: unknown) => {
        const prefs = (res as UserPreferencesResponse | null)?.preferences;
        if (prefs?.alert_style === 'modal' || prefs?.alert_style === 'toast') {
          setAlertStyleState(prefs.alert_style);
          writeCachedStyle(doctorId, prefs.alert_style);
        }
      })
      .catch(() => {});
  }, [doctorId]);

  const setAlertStyle = React.useCallback(
    (style: DoctorAlertStyle) => {
      setAlertStyleState(style);
      if (doctorId) {
        writeCachedStyle(doctorId, style);
        api.post(API_ROUTES.USER_PREFERENCES, { alert_style: style } satisfies UserPreferences).catch(() => {});
      }
    },
    [doctorId],
  );

  return [alertStyle, setAlertStyle];
}
