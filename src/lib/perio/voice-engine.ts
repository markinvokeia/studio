import type { PerioSide, PerioTooth } from '@/lib/types';

import {
  firstEmpty,
  firstSiteOf,
  isProbeableTooth,
  neighbourTooth,
  nextPresentTooth,
  nextSiteIn,
  patchSites,
  patchToothIn,
  presentTeethOf,
  type ProbeLine,
} from './probe';
import { furcationEntries, isProbeable, type ProbeMode, probeSequence, sameSite, type SiteRef, siteOf } from './teeth';
import type { VoiceCommand, VoiceFocus, VoicePass } from './voice';

// Runs the voice commands of one utterance on a copy of the probing state. The screen commits
// the result at once (one undo step per utterance) and shows what was understood.

/** Face a line command goes to when only the tooth is said ("SS 23" → SS lingual/palatal of 23) */
export const DEFAULT_LINE_SIDE: PerioSide = 'i';
/** A value this far (mm) from the guide exam is flagged (never blocked) */
export const JUMP_ALERT_MM = 3;

export interface ProbeState {
  teeth: PerioTooth[];
  cursor: SiteRef | null;
  pass: VoicePass;
  line: ProbeLine;
  /** Site the marks (bleeding, suppuration, plaque) go to */
  flagRef: SiteRef | null;
  fmTooth: number;
  focus: VoiceFocus;
}

export type VoiceEvent =
  | { kind: 'wrote'; ref: SiteRef; field: 'pd' | 'gm'; value: number }
  | { kind: 'marked'; refs: SiteRef[]; flag: 'bop' | 'sup' | 'plaque'; on: boolean }
  | { kind: 'mobility'; tooth: number; value: number }
  | { kind: 'furcation'; tooth: number; entry: string; grade: number }
  | { kind: 'jump'; ref: SiteRef; from: number; to: number }
  | { kind: 'notProbed'; tooth: number }
  | { kind: 'outOfRange'; value: number }
  | { kind: 'noPrevious' }
  | { kind: 'passDone'; pass: VoicePass };

export type VoiceAction = 'undo' | 'redo' | 'confirm' | 'discard' | 'stop';

export interface VoiceResult {
  state: ProbeState;
  events: VoiceEvent[];
  /** Sites written or marked (they stay underlined until confirmed) */
  touched: SiteRef[];
  /** Done by the screen after the state is committed */
  actions: VoiceAction[];
}

