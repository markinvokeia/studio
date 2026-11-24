import { addDays, format, parseISO, startOfToday } from 'date-fns';
import { enUS, es } from 'date-fns/locale';

import { emitLabOrderChanged } from '@/lib/lab-orders-events';
import { formatDisplayDate } from '@/lib/utils';
import { bestNameMatch, dateKey, normalizeSpeech, parseSpokenDate } from '@/lib/voice/parse';
import { parseLabOrderVoice, type LabVoiceParsed } from '@/lib/voice/commands/lab-orders-parse';
import { interpretWithAi } from '@/lib/voice/ai';
import { sanitizeLabOrdersAiResult } from '@/lib/voice/commands/lab-orders-ai';
import { registerVoiceCommand, registerVoiceDomain } from '@/lib/voice/registry';
import { isTimeoutError, REQUEST_TIMEOUT_MS } from '@/services/api';
import { changeLabOrderStage, fetchLabOrderDetail, LabOrdersError, searchLaboratories } from '@/services/lab-orders';
import { fetchLabStages } from '@/services/lab-stages';

import { LAB_ORDERS_PERMISSIONS } from '@/constants/permissions';
import type { Laboratory, LabOrderDetail, LabStage, VoiceAiContext, VoiceAiResult, VoiceCard, VoiceCardRow, VoiceCommandContext } from '@/lib/types';

/** Módulo de voz de Órdenes de laboratorio (lo activa la pantalla con VoiceCommandHost). */
export const LAB_ORDERS_VOICE_DOMAIN = 'lab_orders';

/**
 * Órdenes de laboratorio por voz:
 *   "la orden 45 se envió ayer"            → de la etapa inicial a la siguiente, con fecha de ayer
 *   "llegó la orden 45" / "recibimos la 45" → a la etapa de recibido (o la siguiente)
 *   "pasá la orden 45 a prueba en boca"     → a esa etapa (por su nombre)
 *   "la orden 45 a la siguiente etapa"      → la siguiente
 *   "cancelá la orden 45" / "terminó la 45" → a la etapa final de cancelada / completada
 *   "abrí la orden 45"                      → abre el detalle
 * Siempre se confirma por voz antes de mover: el asistente dice paciente y trabajo, así se
 * nota si entendió otro número.
 */

const activeStages = (stages: LabStage[]) => stages.filter((s) => s.is_active).sort((a, b) => a.sort_order - b.sort_order);

/** La etapa nombrada en lo dicho ("a prueba en boca"), si se nombró entera. */
function stageByName(text: string, stages: LabStage[]): LabStage | null {
  const index = bestNameMatch(text, stages.map((s) => s.name));
  if (index === null) return null;
  const name = normalizeSpeech(stages[index].name);
  // Solo si el nombre está dicho completo: "enviada" no es la etapa "Enviado al laboratorio".
  return ` ${text} `.includes(` ${name} `) ? stages[index] : null;
}

/** A qué etapa va según lo que se dijo; null si hay que preguntar. */
function resolveTarget(parsed: LabVoiceParsed, order: LabOrderDetail, stages: LabStage[]): { stage: LabStage | null; reason?: 'alreadySent' | 'last' | 'noCancelStage' } {
  const others = stages.filter((s) => s.id !== order.current_stage_id);
  const fromAi = parsed.targetStageId ? stages.find((s) => s.id === parsed.targetStageId) : null;
  if (fromAi) return { stage: fromAi };
  const named = stageByName(parsed.rest, others);
  if (named) return { stage: named };
  const currentIndex = stages.findIndex((s) => s.id === order.current_stage_id);
  const next = currentIndex >= 0 ? stages[currentIndex + 1] ?? null : null;
  const finals = stages.filter((s) => s.kind === 'final');
  const isCancel = (s: LabStage) => /cancel|anul|rechaz/.test(normalizeSpeech(s.name));
  switch (parsed.intent) {
    case 'send': {
      if (order.stage_kind !== 'initial') return { stage: null, reason: 'alreadySent' };
      return { stage: stages.find((s) => s.kind === 'intermediate') ?? null };
    }
    case 'received': {
      const received = others.find((s) => s.kind !== 'initial' && /recib|lleg|clinica|receiv|arriv/.test(normalizeSpeech(s.name))
        && stages.indexOf(s) > currentIndex);
      return { stage: received ?? next, reason: received || next ? undefined : 'last' };
    }
    case 'complete': {
      const done = finals.find((s) => !isCancel(s) && /complet|entreg|finaliz|termin|instal|done|deliver|finish/.test(normalizeSpeech(s.name)))
        ?? finals.find((s) => !isCancel(s));
      return { stage: done && done.id !== order.current_stage_id ? done : null };
    }
    case 'cancel': {
      const cancel = finals.find(isCancel);
      return cancel ? { stage: cancel.id !== order.current_stage_id ? cancel : null } : { stage: null, reason: 'noCancelStage' };
    }
    case 'next':
      return { stage: next, reason: next ? undefined : 'last' };
    default:
      return { stage: null };
  }
}

