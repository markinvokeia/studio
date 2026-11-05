'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { ArrowDown, ArrowRight, ArrowUp, Check, ChevronLeft, ChevronRight, CopyPlus, Delete, Redo2, Undo2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ToastAction } from '@/components/ui/toast';

import { usePanelWidth } from '@/hooks/use-panel-width';
import { useToast } from '@/hooks/use-toast';
import { firstEmpty, firstSiteOf, nextPresentTooth, nextSiteIn, presentTeethOf, type ProbeLine, siteKey } from '@/lib/perio/probe';
import { computeStats, probeProgress } from '@/lib/perio/stats';
import {
  attachmentLevel,
  emptyTooth,
  furcationEntries,
  indexAt,
  isMolarPerio,
  isProbeable,
  isProbedIn,
  isUpperPerio,
  PERIO_TEETH,
  type PerioSiteIndex,
  type ProbeMode,
  probeSequence,
  sameSite,
  type SiteRef,
  siteOf,
} from '@/lib/perio/teeth';
import { marginSignOf, type PerioSettings, usePerioSettingsContext } from '@/lib/perio/settings';
import { parseVoice } from '@/lib/perio/voice';
import { JUMP_ALERT_MM, type ProbeState, runVoice, type VoiceEvent } from '@/lib/perio/voice-engine';
import { cn, formatDisplayDate } from '@/lib/utils';

import type { PerioExam, PerioExamType, PerioFurcationEntry, PerioSite, PerioTooth, PerioToothStatus } from '@/lib/types';
import { PerioArch, type PerioPass, ROMAN, severityClass } from './perio-arch';
import { FooterSpacer, PerioStepFooter } from './perio-step-footer';
import { PERIO_EXAM_TYPES } from './perio-screening-step';
import { PerioSettingsButton } from './perio-settings-dialog';
import { PerioVoiceBar, type VoiceFeedback } from './perio-voice-bar';

/** Container width from which the inspector sits beside the chart; below it a keypad docks at the bottom */
const SIDE_INSPECTOR_MIN_WIDTH = 1000;
/** How long the "now on the lower arch" notice stays */
const ARCH_NOTICE_MS = 2800;
/** How long the sites a voice command wrote or went to pulse */
const FLASH_MS = 2600;

type Focus = 'auto' | 'U' | 'L' | 'both';
type Arch = 'U' | 'L';

const archOf = (tooth: number): Arch => (isUpperPerio(tooth) ? 'U' : 'L');

/**
 * What the chart shows so that the probe's arch, and any other arch just written, are in view.
 * A choice that already shows them is kept; otherwise it follows the probe, or shows both.
 */
function focusShowing(current: Focus, probeArch: Arch, also: Arch[] = [], bothWasAutomatic = false): Focus {
  const needed = new Set<Arch>([probeArch, ...also]);
  if (needed.size === 2) return 'both';
  // "Both" opened by a voice command goes back to following the probe once it is not needed
  if (current === 'both' && bothWasAutomatic) return 'auto';
  if (current === 'both' || current === 'auto' || current === probeArch) return current;
  return 'auto';
}
type Flag = 'bop' | 'sup' | 'plaque';
type SetTeeth = (update: (teeth: PerioTooth[]) => PerioTooth[], options?: { skipHistory?: boolean }) => void;

export interface PerioRevealRequest {
  field: 'pd' | 'gm';
  /** Changes on every request, so the same one can be asked twice */
  nonce: number;
}

export interface PerioProbeStepProps {
  teeth: PerioTooth[];
  setTeeth: SetTeeth;
  /** Teeth of the guide exam (the previous one), for the ghost values and "igual que antes" */
  guide: PerioTooth[] | null;
  guideDate?: string;
  /** Earlier exams of the patient, oldest first (tooth history) */
  previousExams: PerioExam[];
  examType: PerioExamType;
  onExamTypeChange: (type: PerioExamType) => void;
  /** Teeth the odontogram had as missing, pontic or implant when the exam started */
  odontogramSummary: string | null;
  readOnly: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  /** Dictated sites not confirmed yet (underlined) */
  pending: ReadonlySet<string>;
  /** Sites written by voice, with the teeth as they were before */
  onDictated: (refs: SiteRef[], before: PerioTooth[]) => void;
  onConfirmDictation: () => void;
  onDiscardDictation: () => void;
  /** Highlight what is missing in a row and take the probe there */
  reveal: PerioRevealRequest | null;
  /** Depth and margin are complete: on to the next step */
  onNext?: () => void;
  /** Probing order (clinic setting) and implants-only exams */
  mode?: ProbeMode;
  /** The clinic settings were changed from here */
  onSettingsChange?: (settings: PerioSettings) => void;
}

const fmt = (v: number | null | undefined) => (v == null ? '·' : v < 0 ? `−${Math.abs(v)}` : String(v));

