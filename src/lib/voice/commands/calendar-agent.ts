import { format, parseISO, startOfToday, subYears } from 'date-fns';

import { HOUR_SLOT_HEIGHT, HOUR_SLOT_HEIGHT_OPTIONS } from '@/components/calendar/calendar-constants';
import { getCalendarVoice, waitForCalendar, type CalendarVoicePatient, type CalendarVoiceState } from '@/lib/voice/calendar-bridge';
import { appointmentStart, bestByName, byStart, CALENDAR_VOICE_DOMAIN, nameScore, needCalendar, tc } from '@/lib/voice/commands/calendar';
import {
  parseCalendarExport,
  parseCalendarOptions,
  parseCalendarPanelOp,
  parseCalendarPatientAsk,
  parseCalendarPatientFind,
  parseCalendarSelect,
  parseCalendarSettings,
  parseCalendarZoom,
  readExportDetails,
  readPatientIdentifiers,
  type CalendarExportParsed,
  type CalendarOptionsOf,
  type CalendarPanelOp,
  type CalendarPatientAskParsed,
  type CalendarPatientFindParsed,
  type CalendarSettingParsed,
  type CalendarSettingsParsed,
  type CalendarZoomParsed,
} from '@/lib/voice/commands/calendar-agent-parse';
import { isFormCancel, isFormSave } from '@/lib/voice/commands/calendar-form-parse';
import { appointmentRows, deny, resolveAppointment, runOpenFormSession, whenOf } from '@/lib/voice/commands/calendar-manage';
import { parseTimeKey, type CalendarAppointmentRef } from '@/lib/voice/commands/calendar-parse';
import { answerDialog, closeTopOverlay, hasOpenOverlay, isDialogOpen, openDialogTitle, parseDialogAnswer, type DialogAnswer } from '@/lib/voice/dom-dialog';
import { getAppointmentFocus, setAppointmentFocus } from '@/lib/voice/focus';
import { answerPatientInfo, needsFor, parsePatientAction, parsePatientInfo, type PatientActionParsed, type PatientInfoParsed, type PatientInfoTopic } from '@/lib/voice/patient-info';
import { normalizeSpeech, parseYesNo } from '@/lib/voice/parse';
import { registerVoiceCommand } from '@/lib/voice/registry';

import { DASHBOARD_PERMISSIONS } from '@/constants/permissions';
import type { Appointment, CalendarSettings, CalendarVoiceAiResult, CalendarVoiceView, VoiceCommandContext } from '@/lib/types';

/**
 * Calendario por voz — la barra (zoom, panel de agendas, opciones de vista y agendas, exportar),
 * el engranaje (todas las preferencias), seleccionar una cita (queda en foco), el formulario
 * abierto a mano, los avisos de la pantalla y los pacientes (buscar y preguntar al agente
 * clínico). Ver docs/voz-agenda.md.
 */

const ZOOM_MIN = 0.3;
const ZOOM_MAX = 2.5;
const MAX_CHOICES = 8;
const TIME_GRID: CalendarVoiceView[] = ['day', '2-day', '3-day', '4-day', '5-day', '6-day', 'week'];

const done = async (ctx: VoiceCommandContext, title: string, message: string, tone: 'success' | 'info' | 'error' = 'success') => {
  await ctx.finish({ title, message, tone }, message);
};

// ── Zoom ──────────────────────────────────────────────────────────────────────

async function runZoom(parsed: CalendarZoomParsed, ctx: VoiceCommandContext) {
  const title = tc(ctx, 'zoomTitle');
  const bridge = await needCalendar(ctx, title);
  if (!bridge) return;
  const current = bridge.state.zoom || 1;
  const step = 0.1 * parsed.amount;
  const next = parsed.op === 'in' ? current + step
    : parsed.op === 'out' ? current - step
      : parsed.op === 'max' ? ZOOM_MAX
        : parsed.op === 'min' ? ZOOM_MIN
          : parsed.op === 'reset' ? 1
            : (parsed.level ?? 100) / 100;
  const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(next * 10) / 10));
  bridge.actions.setZoom(clamped);
  const percent = Math.round(clamped * 100);
  const atLimit = clamped === current && (parsed.op === 'in' || parsed.op === 'out');
  const message = atLimit
    ? tc(ctx, parsed.op === 'in' ? 'zoomAtMax' : 'zoomAtMin', { percent })
    : TIME_GRID.includes(bridge.state.view)
      ? tc(ctx, 'zoomSet', { percent })
      : tc(ctx, 'zoomSetOtherView', { percent });
  await done(ctx, title, message, atLimit ? 'info' : 'success');
}

registerVoiceCommand<CalendarZoomParsed, CalendarVoiceAiResult>({
  id: 'calendar.zoom',
  domain: CALENDAR_VOICE_DOMAIN,
  priority: 44,
  aux: true,
  match: (normalized) => parseCalendarZoom(normalized),
  run: runZoom,
  ai: {
    from: (r) => (r.intent === 'calendar.zoom' && r.zoom_op
      ? { op: r.zoom_op, level: r.zoom_level ?? undefined, amount: r.amount ?? 1 }
      : null),
  },
});

// ── Panel de agendas ──────────────────────────────────────────────────────────

async function runAgendasPanel(op: CalendarPanelOp, ctx: VoiceCommandContext) {
  const title = tc(ctx, 'panelTitle');
  const bridge = await needCalendar(ctx, title);
  if (!bridge) return;
  if (!bridge.state.customMode) {
    // El panel es del modo personalizado: se ofrece pasar a ese modo.
    const yes = await ctx.confirm({ title, message: tc(ctx, 'panelNeedsCustom'), tone: 'confirm' }, tc(ctx, 'panelNeedsCustom'));
    if (!yes) { await done(ctx, title, ctx.t('VoiceCommands.nothingChanged'), 'info'); return; }
    const ok = await bridge.actions.updateSettings({ mode: 'custom' });
    if (!ok) { await done(ctx, title, tc(ctx, 'settingsError'), 'error'); return; }
    await waitForCalendar((s) => s.customMode, { signal: ctx.signal, timeoutMs: 3000 });
  }
  const actions = getCalendarVoice()!.actions;
  if (op === 'open') actions.setAgendasPanel({ open: true });
  if (op === 'close') actions.setAgendasPanel({ open: false });
  if (op === 'pin') actions.setAgendasPanel({ pinned: true, open: true });
  if (op === 'unpin') actions.setAgendasPanel({ pinned: false });
  await done(ctx, title, tc(ctx, `panel_${op}`));
}

