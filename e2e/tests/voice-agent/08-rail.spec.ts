import { expect, test } from '@playwright/test';

import { usePatientView } from '@/stores/patient-view-store';

import { createVoiceSim, type VoiceSim } from './sim/harness';
import { screen } from './sim/page';

/**
 * RL · El riel derecho por voz desde cualquier página (src/lib/voice/commands/rail.ts): paciente,
 * cobro rápido, sede, caja, pantalla de la sala, alertas, bandeja, tipo de cambio, notas, asistente
 * y mostrar u ocultar el panel. Español (es, es-ES) e inglés.
 */

let sim: VoiceSim;
test.afterEach(() => { sim.dispose(); usePatientView.setState({ isOpen: false, userId: null as never, userName: null as never } as never); });
const viewed = () => { const s = usePatientView.getState() as unknown as { isOpen: boolean; userId: string; initialTab?: string }; return s.isOpen ? `${s.userId}:${s.initialTab ?? '-'}` : null; };

test.describe('RL-PATIENT · Abrir un paciente desde cualquier lado', () => {
  for (const [locale, said, want] of [
    ['es', 'abrí la ficha de Juan Pérez', 'p2:info'], ['es', 'mostrame la historia de Carlos López', 'p4:clinical'],
    ['es', 'abrí la cuenta de Sofía Castro', 'p9:financial'], ['es', 'buscá al paciente Roberto Díaz', 'p8:-'],
    ['es', 'abrí el estado de cuenta de María Rodríguez', 'p5:financial'], ['es', 'traeme los datos de Pedro Sánchez', 'p7:info'],
    ['es-ES', 'abre la ficha del paciente Juan Pérez', 'p2:info'], ['en', 'open patient Juan Pérez', 'p2:-'],
    ['en', 'open Carlos López history', 'p4:clinical'], ['en', "show me Sofía Castro's account", 'p9:financial'], ['en', 'find patient Roberto', 'p8:-'],
  ] as const) {
    test(`${locale} «${said}» → ${want}`, async () => {
      sim = await createVoiceSim({ locale, route: '/' });
      await sim.say(said);
      await sim.wait(10);
      expect(viewed()).toBe(want);
    });
  }
  test('varios con el mismo nombre: pregunta cuál', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/' });
    await sim.say('abrí la ficha de Ana');
    expect(sim.card().choices).toEqual(['Ana Gómez', 'Ana Martínez']);
    await sim.say('Martínez');
    await sim.wait(10);
    expect(viewed()).toBe('p3:info');
  });
  test('no existe: lo dice', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/' });
    await sim.say('abrí la ficha de Zoe Zamora');
    expect(sim.card().message).toBe('No encontré a «Zoe Zamora» entre los pacientes.');
  });
});

test.describe('RL-BILL · Cobro rápido', () => {
  for (const [locale, said, want] of [
    ['es', 'cobro rápido', 'bill:-:-'], ['es', 'abrí el cobro rápido', 'bill:-:-'], ['es', 'quiero cobrar', 'bill:-:-'],
    ['es', 'cobrale a Juan Pérez', 'bill:p2:Juan Pérez'], ['es', 'hacé un cobro rápido a Carlos López', 'bill:p4:Carlos López'],
    ['es-ES', 'cóbrale a Sofía Castro', 'bill:p9:Sofía Castro'], ['en', 'quick bill', 'bill:-:-'], ['en', 'charge Juan Pérez', 'bill:p2:Juan Pérez'],
    ['en', 'open quick billing for Roberto Díaz', 'bill:p8:Roberto Díaz'],
  ] as const) {
    test(`${locale} «${said}»`, async () => {
      sim = await createVoiceSim({ locale, route: '/patients' });
      await sim.say(said);
      expect(sim.rail.log).toEqual([want]);
    });
  }
});

