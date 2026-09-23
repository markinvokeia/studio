'use client';

import { useEffect } from 'react';

import { useAuth } from '@/context/AuthContext';
import { useCalendarStatusDisplayStore } from '@/stores/calendar-status-display-store';
import { useClinicInfoStore } from '@/stores/clinic-info-store';
import { useClinicPreferencesStore } from '@/stores/clinic-preferences-store';

/**
 * Carga las preferencias de la clínica, sus datos (incluida la moneda de
 * trabajo) y la matriz de colores de estado una vez que hay usuario
 * autenticado. Mismo patrón que `LicenseInitializer`: se monta dentro de
 * `PrivateRoute` y no pinta nada.
 */
export function ClinicPreferencesInitializer() {
  const { user } = useAuth();
  const fetchPreferences = useClinicPreferencesStore((s) => s.fetchPreferences);
  const fetchStatusDisplayMatrix = useCalendarStatusDisplayStore((s) => s.fetchMatrix);
  const fetchClinicInfo = useClinicInfoStore((s) => s.fetchInfo);

  useEffect(() => {
    if (user) {
      fetchPreferences();
      fetchStatusDisplayMatrix();
      fetchClinicInfo();
    }
  }, [user, fetchPreferences, fetchStatusDisplayMatrix, fetchClinicInfo]);

  return null;
}
