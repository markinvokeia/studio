import { expect, test, type Page, type Route } from '@playwright/test';

/**
 * Barra de dictado del periodontograma con el núcleo de voz: las frases (escritas en la misma
 * barra, que pasa por la misma cola que el micrófono) se aplican en orden; lo que el intérprete
 * local no entiende va a la IA (POST voice/interpret, módulo perio). El guardado del examen y la
 * IA están simulados: no se escribe nada en DEV.
 */

interface AiReply {
  commands: unknown[];
  confidence: number;
  /** Demora de la respuesta (para ver la cola) */
  delayMs?: number;
}

async function mockPerio(page: Page, replies: Record<string, AiReply>) {
  const aiRequests: { domain: string; text: string; context: Record<string, unknown> }[] = [];
  await page.route(/\/perio\/exams\/save(\?|$)/, async (route: Route) => {
    const body = route.request().postDataJSON() as { exam: Record<string, unknown> };
    await route.fulfill({ json: { exam: { ...body.exam, id: 990001, status: 'probing', completeness: 0 } } });
  });
  await page.route(/\/voice\/interpret(\?|$)/, async (route: Route) => {
    const body = route.request().postDataJSON() as { domain: string; text: string; context: Record<string, unknown> };
    aiRequests.push(body);
    const reply = replies[body.text] ?? { commands: [], confidence: 0 };
    if (reply.delayMs) await new Promise((resolve) => setTimeout(resolve, reply.delayMs));
    await route.fulfill({ json: { domain: body.domain, confidence: reply.confidence, result: { commands: reply.commands, confidence: reply.confidence } } });
  });
  return aiRequests;
}

/** Abre un periodontograma nuevo del primer paciente de la lista (queda en el sondaje). */
async function openNewPerio(page: Page) {
  await page.goto('/patients', { waitUntil: 'domcontentloaded' });
  const firstRow = page.locator('table tbody tr').first();
  await firstRow.waitFor({ state: 'visible', timeout: 30_000 });
  await firstRow.locator('td').nth(1).click();
  const clinical = page.getByRole('button', { name: /Historia clínica|^Clínica$/ }).or(page.getByRole('tab', { name: /Historia clínica|^Clínica$/ })).first();
  await clinical.waitFor({ state: 'visible', timeout: 30_000 });
  await clinical.click();
  const add = page.locator('[data-help-id$="btn.timeline-add"]').first();
  await add.waitFor({ state: 'visible', timeout: 20_000 });
  await add.click();
  await page.locator('[data-help-id$="btn.timeline-add-periodontogram"]').first().click();
  const input = page.locator('[data-help-id="perio-session.field.voice-command"]');
  await input.waitFor({ state: 'visible', timeout: 30_000 });
  return input;
}

async function type(page: Page, text: string) {
  const input = page.locator('[data-help-id="perio-session.field.voice-command"]');
  await input.fill(text);
  await input.press('Enter');
}

const bar = (page: Page) => page.locator('[data-help-id="perio-session.section.voice"]');

