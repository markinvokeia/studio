import { CalendarSettings } from '@/lib/types';
import api from '@/services/api';
import { API_ROUTES } from '@/constants/routes';
import { CALENDAR_MODES, DEFAULT_CALENDAR_MODE, DEFAULT_COLOR_BY_STATUS, DEFAULT_EVENT_LABEL_FORMAT, DEFAULT_SLOT_DURATION, DEFAULT_VISIBLE_HOURS_MODE, EVENT_LABEL_FORMATS, HOUR_SLOT_HEIGHT, SLOT_DURATION_OPTIONS, VISIBLE_HOURS_MODES } from './calendar-constants';

export const DEFAULT_CALENDAR_SETTINGS: CalendarSettings = {
  default_view: 'week',
  grouped_by: 'none',
  check_availability: false,
  filter_doctors_by_service: false,
  block_unavailable: true,
  hour_height: HOUR_SLOT_HEIGHT,
  slot_duration: DEFAULT_SLOT_DURATION,
  event_label_format: DEFAULT_EVENT_LABEL_FORMAT,
  default_sede: '',
  inline_draft_live_preview: false,
  color_by_status: DEFAULT_COLOR_BY_STATUS,
  mode: DEFAULT_CALENDAR_MODE,
  hidden_weekdays: [],
  visible_hours_mode: DEFAULT_VISIBLE_HOURS_MODE,
  visible_hours_start: null,
  visible_hours_end: null,
};

const normalizeBoolean = (value: unknown, defaultValue: boolean): boolean => {
  if (value === undefined || value === null) {
    return defaultValue;
  }

  return value === true || value === 'true' || value === 1;
};

/** Normaliza `hidden_weekdays`: puede llegar como array, como string JSON
 *  ("[0,6]") o como string separado por comas ("0,6") según cómo lo devuelva
 *  la API. Se descartan valores fuera de 0-6 y duplicados, y si terminan
 *  cubriendo los 7 días se ignora por completo (ocultaría toda la grilla). */
const normalizeHiddenWeekdays = (value: unknown): number[] => {
  let list: unknown[];

  if (Array.isArray(value)) {
    list = value;
  } else if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      list = Array.isArray(parsed) ? parsed : value.split(',');
    } catch {
      list = value.split(',');
    }
  } else {
    return [];
  }

  const days = Array.from(
    new Set(
      list
        .map((v) => Number(v))
        .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
    )
  ).sort((a, b) => a - b);

  return days.length >= 7 ? [] : days;
};

/** "HH:mm" (00:00–24:00) a minutos desde medianoche; null si no es una hora válida.
 *  Acepta lo que devuelve Postgres para `time` ("09:00:00"). */
export const visibleHourToMinutes = (value: unknown): number | null => {
  if (typeof value !== 'string') return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!match) return null;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return Number(match[2]) < 60 && minutes >= 0 && minutes <= 24 * 60 ? minutes : null;
};

/** Minutos desde medianoche a "HH:mm" (1440 => "24:00"). */
export const minutesToVisibleHour = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

const normalizeVisibleHour = (value: unknown): string | null => {
  const minutes = visibleHourToMinutes(value);
  return minutes === null ? null : minutesToVisibleHour(minutes);
};

/** Claves que identifican una fila de calendar_settings. Sirven para distinguir la
 *  fila real del envoltorio de la respuesta ({data: …}, {result: …}, …), que hasta
 *  ahora se tomaba como si fuera la fila: al no tener ninguna de estas claves,
 *  todos los campos caían al default y el `id` quedaba sin definir (de ahí que las
 *  preferencias guardadas no se cargaran y cada guardado creara una fila nueva). */
const CALENDAR_SETTINGS_ROW_KEYS = [
  'default_view',
  'grouped_by',
  'check_availability',
  'filter_doctors_by_service',
  'block_unavailable',
  'hour_height',
  'slot_duration',
  'event_label_format',
  'default_sede',
  'inline_appointment_creation',
  'inline_draft_live_preview',
  'color_by_status',
  'mode',
  'hidden_weekdays',
  'visible_hours_mode',
  'user_id',
] as const;

const isCalendarSettingsRow = (value: Record<string, unknown>): boolean =>
  CALENDAR_SETTINGS_ROW_KEYS.some((key) => key in value);

/** Desenvuelve la fila de settings de las formas en que la devuelve la API:
 *  `row`, `[row]`, `{data: row}`, `{data: [row]}`, `[{data: [row]}]`… */
const unwrapCalendarSettingsRow = (data: unknown): Record<string, unknown> | null => {
  let current: unknown = data;

  for (let depth = 0; depth < 4; depth += 1) {
    if (Array.isArray(current)) {
      current = current[0];
      continue;
    }
    if (!current || typeof current !== 'object') return null;

    const holder = current as Record<string, unknown>;
    if (isCalendarSettingsRow(holder)) return holder;

    const inner = holder.data ?? holder.result ?? holder.calendar_settings;
    if (inner === undefined) return null;
    current = inner;
  }

  return null;
};

export const normalizeCalendarSettings = (data: unknown): CalendarSettings | null => {
  const settingsData = unwrapCalendarSettingsRow(data);

  if (!settingsData || Object.keys(settingsData).length === 0) {
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
    inline_draft_live_preview: normalizeBoolean(
      (rawSettings as { inline_draft_live_preview?: unknown }).inline_draft_live_preview,
      false,
    ),
    // Ausente (usuario sin la preferencia guardada todavía) => queda activa.
    color_by_status: normalizeBoolean(
      (rawSettings as { color_by_status?: unknown }).color_by_status,
      DEFAULT_CALENDAR_SETTINGS.color_by_status ?? DEFAULT_COLOR_BY_STATUS,
    ),
    mode:
      typeof rawSettings.mode === 'string' && (CALENDAR_MODES as readonly string[]).includes(rawSettings.mode)
        ? rawSettings.mode
        : DEFAULT_CALENDAR_SETTINGS.mode,
    hidden_weekdays: normalizeHiddenWeekdays((rawSettings as { hidden_weekdays?: unknown }).hidden_weekdays),
    visible_hours_mode:
      typeof rawSettings.visible_hours_mode === 'string' && (VISIBLE_HOURS_MODES as readonly string[]).includes(rawSettings.visible_hours_mode)
        ? rawSettings.visible_hours_mode
        : DEFAULT_CALENDAR_SETTINGS.visible_hours_mode,
    visible_hours_start: normalizeVisibleHour(rawSettings.visible_hours_start),
    visible_hours_end: normalizeVisibleHour(rawSettings.visible_hours_end),
  };
};

export async function getCalendarSettings(): Promise<CalendarSettings> {
  try {
    const data = await api.get(API_ROUTES.CALENDAR_SETTINGS_SEARCH);
    const existingSettings = normalizeCalendarSettings(data);
    // Don't upsert defaults just because none exist yet — only persist once
    // the user actually changes an option, to avoid duplicate-create races.
    return existingSettings ?? DEFAULT_CALENDAR_SETTINGS;
  } catch (error) {
    console.error('Failed to fetch calendar settings:', error);
    return DEFAULT_CALENDAR_SETTINGS;
  }
}