registerVoiceCommand<CalendarPanelOp, CalendarVoiceAiResult>({
  id: 'calendar.agendas_panel',
  domain: CALENDAR_VOICE_DOMAIN,
  priority: 43,
  aux: true,
  match: (normalized) => parseCalendarPanelOp(normalized),
  run: runAgendasPanel,
  ai: { from: (r) => (r.intent === 'calendar.panel' && r.panel_op ? r.panel_op : null) },
});

// ── Opciones: vistas, agendas, doctores, sedes ────────────────────────────────

const viewLabel = (ctx: VoiceCommandContext, view: CalendarVoiceView) => tc(ctx, `views.${view.replace('-', '_')}`);

function viewsFor(state: CalendarVoiceState): CalendarVoiceView[] {
  const base: CalendarVoiceView[] = ['day', '2-day', '3-day', '4-day', '5-day', '6-day', 'week', 'month', 'schedule'];
  return state.customMode ? base : [...base, 'year'];
}

async function runOptions(of: CalendarOptionsOf, ctx: VoiceCommandContext) {
  const title = tc(ctx, 'optionsTitle');
  const bridge = await needCalendar(ctx, title);
  if (!bridge) return;
  const { state } = bridge;

  if (of === 'views') {
    const views = viewsFor(state);
    const index = await ctx.choose(
      { title, message: tc(ctx, 'whichView'), choices: views.map((v) => ({ label: viewLabel(ctx, v), detail: v === state.view ? tc(ctx, 'current') : undefined })), tone: 'confirm' },
      tc(ctx, 'whichViewSpeech', { list: views.map((v) => viewLabel(ctx, v)).join(', ') }),
    );
    getCalendarVoice()?.actions.setView(views[index]);
    await done(ctx, title, tc(ctx, 'viewChanged', { view: viewLabel(ctx, views[index]) }));
    return;
  }

  const lists = {
    calendars: state.calendars.map((c) => ({ id: String(c.id), name: c.name, detail: c.sede_name ?? undefined })),
    doctors: state.doctors.map((d) => ({ id: String(d.id), name: d.name, detail: undefined })),
    sedes: state.sedes.map((s) => ({ id: String(s.id), name: s.name, detail: undefined })),
  };
  const items = lists[of];
  if (!items.length) { await done(ctx, title, tc(ctx, 'noOptions'), 'info'); return; }
  const shown = items.slice(0, MAX_CHOICES);
  const question = tc(ctx, of === 'calendars' ? 'whichCalendar' : of === 'doctors' ? 'whichDoctorShow' : 'whichSede');
  const index = await ctx.choose(
    { title, message: question, choices: shown.map((i) => ({ label: i.name, detail: i.detail })), tone: 'confirm' },
    `${question} ${shown.map((i, n) => `${n + 1}, ${i.name}`).join('. ')}${items.length > shown.length ? `. ${tc(ctx, 'moreOptions', { count: items.length - shown.length })}` : ''}`,
  );
  const picked = shown[index];
  const actions = getCalendarVoice()!.actions;
  if (of === 'doctors') actions.setSelectedDoctorIds([picked.id]);
  else if (of === 'calendars') {
    if (state.customMode) actions.setActiveCalendar(picked.id);
    else actions.setSelectedCalendarIds([picked.id]);
  } else {
    const ids = state.calendars.filter((c) => String(c.sede_id ?? '') === picked.id).map((c) => String(c.id));
    if (!ids.length) { await done(ctx, title, tc(ctx, 'sedeWithoutCalendars', { name: picked.name }), 'error'); return; }
    if (state.customMode) actions.setActiveCalendar(ids[0]);
    else actions.setSelectedCalendarIds(ids);
  }
  await done(ctx, title, tc(ctx, 'filter_only', { name: picked.name }));
}

registerVoiceCommand<CalendarOptionsOf, CalendarVoiceAiResult>({
  id: 'calendar.options',
  domain: CALENDAR_VOICE_DOMAIN,
  priority: 41,
  aux: true,
  match: (normalized) => parseCalendarOptions(normalized),
  run: runOptions,
  ai: { from: (r) => (r.intent === 'calendar.options' && r.options_of ? r.options_of : null) },
});

// ── Engranaje ─────────────────────────────────────────────────────────────────

const DEFAULT_VIEW_LABEL: Record<string, string> = { day: 'day', '2_days': '2_day', '3_days': '3_day', week: 'week', month: 'month', agenda: 'schedule' };

