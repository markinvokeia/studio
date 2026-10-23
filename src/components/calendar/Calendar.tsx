
'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { addDays, format, startOfDay } from 'date-fns';

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
import { CalendarAnchoredInlineDraft, CalendarInlineDraftOverlay } from './inline-draft-overlay';
import { CalendarDraftPreviewProvider } from './calendar-draft-preview';

// Re-export types for backward compatibility
export type { CalendarGroupBy, CalendarEvent, CalendarGroupingColumn, CalendarView } from './calendar-types';

/** Days rendered by each time-grid view, counted from `currentDate` (the navigation
 *  hook already keeps it at the first day of the visible block). */
const TIME_GRID_DAYS: Partial<Record<CalendarView, number>> = {
  day: 1, '2-day': 2, '3-day': 3, '4-day': 4, '5-day': 5, '6-day': 6, week: 7,
};

/**
 * Centra `el` dentro del contenedor scrolleable de la vista (no de la página).
 * `rightInset` descuenta lo que tape un panel flotante a la derecha. Con
 * `onlyIfHidden` no mueve nada si la card ya se ve entera.
 */
function scrollElementIntoGrid(el: HTMLElement, rightInset = 0, onlyIfHidden = false) {
  const er = el.getBoundingClientRect();
  const scroller = el.closest('.day-view-container, .overflow-y-auto') as HTMLElement | null;
  if (!scroller) {
    el.scrollIntoView({ block: onlyIfHidden ? 'nearest' : 'center', inline: 'nearest', behavior: 'smooth' });
    return;
  }
  const sr = scroller.getBoundingClientRect();
  const visRight = sr.right - Math.max(0, rightInset);
  if (onlyIfHidden && er.top >= sr.top && er.bottom <= sr.bottom && er.left >= sr.left && er.right <= visRight) return;
  const maxTop = scroller.scrollHeight - scroller.clientHeight;
  const maxLeft = scroller.scrollWidth - scroller.clientWidth;
  const opts: ScrollToOptions = { behavior: 'smooth' };
  // Vertical: centrar la card en el alto visible; si es más alta que la vista, que
  // al menos se vea su inicio.
  if (maxTop > 1) {
    const top = er.height > scroller.clientHeight
      ? scroller.scrollTop + (er.top - sr.top) - 16
      : scroller.scrollTop + (er.top - sr.top) - scroller.clientHeight / 2 + er.height / 2;
    opts.top = Math.max(0, Math.min(top, maxTop));
  }
  // Horizontal: centrar en el ancho VISIBLE. En vistas multi-día también trae la
  // columna del día correcto.
  if (maxLeft > 1) {
    const visCenter = (sr.left + visRight) / 2;
    const left = scroller.scrollLeft + (er.left + er.width / 2) - visCenter;
    opts.left = Math.max(0, Math.min(left, maxLeft));
  }
  if (opts.top !== undefined || opts.left !== undefined) scroller.scrollTo(opts);
}

/** Resolve view to an effective variant based on breakpoint */
function resolveViewForBreakpoint(view: CalendarView, isMobile: boolean): CalendarView {
  if (!isMobile) return view;
  // On mobile: year becomes month
  if (view === 'year') return 'month';
  return view;
}

