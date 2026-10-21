'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ImageLightbox } from '@/components/ui/image-viewer';
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
import { cn } from '@/lib/utils';
import type {
  OdontogramCondition,
  OdontogramMarcacion,
  OdontogramProcedure,
  OdontogramSnapshot,
  OdontogramState,
  OdontogramSurface,
  ToothPerioData,
} from '@/lib/types';
import { upsertOdontogram, fetchDoctors, fetchOdontograms } from '@/services/dental-record';
import { ensureDoctorOption } from '@/services/doctors';
import { api } from '@/services/api';
import { API_ROUTES } from '@/constants/routes';
import type { DoctorOption } from '@/services/dental-record';
import { getProcedure, getProcedureColor, getToothKind, isTemporalTooth, SURFACE_ABBR } from './odontogram-catalog';
import {
  applyMarcaciones,
  clearTooth,
  cloneState,
  listOdontogramEntries,
  setToothNotes,
  toggleSurface,
  toggleToothProcedure,
} from './odontogram-state';
import { OdontogramBoard } from './odontogram-board';
import { ProcedurePalette } from './procedure-palette';
import { ToothDetailCard } from './tooth-detail-card';
import { PeriodontogramView } from './periodontogram-view';
import { SessionForm } from './session-form';
import type { SessionFormValues } from './session-form';
import { useTranslations } from 'next-intl';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { usePanelWidth } from '@/hooks/use-panel-width';
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Eraser,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Maximize,
  Minimize,
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

/** Undo stack entries keep the auto-generated notes in sync with the chart */
type EditSnapshot = { state: OdontogramState; notes: string };

const MAX_UNDO_STEPS = 50;
/** Container width from which the palette moves to a sticky right column (fixed width, so it never gets squeezed) */
const SIDEBAR_LAYOUT_MIN_WIDTH = 900;

type StateEntry = { toothId: string; label: string; color: string; detail?: string };
type ToothSummary = { toothId: string; entries: StateEntry[]; notes?: string };

type Mode = 'odontogram' | 'periodontogram';

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
  /** When true, prevents creating new sessions (one already exists today for this patient) */
  blockNewSession?: boolean;
  blockNewSessionMessage?: string;
  appointmentId?: string;
  /** When true, auto-enters edit mode for the snapshot matching appointmentId after load */
  autoNavigateToAppointmentSession?: boolean;
  /** When true, hides the Cobro Rápido button (e.g. in doctor workspace) */
  hideBillingWizard?: boolean;
}

