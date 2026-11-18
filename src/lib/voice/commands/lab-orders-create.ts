import { addDays, parseISO, startOfToday } from 'date-fns';

import { formatDisplayDate } from '@/lib/utils';
import { interpretWithAi } from '@/lib/voice/ai';
import { labOrdersAiContext } from '@/lib/voice/commands/lab-orders';
import { ORDER_RE, parseDraftEdit, type DraftEditParsed } from '@/lib/voice/commands/lab-orders-parse';
import {
  applyVoiceLabOrderDraft,
  openVoiceLabOrderDraft,
  readVoiceLabOrderDraft,
  releaseVoiceLabOrderDraft,
  submitVoiceLabOrderDraft,
  VoiceDraftSubmitError,
  watchVoiceLabOrderDraft,
} from '@/lib/voice/lab-order-draft-bridge';
import { bestNameMatch, dateKey, normalizeSpeech, parseSpokenDate, parseYesNo } from '@/lib/voice/parse';
import { registerVoiceCommand } from '@/lib/voice/registry';
import { cancelVoice, isAbortError } from '@/lib/voice/session';
import { REQUEST_TIMEOUT_MS } from '@/services/api';
import { searchLaboratories } from '@/services/lab-orders';
import { fetchLabStages } from '@/services/lab-stages';
import { getSalesServices } from '@/services/services';
import { searchPatients, type PatientMatch } from '@/services/users';

import { LAB_ORDERS_PERMISSIONS } from '@/constants/permissions';
import type { LabOrderDraft, LabOrderDraftPatch } from '@/components/lab-orders/lab-order-form-dialog';
import type { Laboratory, LabStage, VoiceAiDraftContext, VoiceAiDraftEdit, VoiceAiResult, VoiceCard, VoiceCardRow, VoiceCommandContext } from '@/lib/types';

/**
 * "Creá una orden para Juan Pérez, corona de zirconio en la 36, al laboratorio Dental Sur, urgente"
 *
 * La frase la interpreta la IA (paciente, trabajos, piezas, laboratorio, envío). El paciente y
 * los servicios se buscan acá con las mismas búsquedas que el asistente de alta; si hay dudas se
 * pregunta. Después se abre el asistente completo en Revisar y "sí" pulsa Crear (o Crear y enviar).
 * Con "no" queda abierto para completarlo a mano, y cualquier otra respuesta se toma como una
 * corrección ("que sea urgente", "agregá un perno en la 21") que se aplica antes de volver a preguntar.
 */

interface CreateParsed {
  raw: string;
  ai?: VoiceAiResult;
}

const CREATE_RE = /\b(crea|crear|creame|creemos|nueva|nuevo|carga|cargar|cargame|registra|registrar|registrame|haceme|hace|arma|armame|genera|generar|create|new|make|add)\b.*\b(orden|ordenes|order|pedido)\b/;

function match(normalized: string, raw: string): CreateParsed | null {
  if (!CREATE_RE.test(normalized) || ORDER_RE.test(normalized)) return null;
  return { raw };
}

const MAX_CHOICES = 6;

type DraftItem = NonNullable<LabOrderDraft['items']>[number];

interface ServiceMatch {
  id: string;
  name: string;
  lab_category_id: string | null;
}

async function resolvePatient(ctx: VoiceCommandContext, said: string | null, base: VoiceCard): Promise<PatientMatch | null> {
  const { t } = ctx;
  const opts = { signal: ctx.signal, timeoutMs: REQUEST_TIMEOUT_MS.mutation };
  let query = said;
  let lastTried = said;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (!query) {
      const question = lastTried
        ? t('VoiceCommands.labOrders.patientNotFound', { name: lastTried })
        : t('VoiceCommands.labOrders.whichPatient');
      query = (await ctx.ask({ ...base, message: question, tone: 'info' }, question)).trim();
      if (!query) return null;
    }
    ctx.show({ ...base, message: t('VoiceCommands.labOrders.searchingPatient', { name: query }), tone: 'info' });
    const found = await searchPatients(query, opts);
    if (found.length === 1) return found[0];
    const wanted = normalizeSpeech(query);
    const exact = found.filter((p) => normalizeSpeech(p.name) === wanted);
    if (exact.length === 1) return exact[0];
    if (found.length > 1) {
      const shown = (exact.length > 1 ? exact : found).slice(0, MAX_CHOICES);
      const question = t('VoiceCommands.labOrders.choosePatient', { name: query });
      const index = await ctx.choose(
        { ...base, message: question, tone: 'info', choices: shown.map((p) => ({ label: p.name, detail: p.phone_number || undefined })) },
        `${question} ${shown.map((p, i) => `${i + 1}: ${p.name}`).join('. ')}.`,
      );
      return shown[index];
    }
    lastTried = query;
    query = null;
  }
  return null;
}