/** Una preferencia dicha → lo que se guarda y cómo se dice. null si no se pudo (ya lo dijo). */
async function resolveSetting(
  change: CalendarSettingParsed,
  settings: CalendarSettings,
  state: CalendarVoiceState,
  ctx: VoiceCommandContext,
  title: string,
): Promise<{ patch: Partial<CalendarSettings>; said: string } | { error: string } | null> {
  const value = change.value;
  switch (change.setting) {
    case 'mode':
      return { patch: { mode: String(value) }, said: tc(ctx, value === 'custom' ? 'set_mode_custom' : 'set_mode_invoke') };
    case 'default_view':
      return { patch: { default_view: String(value) }, said: tc(ctx, 'set_default_view', { view: tc(ctx, `views.${DEFAULT_VIEW_LABEL[String(value)] ?? 'week'}`) }) };
    case 'grouped_by':
      return { patch: { grouped_by: String(value) }, said: tc(ctx, `set_grouped_${value}`) };
    case 'hour_height': {
      const options = [...HOUR_SLOT_HEIGHT_OPTIONS] as number[];
      const current = settings.hour_height ?? HOUR_SLOT_HEIGHT;
      const nearest = options.reduce((best, o) => (Math.abs(o - current) < Math.abs(best - current) ? o : best), options[0]);
      const at = options.indexOf(nearest);
      const px = value === 'max' ? options[options.length - 1]
        : value === 'min' ? options[0]
          : value === 'up' ? options[Math.min(options.length - 1, at + 1)]
            : value === 'down' ? options[Math.max(0, at - 1)]
              : options.reduce((best, o) => (Math.abs(o - Number(value)) < Math.abs(best - Number(value)) ? o : best), options[0]);
      if (px === current && (value === 'up' || value === 'down')) return { error: tc(ctx, value === 'up' ? 'hourHeightAtMax' : 'hourHeightAtMin', { px }) };
      return { patch: { hour_height: px }, said: tc(ctx, 'set_hour_height', { px }) };
    }
    case 'slot_duration':
      return { patch: { slot_duration: Number(value) }, said: tc(ctx, 'set_slot_duration', { minutes: Number(value) }) };
    case 'default_sede': {
      if (value === 'all' || value === '') return { patch: { default_sede: '' }, said: tc(ctx, 'set_default_sede_all') };
      const byId = state.sedes.find((s) => String(s.id) === String(value));
      let sede = byId ?? null;
      if (!sede) {
        const found = bestByName(String(value), state.sedes, (s) => s.name);
        if (found && found.score >= 0.5) sede = found.item;
      }
      if (!sede) {
        if (!state.sedes.length) return { error: tc(ctx, 'noOptions') };
        const shown = state.sedes.slice(0, MAX_CHOICES);
        const index = await ctx.choose(
          { title, message: tc(ctx, 'whichSede'), choices: shown.map((s) => ({ label: s.name })), tone: 'confirm' },
          `${tc(ctx, 'whichSede')} ${shown.map((s, i) => `${i + 1}, ${s.name}`).join('. ')}`,
        );
        sede = shown[index];
      }
      return { patch: { default_sede: String(sede.id) }, said: tc(ctx, 'set_default_sede', { name: sede.name }) };
    }
    case 'event_label_format':
      return { patch: { event_label_format: String(value) }, said: tc(ctx, 'set_event_label', { format: tc(ctx, `labelFormats.${value}`) }) };
    case 'hidden_weekdays': {
      const current = settings.hidden_weekdays ?? [];
      const days = change.weekdays ?? [];
      const next = change.weekdayOp === 'set' ? days
        : change.weekdayOp === 'show' ? current.filter((d) => !days.includes(d))
          : [...new Set([...current, ...days])];
      if (next.length >= 7) return { error: tc(ctx, 'cannotHideAllDays') };
      const names = (list: number[]) => list.sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => tc(ctx, `weekdays.${d}`)).join(', ');
      return {
        patch: { hidden_weekdays: next },
        said: next.length ? tc(ctx, 'set_hidden_weekdays', { days: names([...next]) }) : tc(ctx, 'set_hidden_weekdays_none'),
      };
    }
    case 'visible_hours': {
      if (value === 'custom') {
        const start = change.start ?? settings.visible_hours_start ?? '09:00';
        const end = change.end ?? settings.visible_hours_end ?? '17:00';
        return { patch: { visible_hours_mode: 'custom', visible_hours_start: start, visible_hours_end: end }, said: tc(ctx, 'set_visible_custom', { start, end }) };
      }
      return { patch: { visible_hours_mode: String(value) }, said: tc(ctx, value === 'clinic' ? 'set_visible_clinic' : 'set_visible_full') };
    }
    default: {
      const on = value === true;
      return { patch: { [change.setting]: on } as Partial<CalendarSettings>, said: tc(ctx, on ? 'set_flag_on' : 'set_flag_off', { name: tc(ctx, `flags.${change.setting}`) }) };
    }
  }
}

async function runSettings(parsed: CalendarSettingsParsed, ctx: VoiceCommandContext) {
  const title = tc(ctx, 'settingsTitle');
  const bridge = await needCalendar(ctx, title);
  if (!bridge) return;
  if (parsed.open !== undefined && !parsed.changes.length) {
    bridge.actions.setSettingsOpen(parsed.open);
    await done(ctx, title, tc(ctx, parsed.open ? 'settingsOpened' : 'settingsClosed'));
    return;
  }
  if (!bridge.state.settings) {
    await waitForCalendar((s) => !!s.settings, { signal: ctx.signal, timeoutMs: 5000 });
  }
  const state = getCalendarVoice()!.state;
  const settings = state.settings;
  if (!settings) { await done(ctx, title, tc(ctx, 'settingsError'), 'error'); return; }
  let patch: Partial<CalendarSettings> = {};
  const said: string[] = [];
  const errors: string[] = [];
  for (const change of parsed.changes) {
    const resolved = await resolveSetting(change, { ...settings, ...patch }, state, ctx, title);
    if (!resolved) continue;
    if ('error' in resolved) { errors.push(resolved.error); continue; }
    patch = { ...patch, ...resolved.patch };
    said.push(resolved.said);
  }
  if (!said.length) {
    await done(ctx, title, errors.join(' ') || ctx.t('VoiceCommands.nothingChanged'), errors.length ? 'error' : 'info');
    return;
  }
  ctx.show({ title, message: tc(ctx, 'saving'), tone: 'info' });
  const ok = await getCalendarVoice()!.actions.updateSettings(patch);
  if (parsed.open !== undefined) getCalendarVoice()?.actions.setSettingsOpen(parsed.open);
  if (!ok) { await done(ctx, title, tc(ctx, 'settingsError'), 'error'); return; }
  const message = `${tc(ctx, 'settingsDone', { changes: said.join(', ') })}${errors.length ? ` ${errors.join(' ')}` : ''}`;
  await done(ctx, title, message);
}

registerVoiceCommand<CalendarSettingsParsed, CalendarVoiceAiResult>({
  id: 'calendar.settings',
  domain: CALENDAR_VOICE_DOMAIN,
  priority: 45,
  aux: true,
  match: (normalized) => parseCalendarSettings(normalized),
  run: runSettings,
  ai: {
    from: (r) => {
      if (r.intent === 'calendar.settings_open' && r.panel_op) return { open: r.panel_op === 'open' || r.panel_op === 'pin', changes: [] };
      if (r.intent !== 'calendar.settings' || !r.setting) return null;
      if (r.setting === 'hidden_weekdays') {
        return { changes: [{ setting: 'hidden_weekdays', value: null, weekdays: r.weekdays, weekdayOp: r.weekday_op ?? 'hide' }] };
      }
      if (r.setting === 'visible_hours') {
        const start = parseTimeKey(r.time);
        const end = parseTimeKey(r.end_time);
        const custom = start && end ? { start: r.time!, end: r.end_time! } : {};
        return { changes: [{ setting: 'visible_hours', value: start && end ? 'custom' : r.setting_value, ...custom }] };
      }
      return { changes: [{ setting: r.setting, value: r.setting_value }] };
    },
  },
});

// ── Exportar agenda ───────────────────────────────────────────────────────────

