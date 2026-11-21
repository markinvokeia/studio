import { expect, test } from '@playwright/test';
import { addDays, format, startOfToday } from 'date-fns';
import { createTranslator } from 'next-intl';

import { parseNavigation } from '@/lib/voice/commands/navigation';
import { listNavTargets } from '@/lib/voice/nav-targets';
import { normalizeSpeech } from '@/lib/voice/parse';

import { openWindow } from './sim/dom';
import { createVoiceSim, type VoiceSim } from './sim/harness';

import { navItems } from '@/config/nav';
import { PATIENTS_PERMISSIONS } from '@/constants/permissions';
import en from '@/messages/en.json';
import esES from '@/messages/es-ES.json';
import es from '@/messages/es.json';

/**
 * NV · Navegar por el menú principal con la voz desde cualquier página (docs/voz-app-progreso.md):
 * «andá a…», «llevame a…», «abrí…», «go to…». Si la frase sigue, primero se va y el resto se hace en
 * la página nueva, con su contexto. Español (es y es-ES) e inglés.
 */

const parsed = (said: string) => parseNavigation(normalizeSpeech(said), said);
const key = (said: string) => parsed(said)?.keys;

test.describe('NV-PARSE · Qué es ir a otra página (es)', () => {
  const rows: Array<[string, string, string | null]> = [
    ['andá a pacientes', 'Pacientes', null],
    ['ir a la caja', 'Cashier', null],
    ['llevame a la agenda', 'Appointments', null],
    ['andá al calendario', 'Appointments', null],
    ['quiero ir a los turnos', 'Appointments', null],
    ['vamos al centro de alertas', 'AlertsCenter', null],
    ['andá a mi consultorio', 'DoctorWorkspace', null],
    ['volvé al inicio', 'Dashboard', null],
    ['ir al panel de control', 'Dashboard', null],
    ['llevame a reportes de deudores', 'ReportDeudores', null],
    ['andá al reporte de cierre de caja', 'ReportCierreCaja', null],
    ['navegá a facturas', 'Invoices', null],
    ['andá a presupuestos', 'Quotes', null],
    ['andá a los presupuestos de compra', 'PurchaseQuotes', null],
    ['entrá a órdenes de laboratorio', 'LabOrders', null],
    ['pasame al laboratorio', 'LabOrders', null],
    ['andá a la pantalla de estudios', 'Studies', null],
    ['ir a configuración del negocio', 'BusinessSetup', null],
    ['andá a doctores', 'Doctors', null],
    ['llevame a las sedes', 'Sedes', null],
    ['andá a facturación y cobranza', 'ReportFactCobranza', null],
    ['andá a la sección de proveedores', 'Providers', null],
    ['quiero ir a la pantalla tv', 'TVDisplay', null],
    ['ir a sesiones de caja', 'CashSessions', null],
    ['andá a ventas', 'Sales', null],
    ['ir a usuarios', 'SystemUsers', null],
    ['andá a monedas', 'Currencies', null],
    ['abrí la caja', 'Cashier', null],
    ['mostrame los reportes', 'Reports', null],
    ['abrí el centro de alertas', 'AlertsCenter', null],
    ['quiero ver los deudores', 'ReportDeudores', null],
    ['centro de alertas', 'AlertsCenter', null],
    ['mi consultorio', 'DoctorWorkspace', null],
    ['andá a pacientes y buscá a Juan', 'Pacientes', 'buscá a Juan'],
    ['andá a la agenda y mostrame mañana', 'Appointments', 'mostrame mañana'],
    ['ir a la caja, abrí la caja', 'Cashier', 'abrí la caja'],
    ['llevame a la agenda y después poné vista semana', 'Appointments', 'poné vista semana'],
  ];
  for (const [said, want, rest] of rows) {
    test(`«${said}» → ${want}${rest ? ` + «${rest}»` : ''}`, () => {
      const p = parsed(said);
      expect(p?.keys).toEqual([want]);
      expect(p?.rest ?? null).toBe(rest);
    });
  }
});

