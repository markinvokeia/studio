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

/** La intro (el gancho, con la misma voz): la persona en la clínica con el celular. */
export const INTRO_LINES = {
  es: '¿Y si te digo que con Invoke IA ya no necesitás las manos? Todo lo podés hacer con la voz, solo hablando. Mirá, te muestro.',
  en: "What if I told you that with Invoke IA you don't need your hands anymore? You can do everything with your voice, just by talking. Let me show you.",
};

export const LINES = {
  es: {
    gaps: { say: 'Mostrame los huecos de hoy a la tarde' },
    create: { say: 'Nueva cita para Paula Acosta hoy a las 13:30 con el doctor Raidel Martínez, limpieza', voice: 'Nueva cita para Paula Acosta hoy a la una y media con el doctor Raidel Martínez, limpieza' },
    change: { say: 'Cambiá la hora a las 14', voice: 'Cambiá la hora a las dos' },
    save: { say: 'Sí, guardala' },
    yes: { say: 'Sí' },
    go: { say: 'Andá a Mi consultorio y abrí el de las 10:30', voice: 'Andá a Mi consultorio y abrí el de las diez y media' },
    paula: { say: 'Ahora el de las 14', voice: 'Ahora el de las dos' },
    summary: { say: 'Haceme un resumen médico' },
    odo: { say: 'Nuevo odontograma' },
    dictate: { say: 'Caries OM en 47, corona indicada en 46, implante planificado en 36', voice: 'Caries O M en cuarenta y siete, corona indicada en cuarenta y seis, implante planificado en treinta y seis' },
    confirm: { say: 'Confirmá todo' },
    session: { say: 'Registrá una sesión clínica' },
    sessionSave: { say: 'Guardá' },
    inbox: { say: 'Abrí la bandeja' },
    bill: { say: 'Cobro rápido' },
  },
  en: {
    gaps: { say: "Show me this afternoon's free slots" },
    create: { say: 'New appointment for Paula Acosta today at 6 pm with doctor Raidel Martínez, cleaning', voice: 'New appointment for Paula Acosta today at six p m with doctor Raidel Martínez, cleaning' },
    change: { say: 'Change the time to 6:15 pm', voice: 'Change the time to six fifteen p m' },
    save: { say: 'Yes' },
    yes: { say: 'Yes' },
    go: { say: 'Go to my workspace and open the one at 10:30', voice: 'Go to my workspace and open the one at ten thirty' },
    paula: { say: 'Now the one at 6:15 pm', voice: 'Now the one at six fifteen p m' },
    summary: { say: 'Give me a medical summary' },
    odo: { say: 'New odontogram' },
    dictate: { say: 'Caries OM on 47, crown indicated on 46, planned implant on 36', voice: 'Caries O M on forty seven, crown indicated on forty six, planned implant on thirty six' },
    confirm: { say: 'Confirm all' },
    session: { say: 'New clinical session' },
    sessionSave: { say: 'Save' },
    inbox: { say: 'Open the inbox' },
    bill: { say: 'Quick billing' },
  },
};