export function PerioProbeStep(props: PerioProbeStepProps) {
  const { teeth, setTeeth, guide, readOnly } = props;
  const t = useTranslations('PerioRecord');
  const { toast } = useToast();
  const rootRef = React.useRef<HTMLDivElement>(null);
  const width = usePanelWidth(rootRef);
  const side = width === 0 || width >= SIDE_INSPECTOR_MIN_WIDTH;

  const { mode } = props;
  const settings = usePerioSettingsContext();
  const sign = marginSignOf(settings);
  const sequence = React.useMemo(() => probeSequence(teeth, mode), [teeth, mode]);
  const [pass, setPassState] = React.useState<PerioPass>('ps');
  const [line, setLine] = React.useState<ProbeLine>('value');
  const [cursor, setCursor] = React.useState<SiteRef | null>(() => firstEmpty(sequence, teeth, 'pd') ?? sequence[0] ?? null);
  /** Site the marks (bleeding, suppuration, plaque) go to: the last measured or the one picked */
  const [flagRef, setFlagRef] = React.useState<SiteRef | null>(null);
  const [negative, setNegative] = React.useState(false);
  const [focus, setFocus] = React.useState<Focus>('auto');
  const [showGhost, setShowGhost] = React.useState(true);
  const [fmTooth, setFmTooth] = React.useState<number>(() => teeth.find((x) => x.status === 'present')?.tooth ?? 16);
  const [highlight, setHighlight] = React.useState<'pd' | 'gm' | null>(null);
  const [archNotice, setArchNotice] = React.useState<{ arch: 'U' | 'L'; tooth: number; side: 'v' | 'i'; id: number } | null>(null);
  const [flash, setFlash] = React.useState<{ keys: Set<string>; id: number } | null>(null);
  /** "Both" was put by a voice command, not chosen by the person */
  const autoBothRef = React.useRef(false);
  const chooseFocus = (f: Focus) => { autoBothRef.current = false; setFocus(f); };

  const field: 'pd' | 'gm' = pass === 'mg' ? 'gm' : 'pd';
  const byTooth = React.useMemo(() => new Map(teeth.map((x) => [x.tooth, x])), [teeth]);
  const guideBy = React.useMemo(() => (guide ? new Map(guide.map((x) => [x.tooth, x])) : null), [guide]);
  const ghostAt = (ref: SiteRef) => {
    const g = guideBy?.get(ref.tooth);
    return g && isProbeable(g.status) ? g.sites[ref.side][ref.index] : null;
  };
  const presentTeeth = presentTeethOf(teeth);
  const sideShort = (ref: { tooth: number; side: 'v' | 'i' }) => t(ref.side === 'v' ? 'chart.sidesShort.v' : isUpperPerio(ref.tooth) ? 'chart.sidesShort.iUpper' : 'chart.sidesShort.iLower');
  const sideName = (ref: { tooth: number; side: 'v' | 'i' }) => t(ref.side === 'v' ? 'chart.sides.v' : isUpperPerio(ref.tooth) ? 'chart.sides.iUpper' : 'chart.sides.iLower');
  const siteLabel = (ref: SiteRef) => `${ref.tooth} ${sideShort(ref)} · ${t(`chart.sites.${ref.index}`)}`;

  const passCount = (p: PerioPass): [number, number] => {
    if (p === 'fm') return [teeth.filter((x) => x.status === 'present' && x.mobility != null).length, presentTeeth.length];
    const f = p === 'mg' ? 'gm' : 'pd';
    return [sequence.filter((c) => siteOf(teeth, c)?.[f] != null).length, sequence.length];
  };

  // ── The arch the probe is on: a change is announced, so it is never missed ──
  const archRef = React.useRef<'U' | 'L' | null>(null);
  const noticeTimer = React.useRef<number | undefined>(undefined);
  const noticeSeq = React.useRef(0);
  const noteArch = (tooth: number, sideKey: 'v' | 'i') => {
    const arch = isUpperPerio(tooth) ? 'U' : 'L';
    if (archRef.current && archRef.current !== arch) {
      noticeSeq.current += 1;
      setArchNotice({ arch, tooth, side: sideKey, id: noticeSeq.current });
      window.clearTimeout(noticeTimer.current);
      noticeTimer.current = window.setTimeout(() => setArchNotice(null), ARCH_NOTICE_MS);
    }
    archRef.current = arch;
  };
  const flashTimer = React.useRef<number | undefined>(undefined);
  const flashSites = (refs: SiteRef[]) => {
    if (!refs.length) return;
    noticeSeq.current += 1;
    setFlash({ keys: new Set(refs.map(siteKey)), id: noticeSeq.current });
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(null), FLASH_MS);
  };
  React.useEffect(() => () => { window.clearTimeout(noticeTimer.current); window.clearTimeout(flashTimer.current); }, []);

  /**
   * Moves the probe; `pick` also makes it the site the marks go to (the person chose it). The
   * chart always ends up showing the arch the probe is drawing on.
   */
  const moveCursor = (next: SiteRef | null, pick = false, follow = true) => {
    setCursor(next);
    if (pick) setFlagRef(next);
    if (!next) return;
    noteArch(next.tooth, next.side);
    if (follow) setFocus((f) => focusShowing(f, archOf(next.tooth), [], autoBothRef.current));
  };
  const moveFmTooth = (tooth: number, follow = true) => {
    setFmTooth(tooth);
    noteArch(tooth, 'v');
    if (follow) setFocus((f) => focusShowing(f, archOf(tooth), [], autoBothRef.current));
  };

  // ── "What is missing": the sheet asks to show it (status chip or closing checklist) ──
  const [seenReveal, setSeenReveal] = React.useState<number | null>(null);
  if (props.reveal && props.reveal.nonce !== seenReveal) {
    const f = props.reveal.field;
    setSeenReveal(props.reveal.nonce);
    setPassState(f === 'gm' ? 'mg' : 'ps');
    setLine('value');
    setHighlight(f);
    setFocus('both');
    const empty = firstEmpty(sequence, teeth, f);
    if (empty) setCursor(empty);
  }
  const missingCount = highlight ? sequence.filter((c) => siteOf(teeth, c)?.[highlight] == null).length : 0;
  const activeHighlight = highlight && missingCount > 0 ? highlight : null;

  // ── Writing ──
  const patchSite = (ref: SiteRef, patch: (s: PerioSite) => PerioSite) => setTeeth((list) => list.map((x) => (x.tooth !== ref.tooth ? x : {
    ...x,
    sites: { ...x.sites, [ref.side]: x.sites[ref.side].map((s, i) => (i === ref.index ? patch(s) : s)) },
  })));
  const patchTooth = (tooth: number, patch: (x: PerioTooth) => PerioTooth, options?: { skipHistory?: boolean }) =>
    setTeeth((list) => list.map((x) => (x.tooth === tooth ? patch(x) : x)), options);

  const offerNext = (done: PerioPass) => {
    if (done === 'ps') toast({ title: t('probe.toast.depthsDone'), action: <ToastAction altText={t('probe.passes.mg')} onClick={() => setPass('mg')}>{t('probe.passes.mg')}</ToastAction> });
    else if (done === 'mg') toast({ title: t('probe.toast.marginDone'), action: <ToastAction altText={t('probe.passes.fm')} onClick={() => setPass('fm')}>{t('probe.passes.fm')}</ToastAction> });
  };

  // Moves to the next empty site; with none left, offers the next pass
  const advance = (from: SiteRef, after: PerioTooth[]) => {
    const next = nextSiteIn(sequence, after, from, field);
    if (next) { moveCursor(next); return; }
    const following = nextSiteIn(sequence, after, from);
    if (following) moveCursor(following);
    offerNext(pass);
  };

  const applyToSite = (ref: SiteRef, patch: (s: PerioSite) => PerioSite) => {
    const after = teeth.map((x) => (x.tooth !== ref.tooth ? x : { ...x, sites: { ...x.sites, [ref.side]: x.sites[ref.side].map((s, i) => (i === ref.index ? patch(s) : s)) } }));
    patchSite(ref, patch);
    setFlagRef(ref);
    advance(ref, after);
  };

  function enterDigit(d: number) {
    if (readOnly) return;
    if (line !== 'value') setLine('value');
    if (pass === 'fm') {
      if (d > 3) { toast({ title: t('probe.toast.mobilityRange') }); return; }
      patchTooth(fmTooth, (x) => ({ ...x, mobility: d }));
      moveFmTooth(nextPresentTooth(teeth, fmTooth));
      return;
    }
    if (!cursor) return;
    const ref = cursor;
    if (pass === 'ps') {
      const g = ghostAt(ref);
      if (g?.pd != null && Math.abs(d - g.pd) >= JUMP_ALERT_MM) jumpToast(ref, g.pd, d);
      applyToSite(ref, (s) => ({ ...s, pd: d, source: 'manual' }));
    } else {
      // The record keeps recession positive, whatever sign the clinic types it with
      const value = sign * (negative ? -d : d);
      setNegative(false);
      applyToSite(ref, (s) => ({ ...s, gm: value, source: 'manual' }));
    }
  }

  function jumpToast(ref: SiteRef, from: number, to: number) {
    toast({
      title: t('probe.toast.jump', { site: siteLabel(ref), from, to }),
      action: <ToastAction altText={t('probe.toast.fix')} onClick={() => moveCursor(ref, true)}>{t('probe.toast.fix')}</ToastAction>,
    });
  }

  /** "+1": 10 mm or more on the last value */
  function bump() {
    const ref = flagRef ?? cursor;
    if (readOnly || !ref || pass === 'fm') return;
    const value = siteOf(teeth, ref)?.[field];
    if (value == null) return;
    const next = Math.min(15, value + 1);
    patchSite(ref, (s) => ({ ...s, [field]: next }));
    toast({ title: `${siteLabel(ref)}: ${next} mm` });
  }

  /** Enter / "Igual que antes": the guide exam's value, recorded as measured today */
  function acceptGhost() {
    if (readOnly) return;
    if (pass === 'fm') {
      patchTooth(fmTooth, (x) => ({ ...x, mobility: x.mobility ?? 0 }));
      moveFmTooth(nextPresentTooth(teeth, fmTooth));
      return;
    }
    if (!cursor) return;
    const g = ghostAt(cursor);
    let value = g ? g[field] : null;
    if (value == null && field === 'gm') value = 0;
    if (value == null) { toast({ title: t('probe.toast.noPrevious') }); return; }
    const v = value;
    applyToSite(cursor, (s) => ({ ...s, [field]: v, source: 'same' }));
  }

  function backspace() {
    if (readOnly || pass === 'fm' || !cursor) return;
    const k = sequence.findIndex((c) => sameSite(c, cursor));
    const target = siteOf(teeth, cursor)?.[field] == null ? sequence[(k - 1 + sequence.length) % sequence.length] : cursor;
    patchSite(target, (s) => ({ ...s, [field]: null }));
    moveCursor(target);
  }

  function toggleFlag(flag: Flag, ref = flagRef ?? cursor) {
    if (readOnly || !ref) return;
    const on = !siteOf(teeth, ref)?.[flag];
    patchSite(ref, (s) => ({ ...s, [flag]: on }));
    setFlagRef(ref);
    toast({ title: t(on ? 'probe.toast.flagOn' : 'probe.toast.flagOff', { flag: t(`probe.flags.${flag}`), site: siteLabel(ref) }) });
  }

  /** A tap on a bleeding dot cycles: none → bleeds → bleeds and suppurates → none */
  function cycleDot(ref: SiteRef) {
    if (readOnly) return;
    patchSite(ref, (s) => (!s.bop && !s.sup ? { ...s, bop: true } : s.bop && !s.sup ? { ...s, sup: true } : { ...s, bop: false, sup: false }));
    setFlagRef(ref);
  }

  function cycleFurcation(tooth: number, entry: PerioFurcationEntry) {
    if (readOnly) return;
    const grade = (((byTooth.get(tooth)?.furcation[entry] ?? 0) + 1) % 4);
    patchTooth(tooth, (x) => ({ ...x, furcation: { ...x.furcation, [entry]: grade } }));
    toast({ title: t('chart.furcationTitle', { tooth, entry: t(`chart.furcation.${entry}`), grade: grade ? ROMAN[grade] : t('chart.noLesion') }) });
  }

  function setMobility(tooth: number, mobility: number) {
    if (readOnly) return;
    patchTooth(tooth, (x) => ({ ...x, mobility }));
  }

  function setToothStatus(tooth: number, status: PerioToothStatus) {
    if (readOnly) return;
    // Missing teeth and pontics are not probed: their values go away
    patchTooth(tooth, (x) => (isProbeable(status) ? { ...x, status } : { ...emptyTooth(tooth, status), note: x.note }));
  }

  function setPass(next: PerioPass) {
    setPassState(next);
    setLine('value');
    setNegative(false);
    if (next !== 'fm') {
      const empty = firstEmpty(sequence, teeth, next === 'mg' ? 'gm' : 'pd');
      if (empty) moveCursor(empty);
    } else {
      moveFmTooth(presentTeeth.find((n) => byTooth.get(n)?.mobility == null) ?? presentTeeth[0] ?? fmTooth);
    }
  }

  function moveOnFace(delta: number) {
    if (!cursor) return;
    const arch = PERIO_TEETH.filter((n) => isUpperPerio(n) === isUpperPerio(cursor.tooth) && isProbeable(byTooth.get(n)?.status ?? 'missing'));
    const list = arch.flatMap((tooth) => ([0, 1, 2] as PerioSiteIndex[]).map((p) => ({ tooth, side: cursor.side, index: indexAt(tooth, p) })));
    const k = list.findIndex((x) => sameSite(x, cursor));
    const next = list[Math.max(0, Math.min(list.length - 1, k + delta))];
    if (next) moveCursor(next, true);
  }

  // ── Chart clicks ──
  const onCellClick = (ref: SiteRef, kind: 'pd' | 'gm') => {
    moveCursor(ref, true);
    setLine('value');
    if (kind === 'pd' && pass !== 'ps') setPassState('ps');
    if (kind === 'gm' && pass !== 'mg') setPassState('mg');
  };
  const onToothClick = (tooth: number) => {
    const status = byTooth.get(tooth)?.status ?? 'missing';
    if (pass === 'fm') { if (status === 'present') moveFmTooth(tooth); return; }
    if (!isProbeable(status)) { setFmTooth(tooth); toast({ title: t('probe.toast.notProbed', { tooth, status: t(`chart.status.${status}`) }) }); return; }
    moveCursor(firstSiteOf(sequence, tooth, cursor?.side ?? 'v') ?? { tooth, side: cursor?.side ?? 'v', index: 1 }, true);
  };
  const onMobilityClick = (tooth: number) => {
    if (pass === 'fm') { moveFmTooth(tooth); return; }
    setMobility(tooth, ((byTooth.get(tooth)?.mobility ?? 0) + 1) % 4);
  };

  // ── Voice: one utterance is one change (one undo step) ──
  const liveRef = React.useRef<ProbeState | null>(null);
  const currentState = (): ProbeState => ({ teeth, cursor, pass, line, flagRef, fmTooth, focus });
  React.useEffect(() => { liveRef.current = null; }, [teeth, cursor, pass, line, flagRef, fmTooth, focus]);

  const describe = (events: VoiceEvent[]): { understood: string[]; warnings: string[] } => {
    const understood: string[] = [];
    const warnings: string[] = [];
    // Consecutive values on one face read as one item: "23 P · PS 3 2 3"
    const groups: { key: string; label: string; values: string[] }[] = [];
    let open = false;
    const flush = () => {
      const g = open ? groups[groups.length - 1] : null;
      if (g) understood.push(`${g.label} ${g.values.join(' ')}`);
      open = false;
    };
    for (const e of events) {
      if (e.kind === 'wrote') {
        const key = `${e.ref.tooth}${e.ref.side}${e.field}`;
        const label = `${e.ref.tooth} ${sideShort(e.ref)} · ${t(e.field === 'gm' ? 'chart.rows.gm' : 'chart.rows.pd')}`;
        if (!open || groups[groups.length - 1].key !== key) { flush(); groups.push({ key, label, values: [] }); open = true; }
        groups[groups.length - 1].values.push(fmt(e.value));
        continue;
      }
      flush();
      if (e.kind === 'marked') {
        const where = e.refs.length === 3 && e.refs.every((r) => r.tooth === e.refs[0].tooth) ? `${e.refs[0].tooth} ${sideShort(e.refs[0])}` : e.refs.map(siteLabel).join(', ');
        understood.push(t(e.on ? 'voice.feedback.marked' : 'voice.feedback.unmarked', { flag: t(`probe.flags.${e.flag}`), site: where }));
      } else if (e.kind === 'mobility') understood.push(t('voice.feedback.mobility', { tooth: e.tooth, grade: ROMAN[e.value] }));
      else if (e.kind === 'furcation') understood.push(t('chart.furcationTitle', { tooth: e.tooth, entry: t(`chart.furcation.${e.entry}`), grade: e.grade ? ROMAN[e.grade] : t('chart.noLesion') }));
      else if (e.kind === 'notProbed') warnings.push(t('voice.feedback.notProbed', { tooth: e.tooth }));
      else if (e.kind === 'outOfRange') warnings.push(t('voice.feedback.outOfRange', { value: e.value }));
      else if (e.kind === 'noPrevious') warnings.push(t('probe.toast.noPrevious'));
    }
    flush();
    return { understood, warnings };
  };

  const handlePhrase = (text: string): VoiceFeedback => {
    const { commands, unknown } = parseVoice(text);
    if (readOnly) return { heard: text, understood: [], warnings: [t('voice.feedback.readOnly')], unknown: [] };
    const before = liveRef.current ?? currentState();
    const result = runVoice(before, commands, guide, mode, sign);
    const s = result.state;
    if (s.teeth !== before.teeth) {
      setTeeth(() => s.teeth);
      if (result.touched.length) props.onDictated(result.touched, before.teeth);
    }
    if (s.pass !== before.pass) { setPassState(s.pass); setNegative(false); }
    if (s.line !== before.line) setLine(s.line);
    const moved = !sameSite(s.cursor, before.cursor);
    if (moved) moveCursor(s.cursor, false, false);
    if (!sameSite(s.flagRef, before.flagRef)) setFlagRef(s.flagRef);
    if (s.fmTooth !== before.fmTooth) moveFmTooth(s.fmTooth, false);
    // What was said is put in view: the probe's arch and every arch written, unless an arch was asked for
    const writtenTeeth = [
      ...result.touched.map((r) => r.tooth),
      ...result.events.flatMap((e) => (e.kind === 'mobility' || e.kind === 'furcation' ? [e.tooth] : [])),
    ];
    const probeTooth = s.pass === 'fm' ? s.fmTooth : s.cursor?.tooth ?? s.fmTooth;
    const asked = commands.some((c) => c.kind === 'focus');
    s.focus = asked ? s.focus : focusShowing(before.focus, archOf(probeTooth), writtenTeeth.map(archOf), autoBothRef.current);
    autoBothRef.current = !asked && s.focus === 'both' && (before.focus !== 'both' || autoBothRef.current);
    if (s.focus !== focus) setFocus(s.focus);
    // …and pulses for a moment: what was written, or the face the probe went to
    const reached = moved && s.cursor && s.pass !== 'fm' ? ([0, 1, 2] as PerioSiteIndex[]).map((index) => ({ tooth: s.cursor!.tooth, side: s.cursor!.side, index })) : [];
    flashSites(result.touched.length ? result.touched : reached);
    liveRef.current = s;

    result.events.forEach((e) => {
      if (e.kind === 'jump') jumpToast(e.ref, e.from, e.to);
      if (e.kind === 'passDone') offerNext(e.pass);
    });
    result.actions.forEach((a) => {
      if (a === 'undo') { liveRef.current = null; props.onUndo(); }
      else if (a === 'redo') { liveRef.current = null; props.onRedo(); }
      else if (a === 'confirm') props.onConfirmDictation();
      else if (a === 'discard') { liveRef.current = null; props.onDiscardDictation(); }
    });

    const { understood, warnings } = describe(result.events);
    // Where the probe went, when the utterance moved it without writing
    if (!understood.length && s.cursor && (!sameSite(s.cursor, before.cursor) || s.line !== before.line || s.pass !== before.pass)) {
      understood.push(t('voice.feedback.now', { where: lineLabel(s.pass, s.line, s.cursor) }));
    }
    if (s.focus !== focus) understood.push(t('voice.feedback.focus', { focus: t(`probe.focus.${s.focus}`) }));
    if (result.actions.length) understood.push(...result.actions.filter((a) => a !== 'stop').map((a) => t(`voice.feedback.actions.${a}`)));
    return { heard: text, understood, warnings, unknown, stop: result.actions.includes('stop') };
  };

  const lineLabel = (p: PerioPass, l: ProbeLine, ref: SiteRef | null) => {
    if (p === 'fm') return t('probe.passes.fm');
    const row = l === 'value' ? t(p === 'mg' ? 'chart.rows.gm' : 'chart.rows.pd') : t(`voice.lines.${l}`);
    return ref ? `${row} · ${siteLabel(ref)}` : row;
  };

  // ── Start from the previous exam: fills only what is still empty; it stays to confirm, like dictation ──
  type CopyWhat = PerioPass | 'all';
  const copyPlan = (what: CopyWhat) => {
    const sites: SiteRef[] = [];
    let teethTouched = 0;
    const next = teeth.map((x) => {
      const g = guideBy?.get(x.tooth);
      if (!g) return x;
      let out = x;
      if (what !== 'fm' && isProbedIn(x.status, mode) && isProbeable(g.status)) {
        const side = (s: 'v' | 'i') => x.sites[s].map((site, i) => {
          const before = g.sites[s][i];
          let copy = site;
          if ((what === 'ps' || what === 'all') && site.pd == null && before.pd != null) copy = { ...copy, pd: before.pd, bop: before.bop, sup: before.sup, plaque: before.plaque, source: 'same' };
          if ((what === 'mg' || what === 'all') && site.gm == null && before.gm != null) copy = { ...copy, gm: before.gm, source: 'same' };
          if (copy !== site) sites.push({ tooth: x.tooth, side: s, index: i as PerioSiteIndex });
          return copy;
        });
        out = { ...out, sites: { v: side('v'), i: side('i') } };
      }
      if ((what === 'fm' || what === 'all') && x.status === 'present' && g.status === 'present') {
        const mobility = x.mobility ?? g.mobility;
        const furcation = { ...g.furcation, ...x.furcation };
        if (mobility !== x.mobility || Object.keys(furcation).length !== Object.keys(x.furcation).length) {
          out = { ...out, mobility, furcation };
          teethTouched += 1;
        }
      }
      return out;
    });
    return { next, sites, teethTouched };
  };
  /** What each pass could take from the previous exam (32 teeth: cheap to count on every render) */
  const copyCounts = guideBy ? { ps: copyPlan('ps').sites.length, mg: copyPlan('mg').sites.length, fm: copyPlan('fm').teethTouched } : null;

  function copyFromGuide(what: CopyWhat) {
    if (readOnly || !guideBy) return;
    const { next, sites, teethTouched } = copyPlan(what);
    if (!sites.length && !teethTouched) { toast({ title: t('probe.copy.nothing') }); return; }
    const before = teeth;
    setTeeth(() => next);
    if (sites.length) props.onDictated(sites, before);
    // The probe goes to what is still missing after the copy, or to the start to review
    const target = what === 'all' ? pass : what;
    if (target !== pass) { setPassState(target); setLine('value'); setNegative(false); }
    if (target !== 'fm') moveCursor(firstEmpty(sequence, next, target === 'mg' ? 'gm' : 'pd') ?? sequence[0] ?? null);
    toast({
      title: t('probe.copy.done', { sites: sites.length, teeth: teethTouched }),
      description: t('probe.copy.review'),
      action: <ToastAction altText={t('probe.undo')} onClick={props.onUndo}>{t('probe.copy.undo')}</ToastAction>,
    });
  }

  // ── Keyboard: digits, Enter, ⌫, arrows, B/S/P, −, +, Ctrl+Z, / ──
  const voiceInputRef = React.useRef<HTMLInputElement>(null);
  const handleKey = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    const tag = target?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) return;
    if (!rootRef.current?.offsetParent || document.querySelector('[role="alertdialog"]') || readOnly) return;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); if (e.shiftKey) props.onRedo(); else props.onUndo(); return; }
    if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); props.onRedo(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '/') { e.preventDefault(); voiceInputRef.current?.focus(); return; }
    if (e.key === 'Escape' && line !== 'value') { setLine('value'); return; }
    if (/^\d$/.test(e.key)) { e.preventDefault(); enterDigit(Number(e.key)); return; }
    if (e.key === 'Enter') { e.preventDefault(); acceptGhost(); return; }
    if (e.key === 'Backspace') { e.preventDefault(); backspace(); return; }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      if (pass === 'fm') moveFmTooth(nextPresentTooth(teeth, fmTooth, e.key === 'ArrowRight' ? 1 : -1));
      else moveOnFace(e.key === 'ArrowLeft' ? -1 : 1);
      return;
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); if (cursor) moveCursor({ ...cursor, side: cursor.side === 'v' ? 'i' : 'v' }, true); return; }
    if (e.key === '-' && pass === 'mg') { setNegative((n) => !n); return; }
    if (e.key === '+') { bump(); return; }
    if (pass === 'ps' && k === 'b') toggleFlag('bop');
    else if (pass === 'ps' && k === 's') toggleFlag('sup');
    else if (pass === 'ps' && k === 'p') toggleFlag('plaque');
  };
  const keyRef = React.useRef(handleKey);
  React.useEffect(() => { keyRef.current = handleKey; });
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Keep what is being drawn on screen: the pulsing sites, or the probe ──
  const chartScrollRef = React.useRef<HTMLDivElement>(null);
  const cursorKey = cursor ? siteKey(cursor) : '';
  const shownKey = focus === 'auto' ? `auto-${cursor ? archOf(cursor.tooth) : ''}` : focus;
  React.useEffect(() => {
    // After the arch swap has painted
    const id = window.requestAnimationFrame(() => {
      const box = chartScrollRef.current;
      const el = box?.querySelector('[data-flash]') ?? box?.querySelector('[data-cursor]');
      el?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    });
    return () => window.cancelAnimationFrame(id);
  }, [cursorKey, flash?.id, shownKey, pass, line]);

  // ── Render ──
  const [done, total] = passCount(pass);
  const pct = total ? Math.round((100 * done) / total) : 0;
  const passDone = total > 0 && done >= total;
  const activeTooth = pass === 'fm' ? fmTooth : cursor?.tooth ?? fmTooth;
  const probeArch: 'U' | 'L' = isUpperPerio(activeTooth) ? 'U' : 'L';
  const arches: ('U' | 'L')[] = focus === 'both' ? ['U', 'L'] : focus === 'U' ? ['U'] : focus === 'L' ? ['L'] : [probeArch];
  const g = cursor ? ghostAt(cursor) : null;
  const ghostValue = g ? g[field] : null;
  const progress = probeProgress(teeth, mode);
  const probed = progress.total > 0 && progress.pd === progress.total && progress.gm === progress.total;
  const markTarget = pass === 'ps' ? flagRef ?? cursor : null;

  const guideBar = (
    <div className={cn('flex flex-wrap items-center gap-2.5 border-b px-3 py-2 text-[13px]', passDone ? 'bg-gradient-to-r from-emerald-500/10 to-transparent' : 'bg-gradient-to-r from-primary/10 to-transparent')}>
      {passDone ? (
        <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-emerald-600" />{t('probe.guide.passDone', { done, total })}</span>
      ) : (
        <span className="flex min-w-0 items-center gap-2">
          <span className="inline-grid h-7 min-w-[34px] place-items-center rounded-lg bg-primary px-1.5 text-[13px] font-bold text-primary-foreground">{activeTooth}</span>
          <span className="min-w-0 truncate">
            {pass === 'fm' || !cursor ? t('probe.guide.fm') : line !== 'value' ? `${siteLabel(cursor)} · ${t(`probe.guide.line.${line}`)}` : `${siteLabel(cursor)} · ${t(pass === 'ps' ? 'probe.guide.depth' : 'probe.guide.margin')}`}
            {negative && pass === 'mg' && <b> · {t(sign < 0 ? 'probe.guide.recession' : 'probe.guide.enlargement')}</b>}
          </span>
        </span>
      )}
      <span className="h-1.5 min-w-[100px] max-w-[240px] flex-1 overflow-hidden rounded-full bg-muted" title={`${pct}%`}>
        <span className="block h-full rounded-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
      </span>
      <span className="text-xs tabular-nums text-muted-foreground">{done}/{total}</span>
      {!readOnly && !probed && <span className="hidden text-[11.5px] text-muted-foreground xl:inline">{t(`probe.keys.${pass}`, { value: ghostValue != null ? fmt(ghostValue) : '–' })}</span>}
    </div>
  );

  return (
    <div ref={rootRef} className={cn('grid min-h-0 gap-3 p-3', side ? 'h-full grid-cols-[minmax(0,1fr)_330px] grid-rows-[minmax(0,1fr)]' : 'grid-cols-1')}>
      <section className="flex min-h-0 min-w-0 flex-col gap-2">
        {/* Exam banner and, on its right, the dictation */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border bg-card px-3 py-1.5 text-[12.5px] text-muted-foreground">
          <div className="flex min-w-0 flex-[0_1_auto] flex-wrap items-center gap-2.5">
            <span>{t('probe.banner.examType')}</span>
            <Select value={props.examType} onValueChange={(v) => props.onExamTypeChange(v as PerioExamType)} disabled={readOnly}>
              <SelectTrigger className="h-7 w-auto gap-1 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PERIO_EXAM_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>{t(`examTypes.${type}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span>· {props.guideDate ? t('probe.banner.guide', { date: formatDisplayDate(props.guideDate) }) : t('probe.banner.noGuide')}</span>
            {props.odontogramSummary && <span className="max-w-[340px] truncate" title={props.odontogramSummary}>· {props.odontogramSummary}</span>}
            {mode?.implantsOnly && <span className="rounded-full bg-primary/10 px-2 py-px text-[11.5px] font-medium text-primary">{t('probe.banner.implantsOnly')}</span>}
            <PerioSettingsButton onSaved={props.onSettingsChange} />
          </div>
          {!readOnly && (
            <PerioVoiceBar
              inputRef={voiceInputRef}
              onPhrase={handlePhrase}
              pendingCount={props.pending.size}
              onConfirm={props.onConfirmDictation}
              onDiscard={props.onDiscardDictation}
              lineLabel={line !== 'value' && cursor ? lineLabel(pass, line, cursor) : null}
              onLeaveLine={() => setLine('value')}
            />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label={t('probe.passes.label')} className="flex flex-wrap gap-1.5">
            {(['ps', 'mg', 'fm'] as PerioPass[]).map((p, i) => {
              const [a, b] = passCount(p);
              const complete = b > 0 && a >= b;
              const fillable = copyCounts?.[p] ?? 0;
              return (
                <div key={p} className="flex flex-col items-start gap-0.5">
                <button
                  type="button"
                  onClick={() => setPass(p)}
                  aria-pressed={pass === p}
                  className={cn('inline-flex h-[34px] items-center gap-2 rounded-full border bg-card pl-2 pr-3 text-[12.5px] font-medium text-muted-foreground', pass === p && 'border-primary bg-primary/10 text-primary dark:text-foreground')}
                >
                  <span className={cn('grid h-5 w-5 place-items-center rounded-full bg-muted text-[11px] font-bold', pass === p && 'bg-primary text-primary-foreground', complete && pass !== p && 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400')}>
                    {complete && pass !== p ? <Check className="h-3 w-3" /> : i + 1}
                  </span>
                  {t(`probe.passes.${p}`)}
                  <small className="tabular-nums text-muted-foreground">{a}/{b}</small>
                </button>
                {!readOnly && fillable > 0 && (
                  <button type="button" onClick={() => copyFromGuide(p)} className="inline-flex items-center gap-1 pl-2 text-[11.5px] font-medium text-primary hover:underline" title={t(p === 'fm' ? 'probe.copy.hintTeeth' : 'probe.copy.hintSites', { count: fillable })}>
                    <CopyPlus className="h-3 w-3" />{t('probe.copy.pass')}
                  </button>
                )}
                </div>
              );
            })}
          </div>
          <div role="radiogroup" aria-label={t('probe.focus.label')} className="ml-auto inline-flex gap-0.5 rounded-[11px] border bg-muted/60 p-0.5">
            {(['auto', 'U', 'L', 'both'] as Focus[]).map((f) => (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={focus === f}
                onClick={() => chooseFocus(f)}
                className={cn(
                  'h-7 whitespace-nowrap rounded-[9px] px-2.5 text-[12.5px] font-medium text-muted-foreground',
                  focus === f && 'bg-background font-semibold text-foreground shadow-sm',
                  // While following the probe, the arch it is on is marked too
                  focus === 'auto' && f === probeArch && 'text-primary ring-1 ring-inset ring-primary/40',
                )}
              >
                {f === 'auto' ? (
                  <span className="inline-flex items-center gap-1">
                    {t('probe.focus.auto')}
                    <span className={cn('inline-flex items-center gap-0.5 rounded-md px-1 text-[11px] font-bold', focus === 'auto' ? 'bg-primary/12 text-primary' : 'bg-muted')}>
                      {probeArch === 'U' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                      {t(`probe.focus.${probeArch}`)}
                    </span>
                  </span>
                ) : t(`probe.focus.${f}`)}
              </button>
            ))}
          </div>
          {guide && (
            <div className="flex flex-col items-start gap-0.5">
              <label className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
                <Switch checked={showGhost} onCheckedChange={setShowGhost} />
                {t('probe.showGuide')}
              </label>
              {!readOnly && copyCounts && copyCounts.ps + copyCounts.mg + copyCounts.fm > 0 && (
                <button type="button" onClick={() => copyFromGuide('all')} className="inline-flex items-center gap-1 text-[11.5px] font-medium text-primary hover:underline">
                  <CopyPlus className="h-3 w-3" />{t('probe.copy.all')}
                </button>
              )}
            </div>
          )}
          {!readOnly && (
            <span className="flex items-center gap-0.5">
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={props.onUndo} disabled={!props.canUndo} aria-label={t('probe.undo')} title={t('probe.undo')}><Undo2 className="h-4 w-4" /></Button>
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={props.onRedo} disabled={!props.canRedo} aria-label={t('probe.redo')} title={t('probe.redo')}><Redo2 className="h-4 w-4" /></Button>
            </span>
          )}
        </div>

        <div className={cn('relative flex min-h-0 flex-col overflow-hidden rounded-2xl border bg-card', side && 'flex-1')}>
          {guideBar}
          {activeHighlight && (
            <div className="flex flex-wrap items-center gap-2 border-b bg-amber-500/10 px-3 py-1.5 text-[12.5px] text-amber-800 dark:text-amber-300">
              <span className="inline-block h-3 w-4 rounded-[4px] border border-dashed" style={{ borderColor: 'var(--perio-missing)', background: 'var(--perio-missing-soft)' }} aria-hidden />
              {t(activeHighlight === 'pd' ? 'probe.reveal.depths' : 'probe.reveal.margin', { count: missingCount })}
              <Button type="button" variant="ghost" size="sm" className="ml-auto h-6 px-2 text-xs" onClick={() => setHighlight(null)}>
                <X className="mr-1 h-3 w-3" />{t('probe.reveal.clear')}
              </Button>
            </div>
          )}
          {archNotice && (
            <div key={archNotice.id} role="status" className="pointer-events-none absolute inset-x-0 top-14 z-10 flex justify-center animate-in fade-in zoom-in-95 duration-300">
              <span className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg">
                {archNotice.arch === 'L' ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />}
                {t('probe.archNotice', { arch: t(archNotice.arch === 'U' ? 'chart.upperArch' : 'chart.lowerArch'), tooth: archNotice.tooth, face: sideName(archNotice) })}
              </span>
            </div>
          )}
          <div ref={chartScrollRef} className="min-h-0 flex-1 overflow-auto px-2.5 pb-2">
            <div key={arches.join('-')} className="flex min-w-[760px] flex-col animate-in fade-in slide-in-from-bottom-1 duration-300">
              {arches.map((arch) => {
                const here = arch === probeArch;
                return (
                  <React.Fragment key={arch}>
                    <div className={cn('flex items-center gap-2 px-0.5 pb-0.5 pt-1.5 text-[10.5px] font-semibold uppercase tracking-wider after:flex-1 after:border-t', here ? 'text-primary after:border-primary/40' : 'text-muted-foreground')}>
                      {t(arch === 'U' ? 'chart.upperArch' : 'chart.lowerArch')}
                      {here && arches.length > 1 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/12 px-2 py-px text-[10px] normal-case tracking-normal">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" aria-hidden />{t('chart.probeHere')}
                        </span>
                      )}
                    </div>
                    <div className={cn('transition-opacity', arches.length > 1 && !here && 'opacity-60 hover:opacity-100')}>
                      <PerioArch
                        arch={arch}
                        teeth={teeth}
                        ghost={showGhost ? guide : null}
                        cursor={cursor}
                        pass={pass}
                        line={line}
                        selectedTooth={activeTooth}
                        flagTarget={markTarget}
                        pending={props.pending}
                        highlight={activeHighlight}
                        flash={flash?.keys}
                        onCellClick={readOnly ? undefined : onCellClick}
                        onDotClick={readOnly ? undefined : cycleDot}
                        onFurcationClick={readOnly ? undefined : cycleFurcation}
                        onMobilityClick={readOnly ? undefined : onMobilityClick}
                        onToothClick={onToothClick}
                      />
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
          <Legend />
        </div>
      </section>

      <aside className={cn('flex min-h-0 flex-col overflow-auto rounded-2xl border bg-card', side && 'h-full')} aria-label={t('inspector.label')}>
        <PerioInspector
          teeth={teeth}
          tooth={activeTooth}
          pass={pass}
          cursor={cursor}
          markTarget={markTarget}
          negative={negative}
          readOnly={readOnly}
          mode={mode}
          guideBy={guideBy}
          previousExams={props.previousExams}
          docked={!side}
          onSelectSite={(ref, kind) => onCellClick(ref, kind)}
          onNavigate={(delta) => (pass === 'fm' ? moveFmTooth(nextPresentTooth(teeth, fmTooth, delta)) : moveOnFace(delta))}
          onDigit={enterDigit}
          onBump={bump}
          onAccept={acceptGhost}
          onBackspace={backspace}
          onToggleFlag={(flag, ref) => toggleFlag(flag, ref)}
          onToggleNegative={() => setNegative((n) => !n)}
          onMobility={setMobility}
          onFurcation={(tooth, entry, grade) => patchTooth(tooth, (x) => ({ ...x, furcation: { ...x.furcation, [entry]: grade } }))}
          onStatus={setToothStatus}
          onNote={(tooth, note) => patchTooth(tooth, (x) => ({ ...x, note }), { skipHistory: true })}
          ghostValue={ghostValue}
        />
      </aside>

      {props.onNext && (
        <PerioStepFooter>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted-foreground">
            {(['ps', 'mg', 'fm'] as PerioPass[]).map((p) => {
              const [a, b] = passCount(p);
              return (
                <span key={p} className={cn('inline-flex items-center gap-1', b > 0 && a >= b && 'text-emerald-700 dark:text-emerald-400')}>
                  {b > 0 && a >= b && <Check className="h-3.5 w-3.5" />}{t(`probe.passes.${p}`)} <b className="tabular-nums">{a}/{b}</b>
                </span>
              );
            })}
          </span>
          <FooterSpacer />
          <Button type="button" variant={probed ? 'default' : 'outline'} onClick={props.onNext}>
            {t('probe.nextStep')}<ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </PerioStepFooter>
      )}

      {/* Tablet: the keypad stays at the bottom, so the chart keeps the screen */}
      {!side && !readOnly && (
        <div className="sticky bottom-2 z-10 flex flex-wrap items-center gap-1.5 rounded-2xl border bg-card p-2 shadow-lg">
          <span className="inline-grid h-7 min-w-[34px] place-items-center rounded-lg bg-primary px-1.5 text-[13px] font-bold text-primary-foreground">{activeTooth}</span>
          {pass === 'fm' ? (
            <>
              {[0, 1, 2, 3].map((m) => (
                <Button key={m} type="button" variant={byTooth.get(fmTooth)?.mobility === m ? 'default' : 'outline'} className="h-11 min-w-11" onClick={() => setMobility(fmTooth, m)}>{ROMAN[m]}</Button>
              ))}
              <Button type="button" variant="secondary" className="h-11" onClick={acceptGhost}>{t('inspector.nextTooth')}</Button>
            </>
          ) : (
            <>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d) => (
                <Button key={d} type="button" variant="outline" className="h-11 min-w-11 text-[17px] font-semibold tabular-nums" onClick={() => enterDigit(d)}>{d}</Button>
              ))}
              <Button type="button" variant="secondary" className="h-11" onClick={acceptGhost}>{ghostValue != null ? t('inspector.sameAsBefore', { value: fmt(ghostValue) }) : t('inspector.same')}</Button>
              {pass === 'ps' ? (
                <>
                  {(['bop', 'sup', 'plaque'] as Flag[]).map((flag) => (
                    <Button key={flag} type="button" variant="outline" className={cn('h-11', markTarget && siteOf(teeth, markTarget)?.[flag] && FLAG_ON[flag])} onClick={() => toggleFlag(flag)}>{t(`probe.flags.${flag}`)}</Button>
                  ))}
                  {markTarget && <span className="text-[11.5px] text-muted-foreground">{t('inspector.marksOn', { site: siteLabel(markTarget) })}</span>}
                </>
              ) : (
                <Button type="button" variant={negative ? 'default' : 'outline'} className="h-11" onClick={() => setNegative((n) => !n)}>−</Button>
              )}
              <Button type="button" variant="outline" className="h-11" onClick={backspace} aria-label={t('inspector.backspace')}><Delete className="h-4 w-4" /></Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const FLAG_ON: Record<Flag, string> = {
  bop: 'border-red-500 bg-red-500/10 text-red-700 dark:text-red-300',
  sup: 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  plaque: 'border-cyan-600 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
};
const FLAG_COLOR: Record<Flag, string> = { bop: 'var(--perio-bop)', sup: 'var(--perio-sup)', plaque: 'var(--perio-pl)' };

function Legend() {
  const t = useTranslations('PerioRecord.legend');
  const line = (color: string, label: string, dashed = false) => (
    <span className="inline-flex items-center gap-1.5"><i className="inline-block w-[18px]" style={{ borderTop: `${dashed ? 1 : 2}px ${dashed ? 'dashed' : 'solid'} ${color}` }} />{label}</span>
  );
  const dot = (color: string, label: string) => <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />{label}</span>;
  return (
    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 border-t px-3 py-2 text-[11.5px] text-muted-foreground">
      {line('var(--perio-gm)', t('margin'))}
      {line('var(--perio-pd)', t('pocket'))}
      {line('hsl(var(--border))', t('cej'), true)}
      {dot('var(--perio-bop)', t('bop'))}
      {dot('var(--perio-sup)', t('sup'))}
      <span className="inline-flex items-center gap-1.5"><i className="inline-block h-[3px] w-2.5 rounded-sm" style={{ background: 'var(--perio-pl)' }} />{t('plaque')}</span>
      {dot('var(--perio-s4)', t('s4'))}
      {dot('var(--perio-s5)', t('s5'))}
      {dot('var(--perio-s6)', t('s6'))}
      <span className="inline-flex items-center gap-1.5"><i className="inline-block h-3 w-3 rounded-full border border-dashed border-primary" />{t('markTarget')}</span>
      <span className="inline-flex items-center gap-1.5"><i className="inline-block h-[2px] w-3 rounded" style={{ background: 'var(--perio-dict)' }} />{t('dictated')}</span>
    </div>
  );
}

interface PerioInspectorProps {
  teeth: PerioTooth[];
  tooth: number;
  pass: PerioPass;
  cursor: SiteRef | null;
  /** Site the marks go to */
  markTarget: SiteRef | null;
  negative: boolean;
  readOnly: boolean;
  mode?: ProbeMode;
  guideBy: Map<number, PerioTooth> | null;
  previousExams: PerioExam[];
  /** The keypad is docked at the bottom (tablet): not repeated here */
  docked: boolean;
  ghostValue: number | null;
  onSelectSite: (ref: SiteRef, kind: 'pd' | 'gm') => void;
  onNavigate: (delta: number) => void;
  onDigit: (d: number) => void;
  onBump: () => void;
  onAccept: () => void;
  onBackspace: () => void;
  onToggleFlag: (flag: Flag, ref?: SiteRef) => void;
  onToggleNegative: () => void;
  onMobility: (tooth: number, mobility: number) => void;
  onFurcation: (tooth: number, entry: PerioFurcationEntry, grade: number) => void;
  onStatus: (tooth: number, status: PerioToothStatus) => void;
  onNote: (tooth: number, note: string) => void;
}

function Section({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cn('flex flex-col gap-2.5 border-b px-3.5 py-3 last:border-b-0', className)}>{children}</section>;
}

function PerioInspector(p: PerioInspectorProps) {
  const t = useTranslations('PerioRecord');
  const stats = React.useMemo(() => computeStats(p.teeth), [p.teeth]);
  const progress = React.useMemo(() => probeProgress(p.teeth, p.mode), [p.teeth, p.mode]);
  const sign = marginSignOf(usePerioSettingsContext());
  const tooth = p.teeth.find((x) => x.tooth === p.tooth) ?? emptyTooth(p.tooth, 'missing');
  const probeable = isProbeable(tooth.status);
  const order = ([0, 1, 2] as PerioSiteIndex[]).map((position) => indexAt(p.tooth, position));
  const target = p.markTarget ? siteOf(p.teeth, p.markTarget) : null;
  const sideName = (s: 'v' | 'i', n = p.tooth) => t(s === 'v' ? 'chart.sides.v' : isUpperPerio(n) ? 'chart.sides.iUpper' : 'chart.sides.iLower');
  const targetLabel = p.markTarget ? `${p.markTarget.tooth} ${sideName(p.markTarget.side, p.markTarget.tooth)} · ${t(`chart.sites.${p.markTarget.index}`)}` : null;
  const kind = p.tooth % 10;
  const history = p.previousExams
    .map((e) => {
      const x = e.teeth.find((y) => y.tooth === p.tooth);
      const values = x && isProbeable(x.status) ? [...x.sites.v, ...x.sites.i].map((s) => s.pd).filter((v): v is number => v != null) : [];
      return { date: e.date, max: values.length ? Math.max(...values) : null };
    })
    .filter((h) => h.max != null);

  const kpi = (value: React.ReactNode, label: string, tone?: 'bad' | 'warn' | 'ok') => (
    <div className="flex min-w-0 flex-col gap-px rounded-xl bg-muted/60 px-2 py-1.5">
      <b className={cn('text-base font-bold leading-tight tabular-nums', tone === 'bad' && 'text-red-600 dark:text-red-400', tone === 'warn' && 'text-amber-600 dark:text-amber-400', tone === 'ok' && 'text-emerald-600 dark:text-emerald-400')}>{value}</b>
      <small className="truncate text-[10.5px] text-muted-foreground">{label}</small>
    </div>
  );

  const cell = (sideKey: 'v' | 'i', index: PerioSiteIndex, k: 'pd' | 'gm' | 'cal') => {
    const site = tooth.sites[sideKey][index];
    if (k === 'cal') return <td key={index} className="text-center text-xs font-semibold tabular-nums text-muted-foreground">{attachmentLevel(site) ?? '–'}</td>;
    const ref = { tooth: p.tooth, side: sideKey, index };
    const prev = p.guideBy?.get(p.tooth);
    const prevValue = prev && isProbeable(prev.status) ? prev.sites[sideKey][index][k] : null;
    const isCursor = sameSite(p.cursor, ref) && ((k === 'pd' && p.pass === 'ps') || (k === 'gm' && p.pass === 'mg'));
    const severity = k === 'pd' ? severityClass(site.pd) : '';
    return (
      <td key={index}>
        <button
          type="button"
          onClick={() => p.onSelectSite(ref, k)}
          disabled={!probeable}
          className={cn(
            'relative h-[30px] w-full rounded-lg bg-muted/60 text-[12.5px] font-semibold tabular-nums',
            severity === 's4' && 'bg-amber-100 dark:bg-amber-950/50',
            (severity === 's5' || severity === 's6') && 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300',
            isCursor && 'bg-primary text-primary-foreground',
          )}
        >
          {fmt(k === 'gm' && site.gm != null ? sign * site.gm : site[k])}
          {prevValue != null && <small className="absolute right-1 top-px text-[8.5px] font-semibold opacity-60">{fmt(k === 'gm' ? sign * prevValue : prevValue)}</small>}
        </button>
      </td>
    );
  };

  /** Bleeding, suppuration and plaque of one site, each its own toggle */
  const marksCell = (sideKey: 'v' | 'i', index: PerioSiteIndex) => {
    const site = tooth.sites[sideKey][index];
    const ref = { tooth: p.tooth, side: sideKey, index };
    const isTarget = sameSite(p.markTarget, ref);
    return (
      <td key={index}>
        <div className={cn('flex h-[30px] items-center justify-center gap-0.5 rounded-lg', isTarget && 'outline-dashed outline-1 outline-offset-1 outline-primary')}>
          {(['bop', 'sup', 'plaque'] as Flag[]).map((flag) => (
            <button
              key={flag}
              type="button"
              disabled={p.readOnly}
              aria-pressed={site[flag]}
              aria-label={`${t(`probe.flags.${flag}`)} · ${t(`chart.sites.${index}`)}`}
              title={`${t(`probe.flags.${flag}`)} · ${t(`chart.sites.${index}`)}`}
              onClick={() => p.onToggleFlag(flag, ref)}
              className={cn('grid h-6 w-6 place-items-center rounded-md border bg-background transition-colors disabled:opacity-60', site[flag] ? 'border-transparent' : 'hover:bg-muted')}
              style={site[flag] ? { background: `color-mix(in srgb, ${FLAG_COLOR[flag]} 22%, transparent)`, borderColor: FLAG_COLOR[flag] } : undefined}
            >
              {flag === 'plaque'
                ? <i className="block h-[3px] w-2.5 rounded-sm" style={{ background: site[flag] ? FLAG_COLOR[flag] : 'hsl(var(--muted-foreground) / 0.45)' }} />
                : <i className="block h-2 w-2 rounded-full" style={{ background: site[flag] ? FLAG_COLOR[flag] : 'transparent', border: `1.5px solid ${site[flag] ? FLAG_COLOR[flag] : 'hsl(var(--muted-foreground) / 0.45)'}` }} />}
            </button>
          ))}
        </div>
      </td>
    );
  };

  return (
    <>
      <Section>
        <div className="grid grid-cols-4 gap-1.5">
          {kpi(<>{progress.pd}<small className="text-[11px] font-semibold text-muted-foreground">/{progress.total}</small></>, t('inspector.kpi.sites'))}
          {kpi(`${stats.bopPct}%`, t('inspector.kpi.bop'), stats.bopPct >= 10 ? 'warn' : 'ok')}
          {kpi(`${stats.plaquePct}%`, t('inspector.kpi.plaque'), stats.plaquePct > 20 ? 'warn' : 'ok')}
          {kpi(stats.n5, t('inspector.kpi.pockets5'), stats.n5 ? 'bad' : 'ok')}
        </div>
      </Section>

      <Section>
        <div className="flex items-center gap-2">
          <span className="inline-grid h-7 min-w-[34px] place-items-center rounded-lg bg-primary px-1.5 text-[13px] font-bold text-primary-foreground">{p.tooth}</span>
          <div className="min-w-0 flex-1">
            <b className="block truncate text-[15px] font-semibold leading-tight">{tooth.status === 'implant' ? t('inspector.implant') : t(`inspector.toothNames.${kind}`)}</b>
            <small className="text-xs text-muted-foreground">
              {t(`inspector.quadrant.q${Math.floor(p.tooth / 10)}`)}
              {probeable && p.pass !== 'fm' && p.cursor?.tooth === p.tooth ? ` · ${sideName(p.cursor.side)} · ${t(`chart.sites.${p.cursor.index}`)}` : ''}
            </small>
          </div>
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => p.onNavigate(-1)} aria-label={t('inspector.prev')}><ChevronLeft className="h-4 w-4" /></Button>
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => p.onNavigate(1)} aria-label={t('inspector.next')}><ChevronRight className="h-4 w-4" /></Button>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{t('inspector.statusLabel')}</span>
          <Select value={tooth.status} onValueChange={(v) => p.onStatus(p.tooth, v as PerioToothStatus)} disabled={p.readOnly}>
            <SelectTrigger className="h-7 w-auto gap-1 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(['present', 'missing', 'pontic', 'implant'] as PerioToothStatus[]).map((s) => <SelectItem key={s} value={s}>{t(`chart.status.${s}`)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {probeable ? (
          <>
            <table className="w-full border-separate [border-spacing:3px] text-[12.5px]">
              <thead>
                <tr><th />{order.map((i) => <th key={i} className="text-center text-[10.5px] font-semibold text-muted-foreground">{t(`chart.sitesShort.${i}`)}</th>)}</tr>
              </thead>
              <tbody>
                {(['v', 'i'] as const).map((s) => (
                  <React.Fragment key={s}>
                    <tr><th colSpan={4} className="pt-1 text-left text-[10.5px] font-semibold text-muted-foreground">{sideName(s)}</th></tr>
                    {(['pd', 'gm', 'cal'] as const).map((k) => (
                      <tr key={k}>
                        <th className="pr-1 text-left text-[10.5px] font-semibold text-muted-foreground">{t(`chart.rows.${k}`)}</th>
                        {order.map((i) => cell(s, i, k))}
                      </tr>
                    ))}
                    <tr>
                      <th className="pr-1 text-left text-[10.5px] font-semibold text-muted-foreground" title={t('inspector.marksRow')}>{t('chart.rows.bop')}</th>
                      {order.map((i) => marksCell(s, i))}
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
            </table>
            {p.guideBy && <p className="-mt-1 text-[11.5px] text-muted-foreground">{t('inspector.guideHint')}</p>}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">{t('inspector.notProbed')}</p>
        )}
        {tooth.status === 'implant' && <div className="rounded-xl bg-amber-500/12 px-3 py-2 text-[12.5px] text-amber-700 dark:text-amber-300">{t('inspector.implantTip')}</div>}
      </Section>

      {!p.readOnly && (p.pass === 'fm' ? (
        <Section>
          {tooth.status === 'present' ? (
            <>
              <div className="flex flex-col gap-1">
                <span className="text-[11.5px] font-medium text-muted-foreground">{t('inspector.mobility')}</span>
                <div className="grid grid-cols-4 gap-1 rounded-xl border bg-muted/60 p-0.5">
                  {[0, 1, 2, 3].map((m) => (
                    <button key={m} type="button" onClick={() => p.onMobility(p.tooth, m)} className={cn('h-[30px] rounded-lg text-[12.5px] text-muted-foreground', tooth.mobility === m && 'bg-background font-bold text-foreground shadow-sm')}>{ROMAN[m]}</button>
                  ))}
                </div>
              </div>
              {furcationEntries(p.tooth).length ? furcationEntries(p.tooth).map((entry) => (
                <div key={entry} className="flex flex-col gap-1">
                  <span className="text-[11.5px] font-medium text-muted-foreground">{t('inspector.furcationEntry', { entry: t(`chart.furcation.${entry}`) })}</span>
                  <div className="grid grid-cols-4 gap-1 rounded-xl border bg-muted/60 p-0.5">
                    {[0, 1, 2, 3].map((m) => (
                      <button key={m} type="button" onClick={() => p.onFurcation(p.tooth, entry, m)} className={cn('h-[30px] rounded-lg text-[12.5px] text-muted-foreground', (tooth.furcation[entry] ?? 0) === m && 'bg-background font-bold text-foreground shadow-sm')}>{m ? ROMAN[m] : '—'}</button>
                    ))}
                  </div>
                </div>
              )) : <p className="text-xs text-muted-foreground">{t(isMolarPerio(p.tooth) ? 'inspector.noFurcationThird' : 'inspector.noFurcation')}</p>}
              <Button type="button" size="sm" onClick={p.onAccept} className="self-end">{t('inspector.nextTooth')} <ChevronRight className="h-4 w-4" /></Button>
              <p className="text-[11.5px] text-muted-foreground">{t('inspector.furcationHelp')}</p>
            </>
          ) : <p className="text-xs text-muted-foreground">{t('inspector.mobilityOnlyPresent')}</p>}
        </Section>
      ) : !p.docked && (
        <Section>
          <div className="grid grid-cols-4 gap-1.5">
            {[7, 8, 9, 'bk', 4, 5, 6, 'plus', 1, 2, 3, 0].map((k) => (
              k === 'bk' ? <Button key={k} type="button" variant="outline" className="h-11" onClick={p.onBackspace} aria-label={t('inspector.backspace')}><Delete className="h-4 w-4" /></Button>
                : k === 'plus' ? <Button key={k} type="button" variant="outline" className="h-11 text-[13px]" onClick={p.onBump} title={t('inspector.bumpHint')}>+1</Button>
                  : <Button key={k} type="button" variant="outline" className="h-11 text-[17px] font-semibold tabular-nums" onClick={() => p.onDigit(k as number)}>{k}</Button>
            ))}
            <Button type="button" variant="secondary" className={cn('h-11 text-[13px]', p.pass === 'mg' ? 'col-span-2' : 'col-span-4')} onClick={p.onAccept}>
              {p.ghostValue != null ? t('inspector.sameAsBefore', { value: fmt(p.ghostValue) }) : p.pass === 'mg' ? t('inspector.noRecession') : t('inspector.same')}
            </Button>
            {p.pass === 'mg' ? (
              <>
                <Button type="button" variant={p.negative ? 'default' : 'outline'} className="col-span-2 h-11 text-[12.5px]" onClick={p.onToggleNegative}>{t(sign < 0 ? 'inspector.recessionKey' : 'inspector.enlargement')}</Button>
                <span className="col-span-4 text-[11.5px] text-muted-foreground">{t(sign < 0 ? 'inspector.marginHelpNegative' : 'inspector.marginHelp')}</span>
              </>
            ) : (
              <div className="col-span-4 flex flex-col gap-1.5 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-2">
                <span className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                  <i className="inline-block h-3 w-3 shrink-0 rounded-full border border-dashed border-primary" aria-hidden />
                  {targetLabel ? <span>{t('inspector.marksOnLabel')} <b className="text-foreground">{targetLabel}</b></span> : t('inspector.flagsApplyToLast')}
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['bop', 'sup', 'plaque'] as Flag[]).map((flag) => (
                    <Button key={flag} type="button" variant="outline" disabled={!p.markTarget} className={cn('h-10 text-[12.5px]', target?.[flag] && FLAG_ON[flag])} onClick={() => p.onToggleFlag(flag)}>
                      {t(`probe.flags.${flag}`)} <kbd className="ml-1 hidden text-[10px] text-muted-foreground lg:inline">{t(`probe.flagKeys.${flag}`)}</kbd>
                    </Button>
                  ))}
                </div>
                <span className="text-[11px] text-muted-foreground">{t('inspector.marksHelp')}</span>
              </div>
            )}
          </div>
        </Section>
      ))}

      <Section>
        <h3 className="text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground">{t('inspector.history')}</h3>
        {history.length ? (
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {history.map((h, i) => <span key={i}>{formatDisplayDate(h.date)}: <b className={cn('text-foreground', (h.max ?? 0) >= 5 && 'text-red-600 dark:text-red-400')}>{h.max} mm</b></span>)}
          </div>
        ) : <p className="text-xs text-muted-foreground">{t('inspector.noHistory')}</p>}
        <Textarea
          rows={2}
          value={tooth.note}
          readOnly={p.readOnly}
          onChange={(e) => p.onNote(p.tooth, e.target.value)}
          placeholder={t('inspector.notePlaceholder')}
          className="text-[13px]"
        />
      </Section>
    </>
  );
}
