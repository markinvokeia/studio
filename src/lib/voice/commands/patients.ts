import { parseNavigation } from '@/lib/voice/commands/navigation';
import { normalizeSpeech, parseChoice } from '@/lib/voice/parse';
import { answerPatientInfo, needsFor, parsePatientInfo, type PatientInfoTopic } from '@/lib/voice/patient-info';
import { registerVoiceCommand, registerVoiceDomain } from '@/lib/voice/registry';
import { getVoiceBridge } from '@/lib/voice/screen-bridge';
import { loadPatientFacts } from '@/services/patient-facts';

import type { PatientsVoiceBridge, VoiceCommandContext } from '@/lib/types';

/**
 * Pacientes por voz (src/app/[locale]/patients/page.tsx): buscar y abrir («buscá a Juan», «abrí el
 * segundo», «abrí la ficha de Ana Gómez»), filtrar (deudores, activos, de hoy/semana/mes), nuevo
 * paciente; en la ficha: pestañas (datos, historia clínica, finanzas), acciones (editar, cita,
 * presupuesto, factura, prepago, cobro rápido, sesión, estética, perio, odontograma, documento,
 * indicaciones, receta, imprimir el estado de cuenta, alta) y preguntas («¿cuánto debe?», «¿cuándo
 * vino por última vez?», «resumen»). Los formularios que se abren se llenan con la voz genérica.
 */

export const PATIENTS_VOICE_DOMAIN = 'patients';
registerVoiceDomain({ id: PATIENTS_VOICE_DOMAIN, notUnderstoodKey: 'VoiceCommands.patients.notUnderstood' });

const page = () => getVoiceBridge<PatientsVoiceBridge>('patients');
const T = (ctx: VoiceCommandContext, key: string, values?: Record<string, string | number>) => ctx.t(`VoiceCommands.patients.${key}`, values);
async function say(ctx: VoiceCommandContext, message: string, tone: 'success' | 'info' | 'error' = 'success', rows?: Array<{ label: string; value: string }>) {
  await ctx.finish({ title: T(ctx, 'title'), message, tone, rows }, message);
}
const settle = (ms = 80) => new Promise((r) => setTimeout(r, ms));
const clean = (n: string) => n.replace(/\b(?:por favor|please|che)\b/g, ' ').replace(/\s+/g, ' ').trim();
/** El nombre como se dijo (mayúsculas, tildes), si está al final de la frase. */
function asSaid(raw: string, query: string): string {
  const tokens = raw.trim().split(/\s+/);
  const tail = tokens.slice(-query.split(' ').length).join(' ').replace(/[.,;:!?]+$/, '');
  return normalizeSpeech(tail) === query ? tail : query;
}

/**
 * Espera a que la lista se actualice y termine de cargar. La búsqueda espera a que se deje de
 * escribir antes de pedir (hasta ~0,6 s): hasta que la lista cambie o empiece a cargar, lo que se ve
 * todavía es lo de antes.
 */
async function loaded(ctx: VoiceCommandContext): Promise<PatientsVoiceBridge | null> {
  const start = Date.now();
  const before = page()?.rows;
  await settle(120);
  let p = page();
  while (p && !p.loading && p.rows === before && Date.now() - start < 700 && !ctx.signal.aborted) { await settle(50); p = page(); }
  while (p?.loading && Date.now() - start < 6000 && !ctx.signal.aborted) { await settle(); p = page(); }
  return p;
}

/** Busca en la lista y abre la ficha; si hay varios pregunta cuál. Devuelve el elegido. */
async function findAndOpen(ctx: VoiceCommandContext, query: string): Promise<{ id: string; name: string } | null> {
  let p = page();
  if (!p) return null;
  // ¿Ya está en la lista que se ve?
  const words = normalizeSpeech(query).split(' ').filter((w) => w.length > 1);
  const matches = (rows: PatientsVoiceBridge['rows']) => rows.filter((r) => { const n = normalizeSpeech(`${r.name} ${r.document}`); return words.every((w) => n.includes(w)); });
  let found = matches(p.rows);
  if (!found.length) {
    ctx.show({ title: T(ctx, 'title'), message: T(ctx, 'searching', { name: query }), tone: 'info' });
    p.search(query);
    p = await loaded(ctx);
    if (!p) return null;
    found = matches(p.rows);
    if (!found.length) found = p.rows;
  }
  if (!found.length) { await say(ctx, T(ctx, 'notFound', { name: query }), 'info'); return null; }
  let pick = found[0];
  if (found.length > 1) {
    const question = T(ctx, 'which');
    const index = await ctx.choose({ title: T(ctx, 'title'), message: question, tone: 'info', choices: found.slice(0, 8).map((r) => ({ label: r.name, detail: r.document || r.phone || undefined })) }, `${question} ${found.slice(0, 5).map((r, i) => `${i + 1}: ${r.name}`).join('. ')}.`);
    pick = found[index];
  }
  page()?.select(pick.id);
  await settle();
  return { id: pick.id, name: pick.name };
}

