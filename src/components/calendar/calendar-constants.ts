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

/** Azul de Google Calendar, para el badge de las citas importadas desde ahí. */
export const GOOGLE_IMPORT_BADGE_COLOR = '#4285F4';

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

/** Horas y minutos de un día. Cotas de la conversión px <-> tiempo de la rejilla. */
export const HOURS_IN_DAY = 24;
export const MINUTES_IN_DAY = HOURS_IN_DAY * 60;

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

/** Cuánto se estira una card apilada por debajo de la que tiene a su derecha, como
 *  fracción del ancho de una columna del grupo.
 *
 *  Es lo que hace que el apilado se lea como cards superpuestas y no como columnas
 *  pegadas: donde la de adelante no la tapa —porque en esa altura no coinciden— la de
 *  atrás asoma este pedazo de más. Solo se aplica a las cards que tienen algo que las
 *  bloquea; las que no, se estiran hasta el borde derecho. */
export const EVENT_STACK_LAP_RATIO = 0.25;

/** z-index base de las cards; coincide con `.event-in-day-view` en Calendar.css. */
export const EVENT_STACK_BASE_Z_INDEX = 10;

/** Techo de lo que el z-index puede subir sobre la base. Generoso a propósito:
 *  `.day-column-content` aísla su contexto de apilamiento, así que estos valores no
 *  compiten con la columna de horas ni con la línea de la hora actual. */
export const EVENT_STACK_MAX_Z_BOOST = 40;

/** Umbral de movimiento, en px, para que un pointerdown con mouse pase a ser un
 *  arrastre. En px fijos y no en minutos a propósito: a zoom mínimo (20 px/hora)
 *  5 px ya son 15 minutos, así que el snap se calcula desde la posición absoluta
 *  del puntero, nunca desde el delta. */
export const DRAG_THRESHOLD_PX = 4;

/** Táctil: cuánto hay que mantener apretado antes de que el gesto pueda pasar a
 *  arrastre. Por debajo del long-press de 700 ms del menú contextual de Radix, que
 *  se conserva: si el dedo NO se mueve, gana el menú. */
export const DRAG_LONG_PRESS_MS = 300;

/** Táctil: cuánto se puede mover el dedo antes de que gane el scroll de la grilla. */
export const DRAG_TOUCH_SLOP_PX = 8;

/** Banda del borde del contenedor donde el arrastre empieza a auto-scrollear. */
export const DRAG_AUTO_SCROLL_EDGE_PX = 48;

/** Velocidad máxima del auto-scroll, en px por frame. */
export const DRAG_AUTO_SCROLL_MAX_SPEED_PX = 18;

/** z-index del fantasma. Local a `.day-column-content`, que aísla su contexto de
 *  apilamiento, así que solo compite con las cards de su propia columna. */
export const DRAG_GHOST_Z_INDEX = EVENT_STACK_BASE_Z_INDEX + EVENT_STACK_MAX_Z_BOOST + 1;

/** How the label shown on each appointment is composed.
 *  - time_patient_notes:           "HH:mm - Patient - (Notes)"
 *  - patient_treatment_time:       "Patient - Treatment - HH:mm"
 *  - time_patient_notes_treatment: "HH:mm - Patient phone - (Notes, Treatment)"   (default)
 *  - time_treatment_patient_notes: "HH:mm - Treatment - Patient - Phone - (Notes)" */
export const EVENT_LABEL_FORMATS = ['time_patient_notes', 'patient_treatment_time', 'time_patient_notes_treatment', 'time_treatment_patient_notes'] as const;
export type EventLabelFormat = (typeof EVENT_LABEL_FORMATS)[number];
export const DEFAULT_EVENT_LABEL_FORMAT: EventLabelFormat = 'time_patient_notes_treatment';

/** Whether appointments in a status other than "scheduled" paint the whole card
 *  with the status color. On by default when the user's preferences are created. */
export const DEFAULT_COLOR_BY_STATUS = true;

/** Hour to auto-scroll to on initial day/week view render (working day start) */
export const DEFAULT_SCROLL_HOUR = 8;

/** Calendar display modes.
 *  - invoke: the calendar as it works today (multi-column when grouped).
 *  - custom: one agenda/calendar shown at a time, full-width, chosen from the
 *    "Agendas" side panel.   (default) */
export const CALENDAR_MODES = ['invoke', 'custom'] as const;
export type CalendarMode = (typeof CALENDAR_MODES)[number];
export const DEFAULT_CALENDAR_MODE: CalendarMode = 'custom';
