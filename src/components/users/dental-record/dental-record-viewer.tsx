'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ImageLightbox } from '@/components/ui/image-viewer';
import { cn } from '@/lib/utils';
import type {
  OdontogramCondition,
  OdontogramSnapshot,
  OdontogramState,
  OdontogramSurface,
  OdontogramToothState,
  ToothPerioData,
} from '@/lib/types';
import { createOdontogram, fetchDoctors, fetchOdontograms } from '@/services/dental-record';
import type { DoctorOption } from '@/services/dental-record';
import { CONDITION_MAP } from './condition-toolbar';
import { ConditionToolbar } from './condition-toolbar';
import { ToothDetailPanel } from './tooth-detail-panel';
import { OdontogramCanvas } from './odontogram-canvas';
import { PeriodontogramView } from './periodontogram-view';
import { SessionForm } from './session-form';
import type { SessionFormValues } from './session-form';
import { useTranslations } from 'next-intl';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Eraser,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  // ExternalLink kept for non-image attachments
  Maximize,
  Minimize,
  Plus,
  Stethoscope,
  User,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

function formatDisplayDate(dateStr: string) {
  try {
    return format(parseISO(dateStr), "dd 'de' MMMM yyyy", { locale: es });
  } catch {
    return dateStr;
  }
}

function generateSessionLabel() {
  const now = new Date();
  const dateStr = format(now, 'dd/MM/yyyy HH:mm');
  return `Sesión Odontograma ${dateStr}`;
}

function cloneState(s: OdontogramState): OdontogramState {
  return JSON.parse(JSON.stringify(s));
}

const SURF_ABBR: Record<OdontogramSurface, string> = {
  top: 'V', center: 'O', bottom: 'L', left: 'M', right: 'D',
};

const SURFACES: OdontogramSurface[] = ['top', 'left', 'center', 'right', 'bottom'];

type StateEntry = { toothId: string; label: string; color: string; detail?: string };

/**
 * Builds a structured list of tooth+condition entries for display.
 * Same logic as the editing notes auto-generator.
 */
function buildStateEntries(
  state: OdontogramState,
  getCondLabel: (c: OdontogramCondition) => string,
): StateEntry[] {
  const entries: StateEntry[] = [];
  const sortedIds = Object.keys(state).sort((a, b) => Number(a) - Number(b));

  for (const toothId of sortedIds) {
    const ts = state[toothId];
    if (!ts) continue;

    if (ts.whole) {
      entries.push({
        toothId,
        label: getCondLabel(ts.whole),
        color: CONDITION_MAP[ts.whole]?.color ?? '#6b7280',
        detail: 'pieza',
      });
    }

    for (const surf of SURFACES) {
      if (ts[surf]) {
        entries.push({
          toothId,
          label: getCondLabel(ts[surf]!),
          color: CONDITION_MAP[ts[surf]!]?.color ?? '#6b7280',
          detail: SURF_ABBR[surf],
        });
      }
    }

    if (ts.overlays?.length) {
      for (const ov of ts.overlays) {
        entries.push({
          toothId,
          label: getCondLabel(ov),
          color: CONDITION_MAP[ov]?.color ?? '#6b7280',
          detail: 'overlay',
        });
      }
    }
  }

  return entries;
}

/** Also used to build auto-notes text (same data, flat string form) */
function buildStateLines(
  state: OdontogramState,
  getCondLabel: (c: OdontogramCondition) => string,
): string[] {
  return buildStateEntries(state, getCondLabel).map(({ toothId, label, detail }) =>
    detail ? `D${toothId}: ${label} (${detail})` : `D${toothId}: ${label}`,
  );
}

type Mode = 'odontogram' | 'periodontogram';

interface DentalRecordViewerProps {
  patientId: string;
  patientName?: string;
}

