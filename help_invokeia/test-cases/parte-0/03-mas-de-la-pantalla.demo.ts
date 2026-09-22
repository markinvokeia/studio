/**
 * PARTE 0 — Para todos · el resto de «Moverse por la pantalla» y
 * «Tu configuración personal».
 *
 * Están juntas acá porque comparten pantalla (la tira derecha y /preferences)
 * y así el bloque `T` se escribe una sola vez.
 */
import { demoTest, expect } from '../../lib/demo.fixture';

const T = {
  // VoiceInput.startDictation — el micrófono dentro de los campos de texto largo
  startDictation: 'Iniciar dictado',
  // PreferencesPage.*
  notificationsSection: 'Notificaciones',
  toastPositionLabel: 'Posición de los mensajes',
  toastPositionPreview: 'Los mensajes se mostrarán aquí',
  toastTopRight: 'Arriba derecha',
  toastBottomRight: 'Abajo derecha',
  signatureSection: 'Firma',
  // SignatureUploader / SignaturePad
  drawSignature: 'Dibujar firma',
  signaturePadTitle: 'Dibujar firma',
  useSignature: 'Usar esta firma',
  clearSignature: 'Borrar todo',
  // WorkingSedeSelector
  sedeTitle: 'Sede de Trabajo',
  // StickyNotes
  newNote: 'Nueva nota',
  saveNote: 'Guardar',
  deleteNote: 'Eliminar nota',
  // QuickPatientSearch
  patientSearchTitle: 'Buscar paciente',
  patientSearchPlaceholder: 'Buscar paciente por nombre o teléfono…',
};

demoTest('q012', async ({ demo, page }) => {
  await demo.intro('/patients', 'El micrófono dentro de los campos de texto largo');

  await demo.click(
    page.getByRole('button', { name: /nuevo|crear|agregar/i }).first(),
    'Abrí un formulario que tenga un campo de texto largo',
  );

  const mic = page.getByRole('button', { name: T.startDictation }).first();

  await demo.spotlight(
    mic,
    'Dentro del campo aparece un ícono de micrófono',
  );

  await demo.note('Lo pulsás, hablás, y lo que digas se transcribe directamente en el campo');

  await demo.note(
    'Es lo más útil durante la atención: registrás la evolución sin soltar el instrumental',
  );

  await demo.finish();
});

demoTest('q017', async ({ demo, page }) => {
  await demo.intro('/preferences', 'Preferencias → Notificaciones');

  await demo.spotlight(
    page.getByText(T.toastPositionLabel).first(),
    'En Notificaciones está «Posición de los mensajes»',
  );

  await demo.click(
    page.getByText(T.toastTopRight).first(),
    'Elegí Arriba derecha',
  );

  // La vista previa es un toast de verdad, así que se auto-cierra: `demo.toast()`
  // lo congela poniéndole el puntero encima (Radix pausa su temporizador) para
  // que dé tiempo a verlo.
  await demo.toast('Aparece un mensaje de ejemplo en la esquina elegida');

  await demo.click(page.getByText(T.toastBottomRight).first(), 'Probemos Abajo derecha');

  await demo.toast('Y ahora el mensaje aparece abajo a la derecha');

  await demo.note('En pantallas chicas los mensajes siempre salen arriba: esto aplica de tablet en adelante');

  await demo.finish();
});