const Calendar: React.FC<CalendarProps> = ({
  events = [],
  allDayEvents = [],
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
  hiddenWeekdays,
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
  inlineDraftLayout = 'overlay',
  draftPreview,
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
          // Se descuenta lo que tape un panel a la derecha (el buscador en desktop)
          // para que la card no quede debajo.
          scrollElementIntoGrid(el, focusScrollRightInset ?? 0);
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

  // ── Tarjeta inline flotando junto a la cita + preview en vivo ─────────────
  // En mobile no hay lugar al costado de la cita: ahí sigue la tarjeta centrada.
  const showAnchoredDraft = inlineDraftLayout === 'anchored' && !isMobile && !!inlineDraft && !!renderInlineDraft;
  const activeDraftPreview = showAnchoredDraft ? (draftPreview ?? null) : null;
  const previewStartMs = activeDraftPreview?.start.getTime() ?? null;
  const previewEndMs = activeDraftPreview?.end.getTime() ?? null;
  const previewGroupValue = activeDraftPreview?.groupValue ?? '';
  const previewDayKey = activeDraftPreview ? format(activeDraftPreview.start, 'yyyy-MM-dd') : null;
  const visibleDaysCount = TIME_GRID_DAYS[effectiveView];
  const currentDateKey = format(currentDate, 'yyyy-MM-dd');

  // Un día oculto por preferencia (`hidden_weekdays`, p. ej. fin de semana) se
  // muestra mientras el borrador esté en él: si no, la cita no tendría columna donde
  // dibujarse y el calendario parecería no moverse al elegir esa fecha.
  const previewWeekday = activeDraftPreview ? activeDraftPreview.start.getDay() : null;
  const effectiveHiddenWeekdays = React.useMemo(
    () => (previewWeekday === null || !hiddenWeekdays?.includes(previewWeekday)
      ? hiddenWeekdays
      : hiddenWeekdays.filter((d) => d !== previewWeekday)),
    [hiddenWeekdays, previewWeekday],
  );

  // Si la fecha del borrador queda fuera del rango visible, el calendario navega a
  // ese día. Solo cuenta el día: cambiar la hora dentro del rango no navega.
  React.useEffect(() => {
    if (!previewDayKey || !visibleDaysCount) return;
    const target = new Date(`${previewDayKey}T00:00:00`);
    const rangeStart = startOfDay(currentDate);
    if (target < rangeStart || target >= addDays(rangeStart, visibleDaysCount)) setCurrentDate(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewDayKey, visibleDaysCount]);

  // Centra el preview al abrir la tarjeta y cada vez que cambia su inicio o su
  // columna (fecha, hora, agenda/doctor). Tras navegar a otro día la grilla se
  // vuelve a montar, así que la banda se busca por rAF hasta que aparezca.
  React.useEffect(() => {
    const root = calendarBodyRef.current;
    if (!root || previewStartMs === null) return;
    const startedAt = Date.now();
    let raf = 0;
    const frame = () => {
      const el = root.querySelector<HTMLElement>('[data-draft-preview]');
      if (el) {
        scrollElementIntoGrid(el);
        return;
      }
      if (Date.now() - startedAt < 2000) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [previewStartMs, previewGroupValue, currentDateKey]);

  // Cambiar solo la duración no re-centra (sería mareante mientras se escribe):
  // apenas se asegura de que la card siga entera a la vista.
  React.useEffect(() => {
    const root = calendarBodyRef.current;
    if (!root || previewEndMs === null) return;
    const raf = requestAnimationFrame(() => {
      const el = root.querySelector<HTMLElement>('[data-draft-preview]');
      if (el) scrollElementIntoGrid(el, 0, true);
    });
    return () => cancelAnimationFrame(raf);
  }, [previewEndMs]);

  const sourceEventId = activeDraftPreview?.sourceEventId;
  const sourceEventSelector = sourceEventId
    ? `.calendar-body [data-event-id="${typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(sourceEventId) : sourceEventId}"]`
    : null;
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

  /**
   * Vistas sin rejilla de horas (mes, año, agenda): ahí un ítem de todo el día es una
   * fila más y no hay `top/height` que romper, así que viaja junto al resto. La banda
   * solo existe en las vistas de rejilla, que son las que sí se romperían.
   */
  const eventsWithAllDay = React.useMemo(
    () => (allDayEvents.length === 0 ? events : [...allDayEvents, ...events]),
    [events, allDayEvents],
  );

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
              allDayEvents={allDayEvents}
              groupBy={groupBy}
              groupingColumns={groupingColumns}
              currentTime={currentTime}
              dateLocale={dateLocale}
              hourSlotHeight={effectiveSlotHeight}
              slotMinutes={slotMinutes}
              hiddenWeekdays={effectiveHiddenWeekdays}
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
              allDayEvents={allDayEvents}
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
              hiddenWeekdays={effectiveHiddenWeekdays}
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
            allDayEvents={allDayEvents}
            currentTime={currentTime}
            dateLocale={dateLocale}
            timeZoneLabel={timeZoneLabel}
            hourSlotHeight={effectiveSlotHeight}
            slotMinutes={slotMinutes}
            showTimeColumn={showTimeColumn}
            onToggleTimeColumn={handleToggleTimeColumn}
            hiddenWeekdays={effectiveHiddenWeekdays}
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
            events={eventsWithAllDay}
            dateLocale={dateLocale}
          />
        );

      case 'schedule':
        return (
          <CalendarScheduleView
            events={eventsWithAllDay}
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
              events={eventsWithAllDay}
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
            events={eventsWithAllDay}
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
        <CalendarDraftPreviewProvider value={activeDraftPreview}>
          {renderView()}
        </CalendarDraftPreviewProvider>
        {/* La cita que se está editando se atenúa: el preview marca dónde va a quedar. */}
        {sourceEventSelector && <style>{`${sourceEventSelector} { opacity: 0.35; }`}</style>}
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
      {/* Con preview en vivo, la misma card flota al lado de la cita en la grilla. */}
      {showAnchoredDraft && (
        <CalendarAnchoredInlineDraft
          anchorRoot={calendarBodyRef}
          side={effectiveView === 'day' ? 'right' : 'left'}
        >{renderInlineDraft?.()}</CalendarAnchoredInlineDraft>
      )}
      {inlineDraft && renderInlineDraft && !showAnchoredDraft && (
        <CalendarInlineDraftOverlay>{renderInlineDraft()}</CalendarInlineDraftOverlay>
      )}
    </div>
  );
};

export default Calendar;