test.describe('RL-SEDE · Sede de trabajo', () => {
  test.beforeEach(async () => { sim = await createVoiceSim({ locale: 'es', route: '/' }); });
  test('«cambiá a la sede Pocitos»', async () => { await sim.say('cambiá a la sede Pocitos'); expect(sim.rail.log).toEqual(['sede:s2']); });
  test('«quiero trabajar en la sede pocitos»', async () => { await sim.say('quiero trabajar en la sede pocitos'); expect(sim.rail.log).toEqual(['sede:s2']); });
  test('«en qué sede estoy»', async () => { await sim.say('en qué sede estoy'); expect(sim.card().message).toBe('Estás trabajando en Centro.'); });
  test('«cambiá de sede» pregunta cuál', async () => { await sim.say('cambiá de sede'); await sim.say('la segunda'); expect(sim.rail.log).toEqual(['sede:s2']); });
  test('ya está en esa sede', async () => { await sim.say('cambiá a la sede centro'); expect(sim.rail.log).toEqual([]); });
  test('en «switch to the Pocitos location»', async () => {
    sim.dispose();
    sim = await createVoiceSim({ locale: 'en', route: '/' });
    await sim.say('switch to the location Pocitos');
    expect(sim.rail.log).toEqual(['sede:s2']);
  });
});

test.describe('RL-CASH · Caja', () => {
  test('«¿está abierta la caja?» cerrada', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/' });
    await sim.say('está abierta la caja');
    expect(sim.card().message).toBe('La caja está cerrada.');
  });
  test('«cuánto hay en caja» abierta dice los saldos', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/' });
    sim.rail.bridge.cash = { open: true, balances: [{ currency: 'UYU', amount: 1500 }] };
    await sim.say('cuánto hay en caja');
    expect(sim.card().message).toMatch(/^La caja está abierta: .*1\.?500/);
  });
  test('«abrí la caja» cerrada: lleva a Caja para abrirla', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/' });
    await sim.say('abrí la caja');
    expect(sim.navigations).toEqual(['/cashier']);
    expect(sim.card().message).toBe('Te llevo a Caja para abrirla.');
  });
  test('«abrí la caja» ya abierta: lo dice', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/' });
    sim.rail.bridge.cash = { open: true, balances: [] };
    await sim.say('abrí la caja');
    expect(sim.navigations).toEqual([]);
  });
  test('«cerrá la caja» abierta: lleva al cierre', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/' });
    sim.rail.bridge.cash = { open: true, balances: [] };
    await sim.say('cerrá la caja');
    expect(sim.navigations).toEqual(['/cashier?view=active']);
  });
  test('en «is the cash register open»', async () => {
    sim = await createVoiceSim({ locale: 'en', route: '/' });
    await sim.say('is the cash register open');
    expect(sim.card().message).toBe('The cash register is closed.');
  });
});

test.describe('RL-TV · Pantalla de la sala', () => {
  test.beforeEach(async () => { sim = await createVoiceSim({ locale: 'es', route: '/' }); });
  for (const [said, want] of [['pausá la tele', 'tv:paused'], ['apagá la pantalla de la sala', 'tv:off'], ['poné las promociones', 'tv:promo'], ['abrí la pantalla tv', 'tv-screen']] as const) {
    test(`«${said}»`, async () => { await sim.say(said); expect(sim.rail.log).toEqual([want]); });
  }
  test('«prendé la tele» ya prendida: lo dice', async () => { await sim.say('prendé la tele'); expect(sim.rail.log).toEqual([]); });
  test('«llamá al siguiente paciente» con dos sillones pregunta', async () => {
    await sim.say('llamá al siguiente paciente');
    expect(sim.card().choices).toEqual(['Sillón 1', 'Sillón 2']);
    await sim.say('el segundo');
    expect(sim.rail.log).toEqual(['tv-next:c2']);
  });
  test('«siguiente paciente en el sillón 1»', async () => { await sim.say('siguiente paciente en el sillón 1'); expect(sim.rail.log).toEqual(['tv-next:c1']); });
  test('apagada: no llama', async () => { sim.rail.bridge.tv!.status = 'off'; await sim.say('llamá al siguiente paciente'); expect(sim.rail.log).toEqual([]); });
  test('en «turn off the tv»', async () => {
    sim.dispose();
    sim = await createVoiceSim({ locale: 'en', route: '/' });
    await sim.say('turn off the tv');
    expect(sim.rail.log).toEqual(['tv:off']);
  });
});