/** Un trabajo dicho → el servicio de laboratorio; null si no hay ninguno parecido. */
async function resolveService(ctx: VoiceCommandContext, name: string, base: VoiceCard): Promise<ServiceMatch | null> {
  // Sin resultados el flujo devuelve `items: [{}]`: se descartan las filas sin id o nombre.
  const search = async (text: string): Promise<ServiceMatch[]> => (await getSalesServices({ search: text, is_lab: true, limit: 10 })).items
    .filter((s) => s.id != null && s.id !== 'undefined' && typeof s.name === 'string' && s.name.trim() !== '')
    .map((s) => ({ id: String(s.id), name: s.name, lab_category_id: (s as { lab_category_id?: string | null }).lab_category_id ?? null }));
  let list = await search(name);
  if (list.length === 0) {
    // "corona de zirconio" puede estar cargado como "Corona zirconio": se prueba con la palabra principal.
    const main = normalizeSpeech(name).split(' ').find((w) => w.length > 3);
    if (main) list = await search(main);
  }
  if (list.length === 0) return null;
  if (list.length === 1) return list[0];
  const wanted = normalizeSpeech(name);
  const exact = list.find((s) => normalizeSpeech(s.name) === wanted);
  if (exact) return exact;
  const index = bestNameMatch(wanted, list.map((s) => s.name));
  const best = index !== null ? list[index] : null;
  // Si lo dicho está contenido en el nombre (o al revés) no hace falta preguntar.
  if (best && (normalizeSpeech(best.name).includes(wanted) || wanted.includes(normalizeSpeech(best.name)))) return best;
  const shown = list.slice(0, MAX_CHOICES);
  const question = ctx.t('VoiceCommands.labOrders.chooseService', { name });
  const chosen = await ctx.choose(
    { ...base, message: question, tone: 'info', choices: shown.map((s) => ({ label: s.name })) },
    `${question} ${shown.map((s, i) => `${i + 1}: ${s.name}`).join('. ')}.`,
  );
  return shown[chosen];
}

/** Fecha de entrega al crear y enviar: la dicha, la del plazo de la etapa o se pregunta. */
async function resolveDue(ctx: VoiceCommandContext, said: string | null, sendStage: LabStage, base: VoiceCard, askAlways = false): Promise<string | null> {
  const today = dateKey(startOfToday());
  if (said && said >= today) return said;
  if (!said && !askAlways && sendStage.overdue_days && sendStage.overdue_days > 0) return dateKey(addDays(parseISO(today), sendStage.overdue_days));
  const question = ctx.t('VoiceCommands.labOrders.whenDue');
  for (let attempt = 0; attempt < 2; attempt++) {
    const answer = await ctx.ask({ ...base, message: question, tone: 'info' }, attempt ? ctx.t('VoiceCommands.labOrders.whenDueAgain') : question);
    const due = parseSpokenDate(normalizeSpeech(answer), 'future');
    if (due && due >= today) return due;
  }
  return null;
}

/** Elegir laboratorio: el único que hay, o se pregunta entre los primeros. */
async function chooseLab(ctx: VoiceCommandContext, labs: Laboratory[], base: VoiceCard, question: string): Promise<Laboratory | null> {
  if (labs.length === 0) return null;
  if (labs.length === 1) return labs[0];
  const shown = labs.slice(0, MAX_CHOICES);
  const index = await ctx.choose(
    { ...base, message: question, tone: 'info', choices: shown.map((l) => ({ label: l.name })) },
    `${question} ${shown.map((l, i) => `${i + 1}: ${l.name}`).join('. ')}.`,
  );
  return shown[index];
}