test.describe('NV-PARSE · Qué es ir a otra página (en)', () => {
  const rows: Array<[string, string, string | null]> = [
    ['go to patients', 'Pacientes', null],
    ['take me to the cashier', 'Cashier', null],
    ['go to the calendar', 'Appointments', null],
    ['navigate to appointments', 'Appointments', null],
    ['open the alerts center', 'AlertsCenter', null],
    ['go to my workspace', 'DoctorWorkspace', null],
    ['go home', 'Dashboard', null],
    ['go back to the dashboard', 'Dashboard', null],
    ['show me the debtors report', 'ReportDeudores', null],
    ['take me to lab orders', 'LabOrders', null],
    ['open invoices', 'Invoices', null],
    ['go to purchase invoices', 'PurchaseInvoices', null],
    ['switch to the reports', 'Reports', null],
    ['go to business setup', 'BusinessSetup', null],
    ['head over to suppliers', 'Providers', null],
    ['bring me to the cash closing report', 'ReportCierreCaja', null],
    ['open the patients page', 'Pacientes', null],
    ['go to the calendar and switch to week view', 'Appointments', 'switch to week view'],
    ['go to patients and then search for John', 'Pacientes', 'search for John'],
  ];
  for (const [said, want, rest] of rows) {
    test(`«${said}» → ${want}${rest ? ` + «${rest}»` : ''}`, () => {
      const p = parsed(said);
      expect(p?.keys).toEqual([want]);
      expect(p?.rest ?? null).toBe(rest);
    });
  }
});

test.describe('NV-PARSE · Ambiguo: se pregunta solo si dos quedan igual', () => {
  test('«andá a tratamientos» → realizados o en curso', () => {
    expect(key('andá a tratamientos')?.sort()).toEqual(['ReportTratCurso', 'ReportTratamientos']);
  });
  test('«andá a facturas» no es ambiguo (Facturas de venta)', () => { expect(key('andá a facturas')).toEqual(['Invoices']); });
  test('«andá a pagos» → Pagos (no pagos de compra)', () => { expect(key('andá a pagos')).toEqual(['Payments']); });
  test('«andá a calendarios» → configuración de calendarios', () => { expect(key('andá a calendarios')).toEqual(['Calendars']); });
});

test.describe('NV-PARSE · No es ir a otra página', () => {
  for (const said of [
    'andá a mañana', 'ir al lunes', 'andá a la semana que viene', 'go to next week', 'go to tomorrow', 'ir a hoy', 'andá al 15',
    'andá a la cita de Juan', 'pasala a confirmada', 'cambiá a vista mes', 'switch to week view', 'volvé atrás', 'go back', 'andá al final',
    'abrí la agenda de mañana', 'andá a la agenda del doctor Pérez', 'la caja', 'la agenda', 'sí', 'no', 'la segunda', 'cancelar',
    'abrí la cuenta', 'mostrame la historia', 'andá al paciente Juan Pérez', 'move it to 3pm', 'volvé a intentar',
  ]) {
    test(`«${said}»`, () => { expect(parsed(said)).toBeNull(); });
  }
});

test.describe('NV-COVER · Cada destino del menú se reconoce por su nombre, en cada idioma', () => {
  const locales = [['es', es, 'andá a'], ['es-ES', esES, 've a'], ['en', en, 'go to']] as const;
  for (const [locale, messages, verb] of locales) {
    const t = createTranslator({ locale, messages: messages as Record<string, unknown> });
    const labels = listNavTargets({ t: (k) => t(k as never), hasPermission: () => true });
    test(`${locale}: los ${labels.length} destinos`, () => {
      const wrong: string[] = [];
      for (const target of labels) {
        const said = `${verb} ${target.parent && target.parentKey !== 'Cashier' && /^(?:Report)/.test(target.key) ? `${target.parent} ` : ''}${target.label}`;
        const got = key(said);
        if (!got || !got.includes(target.key)) wrong.push(`${said} → ${got?.join('|') ?? 'nada'} (esperado ${target.key})`);
      }
      expect(wrong).toEqual([]);
    });
  }
  test('todos los ítems del menú son destinos', () => {
    const keys = new Set(listNavTargets({ t: null, hasPermission: () => true }).map((t) => t.key));
    const items = navItems.flatMap((i) => [i, ...(i.items ?? [])]).filter((i) => i.title && i.href && !i.isSeparator).map((i) => i.title);
    expect(items.filter((k) => !keys.has(k))).toEqual([]);
  });
});

