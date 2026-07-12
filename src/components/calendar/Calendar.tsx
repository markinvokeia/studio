
'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import React from 'react';

import './Calendar.css';

import type { CalendarProps, CalendarView } from './calendar-types';
import { DEFAULT_SLOT_DURATION, HOUR_SLOT_HEIGHT, MIN_SLOT_HEIGHT } from './calendar-constants';
import { CalendarZoomControl } from './calendar-zoom-control';
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
import { CalendarInlineDraftOverlay } from './inline-draft-overlay';

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
  slotMinutes,
  onViewChange,
  groupBy = 'none',
  groupingColumns = [],
  onEventColorChange,
  onEventDoubleClick,
  onSlotClick,
  onCreateClick,
  onSlotContextMenu,
  onEventContextMenu,
  onEventContextMenuOpen,
  inlineDraft,
  renderInlineDraft,
  filterSheet,
  hideTitle,
  arrowsBeforeToday,
  hideTimeGutter,
  zoom: controlledZoom,
  onZoomChange: controlledOnZoomChange,
  showZoomSlider = true,
  leadingActions,
  extraActions,
  extraActionsAfterToday,
  primaryActions,
  trailingActions,
  headerActionsClusterRef,
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

  // Calendar zoom (slider) — scales slot height. Persisted across sessions. Can be
  // overridden by a controlled `zoom`/`onZoomChange` pair (custom mode uses a dropdown).
  const [internalZoom, setInternalZoom] = React.useState(0.9);
  React.useEffect(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('calendar-zoom') : null;
    if (saved) {
      const v = parseFloat(saved);
      if (!Number.isNaN(v) && v >= 0.7 && v <= 2.5) setInternalZoom(v);
    }
  }, []);
  const isZoomControlled = controlledZoom !== undefined;
  const zoom = isZoomControlled ? (controlledZoom as number) : internalZoom;
  const handleZoomChange = React.useCallback((v: number) => {
    if (controlledOnZoomChange) {
      controlledOnZoomChange(v);
      return;
    }
    setInternalZoom(v);
    try { window.localStorage.setItem('calendar-zoom', String(v)); } catch { /* ignore */ }
  }, [controlledOnZoomChange]);

  // Whether the main hour gutter shows the hour labels. Off by default since each
  // day/resource column now shows the hours in its own left rail. Persisted.
  const [showTimeColumn, setShowTimeColumn] = React.useState(false);
  React.useEffect(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('calendar-show-time-column') : null;
    if (saved !== null) setShowTimeColumn(saved === 'true');
  }, []);
  const handleToggleTimeColumn = React.useCallback((v: boolean) => {
    setShowTimeColumn(v);
    try { window.localStorage.setItem('calendar-show-time-column', String(v)); } catch { /* ignore */ }
  }, []);


  const heightSetting = hourSlotHeight ?? HOUR_SLOT_HEIGHT;
  // Slot density: how many slots fit per hour (e.g. 6 for 10-min slots). The hour
  // row is floored at slotsPerHour * MIN_SLOT_HEIGHT so every slot can show a
  // readable title, even on tight agendas. Taller rows simply make day/week views
  // longer (and month scroll), keeping titles legible.
  const slotsPerHour = Math.max(1, Math.round(60 / (slotMinutes ?? DEFAULT_SLOT_DURATION)));
  const baseSlotHeight = Math.max(heightSetting, slotsPerHour * MIN_SLOT_HEIGHT);
  // Zoom enlarges only the slot height...
  const effectiveSlotHeight = Math.round(baseSlotHeight * zoom);
  // ...while the font scales only with the configured slot size (px setting),
  // dampened so larger slots don't blow up the text. Zoom does NOT change fonts.
  const fontScale = Math.pow(heightSetting / HOUR_SLOT_HEIGHT, 0.7);

  const {
    currentDate,
    view,
    headerTitle,
    currentTime,
    setCurrentDate,
    handlePrev,
    handleNext,
    handleToday,
    handleViewChange,
    dateLocale,
  } = useCalendarNavigation({ onDateChange, onViewChange, initialView: propsView || defaultView });

  const effectiveView = resolveViewForBreakpoint(view, isMobile);
  const timeZoneLabel = t('timeZone');
  const isGrouped = groupBy !== 'none' && groupingColumns.length > 0;
  const isMultiDayView = effectiveView === 'week' || effectiveView === '2-day' || effectiveView === '3-day' || effectiveView === '4-day' || effectiveView === '5-day' || effectiveView === '6-day';
  const useMobileDayLayout = (isMobile && (isGrouped || !isMultiDayView)) || (breakpoint === 'tablet' && isGrouped);

  // Shared event handler props
  const eventHandlers = {
    onEventClick,
    onEventColorChange,
    onEventDoubleClick,
    onEventContextMenu,
    onEventContextMenuOpen,
    onSlotClick,
    onSlotContextMenu,
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
      case '4-day':
      case '5-day':
      case '6-day':
      case 'week': {
        const numDays =
          effectiveView === 'week' ? 7
          : effectiveView === '6-day' ? 6
          : effectiveView === '5-day' ? 5
          : effectiveView === '4-day' ? 4
          : effectiveView === '3-day' ? 3
          : effectiveView === '2-day' ? 2
          : 1;

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
              hourSlotHeight={effectiveSlotHeight}
              slotMinutes={slotMinutes}
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
              hourSlotHeight={effectiveSlotHeight}
              slotMinutes={slotMinutes}
              showTimeColumn={showTimeColumn}
              onToggleTimeColumn={handleToggleTimeColumn}
              hideTimeGutter={hideTimeGutter}
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
            hourSlotHeight={effectiveSlotHeight}
            slotMinutes={slotMinutes}
            showTimeColumn={showTimeColumn}
            onToggleTimeColumn={handleToggleTimeColumn}
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
        currentDate={currentDate}
        breakpoint={breakpoint}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={handleToday}
        onViewChange={handleViewChange}
        onDateSelect={setCurrentDate}
        onOpenFilterSheet={isCompactHeader && filterSheet ? () => setFilterSheetOpen(true) : undefined}
        hideTitle={hideTitle}
        arrowsBeforeToday={arrowsBeforeToday}
        leadingActions={leadingActions}
        extraActions={extraActions}
        extraActionsAfterToday={extraActionsAfterToday}
        primaryActions={primaryActions}
        trailingActions={trailingActions}
        actionsClusterRef={headerActionsClusterRef}
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

      <div
        className="calendar-body relative"
        style={{ '--cal-font-scale': fontScale, '--cal-slots-per-hour': slotsPerHour } as React.CSSProperties}
      >
        {renderView()}
        {/* Zoom slider — only on time-grid views where slot height applies */}
        {showZoomSlider && !isMobile && (effectiveView === 'day' || isMultiDayView) && (
          <CalendarZoomControl zoom={zoom} onZoomChange={handleZoomChange} />
        )}
      </div>

      {/* Mobile: bottom view tabs */}
      {isMobile && (
        <CalendarViewTabs view={view} onViewChange={handleViewChange} />
      )}

      {/* Mobile: FAB for creating appointments */}
      {isMobile && onSlotClick && (
        <CalendarFab label={t('create')} onClick={onCreateClick ?? (() => onSlotClick(new Date()))} />
      )}

      {/* Mobile: filter bottom sheet */}
      {filterSheet && (
        <CalendarFilterSheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
          {filterSheet}
        </CalendarFilterSheet>
      )}

      {/* Inline appointment draft — rendered once as a centered overlay so it stays
          visible regardless of the date selected inside it (it is not pinned to the
          clicked day's column). */}
      {inlineDraft && renderInlineDraft && (
        <CalendarInlineDraftOverlay>{renderInlineDraft()}</CalendarInlineDraftOverlay>
      )}
    </div>
  );
};

export default Calendar;
