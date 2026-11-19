import { startOfToday } from 'date-fns';

import { emitLabOrderChanged, requestLabOrdersView, type LabOrdersViewRequest } from '@/lib/lab-orders-events';
import { formatDisplayDate } from '@/lib/utils';
import { errorText, LAB_ORDERS_VOICE_DOMAIN, speakDate } from '@/lib/voice/commands/lab-orders';
import {
  parseLabOrderEdit,
  parseLabOrdersList,
  parseLabOrderStatus,
  type LabEditParsed,
  type LabListParsed,
} from '@/lib/voice/commands/lab-orders-parse';
import { bestNameMatch, dateKey, normalizeSpeech, parseSpokenDate } from '@/lib/voice/parse';
import { registerVoiceCommand } from '@/lib/voice/registry';
import { REQUEST_TIMEOUT_MS } from '@/services/api';
import { fetchLabOrderDetail, LabOrdersError, saveLabOrder, searchLaboratories, searchLabOrders } from '@/services/lab-orders';
import { searchPatients } from '@/services/users';

import { LAB_ORDERS_PERMISSIONS } from '@/constants/permissions';
import type { Laboratory, LabOrderDetail, LabOrderFilters, VoiceAiResult, VoiceCard, VoiceCardRow, VoiceCommandContext } from '@/lib/types';

/**
 * Órdenes de laboratorio por voz, sin mover etapas:
 *   "¿dónde está la orden 45?"                    → etapa, días y entrega (no cambia nada)
 *   "la orden 45 la entregan el lunes"            → cambia la entrega (se confirma)
 *   "la orden 45 es urgente" / "ya no es urgente" → urgente (se confirma)
 *   "anotale a la orden 45 que el color es A2"    → agrega una nota (se confirma)
 *   "mostrame las atrasadas" / "las de Ana Pérez" / "en el tablero" / "sacá los filtros"
 *                                                  → filtra la pantalla de órdenes (no cambia nada)
 * Prioridad alta: "la 45 la entregan el lunes" no es un movimiento de etapa.
 */

const PRIORITY = 10;
const MAX_CHOICES = 6;
const NOTES_MAX = 2000;

const optsOf = (ctx: VoiceCommandContext) => ({ signal: ctx.signal, timeoutMs: REQUEST_TIMEOUT_MS.mutation });

/** Busca la orden; si no está o falla, lo dice y devuelve null. También la usa "editá la orden 45". */
export async function loadOrder(ctx: VoiceCommandContext, orderId: number, title: string): Promise<LabOrderDetail | null> {
  ctx.show({ title, message: ctx.t('VoiceCommands.labOrders.looking'), tone: 'info' });
  try {
    return await fetchLabOrderDetail(orderId, optsOf(ctx));
  } catch (error) {
    if (ctx.signal.aborted) throw error;
    const notFound = error instanceof LabOrdersError && error.code === 'NOT_FOUND';
    const message = notFound ? ctx.t('VoiceCommands.labOrders.notFound', { id: orderId }) : errorText(ctx, error);
    await ctx.finish({ title, message, tone: 'error' }, message);
    return null;
  }
}

const baseCard = (ctx: VoiceCommandContext, order: LabOrderDetail): VoiceCard => ({
  title: ctx.t('VoiceCommands.labOrders.title', { id: order.id }),
  subtitle: [order.patient_name, order.work_summary || order.work_description].filter(Boolean).join(' · '),
});

const orderLink = (ctx: VoiceCommandContext, id: number) => ({ label: ctx.t('VoiceCommands.labOrders.viewOrder'), href: `/lab-orders?order=${id}` });

// ── ¿Dónde está la orden 45? ──────────────────────────────────────────────────

