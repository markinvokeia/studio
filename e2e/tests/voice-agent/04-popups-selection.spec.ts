import { expect, test } from '@playwright/test';

import { syncUiSelection } from '@/lib/voice/focus';

import { openPopup, openWindow, type PopupButtonSpec } from './sim/dom';
import { createVoiceSim, type VoiceSim } from './sim/harness';

/**
 * PU · Avisos de la agenda y lo seleccionado (docs/voz-agenda-pruebas.md §PU), con los textos reales
 * de cada aviso en español y en inglés: aparece el aviso → la voz lo lee, dice sus botones y
 * pregunta → lo que se dice aprieta ese botón (por su texto, su posición o sí/no). También ventanas
 * y paneles laterales que se cierran por voz, y la ley de lo seleccionado en pantalla.
 */

let sim: VoiceSim;
test.afterEach(() => sim.dispose());

interface PopupCase { name: string; title: string; buttons: PopupButtonSpec[]; role?: 'alertdialog' | 'dialog' }

const POPUPS: Record<'es' | 'en', PopupCase[]> = {
  es: [
    { name: 'citas futuras del paciente', title: 'Atención', buttons: [{ label: 'No', kind: 'cancel' }, { label: 'Sí', kind: 'confirm' }] },
    { name: 'eliminar cita', title: 'Eliminar cita', buttons: [{ label: 'Cancelar', kind: 'cancel' }, { label: 'Sí, eliminar', kind: 'confirm' }] },
    { name: 'cancelar cita', title: 'Cancelar Cita', buttons: [{ label: 'Cerrar', kind: 'cancel' }, { label: 'Cancelar', kind: 'confirm' }] },
    { name: 'descartar cambios', title: '¿Descartar cambios?', buttons: [{ label: 'Seguir editando', kind: 'cancel' }, { label: 'Descartar cambios', kind: 'confirm' }] },
    { name: 'falta el documento', title: 'Falta el documento de identidad', buttons: [{ label: 'Cerrar', kind: 'cancel' }, { label: 'Entendido', kind: 'confirm' }] },
    { name: 'motivo de la cancelación', title: 'Motivo de la cancelación', role: 'dialog', buttons: [{ label: 'Volver' }, { label: 'Cancelar cita' }] },
  ],
  en: [
    { name: 'patient future appointments', title: 'Attention', buttons: [{ label: 'No', kind: 'cancel' }, { label: 'Yes', kind: 'confirm' }] },
    { name: 'delete appointment', title: 'Delete appointment', buttons: [{ label: 'Cancel', kind: 'cancel' }, { label: 'Yes, delete', kind: 'confirm' }] },
    { name: 'cancel appointment', title: 'Cancel Appointment', buttons: [{ label: 'Close', kind: 'cancel' }, { label: 'Cancel', kind: 'confirm' }] },
    { name: 'discard changes', title: 'Discard changes?', buttons: [{ label: 'Keep editing', kind: 'cancel' }, { label: 'Discard changes', kind: 'confirm' }] },
    { name: 'identity document', title: 'Identity document required', buttons: [{ label: 'Close', kind: 'cancel' }, { label: 'Got it', kind: 'confirm' }] },
    { name: 'cancellation reason', title: 'Cancellation reason', role: 'dialog', buttons: [{ label: 'Back' }, { label: 'Cancel appointment' }] },
  ],
};

/** Qué decir para cada botón, y cómo decir sí / no / la posición. */
const SAY: Record<'es' | 'en', { yes: string; no: string; second: string; first: string }> = {
  es: { yes: 'sí', no: 'no', second: 'el segundo', first: 'el primero' },
  en: { yes: 'yes', no: 'no', second: 'the second one', first: 'the first one' },
};

