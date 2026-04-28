'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import {
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { CalendarBreakpoint, CalendarView } from './calendar-types';

interface CalendarHeaderProps {
  headerTitle: string;
  view: CalendarView;
  breakpoint: CalendarBreakpoint;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onViewChange: (view: CalendarView) => void;
  onOpenFilterSheet?: () => void;
  children?: React.ReactNode;
}

export function CalendarHeader({
  headerTitle,
  view,
  breakpoint,
  onPrev,
  onNext,
  onToday,
  onViewChange,
  onOpenFilterSheet,
  children,
}: CalendarHeaderProps) {
  const t = useTranslations('Calendar');

  const viewKey = view.includes('-') ? view.replace('-', '') : view;

  // Mobile: compact header
  if (breakpoint === 'mobile') {
    return (
      <div className="calendar-header-mobile">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {onOpenFilterSheet && (
              <Button variant="ghost" size="icon" onClick={onOpenFilterSheet}>
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
            )}
            <h2 className="text-base font-bold tracking-tight">{t('title')}</h2>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={onToday} className="text-xs px-2">
              {t('today')}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onPrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {children ? (
          <div className="calendar-header-mobile-actions" aria-label={t('title')}>
            {children}
          </div>
        ) : null}
      </div>
    );
  }

  // Desktop / Tablet: full header
  return (
    <div className="calendar-header flex-wrap gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <h2 className="text-xl font-bold whitespace-nowrap">{t('title')}</h2>
        <Button variant="outline" size="sm" onClick={onToday}>
          {t('today')}
        </Button>
        <div className="flex items-center gap-0.5 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onPrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <h3 className="font-semibold text-sm whitespace-nowrap">{headerTitle}</h3>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {children}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
              {t(`views.${viewKey}`)}
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>{t('views.day')}</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onSelect={() => onViewChange('day')}>{t('views.day')}</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onViewChange('2-day')}>{t('views.2day')}</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onViewChange('3-day')}>{t('views.3day')}</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem onSelect={() => onViewChange('week')}>{t('views.week')}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onViewChange('month')}>{t('views.month')}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onViewChange('year')}>{t('views.year')}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onViewChange('schedule')}>{t('views.schedule')}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
