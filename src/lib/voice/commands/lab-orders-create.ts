import { interpretWithAi } from '@/lib/voice/ai';
import { labOrdersAiContext } from '@/lib/voice/commands/lab-orders';
import { chooseLab, confirmDraft, resolveDue, resolvePatient, resolveService } from '@/lib/voice/commands/lab-orders-draft';
import { ORDER_RE } from '@/lib/voice/commands/lab-orders-parse';
import { openVoiceLabOrderDraft } from '@/lib/voice/lab-order-draft-bridge';
import { registerVoiceCommand } from '@/lib/voice/registry';
import { cancelVoice } from '@/lib/voice/session';
import { REQUEST_TIMEOUT_MS } from '@/services/api';
import { searchLaboratories } from '@/services/lab-orders';
import { fetchLabStages } from '@/services/lab-stages';

import { LAB_ORDERS_PERMISSIONS } from '@/constants/permissions';
import type { LabOrderDraft } from '@/components/lab-orders/lab-order-form-dialog';
import type { Laboratory, LabStage, VoiceAiResult, VoiceCard, VoiceCommandContext } from '@/lib/types';

/**
 * "Creá una orden para Juan Pérez, corona de zirconio en la 36, al laboratorio Dental Sur, urgente"
 *
 * La frase la interpreta la IA (paciente, trabajos, piezas, laboratorio, envío). El paciente y
 * los servicios se buscan acá con las mismas búsquedas que el asistente de alta; si hay dudas se
 * pregunta. Después se abre el asistente completo en Revisar y "sí" pulsa Crear (o Crear y enviar).
 * Con "no" queda abierto para completarlo a mano, y cualquier otra respuesta se toma como una
 * corrección ("que sea urgente", "agregá un perno en la 21") que se aplica antes de volver a preguntar
 * (ese ciclo es el mismo de la edición: lab-orders-draft.ts).
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

type DraftItem = NonNullable<LabOrderDraft['items']>[number];

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

function fromAi(result: VoiceAiResult, raw: string): CreateParsed | null {
  return result.intent === 'lab_order.create' ? { raw, ai: result } : null;
}

registerVoiceCommand<CreateParsed>({
  id: 'lab-orders.create',
  match,
  run,
  ai: { context: labOrdersAiContext, from: fromAi },
});