// ── Lista: buscar, abrir, filtrar, nuevo ──────────────────────────────────────

type ListParsed =
  | { op: 'search'; query: string }
  | { op: 'open'; query: string | null; position: string | null }
  | { op: 'debtors'; on: boolean }
  | { op: 'active'; on: boolean }
  | { op: 'date'; preset: 'today' | 'week' | 'month' | 'allTime' }
  | { op: 'all' }
  | { op: 'refresh' }
  | { op: 'create' }
  | { op: 'count' };

export function parsePatientsList(normalized: string): ListParsed | null {
  const t = clean(normalized);
  if (/^(?:actualiza\w*|recarga\w*|refresca\w*|refresh|reload)(?: la lista| los pacientes| the list)?$/.test(t)) return { op: 'refresh' };
  if (/^(?:nuevo paciente|(?:agrega\w*|crea\w*|da\w* de alta|carga\w*|registra\w*|ingresa\w*|anota\w*) (?:un |una |a )?(?:nuevo |nueva )?paciente|(?:new|add|create|register) (?:a )?(?:new )?patient)$/.test(t)) return { op: 'create' };
  if (/^(?:cuantos pacientes (?:hay|tengo|tenemos|son)|how many patients(?: are there| do we have)?)$/.test(t)) return { op: 'count' };
  if (/^(?:(?:mostra\w*|ver|filtra\w*|solo|show(?: me)?|only)\s+)*(?:los |the )?(?:deudores|morosos|que (?:deben|tienen deuda)|con deuda|debtors|(?:patients )?(?:who|that) owe(?: money)?|with debt)$/.test(t)) return { op: 'debtors', on: true };
  if (/^(?:saca\w*|quita\w*|sin) (?:el filtro de )?(?:los )?deudores$|^(?:remove|clear) (?:the )?debtors(?: filter)?$/.test(t)) return { op: 'debtors', on: false };
  if (/^(?:(?:mostra\w*|inclui\w*|ver|show|include)\s+)?(?:tambien |also )?(?:los |the )?inactivos(?: tambien)?$|^(?:include|show) inactive(?: patients)?(?: too)?$/.test(t)) return { op: 'active', on: false };
  if (/^(?:solo |only )(?:los |the )?(?:activos|active(?: patients)?)$/.test(t)) return { op: 'active', on: true };
  if (/^(?:(?:mostra\w*|ver|show(?: me)?)\s+)?(?:todos(?: los pacientes)?|sin filtros|saca\w* (?:los )?filtros|all(?: patients)?|clear (?:the )?filters)$/.test(t)) return { op: 'all' };
  const date = t.match(/^(?:(?:mostra\w*|ver|show(?: me)?)\s+)?(?:los (?:pacientes )?(?:de|registrados|nuevos de)|patients (?:from|registered))\s+(hoy|esta semana|este mes|today|this week|this month)$/);
  if (date) return { op: 'date', preset: /hoy|today/.test(date[1]) ? 'today' : /semana|week/.test(date[1]) ? 'week' : 'month' };
  const search = t.match(/^(?:busca\w*|buscar|encontra\w*|search(?: for)?|find|look (?:for|up))\s+(?:(?:a|al|el|la|the)\s+)?(?:paciente\s+|patient\s+)?(.+)$/);
  if (search && !/^(?:huecos?|turnos?|citas?|slots?)\b/.test(search[1])) return { op: 'search', query: search[1] };
  const open = t.match(/^(?:abri\w*|abre|mostra\w*|muestra\w*|selecciona\w*|elegi\w*|entra\w* (?:a|en)|open|select|show(?: me)?)\s+(?:(?:la ficha|el paciente|la paciente|el registro|los datos|the (?:patient|record|file))\s+)?(?:(?:de|del|of)\s+)?(?:(?:el|la|the)\s+)?(.+)$/);
  if (open) {
    const what = open[1].trim();
    const pos = what.match(/^(primer[oa]?|segund[oa]|tercer[oa]?|cuart[oa]|quint[oa]|ultim[oa]|penultim[oa]|first|second|third|fourth|fifth|last)(?: one| paciente| patient)?$/);
    if (pos) return { op: 'open', query: null, position: pos[1] };
    if (/^(?:ficha|paciente|patient|record)$/.test(what)) return null;
    // «open John Smith record» (el posesivo ya se fue): el nombre sin la palabra del final.
    return { op: 'open', query: what.replace(/\s+(?:record|file|chart|details|profile)$/, ''), position: null };
  }
  return null;
}

