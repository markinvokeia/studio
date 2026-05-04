import { CalendarSettings } from '@/lib/types';

export const DEFAULT_CALENDAR_SETTINGS: CalendarSettings = {
  default_view: 'month',
  grouped_by: 'none',
  check_availability: true,
};

const normalizeCheckAvailability = (value: unknown): boolean => {
  if (value === undefined || value === null) {
    return DEFAULT_CALENDAR_SETTINGS.check_availability;
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
  };

  return {
    ...DEFAULT_CALENDAR_SETTINGS,
    ...rawSettings,
    default_view: typeof rawSettings.default_view === 'string' ? rawSettings.default_view : DEFAULT_CALENDAR_SETTINGS.default_view,
    grouped_by: typeof rawSettings.grouped_by === 'string' ? rawSettings.grouped_by : DEFAULT_CALENDAR_SETTINGS.grouped_by,
    check_availability: normalizeCheckAvailability(rawSettings.check_availability),
  };
};
