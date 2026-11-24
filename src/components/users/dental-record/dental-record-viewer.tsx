'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ImageLightbox } from '@/components/ui/image-viewer';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
import { cn, formatDisplayDate } from '@/lib/utils';
import type {
  OdontogramMarcacion,
  OdontogramSnapshot,
  OdontogramState,
} from '@/lib/types';
import { upsertOdontogram, fetchDoctors, fetchOdontograms } from '@/services/dental-record';
import { ensureDoctorOption } from '@/services/doctors';
import { api } from '@/services/api';
import { API_ROUTES } from '@/constants/routes';
import type { DoctorOption } from '@/services/dental-record';
import { archOf, isTemporalTooth, surfaceLetter } from './odontogram-catalog';
import {
  carryOverState,
  cloneState,
  diffMarks,
  isInheritedMark,
  listToothMarks,
  marcacionesToProposals,
  type MarkChange,
  type ProposedMark,
} from './odontogram-state';
import { type Dentition, OdontogramChart } from './odontogram-chart';
import { type OdontogramView, OdontogramWorkspace } from './odontogram-workspace';
import { SessionForm } from './session-form';
import type { SessionFormValues } from './session-form';
import { useConditionLabel } from './tooth-inspector';
import { useTranslations } from 'next-intl';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { useAuth } from '@/context/AuthContext';
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Maximize,
  Minimize,
  Paperclip,
  Pencil,
  Plus,
  Stethoscope,
  User,
  Zap,
} from 'lucide-react';
import { useBillingWizard } from '@/stores/billing-wizard-store';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

function formatLongSessionDate(dateStr: string) {
  try {
    return format(parseISO(dateStr.replace('Z', '')), "dd 'de' MMMM yyyy", { locale: es });
  } catch {
    return dateStr;
  }
}

const MAX_UNDO_STEPS = 60;

/**
 * Brings the session notes in line with the chart: the lines written for the previous chart that no
 * longer apply are taken out (only if they are still there as written) and the new ones go at the
 * end. What the professional typed or edited is left alone.
 */
function syncAutoNotes(notes: string, before: string[], after: string[]): string {
  const keep = new Set(after);
  const had = new Set(before);
  const lines = notes ? notes.split('\n') : [];
  for (const line of before) {
    if (keep.has(line)) continue;
    const i = lines.lastIndexOf(line);
    if (i >= 0) lines.splice(i, 1);
  }
  const added = after.filter((line) => !had.has(line));
  const text = lines.join('\n').replace(/\s+$/, '');
  if (!added.length) return text;
  return text ? `${text}\n${added.join('\n')}` : added.join('\n');
}


/** Outcome of an agent prefill request, reported back so the agent never claims a change that did not happen */
export interface OdontogramPrefillResult {
  applied: boolean;
}

interface DentalRecordViewerProps {
  patientId: string;
  patientName?: string;
  doctorId?: string;
  doctorName?: string;
  /**
   * Changes on every agent request to pre-fill the odontogram (title, notes and `autoStartMarcaciones`).
   * Each new value is applied once: on top of the session being edited, on the appointment's existing
   * odontogram session, or on a new session.
   */
  autoStartKey?: number;
  /** Reports whether the request for `autoStartKey` could be applied */
  onAutoStartHandled?: (key: number, result: OdontogramPrefillResult) => void;
  autoStartDescription?: string;
  autoStartNotes?: string;
  autoStartNextSessionPlan?: string;
  autoStartMarcaciones?: OdontogramMarcacion[];
  onSessionSaved?: () => void;
  /** When true: hides session history nav and auto-starts a new session on load */
  createMode?: boolean;
  onCancelCreate?: () => void;
  /**
   * Header of the sheet that hosts the viewer: the session steps and Cancelar go there instead of
   * taking a row of their own. Without it they sit at the end of the odontogram's control row.
   */
  headerActionsTarget?: HTMLElement | null;
  /** Session shown first (e.g. the one picked in the clinical timeline); the latest one otherwise */
  initialSessionId?: string;
  /** When true, prevents creating new sessions (one already exists today for this patient) */
  blockNewSession?: boolean;
  blockNewSessionMessage?: string;
  appointmentId?: string;
  /** When true, auto-enters edit mode for the snapshot matching appointmentId after load */
  autoNavigateToAppointmentSession?: boolean;
  /** When true, hides the Cobro Rápido button (e.g. in doctor workspace) */
  hideBillingWizard?: boolean;
}