registerVoiceCommand<ListParsed>({
  id: 'patients.list',
  domain: PATIENTS_VOICE_DOMAIN,
  priority: 56,
  match: (normalized, raw) => {
    if (!page()) return null;
    const p = parsePatientsList(normalized);
    if (p?.op === 'search') return { ...p, query: asSaid(raw, p.query) };
    if (p?.op === 'open' && p.query) {
      // «abrí la caja», «abrí el centro de alertas»: es un lugar del menú, no un paciente.
      if (parseNavigation(normalized, raw)) return null;
      // «abrí la historia clínica» con una ficha abierta es la pestaña (lo toma patients.detail).
      if (page()!.selected && TAB_OF(p.query)) return null;
      if (ACTION_OF(p.query)) return null;
      return { ...p, query: asSaid(raw, p.query) };
    }
    return p;
  },
  run: async (parsed, ctx) => {
    const p = page();
    if (!p) return;
    switch (parsed.op) {
      case 'refresh': p.refresh(); await say(ctx, T(ctx, 'refreshed')); return;
      case 'count': await say(ctx, T(ctx, 'count', { count: p.total }), 'info'); return;
      case 'create':
        if (!p.create) { await say(ctx, ctx.t('VoiceCommands.noPermission'), 'error'); return; }
        p.create();
        await say(ctx, T(ctx, 'creating'));
        return;
      case 'debtors':
        if (!p.setDebtors) { await say(ctx, ctx.t('VoiceCommands.noPermission'), 'error'); return; }
        p.setDebtors(parsed.on);
        await say(ctx, T(ctx, parsed.on ? 'debtorsOn' : 'debtorsOff'));
        return;
      case 'active': p.setActive(parsed.on); await say(ctx, T(ctx, parsed.on ? 'activeOnly' : 'withInactive')); return;
      case 'date': p.setDatePreset(parsed.preset); await say(ctx, T(ctx, `date_${parsed.preset}`)); return;
      case 'all': p.clearFilters(); await say(ctx, T(ctx, 'allShown')); return;
      case 'search': {
        p.search(parsed.query);
        const after = await loaded(ctx);
        if (!after) return;
        if (!after.rows.length) { await say(ctx, T(ctx, 'notFound', { name: parsed.query }), 'info'); return; }
        if (after.rows.length === 1) { after.select(after.rows[0].id); await say(ctx, T(ctx, 'opened', { name: after.rows[0].name })); return; }
        await say(ctx, T(ctx, 'found', { count: after.total || after.rows.length }), 'info', after.rows.slice(0, 8).map((r) => ({ label: r.name, value: r.document || r.phone })));
        return;
      }
      case 'open': {
        if (parsed.position) {
          const i = parseChoice(parsed.position, p.rows.length);
          if (i === null || !p.rows[i]) { await say(ctx, T(ctx, 'noRows'), 'info'); return; }
          p.select(p.rows[i].id);
          await say(ctx, T(ctx, 'opened', { name: p.rows[i].name }));
          return;
        }
        const chosen = await findAndOpen(ctx, parsed.query!);
        if (chosen) await say(ctx, T(ctx, 'opened', { name: chosen.name }));
      }
    }
  },
});

// ── La ficha: pestañas y acciones ─────────────────────────────────────────────

