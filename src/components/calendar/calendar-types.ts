export type CalendarView = 'day' | 'week' | 'month' | 'year' | '2-day' | '3-day' | 'schedule';

export type CalendarGroupBy = 'none' | 'doctor' | 'calendar';

export type CalendarBreakpoint = 'mobile' | 'tablet' | 'desktop';

export interface CalendarEvent {
  id: string;
  title: string;
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

export interface CalendarProps {
  events?: CalendarEvent[];
  onDateChange?: (range: { start: Date; end: Date }) => void;
  children?: React.ReactNode;
  isLoading?: boolean;
  onEventClick: (event: any) => void;
  onViewChange?: (view: CalendarView) => void;
  groupBy?: CalendarGroupBy;
  groupingColumns?: CalendarGroupingColumn[];
  onEventColorChange: (event: any, colorId: string) => void;
  onSlotClick?: (date: Date) => void;
  onEventContextMenu?: (event: any) => React.ReactNode;
  /** Content rendered inside the mobile bottom sheet for filters */
  filterSheet?: React.ReactNode;
}
