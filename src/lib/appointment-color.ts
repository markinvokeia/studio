import type { Appointment, AppointmentColorSource, CalendarColorSettings, CalendarColorSources } from '@/lib/types';

/** Por defecto cuentan todos los niveles: es el comportamiento previo a que fuera configurable. */
export const DEFAULT_COLOR_SOURCES: CalendarColorSources = {
  service: true,
  doctor: true,
  calendar: true,
};

/** Opciones del resaltado de la vista con el color del calendario. Apagado por defecto. */
export const CALENDAR_VIEW_HIGHLIGHTS = ['off', 'subtle', 'strong', 'full'] as const;

export const DEFAULT_COLOR_SETTINGS: CalendarColorSettings = {
  ...DEFAULT_COLOR_SOURCES,
  highlight: 'off',
};

/** Blanco o casi negro (hex), el que más contraste dé sobre `hex`. Para texto sobre el color de un calendario. */
export const getReadableTextColor = (hex: string): string => {
  let h = hex.trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const lin = (i: number) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * lin(0) + 0.7152 * lin(2) + 0.0722 * lin(4);
  return luminance > 0.179 ? '#0f0f14' : '#ffffff';
};

function hexToHsl(hex: string): [number, number, number] | null {
  let h = hex.trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const hue = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [hue * 60, s, l];
}

/** Oscurece un color hex reduciendo su luminosidad a `factor` de la original (0.8 = 20% más oscuro). */
export const darkenColor = (hex: string, factor: number): string => {
  const hsl = hexToHsl(hex);
  if (!hsl) return hex;
  const [h, s, l] = hsl;
  const nl = l * factor;
  const c = (1 - Math.abs(2 * nl - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = nl - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return '#' + [r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
};

/**
 * Tokens de superficie teñidos con el color de un calendario, para redefinirlos sobre
 * un contenedor (los descendientes que usan `bg-card`, `bg-muted`, `border`… se tiñen
 * solos). Solo superficies: `--primary`/`--accent` y los colores de texto no se tocan,
 * así que el contraste del tema activo se mantiene. Oscuro: tinte profundo; claro: pastel.
 */
export const buildCalendarTintVars = (hex: string, isDark: boolean): Record<string, string> | null => {
  const hsl = hexToHsl(hex);
  if (!hsl) return null;
  const hue = Math.round(hsl[0]);
  // Un color muy saturado pintaría toda la vista de neón: se atenúa.
  const sat = Math.min(hsl[1], 0.6);
  const tone = (satFactor: number, light: number) => `${hue} ${Math.round(sat * satFactor * 100)}% ${light}%`;
  return isDark
    ? {
        '--background': tone(0.55, 13),
        '--card': tone(0.5, 17),
        '--popover': tone(0.5, 15),
        '--muted': tone(0.45, 22),
        '--border': tone(0.45, 29),
        '--input': tone(0.45, 29),
      }
    : {
        '--background': tone(0.7, 93),
        '--card': tone(0.55, 97),
        '--popover': tone(0.55, 97),
        '--muted': tone(0.6, 89),
        '--border': tone(0.5, 80),
        '--input': tone(0.5, 80),
      };
};

/** Blanco cuenta como "sin color" en toda la cadena. */
export const isWhiteColor = (color: string | null | undefined): boolean => {
  if (!color) return true;
  const n = color.toLowerCase().replace(/\s/g, '');
  return n === '#ffffff' || n === '#fff' || n === 'white' || n === 'rgb(255,255,255)' || n === 'rgba(255,255,255,1)' || n === 'hsl(0,0%,100%)';
};

/**
 * Cadena de color de una cita: color propio > servicio > doctor > calendario.
 * Los niveles heredables desactivados en `sources` se saltan; el color propio
 * no es configurable y siempre gana. Devuelve además qué nivel ganó, que el
 * calendario usa para distinguir un color asignado de uno heredado.
 */
export function resolveAppointmentColor({
  ownColor,
  serviceColor,
  doctorColor,
  calendarColor,
  sources = DEFAULT_COLOR_SOURCES,
}: {
  ownColor?: string | null;
  serviceColor?: string | null;
  doctorColor?: string | null;
  calendarColor?: string | null;
  sources?: CalendarColorSources;
}): { color: string | undefined; colorSource: AppointmentColorSource } {
  if (ownColor && !isWhiteColor(ownColor)) return { color: ownColor, colorSource: 'appointment' };
  if (sources.service && serviceColor && !isWhiteColor(serviceColor)) return { color: serviceColor, colorSource: 'service' };
  if (sources.doctor && doctorColor && !isWhiteColor(doctorColor)) return { color: doctorColor, colorSource: 'doctor' };
  if (sources.calendar && calendarColor && !isWhiteColor(calendarColor)) return { color: calendarColor, colorSource: 'calendar' };
  return { color: undefined, colorSource: 'none' };
}

/**
 * Color que le pertenece a la cita, para reenviarlo en un upsert.
 *
 * `appointments/upsert` reescribe la fila entera: la columna `color` que no viaja
 * en el payload queda vacía. Los guardados que no son "elegir color" —mover o
 * redimensionar por arrastre, reasignar doctor o consultorio, editar desde el
 * formulario— tienen que devolverlo tal cual estaba o le borran al usuario la
 * etiqueta que había puesto.
 *
 * Se devuelve SOLO el color propio, nunca el heredado: `appointment.color` ya
 * viene resuelto por la cadena cita > servicio > doctor > consultorio, así que
 * mandarlo sin mirar convertiría el color del doctor en una etiqueta propia de la
 * cita, que es un cambio de significado (y de cómo la pinta el calendario).
 * `colorId` es el id de la paleta de Google, que es lo que el backend guarda;
 * `colorSource` cubre las filas viejas o importadas con un hex suelto.
 */
export function getOwnAppointmentColor(appointment: Appointment | null | undefined): string | undefined {
  if (!appointment) return undefined;
  if (appointment.colorId) return appointment.colorId;
  return appointment.colorSource === 'appointment' ? (appointment.color || undefined) : undefined;
}
