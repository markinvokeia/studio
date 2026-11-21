import { parseScreen } from '@/lib/voice/commands/screen';
import { pickOverlayButton, pickOverlayField, readTopOverlay } from '@/lib/voice/dom-dialog';
import { parseYesNo } from '@/lib/voice/parse';
import { registerVoiceCommand } from '@/lib/voice/registry';
import { getVoiceBridge } from '@/lib/voice/screen-bridge';
import { looksLikeCommand } from '@/lib/voice/wake';
import { WORKSPACE_VOICE_DOMAIN } from '@/lib/voice/commands/workspace';
import { useVoiceCommand } from '@/stores/voice-command-store';

import type { DoctorAgentVoiceBridge, DoctorAgentVoiceReply, VoiceCommandContext } from '@/lib/types';

/**
 * Mi consultorio: el caso clínico. Con una cita elegida, lo que se pide es de ese paciente y va al
 * agente clínico (el mismo del chat «Agente clínico»: POST ai/doctor/query con la cita): resúmenes,
 * preguntas («¿qué alergias tiene?», «¿qué le hice la última vez?»), dictar la sesión («hice una
 * limpieza y una restauración en el 16, próxima cita control») y el odontograma, que el agente
 * prepara y la pantalla abre; guardar o revisar lo dictado. Lo de la pantalla (elegir otra cita,
 * receta, laboratorio, sesión estética, periodontograma, ficha) lo hacen los comandos de la página,
 * que van antes. Si el agente dice que lo pedido no es del caso, se pregunta antes de cerrarlo;
 * cerrado, lo que se pide ya no es de ese paciente (hasta elegir otra cita o «volvé al caso»).
 */

const agent = () => getVoiceBridge<DoctorAgentVoiceBridge>('workspace.agent');
const clinicalCase = () => useVoiceCommand.getState().clinicalCase;
const T = (ctx: VoiceCommandContext, key: string, values?: Record<string, string | number>) => ctx.t(`VoiceCommands.clinical.${key}`, values);

/** Cuántas vueltas de pregunta y respuesta con el agente dentro de un mismo pedido. */
const MAX_TURNS = 6;

const CLOSE_RE = /^(?:cerra\w*|cierra\w*|termina\w*|deja\w*|sali\w*|close|end|leave|exit|finish)\s+(?:(?:el|este|the|this)\s+)?(?:caso(?: clinico)?|paciente|case|patient)$|^(?:termine|terminamos|listo) con (?:el |este |la |esta )?(?:paciente|caso)$|^(?:done|finished) with (?:the |this )?(?:patient|case)$/;
const REOPEN_RE = /^(?:volve\w*|vuelve|regresa\w*|abri\w*|abre|retoma\w*|go back|back|return|reopen|open)\s+(?:(?:a|al|to|the)\s+)*(?:el |the )?(?:caso(?: clinico)?|paciente|case|patient)$/;

/** Palabras de lo clínico y del paciente: lo dicho es para el agente aunque no sea una orden. */
const CLINICAL_RE = /\b(?:paciente|patient|resum\w*|summar\w*|alergi\w*|allerg\w*|tratamiento\w*|treatment\w*|diente\w*|pieza\w*|tooth|teeth|sesion\w*|session\w*|odontograma|odontogram|caries|carie|extraccion\w*|extraction|endodoncia|root canal|conducto\w*|restauracion\w*|restoration|obturacion\w*|filling|corona\w*|crown|implante\w*|implant|limpieza|cleaning|profilaxis|blanqueamiento|whitening|ortodoncia|orthodont\w*|brackets?|protesis|denture|antecedente\w*|history|medicacion\w*|medicamento\w*|medication\w*|plan|proxima cita|next (?:appointment|visit)|diagnostic\w*|diagnos\w*|evolucion|notas?|notes?|hice|le hice|realice|hicimos|i did|we did|procedimiento\w*|procedure\w*|deuda|debe|owes?|presupuesto\w*|quote\w*|ultima vez|last (?:time|visit)|hoy|today|toca|anamnesis|radiografia\w*|x-?rays?|dolor|pain|sangrado|bleeding)\b/;
const QUESTION_RE = /^(?:que|cual\w*|cuando|cuant[oa]s?|como|donde|quien\w*|por que|tiene|tuvo|hay|hubo|es|esta|fue|le|se|what|which|when|how|where|who|why|does|did|is|was|has|have|had|can|could|should)\b/;
const AGENT_VERB_RE = /^(?:guarda\w*|revisa\w*|confirma\w*|anota\w*|registra\w*|completa\w*|dicta\w*|carga\w*|prepara\w*|arma\w*|cuenta\w*|conta\w*|explica\w*|lee\w*|leeme|save|review|confirm|note|write|record|complete|prepare|explain|read)\b/;

/** Lo dicho parece para el asistente (con el micrófono abierto también se oye la charla de la sala). */
export function soundsForClinicalAgent(normalized: string): boolean {
  return looksLikeCommand(normalized) || QUESTION_RE.test(normalized) || AGENT_VERB_RE.test(normalized) || CLINICAL_RE.test(normalized) || !!parseYesNo(normalized);
}

type Parsed = { op: 'close' } | { op: 'reopen' } | { op: 'ask'; text: string };

/** El agente pregunta algo («¿La guardo o preferís revisarla?»): la respuesta va a él. */
const asksBack = (reply: DoctorAgentVoiceReply) => reply.texts.some((x) => /\?\s*$/.test(x.trim()));