function itemText(item: DraftItem): string {
  const qty = item.quantity > 1 ? ` ×${item.quantity}` : '';
  const teeth = item.teeth.length ? ` (${item.teeth.join(', ')})` : '';
  return `${item.service_name}${qty}${teeth}`;
}

async function run(parsed: CreateParsed, ctx: VoiceCommandContext) {
  const { t } = ctx;
  const title = t('VoiceCommands.labOrders.createTitle');
  const opts = { signal: ctx.signal, timeoutMs: REQUEST_TIMEOUT_MS.mutation };
  if (!ctx.hasPermission(LAB_ORDERS_PERMISSIONS.VIEW) || !ctx.hasPermission(LAB_ORDERS_PERMISSIONS.CREATE)) {
    await ctx.finish({ title, message: t('VoiceCommands.noPermission'), tone: 'error' }, t('VoiceCommands.noPermission'));
    return;
  }

  let ai = parsed.ai;
  if (!ai) {
    ctx.show({ title, message: t('VoiceCommands.interpreting'), tone: 'info' });
    try {
      ai = await interpretWithAi(parsed.raw, ctx);
    } catch (error) {
      if (ctx.signal.aborted) throw error;
      console.warn('[voice] AI interpretation failed', error);
      await ctx.finish({ title, message: t('VoiceCommands.aiFailed'), tone: 'error' }, t('VoiceCommands.aiFailed'));
      return;
    }
  }

  const base: VoiceCard = { title };

  // ── Paciente ──
  const patient = await resolvePatient(ctx, ai.patient, base);
  if (!patient) {
    await ctx.finish({ ...base, message: t('VoiceCommands.nothingChanged'), tone: 'info' }, t('VoiceCommands.nothingChanged'));
    return;
  }
  base.subtitle = patient.name;

  // ── Trabajos ──
  const items: DraftItem[] = [];
  const loose: string[] = [];
  /** Piezas de los trabajos que no son un servicio: quedan como piezas de la orden. */
  const looseTeeth: number[] = [];
  for (const said of ai.items) {
    ctx.show({ ...base, message: t('VoiceCommands.labOrders.searchingService', { name: said.service }), tone: 'info' });
    const service = await resolveService(ctx, said.service, base);
    if (!service) {
      loose.push(said.service);
      looseTeeth.push(...said.teeth);
      continue;
    }
    const teeth = said.teeth.length ? said.teeth : ai.items.length === 1 ? ai.teeth : [];
    const existing = items.find((i) => i.service_id === service.id);
    if (existing) {
      existing.quantity = Math.min(99, existing.quantity + said.quantity);
      existing.teeth = Array.from(new Set([...existing.teeth, ...teeth]));
    } else {
      items.push({ service_id: service.id, service_name: service.name, quantity: said.quantity, teeth, lab_category_id: service.lab_category_id });
    }
  }
  let workDescription = [ai.work_description, ...loose].filter(Boolean).join('. ');
  if (items.length === 0 && !workDescription) {
    const question = t('VoiceCommands.labOrders.whatWork');
    const answer = (await ctx.ask({ ...base, message: question, tone: 'info' }, question)).trim();
    if (!answer) {
      await ctx.finish({ ...base, message: t('VoiceCommands.nothingChanged'), tone: 'info' }, t('VoiceCommands.nothingChanged'));
      return;
    }
    const service = await resolveService(ctx, answer, base);
    if (service) items.push({ service_id: service.id, service_name: service.name, quantity: 1, teeth: ai.teeth, lab_category_id: service.lab_category_id });
    else workDescription = answer;
  }

  // ── Laboratorio y envío ──
  const [labs, stages] = await Promise.all([
    searchLaboratories({ limit: 50 }, opts).catch(() => [] as Laboratory[]),
    fetchLabStages(opts)
      .then((list) => list.filter((s) => s.is_active).sort((a, b) => a.sort_order - b.sort_order))
      .catch(() => [] as LabStage[]),
  ]);
  let laboratory = ai.laboratory_id ? labs.find((l) => l.id === ai.laboratory_id) ?? null : null;
  const initial = stages.find((s) => s.kind === 'initial') ?? null;
  const next = initial ? stages[stages.indexOf(initial) + 1] ?? null : null;
  const sendStage = next && next.kind === 'intermediate' ? next : null;
  const send = ai.send && !!sendStage;
  if (send && !laboratory) laboratory = await chooseLab(ctx, labs, base, t('VoiceCommands.labOrders.whichLab'));
  const dueDate = send && sendStage ? await resolveDue(ctx, ai.due_date, sendStage, base) : null;

  // ── Abrir el asistente en Revisar ──
  const draft: LabOrderDraft = {
    patient: { id: patient.id, name: patient.name },
    items,
    work_description: workDescription,
    teeth: items.length === 0 ? Array.from(new Set([...ai.teeth, ...looseTeeth])) : [],
    laboratory: laboratory ? { id: laboratory.id, name: laboratory.name } : null,
    is_urgent: ai.is_urgent,
    notes: ai.notes ?? undefined,
    send: send && !!dueDate,
    send_due_date: dueDate ?? '',
    startAtReview: true,
  };
  // Si la persona lo cierra (o lo crea con el botón) mientras se le pregunta, el comando termina.
  openVoiceLabOrderDraft(draft, () => cancelVoice());
  await confirmDraft(ctx, { base, labs, initial, sendStage });
}

