import { LAB_ORDERS_VOICE_DOMAIN } from '@/lib/voice/commands/lab-orders';
import { ORDER_RE } from '@/lib/voice/commands/lab-orders-parse';
import { normalizeSpeech, parseChoice } from '@/lib/voice/parse';
import { registerVoiceCommand } from '@/lib/voice/registry';
import { getVoiceBridge } from '@/lib/voice/screen-bridge';

import type { LabOrdersPageVoiceBridge, VoiceCommandContext } from '@/lib/types';

/**
 * Órdenes de laboratorio por lo que se ve, como en la agenda: «abrí la de Ana Pérez», «pasá la
 * primera a recibida», «¿dónde está la de Juan?», «la de Dental Sur llegó», o sin nombrar nada si
 * hay una orden abierta («marcala como urgente», «pasala a la etapa siguiente»). Se resuelve a qué
 * orden se refiere y lo dicho sigue por los comandos de siempre con su número («la orden 45…»).
 */

const page = () => getVoiceBridge<LabOrdersPageVoiceBridge>('lab_orders.page');
const T = (ctx: VoiceCommandContext, key: string, values?: Record<string, string | number>) => ctx.t(`VoiceCommands.labOrders.pick.${key}`, values);

/** Lo que se hace con una orden (sin número): mover, consultar, editar, abrir. */
const ACTION_RE = /\b(?:envi\w*|mand\w*|despach\w*|lleg\w*|recib\w*|volvi\w*|vino|complet\w*|termin\w*|finaliz\w*|entreg\w*|instal\w*|colocad\w*|cancel\w*|anul\w*|avanz\w*|siguiente|pasa\w*|move\w*|mueve|pone\w*|cambia\w*|urgente|urgent|nota|note|entrega|vence|edita\w*|modifica\w*|donde esta|en que (?:etapa|anda|esta|va)|como (?:va|viene|esta|anda)|que paso con|estado de|sent|send|ship\w*|arriv\w*|receiv\w*|came back|finish\w*|deliver\w*|advance|next|where is|what stage|status of|how is)\b/;
const OPEN_RE = /^(?:abri\w*|abre|abrir|mostra\w*|muestra\w*|ver|selecciona\w*|elegi\w*|open|show(?: me)?|select)\b/;
/** «la de Ana Pérez», «la orden de Dental Sur», «el trabajo de la corona», «Juan's». */
const TARGET_RE = /\b(?:la|el|the)\s+(?:(?:orden|pedido|trabajo|order|one)\s+)?(?:de|del|para|of|for)\s+(?:la\s+|el\s+|the\s+)?(?:paciente\s+|patient\s+|laboratorio\s+|lab\s+)?([a-z][a-z0-9 ]{1,40}?)(?=\s+(?:a|al|en|como|para|que|to|as|is|was|y|and)\b|$)/;
const POSITION_RE = /\b(?:la|el|the)\s+(primer[ao]?|segund[ao]|tercer[ao]?|cuart[ao]|quint[ao]|ultim[ao]|penultim[ao]|first|second|third|fourth|fifth|last)(?:\s+(?:orden|order|one))?\b/;

interface PickParsed {
  /** Lo dicho que nombra a la orden (para reemplazarlo por «orden N»). */
  span: string | null;
  name: string | null;
  position: string | null;
  open: boolean;
  normalized: string;
}

export function parseLabOrderPick(normalized: string): PickParsed | null {
  // Con número ya lo toman los comandos de siempre; plural («las de Ana») es filtrar la lista.
  if (ORDER_RE.test(normalized) || /\b(?:las|los)\s+(?:ordenes\s+|pedidos\s+|trabajos\s+)?(?:de|del)\b|\b(?:crea\w*|nueva|nuevo|carga\w*|registra\w*|create|new)\b/.test(normalized)) return null;
  const open = OPEN_RE.test(normalized);
  if (!open && !ACTION_RE.test(normalized)) return null;
  const pos = normalized.match(POSITION_RE);
  if (pos) return { span: pos[0], name: null, position: pos[1], open, normalized };
  const target = normalized.match(TARGET_RE);
  if (target) return { span: target[0], name: target[1].trim(), position: null, open, normalized };
  // Sin nombrar nada: la orden abierta («pasala a recibida»); abrir sin decir cuál no es esto.
  if (open) return null;
  return { span: null, name: null, position: null, open, normalized };
}

registerVoiceCommand<PickParsed>({
  id: 'lab-orders.pick',
  domain: LAB_ORDERS_VOICE_DOMAIN,
  // Antes que los de siempre (10–11): esos necesitan el número y este se lo pone.
  priority: 12,
  match: (normalized) => {
    const p = page();
    if (!p) return null;
    const parsed = parseLabOrderPick(normalized);
    if (!parsed) return null;
    // Sin nombre ni posición solo vale con una orden abierta.
    if (!parsed.name && !parsed.position && !p.selectedId) return null;
    return parsed;
  },
  run: async (parsed, ctx) => {
    const p = page();
    if (!p) return;
    let id: number | null = null;
    if (parsed.position) {
      const i = parseChoice(parsed.position, p.rows.length);
      id = i === null ? null : p.rows[i]?.id ?? null;
    } else if (parsed.name) {
      const words = normalizeSpeech(parsed.name).split(' ').filter((w) => w.length > 1);
      const hits = p.rows.filter((r) => { const hay = normalizeSpeech(`${r.patient} ${r.laboratory} ${r.work}`); return words.every((w) => hay.includes(w)); });
      if (hits.length === 1) id = hits[0].id;
      else if (hits.length > 1) {
        const question = T(ctx, 'which');
        const index = await ctx.choose(
          { title: T(ctx, 'title'), message: question, tone: 'info', choices: hits.map((r) => ({ label: `#${r.id} ${r.patient}`, detail: [r.work, r.stage].filter(Boolean).join(' · ') })) },
          `${question} ${hits.slice(0, 5).map((r, i) => `${i + 1}: ${r.patient}, ${r.work || r.stage}`).join('. ')}.`,
        );
        id = hits[index].id;
      }
    } else {
      id = p.selectedId;
    }
    if (!id) {
      const message = T(ctx, 'notFound');
      await ctx.finish({ title: T(ctx, 'title'), message, tone: 'info' }, message);
      return;
    }
    if (parsed.open && !ACTION_RE.test(parsed.normalized.replace(OPEN_RE, ''))) {
      p.select(id);
      const row = p.rows.find((r) => r.id === id);
      const message = T(ctx, 'opened', { id, patient: row?.patient ?? '' });
      await ctx.finish({ title: T(ctx, 'title'), message, tone: 'success' }, message);
      return;
    }
    // Lo mismo, con el número: lo resuelven los comandos de siempre (etapa, estado, edición).
    const text = parsed.span ? parsed.normalized.replace(parsed.span, ` la orden ${id} `) : `${parsed.normalized} orden ${id}`;
    ctx.followUp(text.replace(/\s+/g, ' ').trim());
    ctx.show({ title: T(ctx, 'title'), message: T(ctx, 'resolved', { id }), tone: 'info' });
    await ctx.finish({ title: T(ctx, 'title'), message: T(ctx, 'resolved', { id }), tone: 'info' }, '');
  },
});
