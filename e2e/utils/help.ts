import { expect, type Page } from '@playwright/test';

import catalog from '../../src/generated/help-catalog.json';
import catalogEn from '../../src/generated/help-catalog.en.json';

/**
 * Las guías del catálogo (knowledge/use-cases) como tests E2E y como videos.
 * No se recorren "a mano": se maneja el asistente real por `window.__invokeHelp`
 * (lo expone con localStorage invoke-help:automation=1), así el test ejecuta
 * exactamente lo que ve la persona: navegar por el menú, completar, esperar el
 * clic, saltar lo que no aplica. Un cambio de pantalla rompe la guía y el test a la vez.
 */

type Step = {
  id: string;
  action: 'navigate' | 'click' | 'highlight' | 'fill' | 'confirm' | 'wait';
  title: string;
  description?: string;
  details?: string;
  target?: string;
  route?: string;
  until?: string | string[];
  blocking?: boolean;
};

type UseCase = { id: string; title: string; module?: string; screens: string[]; steps: Step[] };
type Screen = { id: string; route: string; title?: string; summary?: string; purpose?: string; tips?: string[]; inMenu?: boolean; module?: string };

export const HELP_USE_CASES = (catalog as unknown as { useCases: UseCase[] }).useCases;
const SCREENS = (catalog as unknown as { screens: Screen[] }).screens;

/** Pantallas del menú (las que tienen "Guiarme por esta pantalla" y ficha). */
export const HELP_MENU_SCREENS = SCREENS.filter((s) => s.inMenu);

/** Idiomas en que se graban los videos (la app muestra el del usuario; si no hay, el español). */
export type HelpLocale = 'es' | 'en';

/** Guías y pantallas con los textos del idioma (los mismos ids y pasos en los dos). */
export function helpCatalogTexts(locale: HelpLocale): { useCases: UseCase[]; menuScreens: Screen[] } {
  const source = (locale === 'en' ? catalogEn : catalog) as unknown as { useCases: UseCase[]; screens: Screen[] };
  return { useCases: source.useCases, menuScreens: source.screens.filter((s) => s.inMenu) };
}

/** Botón de los avisos que se abren solos (recordatorios vencidos), por idioma. */
const DISMISS_ALL: Record<string, string> = { es: 'Cerrar todas', en: 'Dismiss all' };

export function getUseCase(id: string): UseCase {
  const useCase = HELP_USE_CASES.find((u) => u.id === id);
  if (!useCase) throw new Error(`Caso de uso ${id} no está en el catálogo`);
  return useCase;
}

/** Ruta de la pantalla de la guía: ahí se arranca (la guía navega por el menú si hace falta). */
export function useCaseRoute(useCase: UseCase): string {
  return SCREENS.find((s) => s.id === useCase.screens[0])?.route ?? '/';
}

/**
 * Requests que escriben y que una guía no debería disparar antes del OK. Quedan
 * afuera las que son lecturas por POST o telemetría (asistente, sugerencias de IA,
 * filtros de la agenda).
 */
const READ_ONLY_POST = /help\/|catalog|alerts\/occurrences|ai\/treatments|appointments\/filter-ids|__nextjs|_next\/|youtube|google/i;

type Bridge = {
  ready: boolean;
  startUseCase: (id: string, values?: Record<string, unknown>, options?: { pace?: number; manualClicks?: boolean }) => boolean;
  startScreenTour: (screenId: string, options?: { pace?: number; manualClicks?: boolean }) => boolean;
  next: () => void;
  state: () => {
    guide: { current: number; statuses: string[]; finished: boolean; steps: Step[] } | null;
    spotlight: { targetId: string; mode?: string } | null;
  };
  catalogVersion: string;
};
declare global { interface Window { __invokeHelp?: Bridge } }

/**
 * Guías cuyo OK le manda algo a una persona real (correo, WhatsApp, contraseña) o
 * dispara procesos (probar una regla genera alertas): tests y videos señalan el botón
 * pero no lo pulsan, aunque el resto de las guías sí confirme.
 */
const SENDS_TO_PEOPLE = /^(alerts\.send-(email|whatsapp)|patients\.(email|whatsapp|whatsapp-reminder)|purchases\.providers\.(email|whatsapp)|(sales|purchases)\.(quotes|invoices|payments)\.send|(system\.users|system\.staff|config\.doctors)\.initial-password|system\.alert-rules\.test)$/;
export const sendsToPeople = (id: string) => SENDS_TO_PEOPLE.test(id);

/**
 * Guías que actúan sobre un registro que no creó una guía (una cita cualquiera, el
 * paciente de las demos, la configuración de la clínica, la TV de la sala): llegan
 * hasta el OK pero no lo pulsan. Las demás altas, ediciones y bajas sí confirman,
 * siempre sobre lo que creó la guía de alta de esa pantalla.
 */