demoTest('q018', async ({ demo, page }) => {
  await demo.intro('/preferences', 'Preferencias → Firma');

  await demo.spotlight(
    page.getByText(T.signatureSection).first(),
    'Al final de Preferencias está la sección Firma',
  );

  await demo.note('Podés subir una imagen PNG, JPG o WEBP de hasta 1 MB, o dibujarla');

  await demo.click(
    page.getByRole('button', { name: T.drawSignature }).first(),
    'Vamos a dibujarla',
  );

  await demo.step('Se abre el panel de firma', async () => {
    await expect(page.getByRole('dialog')).toContainText(T.signaturePadTitle);
  });

  // Se traza a mano sobre el canvas: es lo que hace el usuario con el dedo o el lápiz.
  await demo.step('Trazá la firma con el ratón, el dedo o un lápiz digital', async () => {
    const canvas = page.locator('canvas').first();
    const box = await canvas.boundingBox();
    expect(box, 'el panel de firma debe tener un canvas').not.toBeNull();
    const { x, y, width, height } = box!;
    const midY = y + height / 2;
    await page.mouse.move(x + width * 0.15, midY);
    await page.mouse.down();
    for (const [dx, dy] of [
      [0.25, -0.22], [0.35, 0.18], [0.45, -0.25], [0.55, 0.12],
      [0.65, -0.18], [0.75, 0.08], [0.85, -0.05],
    ]) {
      await page.mouse.move(x + width * dx, midY + height * dy, { steps: 8 });
    }
    await page.mouse.up();
  });

  await demo.note('Se guarda como imagen con fondo transparente y se imprime al pie de tus recetas');

  // No se guarda: dejaría la firma pegada a la cuenta con la que se graba.
  await demo.click(
    page.getByRole('button', { name: /^cancelar$/i }).last(),
    'Acá cerramos sin guardar, porque es sólo la demostración',
  );

  await demo.finish('Permiso: USER_SIGNATURE_UPLOAD');
});

demoTest('q019', async ({ demo, page }) => {
  await demo.intro('/', 'Panel flotante derecho → Sede');

  await demo.click(
    page.getByTestId('rail-sede'),
    'En la tira derecha, pulsá Sede',
  );

  await demo.step('Se despliega el selector de sede de trabajo', async () => {
    await expect(page.getByText(T.sedeTitle).first()).toBeVisible();
  });

  await demo.note('La sede define qué agendas ves por defecto y a qué sede se imputa lo que registrás');

  await demo.note('Si todavía no elegiste ninguna, el sistema te la pide al entrar y no se puede saltear');

  await demo.finish();
});

demoTest('q020', async ({ demo, page }) => {
  await demo.intro('/', 'Panel flotante derecho → Notas');

  await demo.click(page.getByTestId('rail-notas'), 'En la tira derecha, pulsá Notas');

  await demo.click(
    page.getByRole('button', { name: T.newNote }).first(),
    'Creá una nota nueva',
  );

  const texto = 'Llamar al laboratorio por la prótesis · demo';
  await demo.type(
    page.getByRole('textbox').last(),
    texto,
    'Escribí lo que no querés que se te pierda',
  );

  await demo.click(page.getByRole('button', { name: T.saveNote }).last(), 'Guardá');

  await demo.note('Queda pegada sobre la pantalla, como un papel adhesivo');

  await demo.note(
    'No tienen fecha ni salen en el calendario: si querés aviso, eso es un recordatorio',
  );

  // Limpieza obligatoria: la nota se creó en la base compartida de DEV. Si queda
  // huérfana, aparece pegada en la pantalla de TODOS los videos siguientes.
  // Se apunta a la papelera DENTRO de la tarjeta recién creada, no a la primera
  // de la lista, que podría ser una nota real de otra persona.
  await demo.step('Y se quita cuando ya no hace falta', async () => {
    const card = page.getByText(texto).first();
    await expect(card).toBeVisible();
    const holder = card.locator(`xpath=ancestor::*[.//button[@title="${T.deleteNote}"]][1]`);
    await holder.locator(`button[title="${T.deleteNote}"]`).first().click();
    await expect(page.getByText(texto)).toHaveCount(0, { timeout: 10_000 });
  });

  await demo.finish('Permiso: STICKY_NOTES_VIEW · STICKY_NOTES_CREATE');
});

demoTest('q021', async ({ demo, page }) => {
  await demo.intro('/', 'Panel flotante derecho → Paciente');

  await demo.click(
    page.getByTestId('rail-paciente'),
    'Desde cualquier pantalla, pulsá Paciente en la tira derecha',
  );

  await demo.step('Se abre el buscador rápido', async () => {
    await expect(page.getByPlaceholder(T.patientSearchPlaceholder)).toBeVisible();
  });

  await demo.type(
    page.getByPlaceholder(T.patientSearchPlaceholder),
    'Ana',
    'Escribí el nombre o el teléfono',
  );

  await demo.note('Elegís un resultado y se abre su ficha, sin perder dónde estabas');

  await demo.finish('Permiso: PATIENTS_VIEW_LIST');
});
