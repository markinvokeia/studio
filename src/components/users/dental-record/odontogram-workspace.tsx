'use client';

import React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Brush, Check, Eraser, MousePointer2, Redo2, Sparkles, Undo2, X } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ToastAction } from '@/components/ui/toast';
import { VoiceRecorderButton } from '@/components/ui/voice-recorder-button';

import { useHelpScope } from '@/components/help/help-scope';

import { usePanelWidth } from '@/hooks/use-panel-width';
import { useToast } from '@/hooks/use-toast';
import { composeHelpId } from '@/lib/help/help-id';
import { cn, formatDisplayDate } from '@/lib/utils';

import type { OdontogramCondition, OdontogramMarkStatus, OdontogramSnapshot, OdontogramState, OdontogramSurface } from '@/lib/types';
import {
  archOf,
  conditionForStatus,
  getProcedure,
  isRangeCondition,
  isTemporalTooth,
  isValidTooth,
  LOWER_PERMANENT,
  LOWER_TEMPORAL,
  sameConcept,
  surfaceFromLetter,
  surfaceLetter,
  UPPER_PERMANENT,
  UPPER_TEMPORAL,
} from './odontogram-catalog';
import { OdontogramArch } from './odontogram-arch';
import { type Dentition, OdontogramChart } from './odontogram-chart';
import { parseDictation } from './odontogram-dictation';
import {
  addMark,
  addRangeMark,
  applyProposals,
  changeMarkStatus,
  hasMark,
  isInheritedMark,
  listToothMarks,
  type MarkSlot,
  type OdontogramMark,
  placementOf,
  proposalKeys,
  type ProposedMark,
  rangeMarksOf,
  removeMark,
  setToothNotes,
  voidMark,
} from './odontogram-state';
import { StatusDot, STATUS_ORDER, ToothInspector, useConditionLabel } from './tooth-inspector';

export type OdontogramView = 'fdi' | 'arch' | 'history';
type View = OdontogramView;
type Tool = 'select' | 'brush' | 'erase';

/** Container width from which the inspector sits to the right of the chart */
const SIDE_INSPECTOR_MIN_WIDTH = 1000;
/** From this width the inspector gets its full 320 px (300 px below it) */
const WIDE_INSPECTOR_MIN_WIDTH = 1180;
/** Below this width the two occlusal arches go one under the other */
const ARCH_STACK_BELOW = 720;

export interface OdontogramWorkspaceProps {
  /** What is on the chart: the session being edited, or the snapshot being read */
  state: OdontogramState;
  /** The session this one starts from (its marks are voided, not deleted); null for the first */
  previousState: OdontogramState | null;
  readOnly: boolean;
  /** Every session of the patient, oldest first, for the history view */
  history: OdontogramSnapshot[];
  /** Dictated or agent marks waiting for confirmation */
  proposals: ProposedMark[];
  onProposalsChange: (proposals: ProposedMark[]) => void;
  /** Records a change of the chart (goes to undo; the session notes follow from the net changes) */
  onChange: (next: OdontogramState) => void;
  /** Tooth notes: typed text, kept out of undo */
  onNotesChange: (next: OdontogramState) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  userId?: string;
  /**
   * Fill the available height: chart and inspector scroll inside instead of stretching the page
   * (only with the inspector on the side; stacked, the page scrolls).
   */
  fitHeight?: boolean;
  /** Extra controls at the end of the view row (the session steps when there is no sheet header) */
  controlsExtra?: React.ReactNode;
  /**
   * View and dentition kept by the host, so they survive moving to another session (the workspace
   * is mounted again for each one). Without them the workspace keeps its own.
   */
  view?: OdontogramView;
  onViewChange?: (view: OdontogramView) => void;
  dentition?: Dentition;
  onDentitionChange?: (dentition: Dentition) => void;
}