// ── Confirmar o corregir el alta abierta ─────────────────────────────────────

interface DraftEnv {
  base: VoiceCard;
  labs: Laboratory[];
  initial: LabStage | null;
  sendStage: LabStage | null;
}

/** Una corrección ya interpretada (local o IA); el laboratorio puede venir por nombre. */
type DraftEditRequest = VoiceAiDraftEdit & { laboratory_name?: string; ask_due?: boolean };

/** "Sí" / "no" con algo de relleno ("sí, dale"); algo más largo puede ser una corrección. */
const MAX_BARE_ANSWER_WORDS = 4;
/** Respuestas seguidas que no se entienden antes de dejar el asistente abierto. */
const MAX_UNCLEAR_ANSWERS = 2;
const MIN_EDIT_CONFIDENCE = 0.5;

const closedError = () => new DOMException('Draft closed', 'AbortError');

/** El alta como está ahora (con lo cambiado a mano). Cerrada → se corta (cancelVoice ya corre por el aviso). */
function currentDraft(): LabOrderDraft {
  const draft = readVoiceLabOrderDraft();
  if (!draft) throw closedError();
  return draft;
}

function describeDraft(ctx: VoiceCommandContext, draft: LabOrderDraft, env: DraftEnv) {
  const { t } = ctx;
  const items = draft.items ?? [];
  const orderTeeth = items.length === 0 && draft.teeth?.length ? ` (${draft.teeth.join(', ')})` : '';
  const work = ([...items.map(itemText), ...(draft.work_description ? [draft.work_description] : [])].join(' · ') + orderTeeth) || '—';
  const willSend = Boolean(draft.send && env.sendStage);
  const patientName = draft.patient?.name || '—';
  const rows: VoiceCardRow[] = [
    { label: t('VoiceCommands.labOrders.patient'), value: patientName },
    { label: t('VoiceCommands.labOrders.work'), value: work },
  ];
  if (draft.laboratory) rows.push({ label: t('VoiceCommands.labOrders.laboratory'), value: draft.laboratory.name });
  rows.push({ label: t('VoiceCommands.labOrders.stage'), value: (willSend ? env.sendStage?.name : env.initial?.name) ?? '—' });
  if (willSend && draft.send_due_date) rows.push({ label: t('VoiceCommands.labOrders.dueDate'), value: formatDisplayDate(draft.send_due_date) });
  if (draft.is_urgent) rows.push({ label: t('VoiceCommands.labOrders.urgent'), value: t('VoiceCommands.labOrders.urgentValue'), tone: 'warning' });
  if (draft.notes?.trim()) rows.push({ label: t('VoiceCommands.labOrders.note'), value: draft.notes.trim() });
  const speech = [
    t('VoiceCommands.labOrders.createSpeech', { patient: patientName, work }),
    willSend && draft.laboratory && draft.send_due_date
      ? t('VoiceCommands.labOrders.createSendSpeech', { lab: draft.laboratory.name, date: formatDisplayDate(draft.send_due_date) })
      : '',
    t(willSend ? 'VoiceCommands.labOrders.createSendQuestion' : 'VoiceCommands.labOrders.createQuestion'),
  ].filter(Boolean).join(' ');
  return { rows, speech };
}

