'use client';

import * as React from 'react';

import { API_ROUTES } from '@/constants/routes';
import { api } from '@/services/api';
import type { UserPreferences, UserPreferencesResponse } from '@/lib/types';

export type DoctorAlertStyle = 'modal' | 'toast';

export function useDoctorAlertStyle(doctorId?: string | number): [DoctorAlertStyle, (style: DoctorAlertStyle) => void] {
  const [alertStyle, setAlertStyleState] = React.useState<DoctorAlertStyle>('modal');

  React.useEffect(() => {
    if (!doctorId) return;
    api.get(API_ROUTES.USER_PREFERENCES)
      .then((res: unknown) => {
        const prefs = (res as UserPreferencesResponse | null)?.preferences;
        if (prefs?.alert_style === 'modal' || prefs?.alert_style === 'toast') {
          setAlertStyleState(prefs.alert_style);
        }
        // empty preferences {} → keep default 'modal'
      })
      .catch(() => {});
  }, [doctorId]);

  const setAlertStyle = React.useCallback(
    (style: DoctorAlertStyle) => {
      setAlertStyleState(style);
      if (doctorId) {
        api.post(API_ROUTES.USER_PREFERENCES, { alert_style: style } satisfies UserPreferences).catch(() => {});
      }
    },
    [doctorId],
  );

  return [alertStyle, setAlertStyle];
}