test.describe('Periodontograma — barra de dictado con IA', () => {
  test('lo local se aplica al instante; lo que no entiende va a la IA con la sonda, y las frases siguientes esperan su turno', async ({ page }) => {
    const aiRequests = await mockPerio(page, {
      'el vecino por adentro': {
        commands: [{ kind: 'neighbour', delta: 1 }, { kind: 'goto', side: 'i' }],
        confidence: 0.92,
        delayMs: 1500,
      },
    });
    await openNewPerio(page);

    // Local: la 16 vestibular, sin IA.
    await type(page, '16 vestibular 2 3 2');
    await expect(bar(page)).toContainText('2 3 2');
    expect(aiRequests).toHaveLength(0);

    // No la entiende: va a la IA; "3 2 4" se dice mientras tanto y espera (va a la pieza que dijo la IA).
    await type(page, 'el vecino por adentro');
    await type(page, '3 2 4');
    await expect(bar(page)).toContainText(/Interpretando con IA/);
    await expect(bar(page)).toContainText(/1 frase en espera/);
    await expect(bar(page)).toContainText(/14 P · PS\s*3 2 4/, { timeout: 15_000 });

    expect(aiRequests).toHaveLength(1);
    expect(aiRequests[0].domain).toBe('perio');
    const context = aiRequests[0].context as { pass: string; cursor: { tooth: number; side: string }; teeth: { present: number[] } };
    expect(context.pass).toBe('ps');
    expect(context.cursor.tooth).toBe(15);
    expect(context.teeth.present.length).toBeGreaterThan(0);
    // Sin datos del paciente: solo la sonda.
    expect(Object.keys(context).sort()).toEqual(['cursor', 'fm_tooth', 'focus', 'implants_only', 'line', 'margin_negative', 'pass', 'teeth']);

    // Lo escrito por la IA queda pendiente, como cualquier dictado.
    await expect(page.locator('[data-help-id="perio-session.section.voice-pending"]')).toContainText(/sitios? dictados?/);
    await page.screenshot({ path: 'test-results/perio-voice-ai-applied.png' });
  });

  test('un número que no se dijo: pregunta «¿Querías decir…?»; «no» lo deja sin escribir, «sí» lo escribe', async ({ page }) => {
    await mockPerio(page, {
      'primer molar inferior izquierdo por vestibular cuatro tres cinco': {
        commands: [{ kind: 'goto', tooth: 36, side: 'v' }, { kind: 'values', values: [4, 3, 5] }],
        confidence: 0.95,
      },
      'el primer molar de abajo a la izquierda vestibular dos dos dos': {
        commands: [{ kind: 'goto', tooth: 36, side: 'v' }, { kind: 'values', values: [2, 2, 2] }],
        confidence: 0.95,
      },
    });
    await openNewPerio(page);
    const question = page.locator('[data-help-id="perio-session.section.voice-question"]');

    await type(page, 'primer molar inferior izquierdo por vestibular cuatro tres cinco');
    await expect(question).toContainText('diente 36 vestibular, 4 3 5', { timeout: 15_000 });
    await type(page, 'no');
    await expect(question).toHaveCount(0);
    await expect(bar(page)).toContainText(/No se ha cambiado nada/);
    await expect(page.locator('[data-help-id="perio-session.section.voice-pending"]')).toHaveCount(0);

    await type(page, 'el primer molar de abajo a la izquierda vestibular dos dos dos');
    await expect(question).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: 'test-results/perio-voice-ai-question.png' });
    await type(page, 'sí');
    await expect(question).toHaveCount(0);
    await expect(bar(page)).toContainText('36');
    await expect(page.locator('[data-help-id="perio-session.section.voice-pending"]')).toBeVisible();
  });

  test('lo importante pregunta antes (estado de pieza, descartar); las preguntas se responden sin escribir', async ({ page }) => {
    await mockPerio(page, {});
    await openNewPerio(page);
    const question = page.locator('[data-help-id="perio-session.section.voice-question"]');
    const pending = page.locator('[data-help-id="perio-session.section.voice-pending"]');

    await type(page, '18 ausente');
    await expect(question).toContainText('¿Marco la 18 como ausente?');
    await type(page, 'no');
    await expect(question).toHaveCount(0);
    await expect(bar(page)).toContainText('No se ha cambiado nada');

    await type(page, '16 vestibular 3 2 4');
    await expect(pending).toBeVisible();
    await type(page, 'leeme el 16');
    await expect(page.locator('[data-help-id="perio-session.section.voice-answer"]')).toContainText('3 2 4');
    await type(page, '¿qué me falta?');
    await expect(page.locator('[data-help-id="perio-session.section.voice-answer"]')).toContainText(/Falta: \d+ de profundidad/);
    await type(page, '¿cuánto tenía el 16?');
    await expect(bar(page)).toContainText('No hay un examen anterior');

    // Otra frase deja la pregunta sin responder (no hace nada) y se aplica
    await type(page, 'el 46 es un implante');
    await expect(question).toContainText('46');
    await type(page, '3 3 3');
    await expect(question).toHaveCount(0);
    await expect(bar(page)).toContainText('Se ha quedado sin responder');

    await type(page, '18 ausente');
    await page.locator('[data-help-id="perio-session.btn.voice-yes"]').click();
    await expect(bar(page)).toContainText('La 18 ha quedado ausente');

    await type(page, 'descartar');
    await expect(question).toContainText('¿Descarto');
    await page.screenshot({ path: 'test-results/perio-voice-confirm.png' });
    await type(page, 'sí');
    await expect(pending).toHaveCount(0);
  });

  test('la IA no entiende o no responde: queda como «No entendí» y lo demás sigue', async ({ page }) => {
    await mockPerio(page, {});
    await openNewPerio(page);
    await type(page, 'esperá que atiendo el teléfono');
    await expect(bar(page)).toContainText(/No entendí/, { timeout: 15_000 });
    await type(page, '16 vestibular 3 3 3');
    await expect(bar(page)).toContainText('3 3 3');
  });
});
