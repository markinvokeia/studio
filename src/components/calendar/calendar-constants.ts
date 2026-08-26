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

/** Selectable default slot durations (minutes). Defines how many slots fit in an
 *  hour (60/duration) and therefore how tall one slot ends up being for a given
 *  hour height. */
export const SLOT_DURATION_OPTIONS = [10, 15, 20, 30, 60] as const;
export type SlotDuration = (typeof SLOT_DURATION_OPTIONS)[number];
export const DEFAULT_SLOT_DURATION: SlotDuration = 15;

/** Piso de render para un slot: por debajo de esto la rejilla deja de leerse como
 *  rejilla (las líneas se solapan y las citas quedan sub-píxel). NO es un piso de
 *  legibilidad: la altura de hora configurada se respeta literal y solo se acota
 *  aquí, en el extremo inferior del zoom. */
export const MIN_VISIBLE_SLOT_PX = 5;

/** Umbrales, en px de alto REAL de la card, para adaptar su contenido a la densidad.
 *  La card nunca se infla para alcanzarlos: es el contenido el que se compacta, de
 *  modo que su alto siga siendo exactamente proporcional a la duración de la cita
 *  y los huecos entre citas nunca queden tapados. */
export const EVENT_DENSITY_NORMAL_PX = 34;
export const EVENT_DENSITY_COMPACT_PX = 18;

/** How the label shown on each appointment is composed.
 *  - time_patient_notes:     "HH:mm - Patient - (Notes)"   (default)
 *  - patient_treatment_time: "Patient - Treatment - HH:mm" */
export const EVENT_LABEL_FORMATS = ['time_patient_notes', 'patient_treatment_time'] as const;
export type EventLabelFormat = (typeof EVENT_LABEL_FORMATS)[number];
export const DEFAULT_EVENT_LABEL_FORMAT: EventLabelFormat = 'time_patient_notes';

/** Whether appointments in a status other than "scheduled" paint the whole card
 *  with the status color. On by default when the user's preferences are created. */
export const DEFAULT_COLOR_BY_STATUS = true;

/** Hour to auto-scroll to on initial day/week view render (working day start) */
export const DEFAULT_SCROLL_HOUR = 8;

/** Calendar display modes.
 *  - invoke: the calendar as it works today (multi-column when grouped).
 *  - custom: one agenda/calendar shown at a time, full-width, chosen from the
 *    "Agendas" side panel. */
export const CALENDAR_MODES = ['invoke', 'custom'] as const;
export type CalendarMode = (typeof CALENDAR_MODES)[number];
export const DEFAULT_CALENDAR_MODE: CalendarMode = 'invoke';