export function speakDate(key: string, locale: string): string {
  const date = parseISO(key);
  return locale.startsWith('en')
    ? format(date, 'EEEE, MMMM d', { locale: enUS })
    : format(date, "EEEE d 'de' MMMM", { locale: es });
}

/** "hoy" / "ayer" / "el 14/11" para la tarjeta; lo mismo hablado para la voz. */
function whenText(ctx: VoiceCommandContext, key: string): { card: string; speech: string } {
  const today = dateKey(startOfToday());
  const yesterday = dateKey(addDays(startOfToday(), -1));
  if (key === today) return { card: ctx.t('VoiceCommands.today'), speech: ctx.t('VoiceCommands.today') };
  if (key === yesterday) return { card: `${ctx.t('VoiceCommands.yesterday')} (${formatDisplayDate(key)})`, speech: ctx.t('VoiceCommands.yesterday') };
  return { card: formatDisplayDate(key), speech: speakDate(key, ctx.locale) };
}

export function errorText(ctx: VoiceCommandContext, error: unknown): string {
  if (error instanceof LabOrdersError) return ctx.t(`LabOrdersPage.errors.${error.code}`);
  if (isTimeoutError(error)) return ctx.t('Common.timeoutError');
  return ctx.t('VoiceCommands.genericError');
}

function utcDateKey(iso: string): string {
  return dateKey(parseISO(iso.endsWith('Z') ? iso : `${iso}Z`));
}

/** Laboratorio para una orden sin laboratorio: el nombrado, el único posible o se pregunta. */
async function resolveLaboratory(ctx: VoiceCommandContext, parsed: LabVoiceParsed, order: LabOrderDetail, base: VoiceCard): Promise<Laboratory> {
  const opts = { signal: ctx.signal, timeoutMs: REQUEST_TIMEOUT_MS.mutation };
  const categoryId = order.lab_category_ids.length === 1 ? order.lab_category_ids[0] : null;
  const labs = await searchLaboratories({ categoryId, limit: 30 }, opts);
  if (labs.length === 1) return labs[0];
  const chosen = parsed.laboratoryId ? labs.find((l) => l.id === parsed.laboratoryId) : null;
  if (chosen) return chosen;
  const said = bestNameMatch(parsed.rest, labs.map((l) => l.name));
  if (said !== null && ` ${parsed.rest} `.includes(` ${normalizeSpeech(labs[said].name).split(' ')[0]} `)) return labs[said];
  if (labs.length === 0) throw new LabOrdersError('LABORATORY_REQUIRED', 'no laboratories');
  const shown = labs.slice(0, 6);
  const question = ctx.t('VoiceCommands.labOrders.whichLab');
  const index = await ctx.choose(
    { ...base, message: question, tone: 'info', choices: shown.map((l) => ({ label: l.name })) },
    `${question} ${shown.map((l, i) => `${i + 1}: ${l.name}`).join('. ')}.`,
  );
  return shown[index];
}

