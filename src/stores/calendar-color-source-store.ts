import { create } from 'zustand';

import { DEFAULT_COLOR_SETTINGS } from '@/lib/appointment-color';
import type { CalendarColorSettings, CalendarColorSourceRow } from '@/lib/types';
import { fetchColorSourceRows } from '@/services/calendar-color-source';

/**
 * Qué niveles de la cadena de color cuentan al pintar una cita, cargado una
 * sola vez tras el login por `ClinicPreferencesInitializer`. Mismo patrón que
 * `calendar-status-display-store`.
 *
 * Mientras `isLoaded` es false se sirve `DEFAULT_COLOR_SOURCES` (todos los
 * niveles activos): el calendario nunca queda sin color esperando la red.
 */
interface CalendarColorSourceStore {
  general: CalendarColorSettings;
  byCalendar: Record<string, CalendarColorSettings>;
  isLoaded: boolean;
  isLoading: boolean;

  fetchSources: () => Promise<void>;
  setRows: (rows: CalendarColorSourceRow[]) => void;
}

const pickSources = (row: CalendarColorSettings): CalendarColorSettings => ({
  service: row.service,
  doctor: row.doctor,
  calendar: row.calendar,
  highlight: row.highlight,
});

function buildFromRows(rows: CalendarColorSourceRow[]): Pick<CalendarColorSourceStore, 'general' | 'byCalendar'> {
  const generalRow = rows.find((row) => row.calendar_id === null);
  const byCalendar: Record<string, CalendarColorSettings> = {};
  for (const row of rows) {
    if (row.calendar_id !== null) byCalendar[row.calendar_id] = pickSources(row);
  }
  return { general: generalRow ? pickSources(generalRow) : DEFAULT_COLOR_SETTINGS, byCalendar };
}

/** Override del calendario si existe; si no, la configuración general. */
export function resolveColorSources(
  general: CalendarColorSettings,
  byCalendar: Record<string, CalendarColorSettings>,
  calendarId?: string | null,
): CalendarColorSettings {
  return (calendarId && byCalendar[calendarId]) || general;
}

export const useCalendarColorSourceStore = create<CalendarColorSourceStore>((set, get) => ({
  general: DEFAULT_COLOR_SETTINGS,
  byCalendar: {},
  isLoaded: false,
  isLoading: false,

  fetchSources: async () => {
    if (get().isLoading) return;
    set({ isLoading: true });
    try {
      const rows = await fetchColorSourceRows();
      set({ ...buildFromRows(rows), isLoaded: true });
    } catch (error) {
      // Sin configuración el calendario sigue viéndose como hoy (todos los niveles activos).
      console.error('Failed to load the calendar color source settings:', error);
      set({ general: DEFAULT_COLOR_SETTINGS, byCalendar: {}, isLoaded: true });
    } finally {
      set({ isLoading: false });
    }
  },

  setRows: (rows) => set({ ...buildFromRows(rows), isLoaded: true }),
}));