const KEEPS_EXISTING = /^(onboarding\.(business|whatsapp|patients-import)|appointments\.(edit|cancel|delete|move|reassign|change-status|bulk-reassign)|patients\.(toggle-active|discharge)|purchases\.providers\.toggle-active|config\.(clinics|clinic-prefs|patients-portal|calendar-colors|templates)\.overview|config\.clinic-prefs\.mascot|config\.(schedules|holidays|doctor-availability|availability-exceptions)\.(edit|delete)|tv-display\.(control|next-patient|setup)|system\.(alerts-config|whatsapp-agent|notification-settings|licenses)\.overview)$/;
/** ¿Esta guía pulsa su OK en tests y videos? */
export const confirmsInRuns = (id: string) => !SENDS_TO_PEOPLE.test(id) && !KEEPS_EXISTING.test(id);

/**
 * Orden de ejecución: por pantalla, primero lo que crea (alta, categoría, caja), después
 * las guías de consulta, después editar y al final eliminar (lo que creó el alta).
 */
export function runOrder<T extends { id: string }>(items: T[]): T[] {
  const screenOf = (id: string) => id.split('.').slice(0, -1).join('.');
  const rank = (id: string) => {
    const action = id.split('.').pop() ?? '';
    if (/^(create|misc-category|cash-point-create|open)$/.test(action)) return 0;
    if (/(^|-)edit$|^misc-review$/.test(action)) return 2;
    if (/(^|-)delete$|^close$/.test(action)) return 3;
    return 1;
  };
  const screens = [...new Set(items.map((i) => screenOf(i.id)))];
  return [...items].sort((a, b) => screens.indexOf(screenOf(a.id)) - screens.indexOf(screenOf(b.id)) || rank(a.id) - rank(b.id));
}

/** Abre la pantalla con el asistente en modo automatización y sin ruido encima. */
export async function openForGuide(page: Page, route: string, locale = 'es') {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('invoke-help:automation', '1');
      localStorage.setItem('invoke-help-voice-muted', '1');
      sessionStorage.setItem('invoke-help:onboarding-auto-opened', '1');
    } catch { /* private mode */ }
  });
  await page.goto(`/${locale}${route === '/' ? '' : route}`);
  await page.waitForFunction(() => window.__invokeHelp?.ready === true, null, { timeout: 180_000 });
  await page.waitForTimeout(1500);
  // Avisos que se abren solos (recordatorios vencidos) tapan la pantalla.
  const closeAll = page.getByRole('button', { name: DISMISS_ALL[locale] ?? DISMISS_ALL.es });
  if (await closeAll.isVisible().catch(() => false)) { await closeAll.click(); await page.waitForTimeout(500); }
}

export interface DriveOptions {
  values?: Record<string, unknown>;
  /** `video`: lento y con el clic a la vista; `test`: lo más rápido posible. */
  mode?: 'test' | 'video';
  /** Pulsa los pasos `confirm` (crea/edita/borra datos). Por defecto se detiene en el OK. */
  confirm?: boolean;
  /** Antes de cada clic del grabador (efecto visual del clic). */
  beforeClick?: (page: Page, target: string) => Promise<void>;
  /** Cada vez que la mascota muestra un paso nuevo (para la línea de tiempo del video). */
  onStep?: (step: Step, index: number) => void;
  /** Justo antes de pulsar un OK (los tests cuentan lo escrito hasta ahí: debería ser nada). */
  onConfirm?: (step: Step) => void;
  /** Recorrido "Guiarme por esta pantalla" de esa pantalla en vez de una guía del catálogo. */
  screenTour?: string;
}

export interface DriveResult {
  /** finished: terminó · confirm: frenó en el OK · human: un gesto que sólo hace la persona (clic derecho, arrastrar). */
  outcome: 'finished' | 'confirm' | 'human';
  stoppedAt?: string;
  skipped: string[];
  done: string[];
}

/** Tiempo de lectura de la burbuja (lo que tarda la narración, más o menos). */
export const readingMs = (text: string) => Math.min(7000, Math.max(1800, 900 + text.length * 45));

const state = (page: Page) => page.evaluate(() => window.__invokeHelp!.state());

