import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { test, type Browser, type Page } from '@playwright/test';

import { HELP_MENU_SCREENS, HELP_USE_CASES, confirmsInRuns, driveGuide, openForGuide, runOrder, useCaseRoute } from '../utils/help';
import { DEMO_VALUES } from './demo-values';

/**
 * Graba cada guía ejecutada por el asistente real: la mascota señalando, la burbuja
 * con el detalle y, en los pasos que le tocan a la persona, el clic a la vista (se
 * frena, se marca el clic y se pulsa). Empieza con una intro (logo y título) de 2,5 s.
 * Además graba el recorrido "Guiarme por esta pantalla" de cada pantalla del menú
 * (tour.<pantalla>), que termina con la ficha: nombre, para qué sirve y consejos.
 *
 *   HELP_VIDEO_USE_CASES=dashboard.overview,tour.dashboard pnpm videos:record
 *   (acepta prefijos terminados en punto: "dashboard." o "tour.")
 *   Pulsa los OK: las guías de alta, edición y baja crean y cambian datos de verdad
 *   (valores de demo-values.ts, nombres ficticios que parecen reales).
 *   HELP_VIDEO_NO_CONFIRM=1  frena en el OK sin pulsarlo.
 *   Grabar contra el build de producción (pnpm build && pnpm start).
 *
 * Salida: videos/raw/<caso>.webm (desde la intro) + <caso>.json (línea de tiempo,
 * para narrar y subtitular con `pnpm videos:build`) + <caso>.full.webm (sin recortar).
 */

const OUT_DIR = join(process.cwd(), 'videos', 'raw');
const SELECTED = (process.env.HELP_VIDEO_USE_CASES ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const wanted = (id: string) => !SELECTED.length || SELECTED.some((s) => id === s || (s.endsWith('.') && id.startsWith(s)));
const CONFIRM = process.env.HELP_VIDEO_NO_CONFIRM !== '1';
const INTRO_MS = 2500;
const VIEWPORT = { width: 1280, height: 720 };
/** Pantallas sin recorrido grabado (fuera de alcance por ahora). */
const SKIP_TOURS = new Set(['studies', 'shared-studies']);

interface Segment { index: number; title: string; description?: string; details?: string; action: string; t: number }
interface Outro { title: string; summary?: string; purpose?: string; tips: string[] }
interface Recording { id: string; title: string; module?: string; route: string; values?: Record<string, unknown>; screenTour?: string; outro?: Outro }

const RECORDINGS: Recording[] = [
  ...runOrder(HELP_USE_CASES).map((u) => ({ id: u.id, title: u.title, module: u.module, route: useCaseRoute(u), values: DEMO_VALUES[u.id] })),
  ...HELP_MENU_SCREENS.filter((s) => !SKIP_TOURS.has(s.id)).map((s) => ({
    id: `tour.${s.id}`,
    title: `Recorrido por ${s.title ?? s.id}`,
    module: s.module,
    route: s.route,
    screenTour: s.id,
    outro: { title: s.title ?? s.id, summary: s.summary, purpose: s.purpose, tips: s.tips ?? [] },
  })),
].filter((r) => wanted(r.id));

// En orden (un worker), pero una guía que falla no frena las siguientes.
test.describe.configure({ mode: 'default' });

test.beforeAll(() => {
  mkdirSync(OUT_DIR, { recursive: true });
});

/**
 * La intro tapa la pantalla desde que carga el documento (lo que pasa debajo, la carga
 * y las preferencias, no se ve) y se va cuando el grabador la despide. Así el video
 * siempre empieza en la intro, aunque el recorte no caiga justo.
 */
function introScript({ title, module }: { title: string; module?: string }) {
  if (sessionStorage.getItem('video-intro-done') === '1') return;
  const mount = () => {
    if (document.getElementById('video-intro')) return;
    const el = document.createElement('div');
    el.id = 'video-intro';
    el.setAttribute('data-help-ignore', '');
    el.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;'
      + 'background:linear-gradient(135deg,#1e1b4b 0%,#5b21b6 60%,#7c3aed 100%);color:#fff;font-family:"Plus Jakarta Sans",system-ui,sans-serif;'
      + 'transition:opacity 450ms ease;text-align:center;padding:0 10%;pointer-events:none';
    el.innerHTML = '<img id="video-intro-logo" alt="" style="width:84px;height:84px;border-radius:20px;background:#fff;padding:10px;box-shadow:0 10px 30px rgba(0,0,0,.25);opacity:0;transition:opacity 300ms" />'
      + (module ? `<div style="font-size:18px;letter-spacing:.18em;text-transform:uppercase;opacity:.75">${module}</div>` : '')
      + `<div style="font-size:44px;font-weight:800;line-height:1.15">${title}</div>`
      + '<div style="margin-top:6px;font-size:16px;opacity:.75">Invoke IA · Guía paso a paso</div>';
    document.documentElement.appendChild(el);
    // El logo es el de la app (barra izquierda): se toma apenas aparece.
    const takeLogo = setInterval(() => {
      const src = document.querySelector<HTMLImageElement>('img[alt="InvokeIA Logo"]')?.currentSrc;
      const logo = document.getElementById('video-intro-logo') as HTMLImageElement | null;
      if (src && logo) { logo.src = src; logo.style.opacity = '1'; clearInterval(takeLogo); }
    }, 150);
  };
  if (document.documentElement) mount(); else document.addEventListener('DOMContentLoaded', mount);
  (window as unknown as { __videoIntroEnd: () => void }).__videoIntroEnd = () => {
    sessionStorage.setItem('video-intro-done', '1');
    const el = document.getElementById('video-intro');
    if (!el) return;
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 500);
  };
}