/** Agendas de lo dicho (agenda por nombre o sede = sus agendas). Varias coincidencias: pregunta. */
async function resolveExportCalendars(ctx: VoiceCommandContext, title: string, details: CalendarExportParsed, state: CalendarVoiceState): Promise<string[] | null> {
  if (details.all) return state.calendars.map((c) => String(c.id));
  if (!details.names.length && details.text) {
    // «de Pocitos», «del sillón 2» sin decir «sede»/«agenda»: los nombres que aparecen enteros.
    const text = ` ${details.text} `;
    const has = (name: string) => { const n = normalizeSpeech(name); return !!n && text.includes(` ${n} `); };
    const sedes = state.sedes.filter((s) => has(s.name));
    const fromSedes = state.calendars.filter((c) => sedes.some((s) => String(s.id) === String(c.sede_id ?? ''))).map((c) => String(c.id));
    const named = state.calendars.filter((c) => has(c.name)).map((c) => String(c.id));
    const ids = [...new Set([...fromSedes, ...named])];
    return ids.length ? ids : null;
  }
  if (!details.names.length) return null;
  const ids: string[] = [];
  for (const said of details.names) {
    const isSede = /^(?:sede|sucursal|site|branch)\b/.test(said);
    const name = said.replace(/^(?:sede|sucursal|agenda|agendas|consultorio|calendario|site|branch|calendar)\s/, '');
    const sede = bestByName(name, state.sedes, (s) => s.name);
    const calendar = bestByName(isSede ? name : said, state.calendars, (c) => c.name);
    if (sede && sede.score >= 0.5 && (isSede || !calendar || sede.score > calendar.score)) {
      ids.push(...state.calendars.filter((c) => String(c.sede_id ?? '') === String(sede.item.id)).map((c) => String(c.id)));
      continue;
    }
    if (calendar && calendar.score >= 0.5) {
      const tied = state.calendars.filter((c) => nameScore(said, c.name) === calendar.score);
      if (tied.length > 1) {
        const shown = tied.slice(0, MAX_CHOICES);
        const index = await ctx.choose(
          { title, message: tc(ctx, 'whichCalendar'), choices: shown.map((c) => ({ label: c.name, detail: c.sede_name ?? undefined })), tone: 'confirm' },
          `${tc(ctx, 'whichCalendar')} ${shown.map((c, i) => `${i + 1}, ${c.name}`).join('. ')}`,
        );
        ids.push(String(shown[index].id));
      } else ids.push(String(calendar.item.id));
    }
  }
  return ids.length ? [...new Set(ids)] : [];
}

function exportSummary(ctx: VoiceCommandContext, state: CalendarVoiceState) {
  const status = state.exportDialog;
  if (!status) return { rows: [], speech: '' };
  const fmt = (d: string | null) => (d ? format(parseISO(d), 'dd/MM/yyyy') : '—');
  const period = status.from === status.to ? fmt(status.from) : `${fmt(status.from)} – ${fmt(status.to)}`;
  const names = state.calendars.filter((c) => status.calendarIds.includes(String(c.id))).map((c) => c.name);
  return {
    rows: [
      { label: tc(ctx, 'exportPeriod'), value: `${tc(ctx, `exportPreset.${status.preset}`)} · ${period}` },
      { label: tc(ctx, 'exportCalendars'), value: names.join(', ') || '—' },
    ],
    speech: tc(ctx, 'exportSummary', { period, count: names.length }),
  };
}

async function runExport(parsed: CalendarExportParsed, ctx: VoiceCommandContext) {
  const title = tc(ctx, 'exportTitle');
  const bridge = await needCalendar(ctx, title);
  if (!bridge) return;
  const apply = async (details: CalendarExportParsed) => {
    const state = getCalendarVoice()!.state;
    const calendarIds = await resolveExportCalendars(ctx, title, details, state);
    const notFound = calendarIds && !calendarIds.length;
    // Aunque no se encuentre la agenda nombrada, el diálogo se abre con el período (se corrige ahí).
    getCalendarVoice()!.actions.controlExport({
      preset: details.preset ?? undefined,
      anchor: details.anchor ?? undefined,
      from: details.from ?? undefined,
      to: details.to ?? undefined,
      calendarIds: calendarIds?.length ? calendarIds : undefined,
    });
    await waitForCalendar((s) => !!s.exportDialog, { signal: ctx.signal, timeoutMs: 4000, settleMs: 300 });
    return notFound ? tc(ctx, 'exportCalendarNotFound', { name: details.names.join(', ') }) : null;
  };
  const problem = await apply(parsed);
  let prompt = problem ? `${problem} ${tc(ctx, 'exportConfirm')}` : tc(ctx, 'exportConfirm');
  for (let unclear = 0; ;) {
    const state = getCalendarVoice()?.state;
    if (!state?.exportDialog) { await done(ctx, title, tc(ctx, 'exportClosed'), 'info'); return; }
    const summary = exportSummary(ctx, state);
    const raw = await ctx.ask({ title, rows: summary.rows, message: prompt, tone: 'confirm' }, `${summary.speech} ${prompt}`, 'confirm', { corrections: true });
    const answer = normalizeSpeech(raw);
    if (!getCalendarVoice()?.state.exportDialog) { await done(ctx, title, tc(ctx, 'exportClosed'), 'info'); return; }
    if (isFormCancel(answer) || parseYesNo(answer) === 'no') {
      getCalendarVoice()?.actions.closeExport();
      await done(ctx, title, tc(ctx, 'exportCancelled'), 'info');
      return;
    }
    if (parseYesNo(answer) === 'yes' || isFormSave(answer) || /^(?:exporta\w*|descarga\w*|bajala|bajalo|export|download)(?:\s(?:la|lo|it|ya|now))*$/.test(answer)) break;
    const details = readExportDetails(answer);
    if (details.preset || details.names.length || details.all) {
      const issue = await apply(details);
      prompt = issue ? `${issue} ${tc(ctx, 'exportConfirm')}` : tc(ctx, 'exportUpdated');
      unclear = 0;
      continue;
    }
    const outcome = await ctx.handOff(raw);
    if (outcome === 'switched') return;
    if (outcome === 'handled') { prompt = tc(ctx, 'exportConfirm'); continue; }
    if (++unclear >= 3) { await done(ctx, title, tc(ctx, 'exportLeftOpen'), 'info'); return; }
    prompt = tc(ctx, 'exportConfirm');
  }
  ctx.show({ title, message: tc(ctx, 'exporting'), tone: 'info' });
  getCalendarVoice()!.actions.controlExport({ submit: true });
  const finished = await waitForCalendar(
    (s) => !s.exportDialog || (!s.exportDialog.exporting && s.exportDialog.done !== null),
    { signal: ctx.signal, timeoutMs: 60000, settleMs: 300 },
  );
  if (ctx.signal.aborted) return;
  if (finished && !finished.exportDialog) { await done(ctx, title, tc(ctx, 'exportDone')); return; }
  const result = finished?.exportDialog?.done;
  await done(ctx, title, tc(ctx, result === 'empty' ? 'exportEmpty' : 'exportError'), result === 'empty' ? 'info' : 'error');
}