test.describe('RL-INFO · Alertas, bandeja, tipo de cambio', () => {
  test('«tengo alertas»', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/' });
    await sim.say('tengo alertas');
    expect(sim.card().message).toBe('Tenés 3 alertas pendientes; la más urgente es alta.');
  });
  test('es-ES «cuántas alertas tengo»', async () => {
    sim = await createVoiceSim({ locale: 'es-ES', route: '/' });
    await sim.say('cuántas alertas tengo');
    expect(sim.card().message).toBe('Tienes 3 alertas pendientes; la más urgente es alta.');
  });
  test('«abrí las notificaciones»', async () => { sim = await createVoiceSim({ locale: 'es', route: '/' }); await sim.say('abrí las notificaciones'); expect(sim.rail.log).toEqual(['inbox']); });
  test('«tengo mensajes» sin nada', async () => { sim = await createVoiceSim({ locale: 'es', route: '/' }); await sim.say('tengo mensajes'); expect(sim.card().message).toBe('No tenés notificaciones nuevas.'); });
  test('«a cuánto está el dólar»', async () => { sim = await createVoiceSim({ locale: 'es', route: '/' }); await sim.say('a cuánto está el dólar'); expect(sim.card().message).toBe('El tipo de cambio de la caja es USD 39.50.'); });
  test('en «what is the exchange rate»', async () => { sim = await createVoiceSim({ locale: 'en', route: '/' }); await sim.say('what is the exchange rate'); expect(sim.card().message).toBe('The cash register exchange rate is USD 39.50.'); });
  test('en «any alerts»', async () => { sim = await createVoiceSim({ locale: 'en', route: '/' }); await sim.say('any alerts'); expect(sim.card().message).toBe('You have 3 pending alerts; the most urgent is high.'); });
});

test.describe('RL-NOTES · Notas', () => {
  test('«abrí las notas»', async () => { sim = await createVoiceSim({ locale: 'es', route: '/' }); await sim.say('abrí las notas'); expect(sim.rail.log).toEqual(['notes']); });
  test('«nueva nota: llamar al laboratorio el lunes»', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/' });
    await sim.say('nueva nota: llamar al laboratorio el lunes');
    expect(sim.rail.log).toEqual(['note:llamar al laboratorio el lunes']);
  });
  test('«anotá que diga comprar guantes»', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/' });
    await sim.say('anotá que diga comprar guantes');
    expect(sim.rail.log).toEqual(['note:comprar guantes']);
  });
  test('«agregá una nota» sin texto pregunta', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/' });
    await sim.say('agregá una nota');
    expect(sim.card().message).toBe('¿Qué anoto?');
    await sim.say('Pedir turno con el técnico');
    expect(sim.rail.log).toEqual(['note:Pedir turno con el técnico']);
  });
  test('en «add a note saying call the lab»', async () => {
    sim = await createVoiceSim({ locale: 'en', route: '/' });
    await sim.say('add a note saying call the lab');
    expect(sim.rail.log).toEqual(['note:call the lab']);
  });
});

test.describe('RL-PANEL · Panel derecho y asistente', () => {
  test('«escondé el panel derecho» y «mostrá el panel derecho»', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/' });
    await sim.say('escondé el panel derecho');
    await sim.say('mostrá el panel derecho');
    expect(sim.rail.log).toEqual(['panel:closed', 'panel:open']);
  });
  test('en «hide the right panel»', async () => {
    sim = await createVoiceSim({ locale: 'en', route: '/' });
    await sim.say('hide the right panel');
    expect(sim.rail.log).toEqual(['panel:closed']);
  });
  test('«despertá al asistente» aprieta el botón del asistente', async () => {
    sim = await createVoiceSim({ locale: 'es', route: '/' });
    const launcher = screen.button('', { aria: 'Asistente' });
    launcher.setAttribute('data-help-id', 'rail.section.assistant');
    screen.page(launcher);
    await sim.say('despertá al asistente');
    expect(sim.card().message).toBe('Abrí el asistente.');
  });
});

test.describe('RL-PRIORITY · En la agenda gana la agenda', () => {
  test('«cobrale» con la cita en foco es de la agenda (cobra esa cita)', async () => {
    sim = await createVoiceSim({ locale: 'es' });
    await sim.say('la cita de Carlos');
    await sim.say('cobrale');
    expect(sim.rail.log).toEqual([]);
  });
  test('«abrí la cuenta» con la cita en foco es la de ese paciente (agenda)', async () => {
    sim = await createVoiceSim({ locale: 'es' });
    await sim.say('la cita de Carlos');
    await sim.say('abrí la cuenta');
    expect(sim.rail.log).toEqual([]);
  });
});
