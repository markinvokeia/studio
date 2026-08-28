import { create } from 'zustand';

import type { ClinicPreferences } from '@/lib/types';
import { DEFAULT_CLINIC_PREFERENCES, fetchClinicPreferences } from '@/services/clinic-preferences';

/**
 * Preferencias de la clínica, cargadas una sola vez tras el login por
 * `ClinicPreferencesInitializer` y leídas desde memoria por el resto de la app.
 *
 * No cambian casi nunca, así que no se vuelven a pedir al navegar. Cuando la
 * página de configuración las guarda, llama a `setPreferences` para que el
 * cambio se vea sin recargar.
 *
 * Mientras `isLoaded` es false se sirven los valores por defecto (descuentos
 * apagados): es la opción segura, porque el peor caso es que un formulario
 * abierto en el primer segundo no ofrezca descuento, en vez de ofrecer uno con
 * un tope equivocado.
 */
interface ClinicPreferencesStore {
  preferences: ClinicPreferences;
  isLoaded: boolean;
  isLoading: boolean;

  fetchPreferences: () => Promise<void>;
  setPreferences: (preferences: ClinicPreferences) => void;
}

export const useClinicPreferencesStore = create<ClinicPreferencesStore>((set, get) => ({
  preferences: DEFAULT_CLINIC_PREFERENCES,
  isLoaded: false,
  isLoading: false,

  fetchPreferences: async () => {
    if (get().isLoading) return;
    set({ isLoading: true });
    try {
      const preferences = await fetchClinicPreferences();
      set({ preferences, isLoaded: true });
    } catch (error) {
      // Sin preferencias la app sigue funcionando exactamente como antes de los
      // descuentos, así que un fallo de red no debe bloquear nada.
      console.error('Failed to load the clinic preferences:', error);
      set({ preferences: DEFAULT_CLINIC_PREFERENCES, isLoaded: true });
    } finally {
      set({ isLoading: false });
    }
  },

  setPreferences: (preferences) => set({ preferences, isLoaded: true }),
}));