registerVoiceCommand<CalendarExportParsed, CalendarVoiceAiResult>({
  id: 'calendar.export',
  domain: CALENDAR_VOICE_DOMAIN,
  priority: 42,
  match: (normalized) => parseCalendarExport(normalized),
  run: runExport,
  ai: {
    from: (r) => {
      if (r.intent !== 'calendar.export' && r.intent !== 'calendar.print') return null;
      const state = getCalendarVoice()?.state;
      const names = [
        ...r.sede_ids.map((id) => state?.sedes.find((s) => String(s.id) === id)?.name).filter(Boolean).map((n) => `sede ${n}`),
        ...r.calendar_ids.map((id) => state?.calendars.find((c) => String(c.id) === id)?.name).filter((n): n is string => !!n),
      ] as string[];
      const custom = r.export_range === 'custom' || (!!r.date && !!r.end_date);
      return {
        preset: custom ? 'custom' : r.export_range,
        anchor: custom ? null : r.date,
        from: custom ? r.date : null,
        to: custom ? r.end_date : null,
        names,
        all: !r.sede_ids.length && !r.calendar_ids.length && r.filter_op === 'all',
        text: '',
      };
    },
  },
});

// ── Seleccionar / ir a una cita ───────────────────────────────────────────────

async function runSelect(ref: CalendarAppointmentRef, ctx: VoiceCommandContext) {
  const title = tc(ctx, 'selectTitle');
  const bridge = await needCalendar(ctx, title);
  if (!bridge) return;
  const appt = await resolveAppointment(ctx, ref, title);
  if (!appt) return;
  setAppointmentFocus(appt);
  getCalendarVoice()?.actions.focusAppointment(appt);
  const when = whenOf(ctx, appt);
  const message = tc(ctx, 'selected', { patient: appt.patientName || '—', when: when.speech });
  await ctx.finish({ title, subtitle: appt.patientName, rows: appointmentRows(ctx, appt), message, tone: 'success' }, `${message} ${tc(ctx, 'selectedHint')}`);
}

registerVoiceCommand<CalendarAppointmentRef, CalendarVoiceAiResult>({
  id: 'calendar.select',
  domain: CALENDAR_VOICE_DOMAIN,
  usesFocus: true,
  priority: 25,
  match: (normalized) => parseCalendarSelect(normalized),
  run: runSelect,
  ai: {
    from: (r) => (r.intent === 'calendar.select'
      ? { patient: r.patient ? normalizeSpeech(r.patient) : null, time: parseTimeKey(r.from_time ?? r.time), date: r.from_date ?? r.date }
      : null),
  },
});

// ── Formulario abierto a mano ─────────────────────────────────────────────────

registerVoiceCommand<{ raw: string }, CalendarVoiceAiResult>({
  id: 'calendar.form',
  domain: CALENDAR_VOICE_DOMAIN,
  usesFocus: true,
  // Con el formulario abierto todo lo que se dice es para él.
  priority: 100,
  match: (_normalized, raw) => (getCalendarVoice()?.state.form.kind ? { raw } : null),
  run: (parsed, ctx) => runOpenFormSession(ctx, parsed.raw),
  ai: {
    from: (r, raw) => (r.intent === 'calendar.form_set' || r.intent === 'calendar.form_save' || r.intent === 'calendar.form_cancel'
      ? (getCalendarVoice()?.state.form.kind ? { raw } : null)
      : null),
  },
});

// ── Avisos de la pantalla ─────────────────────────────────────────────────────

async function runDialog(answer: DialogAnswer, ctx: VoiceCommandContext) {
  const title = openDialogTitle() ?? tc(ctx, 'dialogTitle');
  const ok = answerDialog(answer);
  await done(ctx, title, tc(ctx, ok ? (answer === 'confirm' ? 'dialogConfirmed' : 'dialogCancelled') : 'noDialog'), ok ? 'success' : 'info');
}

registerVoiceCommand<DialogAnswer, CalendarVoiceAiResult>({
  id: 'calendar.dialog',
  domain: CALENDAR_VOICE_DOMAIN,
  usesFocus: true,
  priority: 99,
  aux: true,
  match: (normalized) => (isDialogOpen() ? parseDialogAnswer(normalized) : null),
  run: runDialog,
  ai: { from: (r) => (r.intent === 'calendar.dialog' && r.dialog_op ? r.dialog_op : null) },
});

// ── Pacientes: buscar ─────────────────────────────────────────────────────────

const OLD_APPOINTMENT_YEARS = 1;

/** Elige entre pacientes del buscador y abre su ficha. */
async function openFromWidget(ctx: VoiceCommandContext, title: string, found: CalendarVoicePatient[]) {
  let patient = found[0];
  if (found.length > 1) {
    const shown = found.slice(0, MAX_CHOICES);
    const index = await ctx.choose(
      { title, message: tc(ctx, 'whichPatient'), choices: shown.map((p) => ({ label: p.name, detail: p.document || p.phone || p.email || undefined })), tone: 'confirm' },
      tc(ctx, 'whichPatientSpeech', { count: shown.length }),
    );
    patient = shown[index];
  }
  getCalendarVoice()?.actions.openPatient(patient);
  await done(ctx, title, tc(ctx, 'patientOpened', { name: patient.name }));
}