/** Placa final del recorrido de una pantalla: su ficha (nombre, para qué sirve, consejos). */
async function showOutro(page: Page, outro: Outro) {
  const text = [outro.summary, outro.purpose, ...outro.tips].filter(Boolean).join(' ');
  const ms = Math.min(14_000, Math.max(5000, 2500 + text.length * 40));
  await page.evaluate(({ o, ms: dur }) => {
    const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;'
      + 'background:linear-gradient(135deg,#1e1b4b 0%,#5b21b6 60%,#7c3aed 100%);color:#fff;font-family:"Plus Jakarta Sans",system-ui,sans-serif;opacity:0;transition:opacity 450ms ease';
    const logo = document.querySelector<HTMLImageElement>('img[alt="InvokeIA Logo"]')?.currentSrc;
    el.innerHTML = '<div style="max-width:880px;padding:0 48px">'
      + '<div style="display:flex;align-items:center;gap:16px;margin-bottom:18px">'
      + (logo ? `<img src="${logo}" style="width:56px;height:56px;border-radius:14px;background:#fff;padding:7px" />` : '')
      + `<div style="font-size:36px;font-weight:800;line-height:1.15">${esc(o.title)}</div></div>`
      + (o.summary ? `<div style="font-size:20px;font-weight:600;opacity:.95;margin-bottom:8px">${esc(o.summary)}</div>` : '')
      + (o.purpose ? `<div style="font-size:16px;line-height:1.5;opacity:.85;margin-bottom:18px">${esc(o.purpose)}</div>` : '')
      + (o.tips.length ? '<div style="font-size:14px;letter-spacing:.14em;text-transform:uppercase;opacity:.7;margin-bottom:8px">Consejos</div>'
        + `<ul style="margin:0;padding-left:22px;font-size:16px;line-height:1.55;list-style:disc outside">${o.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : '')
      + '</div>';
    document.documentElement.appendChild(el);
    requestAnimationFrame(() => { el.style.opacity = '1'; });
    setTimeout(() => { el.style.opacity = '0'; }, dur - 450);
  }, { o: outro, ms });
  await page.waitForTimeout(ms + 100);
}

/** Marca el clic del grabador: un círculo que late sobre el elemento antes de pulsarlo. */
async function showClick(page: Page, target: string) {
  const el = page.locator(`[data-help-id="${target}"]:visible, [data-help-item="${target}"]:visible`).last();
  await el.scrollIntoViewIfNeeded().catch(() => {});
  const box = await el.boundingBox().catch(() => null);
  if (!box) return;
  const x = box.x + Math.min(box.width / 2, 60);
  const y = box.y + box.height / 2;
  await page.evaluate(({ x: cx, y: cy }) => {
    const dot = document.createElement('div');
    dot.style.cssText = `position:fixed;left:${cx - 18}px;top:${cy - 18}px;width:36px;height:36px;border-radius:9999px;z-index:2147483646;pointer-events:none;`
      + 'background:rgba(124,58,237,.35);border:3px solid #7c3aed;transform:scale(.4);opacity:1;transition:transform 450ms ease,opacity 450ms ease';
    document.body.appendChild(dot);
    requestAnimationFrame(() => { dot.style.transform = 'scale(1.4)'; });
    setTimeout(() => { dot.style.opacity = '0'; }, 700);
    setTimeout(() => dot.remove(), 1200);
  }, { x, y });
  await page.waitForTimeout(900);
}

let alertsAsToast = false;
/** Avisos de alertas en modo Notificación (no Modal): un modal en el medio arruina la grabación. */
async function ensureToastAlerts(page: Page) {
  if (alertsAsToast) return;
  await page.goto('/es/preferences');
  const toast = page.locator('[data-help-id="preferences.btn.alert-style-toast"]');
  await toast.waitFor({ timeout: 60_000 });
  // Los recordatorios vencidos salen como modal (justamente lo que se quiere apagar): primero se cierran.
  const closeAll = page.getByRole('button', { name: 'Cerrar todas' });
  for (let i = 0; i < 10 && (await closeAll.isVisible().catch(() => false)); i++) {
    await closeAll.click().catch(() => {});
    await page.waitForTimeout(600);
  }
  if ((await toast.getAttribute('aria-pressed')) !== 'true') {
    await toast.click({ timeout: 15_000 });
    await page.waitForTimeout(1500);
  }
  alertsAsToast = true;
}

/** Recorta el arranque (la carga, debajo de la intro): el video empieza con la intro ya armada. */
function trimFrom(file: string, startMs: number) {
  const tmp = file.replace(/\.webm$/, '.full.webm');
  renameSync(file, tmp);
  try {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', tmp, '-ss', (startMs / 1000).toFixed(2), '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '32', '-deadline', 'good', '-cpu-used', '4', '-an', file]);
  } catch {
    renameSync(tmp, file); // sin ffmpeg queda la grabación completa
  }
}

async function record(browser: Browser, baseURL: string, rec: Recording) {
  // Contexto propio: el video empieza al crear la página, así el recorte cae en el lugar justo.
  const context = await browser.newContext({ baseURL, viewport: VIEWPORT, storageState: 'e2e/.auth/user.json', recordVideo: { dir: join(OUT_DIR, '.tmp'), size: VIEWPORT } });
  await context.addInitScript(introScript, { title: rec.title, module: rec.module });
  const page = await context.newPage();
  const videoStart = Date.now();

  await ensureToastAlerts(page);
  await openForGuide(page, rec.route);
  // La página ya cargó del todo: desde acá empieza el video (la intro, 2,5 s).
  const introAt = Date.now() - videoStart;
  await page.waitForTimeout(INTRO_MS);
  await page.evaluate(() => (window as unknown as { __videoIntroEnd?: () => void }).__videoIntroEnd?.());
  await page.waitForTimeout(500);

  const t0 = Date.now();
  const segments: Segment[] = [];
  const result = await driveGuide(page, rec.id, {
    mode: 'video',
    values: rec.values ?? {},
    confirm: CONFIRM && confirmsInRuns(rec.id),
    screenTour: rec.screenTour,
    beforeClick: showClick,
    onStep: (step, index) => segments.push({ index, title: step.title, description: step.description, details: step.details, action: step.action, t: Date.now() - t0 + INTRO_MS }),
  });
  // En el OK sin confirmar se muestra el clic igual, para que se vea dónde termina.
  if (result.outcome === 'confirm') {
    const guide = await page.evaluate(() => window.__invokeHelp!.state().guide);
    const target = guide?.steps[guide.current]?.target;
    if (target) await showClick(page, target);
  }
  await page.waitForTimeout(1000);
  if (rec.outro) await showOutro(page, rec.outro);

  const catalogVersion = await page.evaluate(() => window.__invokeHelp!.catalogVersion);
  const video = page.video();
  await context.close();
  const file = join(OUT_DIR, `${rec.id}.webm`);
  await video?.saveAs(file);
  await video?.delete();
  if (existsSync(file)) trimFrom(file, introAt);
  writeFileSync(join(OUT_DIR, `${rec.id}.json`), JSON.stringify({
    useCaseId: rec.id,
    title: rec.title,
    locale: 'es',
    catalogVersion,
    recordedAt: new Date().toISOString(),
    outcome: result.outcome,
    skipped: result.skipped,
    segments,
    outro: rec.outro,
  }, null, 2));
}

for (const rec of RECORDINGS) {
  test(`video · ${rec.id}`, async ({ browser }, testInfo) => {
    test.setTimeout(420_000);
    await record(browser, String(testInfo.project.use.baseURL), rec);
  });
}