test.describe('NV · Ir a otra página', () => {
  let sim: VoiceSim;
  test.afterEach(() => sim.dispose());
  const tomorrow = format(addDays(startOfToday(), 1), 'yyyy-MM-dd');
  const lastGoTo = () => { const c = sim.cal.calls('goToDate'); return c.length ? format(c[c.length - 1][0] as Date, 'yyyy-MM-dd') : null; };

  test('NV-001 desde la agenda «andá a pacientes»: va y cambia el contexto', async () => {
    sim = await createVoiceSim({ locale: 'es' });
    await sim.say('andá a pacientes');
    expect(sim.navigations).toEqual(['/patients']);
    expect(sim.route()).toBe('/patients');
    expect(sim.domains()).toEqual(['core']);
    expect(sim.card().message).toBe('Abro Pacientes.');
  });
  test('NV-002 «llevame a reportes de deudores»', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/' });
    await sim.say('llevame a reportes de deudores');
    expect(sim.navigations).toEqual(['/reports/deudores']);
  });
  test('NV-003 desde otra página «andá a la agenda»: llega con la voz de la agenda', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/patients' });
    expect(sim.domains()).toEqual(['core']);
    await sim.say('andá a la agenda');
    expect(sim.navigations).toEqual(['/appointments']);
    expect(sim.domains()).toEqual(['calendar', 'core']);
  });
  test('NV-004 ya está ahí: lo dice y no navega', async () => {
    sim = await createVoiceSim({ locale: 'es' });
    await sim.say('andá a la agenda');
    expect(sim.navigations).toEqual([]);
    expect(sim.card().message).toBe('Ya estás en Citas.');
  });
  test('NV-005 sin permiso: lo dice y no navega', async () => {
    sim = await createVoiceSim({ locale: 'es' });
    sim.deny(PATIENTS_PERMISSIONS.VIEW_LIST);
    await sim.say('andá a pacientes');
    expect(sim.navigations).toEqual([]);
    expect(sim.card().message).toBe('No tenés acceso a Pacientes.');
  });
  test('NV-006 ambiguo: pregunta entre los dos y va al elegido', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/' });
    await sim.say('andá a tratamientos');
    expect(sim.card().choices.sort()).toEqual(['Tratamientos Realizados', 'Tratamientos en Curso'].sort());
    await sim.say('los que están en curso');
    expect(sim.navigations).toEqual(['/reports/tratamientos-en-curso']);
  });
  test('NV-007 ambiguo por número', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/' });
    await sim.say('andá a tratamientos');
    await sim.say('el primero');
    expect(sim.navigations).toHaveLength(1);
  });
  test('NV-008 sin IA: lo local alcanza', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/' });
    await sim.say('andá a la caja');
    expect(sim.aiCalls).toHaveLength(0);
    expect(sim.navigations).toEqual(['/cashier']);
  });
  test('NV-009 «abrí la caja» desde otra página', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/patients' });
    await sim.say('abrí la caja');
    expect(sim.navigations).toEqual(['/cashier']);
  });
  test('NV-010 el nombre solo de varias palabras: «centro de alertas»', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/' });
    await sim.say('centro de alertas');
    expect(sim.navigations).toEqual(['/alerts']);
  });
  test('NV-011 «volvé al inicio»', async () => {
    sim = await createVoiceSim({ locale: 'es' });
    await sim.say('volvé al inicio');
    expect(sim.navigations).toEqual(['/']);
    expect(sim.route()).toBe('/');
  });
  test('NV-012 es-ES «ve a pacientes» (tú)', async () => {
    sim = await createVoiceSim({ locale: 'es-ES', route: '/' });
    sim.deny(PATIENTS_PERMISSIONS.VIEW_LIST);
    await sim.say('ve a pacientes');
    expect(sim.card().message).toBe('No tienes acceso a Pacientes.');
  });
  test('NV-013 es-ES «llévame a la caja»', async () => {
    sim = await createVoiceSim({ locale: 'es-ES', route: '/' });
    await sim.say('llévame a la caja');
    expect(sim.navigations).toEqual(['/cashier']);
  });
});

