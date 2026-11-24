#!/usr/bin/env node
/**
 * Graba los clips de las promos de la historia clínica (odontograma, estética y periodontograma),
 * en escritorio (16:9) y en mobile (9:16), en español e inglés.
 *
 * No guarda nada: navega la historia clínica, abre las sesiones en solo lectura o sin tocar sus
 * datos, mueve los comparadores y cambia de vista. Usa los pacientes de demo de DEV:
 * Carla Delgado (odontograma y estética) y Matias Beltran (periodontograma).
 *
 *   node scripts/videos/promo-clinical/record-clips.mjs [es|en|all] [desktop|mobile|all] [odo|aes|perio]
 *
 * Captura cuadro a cuadro (CDP screencast): escritorio 1920×1080, mobile 780×1688.
 * Salida: videos/promo-clinical/clips/[m-]<clip>-<locale>.webm + .json con las marcas de tiempo y las
 * cajas de lo que la promo acerca (en píxeles del video).
 * Requiere la app corriendo (PLAYWRIGHT_BASE_URL, por defecto http://localhost:3000; mejor un build
 * de producción) y una sesión en e2e/.auth/user.json (npx playwright test --project=setup).
 */
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT = join(ROOT, 'videos', 'promo-clinical', 'clips');
const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
const LOCALES = process.argv[2] && process.argv[2] !== 'all' ? [process.argv[2]] : ['es', 'en'];
const DEVICES = process.argv[3] && process.argv[3] !== 'all' ? [process.argv[3]] : ['desktop', 'mobile'];
const ONLY = process.argv[4];
const FPS = 30;

const PROFILES = {
  desktop: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5, prefix: '' },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, prefix: 'm-' },
};

const TEXT = {
  es: {
    odo: /^Odontograma/, aes: /^Estética/, perio: /^Periodontograma/, prev: 'Sesión anterior', next: 'Sesión siguiente',
    arch: /^Arcada$/, history: /^Historial$/, fdi: /^Odontograma$/, mixed: /^Mixta$/, primary: /^Temporal$/, permanent: /^Permanente$/,
    newSession: /^Nueva Sesión$/, discard: /^Descartar$/, cancel: /^Cancelar$/, endo: /^Endodoncia$/,
    dictation: 'caries OM en 47, corona indicada en 46, implante planificado en 36',
    reeval: /Reevaluación/, overlay: /^Superponer$/, diff: /^Cambios$/, curves: /Curvas$/, map: /Mapa$/, upper: /^Superior$/, both: /^Ambas$/,
  },
  en: {
    odo: /^Odontogram/, aes: /^Aesthetic/, perio: /^Periodontal chart/, prev: 'Previous session', next: 'Next session',
    arch: /^Arch$/, history: /^History$/, fdi: /^Odontogram$/, mixed: /^Mixed$/, primary: /^Primary$/, permanent: /^Permanent$/,
    newSession: /^New Session$/, discard: /^Discard$/, cancel: /^Cancel$/, endo: /^Endodontics$/,
    dictation: 'caries OM on 47, crown indicated on 46, planned implant on 36',
    reeval: /Re-?evaluation/, overlay: /^Overlay$/, diff: /^Changes$/, curves: /Curves$/, map: /Map$/, upper: /^Upper$/, both: /^Both$/,
  },
};

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();