export function DentalRecordViewer({ patientId, patientName, doctorId, doctorName, autoStartKey, onAutoStartHandled, autoStartDescription, autoStartNotes, autoStartNextSessionPlan, autoStartMarcaciones, onSessionSaved, createMode, onCancelCreate, blockNewSession, blockNewSessionMessage, appointmentId, autoNavigateToAppointmentSession, hideBillingWizard = false, headerActionsTarget, initialSessionId }: DentalRecordViewerProps) {
  const t = useTranslations('DentalRecord');
  const isMobile = useViewportNarrow(768);
  const { toast } = useToast();
  const { open: openBillingWizard } = useBillingWizard();
  const { user } = useAuth();

  const [history, setHistory] = useState<OdontogramSnapshot[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingSnapshot, setEditingSnapshot] = useState<OdontogramSnapshot | null>(null);
  const [editingState, setEditingState] = useState<OdontogramState>({});
  const [editingDefaultDescription, setEditingDefaultDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [initialNotes, setInitialNotes] = useState('');
  const [nextSessionPlan, setNextSessionPlan] = useState('');
  const [undoStack, setUndoStack] = useState<OdontogramState[]>([]);
  const [redoStack, setRedoStack] = useState<OdontogramState[]>([]);
  /**
   * Where the session started from (the previous session, carried over): the session notes describe
   * the net changes from it, so what is marked and then taken back leaves no line
   */
  const [noteBaseState, setNoteBaseState] = useState<OdontogramState>({});
  /** Dictated or agent marks waiting for the professional to confirm them */
  const [proposals, setProposals] = useState<ProposedMark[]>([]);
  /** State of the session this edit starts from; its marks are voided instead of deleted */
  const [baseState, setBaseState] = useState<OdontogramState | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
  const [confirmAction, setConfirmAction] = useState<'cancel' | null>(null);
  /**
   * View and dentition picked by the user. They stay when moving between sessions (that is how
   * sessions are compared); `null` until the user changes them, so the first one fits the chart.
   */
  const [chartView, setChartView] = useState<OdontogramView>('fdi');
  const [chartDentition, setChartDentition] = useState<Dentition | null>(null);
  /** 1: mark the odontogram · 2: register the session (date, doctor, notes, files, next visit) */
  const [step, setStep] = useState<1 | 2>(1);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([
      fetchOdontograms(patientId),
      fetchDoctors(),
    ]).then(async ([snapshots, docs]) => {
      const nextDoctors = await ensureDoctorOption(docs, doctorId, doctorName);
      setHistory(snapshots);
      setHistoryIndex(snapshots.length - 1);
      setDoctors(nextDoctors);
      setIsLoading(false);

      if (autoNavigateToAppointmentSession && appointmentId) {
        const idx = snapshots.findIndex((s) => s.appointmentId === appointmentId);
        if (idx >= 0) setHistoryIndex(idx);
      }
      if (initialSessionId) {
        const idx = snapshots.findIndex((s) => s.id === initialSessionId);
        if (idx >= 0) setHistoryIndex(idx);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  useEffect(() => {
    if (createMode && !isLoading && !blockNewSession) {
      handleStartNewSession(autoStartDescription, autoStartNotes, autoStartMarcaciones, autoStartNextSessionPlan);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockNewSession, createMode, isLoading]);

  // Agent requests are keyed, so a second request while the odontogram is already open is
  // applied too (a boolean flag would stay `true` and ignore it).
  const handledAutoStartKeyRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (autoStartKey === undefined || isLoading || handledAutoStartKeyRef.current === autoStartKey) return;
    handledAutoStartKeyRef.current = autoStartKey;
    onAutoStartHandled?.(autoStartKey, applyAgentPrefill());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStartKey, isLoading]);

  const currentSnapshot = historyIndex >= 0 && historyIndex < history.length
    ? history[historyIndex] : null;

  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < history.length - 1;

  const displayState: OdontogramState = isEditing ? editingState : (currentSnapshot?.state ?? {});
  const hasUnsavedChanges = undoStack.length > 0 || notes !== initialNotes || proposals.length > 0;
  const previousOfCurrent = historyIndex > 0 ? history[historyIndex - 1]?.state ?? null : null;

  // Resolve doctor name from snapshot (prefers stored name, falls back to local list)
  function resolveDoctorName(snapshot: OdontogramSnapshot): string | null {
    if (snapshot.doctorName) return snapshot.doctorName;
    if (snapshot.doctorId) {
      const doc = doctors.find((d) => d.id === snapshot.doctorId);
      if (doc) return doc.name;
    }
    return null;
  }


  function resetEditingSession(initialState: OdontogramState, initialNotesValue: string, initialPlan: string, base: OdontogramState | null) {
    setStep(1);
    setEditingState(initialState);
    setNoteBaseState(base ? carryOverState(base) : {});
    setBaseState(base);
    setNotes(initialNotesValue);
    setInitialNotes(initialNotesValue);
    setNextSessionPlan(initialPlan);
    setUndoStack([]);
    setRedoStack([]);
    setProposals([]);
    setIsEditing(true);
    if (isMobile) setIsFullscreen(true);
  }

  // A new session starts from the latest one: what was done there is existing now
  function handleStartNewSession(description?: string, notes?: string, marcaciones?: OdontogramMarcacion[], plan?: string) {
    const latest = history[history.length - 1]?.state ?? null;
    setHistoryIndex(history.length - 1);
    setEditingDefaultDescription(description || t('session.defaultTitle', { date: format(new Date(), 'dd/MM/yyyy HH:mm') }));
    resetEditingSession(latest ? carryOverState(latest) : {}, notes ?? '', plan ?? '', latest);
    if (marcaciones?.length) setProposals(marcacionesToProposals(marcaciones));
  }

  function handleStartEditSession(snapshot: OdontogramSnapshot) {
    const index = history.indexOf(snapshot);
    setEditingSessionId(snapshot.id ?? null);
    setEditingSnapshot(snapshot);
    setEditingDefaultDescription(snapshot.description || t('session.defaultTitle', { date: format(new Date(), 'dd/MM/yyyy HH:mm') }));
    resetEditingSession(cloneState(snapshot.state), snapshot.notes ?? '', snapshot.planProximaCita ?? '', index > 0 ? history[index - 1].state : null);
  }

  function appendNotes(current: string, extra?: string): string {
    const text = extra?.trim();
    if (!text || current.includes(text)) return current;
    return current.trim() ? `${current}\n${text}` : text;
  }

  /**
   * Applies the agent's prefill without discarding work: in the session being edited, otherwise in
   * this appointment's odontogram session, otherwise in a new one. Its marks arrive as proposals:
   * nothing is recorded until the professional confirms them.
   */
  function applyAgentPrefill(): OdontogramPrefillResult {
    const agentProposals = marcacionesToProposals(autoStartMarcaciones ?? []);

    if (isEditing) {
      const nextNotes = appendNotes(notes, autoStartNotes);
      if (agentProposals.length > 0) setProposals((prev) => [...prev, ...agentProposals]);
      if (nextNotes !== notes) setNotes(nextNotes);
      setNextSessionPlan((prev) => appendNotes(prev, autoStartNextSessionPlan));
      return { applied: true };
    }

    const appointmentSnapshot = appointmentId
      ? history.find((s) => s.appointmentId === appointmentId)
      : undefined;
    if (appointmentSnapshot) {
      setHistoryIndex(history.indexOf(appointmentSnapshot));
      handleStartEditSession(appointmentSnapshot);
      setNotes(appendNotes(appointmentSnapshot.notes ?? '', autoStartNotes));
      setNextSessionPlan(appendNotes(appointmentSnapshot.planProximaCita ?? '', autoStartNextSessionPlan));
      setProposals(agentProposals);
      return { applied: true };
    }

    if (blockNewSession) return { applied: false };

    handleStartNewSession(autoStartDescription, autoStartNotes, autoStartMarcaciones, autoStartNextSessionPlan);
    return { applied: true };
  }

  function clearEditingSession() {
    setStep(1);
    setIsEditing(false);
    setIsFullscreen(false);
    setEditingState({});
    setNoteBaseState({});
    setEditingSessionId(null);
    setEditingSnapshot(null);
    setNotes('');
    setInitialNotes('');
    setNextSessionPlan('');
    setUndoStack([]);
    setRedoStack([]);
    setProposals([]);
    setBaseState(null);
    setEditingDefaultDescription('');
  }

  function handleCancelEditing() {
    clearEditingSession();
    if (createMode) onCancelCreate?.();
  }

  function requestCancelEditing() {
    if (hasUnsavedChanges) setConfirmAction('cancel');
    else handleCancelEditing();
  }

  const handleSave = useCallback(async (values: SessionFormValues) => {
    // Dictated marks are only recorded once confirmed: saving would silently drop them
    if (proposals.length > 0) throw new Error(t('proposals.pendingOnSave', { count: proposals.length }));
    await upsertOdontogram(
      patientId,
      {
        date: values.date,
        description: values.description,
        state: editingState,
        notes: values.notes,
        doctorId: values.doctorId || undefined,
        planProximaCita: values.nextSessionPlan || undefined,
        fechaProximaCita: values.nextSessionDate || undefined,
        appointmentId: editingSnapshot?.appointmentId || appointmentId || undefined,
      },
      values.files,
      editingSessionId ?? undefined,
    );

    if (values.shouldDischarge && values.dischargeDate) {
      try {
        await api.post(API_ROUTES.PATIENT_DISCHARGE, {
          id: patientId,
          appointment_date: values.dischargeDate,
        });
        toast({ title: t('session.discharge.toastSuccess') });
      } catch {
        // discharge failure is non-blocking — session already saved
      }
    }

    const updated = await fetchOdontograms(patientId);
    setHistory(updated);
    setHistoryIndex(updated.length - 1);
    clearEditingSession();
    toast({ title: t('session.saveSuccess'), description: values.description });
    onSessionSaved?.();
  }, [appointmentId, editingSessionId, editingSnapshot, editingState, onSessionSaved, patientId, proposals.length, t, toast]);

  // ── Session notes: one line per net change of the chart since the edit began ──
  const conditionLabel = useConditionLabel();
  const statusLabel = (status: string) => t(`status.${status}`).toLowerCase();
  function noteLines(current: OdontogramState): string[] {
    // A bridge recorded in one go is one line (D14–16), not one per tooth
    const groups: MarkChange[][] = [];
    const byRange = new Map<string, MarkChange[]>();
    for (const change of diffMarks(noteBaseState, current)) {
      const range = change.kind === 'added' || change.kind === 'status' ? change.mark.meta?.range : undefined;
      const key = range && `${change.kind}|${range}|${change.mark.status}`;
      const group = key ? byRange.get(key) : undefined;
      if (group) {
        group.push(change);
        continue;
      }
      groups.push([change]);
      if (key) byRange.set(key, groups[groups.length - 1]);
    }
    return groups.map((group) => {
      if (group.length === 1) return describeChange(group[0], group[0].mark.toothId);
      const arch = archOf(Number(group[0].mark.toothId));
      const teeth = group.map((c) => Number(c.mark.toothId)).sort((a, b) => arch.indexOf(a) - arch.indexOf(b));
      const { mark } = group[0];
      if (group[0].kind === 'added') {
        return t('autoNote.rangeAdded', { from: teeth[0], to: teeth[teeth.length - 1], label: `${conditionLabel(mark.condition, true)} (${statusLabel(mark.status)})` });
      }
      return describeChange(group[0], `${teeth[0]}–${teeth[teeth.length - 1]}`);
    });
  }
  function describeChange(change: MarkChange, tooth: string): string {
    const { mark } = change;
    const label = conditionLabel(mark.condition, true);
    const surface = mark.surface ? surfaceLetter(Number(mark.toothId), mark.surface) : null;
    switch (change.kind) {
      case 'added':
        return surface
          ? t('autoNote.surfaceAdded', { tooth, surface, label: `${label} (${statusLabel(mark.status)})` })
          : t('autoNote.toothAdded', { tooth, label: `${label} (${statusLabel(mark.status)})` });
      case 'removed':
        return surface ? t('autoNote.surfaceRemoved', { tooth, surface, label }) : t('autoNote.toothRemoved', { tooth, label });
      case 'status':
        return t('autoNote.statusChanged', { tooth: surface ? `${tooth}(${surface})` : tooth, label, status: statusLabel(mark.status) });
      case 'voided':
        return t('autoNote.voided', { tooth, label, reason: change.reason });
    }
  }

  /** Moves the chart to `next` and rewrites the lines of the notes that describe it */
  function moveChartTo(next: OdontogramState) {
    const before = noteLines(editingState);
    const after = noteLines(next);
    setEditingState(next);
    setNotes((prev) => syncAutoNotes(prev, before, after));
  }

  // Every chart edit records the previous state so it can be undone
  function commitEdit(nextState: OdontogramState) {
    setUndoStack((prev) => [...prev.slice(-(MAX_UNDO_STEPS - 1)), editingState]);
    setRedoStack([]);
    moveChartTo(nextState);
  }

  function handleUndo() {
    const previous = undoStack[undoStack.length - 1];
    if (!previous) return;
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, editingState]);
    moveChartTo(previous);
  }

  function handleRedo() {
    const next = redoStack[redoStack.length - 1];
    if (!next) return;
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev, editingState]);
    moveChartTo(next);
  }

  function handleConfirm() {
    if (confirmAction === 'cancel') handleCancelEditing();
    setConfirmAction(null);
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  // ── Session files: a button in the navigation header (the session's title, date and doctor are there too)
  const shownDoctorName = currentSnapshot ? resolveDoctorName(currentSnapshot) : null;
  const attachments = !isEditing ? currentSnapshot?.archivosAdjuntos ?? [] : [];
  const attachmentsButton = attachments.length > 0 && (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 shrink-0 gap-1.5 px-2 text-xs" title={t('session.files')} aria-label={t('session.files')}>
          <Paperclip className="h-3.5 w-3.5" />
          <span className="tabular-nums">{attachments.length}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2">
        <p className="px-1.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t('session.files')}</p>
        <div className="flex flex-col gap-0.5">
          {attachments.map((att, i) => {
            const isImage = att.tipo?.startsWith('image/');
            const label = att.diente_asociado ? t('board.toothLabel', { tooth: att.diente_asociado }) : t('session.attachment');
            const rowClass = 'flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-xs text-primary hover:bg-primary/10';
            return isImage ? (
              <button key={i} type="button" onClick={() => setLightbox({ src: att.ruta, alt: label })} className={rowClass}>
                <ImageIcon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{label}</span>
              </button>
            ) : (
              <a key={i} href={att.ruta} target="_blank" rel="noopener noreferrer" className={rowClass}>
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{label}</span>
                <ExternalLink className="ml-auto h-3 w-3 shrink-0 opacity-60" />
              </a>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );

  const billingButtonLabel = t('quickBilling');

  // Dictated marks must be confirmed or discarded before the session can be registered
  function goToRegister() {
    if (proposals.length > 0) {
      toast({ title: t('proposals.pendingOnSave', { count: proposals.length }) });
      return;
    }
    setStep(2);
  }

  const stepControls = isEditing && (
    <div className="flex items-center gap-2">
      <nav aria-label={t('steps.label')} className="hidden items-center gap-1 sm:flex">
        {([1, 2] as const).map((n) => (
          <React.Fragment key={n}>
            {n === 2 && <span className="h-px w-3 bg-border" aria-hidden />}
            <button
              type="button"
              onClick={() => (n === 2 ? goToRegister() : setStep(1))}
              aria-current={step === n ? 'step' : undefined}
              className={cn(
                'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full py-0.5 pl-0.5 pr-2.5 text-xs font-medium',
                step === n ? 'bg-primary/10 text-primary dark:text-foreground' : 'text-muted-foreground hover:bg-muted',
              )}
            >
              <span className={cn('grid h-5 w-5 place-items-center rounded-full border text-[11px] font-semibold', step === n ? 'border-primary bg-primary text-primary-foreground' : 'bg-muted')}>{n}</span>
              {t(n === 1 ? 'steps.chart' : 'steps.register')}
            </button>
          </React.Fragment>
        ))}
      </nav>
      <Button size="sm" variant="outline" onClick={requestCancelEditing} className="h-8 text-xs">
        {t('session.cancel')}
      </Button>
      {step === 1 ? (
        <Button size="sm" onClick={goToRegister} className="h-8 gap-1 text-xs">
          {t('steps.continue')}
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setStep(1)} className="h-8 gap-1 text-xs">
          <ChevronLeft className="h-3.5 w-3.5" />
          {t('steps.back')}
        </Button>
      )}
    </div>
  );
  // In fullscreen the sheet header is covered, so the controls stay inside the viewer
  const portalTarget = isFullscreen ? null : headerActionsTarget ?? null;

  const changesToday = isEditing
    ? Object.keys(editingState).flatMap((id) => listToothMarks(id, editingState[id])).filter((m) => !isInheritedMark(baseState, m)).length
    : 0;
  const summaryDentition = Object.keys(editingState).some((id) => isTemporalTooth(Number(id))) ? 'mixed' : 'permanent';

  const workspace = (
      <OdontogramWorkspace
        key={isEditing ? `edit-${editingSessionId ?? 'new'}` : `read-${currentSnapshot?.id ?? historyIndex}`}
        state={displayState}
        previousState={isEditing ? baseState : previousOfCurrent}
        readOnly={!isEditing}
        history={history}
        proposals={proposals}
        onProposalsChange={setProposals}
        onChange={commitEdit}
        onNotesChange={setEditingState}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        userId={user?.id}
        fitHeight={isEditing}
        view={chartView}
        onViewChange={setChartView}
        dentition={chartDentition ?? undefined}
        onDentitionChange={setChartDentition}
        controlsExtra={isEditing && !portalTarget ? stepControls : undefined}
      />
  );

  // Read mode: what was written in the session (notes, plan and date of the next visit)
  const sessionNotes = !isEditing && currentSnapshot && (currentSnapshot.notes?.trim() || currentSnapshot.planProximaCita?.trim() || currentSnapshot.fechaProximaCita) ? (
    <section className="grid gap-3 rounded-2xl border bg-card p-4 md:grid-cols-2" aria-label={t('session.notes')}>
      {currentSnapshot.notes?.trim() && (
        <div className={cn('flex min-w-0 flex-col gap-1.5', !(currentSnapshot.planProximaCita?.trim() || currentSnapshot.fechaProximaCita) && 'md:col-span-2')}>
          <h3 className="text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground">{t('session.notes')}</h3>
          <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-foreground">{currentSnapshot.notes.trim()}</p>
        </div>
      )}
      {(currentSnapshot.planProximaCita?.trim() || currentSnapshot.fechaProximaCita) && (
        <div className={cn('flex min-w-0 flex-col gap-1.5', !currentSnapshot.notes?.trim() && 'md:col-span-2')}>
          <h3 className="text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground">{t('session.nextSessionPlan')}</h3>
          {currentSnapshot.fechaProximaCita && (
            <span className="text-xs text-muted-foreground">{t('session.nextSessionDate')}: {formatDisplayDate(currentSnapshot.fechaProximaCita)}</span>
          )}
          {currentSnapshot.planProximaCita?.trim() && (
            <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-foreground">{currentSnapshot.planProximaCita.trim()}</p>
          )}
        </div>
      )}
    </section>
  ) : null;

  const sessionForm = isEditing && (
    <SessionForm
      defaultDate={editingSnapshot?.date ?? new Date().toISOString().split('T')[0]}
      defaultDescription={editingDefaultDescription}
      defaultNextSessionDate={editingSnapshot?.fechaProximaCita}
      doctors={doctors}
      notes={notes}
      onNotesChange={setNotes}
      nextSessionPlan={nextSessionPlan}
      onNextSessionPlanChange={setNextSessionPlan}
      onSave={handleSave}
      lockDoctorId={doctorId ?? editingSnapshot?.doctorId}
      lockDoctorName={doctorName || (editingSnapshot ? resolveDoctorName(editingSnapshot) ?? undefined : undefined)}
      isEdit={!!editingSessionId}
    />
  );

  return (
    <div
      className={cn(
        'flex flex-col gap-3',
        isFullscreen ? 'fixed inset-0 z-50 bg-background p-4 overflow-auto' : 'h-full',
      )}
    >
      {/* ── Nav ── */}
      {!createMode && (isMobile ? (
        /* Mobile: single row — session navigation */
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setHistoryIndex((i) => Math.max(0, i - 1))}
              disabled={!canGoBack || isEditing}
              className="p-1 rounded hover:bg-muted disabled:opacity-30 transition-colors shrink-0"
              title={t('prevSession')}
              aria-label={t('prevSession')}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex-1 min-w-0 overflow-hidden">
              {currentSnapshot ? (
                <>
                  <span className="text-xs font-medium text-foreground truncate block">
                    {currentSnapshot.description || t('session.untitled')}
                  </span>
                  {shownDoctorName && <span className="block truncate text-[11px] text-muted-foreground">{shownDoctorName}</span>}
                </>
              ) : (
                <span className="text-xs text-muted-foreground">{t('noSessions')}</span>
              )}
            </div>

            <button
              onClick={() => setHistoryIndex((i) => Math.min(history.length - 1, i + 1))}
              disabled={!canGoForward || isEditing}
              className="p-1 rounded hover:bg-muted disabled:opacity-30 transition-colors shrink-0"
              title={t('nextSession')}
              aria-label={t('nextSession')}
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            {attachmentsButton}

            {!isEditing && currentSnapshot && (
              <Button size="sm" variant="ghost" onClick={() => handleStartEditSession(currentSnapshot)} className="h-7 w-7 p-0 shrink-0" title={t('editSession')} aria-label={t('editSession')}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}

            {!isEditing && (
              <Button size="sm" onClick={() => handleStartNewSession()} disabled={blockNewSession} className="h-7 w-7 p-0 shrink-0" title={blockNewSession ? blockNewSessionMessage : t('newSession')} aria-label={t('newSession')}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            )}

            {patientId && !hideBillingWizard && (
              <Button
                size="icon"
                variant="outline"
                className="h-7 w-7 shrink-0"
                title={billingButtonLabel}
                aria-label={billingButtonLabel}
                onClick={() => openBillingWizard({ patientId, patientName, isSales: true })}
              >
                <Zap className="h-3.5 w-3.5 text-emerald-600" />
              </Button>
            )}

            <Button
              size="icon" variant="ghost"
              className="h-7 w-7 shrink-0"
              onClick={() => setIsFullscreen((f) => !f)}
              title={isFullscreen ? t('exitFullscreen') : t('fullscreen')}
              aria-label={isFullscreen ? t('exitFullscreen') : t('fullscreen')}
            >
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      ) : (
        /* Desktop: single row */
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            {currentSnapshot ? (
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="min-w-0 truncate text-sm font-semibold text-foreground" title={currentSnapshot.description || undefined}>
                  {currentSnapshot.description || t('session.untitled')}
                </span>
                <Badge variant="outline" className="text-xs shrink-0">
                  {formatLongSessionDate(currentSnapshot.date)}
                </Badge>
                {shownDoctorName && (
                  <span className="flex min-w-0 max-w-[40%] shrink items-center gap-1 text-xs text-muted-foreground" title={shownDoctorName}>
                    <User className="h-3 w-3 shrink-0" />
                    <span className="truncate">{shownDoctorName}</span>
                  </span>
                )}
                {isEditing && (
                  <Badge className="text-xs shrink-0 bg-primary">{t('editing')}</Badge>
                )}
              </div>
            ) : (
              <span className="text-sm text-muted-foreground whitespace-nowrap">{t('noSessions')}</span>
            )}
          </div>

          {/* Grouped: arrows + current/total counter */}
          <div className="flex items-center shrink-0">
            <button
              onClick={() => setHistoryIndex((i) => Math.max(0, i - 1))}
              disabled={!canGoBack || isEditing}
              className="p-1 rounded hover:bg-muted disabled:opacity-30 transition-colors"
              title={t('prevSession')}
              aria-label={t('prevSession')}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setHistoryIndex((i) => Math.min(history.length - 1, i + 1))}
              disabled={!canGoForward || isEditing}
              className="p-1 rounded hover:bg-muted disabled:opacity-30 transition-colors"
              title={t('nextSession')}
              aria-label={t('nextSession')}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            {history.length > 0 && (
              <span className="text-xs text-muted-foreground tabular-nums pl-1">
                {historyIndex + 1}/{history.length}
              </span>
            )}
          </div>

          {attachmentsButton}

          {!isEditing && currentSnapshot && (
            <Button size="sm" variant="outline" onClick={() => handleStartEditSession(currentSnapshot)} className="gap-1.5 text-xs shrink-0">
              <Pencil className="h-3.5 w-3.5" />
              {t('editSession')}
            </Button>
          )}

          {!isEditing && (
            <Button size="sm" onClick={() => handleStartNewSession()} disabled={blockNewSession} className="gap-1.5 text-xs shrink-0" title={blockNewSession ? blockNewSessionMessage : undefined}>
              <Plus className="h-3.5 w-3.5" />
              {t('newSession')}
            </Button>
          )}

          {patientId && !hideBillingWizard && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs shrink-0"
              onClick={() => openBillingWizard({ patientId, patientName, isSales: true })}
            >
              <Zap className="h-3.5 w-3.5 text-emerald-600" />
              {billingButtonLabel}
            </Button>
          )}

          <Button
            size="icon" variant="ghost"
            className="h-7 w-7 shrink-0"
            onClick={() => setIsFullscreen((f) => !f)}
            title={isFullscreen ? t('exitFullscreen') : t('fullscreen')}
            aria-label={isFullscreen ? t('exitFullscreen') : t('fullscreen')}
          >
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </Button>
        </div>
      ))}

      {/* ── Steps and Cancelar: in the sheet header when there is one ── */}
      {stepControls && portalTarget && createPortal(stepControls, portalTarget)}
      {stepControls && !portalTarget && step === 2 && <div className="flex justify-end">{stepControls}</div>}

      {/* ── Main chart area ── */}
      {history.length === 0 && !isEditing ? (
        <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
          <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
            <ClipboardList className="h-7 w-7 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold text-foreground">{t('noSessions')}</p>
            <p className="text-sm text-muted-foreground mt-1">{t('noSessionsDesc')}</p>
          </div>
          <Button onClick={() => handleStartNewSession()} disabled={blockNewSession} className="gap-2" title={blockNewSession ? blockNewSessionMessage : undefined}>
            <Stethoscope className="h-4 w-4" />
            {t('newSession')}
          </Button>
        </div>
      ) : isEditing ? (
        <>
          {/* Step 1: the odontogram fills the available height. The form stays mounted (hidden) so
              what was typed in it survives going back and forth */}
          <div className={cn('min-h-0 flex-1', step !== 1 && 'hidden')}>{workspace}</div>
          <div className={cn('grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,420px)]', step !== 2 && 'hidden')}>
            {sessionForm}
            <aside className="flex flex-col gap-2 rounded-2xl border bg-card p-4 lg:sticky lg:top-0">
              <div className="flex items-center gap-2">
                <h3 className="text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground">{t('steps.summaryTitle')}</h3>
                <Button size="sm" variant="ghost" className="ml-auto h-7 text-xs" onClick={() => setStep(1)}>{t('steps.edit')}</Button>
              </div>
              <OdontogramChart state={editingState} dentition={summaryDentition} variant="mini" />
              <p className="text-xs text-muted-foreground">{t('inspector.changesToday', { count: changesToday })}</p>
            </aside>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-4">
          {workspace}
          {sessionNotes}
        </div>
      )}

      {/* ── Confirmations ── */}
      <AlertDialog open={confirmAction !== null} onOpenChange={(open) => { if (!open) setConfirmAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('confirm.cancelTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('confirm.cancelDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('confirm.keepEditing')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} className="bg-destructive hover:bg-destructive/90">
              {t('confirm.cancelAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Image lightbox ── */}
      {lightbox && (
        <ImageLightbox
          open
          src={lightbox.src}
          alt={lightbox.alt}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
