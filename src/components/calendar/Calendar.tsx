
'use client';

import { useTranslations } from 'next-intl';
import React from 'react';

import './Calendar.css';

import type { CalendarProps, CalendarView } from './calendar-types';
import { useCalendarBreakpoint } from '@/hooks/use-calendar-breakpoint';
import { useCalendarNavigation } from '@/hooks/use-calendar-navigation';

import { CalendarHeader } from './calendar-header';
import { CalendarDayView } from './calendar-day-view';
import { CalendarDayViewGrouped } from './calendar-day-view-grouped';
import { CalendarDayViewMobile } from './calendar-day-view-mobile';
import { CalendarMonthView } from './calendar-month-view';
import { CalendarMonthViewMobile } from './calendar-month-view-mobile';
import { CalendarYearView } from './calendar-year-view';
import { CalendarScheduleView } from './calendar-schedule-view';
import { CalendarViewTabs } from './calendar-view-tabs';
import { CalendarFab } from './calendar-fab';
import { CalendarFilterSheet } from './calendar-filter-sheet';

// Re-export types for backward compatibility
export type { CalendarGroupBy, CalendarEvent, CalendarGroupingColumn } from './calendar-types';

/** Resolve view to an effective variant based on breakpoint */
function resolveViewForBreakpoint(view: CalendarView, isMobile: boolean): CalendarView {
  if (!isMobile) return view;
  // On mobile: week becomes 3-day, 2-day becomes day
  if (view === 'week') return '3-day';
  if (view === '2-day') return 'day';
  if (view === 'year') return 'month';
  return view;
}

const Calendar: React.FC<CalendarProps> = ({
  events = [],
  onDateChange,
  children,
  isLoading = false,
  onEventClick,
  onViewChange,
  groupBy = 'none',
  groupingColumns = [],
  onEventColorChange,
  onSlotClick,
  onEventContextMenu,
  filterSheet,
}) => {
  const t = useTranslations('Calendar');
  const breakpoint = useCalendarBreakpoint();
  const isMobile = breakpoint === 'mobile';

  const [filterSheetOpen, setFilterSheetOpen] = React.useState(false);

  const {
    currentDate,
    view,
    headerTitle,
    currentTime,
    handlePrev,
    handleNext,
    handleToday,
    handleViewChange,
    dateLocale,
  } = useCalendarNavigation({ onDateChange, onViewChange });

  const effectiveView = resolveViewForBreakpoint(view, isMobile);
  const timeZoneLabel = t('timeZone');
  const isGrouped = groupBy !== 'none' && groupingColumns.length > 0;

  // Shared event handler props
  const eventHandlers = {
    onEventClick,
    onEventColorChange,
    onEventContextMenu,
    onSlotClick,
  };

  const renderView = () => {
    switch (effectiveView) {
      case 'day':
      case '2-day':
      case '3-day':
      case 'week': {
        const numDays = effectiveView === 'week' ? 7 : effectiveView === '3-day' ? 3 : effectiveView === '2-day' ? 2 : 1;

        // Mobile: carousel-based view
        if (isMobile) {
          return (
            <CalendarDayViewMobile
              currentDate={currentDate}
              view={effectiveView}
              numDays={numDays}
              events={events}
              groupBy={groupBy}
              groupingColumns={groupingColumns}
              currentTime={currentTime}
              dateLocale={dateLocale}
              {...eventHandlers}
            />
          );
        }

        // Desktop/Tablet: grouped or standard
        if (isGrouped) {
          return (
            <CalendarDayViewGrouped
              currentDate={currentDate}
              view={effectiveView}
              numDays={numDays}
              events={events}
              groupBy={groupBy}
              groupingColumns={groupingColumns}
              currentTime={currentTime}
              dateLocale={dateLocale}
              timeZoneLabel={timeZoneLabel}
              breakpoint={breakpoint}
              {...eventHandlers}
            />
          );
        }

        return (
          <CalendarDayView
            currentDate={currentDate}
            view={effectiveView}
            numDays={numDays}
            events={events}
            currentTime={currentTime}
            dateLocale={dateLocale}
            timeZoneLabel={timeZoneLabel}
            {...eventHandlers}
          />
        );
      }

      case 'year':
        return (
          <CalendarYearView
            currentDate={currentDate}
            events={events}
            dateLocale={dateLocale}
          />
        );

      case 'schedule':
        return (
          <CalendarScheduleView
            events={events}
            dateLocale={dateLocale}
            onEventClick={onEventClick}
          />
        );

      case 'month':
      default:
        if (isMobile) {
          return (
            <CalendarMonthViewMobile
              currentDate={currentDate}
              events={events}
              dateLocale={dateLocale}
              onEventClick={onEventClick}
              onSlotClick={onSlotClick}
            />
          );
        }
        return (
          <CalendarMonthView
            currentDate={currentDate}
            events={events}
            dateLocale={dateLocale}
            isLoading={isLoading}
            onEventClick={onEventClick}
            onEventColorChange={onEventColorChange}
            onEventContextMenu={onEventContextMenu}
            onSlotClick={onSlotClick}
          />
        );
    }
  };

  return (
    <div className="calendar-container">
      {/* Mobile: date subtitle under header */}
      <CalendarHeader
        headerTitle={headerTitle}
        view={view}
        breakpoint={breakpoint}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={handleToday}
        onViewChange={handleViewChange}
        onOpenFilterSheet={isMobile && filterSheet ? () => setFilterSheetOpen(true) : undefined}
      >
        {children}
      </CalendarHeader>

      {/* Mobile: date title bar */}
      {isMobile && (
        <div className="px-3 py-2 border-b border-border bg-card">
          <h3 className="text-sm font-semibold text-foreground">{headerTitle}</h3>
        </div>
      )}

      <div className="calendar-body">
        {renderView()}
      </div>

      {/* Mobile: bottom view tabs */}
      {isMobile && (
        <CalendarViewTabs view={view} onViewChange={handleViewChange} />
      )}

      {/* Mobile: FAB for creating appointments */}
      {isMobile && onSlotClick && (
        <CalendarFab onClick={() => onSlotClick(new Date())} />
      )}

      {/* Mobile: filter bottom sheet */}
      {filterSheet && (
        <CalendarFilterSheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
          {filterSheet}
        </CalendarFilterSheet>
      )}
    </div>
  );
};

export default Calendar;
