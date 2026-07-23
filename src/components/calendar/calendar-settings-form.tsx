'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  Ban,
  Building2,
  CalendarCheck,
  CalendarDays,
  Clock,
  HelpCircle,
  Layers,
  LayoutGrid,
  MousePointerClick,
  Ruler,
  Stethoscope,
  Tag,
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { CalendarSettings, Sede } from '@/lib/types';
import api from '@/services/api';
import { API_ROUTES } from '@/constants/routes';
import { CALENDAR_MODES, DEFAULT_CALENDAR_MODE, DEFAULT_EVENT_LABEL_FORMAT, DEFAULT_SLOT_DURATION, EVENT_LABEL_FORMATS, HOUR_SLOT_HEIGHT, HOUR_SLOT_HEIGHT_OPTIONS, SLOT_DURATION_OPTIONS } from './calendar-constants';
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
  const controlled = value !== undefined;
  const [settings, setSettings] = React.useState<CalendarSettings>(value ?? DEFAULT_CALENDAR_SETTINGS);
  const [isLoading, setIsLoading] = React.useState(!controlled);

  // Keep the local copy in sync with the parent-owned value (controlled mode).
  React.useEffect(() => {
    if (value !== undefined) setSettings(value);
  }, [value]);

  React.useEffect(() => {
    // When the parent supplies the settings, don't fetch (avoids overwriting a
    // freshly-toggled preference whenever this form remounts).
    if (controlled) return;
    let isMounted = true;

    const loadSettings = async () => {
      try {
        const data = await api.get(API_ROUTES.CALENDAR_SETTINGS_SEARCH, userId ? { user_id: userId } : undefined);
        const existingSettings = normalizeCalendarSettings(data);
        const nextSettings = existingSettings ?? DEFAULT_CALENDAR_SETTINGS;

        if (!existingSettings) {
          await api.post(API_ROUTES.CALENDAR_SETTINGS_UPSERT, userId ? { ...nextSettings, user_id: userId } : nextSettings);
        }

        if (!isMounted) {
          return;
        }

        setSettings(nextSettings);
        onSettingsChange?.(nextSettings);
      } catch (error) {
        console.error('Failed to load calendar settings:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadSettings();

    return () => {
      isMounted = false;
    };
  }, [onSettingsChange, controlled, userId]);

  const updateSettings = async (updates: Partial<CalendarSettings>) => {
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    onSettingsChange?.(newSettings);

    try {
      await api.post(API_ROUTES.CALENDAR_SETTINGS_UPSERT, userId ? { ...newSettings, user_id: userId } : newSettings);
    } catch (error) {
      console.error('Failed to save calendar settings:', error);
    }
  };

  const updateHourHeight = (value: number) => {
    updateSettings({ hour_height: value });
  };

  const viewOptions = ['day', '2_days', '3_days', 'week', 'month', 'agenda'];
  const groupOptions = ['none', 'doctor', 'calendar'];
  // Custom mode forces calendar grouping (one agenda at a time) and the default
  // event label, so only those selectors are hidden. Sede remains configurable.
  const isCustomMode = (settings.mode ?? DEFAULT_CALENDAR_MODE) === 'custom';

  return (
    <div className={className}>
      {showTitle && (
        <div className="flex items-center gap-2 pb-2 mb-4 border-b border-border/50">
          <h4 className="font-semibold text-sm tracking-tight">{t('title')}</h4>
        </div>
      )}

      <div className="bg-muted/30 p-2.5 rounded-xl border border-border/40 space-y-3.5">
        <div className="space-y-1.5">
          <SettingHeader icon={LayoutGrid} label={t('mode')} help={t('help.mode')} htmlFor="calendar-mode" />
          <Select
            value={settings.mode ?? DEFAULT_CALENDAR_MODE}
            onValueChange={(val) => updateSettings({ mode: val })}
            disabled={isLoading}
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
            disabled={isLoading}
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
              disabled={isLoading}
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
            disabled={isLoading}
          >
            <SelectTrigger id="hour-height" className="h-9 text-xs bg-card border-border/50 shadow-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HOUR_SLOT_HEIGHT_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={String(opt)} className="text-xs">
                  {t('hourHeightOption', { px: opt })}
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
            disabled={isLoading}
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
              disabled={isLoading}
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

        {!isCustomMode && (
          <div className="space-y-1.5">
            <SettingHeader icon={Tag} label={t('eventLabel')} help={t('help.eventLabel')} htmlFor="event-label-format" />
            <Select
              value={settings.event_label_format ?? DEFAULT_EVENT_LABEL_FORMAT}
              onValueChange={(val) => updateSettings({ event_label_format: val })}
              disabled={isLoading}
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
        )}
      </div>

      <div className="flex items-center justify-between pt-4 px-1">
        <SettingHeader icon={CalendarCheck} label={t('checkAvailability')} help={t('help.checkAvailability')} htmlFor="check-availability" variant="toggle" />
        <Switch
          id="check-availability"
          checked={settings.check_availability}
          onCheckedChange={(checked) => updateSettings({ check_availability: checked })}
          disabled={isLoading}
          className="scale-90"
        />
      </div>

      <div className="flex items-center justify-between pt-4 px-1">
        <SettingHeader icon={Ban} label={t('blockUnavailable')} help={t('help.blockUnavailable')} htmlFor="block-unavailable" variant="toggle" />
        <Switch
          id="block-unavailable"
          checked={settings.block_unavailable ?? false}
          onCheckedChange={(checked) => updateSettings({ block_unavailable: checked })}
          disabled={isLoading}
          className="scale-90"
        />
      </div>

      <div className="flex items-center justify-between pt-4 px-1">
        <SettingHeader icon={Stethoscope} label={t('filterDoctorsByService')} help={t('help.filterDoctorsByService')} htmlFor="filter-doctors-by-service" variant="toggle" />
        <Switch
          id="filter-doctors-by-service"
          checked={settings.filter_doctors_by_service}
          onCheckedChange={(checked) => updateSettings({ filter_doctors_by_service: checked })}
          disabled={isLoading}
          className="scale-90"
        />
      </div>

      <div className="flex items-center justify-between pt-4 px-1">
        <SettingHeader icon={MousePointerClick} label={t('inlineAppointmentCreation')} help={t('help.inlineAppointmentCreation')} htmlFor="inline-appointment-creation" variant="toggle" />
        <Switch
          id="inline-appointment-creation"
          checked={settings.inline_appointment_creation ?? false}
          onCheckedChange={(checked) => updateSettings({ inline_appointment_creation: checked })}
          disabled={isLoading}
          className="scale-90"
        />
      </div>
    </div>
  );
}
