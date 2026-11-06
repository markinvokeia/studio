'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Check, CloudOff, Loader2, Lock } from 'lucide-react';

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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ResizableSheet, SheetTitle } from '@/components/ui/resizable-sheet';
import { Skeleton } from '@/components/ui/skeleton';

import { Hint, HintProvider } from '@/components/users/aesthetic-record/hint';
import { PERIO_RECORD_PERMISSIONS } from '@/constants/permissions';
import { useAuth } from '@/context/AuthContext';
import { usePanelWidth } from '@/hooks/use-panel-width';
import { usePermissions } from '@/hooks/usePermissions';
import { toothStatusesFromOdontogram } from '@/lib/perio/from-odontogram';
import { computeCompleteness, computeStatus, probeProgress } from '@/lib/perio/stats';
import { patchSites, siteKey } from '@/lib/perio/probe';
import { emptyTooth, PERIO_TEETH, type SiteRef, siteOf } from '@/lib/perio/teeth';
import { cn, formatDate, formatDisplayDate, formatUtcDateTime } from '@/lib/utils';
import { fetchOdontograms } from '@/services/dental-record';
import { fetchPerioExams, type PerioExamInput, savePerioExam } from '@/services/perio-record';

import type { PerioExam, PerioExamStatus, PerioExamType, PerioSite, PerioTooth } from '@/lib/types';
import { isExamLockedError, usePerioErrorMessage } from './perio-errors';
import { assessScreening } from '@/lib/perio/assess';
import { PerioSettingsContext, usePerioSettings } from '@/lib/perio/settings';
import { PerioCloseStep } from './perio-close-step';
import { PerioScreeningStep } from './perio-screening-step';
import { PerioDiagnosisStep } from './perio-diagnosis-step';
import { PerioEvolutionStep } from './perio-evolution-step';
import { PerioProbeStep, type PerioRevealRequest } from './perio-probe-step';
import { PerioFooterSlotContext } from './perio-step-footer';

/** Pause after the last change before it is saved */
const AUTOSAVE_DELAY = 800;
const HISTORY_LIMIT = 60;

type Step = 1 | 2 | 3 | 4;
const STEPS: Step[] = [1, 2, 3, 4];
const STEP_KEYS: Record<Step, string> = { 1: 'probe', 2: 'evolution', 3: 'diagnosis', 4: 'close' };
/** Steps that come in a later phase: shown, but not open yet */
const COMING_SOON: Step[] = [];
const STEP_OF: Record<PerioSheetStep, Step> = { probe: 1, evolution: 2, diagnosis: 3, close: 4 };

export type PerioSheetStep = 'probe' | 'evolution' | 'diagnosis' | 'close';

/** Chip colours of each status (grey, violet, green, red) */
export const PERIO_STATUS_CHIP: Record<PerioExamStatus, string> = {
  probing: 'bg-muted text-muted-foreground',
  probed: 'bg-violet-500/12 text-violet-700 dark:text-violet-300',
  diagnosed: 'bg-sky-500/12 text-sky-700 dark:text-sky-300',
  closed: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
  void: 'bg-red-500/12 text-red-700 dark:text-red-300',
};

type SaveState = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved'; at: number } | { kind: 'error'; message: string };

interface Draft extends PerioExamInput {
  doctorName?: string;
}

const draftKey = (draft: Draft) => JSON.stringify(draft);

const draftFrom = (exam: PerioExam): Draft => ({
  date: exam.date,
  title: exam.title,
  examType: exam.examType,
  guideExamId: exam.guideExamId,
  doctorId: exam.doctorId,
  doctorName: exam.doctorName,
  appointmentId: exam.appointmentId,
  notes: exam.notes,
  teeth: exam.teeth,
  diagnosis: exam.diagnosis,
  closing: exam.closing,
  screening: exam.screening,
});

export interface PerioSessionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  patientName?: string;
  /** Exam shown; `null` starts a new one */
  examId: string | null;
  doctorId?: string;
  doctorName?: string;
  appointmentId?: string;
  readOnly?: boolean;
  /** Step shown when it opens (by default probing, or closing for a probed or closed exam) */
  initialStep?: PerioSheetStep;
  /** Exam compared in Evolution at first ("Comparar con hoy" from the history) */
  compareWithId?: string;
  /** An exam was created, saved or closed */
  onChanged?: () => void;
}

