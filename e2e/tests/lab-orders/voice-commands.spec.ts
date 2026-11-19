import { type Page, type Route } from '@playwright/test';
import { format, subDays } from 'date-fns';

import { test, expect } from '../../fixtures/test.fixture';

/**
 * Comandos de voz sobre órdenes de laboratorio (Ctrl+Espacio → "la orden N se envió ayer" →
 * confirmación por voz → la tarjeta pasa de columna).
 *
 *   pnpm exec playwright test e2e/tests/lab-orders/voice-commands.spec.ts --project=chromium
 *
 * Playwright no tiene micrófono: el reconocimiento de voz del navegador se reemplaza por uno
 * falso que "escucha" lo que el test pone en window.__voiceQueue. La voz del asistente va
 * silenciada. Las lecturas (tablero, detalle, etapas, laboratorios) van contra DEV; el cambio de
 * etapa se intercepta y se responde con la orden movida, así no se modifica ningún dato.
 */

const yesterday = () => format(subDays(new Date(), 1), 'yyyy-MM-dd');

/** Reconocimiento de voz falso: entrega lo que haya en la cola mientras escucha. */
function fakeSpeechRecognition() {
  const w = window as unknown as { __voiceQueue: string[]; webkitSpeechRecognition: unknown; SpeechRecognition?: unknown };
  w.__voiceQueue = [];
  class FakeRecognition {
    continuous = false;
    interimResults = false;
    lang = '';
    onresult: ((e: unknown) => void) | null = null;
    onerror: ((e: unknown) => void) | null = null;
    onend: ((e: unknown) => void) | null = null;
    onspeechstart: ((e: unknown) => void) | null = null;
    private timer: ReturnType<typeof setInterval> | null = null;
    private ended = false;
    start() {
      this.timer = setInterval(() => {
        const text = w.__voiceQueue.shift();
        if (text == null) return;
        this.onspeechstart?.({});
        this.onresult?.({ resultIndex: 0, results: { length: 1, 0: { isFinal: true, 0: { transcript: text } } } });
        if (!this.continuous) this.end();
      }, 100);
    }
    stop() { setTimeout(() => this.end(), 30); }
    abort() { this.end(); }
    private end() {
      if (this.ended) return;
      this.ended = true;
      if (this.timer) clearInterval(this.timer);
      this.onend?.({});
    }
  }
  w.SpeechRecognition = undefined;
  w.webkitSpeechRecognition = FakeRecognition;
  try {
    localStorage.setItem('invoke-help-voice-muted', '1');
    localStorage.setItem('lab-orders-view', 'board');
  } catch { /* sin storage */ }
}

async function say(page: Page, text: string) {
  await page.evaluate((t) => { (window as unknown as { __voiceQueue: string[] }).__voiceQueue.push(t); }, text);
}

/** Ctrl+Espacio mantenido mientras se "dice" la frase. */
async function pushToTalk(page: Page, text: string) {
  await page.keyboard.down('Control');
  await page.keyboard.down('Space');
  await say(page, text);
  await page.waitForTimeout(600);
  await page.keyboard.up('Space');
  await page.keyboard.up('Control');
}

interface Captured {
  details: Map<number, Record<string, unknown>>;
  stages: { id: number; name: string; kind: string }[];
  stageChanges: Record<string, unknown>[];
}

