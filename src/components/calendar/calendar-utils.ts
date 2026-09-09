import type { Locale } from 'date-fns';
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  getHours,
  getMinutes,
  isSameDay,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from 'date-fns';

import type { CalendarEvent, CalendarGroupBy, CalendarView } from './calendar-types';
import {
  EVENT_STACK_BASE_Z_INDEX,
  EVENT_STACK_LAP_RATIO,
  EVENT_STACK_MAX_Z_BOOST,
  HOUR_SLOT_HEIGHT,
  HOURS_IN_DAY,
} from './calendar-constants';

// ---------------------------------------------------------------------------
// Date range computation
// ---------------------------------------------------------------------------

export function computeDateRange(
  currentDate: Date,
  view: CalendarView
): { start: Date; end: Date } | null {
  const viewStart = startOfDay(currentDate);

  switch (view) {
    case 'day':
      return { start: startOfDay(currentDate), end: endOfDay(currentDate) };
    case '2-day':
      return { start: viewStart, end: endOfDay(addDays(viewStart, 1)) };
    case '3-day':
      return { start: viewStart, end: endOfDay(addDays(viewStart, 2)) };
    case '4-day':
      return { start: viewStart, end: endOfDay(addDays(viewStart, 3)) };
    case '5-day':
      return { start: viewStart, end: endOfDay(addDays(viewStart, 4)) };
    case '6-day':
      return { start: viewStart, end: endOfDay(addDays(viewStart, 5)) };
    case 'week':
      return {
        start: getCalendarViewStartDate(currentDate, view),
        end: endOfWeek(currentDate, { weekStartsOn: 1 }),
      };
    case 'month':
      return { start: startOfMonth(currentDate), end: endOfMonth(currentDate) };
    case 'year':
      return { start: startOfYear(currentDate), end: endOfYear(currentDate) };
    case 'schedule':
      return { start: startOfMonth(currentDate), end: endOfMonth(currentDate) };
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Navigation helpers
// ---------------------------------------------------------------------------

const MULTI_DAY_VIEW_LENGTHS: Partial<Record<CalendarView, number>> = {
  '2-day': 2,
  '3-day': 3,
  '4-day': 4,
  '5-day': 5,
  '6-day': 6,
};

function getMultiDayBlockOffsets(numberOfDays: number): number[] {
  const offsets: number[] = [];

  for (let offset = 0; offset + numberOfDays <= 7; offset += numberOfDays) {
    offsets.push(offset);
  }

  const finalOffset = 7 - numberOfDays;
  if (offsets[offsets.length - 1] !== finalOffset) {
    offsets.push(finalOffset);
  }

  return offsets;
}

/**
 * Returns the first visible date for a calendar view.
 *
 * Multi-day views are split into blocks anchored to Monday. The final block is
 * shifted back when needed so it stays inside the same Monday-Sunday week.
 */
export function getCalendarViewStartDate(currentDate: Date, view: CalendarView): Date {
  if (view === 'week') {
    return startOfWeek(currentDate, { weekStartsOn: 1 });
  }

  const numberOfDays = MULTI_DAY_VIEW_LENGTHS[view];
  if (!numberOfDays) {
    return startOfDay(currentDate);
  }

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const dayOffset = currentDate.getDay() === 0 ? 6 : currentDate.getDay() - 1;
  const blockOffset = Math.min(
    Math.floor(dayOffset / numberOfDays) * numberOfDays,
    7 - numberOfDays
  );

  return addDays(weekStart, blockOffset);
}

export function navigateDate(
  currentDate: Date,
  view: CalendarView,
  direction: 1 | -1
): Date {
  const delta = direction;
  const viewStart = startOfDay(currentDate);
  const numberOfDays = MULTI_DAY_VIEW_LENGTHS[view];

  if (numberOfDays) {
    const weekStart = startOfWeek(viewStart, { weekStartsOn: 1 });
    const blockOffsets = getMultiDayBlockOffsets(numberOfDays);
    const currentOffset = viewStart.getDay() === 0 ? 6 : viewStart.getDay() - 1;
    const currentBlockIndex = blockOffsets.indexOf(currentOffset);
    const nextBlockIndex = currentBlockIndex + direction;

    if (nextBlockIndex < 0) {
      return addDays(addWeeks(weekStart, -1), blockOffsets[blockOffsets.length - 1]);
    }

    if (nextBlockIndex >= blockOffsets.length) {
      return addWeeks(weekStart, 1);
    }

    return addDays(weekStart, blockOffsets[nextBlockIndex]);
  }

  switch (view) {
    case 'day': return addDays(currentDate, delta);
    case 'week': return addWeeks(currentDate, delta);
    case 'year': return addYears(currentDate, delta);
    case 'month':
    case 'schedule':
    default: return addMonths(currentDate, delta);
  }
}

export function computeHeaderTitle(
  currentDate: Date,
  view: CalendarView,
  dateLocale: Locale
): string {
  const start = view === 'week'
    ? getCalendarViewStartDate(currentDate, view)
    : currentDate;
  switch (view) {
    case 'day':
      return format(currentDate, 'MMMM d, yyyy', { locale: dateLocale });
    case '2-day':
      return `${format(start, 'MMMM d', { locale: dateLocale })} - ${format(addDays(start, 1), 'd, yyyy', { locale: dateLocale })}`;
    case '3-day':
      return `${format(start, 'MMMM d', { locale: dateLocale })} - ${format(addDays(start, 2), 'd, yyyy', { locale: dateLocale })}`;
    case '4-day':
      return `${format(start, 'MMMM d', { locale: dateLocale })} - ${format(addDays(start, 3), 'd, yyyy', { locale: dateLocale })}`;
    case '5-day':
      return `${format(start, 'MMMM d', { locale: dateLocale })} - ${format(addDays(start, 4), 'd, yyyy', { locale: dateLocale })}`;
    case '6-day':
      return `${format(start, 'MMMM d', { locale: dateLocale })} - ${format(addDays(start, 5), 'd, yyyy', { locale: dateLocale })}`;
    case 'week': {
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return `${format(start, 'MMMM d', { locale: dateLocale })} - ${format(end, 'd, yyyy', { locale: dateLocale })}`;
    }
    case 'year':
      return format(currentDate, 'yyyy', { locale: dateLocale });
    case 'month':
    case 'schedule':
    default:
      return format(currentDate, 'MMMM yyyy', { locale: dateLocale });
  }
}

// ---------------------------------------------------------------------------
// Event time formatting
// ---------------------------------------------------------------------------

export function formatEventTime(value: Date | string, dateLocale: Locale): string {
  const dateValue = typeof value === 'string' ? parseISO(value) : value;
  return format(dateValue, 'p', { locale: dateLocale });
}

// ---------------------------------------------------------------------------
// Event positioning in time grid
// ---------------------------------------------------------------------------

export function getEventStyle(
  event: CalendarEvent,
  hourSlotHeight: number = HOUR_SLOT_HEIGHT
): React.CSSProperties {
  const start = typeof event.start === 'string' ? parseISO(event.start) : event.start;
  const end = typeof event.end === 'string' ? parseISO(event.end) : event.end;
  const top = (getHours(start) + getMinutes(start) / 60) * hourSlotHeight;
  const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
  const height = (durationMinutes / 60) * hourSlotHeight;
  return {
    top: `${top}px`,
    height: `${height}px`,
    backgroundColor: event.color || 'hsl(var(--primary))',
  };
}

/**
 * Returns a text color (`#111` or `#fff`) that contrasts well with the given
 * hex background. Uses the WCAG relative luminance formula. Falls back to
 * white when the input is not a parseable hex (e.g. `hsl(...)`).
 */
export function getReadableTextColor(bg?: string | null): string {
  if (!bg) return '#fff';
  const hex = bg.startsWith('#') ? bg.slice(1) : '';
  if (hex.length !== 6 && hex.length !== 8) return '#fff';
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return '#fff';
  // Perceived brightness (0–1). Threshold 0.6 picks dark text on light pastels.
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#111' : '#fff';
}

/** Luminancia relativa WCAG de un color hex. `null` si no se puede parsear. */
function relativeLuminance(color?: string | null): number | null {
  if (!color) return null;
  const hex = color.startsWith('#') ? color.slice(1) : '';
  if (hex.length !== 6 && hex.length !== 8) return null;
  const channels = [0, 2, 4].map((i) => parseInt(hex.substring(i, i + 2), 16));
  if (channels.some(Number.isNaN)) return null;

  const [r, g, b] = channels.map((value) => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contraste mínimo WCAG para un elemento no textual, como este ícono de 14px. */
const MIN_ICON_CONTRAST = 3;

/**
 * Color del ícono de estado (`#111` o `#fff`) sobre el círculo pintado con el
 * color del estado.
 *
 * Se queda en blanco —que es el lenguaje visual del calendario— y solo cambia a
 * oscuro cuando el blanco no llega al mínimo legible. Con la paleta actual eso
 * pasa en tres estados: "Llegó" (#f59e0b, 2.15:1), "Pendiente" (#9ca3af, 2.54:1)
 * y "En curso" (#f97316, 2.80:1). El resto se ve exactamente igual que antes.
 *
 * A propósito no se elige "el que más contraste dé": eso daría ícono oscuro en
 * casi toda la paleta y cambiaría el aspecto de todo el calendario para arreglar
 * tres casos.
 */
export function getContrastingIconColor(bg?: string | null): string {
  const lum = relativeLuminance(bg);
  if (lum === null) return '#fff';

  const contrastWithWhite = 1.05 / (lum + 0.05);
  return contrastWithWhite < MIN_ICON_CONTRAST ? '#111' : '#fff';
}

// ---------------------------------------------------------------------------
// Event group value
// ---------------------------------------------------------------------------

export function getEventGroupValue(
  event: CalendarEvent,
  groupBy: CalendarGroupBy
): string | undefined {
  if (groupBy === 'doctor') return event.doctorGroupId;
  if (groupBy === 'calendar') return event.calendarGroupId;
  return undefined;
}

// ---------------------------------------------------------------------------
// Event overlap layout algorithm
// ---------------------------------------------------------------------------

/** Milisegundos de un `start`/`end`, que puede venir como Date o como ISO. */
function toMs(value: Date | string): number {
  return (typeof value === 'string' ? parseISO(value) : value).getTime();
}

/**
 * Momento de creación del evento en ms, o `null` si no se puede determinar.
 * Se le saca la `Z` final como en el resto de la app: acá solo importa que el orden
 * entre eventos sea consistente, no el huso. `data` puede ser una cita (`created_at`
 * opcional), un recordatorio (obligatorio) o cualquier otra cosa: no se asume nada.
 */
function getCreationTime(event: CalendarEvent): number | null {
  const raw = event.data?.created_at ?? event.data?.createdat ?? event.data?.createdAt;
  if (typeof raw !== 'string' || raw.length === 0) return null;
  const ms = parseISO(raw.replace(/Z$/, '')).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Id numérico del registro, respaldo del `created_at`: la PK de `appointments` es un
 * autoincremental, o sea monótona por creación. Los recordatorios llegan con el id
 * prefijado (`reminder-42`), así que se toma la primera corrida de dígitos.
 */
function getNumericId(event: CalendarEvent): number | null {
  const digits = String(event.data?.id ?? event.id ?? '').match(/\d+/);
  return digits ? Number(digits[0]) : null;
}

/**
 * Desempate por antigüedad: primero la creada antes, que es la que queda al fondo.
 *
 * Los timestamps se comparan solo si los dos eventos los tienen — mezclar un timestamp
 * (~1.7e12) con un id (~1e3) le daría siempre la ventaja al que tiene fecha, que es un
 * orden arbitrario disfrazado. Si no, se comparan ids numéricos; y como último recurso
 * el id textual, para que el layout sea función del CONJUNTO de eventos y no del orden
 * en que los devolvió la API (que no está garantizado).
 */
function compareByCreation(a: CalendarEvent, b: CalendarEvent): number {
  const createdA = getCreationTime(a);
  const createdB = getCreationTime(b);
  if (createdA !== null && createdB !== null && createdA !== createdB) {
    return createdA - createdB;
  }

  const idA = getNumericId(a);
  const idB = getNumericId(b);
  if (idA !== null && idB !== null && idA !== idB) return idA - idB;

  return String(a.id).localeCompare(String(b.id));
}

/**
 * Reparte las citas solapadas de un día en una cascada estilo Google Calendar.
 *
 * El reparto se hace en dos pasos, como en Google Calendar. Primero cada cita cae en
 * un nivel (columna) del grupo de solapadas, que le fija el borde izquierdo. Después
 * cada card SE ESTIRA hacia la derecha hasta que choca con otra que se le solapa en el
 * tiempo; si no hay ninguna, hasta el borde derecho de la columna.
 *
 * Ese segundo paso es el que hace la diferencia: repartir a ciegas dejaba a las tres
 * citas de un grupo en un tercio del ancho aunque no se pisaran entre sí, y estirar
 * todas hasta el borde derecho tapaba por completo a la de atrás. Así, la de atrás
 * conserva su franja legible y las que no tienen nada al lado ocupan todo lo que hay.
 *
 * Devuelve COPIAS en orden de dibujado (la de más atrás primero) con la geometría ya
 * resuelta. No muta la entrada: los eventos vienen memoizados desde la página y el
 * layout se recalcula en cada render.
 */
export function getEventsWithLayout(dayEvents: CalendarEvent[]): CalendarEvent[] {
  if (dayEvents.length === 0) return [];

  // Por hora de inicio (el agrupado de abajo lo necesita ascendente); a igual inicio,
  // primero la más larga, que es la que queda atrás y a la izquierda; y a igual
  // duración, la creada primero.
  const sortedEvents = [...dayEvents].sort((a, b) => {
    const startA = toMs(a.start);
    const startB = toMs(b.start);
    if (startA !== startB) return startA - startB;

    const endA = toMs(a.end);
    const endB = toMs(b.end);
    if (endA !== endB) return endB - endA;

    return compareByCreation(a, b);
  });

  // Grupos de citas encadenadas por solapamiento. `clusterEnd` es el máximo `end`
  // visto: una cita que arranca justo cuando termina la anterior (back-to-back) no
  // solapa, abre un grupo nuevo y se dibuja a ancho completo.
  const clusters: CalendarEvent[][] = [];
  let currentCluster: CalendarEvent[] = [];
  let clusterEnd = 0;

  sortedEvents.forEach((event) => {
    const start = toMs(event.start);
    const end = toMs(event.end);

    if (start >= clusterEnd) {
      if (currentCluster.length > 0) clusters.push(currentCluster);
      currentCluster = [event];
      clusterEnd = end;
    } else {
      currentCluster.push(event);
      clusterEnd = Math.max(clusterEnd, end);
    }
  });
  if (currentCluster.length > 0) clusters.push(currentCluster);

  const positionedEvents: CalendarEvent[] = [];

  clusters.forEach((cluster) => {
    // Packing greedy: cada cita ocupa el primer nivel cuyo último evento ya terminó.
    // Reusar niveles mantiene la cascada lo más corta posible y, por lo tanto, las
    // cards lo más anchas posible; dos citas del mismo nivel nunca se solapan en el
    // tiempo, así que compartir corrimiento no las tapa.
    const levelLastEnd: number[] = [];
    const levels: number[] = [];

    cluster.forEach((event, index) => {
      const start = toMs(event.start);
      let level = levelLastEnd.findIndex((lastEnd) => lastEnd <= start);
      if (level === -1) level = levelLastEnd.length;
      levelLastEnd[level] = toMs(event.end);
      levels[index] = level;
    });

    // Las citas de cada nivel, para poder preguntar si un nivel bloquea a una card.
    const byLevel: CalendarEvent[][] = [];
    cluster.forEach((event, index) => {
      const level = levels[index];
      if (!byLevel[level]) byLevel[level] = [];
      byLevel[level].push(event);
    });

    // El corrimiento sale de la cantidad de niveles del grupo, así que se adapta solo
    // a su densidad: con 2 niveles el escalón es del 50%, con 8 del 12,5%. No hace
    // falta ningún tope artificial.
    const totalLevels = levelLastEnd.length;
    const levelWidth = 100 / totalLevels;
    const lap = levelWidth * EVENT_STACK_LAP_RATIO;

    cluster.forEach((event, index) => {
      const level = levels[index];
      const start = toMs(event.start);
      const end = toMs(event.end);

      // Hasta dónde puede estirarse: avanza por los niveles de la derecha mientras
      // ninguno tenga una cita que se le solape en el tiempo.
      let span = 1;
      for (let next = level + 1; next < totalLevels; next += 1) {
        const blocked = (byLevel[next] ?? []).some(
          (other) => toMs(other.start) < end && toMs(other.end) > start,
        );
        if (blocked) break;
        span += 1;
      }

      const left = level * levelWidth;
      // Sin nada que la bloquee llega al borde derecho; si algo la bloquea se queda en
      // los niveles que alcanzó más un pedacito por debajo de la de adelante.
      const width = level + span >= totalLevels
        ? 100 - left
        : Math.min(span * levelWidth + lap, 100 - left);

      positionedEvents.push({
        ...event,
        stackLevel: level,
        stackLeftPercent: left,
        stackWidthPercent: width,
        // Derivado del NIVEL, no de la posición en el grupo: al reusar niveles, una
        // cita de nivel bajo puede dibujarse después de una de nivel alto y, siendo
        // más ancha, taparla. El z-index tiene que ser coherente con el corrimiento
        // horizontal — a más corrida, más arriba.
        stackZIndex: EVENT_STACK_BASE_Z_INDEX + Math.min(level, EVENT_STACK_MAX_Z_BOOST),
      });
    });
  });

  return positionedEvents;
}

// ---------------------------------------------------------------------------
// Filter events by day (and optionally by group)
// ---------------------------------------------------------------------------

export function filterEventsByDay(
  events: CalendarEvent[],
  day: Date
): CalendarEvent[] {
  return events.filter((event) => {
    const eventStart = typeof event.start === 'string' ? parseISO(event.start) : event.start;
    return isSameDay(eventStart, day);
  });
}

export function filterEventsByDayAndGroup(
  events: CalendarEvent[],
  day: Date,
  groupBy: CalendarGroupBy,
  groupValue: string
): CalendarEvent[] {
  return events.filter((event) => {
    const eventStart = typeof event.start === 'string' ? parseISO(event.start) : event.start;
    return isSameDay(eventStart, day) && getEventGroupValue(event, groupBy) === groupValue;
  });
}

// ---------------------------------------------------------------------------
// Time slots generation
// ---------------------------------------------------------------------------

export function generateTimeSlots(count = 24): string[] {
  return Array.from({ length: count }, (_, i) => `${i.toString().padStart(2, '0')}:00`);
}

/**
 * Snap a vertical click offset (px from the top of the time grid) to the start of
 * the slot it falls in, based on the configured slot duration. With 10-min slots
 * (6 per hour) clicking the 13:00 hour yields 13:00/13:10/.../13:50; with 20-min
 * slots (3 per hour) it yields 13:00/13:20/13:40.
 *
 * `y` se acota al día antes de convertir. Con un clic nunca se sale de la caja,
 * pero al arrastrar el puntero sí: sin la cota, una `y` negativa da `hour = -1` y
 * `set(day, { hours: -1 })` cae callado en el día anterior a las 23:00, y una `y`
 * mayor al alto de la columna hace roll-over al día siguiente.
 */
export function slotTimeFromOffset(
  y: number,
  hourSlotHeight: number,
  slotMinutes = 15,
): { hour: number; minute: number } {
  const safeSlot = slotMinutes > 0 ? slotMinutes : 15;
  const slotsPerHour = Math.max(1, Math.round(60 / safeSlot));
  const safeY = Math.max(0, Math.min(y, HOURS_IN_DAY * hourSlotHeight - 1));
  const hour = Math.min(HOURS_IN_DAY - 1, Math.floor(safeY / hourSlotHeight));
  const slotPx = hourSlotHeight / slotsPerHour;
  const idx = Math.max(0, Math.min(slotsPerHour - 1, Math.floor((safeY % hourSlotHeight) / slotPx)));
  return { hour, minute: idx * safeSlot };
}

// ---------------------------------------------------------------------------
// Format 24h slot label to 12h AM/PM
// ---------------------------------------------------------------------------

export function formatTimeSlotLabel(time: string): string {
  const hour24 = parseInt(time.split(':')[0], 10);
  const isPM = hour24 >= 12;
  const ampm = isPM ? 'PM' : 'AM';
  let hour12 = hour24 % 12;
  if (hour12 === 0) hour12 = 12;
  return `${hour12} ${ampm}`;
}