async function runPatientFind(parsed: CalendarPatientFindParsed, ctx: VoiceCommandContext) {
  const title = tc(ctx, 'patientFindTitle');
  const bridge = await needCalendar(ctx, title);
  if (!bridge) return;
  const identifier = parsed.document ?? parsed.email ?? parsed.phone;

  if (parsed.name && !identifier) {
    // 1) Por sus citas: así queda la cita en foco y se puede ver todo desde ahí.
    ctx.show({ title, message: tc(ctx, 'lookingFor', { name: parsed.name }), tone: 'info' });
    const rows = (await bridge.actions.searchAppointments(parsed.name)).filter((a) => (a.status as string) !== 'deleted' && nameScore(parsed.name!, a.patientName || '') >= 0.5);
    if (ctx.signal.aborted) return;
    const recentLimit = subYears(startOfToday(), OLD_APPOINTMENT_YEARS).getTime();
    const recent = rows.filter((a) => (appointmentStart(a)?.getTime() ?? 0) >= recentLimit);
    if (recent.length) {
      const byPatient = new Map<string, Appointment[]>();
      for (const a of recent) byPatient.set(String(a.patientId || a.patientName), [...(byPatient.get(String(a.patientId || a.patientName)) ?? []), a]);
      let list = [...byPatient.values()][0];
      if (byPatient.size > 1) {
        const groups = [...byPatient.values()].slice(0, MAX_CHOICES);
        const index = await ctx.choose(
          { title, message: tc(ctx, 'whichPatient'), choices: groups.map((g) => ({ label: g[0].patientName, detail: tc(ctx, 'appointmentsCount', { count: g.length }) })), tone: 'confirm' },
          tc(ctx, 'whichPatientSpeech', { count: groups.length }),
        );
        list = groups[index];
      }
      const now = Date.now();
      const sorted = [...list].sort(byStart);
      const upcoming = sorted.find((a) => (appointmentStart(a)?.getTime() ?? 0) >= now - 60 * 60000);
      const appt = upcoming ?? sorted[sorted.length - 1];
      setAppointmentFocus(appt);
      getCalendarVoice()?.actions.focusAppointment(appt);
      const when = whenOf(ctx, appt);
      const message = tc(ctx, upcoming ? 'patientFoundNext' : 'patientFoundLast', { name: appt.patientName, when: when.speech });
      await ctx.finish({ title, subtitle: appt.patientName, rows: appointmentRows(ctx, appt), message, tone: 'success' }, `${message} ${tc(ctx, 'patientFoundHint')}`);
      return;
    }
    // 2) Sin citas (o muy viejas): el buscador de pacientes por nombre.
    const found = await bridge.actions.searchPatients(parsed.name);
    if (ctx.signal.aborted) return;
    if (found.length) { await openFromWidget(ctx, title, found); return; }
    if (await ctx.tryAi()) return;
  }

  // 3) Por documento, email o teléfono (lo dicho o preguntándolo).
  let value = identifier;
  if (!value) {
    const question = parsed.name ? tc(ctx, 'patientNotFoundAskId', { name: parsed.name }) : tc(ctx, 'patientAskId');
    for (let attempt = 0; attempt < 2 && !value; attempt++) {
      const answer = normalizeSpeech(await ctx.ask({ title, message: question, tone: 'confirm' }, question));
      const ids = readPatientIdentifiers(answer);
      value = ids.document ?? ids.email ?? ids.phone ?? (answer.replace(/\s/g, '').match(/^\d{6,15}$/) ? answer.replace(/\s/g, '') : null);
    }
  }
  if (!value) { await done(ctx, title, tc(ctx, 'patientIdNotUnderstood'), 'error'); return; }
  ctx.show({ title, message: tc(ctx, 'lookingFor', { name: value }), tone: 'info' });
  const found = await getCalendarVoice()!.actions.searchPatients(value);
  if (ctx.signal.aborted) return;
  if (!found.length) { await done(ctx, title, tc(ctx, 'patientNotFoundById', { value }), 'error'); return; }
  await openFromWidget(ctx, title, found);
}

registerVoiceCommand<CalendarPatientFindParsed, CalendarVoiceAiResult>({
  id: 'calendar.patient_find',
  domain: CALENDAR_VOICE_DOMAIN,
  priority: 39,
  match: (normalized) => parseCalendarPatientFind(normalized),
  run: runPatientFind,
  ai: {
    from: (r) => (r.intent === 'calendar.patient_find'
      ? { name: r.patient ? normalizeSpeech(r.patient) : null, document: r.document, email: r.email, phone: r.phone }
      : null),
  },
});

// ── Pacientes: resumen y preguntas (agente clínico de Mi consultorio) ─────────

async function runPatientAsk(parsed: CalendarPatientAskParsed, ctx: VoiceCommandContext) {
  const title = tc(ctx, 'patientAskTitle');
  const bridge = await needCalendar(ctx, title);
  if (!bridge) return;
  if (!ctx.hasPermission(DASHBOARD_PERMISSIONS.DOCTOR_WORKSPACE_ACCESS)) { await deny(ctx, title); return; }
  let appt = await resolveAppointment(ctx, parsed.ref ?? { patient: null, time: null, date: null }, title, (a) => !!a.patientId);
  if (!appt && !parsed.ref) {
    // Sin cita en foco: ¿de qué paciente?
    const answer = normalizeSpeech(await ctx.ask({ title, message: tc(ctx, 'whichPatientName'), tone: 'confirm' }, tc(ctx, 'whichPatientName')));
    if (!answer) return;
    appt = await resolveAppointment(ctx, { patient: answer, time: null, date: null }, title, (a) => !!a.patientId);
  }
  if (!appt) return;
  ctx.show({ title, subtitle: appt.patientName, message: tc(ctx, 'patientAsking'), tone: 'info' });
  const reply = await getCalendarVoice()!.actions.askPatientAi(appt, parsed.question).catch((error) => {
    console.warn('[voice] patient AI failed', error);
    return null;
  });
  if (ctx.signal.aborted) return;
  if (!reply) { await done(ctx, title, tc(ctx, 'patientAskFailed'), 'error'); return; }
  await ctx.finish({ title, subtitle: appt.patientName, message: reply.answer, tone: 'info' }, reply.speech);
}

registerVoiceCommand<CalendarPatientAskParsed, CalendarVoiceAiResult>({
  id: 'calendar.patient_ask',
  domain: CALENDAR_VOICE_DOMAIN,
  usesFocus: true,
  priority: 40,
  match: (normalized) => parseCalendarPatientAsk(normalized),
  run: runPatientAsk,
  ai: {
    from: (r, raw) => (r.intent === 'calendar.patient_ask'
      ? {
        question: r.question ?? raw,
        ref: r.patient || r.from_time ? { patient: r.patient ? normalizeSpeech(r.patient) : null, time: parseTimeKey(r.from_time), date: r.from_date } : null,
      }
      : null),
  },
});


// ── Pacientes: ubicar al paciente (sin elegir una cita) ───────────────────────

interface ResolvedPatient {
  patient: { id: string; name: string };
  /** Una cita del paciente (la del foco, o la próxima / la última), para lo que la necesite. */
  appointment: Appointment | null;
}

/**
 * El paciente del que se habla: el de la cita en foco si no se nombra; si no, por sus citas; si no
 * tiene, el buscador de pacientes; si tampoco, pide documento, email o teléfono. Varios → pregunta.
 * null si no se encontró (ya lo dijo).
 */
