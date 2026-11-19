import { LAB_ORDERS_VOICE_DOMAIN } from '@/lib/voice/commands/lab-orders';
import { applyDraftEdit, confirmDraft, currentDraft, hasEdit, type DraftEnv } from '@/lib/voice/commands/lab-orders-draft';
import { loadOrder } from '@/lib/voice/commands/lab-orders-manage';
import { parseLabOrderEditOpen } from '@/lib/voice/commands/lab-orders-parse';
import { openVoiceLabOrderEdit, waitForVoiceLabOrderDialog } from '@/lib/voice/lab-order-draft-bridge';
import { registerVoiceCommand } from '@/lib/voice/registry';
import { cancelVoice } from '@/lib/voice/session';
import { REQUEST_TIMEOUT_MS } from '@/services/api';
import { searchLaboratories } from '@/services/lab-orders';

import { LAB_ORDERS_PERMISSIONS } from '@/constants/permissions';
import type { Laboratory, VoiceAiDraftEdit, VoiceAiResult, VoiceCommandContext } from '@/lib/types';

/**
 * Editar una orden existente por voz, en el mismo asistente que se usa a mano:
 *   "editá la orden 45"                               → la abre en Revisar y pregunta qué cambiar
 *   "a la orden 45 agregale un perno en la 21"        → la abre, aplica el cambio y pregunta "¿Guardo los cambios?"
 *   "la orden 45 es para María López"                 → cambia el paciente (la tarjeta lo marca en rojo)
 *   "modificá la 45, sacale la corona y que sea urgente"
 * Después es el mismo ciclo que el alta (lab-orders-draft.ts): "sí" pulsa Guardar cambios, "no" la
 * deja abierta y cualquier otra cosa es otra corrección. Lo simple (entrega, urgente, una nota)
 * sigue yendo por el camino corto de lab-orders-manage.ts, sin abrir el asistente.
 */

/** Por encima de los cambios simples (10) y del movimiento de etapa: "cambiá el laboratorio de la orden 45". */
const PRIORITY = 11;

interface EditOrderParsed {
  orderId: number;
  /** Primera corrección dicha con el pedido (frase entera), o null para preguntar qué cambiar. */
  change: string | null;
  /** Lo mismo ya interpretado por la IA. */
  edit?: VoiceAiDraftEdit | null;
}

async function run(parsed: EditOrderParsed, ctx: VoiceCommandContext) {
  const { t } = ctx;
  const title = t('VoiceCommands.labOrders.editTitle', { id: parsed.orderId });
  if (!ctx.hasPermission(LAB_ORDERS_PERMISSIONS.VIEW) || !ctx.hasPermission(LAB_ORDERS_PERMISSIONS.UPDATE)) {
    await ctx.finish({ title, message: t('VoiceCommands.noPermission'), tone: 'error' }, t('VoiceCommands.noPermission'));
    return;
  }
  const opts = { signal: ctx.signal, timeoutMs: REQUEST_TIMEOUT_MS.mutation };
  const [order, labs] = await Promise.all([
    loadOrder(ctx, parsed.orderId, title),
    searchLaboratories({ limit: 50 }, opts).catch(() => [] as Laboratory[]),
  ]);
  if (!order) return;

  // Si la persona la cierra (o la guarda con el botón) mientras se le pregunta, el comando termina.
  openVoiceLabOrderEdit(order, () => cancelVoice());
  await waitForVoiceLabOrderDialog(ctx.signal);
  const original = currentDraft();
  const env: DraftEnv = {
    base: { title, subtitle: original.patient?.name || order.patient_name },
    labs,
    initial: null,
    sendStage: null,
    edit: { order, original },
  };

  if (parsed.edit && hasEdit(parsed.edit)) {
    ctx.show({ ...env.base, message: t('VoiceCommands.labOrders.updatingDraft'), tone: 'info' });
    const said = await applyDraftEdit(ctx, parsed.edit, env);
    await confirmDraft(ctx, env, { prefix: said.join(' ') });
    return;
  }
  await confirmDraft(ctx, env, { firstAnswer: parsed.change ?? undefined });
}

function fromAi(result: VoiceAiResult): EditOrderParsed | null {
  if (result.intent !== 'lab_order.edit' || !result.order_id) return null;
  return { orderId: result.order_id, change: null, edit: result.draft_edit };
}

registerVoiceCommand<EditOrderParsed, VoiceAiResult>({
  id: 'lab-orders.edit-order',
  domain: LAB_ORDERS_VOICE_DOMAIN,
  priority: PRIORITY,
  match: parseLabOrderEditOpen,
  run,
  ai: { from: fromAi },
});
