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

import { AESTHETIC_RECORD_PERMISSIONS } from '@/constants/permissions';
import { usePanelWidth } from '@/hooks/use-panel-width';
import { usePermissions } from '@/hooks/usePermissions';
import { cn, formatDate, formatDisplayDate } from '@/lib/utils';
import {
  fetchAestheticSessions,
  fetchServiceAestheticConfigs,
  fetchServiceConsentTemplates,
  saveAestheticSession,
} from '@/services/aesthetic-record';

import type { AestheticBodyFigure, AestheticLayer, AestheticSession, ServiceAestheticConfig, ServiceConsentTemplate } from '@/lib/types';
import { isSessionLockedError, useAestheticErrorMessage } from './aesthetic-errors';
import type { FaceTone } from './face-models/face-illustration';
import { Hint, HintProvider } from './hint';
import { layerTitle } from './layers';
import {
  computeCompleteness,
  computeStatus,
  missingSummary,
  missingText,
  nextMissing,
  resumeStep,
  SESSION_STEPS,
  STATUS_CHIP,
  stepsDone,
  type SessionFacts,
  type SessionStep,
} from './session-status';
import { SessionFlowContext, type LayerChangeOptions, type SaveState, type SessionDraft, type SessionFlowValue } from './session-flow-context';
import { StepClose } from './step-close';
import { StepConsent } from './step-consent';
import { StepPhotos } from './step-photos';
import { StepTreatment } from './step-treatment';

/** Pause after the last change before it is saved */
const AUTOSAVE_DELAY = 800;
const HISTORY_LIMIT = 60;
const TONE_KEY = 'aesthetic-model-tone';

const draftKey = (draft: SessionDraft) => JSON.stringify(draft);

function draftFrom(session: AestheticSession, fallbackFigure: AestheticBodyFigure): SessionDraft {
  return {
    date: session.date,
    title: session.title,
    doctorId: session.doctorId,
    doctorName: session.doctorName,
    appointmentId: session.appointmentId,
    notes: session.notes,
    layers: session.layers,
    bodyFigure: session.bodyFigure ?? fallbackFigure,
  };
}

export interface AestheticSessionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  patientName?: string;
  /** Patient's sex: the face model and the body figure of a first session */
  patientSex?: AestheticBodyFigure | null;
  /** Session shown; `null` starts a new one */
  sessionId: string | null;
  /** Doctor of the context (e.g. the appointment's); preselected on new sessions */
  doctorId?: string;
  doctorName?: string;
  /** Appointment a new session is linked to */
  appointmentId?: string;
  readOnly?: boolean;
  /** A session was created, saved, signed, closed or voided */
  onChanged?: () => void;
}

/** One aesthetic session as a guided flow: Consent → Photos → Treatment → Closing, autosaved */
export function AestheticSessionSheet({ open, onOpenChange, ...panelProps }: AestheticSessionSheetProps) {
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
      defaultWidth={1240}
      minWidth={640}
      maxWidth={1800}
      storageKey="aesthetic-session-sheet-width"
    >
      {open && <SessionFlow {...panelProps} onClose={() => onOpenChange(false)} closeRequestRef={closeRequestRef} />}
    </ResizableSheet>
  );
}

interface SessionFlowProps extends Omit<AestheticSessionSheetProps, 'open' | 'onOpenChange'> {
  onClose: () => void;
  closeRequestRef: React.MutableRefObject<(() => void) | null>;
}