async function resolvePatient(ctx: VoiceCommandContext, title: string, said: string | null): Promise<ResolvedPatient | null> {
  const bridge = getCalendarVoice();
  if (!bridge) return null;
  let name = said;
  if (!name) {
    const focused = getAppointmentFocus();
    if (focused?.patientId) return { patient: { id: String(focused.patientId), name: focused.patientName }, appointment: focused };
    const answer = normalizeSpeech(await ctx.ask({ title, message: tc(ctx, 'whichPatientName'), tone: 'confirm' }, tc(ctx, 'whichPatientName')));
    const ids = readPatientIdentifiers(answer);
    if (ids.document || ids.email || ids.phone) return resolveById(ctx, title, ids.document ?? ids.email ?? ids.phone!);
    name = answer.replace(/^(?:el |la |es |de |del |paciente |patient )+/, '').trim() || null;
    if (!name) return null;
  }
  ctx.show({ title, message: tc(ctx, 'lookingFor', { name }), tone: 'info' });
  const rows = (await bridge.actions.searchAppointments(name)).filter((a) => !!a.patientId && nameScore(name!, a.patientName || '') >= 0.5);
  if (ctx.signal.aborted) return null;
  if (rows.length) {
    const byPatient = new Map<string, Appointment[]>();
    for (const a of rows) byPatient.set(String(a.patientId), [...(byPatient.get(String(a.patientId)) ?? []), a]);
    let list = [...byPatient.values()][0];
    if (byPatient.size > 1) {
      const groups = [...byPatient.values()].slice(0, MAX_CHOICES);
      const index = await ctx.choose(
        { title, message: tc(ctx, 'whichPatient'), choices: groups.map((g) => ({ label: g[0].patientName, detail: tc(ctx, 'appointmentsCount', { count: g.length }) })), tone: 'confirm' },
        tc(ctx, 'whichPatientSpeech', { count: groups.length }),
      );
      list = groups[index];
    }
    const sorted = [...list].sort(byStart);
    const now = Date.now();
    const appointment = sorted.find((a) => (appointmentStart(a)?.getTime() ?? 0) >= now - 60 * 60000) ?? sorted[sorted.length - 1];
    return { patient: { id: String(list[0].patientId), name: list[0].patientName }, appointment };
  }
  const found = await bridge.actions.searchPatients(name);
  if (ctx.signal.aborted) return null;
  if (found.length) return { patient: await pickPatient(ctx, title, found), appointment: null };
  // Lo dicho no es un paciente («put together an estimate for Juan»): quizás la IA lo entiende.
  if (said && await ctx.tryAi()) return null;
  const question = tc(ctx, 'patientNotFoundAskId', { name });
  for (let attempt = 0; attempt < 2; attempt++) {
    const answer = normalizeSpeech(await ctx.ask({ title, message: question, tone: 'confirm' }, question));
    const ids = readPatientIdentifiers(answer);
    const value = ids.document ?? ids.email ?? ids.phone ?? (answer.replace(/\s/g, '').match(/^\d{6,15}$/) ? answer.replace(/\s/g, '') : null);
    if (value) return resolveById(ctx, title, value);
  }
  await done(ctx, title, tc(ctx, 'patientIdNotUnderstood'), 'error');
  return null;
}

async function pickPatient(ctx: VoiceCommandContext, title: string, found: CalendarVoicePatient[]): Promise<{ id: string; name: string }> {
  if (found.length === 1) return { id: found[0].id, name: found[0].name };
  const shown = found.slice(0, MAX_CHOICES);
  const index = await ctx.choose(
    { title, message: tc(ctx, 'whichPatient'), choices: shown.map((p) => ({ label: p.name, detail: p.document || p.phone || p.email || undefined })), tone: 'confirm' },
    tc(ctx, 'whichPatientSpeech', { count: shown.length }),
  );
  return { id: shown[index].id, name: shown[index].name };
}

async function resolveById(ctx: VoiceCommandContext, title: string, value: string): Promise<ResolvedPatient | null> {
  ctx.show({ title, message: tc(ctx, 'lookingFor', { name: value }), tone: 'info' });
  const found = await getCalendarVoice()!.actions.searchPatients(value);
  if (ctx.signal.aborted) return null;
  if (!found.length) { await done(ctx, title, tc(ctx, 'patientNotFoundById', { value }), 'error'); return null; }
  return { patient: await pickPatient(ctx, title, found), appointment: null };
}

// ── Pacientes: información (estadísticas y estado de cuenta) ─────────────────

const FINANCIAL_TOPICS: PatientInfoTopic[] = ['debt', 'last_payment', 'payments', 'quotes', 'invoices'];

async function runPatientInfo(parsed: PatientInfoParsed, ctx: VoiceCommandContext) {
  const title = tc(ctx, 'patientInfoTitle');
  const bridge = await needCalendar(ctx, title);
  if (!bridge) return;
  const resolved = await resolvePatient(ctx, title, parsed.patient);
  if (!resolved) return;
  if (resolved.appointment) setAppointmentFocus(resolved.appointment);
  let topics = parsed.topics;
  const notes: string[] = [];
  // Lo financiero solo con permiso de ver la cuenta del paciente.
  if (!getCalendarVoice()!.state.canViewAccounts) {
    const allowed = topics.includes('summary') ? topics : topics.filter((tp) => !FINANCIAL_TOPICS.includes(tp));
    if (allowed.length !== topics.length || topics.includes('summary')) notes.push(tc(ctx, 'noFinancialPermission'));
    topics = topics.includes('summary') ? (['visits', 'no_shows', 'cancellations', 'treatments'] as PatientInfoTopic[]) : allowed;
    if (!topics.length) { await done(ctx, title, notes.join(' '), 'error'); return; }
  }
  ctx.show({ title, subtitle: resolved.patient.name, message: tc(ctx, 'patientInfoLoading'), tone: 'info' });
  const facts = await getCalendarVoice()!.actions.getPatientFacts(resolved.patient, needsFor(topics));
  if (ctx.signal.aborted) return;
  const answer = answerPatientInfo(topics, facts, ctx.t, ctx.locale);
  const speech = [answer.speech, ...notes].join(' ');
  await ctx.finish({ title, subtitle: resolved.patient.name, rows: answer.rows, message: notes.join(' ') || undefined, tone: 'info' }, speech);
}

registerVoiceCommand<PatientInfoParsed, CalendarVoiceAiResult>({
  id: 'calendar.patient_info',
  domain: CALENDAR_VOICE_DOMAIN,
  usesFocus: true,
  priority: 46,
  aux: true,
  match: (normalized) => parsePatientInfo(normalized),
  run: runPatientInfo,
  ai: {
    from: (r) => (r.intent === 'calendar.patient_info' && r.info_topics.length
      ? { topics: r.info_topics, patient: r.patient ? normalizeSpeech(r.patient) : null }
      : null),
  },
});

// ── Pacientes: acciones (presupuesto, factura, tratamiento, sesión, cobro) ────