/** Corre una guía con el asistente real y devuelve cómo terminó. Falla si un paso falla. */
export async function driveGuide(page: Page, id: string, options: DriveOptions = {}): Promise<DriveResult> {
  const { values = {}, mode = 'test', confirm = false, beforeClick, onStep, onConfirm, screenTour } = options;
  const video = mode === 'video';
  const started = await page.evaluate(
    ({ id: useCaseId, values: v, video: isVideo, tour }) => {
      const opts = isVideo ? { pace: 1.4, manualClicks: true } : undefined;
      return tour ? window.__invokeHelp!.startScreenTour(tour, opts) : window.__invokeHelp!.startUseCase(useCaseId, v, opts);
    },
    { id, values: { demo: true, ...values }, video, tour: screenTour },
  );
  expect(started, screenTour ? `hay recorrido para ${screenTour}` : `la guía ${id} existe en el catálogo`).toBe(true);

  let lastShown = -1;
  let lastSegment = -1;
  const confirmClicks = new Map<number, number>();
  let lastKey = '';
  let sameKeyFor = 0;
  let outcome: DriveResult['outcome'] = 'finished';
  let stoppedAt: string | undefined;

  for (let guard = 0; guard < 400; guard++) {
    const s = await state(page);
    const guide = s.guide;
    if (!guide || guide.finished) break;
    let index = guide.current;
    let step = guide.steps[index];
    let status = guide.statuses[index];
    // Campo que completó el asistente: queda señalado (el actual ya pasó al siguiente,
    // todavía pendiente) hasta "Siguiente". Es un paso a la vista, no una espera.
    const filled = status === 'pending' && s.spotlight?.mode === 'filled' && index > 0;
    if (filled) { index -= 1; step = guide.steps[index]; status = 'filled'; }
    // Clic o completado que hace el asistente solo: entra en la línea de tiempo aunque no frene.
    if (status === 'running' && index !== lastSegment && s.spotlight?.mode === 'action') { lastSegment = index; onStep?.(step, index); }
    if (status === 'running' || status === 'pending') { await page.waitForTimeout(250); continue; }
    if (status === 'failed') throw new Error(`${id}: falló el paso ${index + 1} «${step.title}» (${step.target ?? step.route})`);

    // Paso nuevo a la vista: se deja leer (en video, el tiempo de la narración).
    if (index !== lastShown) {
      lastShown = index;
      if (index !== lastSegment) { lastSegment = index; onStep?.(step, index); }
      await page.waitForTimeout(video ? readingMs(`${step.title} ${step.description ?? ''} ${step.details ?? ''}`) : 300);
    }

    const key = `${index}:${status}`;
    sameKeyFor = key === lastKey ? sameKeyFor + 1 : 0;
    lastKey = key;

    if (status === 'waiting' && step.action === 'confirm') {
      if (!confirm) { outcome = 'confirm'; stoppedAt = step.id; break; }
      // Un OK que no avanza (validación, error del backend) no se pulsa para siempre.
      const clicks = (confirmClicks.get(index) ?? 0) + 1;
      confirmClicks.set(index, clicks);
      if (clicks > 2) throw new Error(`${id}: el OK «${step.title}» no avanzó después de pulsarlo (¿error de validación o del backend?)`);
      onConfirm?.(step);
      if (beforeClick && step.target) await beforeClick(page, step.target);
      await clickTarget(page, step.target!);
      await page.waitForTimeout(video ? 2500 : 800);
      continue;
    }

    // Lo tiene que hacer la persona (elegir el registro, abrir un menú): se hace el clic por ella.
    const needsPerson = status === 'waiting' && (!!step.until || step.blocking) && step.target;
    if (needsPerson) {
      if (sameKeyFor === 0) {
        if (beforeClick) await beforeClick(page, step.target!);
        await clickTarget(page, step.target!);
      } else if (sameKeyFor === 8) {
        await clickTarget(page, step.target!, 'right');
      } else if (sameKeyFor > 20) {
        outcome = 'human'; stoppedAt = step.id; break;
      }
      await page.waitForTimeout(400);
      continue;
    }

    await page.evaluate(() => window.__invokeHelp!.next());
    await page.waitForTimeout(250);
  }

  const final = (await state(page)).guide;
  const pick = (status: string) => (final ? final.steps.filter((_, i) => final.statuses[i] === status).map((st) => st.id) : []);
  return { outcome, stoppedAt, skipped: pick('skipped'), done: pick('done') };
}

async function clickTarget(page: Page, target: string, button: 'left' | 'right' = 'left') {
  const el = page.locator(`[data-help-id="${target}"]:visible, [data-help-item="${target}"]:visible`).last();
  await el.scrollIntoViewIfNeeded().catch(() => {});
  await el.click({ button, timeout: 5000 }).catch(() => {});
}

/** Requests que escriben (POST/PUT/PATCH/DELETE) salvo las lecturas conocidas. */
export function trackWrites(page: Page): string[] {
  const writes: string[] = [];
  page.on('request', (r) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(r.method()) && !READ_ONLY_POST.test(r.url())) {
      writes.push(`${r.method()} ${r.url().replace(/\?.*/, '')}`);
    }
  });
  return writes;
}
