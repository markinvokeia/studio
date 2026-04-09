'use client';

import * as React from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Tv, ChevronRight, Pause, Play, Film, Settings, MonitorOff, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useTVDisplay } from '@/context/tv-display-context';

export function TVDisplayWidget() {
  const t = useTranslations('TVDisplayWidget');
  const locale = useLocale();
  const { status, rooms, setStatus, nextPatient, openTVScreen } = useTVDisplay();

  const isActive = status === 'on' || status === 'paused' || status === 'promo';

  const statusDot = {
    on: 'bg-emerald-400 animate-pulse',
    off: 'bg-slate-400',
    paused: 'bg-amber-400',
    promo: 'bg-violet-400 animate-pulse',
  }[status];

  const statusLabel = {
    on: t('on'),
    off: t('off'),
    paused: t('paused'),
    promo: 'PROMO',
  }[status];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'relative h-9 border-none shadow-sm rounded-lg transition-all gap-2',
            isActive
              ? 'bg-slate-800 text-white hover:bg-slate-700'
              : 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600',
          )}
        >
          <Tv className="h-4 w-4" />
          <span
            className={cn('w-2 h-2 rounded-full absolute -top-0.5 -right-0.5 border-2', statusDot,
              isActive ? 'border-slate-800' : 'border-slate-200 dark:border-slate-700'
            )}
          />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>{t('status')}</span>
          <span className={cn(
            'text-xs font-bold px-2 py-0.5 rounded-full',
            isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
          )}>
            {statusLabel}
          </span>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {/* Next patient per room */}
        {rooms.map((room) => {
          const hasNext = room.currentIndex < room.appointments.length - 1;
          return (
            <DropdownMenuItem
              key={room.calendarId}
              disabled={!hasNext || !isActive}
              onClick={() => nextPatient(room.calendarId)}
              className="gap-2"
            >
              <ChevronRight className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate">
                {t('next')}: {room.calendarName}
              </span>
              {room.calendarColor && (
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: room.calendarColor }} />
              )}
            </DropdownMenuItem>
          );
        })}

        {rooms.length > 0 && <DropdownMenuSeparator />}

        {/* Pause / Resume */}
        {status === 'paused' ? (
          <DropdownMenuItem onClick={() => setStatus('on')} className="gap-2">
            <Play className="h-4 w-4" />
            {t('resume')}
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={() => setStatus('paused')}
            disabled={!isActive}
            className="gap-2"
          >
            <Pause className="h-4 w-4" />
            {t('pause')}
          </DropdownMenuItem>
        )}

        {/* Show promo */}
        <DropdownMenuItem
          onClick={() => setStatus('promo')}
          disabled={!isActive}
          className="gap-2"
        >
          <Film className="h-4 w-4" />
          {t('showPromo')}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Configure */}
        <DropdownMenuItem asChild className="gap-2">
          <Link href={`/${locale}/tv-display`}>
            <Settings className="h-4 w-4" />
            {t('configure')}
          </Link>
        </DropdownMenuItem>

        {/* Turn on/off */}
        {status === 'off' ? (
          <DropdownMenuItem onClick={() => openTVScreen(locale)} className="gap-2">
            <Monitor className="h-4 w-4" />
            {t('turnOn')}
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={() => setStatus('off')}
            className="gap-2 text-destructive focus:text-destructive"
          >
            <MonitorOff className="h-4 w-4" />
            {t('turnOff')}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