export function DentalRecordViewer({ patientId, patientName, doctorId, doctorName, autoStartKey, onAutoStartHandled, autoStartDescription, autoStartNotes, autoStartNextSessionPlan, autoStartMarcaciones, onSessionSaved, createMode, onCancelCreate, blockNewSession, blockNewSessionMessage, appointmentId, autoNavigateToAppointmentSession, hideBillingWizard = false }: DentalRecordViewerProps) {
  const t = useTranslations('DentalRecord');
  const isMobile = useViewportNarrow(768);
  const { toast } = useToast();
  const { open: openBillingWizard } = useBillingWizard();

  // The root element changes once loading finishes, so the measured ref follows it
  const [rootEl, setRootEl] = useState<HTMLDivElement | null>(null);
  const rootRef = useMemo(() => ({ current: rootEl }), [rootEl]);
  const containerWidth = usePanelWidth(rootRef);
  const useSidebarLayout = containerWidth >= SIDEBAR_LAYOUT_MIN_WIDTH;

  const [mode] = useState<Mode>('odontogram');
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
  const [undoStack, setUndoStack] = useState<EditSnapshot[]>([]);
  const [perioData, setPerioData] = useState<ToothPerioData[]>([]);
  const [selectedToothId, setSelectedToothId] = useState<string | null>(null);
  const [activeProcedure, setActiveProcedure] = useState<OdontogramProcedure | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
  const [confirmAction, setConfirmAction] = useState<'cancel' | 'clearAll' | null>(null);

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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem(`dental_perio_${patientId}`);
    if (saved) {
      try { setPerioData(JSON.parse(saved)); } catch { /* ignore */ }
    }
  }, [patientId]);

  const currentSnapshot = historyIndex >= 0 && historyIndex < history.length
    ? history[historyIndex] : null;

  const isAtLatest = historyIndex === history.length - 1;
  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < history.length - 1;

  const displayState: OdontogramState = isEditing ? editingState : (currentSnapshot?.state ?? {});
  const hasUnsavedChanges = undoStack.length > 0 || notes !== initialNotes;

  // Resolve doctor name from snapshot (prefers stored name, falls back to local list)
  function resolveDoctorName(snapshot: OdontogramSnapshot): string | null {
    if (snapshot.doctorName) return snapshot.doctorName;
    if (snapshot.doctorId) {
      const doc = doctors.find((d) => d.id === snapshot.doctorId);
      if (doc) return doc.name;
    }
    return null;
  }

  // Condition label translator (unknown ids, e.g. from an AI prefill, are shown raw)
  const getCondLabel = useCallback(
    (c: OdontogramCondition | string): string => (getProcedure(c) ? t(`procedures.${c}.label`) : c),
    [t],
  );

  /** One row per tooth (in FDI order) with its conditions and notes, for the read-mode summary */
  function buildToothSummaries(state: OdontogramState): ToothSummary[] {
    const byTooth = new Map<string, StateEntry[]>();
    for (const entry of buildStateEntries(state)) {
      byTooth.set(entry.toothId, [...(byTooth.get(entry.toothId) ?? []), entry]);
    }
    return Object.keys(state)
      .sort((a, b) => Number(a) - Number(b))
      .map((toothId) => ({ toothId, entries: byTooth.get(toothId) ?? [], notes: state[toothId]?.notes?.trim() }))
      .filter((summary) => summary.entries.length > 0 || !!summary.notes);
  }

  function buildStateEntries(state: OdontogramState): StateEntry[] {
    return listOdontogramEntries(state).map(({ toothId, condition, surface }) => ({
      toothId,
      label: getCondLabel(condition),
      color: getProcedureColor(condition),
      detail: surface ? SURFACE_ABBR[surface] : t('session.wholeToothShort'),
    }));
  }

  function resetEditingSession(initialState: OdontogramState, initialNotesValue: string, initialPlan = '') {
    setEditingState(initialState);
    setNotes(initialNotesValue);
    setInitialNotes(initialNotesValue);
    setNextSessionPlan(initialPlan);
    setUndoStack([]);
    setActiveProcedure(null);
    setIsEditing(true);
    setSelectedToothId(null);
    if (isMobile) setIsFullscreen(true);
  }

  function handleStartNewSession(description?: string, notes?: string, marcaciones?: OdontogramMarcacion[], plan?: string) {
    const base = currentSnapshot?.state ?? {};
    const initialState = marcaciones?.length
      ? applyMarcaciones(base, marcaciones)
      : cloneState(base);
    setEditingDefaultDescription(description || t('session.defaultTitle', { date: format(new Date(), 'dd/MM/yyyy HH:mm') }));
    resetEditingSession(initialState, notes ?? '', plan ?? '');
  }

  function handleStartEditSession(snapshot: OdontogramSnapshot) {
    setEditingSessionId(snapshot.id ?? null);
    setEditingSnapshot(snapshot);
    setEditingDefaultDescription(snapshot.description || t('session.defaultTitle', { date: format(new Date(), 'dd/MM/yyyy HH:mm') }));
    resetEditingSession(cloneState(snapshot.state), snapshot.notes ?? '', snapshot.planProximaCita ?? '');
  }

  function appendNotes(current: string, extra?: string): string {
    const text = extra?.trim();
    if (!text || current.includes(text)) return current;
    return current.trim() ? `${current}\n${text}` : text;
  }

  /**
   * Applies the agent's prefill without discarding work: merges into the session being edited,
   * otherwise opens this appointment's odontogram session for editing, otherwise starts a new one.
   */
  function applyAgentPrefill(): OdontogramPrefillResult {
    const marcaciones = autoStartMarcaciones ?? [];

    if (isEditing) {
      const nextNotes = appendNotes(notes, autoStartNotes);
      if (marcaciones.length > 0) commitEdit(applyMarcaciones(editingState, marcaciones));
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
      setEditingState(applyMarcaciones(appointmentSnapshot.state, marcaciones));
      setNotes(appendNotes(appointmentSnapshot.notes ?? '', autoStartNotes));
      setNextSessionPlan(appendNotes(appointmentSnapshot.planProximaCita ?? '', autoStartNextSessionPlan));
      // The agent's marks can be undone back to the saved session
      setUndoStack([{ state: cloneState(appointmentSnapshot.state), notes: appointmentSnapshot.notes ?? '' }]);
      return { applied: true };
    }

    if (blockNewSession) return { applied: false };

    handleStartNewSession(autoStartDescription, autoStartNotes, marcaciones, autoStartNextSessionPlan);
    if (marcaciones.length > 0) {
      setUndoStack([{ state: cloneState(currentSnapshot?.state ?? {}), notes: autoStartNotes ?? '' }]);
    }
    return { applied: true };
  }

  function clearEditingSession() {
    setIsEditing(false);
    setIsFullscreen(false);
    setEditingState({});
    setEditingSessionId(null);
    setEditingSnapshot(null);
    setNotes('');
    setInitialNotes('');
    setNextSessionPlan('');
    setUndoStack([]);
    setActiveProcedure(null);
    setEditingDefaultDescription('');
    setSelectedToothId(null);
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

    if (typeof window !== 'undefined') {
      localStorage.setItem(`dental_perio_${patientId}`, JSON.stringify(perioData));
    }

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
  }, [appointmentId, editingSessionId, editingSnapshot, editingState, onSessionSaved, patientId, perioData, t, toast]);

  // Every chart edit records the previous state (and notes) so it can be undone
  function commitEdit(nextState: OdontogramState, noteEntry?: string) {
    setUndoStack((prev) => [...prev.slice(-(MAX_UNDO_STEPS - 1)), { state: editingState, notes }]);
    setEditingState(nextState);
    if (noteEntry) setNotes((prev) => (prev ? `${prev}\n${noteEntry}` : noteEntry));
  }

  function handleSurfaceApply(toothId: string, surface: OdontogramSurface, procedure?: OdontogramCondition) {
    const procedureId = procedure ?? activeProcedure?.id;
    if (!isEditing || !procedureId) return;
    const { state, removed } = toggleSurface(editingState, toothId, surface, procedureId);
    const params = { tooth: toothId, surface: SURFACE_ABBR[surface], label: getCondLabel(procedureId) };
    commitEdit(state, removed ? t('autoNote.surfaceRemoved', params) : t('autoNote.surfaceAdded', params));
  }

  function handleToothApply(toothId: string, procedure: OdontogramCondition) {
    if (!isEditing) return;
    const { state, removed } = toggleToothProcedure(editingState, toothId, procedure);
    const params = { tooth: toothId, label: getCondLabel(procedure) };
    commitEdit(state, removed ? t('autoNote.toothRemoved', params) : t('autoNote.toothAdded', params));
  }

  function handleClearTooth(toothId: string) {
    if (!isEditing) return;
    commitEdit(clearTooth(editingState, toothId), t('autoNote.cleared', { tooth: toothId }));
  }

  function handleToothNotesChange(toothId: string, toothNotes: string) {
    if (!isEditing) return;
    setEditingState((prev) => setToothNotes(prev, toothId, toothNotes));
  }

  function handleClearAll() {
    if (!isEditing) return;
    commitEdit({});
    setSelectedToothId(null);
    setActiveProcedure(null);
  }

  function handleUndo() {
    const previous = undoStack[undoStack.length - 1];
    if (!previous) return;
    setUndoStack((prev) => prev.slice(0, -1));
    setEditingState(previous.state);
    setNotes(previous.notes);
  }

  function handleConfirm() {
    if (confirmAction === 'cancel') handleCancelEditing();
    if (confirmAction === 'clearAll') handleClearAll();
    setConfirmAction(null);
  }

  const handleSelectTooth = useCallback((id: string | null) => {
    setSelectedToothId(id);
  }, []);

  const handleDeactivateTool = useCallback(() => setActiveProcedure(null), []);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div ref={setRootEl} className="flex items-center justify-center h-40">
        <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const selectedTooth = selectedToothId ? displayState[selectedToothId] : undefined;

  // ── Session detail panel (read mode) ──────────────────────────────────────
  const sessionReadPanel = !isEditing && currentSnapshot ? (() => {
    const doctorName = resolveDoctorName(currentSnapshot);
    const toothSummaries = buildToothSummaries(currentSnapshot.state);
    const hasContent = !!currentSnapshot.notes || toothSummaries.length > 0 || !!doctorName
      || (currentSnapshot.archivosAdjuntos?.length ?? 0) > 0;

    if (!hasContent) return null;

    return (
      <div className="rounded-xl border bg-muted/20 p-3 flex flex-col gap-2">
        {/* Header row: title + date + badge */}
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-sm font-semibold text-foreground leading-snug truncate max-w-xs">
              {currentSnapshot.description || t('session.untitled')}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatLongSessionDate(currentSnapshot.date)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {!isAtLatest && (
              <Badge variant="secondary" className="text-xs">{t('readOnly')}</Badge>
            )}
            <span className="text-xs text-muted-foreground tabular-nums">
              {historyIndex + 1} / {history.length}
            </span>
          </div>
        </div>

        {/* Doctor */}
        {doctorName && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <User className="h-3 w-3 shrink-0" />
            <span>{doctorName}</span>
          </div>
        )}

        {/* Odontogram state summary */}
        {toothSummaries.length > 0 && (
          <div className="bg-background rounded-lg border px-2.5 py-2 flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              {t('session.stateSummary')}
            </span>
            <div className="flex flex-col divide-y divide-border/60">
              {toothSummaries.map(({ toothId, entries, notes }) => {
                const toothNumber = Number(toothId);
                const kind = getToothKind(toothNumber);
                return (
                  <div key={toothId} className="flex items-start gap-3 py-2 first:pt-1 last:pb-0.5">
                    <div className="flex w-24 shrink-0 flex-col">
                      <span
                        className={cn(
                          'font-mono text-xs font-bold',
                          isTemporalTooth(toothNumber) ? 'text-amber-600 dark:text-amber-400' : 'text-foreground',
                        )}
                      >
                        {t('board.piece', { tooth: toothNumber })}
                      </span>
                      {kind && (
                        <span className="text-[10px] leading-tight text-muted-foreground">{t(`toothNames.${kind}`)}</span>
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      {entries.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {entries.map((entry, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs bg-muted/30"
                              style={{ borderColor: `${entry.color}40` }}
                            >
                              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
                              <span className="text-foreground font-medium">{entry.label}</span>
                              {entry.detail && (
                                <span className="text-[10px] text-muted-foreground bg-muted rounded px-1">
                                  {entry.detail}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {notes && (
                        <p className="whitespace-pre-wrap text-[11px] italic leading-relaxed text-muted-foreground">{notes}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Clinical notes */}
        {currentSnapshot.notes && (
          <div className="bg-background rounded-lg border overflow-hidden">
            <div className="bg-muted/50 px-2.5 py-1.5 border-b">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                {t('session.notes')}
              </span>
            </div>
            <p className="text-xs text-foreground px-2.5 py-2 whitespace-pre-wrap leading-relaxed">
              {currentSnapshot.notes}
            </p>
          </div>
        )}

        {/* Attachments */}
        {currentSnapshot.archivosAdjuntos && currentSnapshot.archivosAdjuntos.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              {t('session.files')}
            </span>
            <div className="flex flex-wrap gap-2">
              {currentSnapshot.archivosAdjuntos.map((att, i) => {
                const isImage = att.tipo?.startsWith('image/');
                const label = att.diente_asociado
                  ? t('board.toothLabel', { tooth: att.diente_asociado })
                  : t('session.attachment');
                if (isImage) {
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setLightbox({ src: att.ruta, alt: label })}
                      className="flex items-center gap-1.5 text-xs text-primary bg-primary/5 hover:bg-primary/10 border border-primary/20 rounded-md px-2 py-1 transition-colors"
                    >
                      <ImageIcon className="h-3 w-3 shrink-0" />
                      {label}
                    </button>
                  );
                }
                return (
                  <a
                    key={i}
                    href={att.ruta}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-primary bg-primary/5 hover:bg-primary/10 border border-primary/20 rounded-md px-2 py-1 transition-colors"
                  >
                    <FileText className="h-3 w-3 shrink-0" />
                    {label}
                    <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-60" />
                  </a>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  })() : null;

  const board = (
    <OdontogramBoard
      state={displayState}
      selectedToothId={selectedToothId}
      onSelectTooth={handleSelectTooth}
      activeProcedure={isEditing ? activeProcedure : null}
      onSurfaceApply={handleSurfaceApply}
      onToothApply={handleToothApply}
      onDeactivateTool={handleDeactivateTool}
      readOnly={!isEditing}
    />
  );

  const toothCard = (isEditing || selectedToothId) && (
    <ToothDetailCard
      toothId={selectedToothId}
      tooth={selectedTooth}
      readOnly={!isEditing}
      canUndo={undoStack.length > 0}
      onUndo={handleUndo}
      onClearTooth={handleClearTooth}
      onToggleToothProcedure={handleToothApply}
      onToggleSurface={handleSurfaceApply}
      onNotesChange={handleToothNotesChange}
    />
  );

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
      onCancel={requestCancelEditing}
      lockDoctorId={doctorId ?? editingSnapshot?.doctorId}
      lockDoctorName={doctorName || (editingSnapshot ? resolveDoctorName(editingSnapshot) ?? undefined : undefined)}
      isEdit={!!editingSessionId}
    />
  );

  const billingButtonLabel = t('quickBilling');

  return (
    <div
      ref={setRootEl}
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
                <span className="text-xs font-medium text-foreground truncate block">
                  {currentSnapshot.description || t('session.untitled')}
                </span>
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
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex-1 min-w-0">
            {currentSnapshot ? (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-sm font-semibold text-foreground truncate max-w-[200px]">
                  {currentSnapshot.description || t('session.untitled')}
                </span>
                <Badge variant="outline" className="text-xs shrink-0">
                  {formatLongSessionDate(currentSnapshot.date)}
                </Badge>
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

      {/* ── Editing action buttons ── */}
      {isEditing && (
        <div className="flex items-center gap-2">
          <Button
            size="sm" variant="ghost"
            onClick={() => setConfirmAction('clearAll')}
            disabled={Object.keys(editingState).length === 0}
            className="gap-1.5 text-xs text-muted-foreground"
          >
            <Eraser className="h-3.5 w-3.5" />
            {t('clearAll')}
          </Button>
          <Button size="sm" variant="outline" onClick={requestCancelEditing} className="text-xs">
            {t('session.cancel')}
          </Button>
        </div>
      )}

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
      ) : mode === 'periodontogram' ? (
        <div className="flex flex-col gap-3">
          {sessionReadPanel}
          <div className="opacity-80">
            <OdontogramBoard state={displayState} selectedToothId={null} onSelectTooth={() => {}} readOnly />
          </div>
          <div className={cn(!isEditing && 'pointer-events-none opacity-60')}>
            <PeriodontogramView teeth={perioData} onTeethChange={setPerioData} />
          </div>
        </div>
      ) : isEditing && useSidebarLayout ? (
        /* ── Wide container: chart + tooth card + form, palette as a sticky right column ── */
        <div className="grid grid-cols-[minmax(0,1fr)_280px] items-start gap-4">
          <div className="flex min-w-0 flex-col gap-4">
            {board}
            {toothCard}
            {sessionForm}
          </div>
          <div className="sticky top-4">
            <ProcedurePalette activeProcedure={activeProcedure} onSelectProcedure={setActiveProcedure} variant="sidebar" />
          </div>
        </div>
      ) : (
        /* ── Narrow container or read mode: everything stacked ── */
        <div className="flex flex-col gap-4">
          {!isEditing && sessionReadPanel}
          {board}
          {isEditing && (
            <ProcedurePalette activeProcedure={activeProcedure} onSelectProcedure={setActiveProcedure} variant="stacked" />
          )}
          {toothCard}
          {sessionForm}
        </div>
      )}

      {/* ── Confirmations ── */}
      <AlertDialog open={confirmAction !== null} onOpenChange={(open) => { if (!open) setConfirmAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === 'clearAll' ? t('confirm.clearAllTitle') : t('confirm.cancelTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === 'clearAll' ? t('confirm.clearAllDescription') : t('confirm.cancelDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('confirm.keepEditing')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} className="bg-destructive hover:bg-destructive/90">
              {confirmAction === 'clearAll' ? t('confirm.clearAllAction') : t('confirm.cancelAction')}
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