/** Captura cuadro a cuadro: cada cuadro dura hasta el siguiente. */
async function startCapture(page, size, name) {
  const cdp = await page.context().newCDPSession(page);
  const dir = join(OUT, `_frames-${name}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const frames = [];
  let stopped = false;
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    // Un cuadro que llega después de cortar (la carpeta ya no está) se descarta
    if (stopped) return;
    const file = join(dir, `${String(frames.length).padStart(6, '0')}.jpg`);
    writeFileSync(file, Buffer.from(data, 'base64'));
    frames.push({ file, ts: metadata.timestamp });
    void cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 94, maxWidth: size.width, maxHeight: size.height, everyNthFrame: 1 });
  const t0 = Date.now() / 1000;
  return {
    t0,
    async stop(file) {
      const end = Date.now() / 1000;
      stopped = true;
      await cdp.send('Page.stopScreencast').catch(() => {});
      if (!frames.length) return;
      const lines = [];
      frames.forEach((f, i) => {
        const next = frames[i + 1]?.ts ?? end;
        lines.push(`file '${f.file}'`, `duration ${Math.max(0.001, next - Math.max(f.ts, t0)).toFixed(4)}`);
      });
      lines.push(`file '${frames[frames.length - 1].file}'`);
      writeFileSync(join(dir, 'list.txt'), lines.join('\n'));
      execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', join(dir, 'list.txt'),
        '-vf', `fps=${FPS},scale=${size.width}:${size.height}:flags=lanczos`, '-c:v', 'libvpx-vp9', '-crf', '18', '-b:v', '0', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '4', '-g', String(FPS), file]);
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

async function record(device, name, locale, scenario) {
  const profile = PROFILES[device];
  const scale = profile.deviceScaleFactor;
  const size = { width: Math.round(profile.viewport.width * scale), height: Math.round(profile.viewport.height * scale) };
  const context = await browser.newContext({
    viewport: profile.viewport,
    deviceScaleFactor: scale,
    isMobile: profile.isMobile,
    hasTouch: profile.hasTouch,
    storageState: join(ROOT, 'e2e/.auth/user.json'),
    locale: locale === 'en' ? 'en-US' : 'es-UY',
  });
  // Modo automatización: sin avisos espontáneos de la mascota.
  await context.addInitScript(() => { try { localStorage.setItem('invoke-help:automation', '1'); } catch {} });
  const page = await context.newPage();
  const marks = {};
  const boxes = {};
  let capture;
  const clip = `${profile.prefix}${name}-${locale}`;
  const vis = (sel) => page.locator(`${sel}:visible`).first();
  const ctx = {
    device, locale, t: TEXT[locale], mobile: device === 'mobile', vis,
    start: async () => { capture = await startCapture(page, size, clip); },
    mark: (key) => { marks[key] = Math.round((Date.now() / 1000 - capture.t0) * 1000); console.log(`[promo] ${clip} ${key} @${marks[key]}ms`); },
    /** Lo que la promo acerca: posición en píxeles del video. */
    box: async (key, locator) => {
      const b = await locator.boundingBox().catch(() => null);
      if (b) boxes[key] = { x: Math.round(b.x * scale), y: Math.round(b.y * scale), w: Math.round(b.width * scale), h: Math.round(b.height * scale) };
      else console.warn(`[promo] ${clip} sin caja ${key}`);
    },
    help: (id) => vis(`[data-help-id="${id}"]`),
    wait: (ms) => page.waitForTimeout(ms),
  };
  let ok = false;
  try {
    await scenario(page, ctx);
    ok = true;
  } catch (error) {
    await page.screenshot({ path: join(OUT, `${clip}-error.png`) }).catch(() => {});
    console.error(`[promo] ${clip} falló: ${String(error.message).split('\n')[0]}`);
  }
  if (capture) await capture.stop(join(OUT, `${clip}.webm`));
  writeFileSync(join(OUT, `${clip}.json`), JSON.stringify({ clip: name, device, locale, size: [size.width, size.height], marks, boxes, ok }, null, 2));
  await context.close();
  return ok;
}

/** Ficha del paciente abierta en la línea de tiempo de su historia clínica (antes de grabar). */
async function openTimeline(page, ctx, patient) {
  await page.goto(`${BASE}/${ctx.locale}/patients`, { waitUntil: 'domcontentloaded' });
  const search = page.locator('[data-help-id="patients.filter.search"] input, input[data-help-id="patients.filter.search"]').first();
  await search.waitFor({ state: 'visible', timeout: 60_000 });
  await search.pressSequentially(patient, { delay: 30 });
  await page.getByText(patient, { exact: true }).first().waitFor({ timeout: 30_000 });
  await ctx.wait(800);
  await page.getByText(patient, { exact: true }).first().click();
  await ctx.help('patients.section.header').waitFor({ timeout: 30_000 });
  if (!ctx.mobile) await page.locator('button:has(svg[class*="maximize"])').first().click();
  await ctx.help('patients.tab.clinical').click();
  await ctx.help('patients.tab.clinical-history').click();
  await ctx.help('patients.section.timeline').waitFor({ timeout: 30_000 });
  // Que carguen las vistas previas (odontogramas, mapas y fotos) antes de grabar.
  await ctx.wait(ctx.mobile ? 6000 : 4500);
}

/** Desplaza la línea de tiempo con la rueda, de a poco (se ve el recorrido). */
async function glide(page, ctx, locator, dy, ms) {
  const b = await locator.boundingBox();
  if (!b) return;
  await page.mouse.move(b.x + b.width / 2, b.y + Math.min(b.height / 2, 300));
  const steps = Math.max(1, Math.round(ms / 50));
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, dy / steps);
    await page.waitForTimeout(50);
  }
}

/** Arrastra sobre un comparador (deslizador): posiciones en fracción del ancho. */
async function drag(page, locator, stops, msPerStop = 900) {
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  const b = await locator.boundingBox();
  if (!b) return;
  const y = b.y + b.height * 0.55;
  let x = b.x + b.width * stops[0];
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (const stop of stops.slice(1)) {
    const to = b.x + b.width * stop;
    // Cada movimiento del mouse tarda unos 40 ms: la cantidad de pasos marca la duración.
    const n = Math.max(6, Math.round(msPerStop / 45));
    for (let i = 1; i <= n; i++) {
      const p = i / n;
      const e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
      await page.mouse.move(x + (to - x) * e, y);
    }
    x = to;
    await page.waitForTimeout(250);
  }
  await page.mouse.up();
}

async function filterTimeline(page, ctx, label) {
  await ctx.help('patients.btn.timeline-filters').click();
  await ctx.wait(500);
  await page.getByRole('menuitem', { name: label }).first().click();
  await page.keyboard.press('Escape');
}

/** Paso opcional: si no está en esta pantalla (mobile, otro estado), se sigue sin marcarlo. */
async function maybe(ctx, key, fn) {
  try { await fn(); if (key) ctx.mark(key); return true; } catch (e) { console.warn(`[promo] sin ${key}: ${String(e.message).split('\n')[0]}`); return false; }
}
const byText = (scope, re) => scope.locator('button, [role="radio"], [role="tab"]').filter({ hasText: re }).first();

/** Escribe como una persona (el dictado se ve aparecer). */
async function typeSlowly(page, locator, text, perChar = 38) {
  await locator.click();
  for (const ch of text) { await page.keyboard.type(ch); await page.waitForTimeout(perChar); }
}

const SCENARIOS = {
  // Odontograma: historia unificada → sesiones → dentición, arcada, historial → dictado con propuestas de Invoke.
  async odo(page, ctx) {
    await openTimeline(page, ctx, 'Carla Delgado');
    await ctx.start();
    ctx.mark('timeline');
    const timeline = ctx.help('patients.section.timeline');
    await ctx.box('timeline', timeline);
    await ctx.wait(900);
    await glide(page, ctx, timeline, ctx.mobile ? 2600 : 1700, 4200);
    ctx.mark('scrolled');
    await ctx.wait(600);
    await glide(page, ctx, timeline, -4000, 700);
    await ctx.wait(300);
    ctx.mark('filter');
    await filterTimeline(page, ctx, ctx.t.odo);
    ctx.mark('filtered');
    await ctx.wait(2400);
    await glide(page, ctx, timeline, ctx.mobile ? 1800 : 900, 2200);
    await ctx.wait(500);
    await glide(page, ctx, timeline, -3000, 600);
    await ctx.wait(400);
    const open = ctx.help('patients.btn.timeline-open-odontogram');
    await open.scrollIntoViewIfNeeded();
    await open.click();
    const prev = page.getByRole('button', { name: ctx.t.prev }).first();
    await prev.waitFor({ timeout: 30_000 });
    ctx.mark('viewer');
    await ctx.wait(2600);
    for (const key of ['prev1', 'prev2']) { await prev.click(); ctx.mark(key); await ctx.wait(2600); }
    for (const key of ['next1', 'next2']) { await page.getByRole('button', { name: ctx.t.next }).first().click(); ctx.mark(key); await ctx.wait(2000); }
    await maybe(ctx, 'mixed', async () => { await byText(page, ctx.t.mixed).click({ timeout: 4000 }); await ctx.wait(1900); });
    await maybe(ctx, 'primary', async () => { await byText(page, ctx.t.primary).click({ timeout: 4000 }); await ctx.wait(1900); });
    await maybe(null, null, async () => { await byText(page, ctx.t.permanent).click({ timeout: 4000 }); await ctx.wait(600); });
    await byText(page, ctx.t.arch).click();
    ctx.mark('arch');
    await ctx.wait(3200);
    await byText(page, ctx.t.history).click();
    ctx.mark('history');
    await ctx.wait(3600);
    await byText(page, ctx.t.fdi).click();
    await ctx.wait(800);
    // Dictado de hallazgos: Invoke propone los cambios sobre el odontograma; se descarta y se cancela (no se guarda nada)
    await page.getByRole('button', { name: ctx.t.newSession }).first().click();
    const dict = ctx.help('patients.field.odontogram-dictation').or(page.locator('[data-help-id$="field.odontogram-dictation"]:visible')).first();
    await dict.waitFor({ timeout: 15_000 });
    ctx.mark('edit');
    await ctx.wait(1600);
    ctx.mark('dictate');
    await typeSlowly(page, dict, ctx.t.dictation);
    await ctx.wait(500);
    await page.locator('[data-help-id$="btn.odontogram-propose"]:visible').first().click();
    ctx.mark('proposed');
    await ctx.wait(4200);
    await maybe(ctx, 'catalog', async () => { await byText(page, ctx.t.endo).click({ timeout: 4000 }); await ctx.wait(2600); });
    await maybe(null, null, async () => { await byText(page, ctx.t.discard).click({ timeout: 4000 }); await ctx.wait(500); });
    ctx.mark('end');
    await maybe(null, null, async () => { await byText(page, ctx.t.cancel).click({ timeout: 4000 }); await ctx.wait(500); });
  },

  // Estética: sesiones con su mapa → consentimiento → fotos y comparador → tratamiento → cierre.
  async aes(page, ctx) {
    await openTimeline(page, ctx, 'Carla Delgado');
    await ctx.start();
    ctx.mark('timeline');
    await ctx.wait(700);
    ctx.mark('filter');
    await filterTimeline(page, ctx, ctx.t.aes);
    ctx.mark('filtered');
    await ctx.wait(2400);
    const timeline = ctx.help('patients.section.timeline');
    await glide(page, ctx, timeline, ctx.mobile ? 1800 : 1000, 2600);
    ctx.mark('list');
    await ctx.wait(800);
    await glide(page, ctx, timeline, -3000, 600);
    await ctx.wait(500);
    await ctx.help('patients.btn.timeline-open-aesthetic').click();
    await ctx.help('aesthetic-session.section.header').waitFor({ timeout: 30_000 });
    ctx.mark('open');
    await ctx.wait(1200);
    await ctx.help('aesthetic-session.btn.step-consent').click();
    ctx.mark('consent');
    await ctx.wait(1500);
    await maybe(null, null, async () => { await glide(page, ctx, ctx.help('aesthetic-session.section.consent-text'), ctx.mobile ? 900 : 500, 1800); });
    await ctx.wait(1200);
    await ctx.help('aesthetic-session.btn.step-photos').click();
    ctx.mark('photos');
    await ctx.wait(2400);
    await ctx.help('aesthetic-session.btn.compare-initial').click().catch(() => {});
    const stage = ctx.help('aesthetic-session.section.photo-stage');
    await stage.scrollIntoViewIfNeeded();
    await ctx.wait(1600);
    ctx.mark('initial');
    const area = stage.locator('div.touch-pan-y.select-none').first();
    await ctx.box('photo', area);
    ctx.mark('slide');
    await drag(page, area, [0.5, 0.1, 0.9, 0.12, 0.5], 1700);
    ctx.mark('slid');
    await ctx.wait(600);
    const toggles = stage.locator('button[role="switch"]');
    await maybe(ctx, 'marks', async () => { await toggles.first().click({ timeout: 3000 }); await ctx.wait(2400); await toggles.first().click(); await ctx.wait(400); });
    const history = ctx.help('aesthetic-session.section.photo-history');
    const items = history.locator('button');
    await ctx.box('history', history);
    const n = await items.count();
    for (const [i, key] of [[1, 'h2'], [2, 'h3']]) if (n > i) { await items.nth(i).click(); ctx.mark(key); await ctx.wait(1800); }
    if (n > 0) { await items.nth(0).click(); await ctx.wait(700); }
    const modes = ctx.help('aesthetic-session.section.compare-modes').locator('button');
    await modes.nth(1).click();
    ctx.mark('side');
    await ctx.wait(2800);
    await maybe(ctx, 'overlay', async () => { await modes.nth(2).click({ timeout: 3000 }); await ctx.wait(2600); });
    await modes.nth(0).click();
    await ctx.wait(500);
    await ctx.help('aesthetic-session.btn.step-treatment').click();
    ctx.mark('treatment');
    await ctx.wait(1600);
    await ctx.box('map', ctx.help('aesthetic-session.section.map'));
    await maybe(ctx, 'layers', async () => { await glide(page, ctx, ctx.help('aesthetic-session.section.layers'), ctx.mobile ? 900 : 500, 1800); });
    await ctx.wait(2200);
    await ctx.help('aesthetic-session.btn.step-close').click();
    ctx.mark('close');
    await ctx.wait(2400);
    await maybe(null, null, async () => { await glide(page, ctx, ctx.help('aesthetic-session.section.billing'), ctx.mobile ? 1200 : 400, 1800); });
    await ctx.wait(1600);
    ctx.mark('end');
  },

  // Periodontograma: sondaje (pasadas, guía, dictado) → evolución (deslizador sobre una arcada, superponer,
  // cambios, mapa, animación, tendencias) → diagnóstico y riesgo → cierre con el reporte para el paciente.
  async perio(page, ctx) {
    await openTimeline(page, ctx, 'Matias Beltran');
    await ctx.start();
    ctx.mark('timeline');
    await ctx.wait(700);
    ctx.mark('filter');
    await filterTimeline(page, ctx, ctx.t.perio);
    ctx.mark('filtered');
    await ctx.wait(2400);
    // El cribado PSR/BPE también queda en la historia, con sus sextantes
    await maybe(ctx, 'screening', async () => {
      const rows = page.locator('[data-help-id="patients.btn.timeline-row-perio"]:visible');
      await rows.nth(1).scrollIntoViewIfNeeded();
      await rows.nth(1).click({ timeout: 4000 });
      await ctx.wait(2600);
      await rows.nth(0).scrollIntoViewIfNeeded();
      await rows.nth(0).click({ timeout: 4000 });
      await ctx.wait(1200);
    });
    await ctx.help('patients.btn.timeline-open-perio').click();
    await ctx.help('perio-session.section.header').waitFor({ timeout: 30_000 });
    ctx.mark('open');
    await ctx.wait(1000);
    await ctx.help('perio-session.btn.step-probe').click();
    ctx.mark('probe');
    await ctx.wait(1800);
    await ctx.box('chart', ctx.help('perio-session.section.chart'));
    for (const [p, key] of [['mg', 'passMg'], ['fm', 'passFm'], ['ps', null]]) {
      await maybe(ctx, key, async () => { await ctx.help(`perio-session.btn.pass-${p}`).click({ timeout: 3000 }); await ctx.wait(key ? 1800 : 600); });
    }
    await maybe(ctx, 'guide', async () => {
      const toggle = ctx.help('perio-session.field.show-guide').locator('button[role="switch"], input').first();
      await toggle.click({ timeout: 3000 }); await ctx.wait(1600); await toggle.click(); await ctx.wait(800);
    });
    await maybe(ctx, 'voice', async () => {
      await ctx.help('perio-session.btn.voice-help').click({ timeout: 3000 });
      await ctx.wait(3400);
      await page.keyboard.press('Escape');
      await ctx.wait(500);
    });
    await ctx.help('perio-session.btn.step-evolution').click();
    ctx.mark('evolution');
    await ctx.wait(1800);
    const controls = ctx.help('perio-session.section.evolution-controls');
    // Una sola arcada: las curvas se ven más grandes y el corte del deslizador se nota
    await maybe(null, null, async () => { await byText(controls, ctx.t.upper).click({ timeout: 3000 }); await ctx.wait(1200); });
    const chart = ctx.help('perio-session.section.evolution-chart');
    await ctx.box('evo', chart);
    await ctx.box('trends', ctx.help('perio-session.section.trends'));
    ctx.mark('slide');
    await drag(page, chart.locator('div.cursor-ew-resize').first(), [0.5, 0.06, 0.94, 0.08, 0.5], 1900);
    ctx.mark('slid');
    await ctx.wait(500);
    await byText(controls, ctx.t.overlay).click();
    ctx.mark('overlay');
    await ctx.wait(2600);
    await byText(controls, ctx.t.diff).click();
    ctx.mark('changes');
    await ctx.wait(2400);
    await maybe(null, null, async () => { await byText(controls, ctx.t.both).click({ timeout: 3000 }); await ctx.wait(400); });
    await byText(controls, ctx.t.map).click();
    ctx.mark('map');
    await ctx.wait(2800);
    await byText(controls, ctx.t.curves).click();
    await ctx.wait(300);
    await byText(controls, ctx.t.overlay).click();
    await ctx.wait(400);
    await ctx.help('perio-session.btn.evolution-play').click();
    ctx.mark('play');
    await ctx.wait(5400);
    await maybe(ctx, 'reeval', async () => {
      const reeval = ctx.help('perio-session.section.compare-with').getByRole('radio', { name: ctx.t.reeval }).first();
      await reeval.scrollIntoViewIfNeeded(); await reeval.click({ timeout: 3000 }); await ctx.wait(2000);
    });
    await ctx.help('perio-session.section.trends').scrollIntoViewIfNeeded().catch(() => {});
    ctx.mark('trends');
    await ctx.wait(2600);
    await ctx.help('perio-session.btn.step-diagnosis').click();
    ctx.mark('diagnosis');
    await ctx.wait(3000);
    await maybe(ctx, 'risk', async () => { await glide(page, ctx, ctx.help('perio-session.section.dx-inputs'), ctx.mobile ? 1400 : 700, 2000); await ctx.wait(2200); });
    await ctx.help('perio-session.btn.step-close').click();
    ctx.mark('close');
    await ctx.wait(3200);
    await maybe(null, null, async () => { await glide(page, ctx, ctx.help('perio-session.section.checklist').or(page.locator('[data-help-id="perio-session.section.footer"]')).first(), ctx.mobile ? 1200 : 400, 1600); });
    await ctx.wait(1200);
    ctx.mark('end');
  },
};

for (const device of DEVICES) {
  for (const locale of LOCALES) {
    for (const [name, scenario] of Object.entries(SCENARIOS)) {
      if (ONLY && ONLY !== name) continue;
      for (let take = 1; take <= 2; take++) {
        if (await record(device, name, locale, scenario)) break;
      }
    }
  }
}
await browser.close();
