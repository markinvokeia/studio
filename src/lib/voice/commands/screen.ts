import { CORE_VOICE_DOMAIN } from '@/lib/voice/commands/core';
import { controlsOf, createButtons, fillField, findControl, isScreenLoading, openListSearchBox, openOptions, readSurface, typeInto, uiKey, waitForOptions, type UiControl, type UiSurface } from '@/lib/voice/dom-ui';
import { normalizeSpeech, parseChoiceDetailed } from '@/lib/voice/parse';
import { registerVoiceCommand } from '@/lib/voice/registry';
import { listVoiceBridges } from '@/lib/voice/screen-bridge';

import type { VoiceCommandContext } from '@/lib/types';

/**
 * Manejar con la voz cualquier pantalla, aunque no tenga voz propia: lo que se ve se puede tocar.
 * Todo es local (sin IA) y va al final de la fila: si la pantalla tiene un comando propio para lo
 * dicho, gana ese. Con una ventana o panel abierto, se trabaja sobre lo abierto.
 *
 *   «tocá Nuevo paciente», «guardar», «la pestaña pagos», «click Save»
 *   «poné 500 en monto», «el teléfono es 099…», «type John in name»
 *   «activá descuento», «desmarcá enviar por mail», «turn on reminders»
 *   «elegí efectivo en método de pago», «método de pago: tarjeta», «set currency to USD»
 *   «buscá Juan», «search for invoice 120»
 *   «abrí el segundo», «abrí el de Juan Pérez», «open the last one»
 *   «qué puedo hacer acá», «what can I do here»
 */

type Parsed =
  | { op: 'press'; control: UiControl }
  | { op: 'fill'; control: UiControl; value: string | null }
  | { op: 'toggle'; control: UiControl; on: boolean }
  | { op: 'select'; control: UiControl; option: string | null }
  | { op: 'search'; control: UiControl; value: string }
  | { op: 'row'; rows: UiControl[]; index: number | null; ambiguous: number[] | null }
  | { op: 'help' };

const PRESS_RE = /^(?:apreta\w*|apretar|toca\w*|tocar|presiona\w*|pulsa\w*|clic(?:k)?ea\w*|hace\w* (?:clic|click) (?:en|sobre)|haz (?:clic|click) (?:en|sobre)|dale (?:clic |click )?(?:a|al|en)|click(?: on)?|press|tap(?: on)?|hit|push)\s+(?:(?:en|a|al|el|la|on|the)\s+)*(?:(?:boton|button)\s+(?:de\s+)?)?(.+)$/;
const TAB_RE = /^(?:(?:abri\w*|anda\w*|ve|ir|pasa\w*|cambia\w*|mostra\w*|muestra\w*|go|open|switch|show(?: me)?)\s+(?:(?:a|al|en|to)\s+)?)?(?:(?:la|el|the)\s+)?(?:pestana|solapa|tab)\s+(?:(?:de|del|of)\s+)?(?:(?:la|el|los|las|the)\s+)?(.+)$|^(?:(?:go to|open|switch to|show(?: me)?)\s+)?(?:the\s+)?(.+?)\s+tab$/;
const FILL_VERB = /^(?:pone\w*|pon|escribi\w*|escribe|completa\w*|llena\w*|carga\w*|ingresa\w*|anota\w*|tipea\w*|set|type|write|fill(?: in)?|enter|put)\s+/;
const ON_RE = /^(?:activa\w*|activar|prende\w*|prender|encende\w*|enciende|habilita\w*|marca\w*|tilda\w*|turn on|switch on|enable|check|tick)\s+(.+)$/;
const OFF_RE = /^(?:desactiva\w*|desactivar|apaga\w*|apagar|deshabilita\w*|desmarca\w*|destilda\w*|saca\w* (?:el )?tilde (?:de|a)|turn off|switch off|disable|uncheck|untick)\s+(.+)$/;
const SELECT_VERB = /^(?:elegi\w*|elige|selecciona\w*|escoge\w*|pone\w*|pon|cambia\w*|choose|select|pick|set|change)\s+/;
const SEARCH_RE = /^(?:busca\w*|buscar|filtra\w*|search(?: for)?|find|look (?:for|up))\s+(?:(?:a|al|por|for|the)\s+)?(.+)$/;
const ROW_VERB = /^(?:abri\w*|abre|abrir|mostra\w*|muestra\w*|selecciona\w*|elegi\w*|entra\w*(?: a| en)?|anda\w* a|ve a|ir a|open|select|show(?: me)?|pick|go to)\s+/;
const HELP_RE = /^(?:que (?:puedo|se puede|podemos) hacer(?: aca| aqui| aca adentro| en esta pantalla| en esta ventana)?|que hay (?:aca|aqui|en esta pantalla|en esta ventana)|que botones hay|que opciones (?:hay|tengo)|que puedo tocar|what can i do(?: here)?|what is on (?:this|the) screen|what buttons are there|what are my options|what can i press)$/;

