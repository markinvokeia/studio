'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useTVDisplay } from '@/context/tv-display-context';
import type { Calendar } from '@/lib/types';

interface SettingsFormProps {
  calendars: Calendar[];
}

export function SettingsForm({ calendars }: SettingsFormProps) {
  const t = useTranslations('TVDisplayPage.settings');
  const { settings, updateSettings } = useTVDisplay();
  const { toast } = useToast();
  const [newVideoUrl, setNewVideoUrl] = React.useState('');

  const handleSave = () => {
    toast({ description: t('saved') });
  };

  const addVideo = () => {
    if (!newVideoUrl.trim()) return;
    updateSettings({ videoUrls: [...settings.videoUrls, newVideoUrl.trim()] });
    setNewVideoUrl('');
  };

  const removeVideo = (idx: number) => {
    updateSettings({ videoUrls: settings.videoUrls.filter((_, i) => i !== idx) });
  };

  const toggleCalendar = (googleCalId: string, checked: boolean) => {
    const next = checked
      ? [...settings.selectedCalendarIds, googleCalId]
      : settings.selectedCalendarIds.filter((c) => c !== googleCalId);
    updateSettings({ selectedCalendarIds: next });
  };

  return (
    <div className="space-y-6">
      {/* Display info */}
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="displayTitle">{t('displayTitle')}</Label>
          <Input
            id="displayTitle"
            value={settings.displayTitle}
            onChange={(e) => updateSettings({ displayTitle: e.target.value })}
            placeholder={t('displayTitlePlaceholder')}
          />
        </div>

        <div className="space-y-1.5">
          <Label>{t('theme')}</Label>
          <Select
            value={settings.theme}
            onValueChange={(v) => updateSettings({ theme: v as 'dark' | 'light' | 'branded' })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dark">{t('themeDark')}</SelectItem>
              <SelectItem value="light">{t('themeLight')}</SelectItem>
              <SelectItem value="branded">{t('themeBranded')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      {/* Consulting rooms */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold">{t('calendars')}</Label>
        {calendars.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('noCalendars')}</p>
        ) : (
          <div className="space-y-2">
            {calendars.map((cal) => (
              <div key={cal.google_calendar_id} className="flex items-center gap-2">
                <Checkbox
                  id={`cal-${cal.google_calendar_id}`}
                  checked={settings.selectedCalendarIds.includes(cal.google_calendar_id)}
                  onCheckedChange={(checked) => toggleCalendar(cal.google_calendar_id, !!checked)}
                />
                <label htmlFor={`cal-${cal.google_calendar_id}`} className="text-sm cursor-pointer flex items-center gap-2">
                  {cal.color && (
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ background: cal.color }} />
                  )}
                  {cal.name}
                </label>
              </div>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Visibility toggles */}
      <div className="space-y-3">
        {(
          [
            ['showClock', 'showClock'],
            ['showDate', 'showDate'],
            ['showPatientName', 'showPatientName'],
            ['showDoctorName', 'showDoctorName'],
            ['showAppointmentTime', 'showAppointmentTime'],
            ['showNextPatient', 'showNextPatient'],
            ['autoAdvance', 'autoAdvance'],
          ] as const
        ).map(([field, labelKey]) => (
          <div key={field} className="flex items-center justify-between">
            <Label htmlFor={field} className="cursor-pointer">{t(labelKey)}</Label>
            <Switch
              id={field}
              checked={!!settings[field]}
              onCheckedChange={(v) => updateSettings({ [field]: v })}
            />
          </div>
        ))}
      </div>

      <Separator />

      {/* Refresh interval */}
      <div className="space-y-1.5">
        <Label htmlFor="refreshInterval">{t('refreshInterval')}</Label>
        <Input
          id="refreshInterval"
          type="number"
          min={1}
          max={60}
          value={settings.refreshIntervalMinutes}
          onChange={(e) => updateSettings({ refreshIntervalMinutes: Number(e.target.value) || 5 })}
          className="w-24"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="promoInterval">{t('promoInterval')}</Label>
        <Input
          id="promoInterval"
          type="number"
          min={1}
          max={120}
          value={settings.promoIntervalMinutes}
          onChange={(e) => updateSettings({ promoIntervalMinutes: Number(e.target.value) || 15 })}
          className="w-24"
        />
      </div>

      <Separator />

      {/* Videos */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold">{t('videos')}</Label>
        <div className="flex gap-2">
          <Input
            value={newVideoUrl}
            onChange={(e) => setNewVideoUrl(e.target.value)}
            placeholder={t('videoUrlPlaceholder')}
            onKeyDown={(e) => e.key === 'Enter' && addVideo()}
          />
          <Button type="button" size="sm" variant="outline" onClick={addVideo}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {settings.videoUrls.map((url, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="flex-1 truncate text-muted-foreground">{url}</span>
            <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeVideo(i)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>

      <Separator />

      {/* Music */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold">{t('music')}</Label>
        <div className="flex items-center justify-between">
          <Label htmlFor="musicEnabled" className="cursor-pointer">{t('musicEnabled')}</Label>
          <Switch
            id="musicEnabled"
            checked={settings.musicEnabled}
            onCheckedChange={(v) => updateSettings({ musicEnabled: v })}
          />
        </div>
        {settings.musicEnabled && (
          <div className="space-y-1.5">
            <Label htmlFor="musicUrl">{t('musicUrl')}</Label>
            <Input
              id="musicUrl"
              value={settings.musicUrl}
              onChange={(e) => updateSettings({ musicUrl: e.target.value })}
              placeholder={t('musicUrlPlaceholder')}
            />
          </div>
        )}
      </div>

      <Button onClick={handleSave} className="w-full">
        {t('save')}
      </Button>
    </div>
  );
}