for (const locale of ['es', 'en'] as const) {
  test.describe(`PU-${locale.toUpperCase()} · Avisos de la agenda`, () => {
    test.beforeEach(async () => { sim = await createVoiceSim({ locale }); });
    for (const popup of POPUPS[locale]) {
      const [first, second] = popup.buttons;
      test(`«${popup.name}»: la voz lee el aviso y dice sus botones`, async () => {
        openPopup(popup.title, popup.buttons, { role: popup.role });
        await sim.wait(30);
        expect(sim.card().title).toBe(popup.title);
        expect(sim.card().choices).toEqual(popup.buttons.map((b) => b.label));
        expect(sim.card().awaiting).toBe('choice');
      });
      for (const button of popup.buttons) {
        test(`«${popup.name}»: decir «${button.label}» aprieta ese botón`, async () => {
          const shown = openPopup(popup.title, popup.buttons, { role: popup.role });
          await sim.wait(30);
          await sim.say(button.label);
          expect(shown.pressed).toEqual([button.label]);
        });
      }
      test(`«${popup.name}»: «${SAY[locale].yes}» aprieta el principal`, async () => {
        const shown = openPopup(popup.title, popup.buttons, { role: popup.role });
        await sim.wait(30);
        await sim.say(SAY[locale].yes);
        expect(shown.pressed).toEqual([second.label]);
      });
      test(`«${popup.name}»: «${SAY[locale].no}» aprieta el de volver/cancelar`, async () => {
        const shown = openPopup(popup.title, popup.buttons, { role: popup.role });
        await sim.wait(30);
        await sim.say(SAY[locale].no);
        expect(shown.pressed).toEqual([first.label]);
      });
      test(`«${popup.name}»: «${SAY[locale].second}» por posición`, async () => {
        const shown = openPopup(popup.title, popup.buttons, { role: popup.role });
        await sim.wait(30);
        await sim.say(SAY[locale].second);
        expect(shown.pressed).toEqual([second.label]);
      });
    }

    test('si el aviso se cierra con el mouse, la pregunta se va y vuelve la que había', async () => {
      await sim.say(locale === 'es' ? 'la cita de Ana' : "Ana's appointment");
      const shown = openPopup(POPUPS[locale][0].title, POPUPS[locale][0].buttons);
      await sim.wait(30);
      expect(sim.card().title).toBe(POPUPS[locale][0].title);
      shown.close();
      await sim.wait(60);
      expect(sim.card().choices).toHaveLength(2);
      expect(sim.card().choices[0]).toMatch(/Ana/);
    });
    test('una respuesta que no es ningún botón vuelve a preguntar', async () => {
      const shown = openPopup(POPUPS[locale][1].title, POPUPS[locale][1].buttons);
      await sim.wait(30);
      await sim.say(locale === 'es' ? 'qué lindo día' : 'what a nice day');
      expect(shown.pressed).toEqual([]);
      expect(sim.card().awaiting).toBe('choice');
      await sim.say(SAY[locale].yes);
      expect(shown.pressed).toHaveLength(1);
    });
    test('aviso de elegir y confirmar (alcance de un recordatorio): pregunta dos veces', async () => {
      const labels = locale === 'es' ? ['Solo esta ocurrencia', 'Toda la serie', 'Continuar'] : ['This occurrence only', 'The whole series', 'Continue'];
      const shown = openPopup(locale === 'es' ? 'Recordatorio' : 'Reminder', [{ label: labels[0], closes: false }, { label: labels[1], closes: false }, { label: labels[2], kind: 'confirm' }], { role: 'dialog' });
      await sim.wait(30);
      await sim.say(labels[1]);
      await sim.wait(260);
      expect(sim.card().awaiting).toBe('choice');
      await sim.say(labels[2]);
      expect(shown.pressed).toEqual([labels[1], labels[2]]);
    });
    test('con el micrófono apagado el aviso no pregunta nada', async () => {
      await sim.toggle();
      openPopup(POPUPS[locale][0].title, POPUPS[locale][0].buttons);
      await sim.wait(30);
      expect(sim.card().title).not.toBe(POPUPS[locale][0].title);
    });
  });

  test.describe(`PU-${locale.toUpperCase()} · Ventanas y paneles laterales`, () => {
    test.beforeEach(async () => { sim = await createVoiceSim({ locale }); });
    const windows = locale === 'es' ? ['Estado de cuenta', 'Historia clínica', 'Datos del paciente', 'Imágenes y archivos', 'Historial de citas'] : ['Account statement', 'Medical history', 'Patient details', 'Images and files', 'Appointment history'];
    const closes = locale === 'es' ? ['cerrá', 'cerrá eso', 'cerralo', 'escondé la ventana', 'que no se vea', 'no quiero ver eso', 'volvé atrás', 'sacalo de ahí'] : ['close', 'close it', 'close that window', 'hide it', "I don't want to see that", 'go back', 'get rid of that'];
    for (const title of windows) {
      for (const said of closes) {
        test(`«${title}» + «${said}» la cierra`, async () => {
          const shown = openWindow(title);
          await sim.say(said);
          expect(shown.open).toBe(false);
        });
      }
    }
    test('«cerrá todo» cierra las ventanas y los paneles de la agenda', async () => {
      await sim.say(locale === 'es' ? 'abrí el panel de agendas' : 'open the calendars panel');
      const a = openWindow(windows[0]);
      const b = openWindow(windows[1]);
      await sim.say(locale === 'es' ? 'cerrá todo' : 'close everything');
      expect([a.open, b.open, sim.cal.state.agendasPanel.open]).toEqual([false, false, false]);
    });
    test('cierra la de arriba primero', async () => {
      const below = openWindow(windows[0]);
      const above = openWindow(windows[1]);
      await sim.say(locale === 'es' ? 'cerrá' : 'close');
      expect([below.open, above.open]).toEqual([true, false]);
    });
  });

  test.describe(`SEL-${locale.toUpperCase()} · Lo seleccionado en pantalla es de lo que se habla`, () => {
    test.beforeEach(async () => { sim = await createVoiceSim({ locale }); });
    const say = (es: string, en: string) => sim.say(locale === 'es' ? es : en);
    test('cita abierta con el mouse: «llegó» es sobre ella, sin nombrarla', async () => {
      syncUiSelection(sim.cal.appointments.find((a) => a.id === 'a4')!);
      await say('llegó', 'arrived');
      await say('sí', 'yes');
      expect(sim.cal.calls('changeStatus')[0]?.slice(0, 2)).toEqual(['a4', 'arrived']);
    });
    test('cita abierta: «¿cuánto debe?» es su paciente', async () => {
      syncUiSelection(sim.cal.appointments.find((a) => a.id === 'a2')!);
      await say('cuánto debe', 'how much does he owe');
      expect(sim.cal.calls('getPatientFacts')[0]?.[0]).toBe('p2');
    });
    test('cita abierta: «editala» abre esa', async () => {
      syncUiSelection(sim.cal.appointments.find((a) => a.id === 'a4')!);
      await say('editala', 'edit it');
      expect(sim.cal.calls('openAppointmentForm')[0]).toEqual(['edit', 'a4']);
    });
    test('nombrar otra cita la reemplaza («buscá otra»)', async () => {
      syncUiSelection(sim.cal.appointments.find((a) => a.id === 'a4')!);
      await say('Juan Pérez llegó', 'Juan Pérez arrived');
      await say('sí', 'yes');
      expect(sim.cal.calls('changeStatus')[0]?.[0]).toBe('a2');
    });
    for (const [es, en] of [['vista semana', 'week view'], ['más zoom', 'zoom in'], ['andá a mañana', 'go to tomorrow'], ['slots de 15', '15 minute slots'], ['exportá la agenda', 'export the schedule'], ['cuántas veces faltó Carlos López', 'how many no shows does Carlos López have']] as const) {
      test(`cambio de contexto («${locale === 'es' ? es : en}») suelta la cita en foco`, async () => {
        await say('la cita de Juan Pérez', "Juan Pérez's appointment");
        expect(sim.store().focusLabel).toBe('Juan Pérez');
        await say(es, en);
        expect(sim.store().focusLabel).not.toBe('Juan Pérez');
      });
    }
    test('seguir hablando de la cita no la suelta (estado, cuenta, color)', async () => {
      await say('la cita de Juan Pérez', "Juan Pérez's appointment");
      await say('abrí su cuenta', 'open his account');
      await say('cuánto debe', 'how much does he owe');
      expect(sim.store().focusLabel).toBe('Juan Pérez');
    });
    test('una herramienta en medio de una pregunta sobre la cita no la suelta', async () => {
      await say('la cita de Juan Pérez', "Juan Pérez's appointment");
      await say('llegó', 'arrived');
      await say('más zoom', 'zoom in');
      await say('sí', 'yes');
      expect(sim.cal.calls('changeStatus')[0]?.slice(0, 2)).toEqual(['a2', 'arrived']);
    });
    test('al cerrar la cita seleccionada se suelta el foco', async () => {
      syncUiSelection(sim.cal.appointments.find((a) => a.id === 'a4')!);
      syncUiSelection(null);
      expect(sim.store().focusLabel).toBeNull();
    });
  });
}