function SessionFlow({ patientId, patientName, patientSex, sessionId, doctorId, doctorName, appointmentId, readOnly: readOnlyProp = false, onChanged, onClose, closeRequestRef }: SessionFlowProps) {
  const t = useTranslations('AestheticRecord');
  const { hasPermission } = usePermissions();
  const canRegister = !readOnlyProp && hasPermission(AESTHETIC_RECORD_PERMISSIONS.REGISTER_SESSION);
  const sex: AestheticBodyFigure = patientSex ?? 'female';
  const describeError = useAestheticErrorMessage();

  const [sessions, setSessions] = React.useState<AestheticSession[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [configs, setConfigs] = React.useState<ServiceAestheticConfig[]>([]);
  const [configsError, setConfigsError] = React.useState<string | null>(null);
  const [templates, setTemplates] = React.useState<ServiceConsentTemplate[]>([]);

  const [stored, setStored] = React.useState<AestheticSession | null>(null);
  const [draft, setDraft] = React.useState<SessionDraft | null>(null);
  const [step, setStep] = React.useState<SessionStep>(1);
  const [past, setPast] = React.useState<AestheticLayer[][]>([]);
  const [future, setFuture] = React.useState<AestheticLayer[][]>([]);
  const [saveState, setSaveState] = React.useState<SaveState>({ kind: 'idle' });
  const [confirmLeave, setConfirmLeave] = React.useState(false);
  /** Why nothing can be saved anymore: someone else closed, voided or deleted this session */
  const [lockNotice, setLockNotice] = React.useState<string | null>(null);
  const [modelSex, setModelSex] = React.useState<AestheticBodyFigure>(sex);
  const [modelTone, setModelToneState] = React.useState<FaceTone>(() => {
    if (typeof window === 'undefined') return 'light';
    const saved = window.localStorage.getItem(TONE_KEY);
    return saved === 'medium' || saved === 'dark' ? saved : 'light';
  });
  const setModelTone = (tone: FaceTone) => {
    setModelToneState(tone);
    window.localStorage.setItem(TONE_KEY, tone);
  };

  // ── Load ──
  React.useEffect(() => {
    let active = true;
    fetchAestheticSessions(patientId)
      .then((list) => {
        if (!active) return;
        setSessions(list);
        const figure = [...list].reverse().find((s) => s.bodyFigure)?.bodyFigure ?? sex;
        const session = sessionId ? list.find((s) => s.id === sessionId) ?? null : null;
        if (sessionId && !session) {
          setLoadError(t('sheet.notFound'));
          return;
        }
        const next: SessionDraft = session ? draftFrom(session, figure) : {
          date: formatDate(new Date()),
          title: t('session.defaultTitle', { date: formatDisplayDate(formatDate(new Date())) }),
          doctorId,
          doctorName,
          appointmentId,
          notes: '',
          layers: [],
          bodyFigure: figure,
        };
        setStored(session);
        setDraft(next);
        savedKeyRef.current = draftKey(next);
        sessionIdRef.current = session?.id;
        setStep(session ? resumeStep(factsOf(next.layers, session)) : 1);
      })
      .catch((error) => { if (active) setLoadError(describeError(error)); })
      .finally(() => { if (active) setLoading(false); });
    fetchServiceAestheticConfigs().then((list) => { if (active) setConfigs(list); }).catch((error) => { if (active) setConfigsError(describeError(error)); });
    // Without them each service is signed with the generic text
    fetchServiceConsentTemplates().then((list) => { if (active) setTemplates(list); }).catch(() => undefined);
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the sheet's content mounts once per opening
  }, []);

  const closed = stored?.status === 'closed';
  const voided = stored?.status === 'void';
  const readOnly = !canRegister || closed || voided || !!lockNotice;

  // ── Autosave ──
  // One save at a time; changes made meanwhile go in the next one. The local layers stay the
  // source of truth while the sheet is open (the server recreates their ids on every save).
  const draftRef = React.useRef<SessionDraft | null>(null);
  draftRef.current = draft;
  const savedKeyRef = React.useRef('');
  const sessionIdRef = React.useRef<string | undefined>(undefined);
  const inFlightRef = React.useRef<Promise<unknown> | null>(null);
  /** Something was saved while the sheet was open: the patient's timeline reloads when it closes */
  const savedAnyRef = React.useRef(false);

  // Someone else closed, voided or deleted the session: retrying can't work, so the sheet stops
  // saving, says why and shows what the server has
  const lockedRef = React.useRef(false);
  const reportError = React.useCallback((error: unknown): string => {
    const message = describeError(error);
    if (!isSessionLockedError(error) || lockedRef.current) return message;
    lockedRef.current = true;
    const current = draftRef.current;
    const lostChanges = !!current && draftKey(current) !== savedKeyRef.current;
    setLockNotice(lostChanges ? `${message} ${t('errors.unsavedLost')}` : message);
    setSaveState({ kind: 'idle' });
    savedAnyRef.current = true;
    fetchAestheticSessions(patientId)
      .then((list) => {
        setSessions(list);
        const session = list.find((s) => s.id === sessionIdRef.current);
        if (!session) return;
        const next = draftFrom(session, current?.bodyFigure ?? sex);
        setStored(session);
        savedKeyRef.current = draftKey(next);
        draftRef.current = next;
        setDraft(next);
      })
      // The sheet stays read-only with what it has on screen
      .catch(() => undefined);
    return message;
  }, [describeError, patientId, sex, t]);

  const saveOnce = React.useCallback(async (current: SessionDraft) => {
    const key = draftKey(current);
    setSaveState({ kind: 'saving' });
    const saved = await saveAestheticSession(patientId, current, sessionIdRef.current);
    const created = !sessionIdRef.current;
    sessionIdRef.current = saved.id;
    savedKeyRef.current = key;
    savedAnyRef.current = true;
    setStored(saved);
    setSessions((list) => (list.some((s) => s.id === saved.id) ? list.map((s) => (s.id === saved.id ? saved : s)) : [...list, saved]));
    setSaveState({ kind: 'saved', at: Date.now() });
    if (created) onChanged?.();
  }, [patientId, onChanged]);

  const ensureSaved = React.useCallback(async (): Promise<string> => {
    for (;;) {
      if (inFlightRef.current) {
        await inFlightRef.current.catch(() => undefined);
        continue;
      }
      const current = draftRef.current;
      if (!current) throw new Error(t('sheet.notFound'));
      if (sessionIdRef.current && draftKey(current) === savedKeyRef.current) return sessionIdRef.current;
      const run = saveOnce(current);
      inFlightRef.current = run;
      try {
        await run;
      } catch (error) {
        const message = reportError(error);
        setSaveState(isSessionLockedError(error) ? { kind: 'idle' } : { kind: 'error', message });
        throw error;
      } finally {
        inFlightRef.current = null;
      }
    }
  }, [saveOnce, reportError, t]);

  const currentKey = draft ? draftKey(draft) : '';
  React.useEffect(() => {
    if (!draft || readOnly || currentKey === savedKeyRef.current) return;
    const timer = window.setTimeout(() => { ensureSaved().catch(() => undefined); }, AUTOSAVE_DELAY);
    return () => window.clearTimeout(timer);
  }, [currentKey, draft, readOnly, ensureSaved]);

  const unsaved = !!draft && !readOnly && (currentKey !== savedKeyRef.current || saveState.kind === 'saving');

  // Closing or reloading the page with a change on its way: ask first
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

  // ── Editing ──
  // Through the ref, so several changes in the same tick build on each other
  const commitDraft = React.useCallback((next: SessionDraft) => {
    draftRef.current = next;
    setDraft(next);
  }, []);

  const updateDraft = React.useCallback((patch: Partial<SessionDraft>) => {
    const d = draftRef.current;
    if (d) commitDraft({ ...d, ...patch });
  }, [commitDraft]);

  const setLayers = React.useCallback((update: (layers: AestheticLayer[]) => AestheticLayer[], options?: LayerChangeOptions) => {
    const d = draftRef.current;
    if (!d) return;
    const next = update(d.layers);
    if (next === d.layers) return;
    if (!options?.skipHistory) {
      setPast((p) => [...p.slice(-(HISTORY_LIMIT - 1)), d.layers]);
      setFuture([]);
    }
    commitDraft({ ...d, layers: next });
  }, [commitDraft]);

  const undo = () => {
    const d = draftRef.current;
    if (!d || !past.length) return;
    setPast(past.slice(0, -1));
    setFuture([d.layers, ...future]);
    commitDraft({ ...d, layers: past[past.length - 1] });
  };

  const redo = () => {
    const d = draftRef.current;
    if (!d || !future.length) return;
    setPast([...past, d.layers]);
    setFuture(future.slice(1));
    commitDraft({ ...d, layers: future[0] });
  };

  const applyServer = React.useCallback((session: AestheticSession) => {
    setStored(session);
    setSessions((list) => (list.some((s) => s.id === session.id) ? list.map((s) => (s.id === session.id ? session : s)) : [...list, session]));
    onChanged?.();
  }, [onChanged]);

  const updateSession = React.useCallback((id: string, update: (session: AestheticSession) => AestheticSession) => {
    setStored((s) => (s && s.id === id ? update(s) : s));
    setSessions((list) => list.map((s) => (s.id === id ? update(s) : s)));
    onChanged?.();
  }, [onChanged]);

  // ── Derived ──
  const facts = React.useMemo<SessionFacts>(() => factsOf(draft?.layers ?? [], stored), [draft?.layers, stored]);
  const status = computeStatus(facts);
  const completeness = computeCompleteness(facts);
  const done = stepsDone(facts);
  const previousSessions = React.useMemo(() => {
    const current = stored?.id;
    const date = draft?.date ?? '9999-12-31';
    return sessions
      .filter((s) => s.id !== current && s.status !== 'void' && s.date <= date)
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  }, [sessions, stored?.id, draft?.date]);
  const configFor = React.useCallback((layer: AestheticLayer) => configs.find((c) => c.serviceId === layer.serviceId), [configs]);
  const signedAny = draft?.layers.some((l) => l.serviceId && facts.consents.some((c) => c.serviceId === l.serviceId)) ?? false;

  const goToStep = React.useCallback((next: SessionStep) => setStep(next), []);

  if (loading || loadError || !draft) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex shrink-0 items-center gap-3 border-b px-6 py-4 pr-24">
          <SheetTitle className="text-base font-semibold">{sessionId ? t('sheet.title') : t('sheet.newTitle')}</SheetTitle>
        </div>
        <div className="flex flex-1 flex-col gap-3 p-6">
          {loadError ? (
            <Alert variant="destructive"><AlertDescription>{loadError}</AlertDescription></Alert>
          ) : (
            <>
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-[420px] w-full" />
            </>
          )}
        </div>
      </div>
    );
  }

  const value: SessionFlowValue = {
    patientId,
    patientName,
    patientSex: sex,
    draft,
    updateDraft,
    setLayers,
    undo,
    redo,
    canUndo: past.length > 0 && !readOnly,
    canRedo: future.length > 0 && !readOnly,
    stored,
    applyServer,
    updateSession,
    sessions,
    previousSessions,
    sessionNumber: previousSessions.length + 1,
    configs,
    configsError,
    templates,
    configFor,
    readOnly,
    canRegister,
    facts,
    status,
    completeness,
    done,
    step,
    goToStep,
    ensureSaved,
    saveState,
    retrySave: () => { ensureSaved().catch(() => undefined); },
    reportError,
    modelSex,
    setModelSex,
    modelTone,
    setModelTone,
  };

  return (
    <SessionFlowContext.Provider value={value}>
      <HintProvider>
      {/* 16px fields on a phone: with less, iOS zooms the page on focus */}
      <div className="flex h-full min-h-0 flex-col max-sm:[&_input]:text-base max-sm:[&_textarea]:text-base">
        <FlowHeader signedAny={signedAny} leaving={leaving} />
        {lockNotice && (
          <Alert variant="destructive" className="shrink-0 rounded-none border-x-0 border-t-0">
            <AlertDescription>{lockNotice}</AlertDescription>
          </Alert>
        )}
        <div className={cn('min-h-0 flex-1', 'flex flex-col overflow-hidden')}>
          {step === 1 && <StepConsent />}
          {step === 2 && <StepPhotos />}
          {step === 3 && <StepTreatment />}
          {step === 4 && <StepClose />}
        </div>
      </div>
      </HintProvider>

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
    </SessionFlowContext.Provider>
  );
}

