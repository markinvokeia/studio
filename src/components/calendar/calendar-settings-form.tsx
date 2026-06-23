'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { CalendarSettings } from '@/lib/types';
import api from '@/services/api';
import { API_ROUTES } from '@/constants/routes';
import { DEFAULT_EVENT_LABEL_FORMAT, EVENT_LABEL_FORMATS, HOUR_SLOT_HEIGHT, HOUR_SLOT_HEIGHT_OPTIONS } from './calendar-constants';
import { DEFAULT_CALENDAR_SETTINGS, normalizeCalendarSettings } from './calendar-settings-utils';

interface CalendarSettingsFormProps {
  onSettingsChange?: (settings: CalendarSettings) => void;
  className?: string;
  showTitle?: boolean;
}

export function CalendarSettingsForm({ onSettingsChange, className, showTitle = false }: CalendarSettingsFormProps) {
  const t = useTranslations('AppointmentsPage.settings');
  const [settings, setSettings] = React.useState<CalendarSettings>(DEFAULT_CALENDAR_SETTINGS);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let isMounted = true;

    const loadSettings = async () => {
      try {
        const data = await api.get(API_ROUTES.CALENDAR_SETTINGS_SEARCH);
        const existingSettings = normalizeCalendarSettings(data);
        const nextSettings = existingSettings ?? DEFAULT_CALENDAR_SETTINGS;

        if (!existingSettings) {
          await api.post(API_ROUTES.CALENDAR_SETTINGS_UPSERT, nextSettings);
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
  }, [onSettingsChange]);

  const updateSettings = async (updates: Partial<CalendarSettings>) => {
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    onSettingsChange?.(newSettings);

    try {
      await api.post(API_ROUTES.CALENDAR_SETTINGS_UPSERT, newSettings);
    } catch (error) {
      console.error('Failed to save calendar settings:', error);
    }
  };

  const updateHourHeight = (value: number) => {
    updateSettings({ hour_height: value });
  };

  const viewOptions = ['day', '2_days', '3_days', 'week', 'month', 'agenda'];
  const groupOptions = ['none', 'doctor', 'calendar'];

  return (
    <div className={className}>
      {showTitle && (
        <div className="flex items-center gap-2 pb-2 mb-4 border-b border-border/50">
          <h4 className="font-semibold text-sm tracking-tight">{t('title')}</h4>
        </div>
      )}
      
      <div className="bg-muted/30 p-2.5 rounded-xl border border-border/40 space-y-3.5">
        <div className="space-y-1.5">
          <Label htmlFor="default-view" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">
            {t('defaultView')}
          </Label>
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

        <div className="space-y-1.5">
          <Label htmlFor="hour-height" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">
            {t('hourHeight')}
          </Label>
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
          <Label htmlFor="event-label-format" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">
            {t('eventLabel')}
          </Label>
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

        <div className="space-y-1.5">
          <Label htmlFor="grouped-by" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">
            {t('groupBy')}
          </Label>
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
      </div>

      <div className="flex items-center justify-between pt-4 px-1">
        <Label htmlFor="check-availability" className="text-xs font-medium cursor-pointer">
          {t('checkAvailability')}
        </Label>
        <Switch 
          id="check-availability" 
          checked={settings.check_availability} 
          onCheckedChange={(checked) => updateSettings({ check_availability: checked })}
          disabled={isLoading}
          className="scale-90"
        />
      </div>

      <div className="flex items-center justify-between pt-4 px-1">
        <Label htmlFor="filter-doctors-by-service" className="text-xs font-medium cursor-pointer">
          {t('filterDoctorsByService')}
        </Label>
        <Switch
          id="filter-doctors-by-service"
          checked={settings.filter_doctors_by_service}
          onCheckedChange={(checked) => updateSettings({ filter_doctors_by_service: checked })}
          disabled={isLoading}
          className="scale-90"
        />
      </div>
    </div>
  );
}