/** Lo que se espera ver después de cada frase (para no seguir antes de tiempo). */
const card = (page, re, timeout = 30_000) => page.waitForFunction((src) => new RegExp(src, 'i').test((document.querySelector('[data-voice-card]')?.innerText ?? '').replace(/\s+/g, ' ')), re.source, { timeout, polling: 150 });
const until = {
  gaps: (page) => page.locator('text=/Huecos disponibles|Available slots/i').first().waitFor({ timeout: 20_000 }),
  create: (page) => card(page, /Cuándo|When /),
  change: (page) => card(page, /14:00|18:15|6:15 ?PM/),
  save: (page) => page.locator('[role="alertdialog"]').first().waitFor({ timeout: 20_000 }),
  yes: (page) => page.locator('[role="alertdialog"]').first().waitFor({ state: 'detached', timeout: 20_000 }),
  go: async (page) => { await page.waitForURL(/\/workspace/, { timeout: 30_000 }); await card(page, /Abr. la cita|Opened/); },
  next: (page) => card(page, /Abrí la cita|Opened the/),
  paula: (page) => card(page, /14:00|18:15|6:15 ?PM/),
  // La respuesta del agente («Resumen médico — Paula Acosta (30 años): …»), no lo dicho.
  summary: (page) => card(page, /Paula Acosta \(\d+|\d+ (?:años|years)/, 60_000),
  odo: (page) => card(page, /Muestro el odontograma|Showing the odontogram|odontogram is open/),
  dictate: (page) => page.locator('text=/propone|proposes/').first().waitFor({ timeout: 45_000 }),
  confirm: (page) => card(page, /Confirmar todo|Confirm all/),
  session: (page) => page.locator('[role="dialog"] h2', { hasText: /Crear Sesión|Create Session|New Session|Nueva Sesión/i }).first().waitFor({ timeout: 30_000 }),
  sessionSave: (page) => page.locator('[role="dialog"] h2', { hasText: /Crear Sesión|Create Session|New Session|Nueva Sesión/i }).first().waitFor({ state: 'detached', timeout: 30_000 }),
  inbox: (page) => page.locator('text=/Cobro Rápido|Quick Billing/i').first().waitFor({ timeout: 20_000 }),
  bill: (page) => page.locator('[role="dialog"]', { hasText: /Cobro|Billing|Cobrar/i }).first().waitFor({ timeout: 20_000 }),
};

const SETUP = {
  es: ['mostrá los domingos', 'poné la vista de día', 'andá a hoy'],
  en: ['show sundays', 'day view', 'go to today'],
};

/** Lo que queda a la vista la respuesta antes de pedir lo siguiente (ms). */
const HOLD = { gaps: 2800, create: 3200, change: 2400, save: 1800, yes: 2400, go: 2800, paula: 2400, summary: 6500, odo: 2400, dictate: 3800, confirm: 2000, session: 2800, sessionSave: 2400, inbox: 2600, bill: 4500 };

async function run(ctx, { base, only }) {
  const L = LINES[ctx.locale];
  const { page } = ctx;
  // Solo la parte de Mi consultorio (toma B): se empieza ahí, sin la preparación de la agenda.
  const AGENDA = ['gaps', 'create', 'change', 'save', 'yes', 'go'];
  const workspaceOnly = !!only && !only.some((k) => AGENDA.includes(k));
  // Antes de grabar: la agenda de hoy (vista de día, Carrasco), con la voz escuchando.
  await page.goto(`${base}/${ctx.locale}/${workspaceOnly ? 'workspace' : 'appointments'}`, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-help-id="rail.btn.voice"]').first().waitFor({ timeout: 60_000 });
  await page.waitForFunction(() => !document.querySelector('main .animate-pulse, main .animate-spin'), null, { timeout: 30_000 }).catch(() => undefined);
  await ctx.wait(2500);
  // Fuera de cámara: la voz se prende, se ponen los domingos y la vista de día, y se apaga.
  if (!workspaceOnly) {
    await ctx.micToggle();
    await ctx.listening();
    await ctx.wait(1200);
    for (const setup of SETUP[ctx.locale]) {
      await page.evaluate((t) => window.__voiceSay(t), setup);
      await ctx.wait(2500);
    }
    await ctx.micToggle();
    await ctx.wait(1500);
  }
  await page.locator('[data-voice-card] button[aria-label]').last().click({ timeout: 1500 }).catch(() => undefined);
  await ctx.wait(1500);
  // En cámara: la pantalla quieta, el cursor va al botón Voz y lo prende.
  await ctx.start();
  await ctx.wait(1800);
  await ctx.micOn();
  await ctx.wait(1400);
  for (const [key, line] of Object.entries(L)) {
    if (only && !only.includes(key)) continue;
    await ctx.say(key, line.say, { waitFor: until[key] ? () => until[key](page) : undefined, hold: HOLD[key] ?? 1200, timeout: 45_000 });
  }
  await ctx.wait(600);
}

export const SCRIPT = { es: run, en: run };
