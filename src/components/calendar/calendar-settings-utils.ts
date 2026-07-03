import { CalendarSettings } from '@/lib/types';
import api from '@/services/api';
import { API_ROUTES } from '@/constants/routes';
import { CALENDAR_MODES, DEFAULT_CALENDAR_MODE, DEFAULT_EVENT_LABEL_FORMAT, DEFAULT_SLOT_DURATION, EVENT_LABEL_FORMATS, HOUR_SLOT_HEIGHT, SLOT_DURATION_OPTIONS } from './calendar-constants';

export const DEFAULT_CALENDAR_SETTINGS: CalendarSettings = {
  default_view: 'month',
  grouped_by: 'none',
  check_availability: false,
  filter_doctors_by_service: false,
  block_unavailable: false,
  hour_height: HOUR_SLOT_HEIGHT,
  slot_duration: DEFAULT_SLOT_DURATION,
  event_label_format: DEFAULT_EVENT_LABEL_FORMAT,
  default_sede: '',
  mode: DEFAULT_CALENDAR_MODE,
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
    hour_height?: unknown;
  };

  const parsedHourHeight = Number(rawSettings.hour_height);
  const parsedSlotDuration = Number((rawSettings as { slot_duration?: unknown }).slot_duration);

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
    block_unavailable: normalizeBoolean(
      (rawSettings as { block_unavailable?: unknown }).block_unavailable,
      DEFAULT_CALENDAR_SETTINGS.block_unavailable ?? false
    ),
    hour_height: Number.isFinite(parsedHourHeight) && parsedHourHeight > 0 ? parsedHourHeight : DEFAULT_CALENDAR_SETTINGS.hour_height,
    slot_duration: (SLOT_DURATION_OPTIONS as readonly number[]).includes(parsedSlotDuration) ? parsedSlotDuration : DEFAULT_CALENDAR_SETTINGS.slot_duration,
    event_label_format:
      typeof rawSettings.event_label_format === 'string' &&
      (EVENT_LABEL_FORMATS as readonly string[]).includes(rawSettings.event_label_format)
        ? rawSettings.event_label_format
        : DEFAULT_CALENDAR_SETTINGS.event_label_format,
    default_sede: typeof rawSettings.default_sede === 'string' ? rawSettings.default_sede : DEFAULT_CALENDAR_SETTINGS.default_sede,
    mode:
      typeof rawSettings.mode === 'string' && (CALENDAR_MODES as readonly string[]).includes(rawSettings.mode)
        ? rawSettings.mode
        : DEFAULT_CALENDAR_SETTINGS.mode,
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