/** One periodontogram as a guided session: probing (and, in later phases, evolution and diagnosis) → closing */
export function PerioSessionSheet({ open, onOpenChange, ...panelProps }: PerioSessionSheetProps) {
  // The panel swaps this for one that waits for the pending save
  const closeRequestRef = React.useRef<(() => void) | null>(null);
  return (
    <ResizableSheet
      open={open}
      onOpenChange={(next) => {
        if (next) onOpenChange(true);
        else if (closeRequestRef.current) closeRequestRef.current();
        else onOpenChange(false);
      }}
      defaultWidth={1320}
      minWidth={640}
      maxWidth={1900}
      storageKey="perio-session-sheet-width"
    >
      {open && <PerioFlow {...panelProps} onClose={() => onOpenChange(false)} closeRequestRef={closeRequestRef} />}
    </ResizableSheet>
  );
}

interface PerioFlowProps extends Omit<PerioSessionSheetProps, 'open' | 'onOpenChange'> {
  onClose: () => void;
  closeRequestRef: React.MutableRefObject<(() => void) | null>;
}

function PerioFlow({ patientId, patientName, examId, doctorId, doctorName, appointmentId, readOnly: readOnlyProp = false, initialStep, compareWithId, onChanged, onClose, closeRequestRef }: PerioFlowProps) {
  const t = useTranslations('PerioRecord');
  const { hasPermission } = usePermissions();
  const { settings, setSettings } = usePerioSettings();
  const { user } = useAuth();
  const describeError = usePerioErrorMessage();
  const canRegister = !readOnlyProp && hasPermission(PERIO_RECORD_PERMISSIONS.REGISTER_SESSION);

  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [exams, setExams] = React.useState<PerioExam[]>([]);
  const [stored, setStored] = React.useState<PerioExam | null>(null);
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [odontogramSummary, setOdontogramSummary] = React.useState<string | null>(null);
  const [step, setStepState] = React.useState<Step>(1);
  const [evolutionSeen, setEvolutionSeen] = React.useState(false);
  const setStep = React.useCallback((next: Step) => {
    setStepState(next);
    if (next === 2) setEvolutionSeen(true);
  }, []);
  const [past, setPast] = React.useState<PerioTooth[][]>([]);
  const [future, setFuture] = React.useState<PerioTooth[][]>([]);
  const [saveState, setSaveState] = React.useState<SaveState>({ kind: 'idle' });
  const [confirmLeave, setConfirmLeave] = React.useState(false);
  const [lockNotice, setLockNotice] = React.useState<string | null>(null);
  /** Dictated sites not confirmed yet, with each site as it was before the first dictation */
  const [dictated, setDictated] = React.useState<Map<string, { ref: SiteRef; before: PerioSite }>>(() => new Map());
  const pendingKeys = React.useMemo(() => new Set(dictated.keys()), [dictated]);
  const [reveal, setReveal] = React.useState<PerioRevealRequest | null>(null);
  /** Bar at the bottom where each step puts its navigation */
  const [footerSlot, setFooterSlot] = React.useState<HTMLDivElement | null>(null);

  // ── Load: the exam, or a new one whose teeth come from the latest odontogram ──
  React.useEffect(() => {
    let active = true;
    Promise.all([fetchPerioExams(patientId), examId ? Promise.resolve([]) : fetchOdontograms(patientId).catch(() => [])])
      .then(([list, odontograms]) => {
        if (!active) return;
        setExams(list);
        const exam = examId ? list.find((e) => e.id === examId) ?? null : null;
        if (examId && !exam) { setLoadError(t('sheet.notFound')); return; }
        let next: Draft;
        if (exam) {
          next = draftFrom(exam);
        } else {
          const earlier = list.filter((e) => e.status !== 'void');
          const guide = [...earlier].reverse().find((e) => e.status === 'closed') ?? earlier[earlier.length - 1];
          const latestOdontogram = odontograms[odontograms.length - 1];
          const fromOdontogram = toothStatusesFromOdontogram(latestOdontogram?.state);
          const statusOf = (tooth: number) => fromOdontogram.get(tooth) ?? guide?.teeth.find((x) => x.tooth === tooth)?.status ?? 'present';
          const today = formatDate(new Date());
          next = {
            date: today,
            title: t('sheet.defaultTitle', { date: formatDisplayDate(today) }),
            examType: earlier.length ? 'maintenance' : 'initial',
            guideExamId: guide?.id,
            doctorId: doctorId ?? user?.id,
            doctorName: doctorName ?? user?.name,
            appointmentId,
            notes: '',
            teeth: PERIO_TEETH.map((n) => emptyTooth(n, statusOf(n))),
            diagnosis: null,
            closing: null,
            screening: null,
          };
          if (latestOdontogram) {
            const group = (s: string) => PERIO_TEETH.filter((n) => fromOdontogram.get(n) === s).join(', ');
            const parts = [
              group('missing') && t('sheet.fromOdontogram.missing', { teeth: group('missing') }),
              group('pontic') && t('sheet.fromOdontogram.pontic', { teeth: group('pontic') }),
              group('implant') && t('sheet.fromOdontogram.implant', { teeth: group('implant') }),
            ].filter(Boolean);
            setOdontogramSummary(parts.length ? t('sheet.fromOdontogram.prefix', { list: parts.join(' · ') }) : t('sheet.fromOdontogram.none'));
          }
        }
        setStored(exam);
        setDraft(next);
        savedKeyRef.current = draftKey(next);
        examIdRef.current = exam?.id;
        setStep(initialStep ? STEP_OF[initialStep] : exam?.status === 'closed' || exam?.status === 'diagnosed' ? 4 : exam?.status === 'probed' ? 3 : 1);
      })
      .catch((error) => { if (active) setLoadError(describeError(error)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the sheet's content mounts once per opening
  }, []);

  const closed = stored?.status === 'closed' || stored?.status === 'void';
  const readOnly = !canRegister || closed || !!lockNotice;

  // ── Autosave: one save at a time; changes made meanwhile go in the next one ──
  const draftRef = React.useRef<Draft | null>(null);
  draftRef.current = draft;
  const savedKeyRef = React.useRef('');
  const examIdRef = React.useRef<string | undefined>(undefined);
  const inFlightRef = React.useRef<Promise<unknown> | null>(null);
  const savedAnyRef = React.useRef(false);

  const applyServer = React.useCallback((exam: PerioExam) => {
    setStored(exam);
    setExams((list) => (list.some((e) => e.id === exam.id) ? list.map((e) => (e.id === exam.id ? exam : e)) : [...list, exam]));
  }, []);

  const saveOnce = React.useCallback(async (current: Draft) => {
    const key = draftKey(current);
    setSaveState({ kind: 'saving' });
    const saved = await savePerioExam(patientId, current, examIdRef.current);
    const created = !examIdRef.current;
    examIdRef.current = saved.id;
    savedKeyRef.current = key;
    savedAnyRef.current = true;
    applyServer(saved);
    setSaveState({ kind: 'saved', at: Date.now() });
    if (created) onChanged?.();
  }, [patientId, onChanged, applyServer]);

  const ensureSaved = React.useCallback(async (): Promise<string> => {
    for (;;) {
      if (inFlightRef.current) {
        await inFlightRef.current.catch(() => undefined);
        continue;
      }
      const current = draftRef.current;
      if (!current) throw new Error(t('sheet.notFound'));
      if (examIdRef.current && draftKey(current) === savedKeyRef.current) return examIdRef.current;
      const run = saveOnce(current);
      inFlightRef.current = run;
      try {
        await run;
      } catch (error) {
        const message = describeError(error);
        if (isExamLockedError(error)) {
          // Someone else closed or deleted it: saving again can't work
          setLockNotice(message);
          setSaveState({ kind: 'idle' });
        } else {
          setSaveState({ kind: 'error', message });
        }
        throw error;
      } finally {
        inFlightRef.current = null;
      }
    }
  }, [saveOnce, describeError, t]);

  const currentKey = draft ? draftKey(draft) : '';
  React.useEffect(() => {
    if (!draft || readOnly || currentKey === savedKeyRef.current) return;
    const timer = window.setTimeout(() => { ensureSaved().catch(() => undefined); }, AUTOSAVE_DELAY);
    return () => window.clearTimeout(timer);
  }, [currentKey, draft, readOnly, ensureSaved]);

  const unsaved = !!draft && !readOnly && (currentKey !== savedKeyRef.current || saveState.kind === 'saving');

  React.useEffect(() => {
    if (!unsaved) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [unsaved]);

  // Closing the sheet first finishes the pending save; if it fails, it asks
  const [leaving, setLeaving] = React.useState(false);
  React.useEffect(() => {
    closeRequestRef.current = () => {
      if (!unsaved) {
        if (savedAnyRef.current) onChanged?.();
        onClose();
        return;
      }
      setLeaving(true);
      ensureSaved()
        .then(() => { onChanged?.(); onClose(); })
        .catch(() => setConfirmLeave(true))
        .finally(() => setLeaving(false));
    };
    return () => { closeRequestRef.current = null; };
  });

  // ── Editing (through the ref, so several changes in one tick build on each other) ──
  const commitDraft = React.useCallback((next: Draft) => {
    draftRef.current = next;
    setDraft(next);
  }, []);

  const setTeeth = React.useCallback((update: (teeth: PerioTooth[]) => PerioTooth[], options?: { skipHistory?: boolean }) => {
    const d = draftRef.current;
    if (!d) return;
    const next = update(d.teeth);
    if (next === d.teeth) return;
    if (!options?.skipHistory) {
      setPast((p) => [...p.slice(-(HISTORY_LIMIT - 1)), d.teeth]);
      setFuture([]);
    }
    commitDraft({ ...d, teeth: next });
  }, [commitDraft]);

  const undo = () => {
    const d = draftRef.current;
    if (!d || !past.length || readOnly) return;
    setPast(past.slice(0, -1));
    setFuture([d.teeth, ...future]);
    commitDraft({ ...d, teeth: past[past.length - 1] });
  };
  const redo = () => {
    const d = draftRef.current;
    if (!d || !future.length || readOnly) return;
    setPast([...past, d.teeth]);
    setFuture(future.slice(1));
    commitDraft({ ...d, teeth: future[0] });
  };

  const onDictated = (refs: SiteRef[], before: PerioTooth[]) => {
    setDictated((current) => {
      const next = new Map(current);
      refs.forEach((ref) => {
        const key = siteKey(ref);
        const site = siteOf(before, ref);
        if (!next.has(key) && site) next.set(key, { ref, before: site });
      });
      return next;
    });
  };
  const confirmDictation = () => setDictated(new Map());
  /** Puts every dictated site back as it was (one undo step) */
  const discardDictation = () => {
    const entries = [...dictated.values()];
    if (entries.length) {
      setTeeth((teeth) => entries.reduce((list, e) => patchSites(list, [e.ref], () => e.before), teeth));
    }
    setDictated(new Map());
  };
  const revealMissing = (field: 'pd' | 'gm') => {
    setStep(1);
    setReveal({ field, nonce: Date.now() });
  };

  if (loading || loadError || !draft) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex shrink-0 items-center gap-3 border-b px-6 py-4 pr-24">
          <SheetTitle className="text-base font-semibold">{examId ? t('sheet.title') : t('sheet.newTitle')}</SheetTitle>
        </div>
        <div className="flex flex-1 flex-col gap-3 p-6">
          {loadError ? <Alert variant="destructive"><AlertDescription>{loadError}</AlertDescription></Alert> : (
            <>
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-[420px] w-full" />
            </>
          )}
        </div>
      </div>
    );
  }

  const isScreening = draft.examType === 'screening';
  const mode = { order: settings.order, implantsOnly: draft.examType === 'implants' };
  const progress = probeProgress(draft.teeth, mode);
  const sextantsCoded = assessScreening(draft.screening).coded;
  const confirmedDx = !!draft.diagnosis?.confirmedAt;
  // Same rules as perio_exam_recompute (database/scripts/165): a screening counts its six sextants
  const status: PerioExamStatus = !isScreening
    ? computeStatus(progress, stored?.status, confirmedDx)
    : stored?.status === 'closed' || stored?.status === 'void' ? stored.status : sextantsCoded < 6 ? 'probing' : confirmedDx ? 'diagnosed' : 'probed';
  const completeness = !isScreening
    ? computeCompleteness(progress, status)
    : status === 'closed' ? 100 : Math.round((90 * sextantsCoded) / 6) + (status === 'diagnosed' ? 10 : 0);
  const guideExam = exams.find((e) => e.id === draft.guideExamId) ?? null;
  const previousExams = exams.filter((e) => e.id !== stored?.id && e.status !== 'void' && e.date <= draft.date);
  // Cribado: lleva a lo que dice el aviso (sextantes sin código o el diagnóstico).
  const screeningTarget = sextantsCoded < 6 ? 1 : 3;
  const onMissingClick = isScreening && (status === 'probing' || status === 'probed') ? () => setStep(screeningTarget) : status === 'probing' ? () => revealMissing(progress.pd < progress.total ? 'pd' : 'gm') : status === 'probed' ? () => setStep(3) : status === 'diagnosed' ? () => setStep(4) : undefined;
  const earlierSessions = previousExams.map((e) => ({ id: e.id, date: e.date, examType: e.examType, teeth: e.teeth, diagnosis: e.diagnosis, screening: e.screening }));
  const todaySession = { id: stored?.id ?? 'today', date: draft.date, examType: draft.examType, teeth: draft.teeth, screening: draft.screening };

  return (
    <PerioSettingsContext.Provider value={settings}>
    <HintProvider>
      <div className="flex h-full min-h-0 flex-col">
        <FlowHeader
          patientName={patientName}
          date={draft.date}
          doctorName={draft.doctorName}
          examNumber={previousExams.length + 1}
          step={step}
          onStep={setStep}
          status={status}
          completeness={completeness}
          missing={isScreening ? screeningMissingText(t, status, sextantsCoded) : missingText(t, status, progress)}
          onMissingClick={onMissingClick}
          done={{ 1: status !== 'probing', 2: evolutionSeen || status === 'closed', 3: !!draft.diagnosis?.confirmedAt, 4: status === 'closed' }}
          saveIndicator={<SaveIndicator state={saveState} leaving={leaving} readOnly={readOnly} status={status} hasStored={!!stored} onRetry={() => { ensureSaved().catch(() => undefined); }} />}
        />
        {lockNotice && <Alert variant="destructive" className="shrink-0 rounded-none border-x-0 border-t-0"><AlertDescription>{lockNotice}</AlertDescription></Alert>}
        {stored?.status === 'closed' && (
          <div className="flex shrink-0 items-center gap-2 border-b bg-emerald-500/10 px-4 py-2 text-[13px] text-emerald-700 dark:text-emerald-300">
            <Lock className="h-4 w-4" />
            {t('sheet.closedBanner', { date: stored.closedAt ? formatUtcDateTime(stored.closedAt) : '', name: stored.closedByName ?? '' })}
          </div>
        )}
        <PerioFooterSlotContext.Provider value={footerSlot}>
          <div className="min-h-0 flex-1 overflow-auto">
            {step === 1 && isScreening && (
              <PerioScreeningStep
                screening={draft.screening}
                onChange={(screening) => commitDraft({ ...draft, screening })}
                examType={draft.examType}
                onExamTypeChange={(examType: PerioExamType) => commitDraft({ ...draft, examType })}
                readOnly={readOnly}
                onNext={() => setStep(2)}
              />
            )}
            {step === 1 && !isScreening && (
              <PerioProbeStep
                mode={mode}
                onSettingsChange={setSettings}
                teeth={draft.teeth}
                setTeeth={setTeeth}
                guide={guideExam?.teeth ?? null}
                guideDate={guideExam?.date}
                previousExams={previousExams}
                examType={draft.examType}
                onExamTypeChange={(examType: PerioExamType) => commitDraft({ ...draft, examType })}
                odontogramSummary={odontogramSummary}
                readOnly={readOnly}
                canUndo={past.length > 0 && !readOnly}
                canRedo={future.length > 0 && !readOnly}
                onUndo={undo}
                onRedo={redo}
                pending={pendingKeys}
                onDictated={onDictated}
                onConfirmDictation={confirmDictation}
                onDiscardDictation={discardDictation}
                reveal={reveal}
                onNext={() => setStep(2)}
              />
            )}
            {step === 2 && (
              <PerioEvolutionStep
                earlier={earlierSessions}
                today={todaySession}
                initialBaseId={compareWithId}
                onBackToProbe={() => setStep(1)}
                onNext={() => setStep(3)}
              />
            )}
            {step === 3 && (
              <PerioDiagnosisStep
                today={todaySession}
                earlier={earlierSessions}
                diagnosis={draft.diagnosis}
                onChange={(diagnosis) => commitDraft({ ...draft, diagnosis })}
                birthday={stored?.patientBirthday ?? exams.find((e) => e.patientBirthday)?.patientBirthday}
                probed={status !== 'probing'}
                readOnly={readOnly}
                onBack={() => setStep(2)}
                onNext={() => setStep(4)}
              />
            )}
            {step === 4 && (
              <PerioCloseStep
                draft={draft}
                stored={stored}
                status={status}
                readOnly={readOnly}
                canAmend={canRegister}
                patientId={patientId}
                patientName={patientName}
                initialTeeth={previousExams.find((e) => e.examType === 'initial')?.teeth ?? null}
                onNotes={(notes) => commitDraft({ ...draft, notes })}
                onClosing={(closing) => commitDraft({ ...draft, closing })}
                ensureSaved={ensureSaved}
                onServer={(exam) => { applyServer(exam); savedAnyRef.current = true; onChanged?.(); }}
                onRevealMissing={revealMissing}
                onGoToDiagnosis={() => setStep(3)}
                pendingDictation={dictated.size}
                onConfirmDictation={confirmDictation}
              />
            )}
          </div>
        </PerioFooterSlotContext.Provider>
        <div ref={setFooterSlot} data-help-id="perio-session.section.footer" className="shrink-0 border-t bg-card/95 px-4 py-2.5 shadow-[0_-4px_12px_-8px_rgb(0_0_0/0.25)] backdrop-blur empty:hidden" />
      </div>

      <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('flow.leave.title')}</AlertDialogTitle>
            <AlertDialogDescription>{saveState.kind === 'error' ? t('flow.leave.description', { error: saveState.message }) : t('flow.leave.descriptionGeneric')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('flow.leave.stay')}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={onClose}>{t('flow.leave.confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </HintProvider>
    </PerioSettingsContext.Provider>
  );
}

type Translate = (key: string, values?: Record<string, string | number>) => string;

function missingText(t: Translate, status: PerioExamStatus, progress: ReturnType<typeof probeProgress>): string {
  if (status === 'closed') return t('flow.missing.closed');
  if (status === 'void') return t('flow.missing.void');
  if (progress.pd < progress.total) return t('flow.missing.depths', { count: progress.total - progress.pd });
  if (progress.gm < progress.total) return t('flow.missing.margin', { count: progress.total - progress.gm });
  if (status === 'probed') return t('flow.missing.diagnosis');
  return t('flow.missing.ready');
}

/** Cribado: no hay sitios que sondar, solo los seis sextantes y después el diagnóstico. */
function screeningMissingText(t: Translate, status: PerioExamStatus, sextantsCoded: number): string {
  if (status === 'closed') return t('flow.missing.closed');
  if (status === 'void') return t('flow.missing.void');
  if (sextantsCoded < 6) return t('flow.missing.sextants', { count: 6 - sextantsCoded });
  if (status === 'probing' || status === 'probed') return t('flow.missing.diagnosis');
  return t('flow.missing.ready');
}

// ──── Header (copied from the aesthetic session): patient, stepper, status, completeness, what is missing ────

const HEADER_ONE_ROW_WIDTH = 1100;
const HEADER_COMPACT_WIDTH = 608;

interface FlowHeaderProps {
  patientName?: string;
  date: string;
  doctorName?: string;
  examNumber: number;
  step: Step;
  onStep: (step: Step) => void;
  status: PerioExamStatus;
  completeness: number;
  missing: string;
  /** Shows what is missing (highlighted on the chart) or goes to the closing when ready */
  onMissingClick?: () => void;
  done: Record<Step, boolean>;
  saveIndicator: React.ReactNode;
}

function FlowHeader({ patientName, date, doctorName, examNumber, step, onStep, status, completeness, missing, onMissingClick, done, saveIndicator }: FlowHeaderProps) {
  const t = useTranslations('PerioRecord');
  const initials = (patientName ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
  const radius = 15;
  const circumference = 2 * Math.PI * radius;
  const headerRef = React.useRef<HTMLElement>(null);
  const width = usePanelWidth(headerRef);
  const oneRow = width >= HEADER_ONE_ROW_WIDTH;
  const compact = width > 0 && width < HEADER_COMPACT_WIDTH;

  return (
    <header ref={headerRef} data-help-id="perio-session.section.header" className={cn('relative flex shrink-0 items-center border-b bg-card', compact ? 'flex-wrap gap-x-2 gap-y-1.5 py-2 pl-3 pr-12' : 'gap-x-5 gap-y-2 px-4 py-2.5 pr-24', !compact && (oneRow ? 'flex-nowrap' : 'flex-wrap'))}>
      <div className={cn('flex min-w-0 items-center', compact ? 'flex-[1_1_0] gap-2' : 'gap-3')}>
        <span className={cn('flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-pink-500 font-semibold text-white', compact ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm')} aria-hidden>
          {initials || '·'}
        </span>
        <div className="min-w-0">
          <SheetTitle className="truncate text-[15px] font-semibold">{patientName || t('sheet.title')}</SheetTitle>
          <p className="truncate text-xs text-muted-foreground">
            {t('flow.header.subtitle', { number: examNumber, date: formatDisplayDate(date) })}
            {doctorName ? ` · ${doctorName}` : ''}
          </p>
        </div>
      </div>

      <nav aria-label={t('flow.header.steps')} className={cn('flex items-center gap-1 overflow-x-auto [justify-content:safe_center] [scrollbar-width:none]', oneRow ? 'flex-[1_0_auto]' : 'order-last min-w-0 basis-full', compact && '-mr-9')}>
        {STEPS.map((n, i) => {
          const locked = COMING_SOON.includes(n);
          const isOn = step === n;
          return (
            <React.Fragment key={n}>
              {i > 0 && <span className={cn('h-px shrink-0 bg-border', compact ? 'min-w-2 flex-1' : 'w-4')} aria-hidden />}
              <Hint className="shrink-0" label={t('flow.hints.step', { step: n, name: t(`flow.steps.${STEP_KEYS[n]}`) })} description={locked ? t('flow.hints.comingSoon') : t(`flow.hints.steps.${STEP_KEYS[n]}`)}>
                <button
                  type="button"
                  data-help-id={`perio-session.btn.step-${STEP_KEYS[n]}`}
                  onClick={() => !locked && onStep(n)}
                  aria-current={isOn ? 'step' : undefined}
                  aria-disabled={locked || undefined}
                  className={cn(
                    'inline-flex items-center gap-2 whitespace-nowrap rounded-full py-1 pl-1 pr-3 text-[13px] font-medium transition-colors',
                    compact && !isOn && 'pr-1',
                    isOn ? 'bg-violet-500/10 text-violet-700 dark:text-violet-300' : 'text-muted-foreground hover:bg-muted',
                    locked && 'cursor-not-allowed opacity-55 hover:bg-transparent',
                  )}
                >
                  <span className={cn('flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold', isOn ? 'border-violet-600 bg-violet-600 text-white' : done[n] ? 'border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-muted')}>
                    {done[n] && !isOn ? <Check className="h-3.5 w-3.5" /> : locked ? <Lock className="h-3 w-3" /> : n}
                  </span>
                  <span className={cn(compact && !isOn && 'hidden')}>{t(`flow.steps.${STEP_KEYS[n]}`)}</span>
                </button>
              </Hint>
            </React.Fragment>
          );
        })}
      </nav>

      <div data-help-id="perio-session.section.progress" className={cn('ml-auto flex items-center gap-3', oneRow || compact ? 'shrink-0' : 'min-w-0')}>
        {!compact && (
          <svg viewBox="0 0 38 38" className="h-9 w-9 shrink-0" role="img" aria-label={t('flow.header.completeness', { value: completeness })}>
            <circle cx="19" cy="19" r={radius} fill="none" className="stroke-muted" strokeWidth="4" />
            <circle cx="19" cy="19" r={radius} fill="none" className={cn('transition-[stroke-dasharray] duration-300', status === 'closed' ? 'stroke-emerald-600' : 'stroke-violet-600')} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(circumference * completeness) / 100} ${circumference}`} transform="rotate(-90 19 19)" />
            <text x="19" y="22.5" textAnchor="middle" fontSize="9.5" fontWeight="600" className="fill-foreground">{completeness}%</text>
          </svg>
        )}
        <div className={cn('min-w-0', compact && 'flex flex-col items-end')}>
          <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold', PERIO_STATUS_CHIP[status])}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
            {t(`status.${status}`)}
          </span>
          {saveIndicator}
        </div>
        {!compact && (onMissingClick ? (
          <button type="button" data-help-id="perio-session.btn.missing" onClick={onMissingClick} title={status === 'probing' ? t('flow.missing.show') : undefined} className={cn('line-clamp-2 rounded-md text-left text-xs leading-snug underline decoration-dotted underline-offset-2 hover:text-foreground', status === 'probing' ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground', oneRow ? 'w-40' : 'max-w-[15rem]')} aria-live="polite">
            {status === 'probing' && <AlertTriangle className="mr-1 inline h-3 w-3 align-[-2px]" />}{missing}
          </button>
        ) : (
          <p className={cn('line-clamp-2 text-xs leading-snug text-muted-foreground', oneRow ? 'w-40' : 'max-w-[15rem]')} aria-live="polite">{missing}</p>
        ))}
      </div>

      {compact && (
        <div role="progressbar" aria-label={t('flow.header.completeness', { value: completeness })} aria-valuenow={completeness} aria-valuemin={0} aria-valuemax={100} className="absolute inset-x-0 bottom-0 h-0.5 bg-muted">
          <div className="h-full bg-violet-600 transition-[width] duration-300" style={{ width: `${completeness}%` }} />
        </div>
      )}
    </header>
  );
}

/** "Guardado hace 3 s", "Guardando…" or the error with a retry */
function SaveIndicator({ state, leaving, readOnly, status, hasStored, onRetry }: { state: SaveState; leaving: boolean; readOnly: boolean; status: PerioExamStatus; hasStored: boolean; onRetry: () => void }) {
  const t = useTranslations('PerioRecord');
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const base = 'mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground';
  if (status === 'closed') return <p className={base}>{t('flow.save.closed')}</p>;
  if (readOnly) return <p className={base}>{t('flow.save.readOnly')}</p>;
  if (state.kind === 'saving' || leaving) return <p className={base}><Loader2 className="h-3 w-3 animate-spin" />{t('flow.save.saving')}</p>;
  if (state.kind === 'error') {
    return (
      <p className={cn(base, 'text-destructive')} title={state.message}>
        <CloudOff className="h-3 w-3" />{t('flow.save.error')}
        <Button type="button" variant="link" size="sm" className="h-auto p-0 text-[11px]" onClick={onRetry}>{t('flow.save.retry')}</Button>
      </p>
    );
  }
  if (state.kind === 'saved') {
    const seconds = Math.max(0, Math.round((now - state.at) / 1000));
    return <p className={base}><Check className="h-3 w-3" />{seconds < 3 ? t('flow.save.justNow') : seconds < 60 ? t('flow.save.secondsAgo', { seconds }) : t('flow.save.minutesAgo', { minutes: Math.round(seconds / 60) })}</p>;
  }
  return <p className={base}>{hasStored ? t('flow.save.upToDate') : <><AlertTriangle className="h-3 w-3" />{t('flow.save.notCreated')}</>}</p>;
}