async function runStatus(parsed: { orderId: number }, ctx: VoiceCommandContext) {
  const { t } = ctx;
  const title = t('VoiceCommands.labOrders.title', { id: parsed.orderId });
  if (!ctx.hasPermission(LAB_ORDERS_PERMISSIONS.VIEW)) {
    await ctx.finish({ title, message: t('VoiceCommands.noPermission'), tone: 'error' }, t('VoiceCommands.noPermission'));
    return;
  }
  const order = await loadOrder(ctx, parsed.orderId, title);
  if (!order) return;
  const base = baseCard(ctx, order);
  const rows: VoiceCardRow[] = [
    {
      label: t('VoiceCommands.labOrders.stage'),
      value: t('VoiceCommands.labOrders.stageWithDays', { stage: order.stage_name, days: order.days_in_stage }),
      tone: order.is_stage_overdue ? 'warning' : 'default',
    },
  ];
  if (order.laboratory_name) rows.push({ label: t('VoiceCommands.labOrders.laboratory'), value: order.laboratory_name });
  if (order.due_date) {
    rows.push({ label: t('VoiceCommands.labOrders.dueDate'), value: formatDisplayDate(order.due_date), tone: order.is_past_due ? 'danger' : 'default' });
  }
  if (order.is_urgent) rows.push({ label: t('VoiceCommands.labOrders.urgent'), value: t('VoiceCommands.labOrders.urgentValue'), tone: 'warning' });

  const speech = [
    t('VoiceCommands.labOrders.statusSpeech', {
      id: order.id,
      patient: order.patient_name,
      stage: order.stage_name,
      days: order.days_in_stage,
    }),
    order.due_date && order.is_pending ? t('VoiceCommands.labOrders.statusDue', { date: speakDate(order.due_date, ctx.locale) }) : '',
    order.is_overdue ? t('VoiceCommands.labOrders.statusOverdue') : '',
    order.is_urgent ? t('VoiceCommands.labOrders.statusUrgent') : '',
  ].filter(Boolean).join(' ');
  await ctx.finish({ ...base, rows, tone: order.is_overdue ? 'error' : 'info', link: orderLink(ctx, order.id) }, speech);
}

// ── Entrega, urgente y notas ──────────────────────────────────────────────────

