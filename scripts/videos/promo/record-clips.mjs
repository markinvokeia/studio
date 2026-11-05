#!/usr/bin/env node
/**
 * Graba los clips de la app para la promo de la mascota, en escritorio y en mobile:
 * el chat respondiendo y abriendo un video, "Guías de esta pantalla" con «Mostrar»,
 * el checklist de onboarding de una clínica nueva y una guía paso a paso.
 *
 * No guarda nada: sólo navega, escribe en el chat y abre paneles. El estado del
 * onboarding se simula en el navegador (como si la clínica fuera nueva). La guía de
 * mobile frena antes de su OK.
 *
 *   node scripts/videos/promo/record-clips.mjs [es|en|all] [desktop|mobile|all] [clip]
 *
 * Captura cuadro a cuadro (CDP screencast) a más densidad: escritorio 1920×1080,
 * mobile 780×1688. Salida: videos/promo/clips/<clip>-<locale>.webm (escritorio) o
 * m-<clip>-<locale>.webm (mobile) + .json con las marcas de tiempo y la posición de
 * lo que la promo resalta (en píxeles del video).
 * Requiere la app corriendo (PLAYWRIGHT_BASE_URL, por defecto http://localhost:3000)
 * y una sesión en e2e/.auth/user.json (npx playwright test --project=setup).
 */
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT = join(ROOT, 'videos', 'promo', 'clips');
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
  es: { question: '¿Cómo le agendo una cita a Carlos Delgado?', patient: 'Carlos Delgado', dictate: 'Dictar', watch: /^Ver video/, guideScreen: /Guiame en esta pantalla/, group: /^Información/, elements: /Campos y botones/, show: /^Mostrar$/, onboarding: /Puesta en marcha/, guideMe: /Llevarme y guiarme/, dismiss: 'Cerrar todas' },
  en: { question: 'How do I book an appointment for Carlos Delgado?', patient: 'Carlos Delgado', dictate: 'Dictate', watch: /^Watch video/, guideScreen: /Guide me on this screen/, group: /^Information/, elements: /Fields and buttons/, show: /^Show$/, onboarding: /Getting started/, guideMe: /Take me there and guide me/, dismiss: 'Dismiss all' },
};
// Palabras de la interfaz en español que a veces se cuelan en las respuestas en inglés.
const SPANISH_UI = /\b(consultorio|Citas|cita|Crear|Guiarme|Agendar|Nueva|Pacientes|Sede|Completarlo)\b/;

// Clínica recién creada: el negocio y la sede listos, el resto por hacer.
const NEW_CLINIC_STEPS = ['business', 'sedes', 'schedules', 'calendars', 'doctors', 'availability', 'services', 'first_appointment', 'staff', 'payment_methods', 'whatsapp', 'patients_import']
  .map((id, i) => ({ step_id: id, status: i < 2 ? 'done' : 'pending', count: i < 2 ? 1 : 0, completed_at: i < 2 ? new Date().toISOString() : null, notes: null }));

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();

