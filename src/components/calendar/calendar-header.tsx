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
  /** Hide the static "Calendar" title (custom mode). */
  hideTitle?: boolean;
  /** Render the prev/next arrows before the "Today" button (custom mode). */
  arrowsBeforeToday?: boolean;
  /** Rendered at the very top-left, before the title (e.g. the "Agendas" toggle). */
  leadingActions?: React.ReactNode;
  extraActions?: React.ReactNode;
  extraActionsAfterToday?: React.ReactNode;
  primaryActions?: React.ReactNode;
  trailingActions?: React.ReactNode;
  /** Callback ref to the desktop action cluster (fires with null when it unmounts),
   *  used by the page to observe overflow and collapse buttons to icon-only. */
  actionsClusterRef?: React.RefCallback<HTMLDivElement>;
  children?: React.ReactNode;
  /** When provided, replaces the entire desktop header with this content */
  bulkModeContent?: React.ReactNode;
}

/** Clickable header date that opens a date picker to jump to any day. Selecting a
 *  day moves the calendar to that day (and thus its week/month, per the view). */
function HeaderDatePicker({
  headerTitle,
  viewLabel,
  currentDate,
  onDateSelect,
  className,
}: {
  headerTitle: string;
  viewLabel: string;
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
          className={`flex flex-col items-start whitespace-nowrap rounded-md px-1.5 py-0.5 leading-tight transition-colors hover:bg-muted ${className ?? ''}`}
        >
          <span className="font-semibold">{headerTitle}</span>
          <span className="text-[10px] font-normal text-muted-foreground">{viewLabel}</span>
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
  view,
  currentDate,
  breakpoint,
  onPrev,
  onNext,
  onToday,
  onDateSelect,
  onOpenFilterSheet,
  hideTitle,
  arrowsBeforeToday,
  leadingActions,
  extraActions,
  extraActionsAfterToday,
  primaryActions,
  trailingActions,
  actionsClusterRef,
  children,
  bulkModeContent,
}: CalendarHeaderProps) {
  const t = useTranslations('Calendar');
  const viewKey = view.includes('-') ? view.replace('-', '') : view;
  const viewLabel = t('showingView', { view: t(`views.${viewKey}`) });

  // Mobile / tablet: compact header
  if (breakpoint === 'mobile' || breakpoint === 'tablet') {
    return (
      <div className="calendar-header-mobile">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            {leadingActions}
            {onOpenFilterSheet && (
              <Button variant="ghost" size="icon" onClick={onOpenFilterSheet}>
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
            )}
            {!hideTitle && <h2 className="text-base font-bold tracking-tight">{t('title')}</h2>}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1">
            <Button variant="ghost" size="sm" onClick={onToday} className="text-xs px-2">
              {t('today')}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onPrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            {/* Buscar huecos / Operaciones en Lotes (extraActions) and settings
                (trailingActions) are surfaced inside the filter sheet on compact
                layouts to keep this row on a single line. */}
            {primaryActions}
            {extraActionsAfterToday}
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
    <div className="calendar-header calendar-header--actions">
      {/* Nav cluster: title + date navigation (date is clickable to jump). shrink-0 so
          it keeps its natural width; the adjacent action cluster absorbs and clips any
          shortfall instead. */}
      <div className="flex items-center gap-2 shrink-0">
        {leadingActions}
        {!hideTitle && <h2 className="text-xl font-bold whitespace-nowrap">{t('title')}</h2>}
        {arrowsBeforeToday && (
          <div className="flex items-center gap-0.5 shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onPrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
        <Button variant="outline" size="sm" className="h-10 shrink-0" onClick={onToday}>
          {t('today')}
        </Button>
        {!arrowsBeforeToday && (
          <div className="flex items-center gap-0.5 shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onPrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
        <HeaderDatePicker headerTitle={headerTitle} viewLabel={viewLabel} currentDate={currentDate} onDateSelect={onDateSelect} className="text-sm" />
      </div>

      {/* Action cluster: Create / View / Zoom + gaps / bulk + calendars. flex-1 so it
          fills the space between the nav and the right controls; min-w-0 + overflow-hidden
          so its buttons overflow WITHIN it (clipped, keeping the right controls visible)
          when tight. page.tsx reads scrollWidth vs clientWidth here (via actionsClusterRef)
          and collapses these buttons to icon-only (secondary first, then primary) before
          they clip. */}
      <div ref={actionsClusterRef} className="calendar-header__secondary flex flex-1 min-w-0 items-center gap-2 overflow-hidden">
        {primaryActions}
        {extraActions}
        {children}
      </div>

      {/* Right cluster: Refresh + Settings — always pinned to the far right. */}
      <div className="flex items-center gap-1.5 shrink-0">
        {extraActionsAfterToday}
        {trailingActions}
      </div>
    </div>
  );
}
