'use client';

import * as React from 'react';

const ALERT_STYLE_STORAGE_PREFIX = 'doctor-workspace:alert-style';

export type DoctorAlertStyle = 'modal' | 'toast';

export function useDoctorAlertStyle(doctorId?: string | number): [DoctorAlertStyle, (style: DoctorAlertStyle) => void] {
  const key = doctorId ? `${ALERT_STYLE_STORAGE_PREFIX}:${String(doctorId)}` : null;

  const [alertStyle, setAlertStyleState] = React.useState<DoctorAlertStyle>(() => {
    if (!key || typeof window === 'undefined') return 'modal';
    const stored = window.localStorage.getItem(key);
    return stored === 'toast' ? 'toast' : 'modal';
  });

  const setAlertStyle = React.useCallback(
    (style: DoctorAlertStyle) => {
      if (key) {
        window.localStorage.setItem(key, style);
      }
      setAlertStyleState(style);
    },
    [key],
  );

  return [alertStyle, setAlertStyle];
}
