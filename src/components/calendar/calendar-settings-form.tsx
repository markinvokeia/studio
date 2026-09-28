'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  AlertTriangle,
  Ban,
  Building2,
  CalendarCheck,
  CalendarDays,
  CalendarOff,
  Clock,
  HelpCircle,
  Layers,
  LayoutGrid,
  MousePointerClick,
  Palette,
  Ruler,
  Stethoscope,
  Tag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useAsyncAction } from '@/hooks/use-async-action';
import { getErrorMessage } from '@/lib/error-utils';
import { cn } from '@/lib/utils';
import { CalendarSettings, Sede } from '@/lib/types';
import api, { isAbortError, REQUEST_TIMEOUT_MS } from '@/services/api';
import { API_ROUTES } from '@/constants/routes';
import { CALENDAR_MODES, DEFAULT_CALENDAR_MODE, DEFAULT_COLOR_BY_STATUS, DEFAULT_EVENT_LABEL_FORMAT, DEFAULT_SLOT_DURATION, EVENT_LABEL_FORMATS, HOUR_SLOT_HEIGHT, HOUR_SLOT_HEIGHT_OPTIONS, SLOT_DURATION_OPTIONS } from './calendar-constants';
import { DEFAULT_CALENDAR_SETTINGS, normalizeCalendarSettings } from './calendar-settings-utils';

interface CalendarSettingsFormProps {
  onSettingsChange?: (settings: CalendarSettings) => void;
  className?: string;
  showTitle?: boolean;
  /** Branches available to pick as the default calendar scope. */
  sedes?: Sede[];
  /** When provided, the parent owns the settings: the form uses this value and
   *  does NOT fetch on mount (prevents reloads from clobbering live toggles). */
  value?: CalendarSettings;
  /** When provided, reads/writes this user's calendar settings instead of the
   *  logged-in user's (falls back to the JWT-derived user server-side when omitted). */
  userId?: string;
}

const ALL_SEDES_VALUE = '__all__';

