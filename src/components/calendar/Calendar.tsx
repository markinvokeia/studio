
'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import React from 'react';

import './Calendar.css';

import type { CalendarProps, CalendarView } from './calendar-types';
import { DEFAULT_SLOT_DURATION, HOUR_SLOT_HEIGHT, MIN_VISIBLE_SLOT_PX } from './calendar-constants';
import { CalendarZoomControl } from './calendar-zoom-control';
import { useCalendarBreakpoint } from '@/hooks/use-calendar-breakpoint';
import { useCalendarNavigation } from '@/hooks/use-calendar-navigation';

import { CalendarHeader, HeaderDatePicker } from './calendar-header';
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
  focusDate,
  focusedEventId,
  focusEventNonce,
  focusScrollRightInset,
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
  renderSlotContextMenu,
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
  enableEventDrag,
  canDragEvent,
  onEventDrop,
  onEventResize,
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
      if (!Number.isNaN(v) && v >= 0.3 && v <= 2.5) setInternalZoom(v);
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
  // Slot density: how many slots fit per hour (e.g. 6 for 10-min slots).
  const slotsPerHour = Math.max(1, Math.round(60 / (slotMinutes ?? DEFAULT_SLOT_DURATION)));
  // La preferencia de altura de hora es puro interlineado y se respeta literal: el
  // zoom la multiplica y nada más la infla. Antes había un piso por densidad
  // (slotsPerHour * 24) que dejaba sin efecto media escala del selector — con slots
  // de 10 min, de 60 a 140 px rendían todos igual. El único límite que queda es de
  // render: un slot nunca baja de MIN_VISIBLE_SLOT_PX, para que a zoom mínimo la
  // rejilla siga siendo una rejilla. La legibilidad de las citas cortas se resuelve
  // compactando el contenido de la card (data-density), no estirando su caja: así su
  // alto sigue siendo proporcional a la duración y los huecos nunca quedan tapados.
  const effectiveSlotHeight = Math.max(
    Math.round(heightSetting * zoom),
    slotsPerHour * MIN_VISIBLE_SLOT_PX,
  );

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

  // Salto externo a una fecha (p. ej. al elegir un resultado de búsqueda). El
  // padre pasa un `Date` nuevo por salto para que el efecto corra aunque el día
  // no cambie respecto al render anterior.
  const focusDateStampRef = React.useRef(0);
  React.useEffect(() => {
    if (focusDate) {
      setCurrentDate(focusDate);
      focusDateStampRef.current = Date.now();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusDate]);
  // Si la vista cambia justo después de un salto (p. ej. el buscador pasa a
  // "día" en mobile), `setCurrentDate` de arriba corrió con la vista vieja y
  // colapsó la fecha al inicio de la semana. Al adoptarse la vista nueva se
  // re-aplica el mismo `focusDate` para caer en el día exacto. La ventana de
  // 2s evita que un cambio de vista manual posterior re-salte a la cita.
  React.useEffect(() => {
    if (focusDate && Date.now() - focusDateStampRef.current < 2000) {
      setCurrentDate(focusDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // Resalta una cita concreta con un aro de "hormigas en marcha" (mismo efecto que
  // el hueco máximo en "Buscar huecos"). El aro es un overlay propio, NO una clase
  // sobre la card: así sobrevive a los re-render de la grilla (que borraban la
  // clase y hacían parpadear el marcado). Un rAF lo mantiene pegado a la card
  // mientras la grilla se acomoda o el usuario hace scroll; el scroll de centrado
  // se hace UNA sola vez, sobre el contenedor scrolleable de la vista, no sobre la
  // página (que era lo que mandaba la cita al borde inferior).
  const calendarBodyRef = React.useRef<HTMLDivElement>(null);
  const focusRingRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const root = calendarBodyRef.current;
    const ring = focusRingRef.current;
    if (!root || !ring) return;
    if (!focusedEventId) { ring.hidden = true; return; }

    const selector = `[data-event-id="${(window.CSS && CSS.escape) ? CSS.escape(focusedEventId) : focusedEventId}"]`;
    const startedAt = Date.now();
    let raf = 0;
    let didScroll = false;
    let everSeen = false;

    const frame = () => {
      const el = root.querySelector<HTMLElement>(selector);
      if (el) {
        everSeen = true;
        const er = el.getBoundingClientRect();
        const rr = root.getBoundingClientRect();
        ring.hidden = false;
        ring.style.width = `${er.width + 6}px`;
        ring.style.height = `${er.height + 6}px`;
        ring.style.transform = `translate(${er.left - rr.left - 3}px, ${er.top - rr.top - 3}px)`;

        if (!didScroll) {
          didScroll = true;
          const scroller = el.closest('.day-view-container, .overflow-y-auto') as HTMLElement | null;
          if (scroller) {
            const sr = scroller.getBoundingClientRect();
            const maxTop = scroller.scrollHeight - scroller.clientHeight;
            const maxLeft = scroller.scrollWidth - scroller.clientWidth;
            const opts: ScrollToOptions = { behavior: 'smooth' };
            // Vertical: centrar la card en el alto visible.
            if (maxTop > 1) {
              const top = scroller.scrollTop + (er.top - sr.top) - scroller.clientHeight / 2 + er.height / 2;
              opts.top = Math.max(0, Math.min(top, maxTop));
            }
            // Horizontal: centrar en el ancho VISIBLE, descontando lo que tape un
            // panel a la derecha (el buscador en desktop) para que la card no quede
            // debajo. En vistas multi-día también trae la columna del día correcto.
            if (maxLeft > 1) {
              const visRight = sr.right - Math.max(0, focusScrollRightInset ?? 0);
              const visCenter = (sr.left + visRight) / 2;
              const left = scroller.scrollLeft + (er.left + er.width / 2) - visCenter;
              opts.left = Math.max(0, Math.min(left, maxLeft));
            }
            if (opts.top !== undefined || opts.left !== undefined) scroller.scrollTo(opts);
          } else {
            el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
          }
        }
      } else {
        ring.hidden = true;
        // Si nunca apareció (rango sin cargar, agenda oculta), no gires para siempre.
        if (!everSeen && Date.now() - startedAt > 8000) return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ring.hidden = true;
    };
  }, [focusedEventId, focusEventNonce, focusScrollRightInset]);

  const effectiveView = resolveViewForBreakpoint(view, isMobile);
  const timeZoneLabel = t('timeZone');
  const isGrouped = groupBy !== 'none' && groupingColumns.length > 0;
  const isMultiDayView = effectiveView === 'week' || effectiveView === '2-day' || effectiveView === '3-day' || effectiveView === '4-day' || effectiveView === '5-day' || effectiveView === '6-day';
  const useMobileDayLayout = (isMobile && (isGrouped || !isMultiDayView)) || (breakpoint === 'tablet' && isGrouped);

  // Shared event handler props. Memoizado porque se esparce sobre las vistas de
  // rejilla, que renderizan una card memoizada por cita: un objeto nuevo por render
  // invalidaría todas. Solo paga si los handlers que llegan son estables.
  const eventHandlers = React.useMemo(() => ({
    onEventClick,
    onEventColorChange,
    onEventDoubleClick,
    onEventContextMenu,
    onEventContextMenuOpen,
    onSlotClick,
    renderSlotContextMenu,
  }), [
    onEventClick,
    onEventColorChange,
    onEventDoubleClick,
    onEventContextMenu,
    onEventContextMenuOpen,
    onSlotClick,
    renderSlotContextMenu,
  ]);

  // Free-slot ("Huecos") overlay props, threaded into the grid/month views.
  const gapProps = { gaps, selectedGapKey, onGapClick };
  // Out-of-office blocking overlay props (independent of Huecos).
  const blockProps = { blockedRanges };
  // Mover/redimensionar. Solo lo consume la rejilla agrupada, que es la que el modo
  // custom renderiza en desktop; el resto de las vistas no recibe estas props y por
  // lo tanto no engancha ningún gesto.
  const dragProps = React.useMemo(
    () => ({ enableEventDrag, canDragEvent, onEventDrop, onEventResize }),
    [enableEventDrag, canDragEvent, onEventDrop, onEventResize],
  );

  // Cambio de período mientras se arrastra (borde izquierdo/derecho de la rejilla).
  // Reusa la misma navegación que las flechas de la cabecera, así que el rango que
  // se pide al backend y el título se actualizan igual que con un clic.
  const handleDragEdgeNavigate = React.useCallback((direction: -1 | 1) => {
    if (direction < 0) handlePrev();
    else handleNext();
  }, [handlePrev, handleNext]);

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
              {...dragProps}
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
              onNavigatePeriod={handleDragEdgeNavigate}
              {...eventHandlers}
              {...gapProps}
              {...blockProps}
              {...dragProps}
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
            onEventDoubleClick={onEventDoubleClick}
            onEventContextMenu={onEventContextMenu}
            onEventContextMenuOpen={onEventContextMenuOpen}
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
              onEventContextMenu={onEventContextMenu}
              onEventContextMenuOpen={onEventContextMenuOpen}
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
            enableEventDrag={enableEventDrag}
            canDragEvent={canDragEvent}
            onEventDrop={onEventDrop}
            onNavigatePeriod={handleDragEdgeNavigate}
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
          <HeaderDatePicker
            headerTitle={headerTitle}
            view={view}
            currentDate={currentDate}
            onDateSelect={setCurrentDate}
            className="min-w-0 text-sm text-foreground"
          />
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
        ref={calendarBodyRef}
        className="calendar-body relative"
        style={{ '--cal-slots-per-hour': slotsPerHour } as React.CSSProperties}
      >
        {renderView()}
        {/* Aro de "hormigas en marcha" para la cita enfocada desde el buscador.
            Posicionado por rAF en el efecto de arriba; oculto por defecto. */}
        <div ref={focusRingRef} className="calendar-focus-ring" aria-hidden hidden />
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
