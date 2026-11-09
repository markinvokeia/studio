import { api } from '@/services/api';

import { API_ROUTES } from '@/constants/routes';
import type { UserPreferences, UserPreferencesResponse } from '@/lib/types';

/**
 * Preferencias del usuario autenticado (`GET /users/preferences` sin `user_id`: resuelve
 * al usuario del JWT).
 *
 * Cada preferencia tiene su propio hook (estilo de alertas, vista de finanzas, posición de
 * los avisos, mascota) y varios componentes montan cada uno al cargar la app, así que el
 * mismo GET salía más de diez veces en el mismo segundo. Las llamadas simultáneas comparten
 * ahora la petición en curso. No se cachea la respuesta: un `refresh()` posterior vuelve a
 * leer del backend, por si la preferencia se cambió desde otra sesión.
 */
let inFlight: Promise<UserPreferences | null> | null = null;

export function fetchMyPreferences(): Promise<UserPreferences | null> {
  inFlight ??= api
    .get(API_ROUTES.USER_PREFERENCES)
    .then((res: unknown) => (res as UserPreferencesResponse | null)?.preferences ?? null)
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}
