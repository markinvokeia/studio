'use client';

import { useEffect } from 'react';

import { useClinicInfoStore } from '@/stores/clinic-info-store';

export type { ClinicInfo } from '@/services/clinic-info';
export { fetchClinicInfo } from '@/services/clinic-info';

/**
 * Datos de la clínica desde el store. Los carga
 * `ClinicPreferencesInitializer` tras el login; este hook dispara el fetch
 * igualmente como red de seguridad, para las pantallas públicas que se montan
 * fuera de `PrivateRoute` (portal del paciente, TV de sala de espera).
 */
export function useClinicInfo() {
  const info = useClinicInfoStore((s) => s.info);
  const isLoaded = useClinicInfoStore((s) => s.isLoaded);
  const fetchInfo = useClinicInfoStore((s) => s.fetchInfo);

  useEffect(() => {
    if (!isLoaded) fetchInfo();
  }, [isLoaded, fetchInfo]);

  return info;
}