/** `marginSign` −1: the clinic says recession as negative (the record keeps it positive) */
export function runVoice(start: ProbeState, commands: VoiceCommand[], guide: PerioTooth[] | null, mode?: ProbeMode, marginSign = 1): VoiceResult {
  const s: ProbeState = { ...start };
  const sequence = probeSequence(s.teeth, mode);
  const events: VoiceEvent[] = [];
  const touched: SiteRef[] = [];
  const actions: VoiceAction[] = [];
  const guideBy = guide ? new Map(guide.map((x) => [x.tooth, x])) : null;
  /** A tooth or face was said in this utterance: a pass change keeps the probe there */
  let anchored = false;

  const field = () => (s.pass === 'mg' ? 'gm' : 'pd');
  const ghostAt = (ref: SiteRef) => {
    const g = guideBy?.get(ref.tooth);
    return g && isProbeable(g.status) ? g.sites[ref.side][ref.index] : null;
  };
  const touch = (ref: SiteRef) => { if (!touched.some((r) => sameSite(r, ref))) touched.push(ref); };

  const advance = (from: SiteRef) => {
    if (s.line !== 'value') { s.cursor = nextSiteIn(sequence, s.teeth, from) ?? from; return; }
    const next = nextSiteIn(sequence, s.teeth, from, field());
    if (next) { s.cursor = next; return; }
    s.cursor = nextSiteIn(sequence, s.teeth, from) ?? from;
    events.push({ kind: 'passDone', pass: s.pass });
  };

  const writeValue = (said: number) => {
    let v = said;
    if (s.pass === 'fm') {
      if (v < 0 || v > 3) { events.push({ kind: 'outOfRange', value: v }); return; }
      s.teeth = patchToothIn(s.teeth, s.fmTooth, (x) => ({ ...x, mobility: v }));
      events.push({ kind: 'mobility', tooth: s.fmTooth, value: v });
      s.fmTooth = nextPresentTooth(s.teeth, s.fmTooth);
      return;
    }
    const ref = s.cursor;
    if (!ref) return;
    // On a row of marks, 1 is yes and 0 is no
    if (s.line !== 'value') {
      if (v === 0 || v === 1) writeMark(v === 1);
      else events.push({ kind: 'outOfRange', value: v });
      return;
    }
    const f = field();
    if (f === 'gm') v *= marginSign;
    if (f === 'pd' ? v < 0 || v > 15 : v < -10 || v > 15) { events.push({ kind: 'outOfRange', value: v }); return; }
    const g = ghostAt(ref);
    if (f === 'pd' && g?.pd != null && Math.abs(v - g.pd) >= JUMP_ALERT_MM) events.push({ kind: 'jump', ref, from: g.pd, to: v });
    s.teeth = patchSites(s.teeth, [ref], (x) => ({ ...x, [f]: v, source: 'dictation' }));
    events.push({ kind: 'wrote', ref, field: f, value: v });
    touch(ref);
    s.flagRef = ref;
    advance(ref);
  };

  const writeMark = (on: boolean) => {
    const ref = s.cursor;
    if (!ref || s.line === 'value') return;
    const flag = s.line;
    s.teeth = patchSites(s.teeth, [ref], (x) => ({ ...x, [flag]: on }));
    events.push({ kind: 'marked', refs: [ref], flag, on });
    touch(ref);
    s.flagRef = ref;
    advance(ref);
  };

  const goTo = (tooth: number, side: PerioSide, sites?: number[]) => {
    if (!isProbeableTooth(s.teeth, tooth)) { events.push({ kind: 'notProbed', tooth }); return false; }
    const first = firstSiteOf(sequence, tooth, side);
    if (!first) return false;
    s.cursor = sites?.length ? { tooth, side, index: sites[0] as SiteRef['index'] } : first;
    s.flagRef = s.cursor;
    s.fmTooth = tooth;
    anchored = true;
    return true;
  };

  const setPass = (pass: VoicePass) => {
    s.pass = pass;
    s.line = 'value';
    if (pass === 'fm') {
      const tooth = anchored && s.cursor ? s.cursor.tooth : presentTeethOf(s.teeth).find((n) => s.teeth.find((x) => x.tooth === n)?.mobility == null);
      if (tooth != null && s.teeth.find((x) => x.tooth === tooth)?.status === 'present') s.fmTooth = tooth;
      return;
    }
    if (anchored && s.cursor) { s.cursor = firstSiteOf(sequence, s.cursor.tooth, s.cursor.side) ?? s.cursor; return; }
    const empty = firstEmpty(sequence, s.teeth, pass === 'mg' ? 'gm' : 'pd');
    if (empty) s.cursor = empty;
  };

  for (const c of commands) {
    switch (c.kind) {
      case 'values':
        c.values.forEach(writeValue);
        break;
      case 'answer':
        if (s.line !== 'value') writeMark(c.on);
        break;
      case 'same': {
        if (s.pass === 'fm') {
          s.teeth = patchToothIn(s.teeth, s.fmTooth, (x) => ({ ...x, mobility: x.mobility ?? 0 }));
          s.fmTooth = nextPresentTooth(s.teeth, s.fmTooth);
          break;
        }
        if (!s.cursor) break;
        if (s.line !== 'value') { advance(s.cursor); break; }
        const g = ghostAt(s.cursor);
        const f = field();
        const value = g?.[f] ?? (f === 'gm' ? 0 : null);
        if (value == null) { events.push({ kind: 'noPrevious' }); break; }
        const ref = s.cursor;
        s.teeth = patchSites(s.teeth, [ref], (x) => ({ ...x, [f]: value, source: 'same' }));
        events.push({ kind: 'wrote', ref, field: f, value });
        touch(ref);
        s.flagRef = ref;
        advance(ref);
        break;
      }
      case 'goto': {
        const tooth = c.tooth ?? (s.pass === 'fm' && !c.line ? s.fmTooth : s.cursor?.tooth);
        if (tooth == null) break;
        const side = c.side ?? (c.tooth != null && c.line ? DEFAULT_LINE_SIDE : s.cursor?.side ?? 'v');
        if (c.line) {
          s.pass = c.line === 'mg' ? 'mg' : 'ps';
          s.line = c.line === 'ps' || c.line === 'mg' ? 'value' : c.line;
        } else if (s.pass === 'fm') {
          if (s.teeth.find((x) => x.tooth === tooth)?.status === 'present') { s.fmTooth = tooth; anchored = true; } else events.push({ kind: 'notProbed', tooth });
          break;
        } else if (c.tooth != null) {
          // "38 lingual 3 2 4": naming a tooth without a row goes back to the values
          s.line = 'value';
        }
        goTo(tooth, side, c.sites);
        break;
      }
      case 'neighbour': {
        if (s.pass === 'fm') { s.fmTooth = nextPresentTooth(s.teeth, s.fmTooth, c.delta); break; }
        if (!s.cursor) break;
        const next = neighbourTooth(sequence, s.cursor, c.delta);
        if (next) { s.cursor = next; s.flagRef = next; anchored = true; }
        break;
      }
      case 'flag': {
        // On its own row, "sangra" is a yes for the site under the probe
        if (s.line === c.flag && c.tooth == null && !c.sites) { writeMark(c.on); break; }
        let refs: SiteRef[];
        if (c.tooth != null) {
          if (!isProbeableTooth(s.teeth, c.tooth)) { events.push({ kind: 'notProbed', tooth: c.tooth }); break; }
          const side = c.side ?? (s.cursor?.tooth === c.tooth ? s.cursor.side : s.cursor?.side ?? 'v');
          refs = (c.sites ?? [0, 1, 2]).map((index) => ({ tooth: c.tooth!, side, index: index as SiteRef['index'] }));
        } else {
          const base = s.flagRef ?? s.cursor;
          if (!base) break;
          refs = c.sites ? c.sites.map((index) => ({ tooth: base.tooth, side: c.side ?? base.side, index: index as SiteRef['index'] })) : [{ ...base, side: c.side ?? base.side }];
        }
        s.teeth = patchSites(s.teeth, refs, (x) => ({ ...x, [c.flag]: c.on }));
        refs.forEach(touch);
        events.push({ kind: 'marked', refs, flag: c.flag, on: c.on });
        if (refs.length === 1) s.flagRef = refs[0];
        break;
      }
      case 'pass':
        setPass(c.pass);
        break;
      case 'focus':
        s.focus = c.focus;
        break;
      case 'mobility': {
        const tooth = c.tooth ?? (s.pass === 'fm' ? s.fmTooth : s.cursor?.tooth ?? s.fmTooth);
        if (s.teeth.find((x) => x.tooth === tooth)?.status !== 'present') { events.push({ kind: 'notProbed', tooth }); break; }
        if (c.value > 3) { events.push({ kind: 'outOfRange', value: c.value }); break; }
        s.teeth = patchToothIn(s.teeth, tooth, (x) => ({ ...x, mobility: c.value }));
        events.push({ kind: 'mobility', tooth, value: c.value });
        break;
      }
      case 'furcation': {
        const tooth = c.tooth ?? (s.pass === 'fm' ? s.fmTooth : s.cursor?.tooth ?? s.fmTooth);
        const entries = furcationEntries(tooth);
        const entry = c.entry && entries.includes(c.entry) ? c.entry : !c.entry ? entries[0] : c.entry === 'l' || c.entry === 'mp' || c.entry === 'dp' ? entries.find((e) => e !== 'v') : undefined;
        if (!entry || s.teeth.find((x) => x.tooth === tooth)?.status !== 'present') { events.push({ kind: 'notProbed', tooth }); break; }
        if (c.grade > 3) { events.push({ kind: 'outOfRange', value: c.grade }); break; }
        s.teeth = patchToothIn(s.teeth, tooth, (x) => ({ ...x, furcation: { ...x.furcation, [entry]: c.grade } }));
        events.push({ kind: 'furcation', tooth, entry, grade: c.grade });
        break;
      }
      case 'delete': {
        if (s.pass === 'fm' || !s.cursor) break;
        const f = field();
        const k = sequence.findIndex((r) => sameSite(r, s.cursor));
        const target = siteOf(s.teeth, s.cursor)?.[f] == null && k >= 0 ? sequence[(k - 1 + sequence.length) % sequence.length] : s.cursor;
        s.teeth = patchSites(s.teeth, [target], (x) => ({ ...x, [f]: null }));
        s.cursor = target;
        break;
      }
      case 'undo':
      case 'redo':
      case 'confirm':
      case 'discard':
      case 'stop':
        actions.push(c.kind);
        break;
    }
  }

  return { state: s, events, touched, actions };
}
