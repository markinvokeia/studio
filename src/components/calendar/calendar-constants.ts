export const GOOGLE_CALENDAR_COLORS = [
  { id: "1", hex: "#a4bdfc" },  // Lavender
  { id: "2", hex: "#7ae7bf" },  // Sage
  { id: "3", hex: "#dbadff" },  // Grape
  { id: "4", hex: "#ff887c" },  // Flamingo
  { id: "5", hex: "#fbd75b" },  // Banana
  { id: "6", hex: "#ffb878" },  // Tangerine
  { id: "7", hex: "#46d6db" },  // Peacock
  { id: "8", hex: "#e1e1e1" },  // Graphite
  { id: "9", hex: "#5484ed" },  // Blueberry
  { id: "10", hex: "#51b749" }, // Basil
  { id: "11", hex: "#dc2127" }, // Tomato
];

/** Percentage of viewport width for the main resource column on mobile */
export const MOBILE_COLUMN_MAIN = 0.85;

/** Percentage of viewport width that peeks for the next resource on mobile */
export const MOBILE_COLUMN_PEEK = 0.15;

/** Maximum days shown in mobile week view */
export const MOBILE_MAX_WEEK_DAYS = 3;

/** Maximum simultaneous resource columns visible on tablet */
export const TABLET_MAX_RESOURCE_COLS = 3;

/** Minimum width in px for a grouped resource column */
export const GROUPED_COLUMN_MIN_WIDTH = 280;

/** Gap between grouped day blocks in rem */
export const GROUPED_DAY_GAP = 1.6;

/** Default height of one hour time slot in px (subdivided into 15-min quarters) */
export const HOUR_SLOT_HEIGHT = 80;

/** Selectable hour-slot heights for the calendar density setting */
export const HOUR_SLOT_HEIGHT_OPTIONS = [60, 80, 100, 120, 140, 160, 180, 200] as const;

/** How the label shown on each appointment is composed.
 *  - time_patient_notes:     "HH:mm - Patient - (Notes)"   (default)
 *  - patient_treatment_time: "Patient - Treatment - HH:mm" */
export const EVENT_LABEL_FORMATS = ['time_patient_notes', 'patient_treatment_time'] as const;
export type EventLabelFormat = (typeof EVENT_LABEL_FORMATS)[number];
export const DEFAULT_EVENT_LABEL_FORMAT: EventLabelFormat = 'time_patient_notes';

/** Hour to auto-scroll to on initial day/week view render (working day start) */
export const DEFAULT_SCROLL_HOUR = 8;