async function runEdit(parsed: LabEditParsed, ctx: VoiceCommandContext) {
  const { t } = ctx;
  const title = t('VoiceCommands.labOrders.title', { id: parsed.orderId });
  if (!ctx.hasPermission(LAB_ORDERS_PERMISSIONS.VIEW) || !ctx.hasPermission(LAB_ORDERS_PERMISSIONS.UPDATE)) {
    await ctx.finish({ title, message: t('VoiceCommands.noPermission'), tone: 'error' }, t('VoiceCommands.noPermission'));
    return;
  }
  const order = await loadOrder(ctx, parsed.orderId, title);
  if (!order) return;
  const base = baseCard(ctx, order);
  const link = orderLink(ctx, order.id);
  const today = dateKey(startOfToday());

  // La entrega se fija al enviarla: en la etapa inicial no se cambia por acá.
  let due = parsed.due;
  if (due !== undefined && order.stage_kind === 'initial') {
    const message = t('VoiceCommands.labOrders.dueOnSend', { id: order.id });
    if (parsed.urgent === undefined && parsed.note === undefined) {
      await ctx.finish({ ...base, message, tone: 'info', link }, message);
      return;
    }
    due = undefined;
  }
  if (due === 'ask') {
    const question = t('VoiceCommands.labOrders.whenDue');
    due = undefined;
    for (let attempt = 0; attempt < 2 && !due; attempt++) {
      const answer = await ctx.ask({ ...base, message: question, tone: 'info' }, attempt ? t('VoiceCommands.labOrders.whenDueAgain') : question);
      due = parseSpokenDate(normalizeSpeech(answer), 'future') ?? undefined;
    }
    if (!due) {
      await ctx.finish({ ...base, message: t('VoiceCommands.nothingChanged'), tone: 'info' }, t('VoiceCommands.nothingChanged'));
      return;
    }
  }
  let note = parsed.note;
  if (note === 'ask') {
    const question = t('VoiceCommands.labOrders.whatNote');
    note = (await ctx.ask({ ...base, message: question, tone: 'info' }, question)).trim() || undefined;
    if (!note) {
      await ctx.finish({ ...base, message: t('VoiceCommands.nothingChanged'), tone: 'info' }, t('VoiceCommands.nothingChanged'));
      return;
    }
  }

  // Lo que ya está así no se cambia (y se dice).
  const dueChange = due && due !== order.due_date ? due : undefined;
  const urgentChange = parsed.urgent !== undefined && parsed.urgent !== order.is_urgent ? parsed.urgent : undefined;
  if (!dueChange && urgentChange === undefined && !note) {
    const message = parsed.urgent !== undefined
      ? t(order.is_urgent ? 'VoiceCommands.labOrders.alreadyUrgent' : 'VoiceCommands.labOrders.alreadyNotUrgent', { id: order.id })
      : t('VoiceCommands.labOrders.alreadyDue', { id: order.id, date: formatDisplayDate(order.due_date ?? today) });
    await ctx.finish({ ...base, message, tone: 'info', link }, message);
    return;
  }

  const rows: VoiceCardRow[] = [];
  const said: string[] = [];
  if (dueChange) {
    rows.push({
      label: t('VoiceCommands.labOrders.dueDate'),
      value: `${order.due_date ? `${formatDisplayDate(order.due_date)} → ` : ''}${formatDisplayDate(dueChange)}`,
      tone: dueChange < today ? 'warning' : 'default',
    });
    said.push(t('VoiceCommands.labOrders.confirmDueChange', { date: speakDate(dueChange, ctx.locale) }));
    if (dueChange < today && order.is_pending) said.push(t('VoiceCommands.labOrders.confirmDuePast'));
  }
  if (urgentChange !== undefined) {
    rows.push({
      label: t('VoiceCommands.labOrders.urgent'),
      value: t(urgentChange ? 'VoiceCommands.labOrders.urgentOn' : 'VoiceCommands.labOrders.urgentOff'),
      tone: urgentChange ? 'warning' : 'default',
    });
    said.push(t(urgentChange ? 'VoiceCommands.labOrders.confirmUrgentOn' : 'VoiceCommands.labOrders.confirmUrgentOff'));
  }
  const nextNotes = note ? [order.notes?.trim(), note].filter(Boolean).join('\n').slice(0, NOTES_MAX) : order.notes;
  if (note) {
    rows.push({ label: t('VoiceCommands.labOrders.note'), value: note });
    said.push(t('VoiceCommands.labOrders.confirmNote', { note }));
  }

  const speech = [
    t('VoiceCommands.labOrders.confirmIntro', { id: order.id, patient: order.patient_name, work: order.work_summary || order.work_description || '—' }),
    ...said,
    t('VoiceCommands.confirmQuestion'),
  ].join(' ');
  const confirmed = await ctx.confirm({ ...base, rows, message: t('VoiceCommands.labOrders.confirmEditHint'), tone: 'confirm' }, speech);
  if (!confirmed) {
    await ctx.finish({ ...base, rows, message: t('VoiceCommands.nothingChanged'), tone: 'info' }, t('VoiceCommands.nothingChanged'));
    return;
  }

  ctx.show({ ...base, rows, message: t('VoiceCommands.labOrders.saving'), tone: 'info' });
  try {
    // El guardado reemplaza la orden entera: se manda tal cual está, con los cambios.
    const saved = await saveLabOrder({
      id: order.id,
      patient_id: order.patient_id,
      doctor_id: order.doctor_id,
      laboratory_id: order.laboratory_id,
      work_description: order.work_description,
      teeth: order.items.length > 0 ? [] : order.teeth,
      // Sin la clave el backend deja la fecha guardada.
      ...(dueChange ? { due_date: dueChange } : {}),
      notes: nextNotes,
      is_urgent: urgentChange ?? order.is_urgent,
      items: order.items.map((item) => ({ service_id: item.service_id, quantity: item.quantity, teeth: item.teeth, notes: item.notes })),
    }, optsOf(ctx));
    emitLabOrderChanged(saved);
    const done = t('VoiceCommands.labOrders.saved', { id: saved.id });
    await ctx.finish({ ...base, rows, message: done, tone: 'success', link }, done);
  } catch (error) {
    if (ctx.signal.aborted) throw error;
    const failed = errorText(ctx, error);
    await ctx.finish({ ...base, rows, message: failed, tone: 'error', link }, failed);
  }
}

