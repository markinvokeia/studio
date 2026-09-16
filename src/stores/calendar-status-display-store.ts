import { create } from 'zustand';

import { DEFAULT_STATUS_DISPLAY } from '@/constants/appointment-status';
import { mergeStatusMatrix } from '@/lib/appointment-status-display';
import type { AppointmentStatusDisplayMatrix, CalendarStatusDisplayRow } from '@/lib/types';
import { fetchStatusDisplayRows } from '@/services/calendar-status-display';

/**
 * Matriz de colores de estado, cargada una sola vez tras el login por
 * `ClinicPreferencesInitializer` y leída desde memoria por el resto de la app
 * (calendario, badges, menú de estados). Mismo patrón que `clinic-preferences-store`.
 *
 * Mientras `isLoaded` es false se sirve `DEFAULT_STATUS_DISPLAY`: el calendario
 * nunca queda sin color esperando la red.
 */
interface CalendarStatusDisplayStore {
  general: AppointmentStatusDisplayMatrix;
  byCalendar: Record<string, AppointmentStatusDisplayMatrix>;
  isLoaded: boolean;
  isLoading: boolean;

  fetchMatrix: () => Promise<void>;
  setRows: (rows: CalendarStatusDisplayRow[]) => void;
}

function buildFromRows(rows: CalendarStatusDisplayRow[]): {
  general: AppointmentStatusDisplayMatrix;
  byCalendar: Record<string, AppointmentStatusDisplayMatrix>;
} {
  const generalRows = rows.filter((row) => row.calendar_id === null);
  const general = mergeStatusMatrix(DEFAULT_STATUS_DISPLAY, generalRows);

  const overrideCalendarIds = Array.from(
    new Set(rows.filter((row) => row.calendar_id !== null).map((row) => row.calendar_id as string)),
  );
  const byCalendar: Record<string, AppointmentStatusDisplayMatrix> = {};
  for (const calendarId of overrideCalendarIds) {
    const calendarRows = rows.filter((row) => row.calendar_id === calendarId);
    byCalendar[calendarId] = mergeStatusMatrix(general, calendarRows);
  }

  return { general, byCalendar };
}

export const useCalendarStatusDisplayStore = create<CalendarStatusDisplayStore>((set, get) => ({
  general: DEFAULT_STATUS_DISPLAY,
  byCalendar: {},
  isLoaded: false,
  isLoading: false,

  fetchMatrix: async () => {
    if (get().isLoading) return;
    set({ isLoading: true });
    try {
      const rows = await fetchStatusDisplayRows();
      set({ ...buildFromRows(rows), isLoaded: true });
    } catch (error) {
      // Sin matriz el calendario sigue viéndose como hoy (defaults compilados),
      // así que un fallo de red no debe bloquear nada.
      console.error('Failed to load the calendar status display matrix:', error);
      set({ general: DEFAULT_STATUS_DISPLAY, byCalendar: {}, isLoaded: true });
    } finally {
      set({ isLoading: false });
    }
  },

  setRows: (rows) => set({ ...buildFromRows(rows), isLoaded: true }),
}));
