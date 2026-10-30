/**
 * Convención de help ids — la pieza que une asistente, tests E2E y documentación.
 *
 *   <scope>.<kind>.<name>
 *
 *   scope  pantalla, derivada de la ruta sin locale: `/config/sedes` → `config.sedes`,
 *          `/` → `dashboard`. Los segmentos dinámicos (ids) se descartan.
 *   kind   field | btn | tab | filter | nav | section (ver HelpElementKind)
 *   name   nombre del campo de React Hook Form, value del tab, o un nombre fijo
 *          (`btn.new`, `btn.submit`, `btn.refresh`, `filter.search`).
 *
 * Las primitivas de `src/components/ui` (FormControl, Button submit, toolbar del
 * DataTable, Tabs, VerticalTabStrip) y el sidebar los ponen solas como
 * `data-help-id`. Un `data-help-id` explícito siempre gana sobre el automático.
 *
 * El extractor (scripts/knowledge/build-catalog.mjs) replica estas reglas: si
 * cambian acá, cambian allá. Un id publicado no se renombra; si una pantalla
 * cambia de ruta, sus guías del catálogo fallan el `knowledge:check`.
 */

import type { HelpElementKind } from '@/lib/types';

export const HELP_ID_ATTR = 'data-help-id';
/** Contenedor completo de un campo (label + input + mensaje): lo que se resalta. */
export const HELP_ITEM_ATTR = 'data-help-item';

const DYNAMIC_SEGMENT = /^(\[.+\]|\d+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/** Quita el prefijo de locale (`/es`, `/es-ES`) y la query de un pathname. */
export function stripLocale(pathname: string, locale?: string): string {
  let path = pathname.split('?')[0].split('#')[0];
  if (locale && (path === `/${locale}` || path.startsWith(`/${locale}/`))) {
    path = path.slice(locale.length + 1) || '/';
  }
  return path || '/';
}

/** `/config/sedes` → `config.sedes`; `/clinic-history/123` → `clinic-history`. */
export function routeToHelpScope(route: string): string {
  const segments = route
    .split('?')[0]
    .split('/')
    .filter(Boolean)
    .filter((s) => !DYNAMIC_SEGMENT.test(s));
  return segments.length ? segments.join('.') : 'dashboard';
}

/** Normaliza un nombre a algo seguro para el id (`items.0.price` → `items.price`). */
export function normalizeHelpName(name: string): string {
  return name
    .split('.')
    .filter((s) => !/^\d+$/.test(s))
    .join('.')
    .replace(/[^a-zA-Z0-9_.-]/g, '-');
}

export function composeHelpId(scope: string, kind: HelpElementKind, name: string): string {
  return `${scope}.${kind}.${normalizeHelpName(name)}`;
}

/** Selector CSS de un help id (lo usan el motor de guías y Playwright). */
export function helpSelector(id: string): string {
  return `[${HELP_ID_ATTR}="${id.replace(/"/g, '\\"')}"]`;
}

/** Scope del help id (`config.sedes.field.name` → `config.sedes`). */
export function helpIdScope(id: string): string {
  const match = id.match(/^(.*)\.(field|btn|tab|filter|nav|section)\.[^.]+.*$/);
  return match ? match[1] : id;
}

/**
 * Help id de un ítem del menú: `nav.config.sedes` para una hoja,
 * `nav.group.BusinessSetup` para un grupo con submenú (su href es sólo un default).
 */
export function navHelpId(item: { title: string; href: string; items?: unknown[] }): string | undefined {
  if (item.items && item.items.length > 0) return `nav.group.${item.title}`;
  if (!item.href) return undefined;
  return `nav.${routeToHelpScope(item.href)}`;
}