/** Lo que se le cuenta a la IA del alta abierta (sin el paciente). */
function draftAiContext(draft: LabOrderDraft): VoiceAiDraftContext {
  return {
    items: (draft.items ?? []).map((i) => ({ service: i.service_name, quantity: i.quantity, teeth: i.teeth })),
    teeth: draft.teeth ?? [],
    work_description: draft.work_description || null,
    laboratory: draft.laboratory?.name ?? null,
    send: Boolean(draft.send),
    due_date: draft.send_due_date || null,
    is_urgent: Boolean(draft.is_urgent),
    notes: draft.notes?.trim() || null,
  };
}

function fromLocalEdit(local: DraftEditParsed): DraftEditRequest {
  return {
    patient: null,
    add_items: [],
    remove_items: [],
    update_items: [],
    work_description: null,
    laboratory_id: null,
    laboratory_name: local.labName,
    clear_laboratory: Boolean(local.clearLab),
    send: local.send ?? null,
    due_date: local.due && local.due !== 'ask' ? local.due : null,
    ask_due: local.due === 'ask',
    urgent: local.urgent ?? null,
    note_add: local.note ?? null,
  };
}

function hasEdit(edit: VoiceAiDraftEdit): boolean {
  return Boolean(edit.patient || edit.add_items.length || edit.remove_items.length || edit.update_items.length
    || edit.work_description || edit.laboratory_id || edit.clear_laboratory || edit.send !== null
    || edit.due_date || edit.urgent !== null || edit.note_add);
}

/**
 * "¿La creo?" con el asistente abierto: "sí" lo crea, "no" lo deja abierto y cualquier otra cosa
 * se toma como una corrección ("que sea urgente", "agregá un perno en la 21", "al laboratorio
 * Dental Sur"): se aplica al formulario y se vuelve a preguntar con el resumen actualizado.
 */
async function confirmDraft(ctx: VoiceCommandContext, env: DraftEnv) {
  const { t } = ctx;
  let prefix = '';
  let unclear = 0;
  const leaveOpen = async (card: VoiceCard) => {
    releaseVoiceLabOrderDraft();
    await ctx.finish({ ...card, message: t('VoiceCommands.labOrders.leftOpen'), tone: 'info' }, t('VoiceCommands.labOrders.leftOpen'));
  };
  for (;;) {
    const draft = currentDraft();
    const { rows, speech } = describeDraft(ctx, draft, env);
    const card: VoiceCard = { ...env.base, subtitle: draft.patient?.name || env.base.subtitle, rows };
    const message = unclear ? t('VoiceCommands.labOrders.draftNotUnderstood') : t('VoiceCommands.labOrders.createHint');
    // Lo que se edite a mano mientras se espera la respuesta se ve en la tarjeta al momento.
    const stopWatching = watchDraftWhileAsking(ctx, env, { ...card, message, tone: 'confirm' });
    let answer: string;
    try {
      answer = await ctx.ask(
        { ...card, message, tone: 'confirm' },
        [prefix, unclear ? message : speech].filter(Boolean).join(' '),
        'confirm',
      );
    } finally {
      stopWatching();
    }
    prefix = '';
    const normalized = normalizeSpeech(answer);
    const yesNo = parseYesNo(normalized);
    const local = parseDraftEdit(normalized, answer);
    const bare = yesNo !== null && !local && normalized.split(' ').length <= MAX_BARE_ANSWER_WORDS;

    let edit: DraftEditRequest | null = local ? fromLocalEdit(local) : null;
    if (!edit && !bare && normalized) {
      ctx.show({ ...card, message: t('VoiceCommands.interpreting'), tone: 'info' });
      const ai = await interpretWithAi(answer, ctx, { draft: draftAiContext(draft) }).catch((error) => {
        if (ctx.signal.aborted) throw error;
        console.warn('[voice] AI draft edit failed', error);
        return null;
      });
      if (ai?.intent === 'lab_order.draft_edit' && ai.draft_edit && ai.confidence >= MIN_EDIT_CONFIDENCE && hasEdit(ai.draft_edit)) {
        edit = ai.draft_edit;
      }
    }

    if (!edit) {
      if (yesNo === 'yes') return submitDraft(ctx, card);
      if (yesNo === 'no' || ++unclear > MAX_UNCLEAR_ANSWERS) return leaveOpen(card);
      continue;
    }
    unclear = 0;
    ctx.show({ ...card, message: t('VoiceCommands.labOrders.updatingDraft'), tone: 'info' });
    prefix = (await applyDraftEdit(ctx, edit, env)).join(' ');
  }
}

