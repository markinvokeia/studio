import { CalendarSettings } from '@/lib/types';
import api from '@/services/api';
import { API_ROUTES } from '@/constants/routes';

export const DEFAULT_CALENDAR_SETTINGS: CalendarSettings = {
  default_view: 'month',
  grouped_by: 'none',
  check_availability: false,
  filter_doctors_by_service: false,
};

const normalizeBoolean = (value: unknown, defaultValue: boolean): boolean => {
  if (value === undefined || value === null) {
    return defaultValue;
  }

  return value === true || value === 'true' || value === 1;
};

export const normalizeCalendarSettings = (data: unknown): CalendarSettings | null => {
  const settingsData = Array.isArray(data) ? data[0] : data;

  if (
    !settingsData ||
    Array.isArray(settingsData) ||
    typeof settingsData !== 'object' ||
    Object.keys(settingsData).length === 0
  ) {
    return null;
  }

  const rawSettings = settingsData as Partial<CalendarSettings> & {
    check_availability?: unknown;
    filter_doctors_by_service?: unknown;
  };

  return {
    ...DEFAULT_CALENDAR_SETTINGS,
    ...rawSettings,
    default_view: typeof rawSettings.default_view === 'string' ? rawSettings.default_view : DEFAULT_CALENDAR_SETTINGS.default_view,
    grouped_by: typeof rawSettings.grouped_by === 'string' ? rawSettings.grouped_by : DEFAULT_CALENDAR_SETTINGS.grouped_by,
    check_availability: normalizeBoolean(rawSettings.check_availability, DEFAULT_CALENDAR_SETTINGS.check_availability),
    filter_doctors_by_service: normalizeBoolean(
      rawSettings.filter_doctors_by_service,
      DEFAULT_CALENDAR_SETTINGS.filter_doctors_by_service
    ),
  };
};

export async function getCalendarSettings(): Promise<CalendarSettings> {
  try {
    const data = await api.get(API_ROUTES.CALENDAR_SETTINGS_SEARCH);
    const existingSettings = normalizeCalendarSettings(data);
    const nextSettings = existingSettings ?? DEFAULT_CALENDAR_SETTINGS;

    if (!existingSettings) {
      await api.post(API_ROUTES.CALENDAR_SETTINGS_UPSERT, nextSettings);
    }

    return nextSettings;
  } catch (error) {
    console.error('Failed to fetch calendar settings:', error);
    return DEFAULT_CALENDAR_SETTINGS;
  }
}