test.describe('NV-CHAIN · Primero va, después sigue en la página nueva', () => {
  let sim: VoiceSim;
  test.afterEach(() => sim.dispose());
  const tomorrow = format(addDays(startOfToday(), 1), 'yyyy-MM-dd');
  const lastGoTo = () => { const c = sim.cal.calls('goToDate'); return c.length ? format(c[c.length - 1][0] as Date, 'yyyy-MM-dd') : null; };

  test('NV-CH-001 «andá a la agenda y mostrame mañana» desde pacientes', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/patients' });
    await sim.say('andá a la agenda y mostrame mañana');
    expect(sim.navigations).toEqual(['/appointments']);
    expect(lastGoTo()).toBe(tomorrow);
    expect(sim.aiCalls).toHaveLength(0);
  });
  test('NV-CH-002 «llevame a la agenda y después poné vista mes»', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/' });
    await sim.say('llevame a la agenda y después poné vista mes');
    expect(sim.cal.state.view).toBe('month');
  });
  test('NV-CH-003 ya en la agenda: «andá a la agenda y poné vista día» hace solo lo segundo', async () => {
    sim = await createVoiceSim({ locale: 'es' });
    await sim.say('andá a la agenda y poné vista día');
    expect(sim.navigations).toEqual([]);
    expect(sim.cal.state.view).toBe('day');
  });
  test('NV-CH-004 lo de la agenda no corre en otra página: «andá a pacientes y poné vista mes»', async () => {
    sim = await createVoiceSim({ locale: 'es' });
    await sim.say('andá a pacientes y poné vista mes');
    expect(sim.navigations).toEqual(['/patients']);
    expect(sim.cal.state.view).toBe('week');
  });
  test('NV-CH-005 en «go to the calendar and switch to month view»', async () => {
    sim = await createVoiceSim({ locale: 'en', route: '/' });
    await sim.say('go to the calendar and switch to month view');
    expect(sim.navigations).toEqual(['/appointments']);
    expect(sim.cal.state.view).toBe('month');
  });
  test('NV-CH-006 en «take me to the calendar, then go to tomorrow»', async () => {
    sim = await createVoiceSim({ locale: 'en', route: '/patients' });
    await sim.say('take me to the calendar, then go to tomorrow');
    expect(lastGoTo()).toBe(tomorrow);
  });
  test('NV-CH-007 sin permiso no sigue con el resto', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/' });
    sim.deny(PATIENTS_PERMISSIONS.VIEW_LIST);
    await sim.say('andá a pacientes y bajá');
    expect(sim.navigations).toEqual([]);
    expect(sim.card().message).toBe('No tenés acceso a Pacientes.');
  });
});

test.describe('NV-CTX · Ir a otra página es un cambio de contexto', () => {
  let sim: VoiceSim;
  test.afterEach(() => sim.dispose());

  test('NV-CTX-001 suelta la cita en foco', async () => {
    sim = await createVoiceSim({ locale: 'es' });
    await sim.say('la cita de Carlos');
    expect(sim.store().focusLabel).not.toBeNull();
    await sim.say('andá a la caja');
    expect(sim.navigations).toEqual(['/cashier']);
    expect(sim.store().focusLabel).toBeNull();
  });
  test('NV-CTX-002 con una ventana abierta: la cierra y va', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/' });
    const win = openWindow('Estado de cuenta', { buttons: ['Imprimir'] });
    await sim.say('andá a la caja');
    expect(win.open).toBe(false);
    expect(sim.navigations).toEqual(['/cashier']);
  });
  test('NV-CTX-003 con una pregunta abierta: pregunta si deja lo que se estaba haciendo', async () => {
    sim = await createVoiceSim({ locale: 'es' });
    await sim.say('la cita de Ana');
    expect(sim.card().choices.length).toBeGreaterThan(1);
    await sim.say('andá a la caja');
    expect(sim.navigations).toEqual([]);
    await sim.say('sí');
    expect(sim.navigations).toEqual(['/cashier']);
  });
  test('NV-CTX-004 con una pregunta abierta, «no»: sigue con lo de antes', async () => {
    sim = await createVoiceSim({ locale: 'es' });
    await sim.say('la cita de Ana');
    await sim.say('andá a la caja');
    await sim.say('no');
    expect(sim.navigations).toEqual([]);
    await sim.say('la segunda');
    expect(sim.cal.calls('focusAppointment')).toEqual([['a3']]);
  });
  test('NV-CTX-005 en la agenda «abrí la configuración» es el engranaje, no la configuración del negocio', async () => {
    sim = await createVoiceSim({ locale: 'es' });
    await sim.say('abrí la configuración');
    expect(sim.navigations).toEqual([]);
    expect(sim.cal.state.settingsOpen).toBe(true);
  });
  test('NV-CTX-006 en la agenda «mostrame las citas de hoy» sigue siendo de la agenda', async () => {
    sim = await createVoiceSim({ locale: 'es' });
    await sim.say('mostrame las citas de hoy');
    expect(sim.navigations).toEqual([]);
  });
  test('NV-CTX-007 en otra página se puede seguir hablando con la voz general (desplazarse)', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/' });
    await sim.say('andá a pacientes');
    await sim.say('bajá');
    expect(sim.navigations).toEqual(['/patients']);
  });
});

