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
  colorId?: string;
  doctorGroupId?: string;
  calendarGroupId?: string;
  totalColumns?: number;
  column?: number;
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
  onEventClick: (event: any) => void;
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
  /** Right-click on an empty slot — used to offer appointment vs reminder creation. */
  onSlotContextMenu?: CalendarSlotClickHandler;
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
}