/** Fecha de entrega al enviar: la dicha, la que ya tenía, la del plazo de la etapa o se pregunta. */
async function resolveDueDate(ctx: VoiceCommandContext, parsed: LabVoiceParsed, order: LabOrderDetail, target: LabStage, sentOn: string, base: VoiceCard): Promise<string> {
  const said = parsed.dueDate ?? (parsed.duePart ? parseSpokenDate(parsed.duePart, 'future') : null);
  if (said) return said;
  if (order.due_date && order.due_date >= sentOn) return order.due_date;
  if (target.overdue_days && target.overdue_days > 0) return dateKey(addDays(parseISO(sentOn), target.overdue_days));
  const question = ctx.t('VoiceCommands.labOrders.whenDue');
  for (let attempt = 0; attempt < 2; attempt++) {
    const answer = await ctx.ask({ ...base, message: question, tone: 'info' }, attempt ? ctx.t('VoiceCommands.labOrders.whenDueAgain') : question);
    const due = parseSpokenDate(normalizeSpeech(answer), 'future');
    if (due) return due;
  }
  throw new LabOrdersError('DUE_DATE_REQUIRED', 'no due date');
}

async function run(parsed: LabVoiceParsed, ctx: VoiceCommandContext) {
  const { t } = ctx;
  const title = t('VoiceCommands.labOrders.title', { id: parsed.orderId });
  const opts = { signal: ctx.signal, timeoutMs: REQUEST_TIMEOUT_MS.mutation };

  if (!ctx.hasPermission(LAB_ORDERS_PERMISSIONS.VIEW)
    || (parsed.intent !== 'open' && !ctx.hasPermission(LAB_ORDERS_PERMISSIONS.CHANGE_STAGE))) {
    await ctx.finish({ title, message: t('VoiceCommands.noPermission'), tone: 'error' }, t('VoiceCommands.noPermission'));
    return;
  }

  ctx.show({ title, message: t('VoiceCommands.labOrders.looking'), tone: 'info' });
  let order: LabOrderDetail;
  let stages: LabStage[];
  try {
    [order, stages] = await Promise.all([fetchLabOrderDetail(parsed.orderId, opts), fetchLabStages(opts).then(activeStages)]);
  } catch (error) {
    if (ctx.signal.aborted) throw error;
    const notFound = error instanceof LabOrdersError && error.code === 'NOT_FOUND';
    const message = notFound ? t('VoiceCommands.labOrders.notFound', { id: parsed.orderId }) : errorText(ctx, error);
    await ctx.finish({ title, message, tone: 'error' }, message);
    return;
  }

  const work = order.work_summary || order.work_description || '';
  const base: VoiceCard = {
    title,
    subtitle: [order.patient_name, work].filter(Boolean).join(' · '),
  };
  const link = { label: t('VoiceCommands.labOrders.viewOrder'), href: `/lab-orders?order=${order.id}` };

  if (parsed.intent === 'open') {
    ctx.navigate(link.href);
    const message = t('VoiceCommands.labOrders.opened', { id: order.id, patient: order.patient_name });
    await ctx.finish({ ...base, message, tone: 'success' }, message);
    return;
  }

  // ── A qué etapa ──
  let { stage: target, reason } = resolveTarget(parsed, order, stages);
  if (!target && reason) {
    const message = reason === 'alreadySent'
      ? t('VoiceCommands.labOrders.alreadySent', { id: order.id, stage: order.stage_name })
      : reason === 'last'
        ? t('VoiceCommands.labOrders.noNextStage', { id: order.id, stage: order.stage_name })
        : t('VoiceCommands.labOrders.noCancelStage');
    await ctx.finish({ ...base, message, tone: 'info', link }, message);
    return;
  }
  if (!target) {
    const options = stages.filter((s) => s.id !== order.current_stage_id);
    const question = t('VoiceCommands.labOrders.whichStage', { stage: order.stage_name });
    const index = await ctx.choose(
      { ...base, message: question, tone: 'info', choices: options.map((s) => ({ label: s.name })) },
      `${question} ${options.map((s, i) => `${i + 1}: ${s.name}`).join('. ')}.`,
    );
    target = options[index];
  }
  if (target.id === order.current_stage_id) {
    const message = t('VoiceCommands.labOrders.alreadyThere', { id: order.id, stage: target.name });
    await ctx.finish({ ...base, message, tone: 'info', link }, message);
    return;
  }

  // ── Cuándo pasó ──
  const today = dateKey(startOfToday());
  const sentOn = parsed.effectiveDate ?? parseSpokenDate(parsed.rest, 'past') ?? today;
  if (sentOn > today) {
    const message = t('LabOrdersPage.errors.INVALID_EFFECTIVE_DATE');
    await ctx.finish({ ...base, message, tone: 'error' }, message);
    return;
  }
  const enteredOn = order.stage_entered_at ? utcDateKey(order.stage_entered_at) : null;
  if (enteredOn && sentOn < enteredOn) {
    const message = t('VoiceCommands.labOrders.beforeStage', { date: formatDisplayDate(enteredOn), stage: order.stage_name });
    await ctx.finish({ ...base, message, tone: 'error' }, message);
    return;
  }

  // ── Lo que pide el movimiento: laboratorio y fecha de entrega al enviar ──
  // Volver a la etapa donde se fijó la fecha (reenviar al laboratorio) también es enviar: fecha nueva (script 177).
  const sending = (order.stage_kind === 'initial' && target.kind === 'intermediate')
    || (target.kind !== 'final' && target.id === order.due_stage_id && target.id !== order.current_stage_id);
  let laboratory: Laboratory | null = null;
  let dueDate: string | null = null;
  try {
    if (!order.laboratory_id && target.kind !== 'final') laboratory = await resolveLaboratory(ctx, parsed, order, base);
    if (sending) dueDate = await resolveDueDate(ctx, parsed, order, target, sentOn, base);
  } catch (error) {
    if (ctx.signal.aborted || !(error instanceof LabOrdersError)) throw error;
    const message = errorText(ctx, error);
    await ctx.finish({ ...base, message, tone: 'error' }, message);
    return;
  }
  if (dueDate && dueDate < sentOn) {
    const message = t('LabOrdersPage.errors.INVALID_DUE_DATE');
    await ctx.finish({ ...base, message, tone: 'error' }, message);
    return;
  }

  // ── Confirmar ──
  const currentIndex = stages.findIndex((s) => s.id === order.current_stage_id);
  const targetIndex = stages.findIndex((s) => s.id === target.id);
  const isCancel = target.kind === 'final' && /cancel|anul|rechaz/.test(normalizeSpeech(target.name));
  const backwards = targetIndex < currentIndex;
  const skips = targetIndex > currentIndex + 1 && target.kind !== 'final';
  const danger = isCancel || backwards || skips;
  const when = whenText(ctx, sentOn);
  const rows: VoiceCardRow[] = [
    { label: t('VoiceCommands.labOrders.stage'), value: `${order.stage_name} → ${target.name}`, tone: danger ? 'danger' : 'default' },
  ];
  if (sentOn !== today || sending) rows.push({ label: t(sending ? 'VoiceCommands.labOrders.sentOn' : 'VoiceCommands.labOrders.happenedOn'), value: when.card });
  const labName = laboratory?.name ?? order.laboratory_name;
  if (labName && target.kind !== 'final') rows.push({ label: t('VoiceCommands.labOrders.laboratory'), value: labName });
  if (dueDate) {
    rows.push({
      label: t('VoiceCommands.labOrders.dueDate'),
      value: formatDisplayDate(dueDate),
      tone: dueDate < today ? 'warning' : 'default',
    });
  }

  const speech = [
    t('VoiceCommands.labOrders.confirmIntro', { id: order.id, patient: order.patient_name, work: work || '—' }),
    `${isCancel
      ? t('VoiceCommands.labOrders.confirmCancel')
      : backwards
        ? t('VoiceCommands.labOrders.confirmBack', { stage: target.name })
        : t('VoiceCommands.labOrders.confirmMove', { stage: target.name })}${sentOn !== today ? ` ${t('VoiceCommands.labOrders.confirmWhen', { when: when.speech })}` : ''}.`,
    laboratory ? t('VoiceCommands.labOrders.confirmLab', { lab: laboratory.name }) : '',
    dueDate ? t('VoiceCommands.labOrders.confirmDue', { date: speakDate(dueDate, ctx.locale) }) : '',
    dueDate && dueDate < today ? t('VoiceCommands.labOrders.confirmDuePast') : '',
    t('VoiceCommands.confirmQuestion'),
  ].filter(Boolean).join(' ');
  const message = t(danger ? 'VoiceCommands.labOrders.confirmDangerHint' : 'VoiceCommands.labOrders.confirmHint');
  const confirmed = await ctx.confirm({ ...base, rows, message, tone: danger ? 'danger' : 'confirm' }, speech);
  if (!confirmed) {
    await ctx.finish({ ...base, rows, message: t('VoiceCommands.nothingChanged'), tone: 'info' }, t('VoiceCommands.nothingChanged'));
    return;
  }

  // ── Mover ──
  ctx.show({ ...base, rows, message: t('VoiceCommands.labOrders.moving'), tone: 'info' });
  try {
    const saved = await changeLabOrderStage(order.id, target.id, order.current_stage_id, opts, {
      laboratoryId: laboratory?.id,
      dueDate,
      effectiveDate: sentOn !== today ? sentOn : null,
    });
    emitLabOrderChanged(saved);
    const done = t('VoiceCommands.labOrders.moved', { id: saved.id, stage: saved.stage_name });
    await ctx.finish({ ...base, rows, message: done, tone: 'success', link }, done);
  } catch (error) {
    if (ctx.signal.aborted) throw error;
    const failed = errorText(ctx, error);
    await ctx.finish({ ...base, rows, message: failed, tone: 'error', link }, failed);
  }
}