test.describe('NV-AI · Con IA solo cuando lo dicho no es un nombre del menú', () => {
  let sim: VoiceSim;
  test.afterEach(() => sim.dispose());
  const nav = (key: string, rest: string | null = null, confidence = 0.9) => (q: { domain: string }) =>
    (q.domain === 'core' ? { relation: 'new', intent: 'navigate', target_key: key, rest, confidence } : null);

  test('NV-AI-001 «llevame donde veo quién nos debe plata» → Deudores', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/' });
    sim.ai.reply(/debe plata/, nav('ReportDeudores'));
    await sim.say('llevame donde veo quién nos debe plata');
    expect(sim.navigations).toEqual(['/reports/deudores']);
    expect(sim.aiCalls).toHaveLength(1);
    expect(sim.aiCalls[0].prompt).toContain('ReportDeudores');
  });
  test('NV-AI-002 desde la agenda: primero la IA de la agenda (no es suyo), después la general', async () => {
    sim = await createVoiceSim({ locale: 'es' });
    sim.ai.reply(/debe plata/, nav('ReportDeudores'));
    await sim.say('llevame donde veo quién nos debe plata');
    expect(sim.aiCalls).toHaveLength(2);
    expect(sim.navigations).toEqual(['/reports/deudores']);
  });
  test('NV-AI-003 la IA no puede inventar un destino', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/' });
    sim.ai.reply(/debe plata/, nav('ReportInventado'));
    await sim.say('llevame donde veo quién nos debe plata');
    expect(sim.navigations).toEqual([]);
  });
  test('NV-AI-004 a la IA solo le llegan los destinos con permiso', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/' });
    sim.deny(PATIENTS_PERMISSIONS.VIEW_LIST);
    sim.ai.reply(/fichas/, nav('Pacientes'));
    await sim.say('llevame a donde están las fichas de la gente');
    const targets = (sim.aiCalls[0].context.targets as Array<{ key: string }>).map((t) => t.key);
    expect(targets).not.toContain('Pacientes');
    expect(targets).toContain('Cashier');
    expect(sim.navigations).toEqual([]);
  });
  test('NV-AI-005 con lo que sigue: va y lo hace en la página nueva', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/' });
    sim.ai.reply(/donde se ven los turnos/, nav('Appointments', 'poné vista mes'));
    await sim.say('llevame a donde se ven los turnos y poné vista mes');
    expect(sim.navigations).toEqual(['/appointments']);
    expect(sim.cal.state.view).toBe('month');
  });
  test('NV-AI-006 confianza media: pregunta antes', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/' });
    sim.ai.reply(/la plata/, nav('Cashier', null, 0.6));
    await sim.say('mostrame dónde está la plata');
    expect(sim.navigations).toEqual([]);
    expect(sim.card().message).toContain('ir a otra sección del menú');
    await sim.say('sí');
    expect(sim.navigations).toEqual(['/cashier']);
  });
  test('NV-AI-007 una charla de la sala no se le manda a la IA', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/' });
    await sim.say('qué calor que hace hoy');
    expect(sim.aiCalls).toHaveLength(0);
    expect(sim.navigations).toEqual([]);
  });
  test('NV-AI-008 en «take me where I see today’s income»', async () => {
    sim = await createVoiceSim({ locale: 'en', route: '/' });
    sim.ai.reply(/income/, nav('ReportIngPeriodo'));
    await sim.say('take me where I see the income');
    expect(sim.navigations).toEqual(['/reports/ingresos-periodo']);
  });
});