// ── Mostrame las atrasadas / las de Ana Pérez ─────────────────────────────────

const onLabOrdersScreen = () => typeof window !== 'undefined'
  && /^\/(?:(?:es-ES|es|en)\/)?lab-orders\/?$/.test(window.location.pathname);

async function runList(parsed: LabListParsed, ctx: VoiceCommandContext) {
  const { t } = ctx;
  const title = t('VoiceCommands.labOrders.listTitle');
  if (!ctx.hasPermission(LAB_ORDERS_PERMISSIONS.VIEW)) {
    await ctx.finish({ title, message: t('VoiceCommands.noPermission'), tone: 'error' }, t('VoiceCommands.noPermission'));
    return;
  }
  const opts = optsOf(ctx);
  let laboratory: { id: string; name: string } | null = null;
  let patient: { id: string; name: string } | null = null;

  // Laboratorio: el que eligió la IA, o el nombrado (si se dijo "laboratorio" o el nombre coincide entero).
  const needsLab = parsed.laboratoryId || parsed.who;
  const labs: Laboratory[] = needsLab ? await searchLaboratories({ limit: 50 }, opts).catch(() => []) : [];
  if (parsed.laboratoryId) laboratory = labs.find((l) => l.id === parsed.laboratoryId) ?? null;
  if (!laboratory && parsed.who) {
    const index = bestNameMatch(parsed.who, labs.map((l) => l.name));
    const name = index !== null ? normalizeSpeech(labs[index].name) : '';
    if (index !== null && (parsed.whoIsLab || ` ${parsed.who} `.includes(` ${name} `) || ` ${name} `.includes(` ${parsed.who} `))) laboratory = labs[index];
  }
  // Paciente: lo que se nombró y no es un laboratorio.
  if (parsed.who && !laboratory && !parsed.whoIsLab) {
    ctx.show({ title, message: t('VoiceCommands.labOrders.searchingPatient', { name: parsed.who }), tone: 'info' });
    const found = await searchPatients(parsed.who, opts);
    const exact = found.filter((p) => normalizeSpeech(p.name) === normalizeSpeech(parsed.who ?? ''));
    const pick = found.length === 1 ? found[0] : exact.length === 1 ? exact[0] : null;
    if (pick) {
      patient = { id: pick.id, name: pick.name };
    } else if (found.length > 1) {
      const shown = (exact.length > 1 ? exact : found).slice(0, MAX_CHOICES);
      const question = t('VoiceCommands.labOrders.choosePatient', { name: parsed.who });
      const index = await ctx.choose(
        { title, message: question, tone: 'info', choices: shown.map((p) => ({ label: p.name, detail: p.phone_number || undefined })) },
        `${question} ${shown.map((p, i) => `${i + 1}: ${p.name}`).join('. ')}.`,
      );
      patient = { id: shown[index].id, name: shown[index].name };
    } else {
      const message = t('VoiceCommands.labOrders.whoNotFound', { name: parsed.who });
      await ctx.finish({ title, message, tone: 'error' }, message);
      return;
    }
  } else if (parsed.who && !laboratory) {
    const message = t('VoiceCommands.labOrders.whoNotFound', { name: parsed.who });
    await ctx.finish({ title, message, tone: 'error' }, message);
    return;
  }

  // Un pedido nuevo de filtros reemplaza los anteriores (salvo que solo se pida la vista).
  const onlyView = !parsed.overdue && !parsed.urgent && !parsed.dueToday && !laboratory && !patient && !parsed.clear;
  const request: LabOrdersViewRequest = onlyView && parsed.view
    ? { view: parsed.view }
    : {
      clear: true,
      overdue: parsed.overdue,
      urgent: parsed.urgent,
      dueToday: parsed.dueToday,
      laboratory,
      patient,
      ...(parsed.view ? { view: parsed.view } : {}),
    };
  requestLabOrdersView(request);
  if (!onLabOrdersScreen()) ctx.navigate('/lab-orders');

  // Cuántas son (mismo criterio que la pantalla: pendientes, salvo las de un paciente).
  const today = dateKey(startOfToday());
  const filters: LabOrderFilters = {
    pending_only: !patient,
    overdue_only: parsed.overdue || undefined,
    urgent_only: parsed.urgent || undefined,
    laboratory_id: laboratory?.id,
    patient_id: patient?.id,
    ...(parsed.dueToday ? { due_from: today, due_to: today } : {}),
  };
  if (onlyView) {
    const message = t('VoiceCommands.labOrders.listView', { view: parsed.view ?? 'list' });
    await ctx.finish({ title, message, tone: 'success' }, message);
    return;
  }
  const total = await searchLabOrders({ ...filters, limit: 1, offset: 0 }, opts).then((r) => r.total).catch(() => null);
  // Los adjetivos concuerdan con la cantidad ("1 orden atrasada", "3 órdenes atrasadas"); sin cantidad, en plural.
  const count = total ?? 2;
  const what = [
    parsed.overdue ? t('VoiceCommands.labOrders.listOverdue', { count }) : '',
    parsed.urgent ? t('VoiceCommands.labOrders.listUrgent', { count }) : '',
    parsed.dueToday ? t('VoiceCommands.labOrders.listDueToday') : '',
    laboratory ? t('VoiceCommands.labOrders.listOf', { name: laboratory.name }) : '',
    patient ? t('VoiceCommands.labOrders.listOf', { name: patient.name }) : '',
  ].filter(Boolean).join(', ') || t('VoiceCommands.labOrders.listAll', { count });
  const message = total === null
    ? t('VoiceCommands.labOrders.listShownNoCount', { what })
    : t('VoiceCommands.labOrders.listShown', { count: total, what });
  await ctx.finish({ title, message, tone: 'success' }, message);
}

