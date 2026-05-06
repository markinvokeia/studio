'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Trash2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useTVDisplay } from '@/context/tv-display-context';
import type { Calendar, TVDisplaySettings } from '@/lib/types';

interface SettingsFormProps {
  calendars: Calendar[];
}

function VideoUrlList({
  urls,
  onAdd,
  onRemove,
  placeholder,
}: {
  urls: string[];
  onAdd: (url: string) => void;
  onRemove: (idx: number) => void;
  placeholder: string;
}) {
  const [newUrl, setNewUrl] = React.useState('');
  const add = () => {
    if (!newUrl.trim()) return;
    onAdd(newUrl.trim());
    setNewUrl('');
  };
  return (
    <div className="w-full space-y-2">
      <div className="flex w-full gap-2">
        <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={add}>
          <Plus className="h-4 w-4" />
        </Button>
        <Input
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1"
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
      </div>
      {urls.length === 0 && (
        <p className="text-xs text-muted-foreground">Sin videos. Agrega una URL para comenzar.</p>
      )}
      {urls.map((url, i) => (
        <div key={i} className="flex w-full items-center gap-2 text-sm">
          <span className="min-w-0 flex-1 truncate text-muted-foreground">{url}</span>
          <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => onRemove(i)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
    </div>
  );
}

export function SettingsForm({ calendars }: SettingsFormProps) {
  const t = useTranslations('TVDisplayPage.settings');
  const { settings, updateSettings } = useTVDisplay();
  const { toast } = useToast();

  const handleSave = () => {
    toast({ description: t('saved') });
  };

  const toggleCalendar = (calendarSourceId: string, checked: boolean) => {
    const next = checked
      ? [...settings.selectedCalendarIds, calendarSourceId]
      : settings.selectedCalendarIds.filter((c) => c !== calendarSourceId);
    updateSettings({ selectedCalendarIds: next });
  };

  const videoPos = settings.videoColumnPosition ?? 'none';
  const showVideoColumnSection = videoPos !== 'none';
  const isVertical = videoPos === 'left' || videoPos === 'right';
  const isHorizontal = videoPos === 'top' || videoPos === 'bottom';

  return (
    <div className="w-full space-y-6">
      {/* Theme */}
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>{t('theme')}</Label>
          <Select
            value={settings.theme}
            onValueChange={(v) => updateSettings({ theme: v as TVDisplaySettings['theme'] })}
          >
            <SelectTrigger className="w-full">
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
        {calendars.filter(c => c.is_active !== false).length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('noCalendars')}</p>
        ) : (
          <div className="space-y-2">
            {calendars.filter(c => c.is_active !== false).map((cal) => {
              const calendarSourceId = String(cal.id);
              return (
                <div key={calendarSourceId} className="flex items-center gap-2">
                  <Checkbox
                    id={`cal-${calendarSourceId}`}
                    checked={settings.selectedCalendarIds.includes(calendarSourceId)}
                    onCheckedChange={(checked) => toggleCalendar(calendarSourceId, !!checked)}
                  />
                  <label htmlFor={`cal-${calendarSourceId}`} className="text-sm cursor-pointer flex items-center gap-2">
                    {cal.color && (
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ background: cal.color }} />
                    )}
                    {cal.name}
                  </label>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Separator />

      {/* Visibility toggles */}
      <div className="space-y-1">
        {(
          [
            ['groupByCalendar', 'groupByCalendar'],
            ['showClock', 'showClock'],
            ['showDate', 'showDate'],
            ['showClinicPhone', 'showClinicPhone'],
            ['showClinicAddress', 'showClinicAddress'],
            ['showClinicEmail', 'showClinicEmail'],
            ['showPatientName', 'showPatientName'],
            ['showDoctorName', 'showDoctorName'],
            ['showAppointmentTime', 'showAppointmentTime'],
            ['showNextPatient', 'showNextPatient'],
            ['autoAdvance', 'autoAdvance'],
          ] as const
        ).map(([field, labelKey]) => (
          <label
            key={field}
            htmlFor={field}
            className="flex w-full items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/50 cursor-pointer transition-colors"
          >
            <Switch
              id={field}
              checked={!!settings[field]}
              onCheckedChange={(v) => updateSettings({ [field]: v })}
            />
            <span className="flex-1 text-sm leading-snug">{t(labelKey)}</span>
          </label>
        ))}
      </div>

      <Separator />

      {/* Intervals */}
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="refreshInterval">{t('refreshInterval')}</Label>
          <Input
            id="refreshInterval"
            type="number"
            min={1}
            max={60}
            value={settings.refreshIntervalMinutes}
            onChange={(e) => updateSettings({ refreshIntervalMinutes: Number(e.target.value) || 5 })}
            className="w-full max-w-24"
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
            className="w-full max-w-24"
          />
        </div>
      </div>

      <Separator />

      {/* ── Promo videos (fullscreen) ── */}
      <div className="space-y-3">
        <div>
          <Label className="text-sm font-semibold">{t('promoVideos')}</Label>
          <p className="text-xs text-muted-foreground mt-0.5">{t('promoVideosHint')}</p>
        </div>
        <VideoUrlList
          urls={settings.promoVideoUrls ?? []}
          onAdd={(url) => updateSettings({ promoVideoUrls: [...(settings.promoVideoUrls ?? []), url] })}
          onRemove={(idx) => updateSettings({ promoVideoUrls: (settings.promoVideoUrls ?? []).filter((_, i) => i !== idx) })}
          placeholder={t('videoUrlPlaceholder')}
        />
      </div>

      <Separator />

      {/* ── Video column ── */}
      <div className="space-y-3">
        <div>
          <Label className="text-sm font-semibold">{t('videoColumnPosition')}</Label>
          <p className="text-xs text-muted-foreground mt-0.5">{t('videoColumnHint')}</p>
        </div>
        <Select
          value={videoPos}
          onValueChange={(v) => updateSettings({ videoColumnPosition: v as TVDisplaySettings['videoColumnPosition'] })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t('videoColumnNone')}</SelectItem>
            <SelectItem value="left">{t('videoColumnLeft')}</SelectItem>
            <SelectItem value="right">{t('videoColumnRight')}</SelectItem>
            <SelectItem value="top">{t('videoColumnTop')}</SelectItem>
            <SelectItem value="bottom">{t('videoColumnBottom')}</SelectItem>
          </SelectContent>
        </Select>

        {/* Orientation hint */}
        {(isVertical || isHorizontal) && (
          <div className="flex w-full items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 px-3 py-2">
            <Info className="h-4 w-4 shrink-0 text-blue-500 mt-0.5" />
            <p className="min-w-0 flex-1 text-xs text-blue-700 dark:text-blue-300">
              {isVertical ? t('videoColumnNoteVertical') : t('videoColumnNoteHorizontal')}
            </p>
          </div>
        )}

        {/* Video URLs for the column — only shown when a position is selected */}
        {showVideoColumnSection && (
          <VideoUrlList
            urls={settings.videoUrls}
            onAdd={(url) => updateSettings({ videoUrls: [...settings.videoUrls, url] })}
            onRemove={(idx) => updateSettings({ videoUrls: settings.videoUrls.filter((_, i) => i !== idx) })}
            placeholder={t('videoUrlPlaceholder')}
          />
        )}
      </div>

      <Separator />

      {/* Music */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold">{t('music')}</Label>
        <label
          htmlFor="musicEnabled"
          className="flex w-full items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/50 cursor-pointer transition-colors"
        >
          <Switch
            id="musicEnabled"
            checked={settings.musicEnabled}
            onCheckedChange={(v) => updateSettings({ musicEnabled: v })}
          />
          <span className="flex-1 text-sm leading-snug">{t('musicEnabled')}</span>
        </label>
        {settings.musicEnabled && (
          <div className="space-y-1.5">
            <Label htmlFor="musicUrl">{t('musicUrl')}</Label>
            <Input
              id="musicUrl"
              value={settings.musicUrl}
              onChange={(e) => updateSettings({ musicUrl: e.target.value })}
              placeholder={t('musicUrlPlaceholder')}
              className="w-full min-w-0"
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