/** Captura cuadro a cuadro: cada cuadro dura hasta el siguiente. */
async function startCapture(page, size) {
  const cdp = await page.context().newCDPSession(page);
  const dir = join(OUT, '_frames');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const frames = [];
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
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
  // Modo automatización: sin avisos espontáneos de la mascota (los clips los cuenta la promo).
  await context.addInitScript(() => { try { localStorage.setItem('invoke-help:automation', '1'); } catch {} });
  const page = await context.newPage();
  const marks = {};
  const boxes = {};
  let capture;
  const clip = `${profile.prefix}${name}-${locale}`;
  const ctx = {
    device, locale, t: TEXT[locale],
    /** Arranca a grabar (después de cargar la pantalla, así el clip empieza ya mostrándola). */
    start: async () => { capture = await startCapture(page, size); },
    mark: (key) => { marks[key] = Math.round((Date.now() / 1000 - capture.t0) * 1000); console.log(`[promo] ${clip} ${key} @${marks[key]}ms`); },
    /** Lo que la promo resalta: posición en píxeles del video. */
    box: async (key, locator) => {
      const b = await locator.boundingBox().catch(() => null);
      if (b) boxes[key] = { x: Math.round(b.x * scale), y: Math.round(b.y * scale), w: Math.round(b.width * scale), h: Math.round(b.height * scale) };
    },
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

async function open(page, ctx, route) {
  await page.goto(`${BASE}/${ctx.locale}${route}`, { waitUntil: 'domcontentloaded' });
  await page.locator('.ivm-actor').first().waitFor({ state: 'visible', timeout: 60_000 });
  await page.waitForTimeout(ctx.device === 'mobile' ? 7000 : 3000);
  // Recordatorios vencidos del usuario de prueba: se cierran antes de grabar nada.
  const closeAll = page.getByRole('button', { name: ctx.t.dismiss });
  if (await closeAll.isVisible().catch(() => false)) { await closeAll.click(); await page.waitForTimeout(800); }
}

/**
 * Agenda prolija: sin el panel de agendas abierto y, en mobile, en vista Día sobre el
 * martes de esta semana (la semana con más citas en DEV). No cambia qué agendas se ven
 * (eso se guarda en las preferencias del usuario).
 */
async function prepareAgenda(page, ctx) {
  const panelOpen = async () => page.getByRole('button', { name: /Calendario de Prueba/ }).first().isVisible().catch(() => false);
  // Las agendas cargan después que la pantalla y pueden volver a abrir el panel: se cierra
  // hasta que quede cerrado.
  await page.waitForTimeout(2500);
  for (let i = 0; i < 4 && (await panelOpen()); i++) {
    await page.locator('[data-help-id="appointments.btn.agendas"]:visible').first().click().catch(() => {});
    await page.waitForTimeout(1500);
  }
  if (ctx.device === 'mobile') {
    if (await panelOpen()) {
      // En mobile el panel tiene su propia X.
      await page.locator('button:has(svg.lucide-x):visible').first().click().catch(() => {});
      await page.waitForTimeout(800);
    }
    const tuesday = new Date();
    tuesday.setDate(tuesday.getDate() - ((tuesday.getDay() + 5) % 7));
    await page.getByRole('button', { name: new RegExp(`^\\D?${tuesday.getDate()}$`) }).first().click().catch(() => {});
    await page.waitForTimeout(600);
    await page.getByRole('button', { name: ctx.locale === 'en' ? /^Day$/ : /^Día$/ }).first().click().catch(() => {});
    await page.waitForTimeout(1500);
  }
}

async function openAssistant(page) {
  // La mascota puede estar viajando o asomándose: se reintenta el clic hasta que abra el panel.
  const input = page.locator('textarea').last();
  for (let i = 0; i < 4 && !(await input.isVisible()); i++) {
    await page.locator('.ivm-actor').first().click({ force: true });
    await input.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
  }
  await input.waitFor({ state: 'visible', timeout: 5_000 });
  await page.waitForTimeout(900);
}

async function typeSlowly(page, locator, text, perChar = 55) {
  await locator.click();
  for (const ch of text) {
    await page.keyboard.type(ch);
    await page.waitForTimeout(perChar);
  }
}

const SCENARIOS = {
  async chat(page, ctx) {
    await open(page, ctx, '/appointments');
    await prepareAgenda(page, ctx);
    await ctx.start();
    ctx.mark('ready');
    await openAssistant(page);
    ctx.mark('panel');
    const input = page.locator('textarea').last();
    await ctx.box('mic', page.getByRole('button', { name: ctx.t.dictate }).last());
    ctx.mark('typing');
    await typeSlowly(page, input, ctx.t.question);
    ctx.mark('typed');
    await page.waitForTimeout(500);
    await page.keyboard.press('Enter');
    ctx.mark('sent');
    // La respuesta trae tarjetas de guías con «Guiarme» / «Ver video».
    const watch = page.getByRole('button', { name: ctx.t.watch }).first();
    await watch.waitFor({ state: 'visible', timeout: 90_000 });
    ctx.mark('reply');
    if (ctx.locale === 'en') {
      // Sólo el texto de la respuesta (las tarjetas de guías tienen sus propios títulos).
      const answer = await page.locator('[role="dialog"]').last().innerText().catch(() => '');
      const reply = (answer.split(ctx.t.question).pop() ?? '').split(/Book an appointment|Watch video/)[0];
      if (SPANISH_UI.test(reply)) throw new Error(`la respuesta en inglés trae palabras en español: ${reply.replace(/\s+/g, ' ').slice(0, 160)}`);
    }
    await watch.scrollIntoViewIfNeeded();
    await page.waitForTimeout(2500);
    await ctx.box('watch', watch);
    await watch.hover().catch(() => {});
    await page.waitForTimeout(600);
    await watch.click();
    ctx.mark('video');
    await page.waitForTimeout(7000);
    ctx.mark('end');
  },

  async screen(page, ctx) {
    await open(page, ctx, '/patients');
    const search = page.locator('[data-help-id="patients.filter.search"] input, input[data-help-id="patients.filter.search"]').first();
    await search.fill(ctx.t.patient).catch(() => {});
    await page.waitForTimeout(2500);
    await ctx.start();
    ctx.mark('ready');
    await openAssistant(page);
    ctx.mark('panel');
    // «Guiame en esta pantalla»: todo lo que se puede hacer acá, con su guía y su video.
    await page.locator('button', { hasText: ctx.t.guideScreen }).first().click();
    ctx.mark('screen');
    await page.waitForTimeout(2500);
    const group = page.locator('button', { hasText: ctx.t.group }).first();
    if (await group.count()) { await group.click(); ctx.mark('group'); }
    await page.waitForTimeout(2200);
    // Más abajo, «Campos y botones»: cada elemento con «Mostrar», que va directo a él.
    const elements = page.locator('button', { hasText: ctx.t.elements }).first();
    await elements.scrollIntoViewIfNeeded();
    await page.waitForTimeout(900);
    await elements.click();
    ctx.mark('elements');
    await page.waitForTimeout(1300);
    const show = page.getByRole('button', { name: ctx.t.show }).first();
    await show.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    await ctx.box('show', show);
    await show.click();
    ctx.mark('show');
    await page.waitForTimeout(4500);
    ctx.mark('end');
  },

  async onboarding(page, ctx) {
    await page.route('**/help/onboarding/status**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ steps: NEW_CLINIC_STEPS }) }));
    await open(page, ctx, '');
    await ctx.start();
    ctx.mark('ready');
    await openAssistant(page);
    ctx.mark('panel');
    await page.locator('button', { hasText: ctx.t.onboarding }).first().click();
    ctx.mark('checklist');
    await page.waitForTimeout(2600);
    // El paso siguiente ya viene abierto; «Llevarme y guiarme» lleva a la pantalla y arranca la guía.
    const guide = page.getByRole('button', { name: ctx.t.guideMe }).first();
    await ctx.box('guideMe', guide);
    await guide.hover().catch(() => {});
    await page.waitForTimeout(900);
    await guide.click();
    ctx.mark('guide');
    await page.waitForTimeout(8000);
    ctx.mark('end');
  },

  // La guía de agendar una cita a Carlos Delgado, que el asistente completa sola hasta su
  // OK (nunca lo pulsa). El horario ya está tomado: termina mostrando el aviso real de
  // "Horario no disponible" (el «¡Ohhh!» de la promo).
  async guide(page, ctx) {
    await open(page, ctx, '/appointments');
    await prepareAgenda(page, ctx);
    await ctx.start();
    ctx.mark('ready');
    await page.waitForFunction(() => window.__invokeHelp?.ready === true, null, { timeout: 30_000 });
    const values = {
      patient: 'Carlos Delgado', doctor: 'Dra. Lucía Fernández', calendar: 'Consultorio Centro',
      date: '2026-12-02', time: '09:00', notes: ctx.locale === 'en' ? 'Routine check-up' : 'Control de rutina',
    };
    const started = await page.evaluate((v) => window.__invokeHelp.startUseCase('appointments.create', v), values);
    if (!started) throw new Error('la guía no arrancó');
    ctx.mark('guide');
    // Hasta el OK: el asistente avanza solo; si un paso espera a la persona (o un campo
    // quedó completado esperando «Siguiente»), se le da «Siguiente».
    for (let i = 0; i < 160; i++) {
      const st = await page.evaluate(() => {
        const s = window.__invokeHelp.state(); const g = s.guide;
        return g ? { action: g.steps[g.current]?.action, status: g.statuses[g.current], done: g.finished, filled: s.spotlight?.mode === 'filled' } : null;
      });
      if (!st || st.done || (st.action === 'confirm' && st.status === 'waiting')) break;
      if (st.status === 'waiting' || (st.status === 'pending' && st.filled)) await page.evaluate(() => window.__invokeHelp.next());
      await page.waitForTimeout(700);
    }
    ctx.mark('save');
    await page.waitForTimeout(3500);
    ctx.mark('end');
  },
};

for (const device of DEVICES) {
  for (const locale of LOCALES) {
    for (const [name, scenario] of Object.entries(SCENARIOS)) {
      if (ONLY && ONLY !== name) continue;
      // El chat en inglés a veces nombra la interfaz en español: se repite la toma.
      for (let take = 1; take <= (name === 'chat' && locale === 'en' ? 6 : 1); take++) {
        if (await record(device, name, locale, scenario)) break;
      }
    }
  }
}
await browser.close();