/** Escribir en las notas avisa en cada tecla: la tarjeta se rehace una vez que se deja de escribir. */
const CARD_REFRESH_MS = 150;

/** Mientras se pregunta, rehace el resumen de la tarjeta con cada cambio del formulario. */
function watchDraftWhileAsking(ctx: VoiceCommandContext, env: DraftEnv, asked: VoiceCard): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = watchVoiceLabOrderDraft(() => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const draft = readVoiceLabOrderDraft();
      if (!draft || ctx.signal.aborted) return;
      const { rows } = describeDraft(ctx, draft, env);
      ctx.update({ ...asked, subtitle: draft.patient?.name || env.base.subtitle, rows });
    }, CARD_REFRESH_MS);
  });
  return () => {
    clearTimeout(timer);
    stop();
  };
}

async function submitDraft(ctx: VoiceCommandContext, card: VoiceCard) {
  const { t } = ctx;
  const patientName = currentDraft().patient?.name ?? '';
  ctx.show({ ...card, message: t('VoiceCommands.labOrders.creating'), tone: 'info' });
  try {
    const saved = await submitVoiceLabOrderDraft();
    const done = t('VoiceCommands.labOrders.created', { id: saved.id, patient: patientName || saved.patient_name });
    const link = { label: t('VoiceCommands.labOrders.viewOrder'), href: `/lab-orders?order=${saved.id}` };
    await ctx.finish({ ...card, message: done, tone: 'success', link }, done);
  } catch (error) {
    if (ctx.signal.aborted || isAbortError(error)) throw error;
    releaseVoiceLabOrderDraft();
    const message = error instanceof VoiceDraftSubmitError && error.serverMessage
      ? error.serverMessage
      : t('VoiceCommands.labOrders.createIncomplete');
    await ctx.finish({ ...card, message, tone: 'error' }, message);
  }
}

/** El trabajo cargado que se nombró ("el perno", "la corona"), o -1. */
function findItem(items: DraftItem[], said: string): number {
  const wanted = normalizeSpeech(said);
  const names = items.map((i) => normalizeSpeech(i.service_name));
  const exact = names.indexOf(wanted);
  if (exact >= 0) return exact;
  const partial = names.findIndex((name) => name.includes(wanted) || wanted.includes(name));
  if (partial >= 0) return partial;
  return bestNameMatch(wanted, items.map((i) => i.service_name)) ?? -1;
}

/**
 * Aplica la corrección al asistente (busca servicios, paciente o laboratorio y pregunta si hay
 * dudas). Devuelve lo que se dice antes de volver a preguntar: "Listo, lo cambié" y lo que no se pudo.
 */