type Tab = PatientsVoiceBridge['tab'];
type ActionKey = keyof PatientsVoiceBridge['actions'];
const TABS: Array<[RegExp, Tab]> = [
  [/^(?:(?:la )?historia(?: clinica)?|(?:lo )?clinico|(?:las )?sesiones|(?:los )?tratamientos|(?:los )?documentos|(?:las )?citas|clinical(?: history)?|history|sessions|treatments|documents|appointments)$/, 'clinical'],
  [/^(?:(?:las )?finanzas|(?:lo )?financiero|(?:la )?cuenta|(?:el )?estado de cuenta|(?:la )?cuenta corriente|(?:las )?facturas|(?:los )?pagos|(?:los )?presupuestos|(?:la )?plata|financial|finances|account|invoices|payments|quotes|billing)$/, 'financial'],
  [/^(?:(?:los )?datos|(?:la )?informacion|(?:la )?info|(?:los )?datos personales|(?:las )?notas|(?:los )?dependientes|(?:las )?preferencias|info|information|details|personal (?:info|details)|notes|dependents|preferences)$/, 'info'],
];
const TAB_OF = (what: string): Tab | null => TABS.find(([re]) => re.test(what.replace(/^(?:la |el |the )?(?:pestana|tab|solapa)\s+(?:de\s+)?/, '').trim()))?.[1] ?? null;

const ACTIONS: Array<[RegExp, ActionKey]> = [
  [/\b(?:periodontograma|perio|sondaje|periodontal(?: chart)?)\b/, 'perio'],
  [/\b(?:sesion estetica|estetica|aesthetic(?: session)?)\b/, 'aesthetic'],
  [/\b(?:odontograma|odontogram|dental chart)\b/, 'odontogram'],
  [/\b(?:indicaciones|instrucciones(?: medicas)?|medical instructions?|instructions)\b/, 'instruction'],
  [/\b(?:receta|recetale|prescrib\w*|prescription)\b/, 'prescription'],
  [/\b(?:documento|consentimiento|document|consent)\b/, 'document'],
  [/\b(?:(?:nueva |una |la )?sesion(?: clinica)?|evolucion|clinical session|new session|session)\b/, 'session'],
  [/\b(?:cobro rapido|cobra\w*|quick bill|charge)\b/, 'bill'],
  [/\b(?:prepago|anticipo|pago adelantado|sena|prepaid|prepayment|advance payment|deposit)\b/, 'prepaid'],
  [/\b(?:presupuesto|cotizacion|quote|estimate)\b/, 'quote'],
  [/\b(?:factura|facturale|invoice)\b/, 'invoice'],
  [/\b(?:(?:nueva |una )?cita|turno|agenda\w*le|agendalo|agendala|dale (?:una )?cita|appointment|book)\b/, 'appointment'],
  [/\b(?:imprimi\w* (?:el )?(?:resumen|estado de cuenta)|imprimir (?:el )?(?:resumen|estado de cuenta)|print (?:the )?(?:summary|statement))\b/, 'printSummary'],
  [/\b(?:da\w* (?:el |de )?alta(?: medica)?|alta medica|discharge)\b/, 'discharge'],
  [/\b(?:edita\w*|modifica\w*|cambia\w* (?:los )?datos|edit|modify)\b/, 'edit'],
];
const ACTION_OF = (what: string): ActionKey | null => ACTIONS.find(([re]) => re.test(what))?.[1] ?? null;
const ACTION_VERB = /^(?:(?:edita\w*|modifica\w*|cambia\w*|abri\w*|abre|hace\w*|haz|haceme|hacele|crea\w*|empeza\w*|inicia\w*|nuevas?|nuevos?|registra\w*|carga\w*|genera\w*|arma\w*|da\w*|dale|quiero|necesito|imprimi\w*|open|make|create|start|new|record|give|print|do|edit|book|write)\s+)/;

type DetailParsed = { op: 'tab'; tab: Tab } | { op: 'close' } | { op: 'action'; action: ActionKey; patient: string | null };

export function parsePatientsDetail(normalized: string): DetailParsed | null {
  const t = clean(normalized);
  if (/^(?:cerra\w* la ficha|volve\w* a la lista|(?:a )?la lista|close (?:the )?(?:record|file|patient)|back to (?:the )?list)$/.test(t)) return { op: 'close' };
  const tab = t.match(/^(?:(?:abri\w*|abre|mostra\w*|muestra\w*|ver|ve|anda\w* a|ir a|pasa\w* a|vamos a|open|show(?: me)?|go to|switch to)\s+)?(.+)$/);
  if (tab) { const which = TAB_OF(tab[1]); if (which && (t !== tab[1] || /pestana|tab|solapa/.test(t) || TABS.some(([re]) => re.test(t)))) return { op: 'tab', tab: which }; }
  const found = ACTIONS.map(([re, key]) => ({ key, m: t.match(re) })).find((x) => x.m);
  const action = found?.key ?? null;
  if (!action) return null;
  const actionEnd = (found!.m!.index ?? 0) + found!.m![0].length;
  if (!ACTION_VERB.test(t) && !/^(?:(?:un|una|la|el|the|a|an)\s+)?(?:nueva |nuevo |new )?(?:presupuesto|factura|cita|turno|sesion|receta|odontograma|periodontograma|cobro rapido|prepago|documento|indicaciones|cobrale|recetale|facturale|quote|invoice|appointment|session|prescription|odontogram)\b/.test(t)) return null;
  // El paciente va después de la acción («nueva sesión para Juan»), no dentro («estado de cuenta»).
  const who = t.slice(actionEnd).match(/\b(?:para|a|de|del|for|to|of)\s+(?!la\b|el\b|las\b|los\b|un\b|una\b|the\b)([a-z][a-z ]{2,40})$/);
  const patient = who && !ACTION_OF(who[1]) && !/^(?:hoy|manana|today|tomorrow)$/.test(who[1]) ? who[1].trim() : null;
  return { op: 'action', action, patient };
}