export function DentalRecordViewer({ patientId, patientName }: DentalRecordViewerProps) {
  const t = useTranslations('DentalRecord');
  const isMobile = useViewportNarrow(768);
  const { toast } = useToast();

  const [mode, setMode] = useState<Mode>('odontogram');
  const [history, setHistory] = useState<OdontogramSnapshot[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingState, setEditingState] = useState<OdontogramState>({});
  const [editingDefaultDescription, setEditingDefaultDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [perioData, setPerioData] = useState<ToothPerioData[]>([]);
  const [selectedToothId, setSelectedToothId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<OdontogramCondition | null>('caries');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([
      fetchOdontograms(patientId),
      fetchDoctors(),
    ]).then(([snapshots, docs]) => {
      setHistory(snapshots);
      setHistoryIndex(snapshots.length - 1);
      setDoctors(docs);
      setIsLoading(false);
    });
  }, [patientId]);

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

  // Resolve doctor name from snapshot (prefers stored name, falls back to local list)
  function resolveDoctorName(snapshot: OdontogramSnapshot): string | null {
    if (snapshot.doctorName) return snapshot.doctorName;
    if (snapshot.doctorId) {
      const doc = doctors.find((d) => d.id === snapshot.doctorId);
      if (doc) return doc.name;
    }
    return null;
  }

  // Condition label translator — used by buildStateLines
  function getCondLabel(c: OdontogramCondition): string {
    try { return t(`conditions.${c}`); } catch { return CONDITION_MAP[c]?.icon ?? c; }
  }

  function handleStartNewSession() {
    const base = currentSnapshot?.state ?? {};
    setEditingState(cloneState(base));
    setNotes('');
    setEditingDefaultDescription(generateSessionLabel());
    setIsEditing(true);
    setSelectedToothId(null);
  }

  function handleCancelEditing() {
    setIsEditing(false);
    setEditingState({});
    setNotes('');
    setEditingDefaultDescription('');
    setSelectedToothId(null);
  }

  const handleSave = useCallback(async (values: SessionFormValues) => {
    await createOdontogram(
      patientId,
      {
        date: values.date,
        description: values.description,
        state: editingState,
        notes: values.notes,
        doctorId: values.doctorId || undefined,
      },
      values.files,
    );

    if (typeof window !== 'undefined') {
      localStorage.setItem(`dental_perio_${patientId}`, JSON.stringify(perioData));
    }

    const updated = await fetchOdontograms(patientId);
    setHistory(updated);
    setHistoryIndex(updated.length - 1);
    setIsEditing(false);
    setEditingState({});
    setNotes('');
    setEditingDefaultDescription('');
    setSelectedToothId(null);
    toast({ title: t('session.saveSuccess'), description: values.description });
  }, [editingState, patientId, perioData, t, toast]);

  function handleApply(
    toothId: string,
    target: OdontogramSurface | 'whole' | 'overlay',
    condition: OdontogramCondition | null,
  ) {
    if (!isEditing) return;

    if (condition) {
      const currentTooth: OdontogramToothState = JSON.parse(
        JSON.stringify(editingState[toothId] ?? {}),
      );
      const condLabel = getCondLabel(condition);
      let entry = '';

      if (target === 'overlay') {
        const isRemoving = (currentTooth.overlays ?? []).includes(condition);
        entry = `D${toothId}: ${isRemoving ? '-' : '+'}${condLabel}`;
      } else if (target === 'whole') {
        entry = currentTooth.whole !== condition
          ? `D${toothId}: ${condLabel} (pieza completa)`
          : `D${toothId}: ${condLabel} eliminado`;
      } else {
        const surf = target as OdontogramSurface;
        entry = currentTooth[surf] !== condition
          ? `D${toothId}(${SURF_ABBR[surf]}): ${condLabel}`
          : `D${toothId}(${SURF_ABBR[surf]}): ${condLabel} eliminado`;
      }

      if (entry) setNotes((prev) => (prev ? `${prev}\n${entry}` : entry));
    }

    setEditingState((prev) => {
      const current: OdontogramToothState = prev[toothId]
        ? JSON.parse(JSON.stringify(prev[toothId])) : {};

      if (target === 'whole') {
        current.whole = current.whole === condition ? undefined : (condition ?? undefined);
      } else if (target === 'overlay') {
        if (!condition) return prev;
        const overlays = current.overlays ?? [];
        const idx = overlays.indexOf(condition);
        current.overlays = idx >= 0
          ? overlays.filter((o) => o !== condition)
          : [...overlays, condition];
      } else {
        const surf = target as OdontogramSurface;
        if (condition === null || current[surf] === condition) {
          current[surf] = undefined;
        } else {
          current[surf] = condition;
        }
      }

      return { ...prev, [toothId]: current };
    });
  }

  function handleClearTooth(toothId: string) {
    if (!isEditing) return;
    setNotes((prev) => (prev ? `${prev}\nD${toothId}: limpiado` : `D${toothId}: limpiado`));
    setEditingState((prev) => { const next = { ...prev }; delete next[toothId]; return next; });
  }

  function handleClearAll() {
    if (!isEditing) return;
    setEditingState({});
    setSelectedToothId(null);
  }

  function handleSelectTooth(id: string) {
    setSelectedToothId((prev) => (prev === id ? null : id));
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const toothState: OdontogramToothState = selectedToothId
    ? (displayState[selectedToothId] ?? {}) : {};

  const toothSize = isMobile ? 22 : 28;

  // ── Tooth detail + condition toolbar (editing area) ────────────────────────
  const editingArea = (isEditing || selectedToothId) ? (
    <div className={cn(
      'flex gap-3 rounded-xl border bg-muted/20 p-3',
      isMobile ? 'flex-col' : 'flex-row items-start',
    )}>
      <div className="flex flex-col items-center shrink-0">
        {selectedToothId ? (
          <ToothDetailPanel
            toothId={selectedToothId}
            state={toothState}
            activeTool={isEditing ? activeTool : null}
            readOnly={!isEditing}
            onApply={handleApply}
            onClearTooth={handleClearTooth}
            onClose={() => setSelectedToothId(null)}
          />
        ) : (
          isEditing && (
            <div className="flex items-center justify-center rounded-xl border border-dashed h-[170px] w-[170px] text-xs text-muted-foreground text-center p-4">
              {t('selectToothHint')}
            </div>
          )
        )}
      </div>

      {isEditing && (
        <div className="flex-1 min-w-0">
          <ConditionToolbar active={activeTool} onSelect={(c) => setActiveTool(c)} />
        </div>
      )}
    </div>
  ) : null;

  // ── Session detail panel (read mode) ──────────────────────────────────────
  const sessionReadPanel = !isEditing && currentSnapshot ? (() => {
    const doctorName = resolveDoctorName(currentSnapshot);
    const stateEntries = buildStateEntries(currentSnapshot.state, getCondLabel);
    const hasContent = !!currentSnapshot.notes || stateEntries.length > 0 || !!doctorName
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
              {formatDisplayDate(currentSnapshot.date)}
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
        {stateEntries.length > 0 && (
          <div className="bg-background rounded-lg border px-2.5 py-2 flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              {t('session.stateSummary')}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {stateEntries.map((entry, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs bg-muted/30"
                  style={{ borderColor: `${entry.color}40` }}
                >
                  {/* Tooth badge */}
                  <span
                    className="font-bold text-[10px] rounded px-1 py-0.5 text-white shrink-0"
                    style={{ backgroundColor: entry.color }}
                  >
                    D{entry.toothId}
                  </span>
                  {/* Condition label */}
                  <span className="text-foreground font-medium">{entry.label}</span>
                  {/* Surface/detail badge */}
                  {entry.detail && (
                    <span className="text-[10px] text-muted-foreground bg-muted rounded px-1">
                      {entry.detail}
                    </span>
                  )}
                </div>
              ))}
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
                const label = att.diente_asociado ? `Diente ${att.diente_asociado}` : t('session.attachment');
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

  return (
    <div
      className={cn(
        'flex flex-col gap-3',
        isFullscreen ? 'fixed inset-0 z-50 bg-background p-4 overflow-auto' : 'h-full',
      )}
    >
      {/* ── Nav ── */}
      {isMobile ? (
        /* Mobile: two rows */
        <div className="flex flex-col gap-2">
          {/* Row 1 — mode toggle (full width on mobile) */}
          <div className="flex rounded-md border overflow-hidden text-xs">
            <button
              onClick={() => setMode('odontogram')}
              className={cn(
                'flex-1 py-2 px-2.5 font-medium transition-colors',
                mode === 'odontogram'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:bg-muted',
              )}
            >
              {t('tab.odontogram')}
            </button>
            <button
              disabled
              className="flex-1 py-2 px-2.5 font-medium transition-colors bg-background text-muted-foreground/40 cursor-not-allowed"
              title={t('tab.periodontogramSoon')}
            >
              {t('tab.periodontogram')}
            </button>
          </div>

          {/* Row 2 — navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setHistoryIndex((i) => Math.max(0, i - 1))}
              disabled={!canGoBack || isEditing}
              className="p-1 rounded hover:bg-muted disabled:opacity-30 transition-colors shrink-0"
              title={t('prevSession')}
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
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            {!isEditing && (
              <Button size="sm" onClick={handleStartNewSession} className="h-7 w-7 p-0 shrink-0" title={t('newSession')}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            )}

            <Button
              size="icon" variant="ghost"
              className="h-7 w-7 shrink-0"
              onClick={() => setIsFullscreen((f) => !f)}
              title={isFullscreen ? t('exitFullscreen') : t('fullscreen')}
            >
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      ) : (
        /* Desktop: single row */
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-md border overflow-hidden text-xs shrink-0">
            <button
              onClick={() => setMode('odontogram')}
              className={cn(
                'py-1.5 px-2.5 font-medium transition-colors whitespace-nowrap',
                mode === 'odontogram'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:bg-muted',
              )}
            >
              {t('tab.odontogram')}
            </button>
            <button
              disabled
              className="py-1.5 px-2.5 font-medium whitespace-nowrap bg-background text-muted-foreground/40 cursor-not-allowed"
              title={t('tab.periodontogramSoon')}
            >
              {t('tab.periodontogram')}
            </button>
          </div>

          <button
            onClick={() => setHistoryIndex((i) => Math.max(0, i - 1))}
            disabled={!canGoBack || isEditing}
            className="p-1 rounded hover:bg-muted disabled:opacity-30 transition-colors shrink-0"
            title={t('prevSession')}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="flex-1 min-w-0">
            {currentSnapshot ? (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-sm font-semibold text-foreground truncate max-w-[200px]">
                  {currentSnapshot.description || t('session.untitled')}
                </span>
                <Badge variant="outline" className="text-xs shrink-0">
                  {formatDisplayDate(currentSnapshot.date)}
                </Badge>
                {isEditing && (
                  <Badge className="text-xs shrink-0 bg-primary">{t('editing')}</Badge>
                )}
              </div>
            ) : (
              <span className="text-sm text-muted-foreground whitespace-nowrap">{t('noSessions')}</span>
            )}
          </div>

          <button
            onClick={() => setHistoryIndex((i) => Math.min(history.length - 1, i + 1))}
            disabled={!canGoForward || isEditing}
            className="p-1 rounded hover:bg-muted disabled:opacity-30 transition-colors shrink-0"
            title={t('nextSession')}
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          {history.length > 0 && (
            <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
              {historyIndex + 1}/{history.length}
            </span>
          )}

          {!isEditing && (
            <Button size="sm" onClick={handleStartNewSession} className="gap-1.5 text-xs shrink-0">
              <Plus className="h-3.5 w-3.5" />
              {t('newSession')}
            </Button>
          )}

          <Button
            size="icon" variant="ghost"
            className="h-7 w-7 shrink-0"
            onClick={() => setIsFullscreen((f) => !f)}
            title={isFullscreen ? t('exitFullscreen') : t('fullscreen')}
          >
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </Button>
        </div>
      )}

      {/* ── Editing action buttons ── */}
      {isEditing && (
        <div className="flex items-center gap-2">
          <Button
            size="sm" variant="ghost"
            onClick={handleClearAll}
            className="gap-1.5 text-xs text-muted-foreground"
          >
            <Eraser className="h-3.5 w-3.5" />
            {t('clearAll')}
          </Button>
          <Button size="sm" variant="outline" onClick={handleCancelEditing} className="text-xs">
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
          <Button onClick={handleStartNewSession} className="gap-2">
            <Stethoscope className="h-4 w-4" />
            {t('newSession')}
          </Button>
        </div>
      ) : mode === 'periodontogram' ? (
        <div className="flex flex-col gap-3">
          {sessionReadPanel}
          <div className="rounded-xl border bg-muted/20 p-3 opacity-80">
            <OdontogramCanvas
              state={displayState}
              selectedToothId={null}
              onSelectTooth={() => {}}
              readOnly
              half="full"
              toothSize={toothSize}
            />
          </div>
          <div className={cn(!isEditing && 'pointer-events-none opacity-60')}>
            <PeriodontogramView teeth={perioData} onTeethChange={setPerioData} />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sessionReadPanel}

          <div className="rounded-xl border bg-muted/20 p-2 sm:p-3 overflow-x-auto">
            <OdontogramCanvas
              state={displayState}
              selectedToothId={selectedToothId}
              onSelectTooth={handleSelectTooth}
              readOnly={!isEditing}
              half="full"
              toothSize={toothSize}
            />
          </div>

          {editingArea}

          {!isEditing && selectedToothId && (
            <div className="flex justify-center">
              <ToothDetailPanel
                toothId={selectedToothId}
                state={toothState}
                activeTool={null}
                readOnly
                onApply={() => {}}
                onClearTooth={() => {}}
                onClose={() => setSelectedToothId(null)}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Session form (editing only) ── */}
      {isEditing && (
        <SessionForm
          defaultDate={new Date().toISOString().split('T')[0]}
          defaultDescription={editingDefaultDescription}
          doctors={doctors}
          notes={notes}
          onNotesChange={setNotes}
          onSave={handleSave}
          onCancel={handleCancelEditing}
        />
      )}

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
