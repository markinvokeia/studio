import { create } from 'zustand';

import { DEFAULT_CURRENCY } from '@/constants/currencies';
import { type ClinicInfo, fetchClinicInfo } from '@/services/clinic-info';

/**
 * Datos de la clínica (nombre, logo, contacto y **moneda de trabajo**),
 * cargados una sola vez tras el login por `ClinicPreferencesInitializer` y
 * leídos desde memoria por el resto de la app.
 *
 * Antes esto era una caché a nivel de módulo dentro de `useClinicInfo`. Se
 * promovió a store porque la moneda la necesita medio producto de forma
 * síncrona: con la caché de módulo, cada componente arrancaba con `null` y
 * hacía un render con la moneda equivocada antes de resolverse la promesa.
 *
 * Mientras `isLoaded` es false se sirve `DEFAULT_CURRENCY` (USD). Es la opción
 * segura: es la moneda internacional por defecto, y el valor real llega en el
 * primer render tras el login.
 */
interface ClinicInfoStore {
  info: ClinicInfo | null;
  isLoaded: boolean;
  isLoading: boolean;

  /** Carga una vez. No hace nada si ya hay datos. */
  fetchInfo: () => Promise<void>;
  /** Fuerza una recarga. La usa la pantalla de configuración tras guardar. */
  refresh: () => Promise<void>;
  setInfo: (info: ClinicInfo) => void;
}

export const useClinicInfoStore = create<ClinicInfoStore>((set, get) => ({
  info: null,
  isLoaded: false,
  isLoading: false,

  fetchInfo: async () => {
    if (get().isLoading || get().isLoaded) return;
    await get().refresh();
  },

  refresh: async () => {
    if (get().isLoading) return;
    set({ isLoading: true });
    try {
      const info = await fetchClinicInfo();
      set({ info, isLoaded: true });
    } catch (error) {
      // Sin datos de clínica la app sigue funcionando con la moneda por
      // defecto, así que un fallo de red no debe bloquear nada.
      console.error('Failed to load the clinic info:', error);
      set({ isLoaded: true });
    } finally {
      set({ isLoading: false });
    }
  },

  setInfo: (info) => set({ info, isLoaded: true }),
}));

/**
 * Moneda de la clínica fuera de React: servicios, normalizadores y plantillas
 * que solo la necesitan como valor por defecto cuando el backend no manda la
 * moneda del registro. No es reactiva — para la UI usa `useCurrencySettings`.
 */
export function getClinicCurrency(): string {
  return useClinicInfoStore.getState().info?.currency ?? DEFAULT_CURRENCY;
}

/** Moneda de trabajo de la clínica. `DEFAULT_CURRENCY` mientras no hay dato. */
export function useClinicCurrency(): string {
  return useClinicInfoStore((s) => s.info?.currency ?? DEFAULT_CURRENCY);
}

/**
 * Las dos monedas configuradas. Se leen con selectores separados a propósito:
 * devolver un objeto nuevo desde el selector haría re-renderizar en cada
 * cambio del store, porque Zustand compara por identidad.
 */
export function useClinicCurrencies(): { code: string; secondaryCode?: string } {
  const code = useClinicInfoStore((s) => s.info?.currency ?? DEFAULT_CURRENCY);
  const secondaryCode = useClinicInfoStore((s) => s.info?.secondaryCurrency);
  return { code, secondaryCode };
}
