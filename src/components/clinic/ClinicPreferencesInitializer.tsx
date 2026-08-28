'use client';

import { useEffect } from 'react';

import { useAuth } from '@/context/AuthContext';
import { useClinicPreferencesStore } from '@/stores/clinic-preferences-store';

/**
 * Carga las preferencias de la clínica una vez que hay usuario autenticado.
 * Mismo patrón que `LicenseInitializer`: se monta dentro de `PrivateRoute` y no
 * pinta nada.
 */
export function ClinicPreferencesInitializer() {
  const { user } = useAuth();
  const fetchPreferences = useClinicPreferencesStore((s) => s.fetchPreferences);

  useEffect(() => {
    if (user) fetchPreferences();
  }, [user, fetchPreferences]);

  return null;
}