// ── Registro ──────────────────────────────────────────────────────────────────

registerVoiceCommand<{ orderId: number }, VoiceAiResult>({
  id: 'lab-orders.status',
  domain: LAB_ORDERS_VOICE_DOMAIN,
  priority: PRIORITY,
  match: (normalized) => parseLabOrderStatus(normalized),
  run: runStatus,
  ai: {
    from: (result: VoiceAiResult) => (result.intent === 'lab_order.status' && result.order_id ? { orderId: result.order_id } : null),
  },
});

registerVoiceCommand<LabEditParsed, VoiceAiResult>({
  id: 'lab-orders.edit',
  domain: LAB_ORDERS_VOICE_DOMAIN,
  priority: PRIORITY,
  match: (normalized, raw) => parseLabOrderEdit(normalized, raw),
  run: runEdit,
  ai: {
    from: (result: VoiceAiResult) => {
      if (result.intent !== 'lab_order.update' || !result.order_id) return null;
      const parsed: LabEditParsed = { orderId: result.order_id };
      if (result.due_date) parsed.due = result.due_date;
      if (result.urgent_change !== null) parsed.urgent = result.urgent_change;
      if (result.note_add) parsed.note = result.note_add;
      return parsed.due || parsed.urgent !== undefined || parsed.note ? parsed : null;
    },
  },
});

registerVoiceCommand<LabListParsed, VoiceAiResult>({
  id: 'lab-orders.list',
  domain: LAB_ORDERS_VOICE_DOMAIN,
  priority: PRIORITY,
  match: (normalized) => parseLabOrdersList(normalized),
  run: runList,
  ai: {
    from: (result: VoiceAiResult) => {
      if (result.intent !== 'lab_order.list') return null;
      const f = result.filter;
      return {
        overdue: f?.overdue ?? false,
        urgent: f?.urgent ?? false,
        dueToday: f?.due_today ?? false,
        view: f?.view ?? null,
        clear: f?.clear ?? false,
        count: f?.count ?? false,
        who: result.laboratory_id ? null : result.patient ? normalizeSpeech(result.patient) : null,
        whoIsLab: false,
        laboratoryId: result.laboratory_id,
      };
    },
  },
});
