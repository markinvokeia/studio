/**
 * El guion de la promo de la voz: lo que se dice en cada escena (es y en).
 * Paciente: Paula Acosta · Doctor: Raidel Martínez (la sesión del e2e) · Calendario: Carrasco · hoy.
 *
 * Cada frase tiene `say` (lo que llega al reconocedor y se ve como subtítulo) y, si se pronuncia
 * distinto, `voice` (lo que dice el audio de ElevenLabs: «las cuatro y media» en vez de «16:30»).
 * Lo usan record.mjs (graba), gen-audio.mjs (voces) y make.mjs (arma el video con las marcas).
 */

export const VOICES = {
  // Tomas - Argentina & Uruguaya (rioplatense, como el voseo de la app) · Eric - Smooth, Trustworthy.
  es: 'QK4xDwo9ESPHA4JNUpX3',
  en: 'cjVigY5qzO86Huf0OWal',
};

export const LINES = {
  es: {
    gaps: { say: 'Mostrame los huecos de hoy a la tarde' },
    create: { say: 'Nueva cita para Paula Acosta hoy a las 18:30 con el doctor Raidel Martínez, limpieza', voice: 'Nueva cita para Paula Acosta hoy a las seis y media con el doctor Raidel Martínez, limpieza' },
    change: { say: 'Cambiá la hora a las 19', voice: 'Cambiá la hora a las siete' },
    save: { say: 'Sí, guardala' },
    yes: { say: 'Sí' },
    go: { say: 'Andá a Mi consultorio' },
    next: { say: 'El siguiente paciente' },
    paula: { say: 'Ahora el de las 19', voice: 'Ahora el de las siete' },
    summary: { say: 'Haceme un resumen médico' },
    odo: { say: 'Nuevo odontograma' },
    dictate: { say: 'Caries OM en 47, corona indicada en 46, implante planificado en 36', voice: 'Caries O M en cuarenta y siete, corona indicada en cuarenta y seis, implante planificado en treinta y seis' },
    confirm: { say: 'Confirmá todo y registrá la sesión clínica' },
    sessionSave: { say: 'Guardá' },
    inbox: { say: 'Abrí la bandeja' },
    bill: { say: 'Cobro rápido' },
  },
  en: {
    gaps: { say: "Show me this afternoon's free slots" },
    create: { say: 'New appointment for Paula Acosta today at 6:30 pm with doctor Raidel Martínez, cleaning', voice: 'New appointment for Paula Acosta today at six thirty p m with doctor Raidel Martínez, cleaning' },
    change: { say: 'Change the time to 7 pm', voice: 'Change the time to seven p m' },
    save: { say: 'Yes, save it' },
    yes: { say: 'Yes' },
    go: { say: 'Go to my workspace' },
    next: { say: 'Next patient' },
    paula: { say: 'Now the 7 pm one', voice: 'Now the seven p m one' },
    summary: { say: 'Give me a medical summary' },
    odo: { say: 'New odontogram' },
    dictate: { say: 'Caries OM on 47, crown indicated on 46, planned implant on 36', voice: 'Caries O M on forty seven, crown indicated on forty six, planned implant on thirty six' },
    confirm: { say: 'Confirm all and record the clinical session' },
    sessionSave: { say: 'Save' },
    inbox: { say: 'Open the inbox' },
    bill: { say: 'Quick billing' },
  },
};

/** Lo que se espera ver después de cada frase (para no seguir antes de tiempo). */
const card = (page, re, timeout = 30_000) => page.waitForFunction((src) => new RegExp(src, 'i').test((document.querySelector('[data-voice-card]')?.innerText ?? '').replace(/\s+/g, ' ')), re.source, { timeout, polling: 150 });
const until = {
  gaps: (page) => page.locator('text=/Huecos disponibles|Available slots/i').first().waitFor({ timeout: 20_000 }),
  create: (page) => card(page, /Nueva cita|New appointment/),
  change: (page) => card(page, /19:00|7:00 ?PM/),
  save: (page) => page.locator('[role="alertdialog"]').first().waitFor({ timeout: 20_000 }),
  yes: (page) => page.locator('[role="alertdialog"]').first().waitFor({ state: 'detached', timeout: 20_000 }),
  go: (page) => page.waitForURL(/\/workspace/, { timeout: 30_000 }),
  next: (page) => card(page, /Abrí la cita|Opened the/),
  paula: (page) => card(page, /19:00|7:00 ?PM/),
  summary: (page) => page.locator('[data-voice-card] li').first().waitFor({ timeout: 45_000 }),
  odo: (page) => card(page, /odontograma|odontogram/),
  dictate: (page) => page.locator('text=/propone|proposes/').first().waitFor({ timeout: 45_000 }),
  confirm: (page) => page.locator('[role="dialog"] h2', { hasText: /Sesión|Session/ }).first().waitFor({ timeout: 30_000 }),
  sessionSave: (page) => page.locator('[role="dialog"] h2', { hasText: /Crear Sesión|Create Session/ }).first().waitFor({ state: 'detached', timeout: 30_000 }),
  inbox: (page) => page.locator('text=/Cobro Rápido|Quick Billing/i').first().waitFor({ timeout: 20_000 }),
  bill: (page) => page.locator('[role="dialog"]', { hasText: /Cobro|Billing|Cobrar/i }).first().waitFor({ timeout: 20_000 }),
};

const SETUP = {
  es: ['mostrá los domingos', 'poné la vista de día', 'andá a hoy'],
  en: ['show sundays', 'day view', 'go to today'],
};

const HOLD = { gaps: 1600, create: 1800, change: 1300, save: 900, yes: 1200, go: 1500, next: 1300, paula: 1500, summary: 3800, odo: 1200, dictate: 2200, confirm: 1500, sessionSave: 1800, inbox: 1500, bill: 3000 };

async function run(ctx, { base, only }) {
  const L = LINES[ctx.locale];
  const { page } = ctx;
  // Antes de grabar: la agenda de hoy (vista de día, Carrasco), con la voz escuchando.
  await page.goto(`${base}/${ctx.locale}/appointments`, { waitUntil: 'domcontentloaded' });
  await ctx.listening();
  await page.waitForFunction(() => !document.querySelector('main .animate-pulse, main .animate-spin'), null, { timeout: 30_000 }).catch(() => undefined);
  await ctx.wait(2500);
  // Fuera de cámara: los domingos a la vista y la vista de día (hoy).
  for (const setup of SETUP[ctx.locale]) {
    await page.evaluate((t) => window.__voiceSay(t), setup);
    await ctx.wait(2500);
  }
  await page.locator('[data-voice-card] button[aria-label]').last().click({ timeout: 2000 }).catch(() => undefined);
  await ctx.wait(800);
  await ctx.start();
  await ctx.wait(900);
  for (const [key, line] of Object.entries(L)) {
    if (only && !only.includes(key)) continue;
    await ctx.say(key, line.say, { waitFor: until[key] ? () => until[key](page) : undefined, hold: HOLD[key] ?? 1200, timeout: 45_000 });
  }
  await ctx.wait(600);
}

export const SCRIPT = { es: run, en: run };
