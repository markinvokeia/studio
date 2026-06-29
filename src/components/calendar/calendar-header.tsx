'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Calendar as DatePickerCalendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import {
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
} from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { enUS, es } from 'date-fns/locale';

import type { CalendarBreakpoint, CalendarView } from './calendar-types';

interface CalendarHeaderProps {
  headerTitle: string;
  view: CalendarView;
  currentDate: Date;
  breakpoint: CalendarBreakpoint;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onViewChange: (view: CalendarView) => void;
  /** Jump the calendar to a date picked from the header date picker. */
  onDateSelect: (date: Date) => void;
  onOpenFilterSheet?: () => void;
  extraActions?: React.ReactNode;
  extraActionsAfterToday?: React.ReactNode;
  primaryActions?: React.ReactNode;
  trailingActions?: React.ReactNode;
  children?: React.ReactNode;
  /** When provided, replaces the entire desktop header with this content */
  bulkModeContent?: React.ReactNode;
}

/** Clickable header date that opens a date picker to jump to any day. Selecting a
 *  day moves the calendar to that day (and thus its week/month, per the view). */
function HeaderDatePicker({
  headerTitle,
  currentDate,
  onDateSelect,
  className,
}: {
  headerTitle: string;
  currentDate: Date;
  onDateSelect: (date: Date) => void;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const locale = useLocale();
  const dateLocale = locale === 'es' ? es : enUS;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`rounded-md px-1.5 py-0.5 font-semibold whitespace-nowrap transition-colors hover:bg-muted ${className ?? ''}`}
        >
          {headerTitle}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <DatePickerCalendar
          mode="single"
          selected={currentDate}
          defaultMonth={currentDate}
          locale={dateLocale}
          onSelect={(d) => { if (d) { onDateSelect(d); setOpen(false); } }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

export function CalendarHeader({
  headerTitle,
  currentDate,
  breakpoint,
  onPrev,
  onNext,
  onToday,
  onDateSelect,
  onOpenFilterSheet,
  extraActions,
  extraActionsAfterToday,
  primaryActions,
  trailingActions,
  children,
  bulkModeContent,
}: CalendarHeaderProps) {
  const t = useTranslations('Calendar');

  // Mobile / tablet: compact header
  if (breakpoint === 'mobile' || breakpoint === 'tablet') {
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
            {extraActions}
            {primaryActions}
            {extraActionsAfterToday}
            {breakpoint === 'tablet' && trailingActions}
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

  // Desktop: full header — replaced entirely when in bulk mode
  if (bulkModeContent) {
    return (
      <div className="calendar-header flex-wrap gap-2">
        {bulkModeContent}
      </div>
    );
  }

  return (
    <div className="calendar-header calendar-header--actions relative pr-14">
      {/* Settings: pinned to the top-right of row 1; action buttons wrap below it. */}
      {trailingActions && (
        <div className="absolute right-3 top-2.5 z-10">{trailingActions}</div>
      )}
      {/* Row-1 cluster: title + date navigation (date is clickable to jump) */}
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
        <HeaderDatePicker headerTitle={headerTitle} currentDate={currentDate} onDateSelect={onDateSelect} className="text-sm" />
      </div>

      {/* Primary cluster: Refresh + Create — stays on row 1 (after the date) */}
      <div className="flex items-center gap-2">
        {extraActionsAfterToday}
        {primaryActions}
      </div>

      {/* Secondary cluster: Huecos, bulk selection, calendars, doctors. Fills the
          rest of row 1 and wraps to a second row when space is tight. */}
      <div className="calendar-header__secondary flex flex-wrap items-center gap-2">
        {extraActions}
        {children}
      </div>
    </div>
  );
}