registerVoiceCommand<DetailParsed>({
  id: 'patients.detail',
  domain: PATIENTS_VOICE_DOMAIN,
  priority: 57,
  match: (normalized, raw) => {
    const p = page();
    if (!p) return null;
    const parsed = parsePatientsDetail(normalized);
    if (!parsed) return null;
    if (parsed.op !== 'action' && !p.selected) return null;
    if (parsed.op === 'action' && parsed.patient) return { ...parsed, patient: asSaid(raw, parsed.patient) };
    return parsed;
  },
  run: async (parsed, ctx) => {
    let p = page();
    if (!p) return;
    if (parsed.op === 'close') { p.closeDetail(); await say(ctx, T(ctx, 'closed')); return; }
    if (parsed.op === 'tab') { p.setTab(parsed.tab); await say(ctx, T(ctx, `tab_${parsed.tab}`)); return; }
    if (parsed.patient && normalizeSpeech(p.selected?.name ?? '') !== normalizeSpeech(parsed.patient)) {
      const chosen = await findAndOpen(ctx, parsed.patient);
      if (!chosen) return;
      p = page();
      if (!p) return;
    }
    if (!p.selected) { await say(ctx, T(ctx, 'pickFirst'), 'info'); return; }
    const run = p.actions[parsed.action];
    if (!run) { await say(ctx, ctx.t('VoiceCommands.noPermission'), 'error'); return; }
    run();
    await say(ctx, T(ctx, `did_${parsed.action}`, { name: p.selected.name }));
  },
});

// ── Preguntas sobre el paciente ───────────────────────────────────────────────

registerVoiceCommand<{ topics: PatientInfoTopic[]; patient: string | null }>({
  id: 'patients.info',
  domain: PATIENTS_VOICE_DOMAIN,
  priority: 58,
  aux: true,
  match: (normalized, raw) => {
    if (!page()) return null;
    // Una pestaña o una acción de la ficha («la pestaña de facturas», «imprimí el estado de cuenta») no es una pregunta.
    if (parsePatientsDetail(normalized)) return null;
    const parsed = parsePatientInfo(normalized);
    if (!parsed) return null;
    return { topics: parsed.topics, patient: parsed.patient ? asSaid(raw, parsed.patient) : null };
  },
  run: async (parsed, ctx) => {
    let p = page();
    if (!p) return;
    let patient = p.selected;
    if (parsed.patient && normalizeSpeech(patient?.name ?? '') !== normalizeSpeech(parsed.patient)) {
      patient = await findAndOpen(ctx, parsed.patient);
      p = page();
    }
    if (!patient) {
      const question = T(ctx, 'whichPatient');
      const answer = (await ctx.ask({ title: T(ctx, 'title'), message: question, tone: 'info' }, question)).trim();
      if (!answer) return;
      patient = await findAndOpen(ctx, answer);
      if (!patient) return;
    }
    ctx.show({ title: T(ctx, 'title'), message: T(ctx, 'looking', { name: patient.name }), tone: 'info' });
    try {
      const facts = await (page()?.getFacts ?? loadPatientFacts)(patient, needsFor(parsed.topics));
      const answer = answerPatientInfo(parsed.topics, facts, ctx.t, ctx.locale);
      await ctx.finish({ title: patient.name, message: answer.speech, tone: 'info', rows: answer.rows }, answer.speech);
    } catch (error) {
      if (ctx.signal.aborted) throw error;
      await say(ctx, ctx.t('VoiceCommands.genericError'), 'error');
    }
  },
});
