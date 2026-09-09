export type CalendarView = 'day' | 'week' | 'month' | 'year' | '2-day' | '3-day' | '4-day' | '5-day' | '6-day' | 'schedule';

export type CalendarGroupBy = 'none' | 'doctor' | 'calendar';

export type CalendarBreakpoint = 'mobile' | 'tablet' | 'desktop';

export interface CalendarEvent {
  id: string;
  title: string;
  /** Pre-composed display label shown on the event block. When set, renderers
   *  show this instead of `title` + a separate time (the time is part of it). */
  label?: string;
  start: Date | string;
  end: Date | string;
  color?: string;
  /** `color` comes from the appointment's status, not from the calendar/service.
   *  The cards read it to skip the cancelled stripes and to keep the corner
   *  status icon legible over a card already painted in that same color. */
  statusColored?: boolean;
  /** Color del estado para la franja del borde izquierdo. Solo lo llevan las citas
   *  con color propio o de servicio, que conservan su fondo. Las que solo heredan
   *  el color del doctor o del consultorio usan `statusColored` y se pintan
   *  enteras. Los dos campos son excluyentes. */
  statusStripeColor?: string;
  colorId?: string;
  doctorGroupId?: string;
  calendarGroupId?: string;
  /** Nivel de apilado dentro del grupo de citas solapadas: 0 es la de más atrás —la
   *  más larga, o la creada primero— y cada nivel se corre hacia la derecha. Lo
   *  calcula `getEventsWithLayout`. */
  stackLevel?: number;
  /** Geometría de la card, en % del ancho de la columna. El ancho no es fijo: cada
   *  card se estira hacia la derecha hasta la que se le solapa, o hasta el borde
   *  derecho si no hay ninguna. */
  stackLeftPercent?: number;
  stackWidthPercent?: number;
  /** z-index de la card: a mayor valor, dibujada más arriba. Local a
   *  `.day-column-content`, que aísla su contexto de apilamiento. */
  stackZIndex?: number;
  /** El evento no se puede mover ni redimensionar (estado terminal, sin permiso,
   *  recordatorio ajeno). Lo resuelve la página al construir los eventos, para no
   *  meter reglas de permisos ni de negocio en los componentes del calendario. */
  locked?: boolean;
  data?: any;
}

export interface CalendarGroupingColumn {
  id: string;
  label: string;
  value: string;
  /** Optional accent color rendered as a dot in the column header */
  color?: string;
}

export interface CalendarSlotClickContext {
  groupBy: Exclude<CalendarGroupBy, 'none'>;
  value: string;
}

export type CalendarSlotClickHandler = (date: Date, context?: CalendarSlotClickContext) => void;

export interface CalendarSlotContextMenuContext {
  date: Date;
  context?: CalendarSlotClickContext;
  isBlocked: boolean;
}

export type CalendarSlotContextMenuRenderer = (slot: CalendarSlotContextMenuContext) => React.ReactNode;

// ---------------------------------------------------------------------------
// Drag & drop / resize
// ---------------------------------------------------------------------------

export type CalendarDragMode = 'move' | 'resize-start' | 'resize-end';

/** Fase del gesto. `pending` = hubo pointerdown pero todavía no se cruzó el umbral
 *  (mouse) ni se confirmó el hold (táctil): el clic y el doble clic siguen vivos. */
export type CalendarDragPhase = 'idle' | 'pending' | 'dragging';

/** Columna (día x grupo) bajo el puntero. `element` es el `.day-column-content` en
 *  las rejillas y la celda `.calendar-day` en el mes. */
export interface CalendarDragTarget {
  dayKey: string;
  day: Date;
  groupValue?: string;
  element: HTMLElement;
  rect: DOMRect;
}

