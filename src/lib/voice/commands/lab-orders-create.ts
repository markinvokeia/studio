import { addDays, parseISO, startOfToday } from 'date-fns';

import { formatDisplayDate } from '@/lib/utils';
import { interpretWithAi } from '@/lib/voice/ai';
import { labOrdersAiContext } from '@/lib/voice/commands/lab-orders';
import { ORDER_RE } from '@/lib/voice/commands/lab-orders-parse';
import { openVoiceLabOrderDraft, releaseVoiceLabOrderDraft, submitVoiceLabOrderDraft, VoiceDraftSubmitError } from '@/lib/voice/lab-order-draft-bridge';
import { bestNameMatch, dateKey, normalizeSpeech, parseSpokenDate } from '@/lib/voice/parse';
import { registerVoiceCommand } from '@/lib/voice/registry';
import { cancelVoice, isAbortError } from '@/lib/voice/session';
import { REQUEST_TIMEOUT_MS } from '@/services/api';
import { searchLaboratories } from '@/services/lab-orders';
import { fetchLabStages } from '@/services/lab-stages';
import { getSalesServices } from '@/services/services';
import { searchPatients, type PatientMatch } from '@/services/users';

import { LAB_ORDERS_PERMISSIONS } from '@/constants/permissions';
import type { LabOrderDraft } from '@/components/lab-orders/lab-order-form-dialog';
import type { Laboratory, LabStage, VoiceAiResult, VoiceCard, VoiceCardRow, VoiceCommandContext } from '@/lib/types';

/**
 * "Creá una orden para Juan Pérez, corona de zirconio en la 36, al laboratorio Dental Sur, urgente"
 *
 * La frase la interpreta la IA (paciente, trabajos, piezas, laboratorio, envío). El paciente y
 * los servicios se buscan acá con las mismas búsquedas que el asistente de alta; si hay dudas se
 * pregunta. Después se abre el asistente completo en Revisar y "sí" pulsa Crear (o Crear y enviar).
 * Con "no" queda abierto para completarlo a mano.
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
async function resolveDue(ctx: VoiceCommandContext, said: string | null, sendStage: LabStage, base: VoiceCard): Promise<string | null> {
  const today = dateKey(startOfToday());
  if (said && said >= today) return said;
  if (!said && sendStage.overdue_days && sendStage.overdue_days > 0) return dateKey(addDays(parseISO(today), sendStage.overdue_days));
  const question = ctx.t('VoiceCommands.labOrders.whenDue');
  for (let attempt = 0; attempt < 2; attempt++) {
    const answer = await ctx.ask({ ...base, message: question, tone: 'info' }, attempt ? ctx.t('VoiceCommands.labOrders.whenDueAgain') : question);
    const due = parseSpokenDate(normalizeSpeech(answer), 'future');
    if (due && due >= today) return due;
  }
  return null;
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
  if (send && !laboratory && labs.length > 0) {
    if (labs.length === 1) {
      laboratory = labs[0];
    } else {
      const shown = labs.slice(0, MAX_CHOICES);
      const question = t('VoiceCommands.labOrders.whichLab');
      const index = await ctx.choose(
        { ...base, message: question, tone: 'info', choices: shown.map((l) => ({ label: l.name })) },
        `${question} ${shown.map((l, i) => `${i + 1}: ${l.name}`).join('. ')}.`,
      );
      laboratory = shown[index];
    }
  }
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

  const orderTeeth = items.length === 0 && draft.teeth?.length ? ` (${draft.teeth.join(', ')})` : '';
  const work = [...items.map(itemText), ...(workDescription ? [workDescription] : [])].join(' · ') + orderTeeth;
  const willSend = Boolean(draft.send && sendStage);
  const rows: VoiceCardRow[] = [
    { label: t('VoiceCommands.labOrders.patient'), value: patient.name },
    { label: t('VoiceCommands.labOrders.work'), value: work },
  ];
  if (laboratory) rows.push({ label: t('VoiceCommands.labOrders.laboratory'), value: laboratory.name });
  rows.push({ label: t('VoiceCommands.labOrders.stage'), value: (willSend ? sendStage?.name : initial?.name) ?? '—' });
  if (willSend && dueDate) rows.push({ label: t('VoiceCommands.labOrders.dueDate'), value: formatDisplayDate(dueDate) });
  if (draft.is_urgent) rows.push({ label: t('VoiceCommands.labOrders.urgent'), value: t('VoiceCommands.labOrders.urgentValue'), tone: 'warning' });

  const speech = [
    t('VoiceCommands.labOrders.createSpeech', { patient: patient.name, work }),
    willSend && laboratory && dueDate ? t('VoiceCommands.labOrders.createSendSpeech', { lab: laboratory.name, date: formatDisplayDate(dueDate) }) : '',
    t(willSend ? 'VoiceCommands.labOrders.createSendQuestion' : 'VoiceCommands.labOrders.createQuestion'),
  ].filter(Boolean).join(' ');
  const confirmed = await ctx.confirm({ ...base, rows, message: t('VoiceCommands.labOrders.createHint'), tone: 'confirm' }, speech);
  if (!confirmed) {
    releaseVoiceLabOrderDraft();
    await ctx.finish({ ...base, rows, message: t('VoiceCommands.labOrders.leftOpen'), tone: 'info' }, t('VoiceCommands.labOrders.leftOpen'));
    return;
  }

  ctx.show({ ...base, rows, message: t('VoiceCommands.labOrders.creating'), tone: 'info' });
  try {
    const saved = await submitVoiceLabOrderDraft();
    const done = t('VoiceCommands.labOrders.created', { id: saved.id, patient: patient.name });
    const link = { label: t('VoiceCommands.labOrders.viewOrder'), href: `/lab-orders?order=${saved.id}` };
    await ctx.finish({ ...base, rows, message: done, tone: 'success', link }, done);
  } catch (error) {
    if (ctx.signal.aborted || isAbortError(error)) throw error;
    releaseVoiceLabOrderDraft();
    const message = error instanceof VoiceDraftSubmitError && error.serverMessage
      ? error.serverMessage
      : t('VoiceCommands.labOrders.createIncomplete');
    await ctx.finish({ ...base, rows, message, tone: 'error' }, message);
  }
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