async function applyDraftEdit(ctx: VoiceCommandContext, edit: DraftEditRequest, env: DraftEnv): Promise<string[]> {
  const { t } = ctx;
  const { base } = env;
  const warnings: string[] = [];
  const current = currentDraft();
  const patch: LabOrderDraftPatch = {};

  if (edit.patient) {
    const patient = await resolvePatient(ctx, edit.patient, base);
    if (patient) patch.patient = { id: patient.id, name: patient.name };
  }

  // ── Trabajos ──
  const items: DraftItem[] = (current.items ?? []).map((i) => ({ ...i, teeth: [...i.teeth] }));
  let itemsChanged = false;
  let orderTeeth = current.teeth ?? [];
  for (const name of edit.remove_items) {
    const index = findItem(items, name);
    if (index < 0) {
      warnings.push(t('VoiceCommands.labOrders.draftItemNotFound', { name }));
      continue;
    }
    items.splice(index, 1);
    itemsChanged = true;
  }
  for (const change of edit.update_items) {
    const index = change.service ? findItem(items, change.service) : items.length === 1 ? 0 : -1;
    if (index >= 0) {
      if (change.quantity !== null) items[index].quantity = change.quantity;
      if (change.teeth !== null) items[index].teeth = change.teeth;
      itemsChanged = true;
    } else if (!change.service && items.length === 0 && change.teeth !== null) {
      orderTeeth = change.teeth;
      patch.teeth = orderTeeth;
    } else {
      warnings.push(t('VoiceCommands.labOrders.draftItemNotFound', { name: change.service ?? t('VoiceCommands.labOrders.work') }));
    }
  }
  const loose: string[] = [];
  for (const said of edit.add_items) {
    ctx.show({ ...base, message: t('VoiceCommands.labOrders.searchingService', { name: said.service }), tone: 'info' });
    const service = await resolveService(ctx, said.service, base);
    if (!service) {
      loose.push(said.teeth.length ? `${said.service} (${said.teeth.join(', ')})` : said.service);
      continue;
    }
    // El primer trabajo se lleva las piezas de la orden (como al agregarlo a mano).
    const teeth = said.teeth.length ? said.teeth : items.length === 0 ? orderTeeth : [];
    const existing = items.find((i) => i.service_id === service.id);
    if (existing) {
      existing.quantity = Math.min(99, existing.quantity + said.quantity);
      existing.teeth = Array.from(new Set([...existing.teeth, ...teeth]));
    } else {
      if (items.length === 0 && orderTeeth.length) patch.teeth = [];
      items.push({ service_id: service.id, service_name: service.name, quantity: said.quantity, teeth, lab_category_id: service.lab_category_id });
    }
    itemsChanged = true;
  }
  if (itemsChanged) patch.items = items;
  const workDescription = [edit.work_description ?? current.work_description ?? '', ...loose].filter(Boolean).join('. ');
  if (workDescription !== (current.work_description ?? '')) patch.work_description = workDescription;

  // ── Laboratorio ──
  let laboratory = current.laboratory ?? null;
  if (edit.clear_laboratory) {
    laboratory = null;
    patch.laboratory = null;
  } else if (edit.laboratory_id || edit.laboratory_name) {
    const byId = edit.laboratory_id ? env.labs.find((l) => l.id === edit.laboratory_id) : undefined;
    const index = !byId && edit.laboratory_name ? bestNameMatch(normalizeSpeech(edit.laboratory_name), env.labs.map((l) => l.name)) : null;
    const found = byId ?? (index !== null ? env.labs[index] : null)
      ?? await chooseLab(ctx, env.labs, base, t('VoiceCommands.labOrders.labNotFound', { name: edit.laboratory_name ?? '' }));
    if (found) {
      laboratory = { id: found.id, name: found.name };
      patch.laboratory = laboratory;
    }
  }

  if (edit.urgent !== null && edit.urgent !== Boolean(current.is_urgent)) patch.is_urgent = edit.urgent;
  if (edit.note_add) patch.notes = [current.notes?.trim(), edit.note_add].filter(Boolean).join('\n');

  // ── Envío ──
  const send = edit.send ?? (edit.due_date || edit.ask_due ? true : null);
  if (send === false && current.send) {
    patch.send = false;
    patch.send_due_date = '';
  } else if (send === true) {
    if (!env.sendStage) {
      warnings.push(t('VoiceCommands.labOrders.cantSend'));
    } else {
      if (!laboratory) {
        const chosen = await chooseLab(ctx, env.labs, base, t('VoiceCommands.labOrders.whichLab'));
        if (chosen) {
          laboratory = { id: chosen.id, name: chosen.name };
          patch.laboratory = laboratory;
        }
      }
      const said = edit.due_date ?? (current.send && current.send_due_date ? current.send_due_date : null);
      const due = await resolveDue(ctx, said, env.sendStage, base, Boolean(edit.ask_due && !edit.due_date));
      if (due) {
        patch.send = true;
        patch.send_due_date = due;
      }
    }
  }

  if (Object.keys(patch).length === 0) return warnings.length ? warnings : [t('VoiceCommands.labOrders.draftNoChange')];
  if (!applyVoiceLabOrderDraft(patch)) throw closedError();
  return [t('VoiceCommands.labOrders.draftUpdated'), ...warnings];
}

function fromAi(result: VoiceAiResult, raw: string): CreateParsed | null {
  return result.intent === 'lab_order.create' ? { raw, ai: result } : null;
}

registerVoiceCommand<CreateParsed>({
  id: 'lab-orders.create',
  match,
  run,
  ai: { context: labOrdersAiContext, from: fromAi },
});