/** Guarda el detalle y las etapas que llegan de DEV y simula el cambio de etapa. */
async function interceptLabOrders(page: Page): Promise<Captured> {
  const captured: Captured = { details: new Map(), stages: [], stageChanges: [] };
  await page.route(/\/lab-orders\/detail(\?|$)/, async (route: Route) => {
    const response = await route.fetch();
    const json = await response.json();
    const rows = Array.isArray(json) ? json : [json];
    const detail = (rows[0]?.json ?? rows[0])?.detail;
    if (detail?.id != null) captured.details.set(Number(detail.id), detail);
    await route.fulfill({ response, json });
  });
  await page.route(/\/lab-stages(\?|$)/, async (route: Route) => {
    const response = await route.fetch();
    const json = await response.json();
    const list = (Array.isArray(json) ? json : [json]).flatMap((row: any) => {
      const r = row?.json ?? row;
      return r?.id != null ? [r] : r?.stages ?? [];
    });
    captured.stages = list.map((s: any) => ({ id: Number(s.id), name: String(s.name), kind: String(s.kind) }));
    await route.fulfill({ response, json });
  });
  await page.route(/\/lab-orders\/change-stage(\?|$)/, async (route: Route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    captured.stageChanges.push(body);
    const detail = captured.details.get(Number(body.id)) ?? {};
    const stage = captured.stages.find((s) => s.id === Number(body.to_stage_id));
    await route.fulfill({
      json: [{
        ...detail,
        current_stage_id: body.to_stage_id,
        stage_name: stage?.name ?? detail.stage_name,
        stage_kind: stage?.kind ?? detail.stage_kind,
        stage_entered_at: `${String(body.effective_date ?? format(new Date(), 'yyyy-MM-dd'))}T12:00:00Z`,
        due_date: body.due_date ?? detail.due_date,
        laboratory_id: body.laboratory_id ?? detail.laboratory_id,
      }],
    });
  });
  return captured;
}

/** Etapa inicial y la de envío (la primera intermedia), con los nombres de la clínica. */
function sendStages(captured: Captured) {
  const initial = captured.stages.find((s) => s.kind === 'initial');
  const send = captured.stages.find((s) => s.kind === 'intermediate');
  if (!initial || !send) throw new Error('DEV no tiene etapa inicial e intermedia');
  return { initial: initial.name, send: send.name };
}

/** Id de la primera orden de la columna inicial del tablero. */
async function firstInitialOrderId(page: Page, captured: Captured): Promise<number> {
  await expect.poll(() => captured.stages.length, { timeout: 30_000 }).toBeGreaterThan(0);
  const column = page.getByRole('region', { name: sendStages(captured).initial, exact: true });
  const card = column.locator('[data-lab-card-id]').first();
  await expect(card).toBeVisible({ timeout: 30_000 });
  return Number(await card.getAttribute('data-lab-card-id'));
}

/**
 * Responde "el uno" a cada pregunta con opciones (paciente, servicio, laboratorio repetidos en
 * DEV) hasta que la tarjeta pide confirmar.
 */
async function answerChoicesUntil(page: Page, card: ReturnType<Page['locator']>, ready: RegExp) {
  const firstChoice = card.locator('button').filter({ hasText: /^1/ });
  for (let i = 0; i < 4; i++) {
    await expect(card.filter({ hasText: ready }).or(firstChoice)).toBeVisible({ timeout: 25_000 });
    if (await card.filter({ hasText: ready }).isVisible()) return;
    await say(page, 'el uno');
    await expect(firstChoice).toBeHidden({ timeout: 10_000 }).catch(() => {});
  }
  await expect(card).toContainText(ready);
}