const strip = (s: string) => s.replace(/^(?:(?:el|la|los|las|lo|un|una|the|a|an)\s+)+/, '').trim();

/** El texto original que corresponde a las últimas `words` palabras normalizadas. */
function rawTail(raw: string, normalized: string, tail: string): string {
  const want = tail.split(' ').length;
  const tokens = raw.trim().split(/\s+/);
  for (let i = tokens.length - 1; i >= 0; i--) {
    const piece = tokens.slice(i).join(' ');
    if (normalizeSpeech(piece).split(' ').length >= want && normalizeSpeech(piece) === tail) return piece.replace(/^[:,\s]+/, '');
  }
  return tail;
}

/** Lo que está entre el verbo y « en <campo>» en el texto original («poné Ana López en nombre»). */
function rawMiddle(raw: string, value: string): string {
  const tokens = raw.trim().split(/\s+/);
  const want = value.split(' ');
  for (let i = 0; i + want.length <= tokens.length; i++) {
    const piece = tokens.slice(i, i + want.length).join(' ');
    if (normalizeSpeech(piece) === value) return piece;
  }
  return value;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function parseFill(normalized: string, raw: string, fields: UiControl[]): Parsed | null {
  const verb = normalized.match(FILL_VERB);
  const body = verb ? normalized.slice(verb[0].length) : normalized;
  let best: { control: UiControl; value: string | null; len: number } | null = null;
  for (const control of fields) {
    const label = normalizeSpeech(control.label);
    if (!label) continue;
    const l = escape(label);
    // «el teléfono es 099…», «teléfono: 099…», «poné en teléfono 099…», «poné el teléfono» (sin valor).
    const lead = body.match(new RegExp(`^(?:(?:en|in|el campo|the field|el|la|los|las|the|my|mi|su)\\s+)*${l}(?:\\s(es|son|sea|a|con|is|are|to|with|as|como))?(?:\\s(.*))?$`));
    if (lead && (verb || /^(?:es|son|is|are)$/.test(lead[1] ?? '') || raw.includes(':'))) {
      const tail = (lead[2] ?? '').trim();
      const value = tail ? rawTail(raw, normalized, tail) : null;
      if (!best || label.length > best.len) best = { control, value: value && value.replace(/^(?:es|son|is|are)\s+/i, ''), len: label.length };
      continue;
    }
    // «poné Ana López en nombre», «type John in name».
    const mid = verb ? body.match(new RegExp(`^(.+?)\\s(?:en|in|into|como|as|para|for)\\s(?:(?:el|la|los|las|the|el campo|the field)\\s)*${l}$`)) : null;
    if (mid && (!best || label.length > best.len)) best = { control, value: rawMiddle(raw, mid[1]), len: label.length };
  }
  return best ? { op: 'fill', control: best.control, value: best.value } : null;
}

function parseSelect(normalized: string, selects: UiControl[]): Parsed | null {
  const verb = normalized.match(SELECT_VERB);
  const body = verb ? normalized.slice(verb[0].length) : normalized;
  for (const control of selects) {
    const label = normalizeSpeech(control.label);
    if (!label) continue;
    const l = escape(label);
    // «elegí efectivo en método de pago», «set USD as currency».
    const mid = verb ? body.match(new RegExp(`^(.+?)\\s(?:en|como|para|de|in|as|for)\\s(?:(?:el|la|the)\\s)?${l}$`)) : null;
    if (mid) return { op: 'select', control, option: strip(mid[1]) };
    // «método de pago efectivo», «método de pago: tarjeta», «cambiá la moneda a dólares», «set currency to USD».
    const lead = body.match(new RegExp(`^(?:(?:el|la|the)\\s)?${l}(?:\\s(?:a|en|es|por|to|is|as))?(?:\\s(.+))?$`));
    if (lead && (verb || lead[1])) return { op: 'select', control, option: lead[1] ? strip(lead[1]) : null };
  }
  return null;
}

function parseRow(normalized: string, rows: UiControl[]): Parsed | null {
  if (!rows.length) return null;
  const verb = normalized.match(ROW_VERB);
  const body = strip(verb ? normalized.slice(verb[0].length) : normalized);
  // «el de Juan Pérez», «la del 120», «John's», «the one for John».
  const named = body.match(/^(?:(?:el|la|lo)\s+)?(?:de|del|de la|for|of|the one for|the one of)\s+(.+)$/);
  const position = /^(?:(?:el|la|lo)\s+)?(?:primer[oa]?|segund[oa]|tercer[oa]?|cuart[oa]|quint[oa]|sext[oa]|ultim[oa]|penultim[oa]|first|second|third|fourth|fifth|sixth|last|second to last|(?:fila|row|numero|number|item)\s+\d+|\d+)(?:\s+(?:fila|row|one|de la lista|of the list|de la tabla))?$/.test(body);
  if (!named && !position) return null;
  if (!verb && named) return null;
  const labels = rows.map((r) => r.label);
  const found = parseChoiceDetailed(named ? named[1] : body.replace(/^(?:fila|row|numero|number|item)\s+/, ''), rows.length, named ? labels : []);
  if (!found) {
    if (named) {
      const key = uiKey(named[1]);
      const hits = rows.map((r, i) => ({ i, ok: key.split(' ').every((w) => r.key.split(' ').includes(w)) })).filter((h) => h.ok).map((h) => h.i);
      if (hits.length === 1) return { op: 'row', rows, index: hits[0], ambiguous: null };
      if (hits.length > 1) return { op: 'row', rows, index: null, ambiguous: hits };
    }
    return null;
  }
  return 'index' in found ? { op: 'row', rows, index: found.index, ambiguous: null } : { op: 'row', rows, index: null, ambiguous: found.ambiguous };
}

/** Qué se pide de la pantalla, o null (no es para esto). */
export function parseScreen(normalized: string, raw: string, surface: UiSurface | null = readSurface()): Parsed | null {
  if (!surface || !normalized) return null;
  if (HELP_RE.test(normalized)) return { op: 'help' };
  const pressables = controlsOf(surface, 'button', 'tab', 'link');

  const tab = normalized.match(TAB_RE);
  if (tab) {
    const control = findControl(tab[1] ?? tab[2], controlsOf(surface, 'tab'), true);
    if (control) return { op: 'press', control };
  }
  const press = normalized.match(PRESS_RE);
  if (press) {
    const control = findControl(press[1], pressables, true) ?? findControl(press[1], controlsOf(surface, 'toggle'), true);
    if (control) return control.kind === 'toggle' ? { op: 'toggle', control, on: !control.checked } : { op: 'press', control };
  }
  const on = normalized.match(ON_RE);
  const off = normalized.match(OFF_RE);
  if (on || off) {
    const control = findControl((on ?? off)![1], controlsOf(surface, 'toggle'), true);
    if (control) return { op: 'toggle', control, on: !!on };
  }
  const select = parseSelect(normalized, controlsOf(surface, 'select'));
  // Lo elegido como se dijo (mayúsculas y tildes): en un selector con búsqueda se escribe tal cual.
  if (select) return select.op === 'select' && select.option ? { ...select, option: rawMiddle(raw, select.option) } : select;
  const fill = parseFill(normalized, raw, controlsOf(surface, 'field', 'search'));
  if (fill) return fill;
  const search = normalized.match(SEARCH_RE);
  if (search) {
    const control = controlsOf(surface, 'search')[0];
    if (control) return { op: 'search', control, value: rawTail(raw, normalized, search[1]) };
  }
  const row = parseRow(normalized, controlsOf(surface, 'row'));
  if (row) return row;
  // El texto de un botón o pestaña dicho tal cual («guardar», «nuevo paciente», «siguiente»).
  const exact = findControl(normalized, pressables);
  if (exact) return { op: 'press', control: exact };
  // «nuevo», «crear», «agregar» sueltos: el botón de alta de la pantalla («Nueva sede», «Agregar etapa»).
  if (/^(?:nuev[oa]|crea\w*|crear|agrega\w*|agregar|anad\w*|new|create|add)(?:\s+(?:uno|una|otro|otra|one|another))?$/.test(normalized)) {
    const create = createButtons(surface);
    if (create.length === 1) return { op: 'press', control: create[0] };
  }
  return null;
}

const title = (ctx: VoiceCommandContext) => ctx.t('VoiceCommands.ui.title');

async function done(ctx: VoiceCommandContext, message: string, speech = message) {
  await ctx.finish({ title: title(ctx), message, tone: 'success' }, speech);
}

async function runScreen(parsed: Parsed, ctx: VoiceCommandContext) {
  const { t } = ctx;
  switch (parsed.op) {
    case 'press': {
      parsed.control.element.click();
      const key = parsed.control.kind === 'tab' ? 'VoiceCommands.ui.tabOpened' : 'VoiceCommands.dialogPressed';
      await done(ctx, t(key, { label: parsed.control.label }));
      return;
    }
    case 'toggle': {
      const { control, on } = parsed;
      if (!!control.checked === on) {
        const message = t(on ? 'VoiceCommands.ui.alreadyOn' : 'VoiceCommands.ui.alreadyOff', { label: control.label });
        await ctx.finish({ title: title(ctx), message, tone: 'info' }, message);
        return;
      }
      control.element.click();
      await done(ctx, t(on ? 'VoiceCommands.ui.toggledOn' : 'VoiceCommands.ui.toggledOff', { label: control.label }));
      return;
    }
    case 'fill': {
      let value = parsed.value;
      if (!value) {
        const question = t('VoiceCommands.ui.askValue', { field: parsed.control.label });
        value = (await ctx.ask({ title: title(ctx), message: question, tone: 'info' }, question)).trim();
      }
      if (!value) return;
      parsed.control.element.focus?.();
      await fillField(parsed.control.element, value, ctx.signal);
      await done(ctx, t('VoiceCommands.fieldFilled', { field: parsed.control.label, value }));
      return;
    }
    case 'search': {
      typeInto(parsed.control.element, parsed.value);
      await done(ctx, t('VoiceCommands.ui.searched', { text: parsed.value }));
      return;
    }
    case 'select': {
      const { control } = parsed;
      control.element.click();
      let options = await waitForOptions(ctx.signal);
      // Selector con búsqueda (paciente, sede, doctor…): lo dicho se escribe en su caja y se elige de lo que sale.
      const box = openListSearchBox();
      let wanted = parsed.option;
      if (box && !wanted) {
        const question = t('VoiceCommands.ui.whatToSearch', { field: control.label });
        wanted = (await ctx.ask({ title: title(ctx), message: question, tone: 'info' }, question)).trim() || null;
        if (!wanted) return;
      }
      if (box && wanted) {
        const before = options.map((o) => o.label).join('|');
        typeInto(box, wanted);
        const start = Date.now();
        while (Date.now() - start < 2500 && !ctx.signal.aborted) {
          await new Promise((r) => setTimeout(r, 120));
          const now = openOptions();
          if (now.map((o) => o.label).join('|') !== before || (Date.now() - start > 600 && now.length)) { options = now; if (!isScreenLoading()) break; }
        }
        options = openOptions();
      }
      if (!options.length) {
        const message = t('VoiceCommands.ui.noOptions', { field: control.label });
        await ctx.finish({ title: title(ctx), message, tone: 'info' }, message);
        return;
      }
      let option: UiControl | null = null;
      if (wanted) {
        // Los que tienen todas las palabras dichas: uno solo es ese; varios (y ninguno exacto), se pregunta entre esos.
        const said = normalizeSpeech(wanted).split(' ').filter(Boolean);
        const exact = options.find((o) => normalizeSpeech(o.label) === normalizeSpeech(wanted!));
        const hits = options.filter((o) => { const l = normalizeSpeech(o.label); return said.every((w) => l.includes(w)); });
        if (exact) option = exact;
        else if (hits.length === 1) option = hits[0];
        else if (hits.length > 1) {
          const question = t('VoiceCommands.ui.whichOption', { field: control.label });
          const index = await ctx.choose({ title: title(ctx), message: question, tone: 'info', choices: hits.slice(0, 8).map((o) => ({ label: o.label })) }, `${question} ${hits.slice(0, 5).map((o, i) => `${i + 1}: ${o.label}`).join('. ')}.`);
          option = hits[index];
        } else option = findControl(wanted, options, true);
      }
      if (wanted && !option) {
        const message = t('VoiceCommands.ui.noOption', { option: wanted, field: control.label });
        // Se deja la lista abierta para elegir con la voz o con el mouse.
        const question = `${message} ${t('VoiceCommands.ui.whichOption', { field: control.label })}`;
        const index = await ctx.choose({ title: title(ctx), message: question, tone: 'info', choices: options.map((o) => ({ label: o.label })) }, `${question} ${options.slice(0, 8).map((o, i) => `${i + 1}: ${o.label}`).join('. ')}.`);
        option = options[index];
      }
      if (!option) {
        const question = t('VoiceCommands.ui.whichOption', { field: control.label });
        const index = await ctx.choose({ title: title(ctx), message: question, tone: 'info', choices: options.map((o) => ({ label: o.label })) }, `${question} ${options.slice(0, 8).map((o, i) => `${i + 1}: ${o.label}`).join('. ')}.`);
        option = options[index];
      }
      option.element.click();
      await done(ctx, t('VoiceCommands.ui.selected', { option: option.label, field: control.label }));
      return;
    }
    case 'row': {
      let index = parsed.index;
      if (index === null) {
        const pool = parsed.ambiguous ?? parsed.rows.map((_, i) => i);
        const question = t('VoiceCommands.ui.whichRow');
        const choice = await ctx.choose(
          { title: title(ctx), message: question, tone: 'info', choices: pool.map((i) => ({ label: parsed.rows[i].label.slice(0, 80) })) },
          `${question} ${pool.slice(0, 6).map((i, n) => `${n + 1}: ${parsed.rows[i].label.slice(0, 60)}`).join('. ')}.`,
        );
        index = pool[choice];
      }
      const row = parsed.rows[index];
      row.element.click();
      await done(ctx, t('VoiceCommands.ui.rowOpened', { label: row.label.slice(0, 80) }), t('VoiceCommands.ui.rowOpenedShort'));
      return;
    }
    case 'help': {
      const surface = readSurface();
      // Lo que sirve decir: sin la paginación («1–5/5»), los créditos del mapa ni textos largos.
      const useful = (c: UiControl) => c.label.length <= 40 && !/^\d+\s*[–-]\s*\d+\s*\/\s*\d+$/.test(c.label) && !/^(?:leaflet|openstreetmap|open calendar)$/i.test(c.label);
      const options = surface ? [...controlsOf(surface, 'tab'), ...controlsOf(surface, 'button', 'link')].filter(useful).filter((c, i, all) => all.findIndex((o) => o.key === c.key) === i).slice(0, 12) : [];
      const tableHint = listVoiceBridges('crud').some(Boolean) ? ` ${t('VoiceCommands.ui.helpTable')}` : '';
      if (!options.length) {
        const message = t('VoiceCommands.ui.helpEmpty');
        await ctx.finish({ title: title(ctx), message, tone: 'info' }, message);
        return;
      }
      const list = options.slice(0, 6).map((o) => o.label).join(', ');
      const question = `${t('VoiceCommands.ui.helpQuestion', { options: list })}${tableHint}`;
      const index = await ctx.choose({ title: title(ctx), message: question, tone: 'info', choices: options.map((o) => ({ label: o.label })), soft: true }, question);
      options[index].element.click();
      await done(ctx, t('VoiceCommands.dialogPressed', { label: options[index].label }));
    }
  }
}

registerVoiceCommand<Parsed>({
  id: 'core.screen',
  domain: CORE_VOICE_DOMAIN,
  // Al final de todo: lo propio de cada pantalla (y navegar, desplazarse) gana.
  priority: -1,
  // Leer la pantalla nunca puede romper la voz (regla de oro): si algo falla, no es para esto.
  match: (normalized, raw) => { try { return parseScreen(normalized, raw); } catch { return null; } },
  run: runScreen,
});
