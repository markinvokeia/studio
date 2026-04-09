'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import {
  Monitor,
  MonitorOff,
  Pause,
  Play,
  RefreshCw,
  Film,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useTVDisplay } from '@/context/tv-display-context';
import { SettingsForm } from '@/components/tv-display/settings-form';
import { TVPreview } from '@/components/tv-display/tv-preview';

export default function TVDisplayPage() {
  const t = useTranslations('TVDisplayPage');
  const locale = useLocale();
  const { settings, status, rooms, calendars, isLoading, setStatus, openTVScreen, fetchAppointments, nextPatient } =
    useTVDisplay();

  const statusColors: Record<string, string> = {
    on: 'bg-emerald-500',
    off: 'bg-slate-500',
    paused: 'bg-amber-500',
    promo: 'bg-violet-500',
  };

  const statusLabels: Record<string, string> = {
    on: t('status.on'),
    off: t('status.off'),
    paused: t('status.paused'),
    promo: t('status.promo'),
  };

  return (
    <div className="flex flex-col h-full gap-4 overflow-hidden">
      {/* Page header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground text-sm">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn('w-2.5 h-2.5 rounded-full', statusColors[status])} />
          <Badge variant="secondary" className="uppercase tracking-wider text-xs">
            {statusLabels[status]}
          </Badge>
        </div>
      </div>

      {/* Main grid — 35% settings | 65% preview+controls */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[35%_65%] gap-4 min-h-0 overflow-hidden">

        {/* ── LEFT: Settings panel ── */}
        <Card className="flex flex-col min-h-0 overflow-hidden">
          <CardHeader className="shrink-0 pb-3">
            <CardTitle className="text-base">{t('settings.title')}</CardTitle>
          </CardHeader>
          <Separator />
          <ScrollArea className="flex-1 min-h-0">
            <CardContent className="pt-4 pb-6">
              <SettingsForm calendars={calendars} />
            </CardContent>
          </ScrollArea>
        </Card>

        {/* ── RIGHT: Preview + controls ── */}
        <div className="flex flex-col gap-4 min-h-0 overflow-y-auto pr-0.5">

          {/* Preview */}
          <Card className="shrink-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t('preview.title')}</CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="max-w-xs">
                <TVPreview />
              </div>
            </CardContent>
          </Card>

          {/* Control bar */}
          <Card className="shrink-0">
            <CardContent className="pt-4">
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => openTVScreen(locale)} className="gap-2">
                  <ExternalLink className="h-4 w-4" />
                  {t('controls.openScreen')}
                </Button>

                {status === 'off' ? (
                  <Button variant="outline" onClick={() => setStatus('on')} className="gap-2">
                    <Monitor className="h-4 w-4" />
                    {t('controls.turnOn')}
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => setStatus('off')} className="gap-2 text-destructive hover:text-destructive">
                    <MonitorOff className="h-4 w-4" />
                    {t('controls.turnOff')}
                  </Button>
                )}

                {status !== 'off' && (
                  status === 'paused' ? (
                    <Button variant="outline" onClick={() => setStatus('on')} className="gap-2">
                      <Play className="h-4 w-4" />
                      {t('controls.resume')}
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={() => setStatus('paused')} className="gap-2">
                      <Pause className="h-4 w-4" />
                      {t('controls.pause')}
                    </Button>
                  )
                )}

                {status !== 'off' && (
                  <Button variant="outline" onClick={() => setStatus('promo')} className="gap-2">
                    <Film className="h-4 w-4" />
                    {t('controls.showPromo')}
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isLoading}
                  onClick={fetchAppointments}
                  className="gap-2 ml-auto"
                >
                  <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
                  {t('controls.refresh')}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Quick actions per room */}
          {rooms.length > 0 && status !== 'off' && (
            <Card className="shrink-0">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Acciones rápidas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {rooms.map((room) => (
                    <Button
                      key={room.calendarId}
                      size="sm"
                      variant="outline"
                      onClick={() => nextPatient(room.calendarId)}
                      className="gap-2"
                      disabled={room.currentIndex >= room.appointments.length - 1}
                    >
                      {room.calendarColor && (
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: room.calendarColor }} />
                      )}
                      Siguiente: {room.calendarName}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
