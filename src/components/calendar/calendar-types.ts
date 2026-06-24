export type CalendarView = 'day' | 'week' | 'month' | 'year' | '2-day' | '3-day' | 'schedule';

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
  onViewChange?: (view: CalendarView) => void;
  groupBy?: CalendarGroupBy;
  groupingColumns?: CalendarGroupingColumn[];
  onEventColorChange: (event: any, colorId: string) => void;
  onSlotClick?: CalendarSlotClickHandler;
  onEventContextMenu?: (event: any) => React.ReactNode;
  /** Content rendered inside the mobile bottom sheet for filters */
  filterSheet?: React.ReactNode;
  /** Content rendered in the header next to navigation controls (mobile) or alongside children (desktop) */
  extraActions?: React.ReactNode;
  /** Content rendered in the header after the Today button */
  extraActionsAfterToday?: React.ReactNode;
  /** Primary action (e.g. Create) — kept on the first header row, after Refresh */
  primaryActions?: React.ReactNode;
  /** Content rendered at the end of the desktop header actions */
  trailingActions?: React.ReactNode;
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