function initialDentition(state: OdontogramState): Dentition {
  const teeth = Object.keys(state).map(Number);
  const temporal = teeth.some(isTemporalTooth);
  const permanent = teeth.some((n) => !isTemporalTooth(n));
  if (temporal && permanent) return 'mixed';
  if (temporal) return 'temporal';
  return 'permanent';
}

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex gap-0.5 rounded-[11px] border bg-muted/60 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn('h-7 whitespace-nowrap rounded-[9px] px-2.5 text-[12.5px] font-medium text-muted-foreground', value === o.value && 'bg-background font-semibold text-foreground shadow-sm')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function OdontogramWorkspace({
  state,
  previousState,
  readOnly,
  history,
  proposals,
  onProposalsChange,
  onChange,
  onNotesChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  userId,
  fitHeight = false,
  controlsExtra,
  view: viewProp,
  onViewChange,
  dentition: dentitionProp,
  onDentitionChange,
}: OdontogramWorkspaceProps) {
  const t = useTranslations('DentalRecord');
  const locale = useLocale();
  const label = useConditionLabel();
  const { toast } = useToast();
  const helpScope = useHelpScope();

  const rootRef = React.useRef<HTMLDivElement>(null);
  const width = usePanelWidth(rootRef);
  const sideInspector = width >= SIDE_INSPECTOR_MIN_WIDTH;
  const wideInspector = width >= WIDE_INSPECTOR_MIN_WIDTH;
  const fit = fitHeight && sideInspector;

  const [ownView, setOwnView] = React.useState<View>('fdi');
  const [ownDentition, setOwnDentition] = React.useState<Dentition>(() => initialDentition(state));
  const view = viewProp ?? ownView;
  const dentition = dentitionProp ?? ownDentition;
  const setView = (next: View) => { setOwnView(next); onViewChange?.(next); };
  const setDentition = (next: Dentition | ((current: Dentition) => Dentition)) => {
    const value = typeof next === 'function' ? next(dentition) : next;
    setOwnDentition(value);
    onDentitionChange?.(value);
  };
  const [hidden, setHidden] = React.useState<OdontogramMarkStatus[]>([]);
  const [tool, setTool] = React.useState<Tool>('select');
  const [brush, setBrush] = React.useState<{ condition: OdontogramCondition; fixedStatus?: OdontogramMarkStatus } | null>(null);
  const [lastCondition, setLastCondition] = React.useState<OdontogramCondition>('caries');
  const [rangeStart, setRangeStart] = React.useState<number | null>(null);
  const [mode, setMode] = React.useState<OdontogramMarkStatus>('indicated');
  const [selection, setSelection] = React.useState<number[]>([]);
  const [surfaces, setSurfaces] = React.useState<OdontogramSurface[]>([]);
  const [voidTarget, setVoidTarget] = React.useState<OdontogramMark | null>(null);
  const [voidReason, setVoidReason] = React.useState('');
  const [dictation, setDictation] = React.useState('');
  const [historyIndex, setHistoryIndex] = React.useState(history.length - 1);
  const [flash, setFlash] = React.useState(false);
  const dictationRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => { setHistoryIndex(history.length - 1); }, [history.length]);

  // A tooth typed in another dentition switches to mixed so it is visible
  const showTooth = (tooth: number) => {
    const next = isTemporalTooth(tooth) ? (dentition === 'permanent' ? 'mixed' : dentition) : dentition === 'temporal' ? 'mixed' : dentition;
    if (next !== dentition) setDentition(next);
  };

  const pendingKeys = React.useMemo(() => proposalKeys(proposals), [proposals]);
  const shownState = React.useMemo(() => (proposals.length ? applyProposals(state, proposals) : state), [state, proposals]);

  const statusLabel = (s: OdontogramMarkStatus) => t(`status.${s}`).toLowerCase();
  const undoAction = <ToastAction altText={t('toolbar.undo')} onClick={onUndo}>{t('toolbar.undo')}</ToastAction>;

  // ── Recording marks ─────────────────────────────────────────────────────────

  function requireSurface(condition: OdontogramCondition, status: OdontogramMarkStatus) {
    const id = conditionForStatus(condition, status);
    return getProcedure(id)?.appliesTo === 'surface';
  }

  function apply(condition: OdontogramCondition, fixedStatus?: OdontogramMarkStatus, teeth = selection, faces = surfaces) {
    if (readOnly) return;
    const status = fixedStatus ?? mode;
    if (!teeth.length) {
      toast({ title: t('workspace.toast.pickTooth') });
      return;
    }
    if (requireSurface(condition, status) && !faces.length) {
      setFlash(true);
      window.setTimeout(() => setFlash(false), 1400);
      toast({ title: t('workspace.toast.pickSurface', { condition: label(condition, true) }) });
      return;
    }
    if (isRangeCondition(condition)) {
      const sameArch = teeth.filter((n) => archOf(teeth[0]).includes(n));
      if (sameArch.length < 2) {
        setTool('brush');
        setBrush({ condition, fixedStatus });
        setRangeStart(teeth[0]);
        toast({ title: t('workspace.toast.pickRangeEnd', { condition: label(condition, true) }) });
        return;
      }
      const arch = archOf(sameArch[0]);
      const idx = sameArch.map((n) => arch.indexOf(n));
      const from = arch[Math.min(...idx)];
      const to = arch[Math.max(...idx)];
      onChange(addRangeMark(state, from, to, { condition, status, by: userId }));
      toast({ title: t('workspace.toast.recorded', { condition: label(condition, true), where: `${from}–${to}`, status: statusLabel(status) }), action: undoAction });
      setLastCondition(condition);
      return;
    }

    let next = state;
    const where: string[] = [];
    for (const n of teeth) {
      const toothId = String(n);
      const placeOnSurface = placementOf(conditionForStatus(condition, status), faces[0]) !== null && faces.length > 0;
      if (placeOnSurface) {
        for (const surface of faces) next = addMark(next, { toothId, condition, surface, status, by: userId });
        where.push(`${n} ${faces.map((s) => surfaceLetter(n, s)).join('')}`);
      } else {
        next = addMark(next, { toothId, condition, status, by: userId });
        where.push(String(n));
      }
    }
    onChange(next);
    setSurfaces([]);
    setLastCondition(condition);
    toast({ title: t('workspace.toast.recorded', { condition: label(condition, true), where: where.join(', '), status: statusLabel(status) }), action: undoAction });
  }

  function remove(toothId: string, slot: MarkSlot) {
    if (!listToothMarks(toothId, state[toothId]).some((m) => m.slot === slot)) return;
    onChange(removeMark(state, toothId, slot));
  }

  /** A bridge changes status as a whole: every tooth of its range */
  function changeStatus(toothId: string, slot: MarkSlot, status: OdontogramMarkStatus) {
    const mark = listToothMarks(toothId, state[toothId]).find((m) => m.slot === slot);
    if (!mark || mark.status === status) return;
    onChange(rangeMarksOf(state, mark).reduce((acc, m) => changeMarkStatus(acc, m.toothId, m.slot, status), state));
    toast({ title: t('workspace.toast.statusChanged', { condition: label(mark.condition, true), status: statusLabel(status) }), action: undoAction });
  }

  function confirmVoid() {
    if (!voidTarget || !voidReason.trim()) return;
    onChange(voidMark(state, voidTarget.toothId, voidTarget.slot, voidReason.trim(), userId));
    toast({ title: t('void.done') });
    setVoidTarget(null);
    setVoidReason('');
  }

  function brushAt(tooth: number, surface?: OdontogramSurface) {
    if (!brush) return;
    const { condition, fixedStatus } = brush;
    const status = fixedStatus ?? mode;
    if (isRangeCondition(condition)) {
      if (rangeStart == null) {
        setRangeStart(tooth);
        toast({ title: t('workspace.toast.pickRangeEnd', { condition: label(condition, true) }) });
        return;
      }
      if (!archOf(rangeStart).includes(tooth) || tooth === rangeStart) {
        toast({ title: t('workspace.toast.sameArch') });
        return;
      }
      const from = rangeStart;
      setRangeStart(null);
      setTool('select');
      setBrush(null);
      apply(condition, fixedStatus, [from, tooth], []);
      return;
    }
    const id = conditionForStatus(condition, status);
    const onSurface = getProcedure(id)?.appliesTo === 'surface';
    // The inspector follows the brush, so what the tooth has is in view while marking
    setSelection([tooth]);
    setSurfaces([]);
    if (onSurface && !surface) {
      toast({ title: t('workspace.toast.brushNeedsSurface') });
      return;
    }
    const toothId = String(tooth);
    const existing = listToothMarks(toothId, state[toothId]).find((m) => (onSurface ? m.surface === surface : !m.surface) && sameConcept(m.condition, id));
    if (existing) {
      // Same condition in another status: it changes status (indicated → existing…), it is not removed
      if (existing.status !== status) return changeStatus(toothId, existing.slot, status);
      if (isInheritedMark(previousState, existing)) {
        toast({ title: t('workspace.toast.inheritedUseVoid') });
        return;
      }
      remove(toothId, existing.slot);
      return;
    }
    apply(condition, fixedStatus, [tooth], onSurface && surface ? [surface] : []);
  }

  function eraseAt(tooth: number, surface?: OdontogramSurface) {
    const toothId = String(tooth);
    const marks = listToothMarks(toothId, state[toothId]).filter((m) => (surface ? m.surface === surface : !m.surface));
    if (!marks.length) {
      toast({ title: t('workspace.toast.nothingToErase') });
      return;
    }
    const today = marks.filter((m) => !isInheritedMark(previousState, m));
    if (!today.length) {
      toast({ title: t('workspace.toast.inheritedUseVoid') });
      return;
    }
    onChange(today.reduce((acc, m) => removeMark(acc, toothId, m.slot), state));
    toast({ title: t('workspace.toast.erased', { where: surface ? `${tooth} ${surfaceLetter(tooth, surface)}` : String(tooth) }), action: undoAction });
  }

  // ── Chart clicks ────────────────────────────────────────────────────────────

  const handleSurfaceClick = (tooth: number, surface: OdontogramSurface, event: React.MouseEvent) => {
    if (readOnly) { setSelection([tooth]); setSurfaces([]); return; }
    if (tool === 'brush') return brushAt(tooth, surface);
    if (tool === 'erase') return eraseAt(tooth, surface);
    if (event.shiftKey || event.metaKey || event.ctrlKey) {
      setSelection((sel) => (sel.includes(tooth) ? sel.filter((x) => x !== tooth) : [...sel, tooth]));
      setSurfaces([]);
      return;
    }
    if (selection.length === 1 && selection[0] === tooth) {
      setSurfaces((s) => (s.includes(surface) ? s.filter((x) => x !== surface) : [...s, surface]));
      return;
    }
    setSelection([tooth]);
    setSurfaces([surface]);
  };

  const handleToothClick = (tooth: number, event: React.MouseEvent | React.KeyboardEvent) => {
    if (readOnly) { setSelection([tooth]); setSurfaces([]); return; }
    if (tool === 'brush') return brushAt(tooth);
    if (tool === 'erase') return eraseAt(tooth);
    if (event.shiftKey || event.metaKey || event.ctrlKey) {
      setSelection((sel) => (sel.includes(tooth) ? sel.filter((x) => x !== tooth) : [...sel, tooth]));
      setSurfaces([]);
      return;
    }
    if (!(selection.length === 1 && selection[0] === tooth)) setSurfaces([]);
    setSelection([tooth]);
  };

  // Handlers change every render; the teeth read them through refs so memo keeps working
  const surfaceRef = React.useRef(handleSurfaceClick);
  const toothRef = React.useRef(handleToothClick);
  React.useEffect(() => {
    surfaceRef.current = handleSurfaceClick;
    toothRef.current = handleToothClick;
  });
  const onSurfaceClick = React.useCallback((tooth: number, surface: OdontogramSurface, e: React.MouseEvent) => surfaceRef.current(tooth, surface, e), []);
  const onToothClick = React.useCallback((tooth: number, e: React.MouseEvent | React.KeyboardEvent) => toothRef.current(tooth, e), []);

  function navigate(delta: number) {
    const current = selection[0];
    if (current == null) return;
    const order = isTemporalTooth(current) ? [...UPPER_TEMPORAL, ...[...LOWER_TEMPORAL].reverse()] : [...UPPER_PERMANENT, ...[...LOWER_PERMANENT].reverse()];
    const i = (order.indexOf(current) + delta + order.length) % order.length;
    setSelection([order[i]]);
    setSurfaces([]);
  }

  function selectTooth(tooth: number | null) {
    if (tooth == null) { setSelection([]); setSurfaces([]); return; }
    showTooth(tooth);
    setSelection([tooth]);
    setSurfaces([]);
    if (view === 'history') setView('fdi');
  }

  function startBrush(condition: OdontogramCondition, fixedStatus?: OdontogramMarkStatus, announce = true) {
    setBrush({ condition, fixedStatus });
    setTool('brush');
    setRangeStart(null);
    setLastCondition(condition);
    if (announce) toast({ title: t('workspace.toast.brushOn', { condition: label(condition, true), status: statusLabel(fixedStatus ?? mode) }) });
  }

  /**
   * A condition picked in the inspector: recorded on the selected tooth (and faces) when there is
   * one, and kept active so the next teeth or faces touched on the chart get it too. Picking the
   * active one again lets it go.
   */
  function pick(condition: OdontogramCondition, fixedStatus?: OdontogramMarkStatus) {
    if (readOnly) return;
    if (tool === 'brush' && brush?.condition === condition && brush.fixedStatus === fixedStatus) {
      exitTool();
      return;
    }
    // While a condition is active the selection only follows the brush: another one replaces it
    if (tool === 'brush') {
      startBrush(condition, fixedStatus);
      return;
    }
    if (isRangeCondition(condition)) {
      if (selection.length) apply(condition, fixedStatus);
      else startBrush(condition, fixedStatus);
      return;
    }
    const status = fixedStatus ?? mode;
    const ready = selection.length > 0 && (!requireSurface(condition, status) || surfaces.length > 0);
    if (ready) apply(condition, fixedStatus);
    startBrush(condition, fixedStatus, !ready);
  }

  /** A face touched in the inspector: marked with the active condition, or added to the selection */
  function toggleInspectorSurface(surface: OdontogramSurface) {
    if (tool === 'brush' && brush && selection.length === 1) return brushAt(selection[0], surface);
    setSurfaces((cur) => (cur.includes(surface) ? cur.filter((x) => x !== surface) : [...cur, surface]));
  }

  function chooseTool(next: Tool) {
    if (next === 'brush' && !brush) setBrush({ condition: lastCondition });
    setTool(next);
    setRangeStart(null);
  }

  function exitTool() {
    setTool('select');
    setBrush(null);
    setRangeStart(null);
  }

  // ── Dictation and proposals ─────────────────────────────────────────────────

  function propose(text: string) {
    const value = text.trim();
    if (!value) {
      toast({ title: t('dictation.empty') });
      return;
    }
    const { proposals: found, unparsed } = parseDictation(value);
    if (!found.length) {
      toast({ title: t('dictation.nothingFound') });
      return;
    }
    const fresh = found.filter((p) => !hasMark(state, p) && !proposals.some((q) => q.toothId === p.toothId && q.condition === p.condition && q.surface === p.surface && q.status === p.status));
    const duplicates = found.length - fresh.length;
    if (!fresh.length) {
      toast({ title: t('dictation.allRecorded') });
      return;
    }
    fresh.forEach((p) => showTooth(Number(p.toothId)));
    onProposalsChange([...proposals, ...fresh]);
    setDictation('');
    toast({
      title: t('dictation.proposed', { count: fresh.length }),
      description: [duplicates ? t('dictation.duplicates', { count: duplicates }) : '', unparsed.length ? t('dictation.unparsed', { text: unparsed[0] }) : ''].filter(Boolean).join(' · ') || undefined,
    });
  }

  function confirmProposals() {
    onChange(applyProposals(state, proposals.map((p) => ({ ...p, by: userId }))));
    onProposalsChange([]);
    toast({ title: t('proposals.confirmed') });
  }

  // ── Keyboard ────────────────────────────────────────────────────────────────

  const typed = React.useRef({ digits: '', timer: 0 });
  const handleKey = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    const tag = target?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) {
      if (e.key === 'Escape') target?.blur();
      return;
    }
    // Only while this odontogram is on screen and nothing (a dialog) sits on top of it
    if (!rootRef.current || !rootRef.current.offsetParent) return;
    if (document.querySelector('[role="alertdialog"]')) return;
    if (e.key === 'Escape') {
      if (tool !== 'select') exitTool();
      else if (surfaces.length) setSurfaces([]);
      else setSelection([]);
      return;
    }
    if (readOnly) return;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); if (e.shiftKey) onRedo(); else onUndo(); return; }
    if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); onRedo(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '/') { e.preventDefault(); dictationRef.current?.focus(); return; }
    if (/^\d$/.test(e.key)) {
      window.clearTimeout(typed.current.timer);
      typed.current.digits += e.key;
      if (typed.current.digits.length === 2) {
        const tooth = Number(typed.current.digits);
        typed.current.digits = '';
        if (isValidTooth(tooth)) selectTooth(tooth);
        else toast({ title: t('workspace.toast.invalidTooth', { tooth }) });
      } else {
        typed.current.timer = window.setTimeout(() => { typed.current.digits = ''; }, 1200);
      }
      return;
    }
    if (k === 'b') return chooseTool('brush');
    if (k === 'e') return chooseTool('erase');
    if (selection.length === 1) {
      const surface = surfaceFromLetter(k);
      if (surface) toggleInspectorSurface(surface);
    }
  };
  const keyRef = React.useRef(handleKey);
  React.useEffect(() => {
    keyRef.current = handleKey;
  });
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────────

  const counts = React.useMemo(() => {
    const c: Record<OdontogramMarkStatus, number> = { indicated: 0, existing: 0, done: 0 };
    Object.keys(state).forEach((id) => listToothMarks(id, state[id]).forEach((m) => { c[m.status] += 1; }));
    return c;
  }, [state]);

  const interaction = {
    selectedTeeth: selection,
    selectedSurfaces: surfaces,
    rangeStart,
    pendingKeys,
    hiddenStatuses: hidden,
    onSurfaceClick,
    onToothClick,
  };

  const historySnapshot = history[historyIndex];
  const historyPrevious = historyIndex > 0 ? history[historyIndex - 1].state : null;

  const brushProcedure = brush ? getProcedure(conditionForStatus(brush.condition, brush.fixedStatus ?? mode)) : undefined;
  const banner = readOnly || view === 'history' ? null : tool === 'brush' && brush ? (
    <div className={cn('flex flex-wrap items-center gap-2.5 rounded-xl px-3 py-1.5 text-[13px]', (brush.fixedStatus ?? mode) === 'done' ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300' : 'bg-primary/10 text-primary dark:text-foreground')}>
      <Brush className="h-4 w-4" />
      <span>{t('workspace.banner.brush', { condition: label(brush.condition, true), status: statusLabel(brush.fixedStatus ?? mode) })}</span>
      <span className="text-muted-foreground">
        {isRangeCondition(brush.condition)
          ? rangeStart != null ? t('workspace.banner.rangeFrom', { tooth: rangeStart }) : t('workspace.banner.rangeFirst')
          : brushProcedure?.appliesTo === 'surface' ? t('workspace.banner.brushSurfaces') : t('workspace.banner.brushTeeth')}
      </span>
      <Button type="button" size="sm" variant="outline" className="ml-auto h-7 text-xs" onClick={exitTool}>{t('workspace.banner.exit')}</Button>
    </div>
  ) : tool === 'erase' ? (
    <div className="flex flex-wrap items-center gap-2.5 rounded-xl bg-muted px-3 py-1.5 text-[13px]">
      <Eraser className="h-4 w-4" />
      <span>{t('workspace.banner.eraser')}</span>
      <Button type="button" size="sm" variant="outline" className="ml-auto h-7 text-xs" onClick={exitTool}>{t('workspace.banner.exit')}</Button>
    </div>
  ) : mode === 'done' ? (
    <div className="flex flex-wrap items-center gap-2.5 rounded-xl bg-emerald-500/12 px-3 py-1.5 text-[13px] text-emerald-700 dark:text-emerald-300">
      <Check className="h-4 w-4" />
      <span>{t('workspace.banner.doneMode')}</span>
      <Button type="button" size="sm" variant="outline" className="ml-auto h-7 text-xs" onClick={() => setMode('indicated')}>{t('workspace.banner.backToFindings')}</Button>
    </div>
  ) : null;

  const toolButton = (value: Tool, icon: React.ReactNode, title: string, shortcut?: string) => (
    <button
      type="button"
      onClick={() => (value === 'select' ? exitTool() : chooseTool(value))}
      title={title}
      aria-label={title}
      aria-pressed={tool === value}
      className={cn('relative grid h-[38px] w-[38px] place-items-center rounded-[11px] text-muted-foreground hover:bg-muted hover:text-foreground', tool === value && 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground')}
    >
      {icon}
      {shortcut && <span className="absolute bottom-0 right-0.5 text-[9px] font-semibold opacity-70">{shortcut}</span>}
    </button>
  );

  const chart = view === 'history' ? null : view === 'arch'
    ? <OdontogramArch state={shownState} dentition={dentition} stacked={width > 0 && width < ARCH_STACK_BELOW} {...interaction} />
    : <OdontogramChart state={shownState} dentition={dentition} {...interaction} />;

  const inspector = view === 'history' ? (
    historySnapshot ? (
      <ToothInspector
        state={historySnapshot.state}
        previousState={historyPrevious}
        selectedTeeth={[]}
        selectedSurfaces={[]}
        mode={mode}
        readOnly
        onModeChange={setMode}
        onToggleSurface={() => undefined}
        onClearSurfaces={() => undefined}
        onApply={() => undefined}
        onRemoveMark={() => undefined}
        onRequestVoid={() => undefined}
        onChangeStatus={() => undefined}
        onNotesChange={() => undefined}
        onSelectTooth={selectTooth}
        onNavigate={() => undefined}
      />
    ) : null
  ) : (
    <ToothInspector
      state={state}
      previousState={previousState}
      selectedTeeth={selection}
      selectedSurfaces={surfaces}
      mode={mode}
      readOnly={readOnly}
      active={tool === 'brush' ? brush : null}
      onModeChange={setMode}
      onToggleSurface={toggleInspectorSurface}
      onClearSurfaces={() => setSurfaces([])}
      onApply={pick}
      onRemoveMark={remove}
      onRequestVoid={(m) => { setVoidTarget(m); setVoidReason(''); }}
      onChangeStatus={changeStatus}
      onNotesChange={(toothId, notes) => onNotesChange(setToothNotes(state, toothId, notes))}
      onSelectTooth={selectTooth}
      onNavigate={navigate}
      narrow={sideInspector && !wideInspector}
    />
  );

  return (
    <div
      ref={rootRef}
      className={cn(
        'grid gap-3',
        sideInspector ? (wideInspector ? 'grid-cols-[minmax(0,1fr)_320px]' : 'grid-cols-[minmax(0,1fr)_300px]') : 'grid-cols-1',
        fit ? 'h-full min-h-0 grid-rows-[minmax(0,1fr)]' : 'items-start',
      )}
    >
      <section className={cn('flex min-w-0 flex-col gap-2', fit && 'min-h-0')}>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label={t('workspace.viewLabel')}
            value={view}
            onChange={(v) => { setView(v); exitTool(); }}
            options={[{ value: 'fdi', label: t('workspace.views.fdi') }, { value: 'arch', label: t('workspace.views.arch') }, { value: 'history', label: t('workspace.views.history') }]}
          />
          <Segmented
            label={t('workspace.dentitionLabel')}
            value={dentition}
            onChange={setDentition}
            options={[{ value: 'permanent', label: t('workspace.dentition.permanent') }, { value: 'mixed', label: t('workspace.dentition.mixed') }, { value: 'temporal', label: t('workspace.dentition.temporal') }]}
          />
          {view !== 'history' && (
            <div className="flex flex-wrap gap-1" aria-label={t('workspace.layersLabel')}>
              {STATUS_ORDER.map((s) => {
                const off = hidden.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={!off}
                    title={t('workspace.layerToggle')}
                    onClick={() => setHidden((h) => (off ? h.filter((x) => x !== s) : [...h, s]))}
                    className={cn('inline-flex h-[30px] items-center gap-1.5 rounded-full border bg-card px-2.5 text-[12.5px] font-medium text-muted-foreground', off && 'line-through opacity-50')}
                  >
                    <StatusDot status={s} />
                    {t(`status.${s}`)}
                    <b className="font-semibold tabular-nums text-foreground">{counts[s]}</b>
                  </button>
                );
              })}
            </div>
          )}
          {controlsExtra && <div className="ml-auto flex items-center gap-2">{controlsExtra}</div>}
        </div>

        {!readOnly && view !== 'history' && (
          <form
            onSubmit={(e) => { e.preventDefault(); propose(dictation); }}
            className="flex items-center gap-1.5 rounded-[14px] border bg-card py-1 pl-3 pr-1 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15"
            data-help-id={composeHelpId(helpScope, 'section', 'odontogram-dictation')}
          >
            <Sparkles className="h-[18px] w-[18px] shrink-0 text-primary" />
            <Input
              ref={dictationRef}
              value={dictation}
              onChange={(e) => setDictation(e.target.value)}
              placeholder={t('dictation.placeholder')}
              aria-label={t('dictation.label')}
              className="h-8 border-0 bg-transparent px-1 text-[13.5px] shadow-none focus-visible:ring-0"
              data-help-id={composeHelpId(helpScope, 'field', 'odontogram-dictation')}
            />
            <VoiceRecorderButton locale={locale} onTranscriptReady={(text) => { setDictation(text); propose(text); }} />
            <Button type="submit" size="sm" className="h-8" data-help-id={composeHelpId(helpScope, 'btn', 'odontogram-propose')}>{t('dictation.propose')}</Button>
          </form>
        )}

        <div className={cn('relative flex min-h-0 overflow-hidden rounded-2xl border bg-card', fit && 'flex-1')}>
          {!readOnly && view !== 'history' && (
            <div role="toolbar" aria-label={t('toolbar.label')} className="flex w-[50px] shrink-0 flex-col items-center gap-1 border-r px-1.5 py-2">
              {toolButton('select', <MousePointer2 className="h-[19px] w-[19px]" />, t('toolbar.select'))}
              {toolButton('brush', <Brush className="h-[19px] w-[19px]" />, t('toolbar.brush'), 'B')}
              {toolButton('erase', <Eraser className="h-[19px] w-[19px]" />, t('toolbar.eraser'), 'E')}
              <span className="my-1 h-px w-6 bg-border" />
              <button type="button" onClick={onUndo} disabled={!canUndo} title={t('toolbar.undoShortcut')} aria-label={t('toolbar.undo')} className="grid h-[38px] w-[38px] place-items-center rounded-[11px] text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-35">
                <Undo2 className="h-[19px] w-[19px]" />
              </button>
              <button type="button" onClick={onRedo} disabled={!canRedo} title={t('toolbar.redoShortcut')} aria-label={t('toolbar.redo')} className="grid h-[38px] w-[38px] place-items-center rounded-[11px] text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-35">
                <Redo2 className="h-[19px] w-[19px]" />
              </button>
            </div>
          )}

          <div className={cn('flex min-w-0 flex-1 flex-col gap-2 overflow-auto px-3.5 py-2.5', fit && '[&>.odo-chart]:my-auto', flash && '[&_[aria-pressed=true]_path]:animate-surface-breath')}>
            {banner}
            {view === 'history' ? (
              <HistoryView history={history} index={historyIndex} onIndexChange={setHistoryIndex} dentition={dentition} />
            ) : chart}
            <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 pt-1 text-[11.5px] text-muted-foreground">
              {STATUS_ORDER.map((s) => (
                <span key={s} className="inline-flex items-center gap-1.5"><StatusDot status={s} />{t(`status.${s}Long`)}</span>
              ))}
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full border-[1.5px] border-dashed" style={{ borderColor: 'var(--odo-pend)' }} />
                {t('status.pending')}
              </span>
              {!readOnly && <span className="ml-auto hidden md:inline">{t('workspace.shortcuts')}</span>}
            </div>
          </div>

          {proposals.length > 0 && view !== 'history' && (
            <div role="region" aria-label={t('proposals.label')} className="absolute bottom-3 left-1/2 z-10 flex w-[min(680px,calc(100%-80px))] -translate-x-1/2 flex-col gap-2.5 rounded-2xl border-[1.5px] bg-card px-3.5 py-3 shadow-lg" style={{ borderColor: 'var(--odo-pend)' }}>
              <div className="flex flex-wrap items-center gap-2">
                <b className="inline-flex items-center gap-1.5 text-sm font-semibold"><Sparkles className="h-4 w-4" style={{ color: 'var(--odo-pend)' }} />{t('proposals.title', { count: proposals.length })}</b>
                <span className="flex-1" />
                <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => onProposalsChange([])}>{t('proposals.discard')}</Button>
                <Button type="button" size="sm" className="h-8" onClick={confirmProposals} data-help-id={composeHelpId(helpScope, 'btn', 'odontogram-confirm-proposals')}><Check className="mr-1 h-4 w-4" />{t('proposals.confirm')}</Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {proposals.map((p) => (
                  <span key={p.key} className="inline-flex items-center gap-1.5 rounded-[10px] border border-dashed bg-primary/5 py-1 pl-2 pr-1 text-[12.5px]" style={{ borderColor: 'var(--odo-pend)' }}>
                    <StatusDot status={p.status} />
                    <b className="font-semibold">{p.toothEndId ? `${p.toothId}–${p.toothEndId}` : p.toothId}{p.surface ? ` ${surfaceLetter(Number(p.toothId), p.surface)}` : ''}</b>
                    {label(p.condition, true)} · {statusLabel(p.status)}
                    <button type="button" onClick={() => onProposalsChange(proposals.filter((q) => q.key !== p.key))} className="grid h-[18px] w-[18px] place-items-center rounded-md hover:bg-background" aria-label={t('proposals.remove')}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <aside className={cn('flex min-h-0 flex-col overflow-auto rounded-2xl border bg-card', fit ? 'h-full' : sideInspector && 'sticky top-2 max-h-[calc(100vh-120px)]')} aria-label={t('inspector.label')} data-help-id={composeHelpId(helpScope, 'section', 'odontogram-inspector')}>
        {inspector}
      </aside>

      <AlertDialog open={!!voidTarget} onOpenChange={(open) => { if (!open) setVoidTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('void.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {voidTarget && t('void.description', {
                condition: label(voidTarget.condition, true),
                tooth: voidTarget.toothId,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea rows={3} value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder={t('void.reasonPlaceholder')} aria-label={t('void.reasonLabel')} autoFocus />
          <AlertDialogFooter>
            <AlertDialogCancel>{t('void.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmVoid(); }}
              disabled={!voidReason.trim()}
              className="bg-destructive hover:bg-destructive/90"
            >
              {t('void.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function HistoryView({ history, index, onIndexChange, dentition }: { history: OdontogramSnapshot[]; index: number; onIndexChange: (i: number) => void; dentition: Dentition }) {
  const t = useTranslations('DentalRecord');
  const snapshot = history[index];
  if (!history.length) return <p className="py-10 text-center text-sm text-muted-foreground">{t('workspace.history.empty')}</p>;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start overflow-x-auto px-1.5 pb-1 pt-1">
        {history.map((s, i) => (
          <React.Fragment key={s.id ?? i}>
            {i > 0 && <span className="mt-[7px] h-0.5 min-w-5 flex-1 bg-border" aria-hidden />}
            <button
              type="button"
              onClick={() => onIndexChange(i)}
              aria-current={i === index ? 'step' : undefined}
              className={cn('flex min-w-[120px] flex-col items-center gap-1 text-xs text-muted-foreground', i === index && 'font-semibold text-foreground')}
            >
              <span className={cn('h-4 w-4 rounded-full border-2 bg-card', i === index ? 'border-primary bg-primary' : 'border-border')} />
              <span>{formatDisplayDate(s.date)}</span>
              <span className="max-w-[140px] truncate font-normal">{s.description || t('session.untitled')}</span>
            </button>
          </React.Fragment>
        ))}
      </div>
      {snapshot && <OdontogramChart state={snapshot.state} dentition={dentition} variant="mini" />}
      <p className="text-xs text-muted-foreground">{t('workspace.history.hint')}</p>
    </div>
  );
}