test.describe('Comandos de voz — órdenes de laboratorio', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(fakeSpeechRecognition);
  });

  test('"la orden N se envió ayer": confirma por voz y la tarjeta pasa de columna', async ({ page }) => {
    const captured = await interceptLabOrders(page);
    await page.goto('/lab-orders');
    const id = await firstInitialOrderId(page, captured);

    await pushToTalk(page, `la orden ${id} se envió ayer`);

    const card = page.locator('[data-voice-card]');
    await expect(card).toContainText(`#${id}`);

    // Sin laboratorio pregunta cuál (se responde "el uno"); después pide confirmar.
    const confirm = card.getByRole('button', { name: /Sí, confirmar/ });
    const firstLab = card.getByRole('button', { name: /^1/ });
    await expect(confirm.or(firstLab)).toBeVisible({ timeout: 20_000 });
    if (await firstLab.isVisible()) await say(page, 'el uno');

    await expect(confirm).toBeVisible({ timeout: 20_000 });
    const { initial, send } = sendStages(captured);
    await expect(card).toContainText(`${initial} → ${send}`);
    await expect(card).toContainText(/ayer/i);
    await page.screenshot({ path: 'test-results/voice-confirm.png' });

    await say(page, 'sí, dale');
    await expect(card).toContainText(/pas(ó|ado) a «/, { timeout: 20_000 });

    expect(captured.stageChanges).toHaveLength(1);
    expect(captured.stageChanges[0]).toMatchObject({ id, effective_date: yesterday() });
    expect(String(captured.stageChanges[0].due_date) >= yesterday()).toBeTruthy();

    // La tarjeta está ahora en la columna de envío, resaltada.
    const moved = page.getByRole('region', { name: send, exact: true }).locator(`[data-lab-card-id="${id}"]`);
    await expect(moved).toBeVisible();
    await expect(moved).toHaveClass(/ring-2/);
    await page.screenshot({ path: 'test-results/voice-moved.png' });
  });

  test('responder "no" no cambia nada', async ({ page }) => {
    const captured = await interceptLabOrders(page);
    await page.goto('/lab-orders');
    const id = await firstInitialOrderId(page, captured);

    await pushToTalk(page, `pasá la orden ${id} a la siguiente etapa`);
    const card = page.locator('[data-voice-card]');
    const confirm = card.getByRole('button', { name: /Sí, confirmar/ });
    const firstLab = card.getByRole('button', { name: /^1/ });
    await expect(confirm.or(firstLab)).toBeVisible({ timeout: 20_000 });
    if (await firstLab.isVisible()) await say(page, 'el uno');
    await expect(confirm).toBeVisible({ timeout: 20_000 });

    await say(page, 'no, cancelá');
    await expect(card).toContainText(/no (hice|he hecho) ningún cambio/i);
    expect(captured.stageChanges).toHaveLength(0);
  });

  test('una orden que no existe se avisa sin preguntar nada', async ({ page }) => {
    const captured = await interceptLabOrders(page);
    await page.goto('/lab-orders');
    await firstInitialOrderId(page, captured);
    await pushToTalk(page, 'la orden 9999999 se envió ayer');
    await expect(page.locator('[data-voice-card]')).toContainText(/No (encontré|he encontrado) la orden 9999999/, { timeout: 20_000 });
  });

  test('una frase que el intérprete local no entiende la resuelve la IA', async ({ page }) => {
    const captured = await interceptLabOrders(page);
    const id = await (async () => {
      await page.goto('/lab-orders');
      return firstInitialOrderId(page, captured);
    })();
    const aiRequests: Record<string, unknown>[] = [];
    await page.route(/\/voice\/interpret(\?|$)/, async (route) => {
      aiRequests.push(route.request().postDataJSON() as Record<string, unknown>);
      await route.fulfill({ json: { domain: 'lab_orders', confidence: 0.9, result: { intent: 'lab_order.move', order_id: id, move_kind: 'send', effective_date: yesterday(), confidence: 0.9, items: [], teeth: [] } } });
    });

    await pushToTalk(page, `la ${id} ya la mandamos ayer al lab`);
    const card = page.locator('[data-voice-card]');
    await answerChoicesUntil(page, card, /«sí» para confirmar/);
    await say(page, 'sí');
    await expect(card).toContainText(/pas(ó|ado) a «/, { timeout: 20_000 });

    // A la IA va la frase y la lista cerrada de etapas y laboratorios, nunca pacientes.
    expect(aiRequests).toHaveLength(1);
    expect(aiRequests[0].domain).toBe('lab_orders');
    const context = aiRequests[0].context as { stages: unknown[]; laboratories: unknown[] };
    expect(context.stages.length).toBeGreaterThan(0);
    expect(Object.keys(context).sort()).toEqual(['laboratories', 'stages']);
    expect(captured.stageChanges[0]).toMatchObject({ id, effective_date: yesterday() });
  });

  test('"creá una orden para…": abre el asistente en Revisar y "sí" la crea', async ({ page }) => {
    const captured = await interceptLabOrders(page);
    await page.goto('/lab-orders');
    const sourceId = await firstInitialOrderId(page, captured);
    // Paciente y trabajo reales de DEV (de una orden existente), así las búsquedas encuentran algo.
    await page.locator(`[data-lab-card-id="${sourceId}"]`).click();
    await expect.poll(() => captured.details.has(sourceId), { timeout: 20_000 }).toBeTruthy();
    await page.keyboard.press('Escape');
    const source = captured.details.get(sourceId) as { patient_name: string; patient_id: string; items?: { service_name: string }[]; work_description?: string };
    const service = source.items?.[0]?.service_name ?? source.work_description ?? 'corona';

    await page.route(/\/voice\/interpret(\?|$)/, (route) => route.fulfill({
      json: { result: { intent: 'lab_order.create', patient: source.patient_name, items: [{ service, quantity: 1, teeth: [36] }], teeth: [], is_urgent: true, send: false, confidence: 0.9 } },
    }));
    const saves: Record<string, unknown>[] = [];
    await page.route(/\/lab-orders\/save(\?|$)/, async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      saves.push(body);
      const initial = captured.stages.find((s) => s.kind === 'initial');
      await route.fulfill({ json: [{ ...source, id: 999999, current_stage_id: initial?.id, stage_name: initial?.name, stage_kind: 'initial', is_urgent: true }] });
    });

    await pushToTalk(page, `creá una orden para ${source.patient_name}, ${service} en la 36, urgente`);
    const card = page.locator('[data-voice-card]');
    await answerChoicesUntil(page, card, /«sí» para crearla/);

    const dialog = page.getByRole('dialog', { name: /Nueva orden de laboratorio|New lab order/ });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(source.patient_name);
    await expect(card).toContainText(source.patient_name);
    await page.screenshot({ path: 'test-results/voice-create-confirm.png' });

    await say(page, 'sí');
    await expect(card).toContainText(/orden 999999/, { timeout: 20_000 });
    await expect(dialog).toBeHidden();
    expect(saves).toHaveLength(1);
    expect(saves[0]).toMatchObject({ patient_id: String(source.patient_id), is_urgent: true });
    await page.screenshot({ path: 'test-results/voice-create-done.png' });
  });

  test('con el asistente abierto, lo que no es "sí/no" corrige la orden antes de crearla', async ({ page }) => {
    const captured = await interceptLabOrders(page);
    await page.goto('/lab-orders');
    const sourceId = await firstInitialOrderId(page, captured);
    await page.locator(`[data-lab-card-id="${sourceId}"]`).click();
    await expect.poll(() => captured.details.has(sourceId), { timeout: 20_000 }).toBeTruthy();
    await page.keyboard.press('Escape');
    const source = captured.details.get(sourceId) as { patient_name: string; patient_id: string; items?: { service_name: string }[]; work_description?: string };
    const service = source.items?.[0]?.service_name ?? source.work_description ?? 'corona';

    // Primera frase: crear. Con `context.draft` (el alta abierta): la corrección "la pieza es la 46".
    const aiRequests: Record<string, unknown>[] = [];
    await page.route(/\/voice\/interpret(\?|$)/, async (route) => {
      const body = route.request().postDataJSON() as { context: Record<string, unknown> };
      aiRequests.push(body);
      const result = body.context.draft
        ? { intent: 'lab_order.draft_edit', draft_edit: { update_items: [{ service: null, quantity: null, teeth: [46] }] }, confidence: 0.9 }
        : { intent: 'lab_order.create', patient: source.patient_name, items: [{ service, quantity: 1, teeth: [36] }], teeth: [], is_urgent: false, send: false, confidence: 0.9 };
      await route.fulfill({ json: { result } });
    });
    const saves: Record<string, unknown>[] = [];
    await page.route(/\/lab-orders\/save(\?|$)/, async (route) => {
      saves.push(route.request().postDataJSON() as Record<string, unknown>);
      const initial = captured.stages.find((s) => s.kind === 'initial');
      await route.fulfill({ json: [{ ...source, id: 999998, current_stage_id: initial?.id, stage_name: initial?.name, stage_kind: 'initial', is_urgent: true }] });
    });

    await pushToTalk(page, `creá una orden para ${source.patient_name}, ${service} en la 36`);
    const card = page.locator('[data-voice-card]');
    await answerChoicesUntil(page, card, /«sí» para crearla/);
    const dialog = page.getByRole('dialog', { name: /Nueva orden de laboratorio|New lab order/ });
    await expect(dialog).toBeVisible();
    await expect(card).not.toContainText(/Urgente|Urgent/);

    // Local, sin IA.
    await say(page, 'que sea urgente');
    await expect(card).toContainText(/Urgente|Urgent/, { timeout: 15_000 });
    await expect(card).toContainText(/«sí» para crearla/);
    await say(page, 'anotá que el color es A2');
    await expect(card).toContainText('el color es A2', { timeout: 15_000 });
    expect(aiRequests).toHaveLength(1);

    // Con la IA: recibe el alta (sin el paciente) y devuelve la corrección.
    await say(page, 'la corona va en la cuarenta y seis');
    await expect(card).toContainText('(46)', { timeout: 20_000 });
    expect(aiRequests).toHaveLength(2);
    const draft = (aiRequests[1].context as { draft: Record<string, unknown> }).draft;
    expect(draft).toMatchObject({ is_urgent: true, notes: 'el color es A2' });
    expect(JSON.stringify(draft)).not.toContain(source.patient_name);
    await page.screenshot({ path: 'test-results/voice-create-edited.png' });

    // A mano en la ventana mientras la tarjeta espera: el resumen se actualiza y la pregunta sigue abierta.
    await expect(card.locator('button', { hasText: /^(Sí|Yes)/ })).toBeVisible();
    await dialog.locator('[data-help-id="lab-orders.toggle.urgent"]').click();
    await expect(card).not.toContainText(/Urgente|Urgent/, { timeout: 5_000 });
    await expect(card).toContainText(/«sí» para crearla/);
    await expect(card.locator('button', { hasText: /^(Sí|Yes)/ })).toBeVisible();
    await page.screenshot({ path: 'test-results/voice-create-manual-edit.png' });

    await say(page, 'sí');
    await expect(card).toContainText(/orden 999998/, { timeout: 20_000 });
    await expect(dialog).toBeHidden();
    expect(saves).toHaveLength(1);
    expect(saves[0]).toMatchObject({ patient_id: String(source.patient_id), is_urgent: false, notes: 'el color es A2' });
    // Con un servicio del catálogo las piezas van en el trabajo; si no, son las de la orden.
    const savedItems = saves[0].items as { teeth: number[] }[];
    expect(savedItems.length ? savedItems[0].teeth : saves[0].teeth).toEqual([46]);
  });

  test('"¿dónde está la orden N?" responde sin preguntar ni cambiar nada', async ({ page }) => {
    const captured = await interceptLabOrders(page);
    await page.goto('/lab-orders');
    const id = await firstInitialOrderId(page, captured);
    await pushToTalk(page, `¿dónde está la orden ${id}?`);
    const card = page.locator('[data-voice-card]');
    await expect(card).toContainText(sendStages(captured).initial, { timeout: 20_000 });
    await expect(card).not.toContainText(/«sí»/);
    expect(captured.stageChanges).toHaveLength(0);
  });

  test('urgente y nota por voz: confirma y guarda la orden con el cambio', async ({ page }) => {
    const captured = await interceptLabOrders(page);
    const saves: Record<string, unknown>[] = [];
    await page.route(/\/lab-orders\/save(\?|$)/, async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      saves.push(body);
      const detail = captured.details.get(Number(body.id)) ?? {};
      await route.fulfill({ json: [{ ...detail, is_urgent: body.is_urgent, notes: body.notes }] });
    });
    await page.goto('/lab-orders');
    const id = await firstInitialOrderId(page, captured);
    const card = page.locator('[data-voice-card]');

    // Urgente: lo contrario de lo que tiene.
    await pushToTalk(page, `¿dónde está la orden ${id}?`);
    await expect.poll(() => captured.details.has(id), { timeout: 20_000 }).toBeTruthy();
    const wasUrgent = Boolean(captured.details.get(id)?.is_urgent);
    await pushToTalk(page, wasUrgent ? `la orden ${id} ya no es urgente` : `la orden ${id} es urgente`);
    await expect(card).toContainText(/«sí» para guardar/, { timeout: 20_000 });
    await say(page, 'sí');
    await expect(card).toContainText(new RegExp(`orden ${id}`), { timeout: 20_000 });
    await expect.poll(() => saves.length).toBe(1);
    expect(saves[0]).toMatchObject({ id, is_urgent: !wasUrgent });
    // El resto de la orden va tal cual (el guardado reemplaza la orden entera).
    expect(saves[0]).not.toHaveProperty('due_date');
    expect(Array.isArray(saves[0].items)).toBeTruthy();

    // Nota: se agrega a las que tenía.
    await pushToTalk(page, `anotale a la orden ${id} que el color es A2`);
    await expect(card.filter({ hasText: /«sí» para guardar/ }).filter({ hasText: /Nota.*el color es A2/ })).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: 'test-results/voice-note-confirm.png' });
    await say(page, 'sí');
    await expect.poll(() => saves.length, { timeout: 20_000 }).toBe(2);
    expect(String(saves[1].notes)).toMatch(/el color es A2$/);
    expect(captured.stageChanges).toHaveLength(0);
  });

  test('"editá la orden N": abre la edición, aplica correcciones (local e IA) y "sí" guarda', async ({ page }) => {
    const captured = await interceptLabOrders(page);
    const aiRequests: { context: Record<string, unknown> }[] = [];
    await page.route(/\/voice\/interpret(\?|$)/, async (route) => {
      const body = route.request().postDataJSON() as { context: Record<string, unknown> };
      aiRequests.push(body);
      const result = body.context.draft
        ? { intent: 'lab_order.draft_edit', draft_edit: { update_items: [{ service: null, quantity: null, teeth: [46] }] }, confidence: 0.9 }
        : { intent: 'unknown', confidence: 0 };
      await route.fulfill({ json: { result } });
    });
    const saves: Record<string, unknown>[] = [];
    await page.route(/\/lab-orders\/save(\?|$)/, async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      saves.push(body);
      const detail = captured.details.get(Number(body.id)) ?? {};
      await route.fulfill({ json: [{ ...detail, is_urgent: body.is_urgent }] });
    });
    await page.goto('/lab-orders');
    const id = await firstInitialOrderId(page, captured);
    const card = page.locator('[data-voice-card]');

    await pushToTalk(page, `editá la orden ${id}`);
    const dialog = page.getByRole('dialog', { name: new RegExp(`(Editar orden|Edit order) #${id}`) });
    await expect(dialog).toBeVisible({ timeout: 20_000 });
    await expect(card).toContainText(/qu(é|e) (querés|quieres) cambiar/i, { timeout: 20_000 });
    const detail = captured.details.get(id) as { patient_name: string; is_urgent: boolean };
    await expect(card).toContainText(detail.patient_name);

    // Local, sin IA: lo contrario de lo urgente que tiene; la tarjeta lo marca "antes → ahora".
    await say(page, detail.is_urgent ? 'que no sea urgente' : 'que sea urgente');
    await expect(card).toContainText(detail.is_urgent ? /Sí → No/ : /No → Sí/, { timeout: 15_000 });
    await expect(card).toContainText(/«sí» para guardar/);
    expect(aiRequests).toHaveLength(0);

    // Con la IA: recibe la orden en edición (con su número, sin el paciente).
    await say(page, 'la pieza es la cuarenta y seis');
    await expect(card).toContainText('(46)', { timeout: 20_000 });
    expect(aiRequests).toHaveLength(1);
    const draft = aiRequests[0].context.draft as Record<string, unknown>;
    expect(draft).toMatchObject({ mode: 'edit', order_id: id, send: false });
    expect(JSON.stringify(draft)).not.toContain(detail.patient_name);
    await page.screenshot({ path: 'test-results/voice-edit-confirm.png' });

    await say(page, 'sí');
    await expect(card).toContainText(new RegExp(`orden ${id}`), { timeout: 20_000 });
    await expect(dialog).toBeHidden();
    expect(saves).toHaveLength(1);
    expect(saves[0]).toMatchObject({ id, is_urgent: !detail.is_urgent });
    const savedItems = saves[0].items as { teeth: number[] }[];
    expect(savedItems.length ? savedItems[0].teeth : saves[0].teeth).toEqual([46]);
    expect(captured.stageChanges).toHaveLength(0);
  });

  test('cambiar el paciente de una orden por voz: se marca en rojo y se guarda solo con "sí"', async ({ page }) => {
    const captured = await interceptLabOrders(page);
    await page.goto('/lab-orders');
    await firstInitialOrderId(page, captured);
    // Dos órdenes de DEV con pacientes distintos (sus detalles se leen abriéndolas).
    const ids = await page.locator('[data-lab-card-id]').evaluateAll((cards) => cards.slice(0, 8).map((c) => Number(c.getAttribute('data-lab-card-id'))));
    let target: { id: number; patient_name: string; patient_id: string } | null = null;
    let other: { patient_name: string; patient_id: string } | null = null;
    for (const cardId of ids) {
      await page.locator(`[data-lab-card-id="${cardId}"]`).click();
      await expect.poll(() => captured.details.has(cardId), { timeout: 20_000 }).toBeTruthy();
      await page.keyboard.press('Escape');
      const d = captured.details.get(cardId) as { id: number; patient_name: string; patient_id: string };
      if (!target) target = d;
      else if (String(d.patient_id) !== String(target.patient_id)) { other = d; break; }
    }
    test.skip(!target || !other, 'DEV no tiene dos órdenes de pacientes distintos en el tablero');

    const aiRequests: { context: Record<string, unknown> }[] = [];
    await page.route(/\/voice\/interpret(\?|$)/, async (route) => {
      const body = route.request().postDataJSON() as { context: Record<string, unknown> };
      aiRequests.push(body);
      await route.fulfill({ json: { result: { intent: 'lab_order.draft_edit', draft_edit: { patient: other!.patient_name }, confidence: 0.9 } } });
    });
    const saves: Record<string, unknown>[] = [];
    await page.route(/\/lab-orders\/save(\?|$)/, async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      saves.push(body);
      await route.fulfill({ json: [{ ...captured.details.get(target!.id), patient_id: body.patient_id, patient_name: other!.patient_name }] });
    });

    const card = page.locator('[data-voice-card]');
    await pushToTalk(page, `la orden ${target!.id}, el paciente es ${other!.patient_name}`);
    const dialog = page.getByRole('dialog', { name: new RegExp(`(Editar orden|Edit order) #${target!.id}`) });
    await expect(dialog).toBeVisible({ timeout: 20_000 });
    await answerChoicesUntil(page, card, /«sí» para guardar/);
    await expect(card).toContainText(`${target!.patient_name} → ${other!.patient_name}`);
    await expect(dialog).toContainText(other!.patient_name);
    expect(aiRequests.length).toBeGreaterThan(0);
    expect(saves).toHaveLength(0);
    await page.screenshot({ path: 'test-results/voice-edit-patient.png' });

    await say(page, 'sí');
    await expect(card).toContainText(new RegExp(`orden ${target!.id}`), { timeout: 20_000 });
    expect(saves).toHaveLength(1);
    expect(saves[0]).toMatchObject({ id: target!.id, patient_id: String(other!.patient_id) });
  });

  test('"mostrame las órdenes atrasadas" filtra la pantalla y dice cuántas hay', async ({ page }) => {
    const captured = await interceptLabOrders(page);
    await page.goto('/lab-orders');
    await firstInitialOrderId(page, captured);
    const overdueButton = page.locator('button[aria-pressed]').filter({ hasText: /retrasadas|atrasadas|overdue/i }).first();
    await expect(overdueButton).toHaveAttribute('aria-pressed', 'false');

    await pushToTalk(page, 'mostrame las órdenes atrasadas');
    const card = page.locator('[data-voice-card]');
    await expect(card).toContainText(/Hay 1 orden atrasada:|Hay \d+ órdenes atrasadas:|No hay órdenes atrasadas\./, { timeout: 20_000 });
    await expect(overdueButton).toHaveAttribute('aria-pressed', 'true');
    await page.screenshot({ path: 'test-results/voice-list-overdue.png' });

    await pushToTalk(page, 'sacá los filtros');
    await expect(overdueButton).toHaveAttribute('aria-pressed', 'false', { timeout: 20_000 });
  });

  test('la voz es de esta pantalla: micrófono en el encabezado, nada fuera de ella; Recargar trae la lista', async ({ page }) => {
    const captured = await interceptLabOrders(page);
    await page.goto('/lab-orders');
    await firstInitialOrderId(page, captured);

    // Recargar: vuelve a pedir la lista (vista lista) o el tablero.
    const reloads: string[] = [];
    page.on('request', (r) => { if (/\/lab-orders\/(search|board)(\?|$)/.test(r.url())) reloads.push(r.url()); });
    await page.locator('[data-help-id="lab-orders.btn.refresh"]').click();
    await expect.poll(() => reloads.length, { timeout: 10_000 }).toBeGreaterThan(0);

    // El micrófono del encabezado escucha (sin Ctrl+Espacio).
    const mic = page.locator('[data-help-id="lab-orders.btn.voice"]');
    await expect(mic).toBeVisible();
    await mic.click();
    await say(page, '¿cuántas órdenes urgentes hay?');
    await expect(page.locator('[data-voice-card]')).toContainText(/urgentes/, { timeout: 20_000 });

    // En otra pantalla no hay micrófono ni tarjeta, y el atajo no hace nada.
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page.locator('[data-help-id="lab-orders.btn.voice"]')).toHaveCount(0);
    await pushToTalk(page, '¿cuántas órdenes urgentes hay?');
    await page.waitForTimeout(1000);
    await expect(page.locator('[data-voice-card]')).toHaveCount(0);
  });

  test('panel de envío: "Ayer" manda la fecha efectiva', async ({ page }) => {
    const captured = await interceptLabOrders(page);
    await page.goto('/lab-orders');
    const id = await firstInitialOrderId(page, captured);
    await page.locator(`[data-lab-card-id="${id}"]`).click();

    await page.locator('[data-help-id="lab-orders.btn.send"]').first().click();
    const sentOn = page.locator('[data-help-id="lab-orders.field.sent-on"]');
    await expect(sentOn).toBeVisible();
    await sentOn.getByRole('button', { name: 'Ayer' }).click();
    await expect(sentOn.getByRole('button', { name: 'Ayer' })).toHaveAttribute('aria-pressed', 'true');
    await expect(sentOn.getByRole('button', { name: 'Hoy' })).toHaveAttribute('aria-pressed', 'false');
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'test-results/voice-send-panel.png' });

    const confirmMove = page.locator('[data-help-id="lab-orders.btn.confirm-move"]');
    // Si falta laboratorio, se elige el primero del selector.
    if (await confirmMove.isDisabled()) {
      await page.locator('[data-help-id="lab-orders.field.send-laboratory"] [role="combobox"]').first().click();
      await page.getByRole('option').first().click();
    }
    await confirmMove.click();
    await expect.poll(() => captured.stageChanges.length).toBe(1);
    expect(captured.stageChanges[0]).toMatchObject({ id, effective_date: yesterday() });
  });
});