/** Label row with a representative icon and a clickable "?" help hint. */
function SettingHeader({
  icon: Icon,
  label,
  help,
  htmlFor,
  variant = 'field',
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  help: string;
  htmlFor?: string;
  variant?: 'field' | 'toggle';
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <Label
        htmlFor={htmlFor}
        className={
          variant === 'field'
            ? 'text-[10px] font-bold uppercase tracking-widest text-muted-foreground'
            : 'cursor-pointer text-xs font-medium'
        }
      >
        {label}
      </Label>
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className="text-muted-foreground/60 transition-colors hover:text-foreground" aria-label={`${label} ?`}>
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent side="left" align="start" className="w-64 text-xs leading-relaxed text-muted-foreground">
          {help}
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function CalendarSettingsForm({ onSettingsChange, className, showTitle = false, sedes = [], value, userId }: CalendarSettingsFormProps) {
  const t = useTranslations('AppointmentsPage.settings');
  const tCommon = useTranslations('Common');
  const controlled = value !== undefined;
  const [settings, setSettings] = React.useState<CalendarSettings>(value ?? DEFAULT_CALENDAR_SETTINGS);
  const [isLoading, setIsLoading] = React.useState(!controlled);
  // With a failed load the form shows defaults; editing them would upsert those defaults over the
  // user's real settings, so the controls stay locked until a retry succeeds.
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = React.useState(0);

  // Keep the local copy in sync with the parent-owned value (controlled mode).
  React.useEffect(() => {
    if (value !== undefined) setSettings(value);
  }, [value]);

  React.useEffect(() => {
    // When the parent supplies the settings, don't fetch (avoids overwriting a
    // freshly-toggled preference whenever this form remounts).
    if (controlled) return;
    let isMounted = true;
    const controller = new AbortController();
    setIsLoading(true);
    setLoadError(null);

    const loadSettings = async () => {
      try {
        const data = await api.get(API_ROUTES.CALENDAR_SETTINGS_SEARCH, userId ? { user_id: userId } : undefined, undefined, { signal: controller.signal });
        const existingSettings = normalizeCalendarSettings(data);
        // Use defaults locally when the user has no saved settings yet — don't
        // upsert them until the user actually changes an option (avoids a
        // duplicate-create race when this form mounts more than once, e.g.
        // switching the selected doctor).
        const nextSettings = existingSettings ?? DEFAULT_CALENDAR_SETTINGS;

        if (!isMounted) {
          return;
        }

        setSettings(nextSettings);
        onSettingsChange?.(nextSettings);
      } catch (error) {
        if (isMounted && !isAbortError(error)) setLoadError(getErrorMessage(error) || tCommon('loadError'));
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadSettings();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [onSettingsChange, controlled, userId, loadAttempt, tCommon]);

  const persistSettings = async (newSettings: CalendarSettings, updates: Partial<CalendarSettings>) => {
    // Sin `id` no sabemos si el usuario ya tiene preferencias guardadas y el
    // upsert crearía una fila nueva en cada cambio. Se consulta primero el
    // search: si ya existe, se reutiliza su id para actualizarla.
    let payload = newSettings;
    if (!payload.id) {
      const existing = normalizeCalendarSettings(
        await api.get(API_ROUTES.CALENDAR_SETTINGS_SEARCH, userId ? { user_id: userId } : undefined),
      );
      if (existing?.id) {
        payload = { ...existing, ...newSettings, id: existing.id };
        setSettings(payload);
        onSettingsChange?.(payload);
      }
    }

    const response = await api.post(API_ROUTES.CALENDAR_SETTINGS_UPSERT, userId ? { ...payload, user_id: userId } : payload, undefined, undefined, { timeoutMs: REQUEST_TIMEOUT_MS.mutation });
    // The upsert response carries back the record's `id` (needed so the next
    // save updates the existing row instead of leaving the id unset). Merge
    // it into local + parent state rather than requiring a page reload.
    // Se le pasa la respuesta entera: normalizeCalendarSettings ya desenvuelve
    // {data: …} y las demás formas en que la API devuelve la fila.
    const saved = normalizeCalendarSettings(response);
    if (saved) {
      // `updates` gana sobre lo que devuelve el servidor: si el backend todavía no
      // conoce una clave, la fila que devuelve viene sin ella y al normalizarla
      // vuelve a su default, deshaciendo en el acto lo que el usuario acaba de
      // tocar (era el caso de `color_by_status`).
      const merged = { ...saved, ...updates };
      setSettings(merged);
      onSettingsChange?.(merged);
    }
  };

  // One save at a time: concurrent upserts without `id` would each create a row. The change is
  // applied optimistically and rolled back if the save fails.
  const save = useAsyncAction(
    async (updates: Partial<CalendarSettings>) => {
      const previous = settings;
      const newSettings = { ...settings, ...updates };
      setSettings(newSettings);
      onSettingsChange?.(newSettings);

      try {
        await persistSettings(newSettings, updates);
      } catch (error) {
        setSettings(previous);
        onSettingsChange?.(previous);
        throw error;
      }
    },
    { errorTitle: tCommon('errorTitle') }
  );

  const updateSettings = (updates: Partial<CalendarSettings>) => {
    if (loadError) return;
    save.run(updates);
  };

  const isLocked = isLoading || !!loadError || save.isPending;

  const updateHourHeight = (value: number) => {
    updateSettings({ hour_height: value });
  };

  // La altura de hora se reparte entre los slots que entran en una hora, así que el
  // mismo valor rinde muy distinto con slots de 10 min que de 30. Se muestra el px
  // por slot resultante para que las dos preferencias se elijan juntas.
  const slotsPerHour = Math.max(1, Math.round(60 / (settings.slot_duration ?? DEFAULT_SLOT_DURATION)));
  const hourHeightOptionLabel = (px: number) =>
    t('hourHeightOptionWithSlot', { px, slotPx: Math.round(px / slotsPerHour) });

  const viewOptions = ['day', '2_days', '3_days', 'week', 'month', 'agenda'];
  const groupOptions = ['none', 'doctor', 'calendar'];
  // 0=domingo…6=sábado, igual que ClinicSchedule.day_of_week.
  const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];
  const hiddenWeekdays = settings.hidden_weekdays ?? [];
  const toggleHiddenWeekday = (day: number) => {
    const next = hiddenWeekdays.includes(day)
      ? hiddenWeekdays.filter((d) => d !== day)
      : [...hiddenWeekdays, day];
    // No tiene sentido ocultar los 7 días: se dejaría la grilla sin columnas.
    if (next.length >= 7) return;
    updateSettings({ hidden_weekdays: next });
  };
  // Custom mode forces calendar grouping (one agenda at a time) and the default
  // event label, so only those selectors are hidden. Sede remains configurable.
  const isCustomMode = (settings.mode ?? DEFAULT_CALENDAR_MODE) === 'custom';

  return (
    <div className={className} aria-busy={save.isPending || undefined}>
      {showTitle && (
        <div className="flex items-center gap-2 pb-2 mb-4 border-b border-border/50">
          <h4 className="font-semibold text-sm tracking-tight">{t('title')}</h4>
        </div>
      )}

      {loadError && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-destructive" role="alert">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>{tCommon('loadError')}</span>
          <Button type="button" size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => setLoadAttempt((n) => n + 1)}>
            {tCommon('retry')}
          </Button>
        </div>
      )}

      <div className="bg-muted/30 p-2.5 rounded-xl border border-border/40 space-y-3.5">
        <div className="space-y-1.5">
          <SettingHeader icon={LayoutGrid} label={t('mode')} help={t('help.mode')} htmlFor="calendar-mode" />
          <Select
            value={settings.mode ?? DEFAULT_CALENDAR_MODE}
            onValueChange={(val) => updateSettings({ mode: val })}
            disabled={isLocked}
          >
            <SelectTrigger id="calendar-mode" className="h-9 text-xs bg-card border-border/50 shadow-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CALENDAR_MODES.map((opt) => (
                <SelectItem key={opt} value={opt} className="text-xs">
                  {t(`modeOptions.${opt}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <SettingHeader icon={CalendarDays} label={t('defaultView')} help={t('help.defaultView')} htmlFor="default-view" />
          <Select
            value={settings.default_view}
            onValueChange={(val) => updateSettings({ default_view: val })}
            disabled={isLocked}
          >
            <SelectTrigger id="default-view" className="h-9 text-xs bg-card border-border/50 shadow-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {viewOptions.map(opt => (
                <SelectItem key={opt} value={opt} className="text-xs">
                  {t(`options.${opt}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!isCustomMode && (
          <div className="space-y-1.5">
            <SettingHeader icon={Layers} label={t('groupBy')} help={t('help.groupBy')} htmlFor="grouped-by" />
            <Select
              value={settings.grouped_by}
              onValueChange={(val) => updateSettings({ grouped_by: val })}
              disabled={isLocked}
            >
              <SelectTrigger id="grouped-by" className="h-9 text-xs bg-card border-border/50 shadow-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {groupOptions.map(opt => (
                  <SelectItem key={opt} value={opt} className="text-xs">
                    {t(`options.${opt}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-1.5">
          <SettingHeader icon={Ruler} label={t('hourHeight')} help={t('help.hourHeight')} htmlFor="hour-height" />
          <Select
            value={String(settings.hour_height ?? HOUR_SLOT_HEIGHT)}
            onValueChange={(val) => updateHourHeight(Number(val))}
            disabled={isLocked}
          >
            <SelectTrigger id="hour-height" className="h-9 text-xs bg-card border-border/50 shadow-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HOUR_SLOT_HEIGHT_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={String(opt)} className="text-xs">
                  {hourHeightOptionLabel(opt)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <SettingHeader icon={Clock} label={t('slotDuration')} help={t('help.slotDuration')} htmlFor="slot-duration" />
          <Select
            value={String(settings.slot_duration ?? DEFAULT_SLOT_DURATION)}
            onValueChange={(val) => updateSettings({ slot_duration: Number(val) })}
            disabled={isLocked}
          >
            <SelectTrigger id="slot-duration" className="h-9 text-xs bg-card border-border/50 shadow-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SLOT_DURATION_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={String(opt)} className="text-xs">
                  {opt >= 60 ? t('slotDurationHour') : t('slotDurationOption', { min: opt })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {sedes.length > 0 && (
          <div className="space-y-1.5">
            <SettingHeader icon={Building2} label={t('sede')} help={t('help.sede')} htmlFor="default-sede" />
            <Select
              value={settings.default_sede ? settings.default_sede : ALL_SEDES_VALUE}
              onValueChange={(val) => updateSettings({ default_sede: val === ALL_SEDES_VALUE ? '' : val })}
              disabled={isLocked}
            >
              <SelectTrigger id="default-sede" className="h-9 text-xs bg-card border-border/50 shadow-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_SEDES_VALUE} className="text-xs">{t('allSedes')}</SelectItem>
                {sedes.map((sede) => (
                  <SelectItem key={sede.id} value={sede.id} className="text-xs">
                    {sede.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* El formato de la etiqueta aplica también en modo custom: las cards de esa
            vista se pintan con el mismo `event.label` que las del modo normal. */}
        <div className="space-y-1.5">
          <SettingHeader icon={Tag} label={t('eventLabel')} help={t('help.eventLabel')} htmlFor="event-label-format" />
          <Select
            value={settings.event_label_format ?? DEFAULT_EVENT_LABEL_FORMAT}
            onValueChange={(val) => updateSettings({ event_label_format: val })}
            disabled={isLocked}
          >
            <SelectTrigger id="event-label-format" className="h-9 text-xs bg-card border-border/50 shadow-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EVENT_LABEL_FORMATS.map((opt) => (
                <SelectItem key={opt} value={opt} className="text-xs">
                  {t(`eventLabelOptions.${opt}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <SettingHeader icon={CalendarOff} label={t('hiddenWeekdays')} help={t('help.hiddenWeekdays')} />
          <div className="flex gap-1">
            {WEEKDAYS.map((day) => (
              <button
                key={day}
                type="button"
                aria-pressed={hiddenWeekdays.includes(day)}
                disabled={isLocked}
                onClick={() => toggleHiddenWeekday(day)}
                className={cn(
                  'h-7 w-7 shrink-0 rounded-md border text-[10px] font-semibold uppercase transition-colors',
                  hiddenWeekdays.includes(day)
                    ? 'border-primary/40 bg-primary/10 text-muted-foreground line-through'
                    : 'border-border/50 bg-card text-foreground hover:bg-muted',
                )}
              >
                {t(`weekdayAbbr.${day}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 px-1">
        <SettingHeader icon={Palette} label={t('colorByStatus')} help={t('help.colorByStatus')} htmlFor="color-by-status" variant="toggle" />
        <Switch
          id="color-by-status"
          checked={settings.color_by_status ?? DEFAULT_COLOR_BY_STATUS}
          onCheckedChange={(checked) => updateSettings({ color_by_status: checked })}
          disabled={isLocked}
          className="scale-90"
        />
      </div>

      <div className="flex items-center justify-between pt-4 px-1">
        <SettingHeader icon={CalendarCheck} label={t('checkAvailability')} help={t('help.checkAvailability')} htmlFor="check-availability" variant="toggle" />
        <Switch
          id="check-availability"
          checked={settings.check_availability}
          onCheckedChange={(checked) => updateSettings({ check_availability: checked })}
          disabled={isLocked}
          className="scale-90"
        />
      </div>

      <div className="flex items-center justify-between pt-4 px-1">
        <SettingHeader icon={Ban} label={t('blockUnavailable')} help={t('help.blockUnavailable')} htmlFor="block-unavailable" variant="toggle" />
        <Switch
          id="block-unavailable"
          checked={settings.block_unavailable ?? false}
          onCheckedChange={(checked) => updateSettings({ block_unavailable: checked })}
          disabled={isLocked}
          className="scale-90"
        />
      </div>

      <div className="flex items-center justify-between pt-4 px-1">
        <SettingHeader icon={Stethoscope} label={t('filterDoctorsByService')} help={t('help.filterDoctorsByService')} htmlFor="filter-doctors-by-service" variant="toggle" />
        <Switch
          id="filter-doctors-by-service"
          checked={settings.filter_doctors_by_service}
          onCheckedChange={(checked) => updateSettings({ filter_doctors_by_service: checked })}
          disabled={isLocked}
          className="scale-90"
        />
      </div>

      <div className="flex items-center justify-between pt-4 px-1">
        <SettingHeader icon={MousePointerClick} label={t('inlineAppointmentCreation')} help={t('help.inlineAppointmentCreation')} htmlFor="inline-appointment-creation" variant="toggle" />
        <Switch
          id="inline-appointment-creation"
          checked={settings.inline_appointment_creation ?? false}
          onCheckedChange={(checked) => updateSettings({ inline_appointment_creation: checked })}
          disabled={isLocked}
          className="scale-90"
        />
      </div>
    </div>
  );
}