async function runPatientAction(parsed: PatientActionParsed, ctx: VoiceCommandContext) {
  const title = tc(ctx, `patientAction.${parsed.action}`);
  const bridge = await needCalendar(ctx, title);
  if (!bridge) return;
  const resolved = await resolvePatient(ctx, title, parsed.patient);
  if (!resolved) return;
  let appointment = resolved.appointment;
  // La sesión clínica es de una cita: la de hoy del paciente, o se pregunta.
  if (parsed.action === 'session' && !appointment) {
    await done(ctx, title, tc(ctx, 'sessionNeedsAppointment', { name: resolved.patient.name }), 'error');
    return;
  }
  if (parsed.action === 'session' && appointment && !getAppointmentFocus()) {
    appointment = await resolveAppointment(ctx, { patient: normalizeSpeech(resolved.patient.name), time: null, date: null }, title) ?? appointment;
  }
  const result = getCalendarVoice()!.actions.openPatientAction(resolved.patient, parsed.action, parsed.action === 'quote' || parsed.action === 'invoice' ? null : appointment);
  if (result === 'denied') { await deny(ctx, title); return; }
  if (result === 'needsAppointment') { await done(ctx, title, tc(ctx, 'sessionNeedsAppointment', { name: resolved.patient.name }), 'error'); return; }
  await done(ctx, title, tc(ctx, `patientActionOpened.${parsed.action}`, { name: resolved.patient.name }));
}

registerVoiceCommand<PatientActionParsed, CalendarVoiceAiResult>({
  id: 'calendar.patient_action',
  domain: CALENDAR_VOICE_DOMAIN,
  usesFocus: true,
  priority: 47,
  match: (normalized) => parsePatientAction(normalized),
  run: runPatientAction,
  ai: {
    from: (r) => (r.intent === 'calendar.patient_action' && r.patient_action
      ? { action: r.patient_action, patient: r.patient ? normalizeSpeech(r.patient) : null }
      : null),
  },
});

// ── Cerrar paneles (lo que esté abierto) ──────────────────────────────────────

/** «cerrá», «cerrá el panel», «close the panel», «hide it», «cerrá todo»: sin nombrar cuál. */
const CLOSE_RE = /^(?:(?:ya |bueno |dale |ok |listo )?(?:cerra\w*|cierra\w*|close|oculta\w*|esconde\w*|hide|saca\w*|quita\w*|dismiss|minimiza\w*|get rid of|take (?:it|that|this) away))(?:\s(?:me|lo|la|los|las|el|the|this|that|este|esta|eso|esto|it|panel|paneles|panels|ventana|ventanas|ventanita|cuadro|cuadrito|popup|pop up|pestana|lateral|costado|sidebar|side panel|abierto|abiertos|open|de la derecha|de la izquierda|de ahi|de aca|de encima|todo|todos|everything|all|por favor|please|ya|window|windows|tab))*$/;
/** «que no se vea», «no quiero ver eso», «sacalo de ahí», «no muestres eso»: lo mismo. */
const HIDE_IT_RE = /^(?:que no se vea(?: mas)?(?: eso| esto)?|no (?:lo |la )?quiero ver(?: mas)?(?: eso| esto)?|no (?:muestres|mostres) (?:eso|esto|mas)|no hace falta(?: que se vea)?|ya (?:esta|vi)(?: listo)?|ya lo vi|i don t (?:want|need) to see (?:that|this|it)(?: anymore)?|i m done with (?:that|this)|that s enough)$/;
/** «volvé atrás», «atrás», «go back»: cerrar lo recién abierto (solo si hay algo abierto). */
const BACK_RE = /^(?:volve\w*|vuelve|anda|ir|go|volvamos)?(?:\s?(?:para |hacia )?(?:atras|back))(?:\s(?:por favor|please))?$/;
const CLOSE_ALL_RE = /\b(?:todo|todos|everything|all|paneles|panels|ventanas|windows)\b/;

export interface CalendarCloseParsed { all: boolean }

/** Hay algo abierto que se pueda cerrar (ventana, panel lateral o un panel de la agenda). */
function somethingOpen(): boolean {
  if (hasOpenOverlay()) return true;
  const state = getCalendarVoice()?.state;
  return !!state && (state.settingsOpen || !!state.exportDialog || state.searchActive || state.gapsActive || state.bulkMode || state.agendasPanel.open);
}

export function parseCalendarClose(normalized: string): CalendarCloseParsed | null {
  if (CLOSE_RE.test(normalized) || HIDE_IT_RE.test(normalized)) return { all: CLOSE_ALL_RE.test(normalized) };
  if (BACK_RE.test(normalized) && somethingOpen()) return { all: false };
  return null;
}

type Closable = 'settings' | 'export' | 'search' | 'gaps' | 'bulk' | 'agendas';

async function runClose(parsed: CalendarCloseParsed, ctx: VoiceCommandContext) {
  const title = tc(ctx, 'closeTitle');
  const bridge = await needCalendar(ctx, title);
  if (!bridge) return;
  const { state, actions } = bridge;
  const closed: string[] = [];
  // Primero las ventanas y paneles laterales (estado de cuenta, historia, ficha…), que están encima.
  for (let guard = 0; guard < 6 && hasOpenOverlay(); guard++) {
    const name = closeTopOverlay();
    if (name === null) break;
    closed.push(name || tc(ctx, 'panels.window'));
    if (!parsed.all) break;
  }
  if (closed.length && !parsed.all) { await done(ctx, title, tc(ctx, 'closedPanels', { names: closed.join(', ') })); return; }
  // De arriba hacia abajo: lo que está encima primero.
  const open: Closable[] = [
    ...(state.settingsOpen ? ['settings' as const] : []),
    ...(state.exportDialog ? ['export' as const] : []),
    ...(state.searchActive ? ['search' as const] : []),
    ...(state.gapsActive ? ['gaps' as const] : []),
    ...(state.bulkMode ? ['bulk' as const] : []),
    ...(state.agendasPanel.open ? ['agendas' as const] : []),
  ];
  if (!open.length) {
    await done(ctx, title, closed.length ? tc(ctx, 'closedPanels', { names: closed.join(', ') }) : tc(ctx, 'nothingOpen'), closed.length ? 'success' : 'info');
    return;
  }
  const targets = parsed.all ? open : [open[0]];
  for (const target of targets) {
    if (target === 'settings') actions.setSettingsOpen(false);
    if (target === 'export') actions.closeExport();
    if (target === 'search') actions.closeSearch();
    if (target === 'gaps') actions.setGapsActive(false);
    if (target === 'bulk') actions.exitBulk();
    if (target === 'agendas') actions.setAgendasPanel({ open: false });
  }
  await done(ctx, title, tc(ctx, 'closedPanels', { names: [...closed, ...targets.map((tg) => tc(ctx, `panels.${tg}`))].join(', ') }));
}

registerVoiceCommand<CalendarCloseParsed, CalendarVoiceAiResult>({
  id: 'calendar.close',
  domain: CALENDAR_VOICE_DOMAIN,
  usesFocus: true,
  priority: 48,
  aux: true,
  match: (normalized) => parseCalendarClose(normalized),
  run: runClose,
  ai: { from: (r) => (r.intent === 'calendar.close_panels' ? { all: r.filter_op === 'all' } : null) },
});