function factsOf(layers: AestheticLayer[], session: AestheticSession | null): SessionFacts {
  return {
    layers,
    consents: session?.consents ?? [],
    photos: session?.photos ?? [],
    photoConsent: session?.photoConsent ?? null,
    closed: session?.status === 'closed',
    voided: session?.status === 'void',
  };
}

// ──── Header: patient, stepper, status, completeness and what is missing ────

const STEP_LABELS: Record<SessionStep, string> = { 1: 'consent', 2: 'photos', 3: 'treatment', 4: 'close' };

/** Width of the header's content (the sheet is resizable, so the viewport says nothing) */
const HEADER_ONE_ROW_WIDTH = 1100;
const HEADER_COMPACT_WIDTH = 608;

function FlowHeader({ signedAny, leaving }: { signedAny: boolean; leaving: boolean }) {
  const t = useTranslations('AestheticRecord');
  const flow = React.useContext(SessionFlowContext)!;
  const { draft, step, goToStep, done, status, completeness, facts, patientName, sessionNumber } = flow;
  const missing = nextMissing(facts, layerTitle);
  const missingFull = missingText(t, missing);
  const missingShort = missingSummary(t, missing);
  const initials = (patientName ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
  const radius = 15;
  const circumference = 2 * Math.PI * radius;

  const headerRef = React.useRef<HTMLElement>(null);
  const width = usePanelWidth(headerRef);
  const oneRow = width >= HEADER_ONE_ROW_WIDTH;
  const compact = width > 0 && width < HEADER_COMPACT_WIDTH;

  return (
    <header ref={headerRef} className={cn('relative flex shrink-0 items-center border-b bg-card', compact ? 'flex-wrap gap-x-2 gap-y-1.5 py-2 pl-3 pr-12' : 'gap-x-5 gap-y-2 px-4 py-2.5 pr-24', !compact && (oneRow ? 'flex-nowrap' : 'flex-wrap'))}>
      <div className={cn('flex min-w-0 items-center', compact ? 'flex-[1_1_0] gap-2' : 'gap-3')}>
        <span className={cn('flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-pink-500 font-semibold text-white', compact ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm')} aria-hidden>
          {initials || '·'}
        </span>
        <div className="min-w-0">
          <SheetTitle className="truncate text-[15px] font-semibold">{patientName || t('sheet.title')}</SheetTitle>
          <p className="truncate text-xs text-muted-foreground">
            {t('flow.header.subtitle', { number: sessionNumber, date: formatDisplayDate(draft.date) })}
            {draft.doctorName ? ` · ${draft.doctorName}` : ''}
          </p>
        </div>
      </div>

      <nav aria-label={t('flow.header.steps')} className={cn('flex items-center gap-1 overflow-x-auto [justify-content:safe_center] [scrollbar-width:none]', oneRow ? 'flex-[1_0_auto]' : 'order-last min-w-0 basis-full', compact && '-mr-9')}>
        {SESSION_STEPS.map((n, i) => {
          const locked = n === 3 && !flow.readOnly && !signedAny && !flow.stored?.layers.some((l) => l.marks.length);
          const isOn = step === n;
          return (
            <React.Fragment key={n}>
              {i > 0 && <span className={cn('h-px shrink-0 bg-border', compact ? 'min-w-2 flex-1' : 'w-4')} aria-hidden />}
              <Hint
                className="shrink-0"
                label={t('flow.hints.step', { step: n, name: t(`flow.steps.${STEP_LABELS[n]}`) })}
                description={locked ? t('flow.header.lockedTreatment') : `${t(`flow.hints.steps.${STEP_LABELS[n]}`)}${done[n] ? ` ${t('flow.hints.stepDone')}` : ''}`}
              >
              <button
                type="button"
                onClick={() => !locked && goToStep(n)}
                aria-current={isOn ? 'step' : undefined}
                aria-disabled={locked || undefined}
                className={cn(
                  'inline-flex items-center gap-2 whitespace-nowrap rounded-full py-1 pl-1 pr-3 text-[13px] font-medium transition-colors',
                  compact && !isOn && 'pr-1',
                  isOn ? 'bg-violet-500/10 text-violet-700 dark:text-violet-300' : 'text-muted-foreground hover:bg-muted',
                  locked && 'cursor-not-allowed opacity-55 hover:bg-transparent',
                )}
              >
                <span
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold',
                    isOn ? 'border-violet-600 bg-violet-600 text-white' : done[n] ? 'border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-muted',
                  )}
                >
                  {done[n] && !isOn ? <Check className="h-3.5 w-3.5" /> : locked ? <Lock className="h-3 w-3" /> : n}
                </span>
                <span className={cn(compact && !isOn && 'hidden')}>{t(`flow.steps.${STEP_LABELS[n]}`)}</span>
              </button>
              </Hint>
            </React.Fragment>
          );
        })}
      </nav>

      <div className={cn('ml-auto flex items-center gap-3', oneRow || compact ? 'shrink-0' : 'min-w-0')}>
        {!compact && (
        <Hint label={t('flow.header.completeness', { value: completeness })} description={t('flow.hints.completeness')}>
        <svg viewBox="0 0 38 38" className="h-9 w-9 shrink-0" role="img" aria-label={t('flow.header.completeness', { value: completeness })}>
          <circle cx="19" cy="19" r={radius} fill="none" className="stroke-muted" strokeWidth="4" />
          <circle
            cx="19"
            cy="19"
            r={radius}
            fill="none"
            className="stroke-violet-600 transition-[stroke-dasharray] duration-300"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${(circumference * completeness) / 100} ${circumference}`}
            transform="rotate(-90 19 19)"
          />
          <text x="19" y="22.5" textAnchor="middle" fontSize="9.5" fontWeight="600" className="fill-foreground">{completeness}%</text>
        </svg>
        </Hint>
        )}
        <div className={cn('min-w-0', compact && 'flex flex-col items-end')}>
          <Hint label={t(`flow.status.${status}`)} description={t(`flow.hints.status.${status}`)}>
          <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold', STATUS_CHIP[status])}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
            {t(`flow.status.${status}`)}
          </span>
          </Hint>
          <SaveIndicator leaving={leaving} />
        </div>
        {!compact && (
          <Hint label={missingFull} className={oneRow ? 'w-40' : 'max-w-[15rem]'}>
            <p className="line-clamp-2 text-xs leading-snug text-muted-foreground" aria-live="polite">{missingShort}</p>
          </Hint>
        )}
      </div>

      {/* On a phone the ring gives way to a thin bar along the header */}
      {compact && (
        <div role="progressbar" aria-label={t('flow.header.completeness', { value: completeness })} aria-valuenow={completeness} aria-valuemin={0} aria-valuemax={100} className="absolute inset-x-0 bottom-0 h-0.5 bg-muted">
          <div className="h-full bg-violet-600 transition-[width] duration-300" style={{ width: `${completeness}%` }} />
        </div>
      )}
    </header>
  );
}

/** "Guardado hace 3 s", "Guardando…" or the error with a retry */
function SaveIndicator({ leaving }: { leaving: boolean }) {
  const t = useTranslations('AestheticRecord');
  const { saveState, retrySave, readOnly, stored } = React.useContext(SessionFlowContext)!;
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const base = 'mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground';
  if (stored?.status === 'closed') return <p className={base}>{t('flow.save.closed')}</p>;
  if (stored?.status === 'void') return <p className={base}>{t('flow.save.voided')}</p>;
  if (readOnly) return <p className={base}>{t('flow.save.readOnly')}</p>;
  if (saveState.kind === 'saving' || leaving) return <p className={base}><Loader2 className="h-3 w-3 animate-spin" />{t('flow.save.saving')}</p>;
  if (saveState.kind === 'error') {
    return (
      <p className={cn(base, 'text-destructive')} title={saveState.message}>
        <CloudOff className="h-3 w-3" />{t('flow.save.error')}
        <Button type="button" variant="link" size="sm" className="h-auto p-0 text-[11px]" onClick={retrySave}>{t('retry')}</Button>
      </p>
    );
  }
  if (saveState.kind === 'saved') {
    const seconds = Math.max(0, Math.round((now - saveState.at) / 1000));
    return <p className={base}><Check className="h-3 w-3" />{seconds < 3 ? t('flow.save.justNow') : seconds < 60 ? t('flow.save.secondsAgo', { seconds }) : t('flow.save.minutesAgo', { minutes: Math.round(seconds / 60) })}</p>;
  }
  return <p className={base}>{stored ? t('flow.save.upToDate') : <><AlertTriangle className="h-3 w-3" />{t('flow.save.notCreated')}</>}</p>;
}