async function askAgent(ctx: VoiceCommandContext, query: string): Promise<DoctorAgentVoiceReply | null> {
  const a = agent();
  if (!a) return null;
  ctx.show({ title: T(ctx, 'title'), subtitle: a.patientName, message: T(ctx, 'asking'), tone: 'info' });
  return a.ask(query);
}

function replyCard(ctx: VoiceCommandContext, reply: DoctorAgentVoiceReply, patient: string) {
  const message = [...reply.texts, ...reply.problems].filter(Boolean).join('\n\n') || T(ctx, 'done');
  // Con formato (como en el chat del agente) y sin esconderse sola: es para leerla con calma.
  return { title: T(ctx, 'title'), subtitle: patient, message, tone: (reply.problems.length ? 'error' : 'info') as 'error' | 'info', rich: true, sticky: true };
}

registerVoiceCommand<Parsed>({
  id: 'workspace.agent',
  domain: WORKSPACE_VOICE_DOMAIN,
  // Lo último: lo de la pantalla (elegir citas, receta, laboratorio, botones) va antes.
  priority: -10,
  // Lo dictado tiene varias partes («hice una limpieza y una restauración en el 16»): no es un plan.
  handlesCompound: true,
  // Trabaja con la ventana que esté abierta (la sesión que preparó el agente, una receta).
  keepsOverlay: true,
  match: (normalized, raw) => {
    const a = agent();
    const c = clinicalCase();
    if (!a || !c || c.appointmentId !== a.appointmentId) return null;
    if (CLOSE_RE.test(normalized)) return c.open ? { op: 'close' } : null;
    if (REOPEN_RE.test(normalized)) return { op: 'reopen' };
    if (!c.open || !soundsForClinicalAgent(normalized)) return null;
    // Con una ventana abierta (receta, laboratorio, sesión), lo que es un botón o un campo suyo
    // («cancelar», «guardar», «la dosis es 400») es para la ventana, no para el agente.
    const overlay = readTopOverlay();
    if (overlay && (pickOverlayButton(normalized, overlay) || pickOverlayField(raw, normalized, overlay) || /^(?:cancela\w*|cerra\w*|cierra\w*|guarda\w*|volve\w*|sali\w*|cancel|close|save|back)$/.test(normalized))) return null;
    if (overlay) {
      const screen = (() => { try { return parseScreen(normalized, raw); } catch { return null; } })();
      if (screen && screen.op !== 'help') return null;
    }
    return { op: 'ask', text: raw.trim() };
  },
  run: async (parsed, ctx) => {
    const c = clinicalCase();
    const a = agent();
    if (!c || !a) { await ctx.finish({ title: T(ctx, 'title'), message: T(ctx, 'noCase'), tone: 'info' }, T(ctx, 'noCase')); return; }
    const patient = a.patientName || c.patient;
    if (parsed.op === 'close') {
      useVoiceCommand.setState({ clinicalCase: { ...c, open: false } });
      await ctx.finish({ title: T(ctx, 'title'), message: T(ctx, 'closed', { patient }), tone: 'success' }, T(ctx, 'closed', { patient }));
      return;
    }
    if (parsed.op === 'reopen') {
      useVoiceCommand.setState({ clinicalCase: { ...c, open: true } });
      await ctx.finish({ title: T(ctx, 'title'), subtitle: patient, message: T(ctx, 'reopened', { patient }), tone: 'success' }, T(ctx, 'reopened', { patient }));
      return;
    }

    let reply = await askAgent(ctx, parsed.text);
    if (ctx.signal.aborted) return;
    if (!reply) { await ctx.finish({ title: T(ctx, 'title'), subtitle: patient, message: T(ctx, 'noReply'), tone: 'error' }, T(ctx, 'noReply')); return; }

    // No es del caso: se pregunta antes de cerrarlo; cerrado, lo pedido se hace aparte.
    if (reply.intent === 'unknown' && !reply.acted) {
      const question = T(ctx, 'notCase', { patient });
      const close = await ctx.confirm({ title: T(ctx, 'title'), subtitle: patient, message: [reply.texts.join('\n\n'), question].filter(Boolean).join('\n\n'), tone: 'confirm' }, question);
      if (close) {
        useVoiceCommand.setState({ clinicalCase: { ...c, open: false } });
        if (await ctx.tryAi()) return;
        await ctx.finish({ title: T(ctx, 'title'), message: T(ctx, 'closedNotUnderstood', { patient }), tone: 'info' }, T(ctx, 'closedNotUnderstood', { patient }));
        return;
      }
      await ctx.finish(replyCard(ctx, reply, patient), reply.speech || T(ctx, 'kept', { patient }));
      return;
    }

    // El agente pregunta (guardar o revisar lo dictado, un dato que falta): la respuesta va a él.
    for (let turn = 1; turn < MAX_TURNS && asksBack(reply) && !reply.problems.length; turn++) {
      const answer = (await ctx.ask(replyCard(ctx, reply, patient), reply.speech || reply.texts.join(' '))).trim();
      if (!answer || ctx.signal.aborted) return;
      const next = await askAgent(ctx, answer);
      if (ctx.signal.aborted) return;
      if (!next) { await ctx.finish({ title: T(ctx, 'title'), subtitle: patient, message: T(ctx, 'noReply'), tone: 'error' }, T(ctx, 'noReply')); return; }
      reply = next;
    }
    await ctx.finish(replyCard(ctx, reply, patient), [reply.speech, ...reply.problems].filter(Boolean).join('. ') || T(ctx, 'done'));
  },
});
