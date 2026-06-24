
'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
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
export type { CalendarGroupBy, CalendarEvent, CalendarGroupingColumn, CalendarView } from './calendar-types';

/** Resolve view to an effective variant based on breakpoint */
function resolveViewForBreakpoint(view: CalendarView, isMobile: boolean): CalendarView {
  if (!isMobile) return view;
  // On mobile: year becomes month
  if (view === 'year') return 'month';
  return view;
}

const Calendar: React.FC<CalendarProps> = ({
  events = [],
  onDateChange,
  children,
  isLoading = false,
  onEventClick,
  view: propsView,
  defaultView,
  hourSlotHeight,
  onViewChange,
  groupBy = 'none',
  groupingColumns = [],
  onEventColorChange,
  onSlotClick,
  onEventContextMenu,
  filterSheet,
  extraActions,
  extraActionsAfterToday,
  primaryActions,
  trailingActions,
  selectedAppointmentIds,
  onToggleAppointmentSelect,
  bulkModeContent,
  gaps,
  selectedGapKey,
  onGapClick,
  blockedRanges,
  blockedFullDays,
}) => {
  const t = useTranslations('Calendar');
  const breakpoint = useCalendarBreakpoint();
  const isMobile = breakpoint === 'mobile';
  const isCompactHeader = breakpoint !== 'desktop';

  const [filterSheetOpen, setFilterSheetOpen] = React.useState(false);
  const [monthCollapsed, setMonthCollapsed] = React.useState(false);

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
  } = useCalendarNavigation({ onDateChange, onViewChange, initialView: propsView || defaultView });

  const effectiveView = resolveViewForBreakpoint(view, isMobile);
  const timeZoneLabel = t('timeZone');
  const isGrouped = groupBy !== 'none' && groupingColumns.length > 0;
  const isMultiDayView = effectiveView === 'week' || effectiveView === '2-day' || effectiveView === '3-day';
  const useMobileDayLayout = (isMobile && (isGrouped || !isMultiDayView)) || (breakpoint === 'tablet' && isGrouped);

  // Shared event handler props
  const eventHandlers = {
    onEventClick,
    onEventColorChange,
    onEventContextMenu,
    onSlotClick,
  };

  // Free-slot ("Huecos") overlay props, threaded into the grid/month views.
  const gapProps = { gaps, selectedGapKey, onGapClick };
  // Out-of-office blocking overlay props (independent of Huecos).
  const blockProps = { blockedRanges };

  const renderView = () => {
    switch (effectiveView) {
      case 'day':
      case '2-day':
      case '3-day':
      case 'week': {
        const numDays = effectiveView === 'week' ? 7 : effectiveView === '3-day' ? 3 : effectiveView === '2-day' ? 2 : 1;

        // Mobile grouped/single-day, and grouped tablet: carousel-based view
        if (useMobileDayLayout) {
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
              hourSlotHeight={hourSlotHeight}
              {...eventHandlers}
              {...gapProps}
              {...blockProps}
            />
          );
        }

        // Desktop: grouped or standard
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
              hourSlotHeight={hourSlotHeight}
              {...eventHandlers}
              {...gapProps}
              {...blockProps}
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
            hourSlotHeight={hourSlotHeight}
            {...eventHandlers}
            {...gapProps}
            {...blockProps}
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
            breakpoint={breakpoint}
            onEventClick={onEventClick}
            selectedAppointmentIds={selectedAppointmentIds}
            onToggleAppointmentSelect={onToggleAppointmentSelect}
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
              collapsed={monthCollapsed}
              onEventClick={onEventClick}
              onSlotClick={onSlotClick}
              {...gapProps}
              blockedFullDays={blockedFullDays}
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
            {...gapProps}
            blockedFullDays={blockedFullDays}
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
        onOpenFilterSheet={isCompactHeader && filterSheet ? () => setFilterSheetOpen(true) : undefined}
        extraActions={extraActions}
        extraActionsAfterToday={extraActionsAfterToday}
        primaryActions={primaryActions}
        trailingActions={trailingActions}
        bulkModeContent={bulkModeContent}
      >
        {children}
      </CalendarHeader>

      {/* Mobile: date title bar */}
      {isMobile && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-card">
          <h3 className="text-sm font-semibold text-foreground">{headerTitle}</h3>
          {effectiveView === 'month' && (
            <button
              type="button"
              onClick={() => setMonthCollapsed((prev) => !prev)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted active:bg-muted"
              aria-label={monthCollapsed ? t('expandMonth') : t('collapseMonth')}
              aria-expanded={!monthCollapsed}
            >
              {monthCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </button>
          )}
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
        <CalendarFab label={t('create')} onClick={() => onSlotClick(new Date())} />
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