/** Gesto en curso, congelado en el pointerdown. */
export interface CalendarDragGesture {
  event: CalendarEvent;
  mode: CalendarDragMode;
  originalStart: Date;
  originalEnd: Date;
  /** px entre el puntero y el borde superior de la card (solo `move`): sin esto la
   *  card salta para que su inicio quede bajo el cursor. */
  grabOffsetY: number;
  pointerId: number;
  pointerType: string;
  element: HTMLElement;
  sourceTarget: CalendarDragTarget;
}

/** Placement candidato mientras se arrastra. Solo cambia al cruzar un slot. */
export interface CalendarDragCandidate {
  start: Date;
  end: Date;
  /** La vista ya sabe que cae sobre una banda bloqueada de esa columna. */
  invalid: boolean;
}

export type CalendarDragResolver = (
  gesture: CalendarDragGesture,
  pointer: { x: number; y: number },
) => { target: CalendarDragTarget; candidate: CalendarDragCandidate } | null;

/** Lo que el fantasma necesita saber. Referencia estable mientras no cambie el snap. */
export interface CalendarDragPreview {
  eventId: string;
  mode: CalendarDragMode;
  dayKey: string;
  groupValue?: string;
  start: Date;
  end: Date;
  invalid: boolean;
  pointer: { x: number; y: number };
}

/** Lo que sube a la página al soltar. Fechas en hora local de pared. */
export interface CalendarDragResult {
  /** `event.data`: la cita o el recordatorio. */
  data: any;
  eventId: string;
  mode: CalendarDragMode;
  start: Date;
  end: Date;
  originalStart: Date;
  originalEnd: Date;
  /** Misma forma que el contexto del clic en un slot, así la página reutiliza el
   *  mapeo `context.value -> calendar id` que ya tiene en `handleSlotClick`. */
  context?: CalendarSlotClickContext;
  /** La vista determinó que el destino está bloqueado. La página igual corre su
   *  chequeo autoritativo, pero con esto puede cortar sin preguntar nada. */
  blocked: boolean;
}

export type CalendarEventDropHandler = (result: CalendarDragResult) => void;

/** Store del preview. Lo consume solo el fantasma, vía useSyncExternalStore. */
export interface CalendarDragStore {
  subscribe: (fn: () => void) => () => void;
  /** Debe devolver SIEMPRE la misma referencia hasta que el snap cambie: una
   *  referencia nueva por llamada haría loop infinito en useSyncExternalStore. */
  getSnapshot: () => CalendarDragPreview | null;
  getServerSnapshot: () => null;
}

/** A pending in-canvas appointment being created at a slot. */
export interface InlineDraft {
  /** Start date/time of the draft. */
  date: Date;
  /** Duration in minutes (drives the card height). */
  durationMin: number;
  /** Grouping column value (doctor/calendar id) when in a grouped view. */
  groupValue?: string;
}