/** Etapas y laboratorios activos: lo único que la IA necesita para entender un movimiento. */
export async function labOrdersAiContext(ctx: VoiceCommandContext) {
  if (!ctx.hasPermission(LAB_ORDERS_PERMISSIONS.VIEW)) return {};
  const opts = { signal: ctx.signal, timeoutMs: REQUEST_TIMEOUT_MS.mutation };
  const [stages, labs] = await Promise.all([
    fetchLabStages(opts).then(activeStages).catch(() => [] as LabStage[]),
    searchLaboratories({ limit: 50 }, opts).catch(() => [] as Laboratory[]),
  ]);
  return {
    stages: stages.map((s) => ({ id: s.id, name: s.name, kind: s.kind })),
    laboratories: labs.map((l) => ({ id: l.id, name: l.name })),
  };
}

/** Qué hacer con la respuesta de la IA: mover o abrir una orden con número. */
function fromAi(result: VoiceAiResult, raw: string): LabVoiceParsed | null {
  if (!result.order_id || (result.intent !== 'lab_order.move' && result.intent !== 'lab_order.open')) return null;
  return {
    orderId: result.order_id,
    intent: result.intent === 'lab_order.open' ? 'open' : result.move_kind ?? (result.stage_id ? 'move' : null),
    rest: normalizeSpeech(raw),
    duePart: null,
    targetStageId: result.stage_id,
    effectiveDate: result.effective_date,
    dueDate: result.due_date,
    laboratoryId: result.laboratory_id,
  };
}

/** La IA con el contexto del módulo (más `extra`, p. ej. la orden abierta): devuelve su resultado y confianza. */
export async function interpretLabOrders(text: string, ctx: VoiceCommandContext, extra?: Partial<VoiceAiContext>) {
  const { result, confidence } = await interpretWithAi<VoiceAiResult>(LAB_ORDERS_VOICE_DOMAIN, text, ctx, extra as Record<string, unknown>);
  return { ...result, confidence };
}

registerVoiceDomain<VoiceAiResult>({
  id: LAB_ORDERS_VOICE_DOMAIN,
  ai: {
    context: labOrdersAiContext,
    sanitize: (raw, context) => sanitizeLabOrdersAiResult(raw, context as Partial<VoiceAiContext>),
  },
});

registerVoiceCommand<LabVoiceParsed, VoiceAiResult>({
  id: 'lab-orders.stage',
  domain: LAB_ORDERS_VOICE_DOMAIN,
  match: parseLabOrderVoice,
  run,
  ai: { from: fromAi },
});