export interface CalendarProps {
  events?: CalendarEvent[];
  onDateChange?: (range: { start: Date; end: Date }) => void;
  children?: React.ReactNode;
  isLoading?: boolean;
  /** `anchorRect` es el rect del elemento clickeado, para anclarle una ventana
   *  flotante de detalle. Lo mandan todas las vistas que dibujan citas. */
  onEventClick: (event: any, anchorRect?: DOMRect) => void;
  view?: CalendarView;
  defaultView?: CalendarView;
  /** Height in px of one hour slot in the day/week time grid. Defaults to HOUR_SLOT_HEIGHT. */
  hourSlotHeight?: number;
  /** Default slot duration in minutes. Sets how many slots fit per hour and floors
   *  the row height so each slot's appointment title stays readable. Default 15. */
  slotMinutes?: number;
  onViewChange?: (view: CalendarView) => void;
  groupBy?: CalendarGroupBy;
  groupingColumns?: CalendarGroupingColumn[];
  onEventColorChange: (event: any, colorId: string) => void;
  /** Double-click on an event — used to open inline edit on time-grid views. */
  onEventDoubleClick?: (event: any) => void;
  onSlotClick?: CalendarSlotClickHandler;
  /** Explicit "create" action (mobile FAB) — always opens the modal, bypassing inline creation. */
  onCreateClick?: () => void;
  /** Menu body for right-clicking an empty time-grid slot. */
  renderSlotContextMenu?: CalendarSlotContextMenuRenderer;
  onEventContextMenu?: (event: any) => React.ReactNode;
  /** Fires when an event's context menu opens — used to lazily load per-appointment data. */
  onEventContextMenuOpen?: (event: any) => void;
  /** Inline appointment-creation draft, positioned on the time grid like an event. */
  inlineDraft?: InlineDraft | null;
  /** Renders the inline creation form inside the positioned draft card. */
  renderInlineDraft?: () => React.ReactNode;
  /** Content rendered inside the mobile bottom sheet for filters */
  filterSheet?: React.ReactNode;
  /** Hide the static "Calendar" header title (custom mode). */
  hideTitle?: boolean;
  /** Render the prev/next arrows before the "Today" button (custom mode). */
  arrowsBeforeToday?: boolean;
  /** Hide the 60px main hour gutter (and its GMT checkbox) on grid views (custom mode). */
  hideTimeGutter?: boolean;
  /** Controlled zoom value (slot-height scale). When provided, overrides internal state. */
  zoom?: number;
  /** Called when zoom changes (controlled mode). */
  onZoomChange?: (zoom: number) => void;
  /** Whether to render the floating zoom slider. Default true. */
  showZoomSlider?: boolean;
  /** Content rendered at the very top-left of the header, before the title
   *  (e.g. the "Agendas" toggle button in custom mode). */
  leadingActions?: React.ReactNode;
  /** Content rendered in the header next to navigation controls (mobile) or alongside children (desktop) */
  extraActions?: React.ReactNode;
  /** Content rendered in the header after the Today button */
  extraActionsAfterToday?: React.ReactNode;
  /** Primary action (e.g. Create) — kept on the first header row, after Refresh */
  primaryActions?: React.ReactNode;
  /** Content rendered at the end of the desktop header actions */
  trailingActions?: React.ReactNode;
  /** Callback ref to the desktop header's action cluster, so the page can observe its
   *  overflow and collapse buttons to icon-only. Fires with the node on mount and null
   *  on unmount (e.g. when the compact header replaces the desktop one). */
  headerActionsClusterRef?: React.RefCallback<HTMLDivElement>;
  /** IDs of appointments currently selected in bulk mode */
  selectedAppointmentIds?: Set<string>;
  /** Called when the user clicks the checkbox on a schedule-view event */
  onToggleAppointmentSelect?: (id: string) => void;
  /** When provided, replaces the entire desktop header with this content */
  bulkModeContent?: React.ReactNode;
  /** Free-slot ("Huecos") highlights to overlay on the current view */
  gaps?: import('./calendar-gaps').Gap[];
  /** Key of the currently selected gap (emphasized) */
  selectedGapKey?: string;
  /** Called when a gap highlight is clicked */
  onGapClick?: (gap: import('./calendar-gaps').Gap) => void;
  /** Non-working time bands ("No disponible") to overlay on grid views */
  blockedRanges?: import('./calendar-gaps').BlockedRange[];
  /** Days (yyyy-MM-dd) fully closed — month cells become non-clickable */
  blockedFullDays?: Set<string>;
  /** Habilita mover y redimensionar eventos en la rejilla. Apagado por defecto: la
   *  página lo prende solo en modo custom y cuando el usuario puede actualizar. */
  enableEventDrag?: boolean;
  /** Veto por evento y por modo, evaluado en el pointerdown. Si devuelve false no
   *  se arma el gesto ni se dibujan los tiradores. */
  canDragEvent?: (event: CalendarEvent, mode: CalendarDragMode) => boolean;
  /** Se dispara una vez, al soltar, con el resultado ya snappeado al slot. */
  onEventDrop?: CalendarEventDropHandler;
  /** Ídem, cuando se arrastró uno de los bordes. */
  onEventResize?: CalendarEventDropHandler;
}
