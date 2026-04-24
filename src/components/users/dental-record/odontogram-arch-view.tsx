'use client';

import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { ToothConditionGroup, ToothDetail } from 'react-odontogram';
import { cn } from '@/lib/utils';
import type { OdontogramCondition, OdontogramState, OdontogramSurface } from '@/lib/types';
import { CONDITION_MAP } from './condition-toolbar';
import { ChevronDown, ListFilter } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';

const Odontogram = dynamic(
  () => import('react-odontogram').then((mod) => mod.Odontogram),
  {
    ssr: false,
    loading: () => (
      <div className="w-full animate-pulse bg-muted/30 rounded-xl" style={{ minHeight: 260 }} />
    ),
  },
);

const SURFACES: OdontogramSurface[] = ['top', 'left', 'center', 'right', 'bottom'];

// Dental surface abbreviations (universal)
const SURF_ABBR: Record<OdontogramSurface, string> = {
  center: 'O',  // Oclusal
  top:    'V',  // Vestibular
  bottom: 'L',  // Lingual
  left:   'M',  // Mesial
  right:  'D',  // Distal
};

type ToothWithSurfs = { id: string; surfs: string[] };

type PanelEntry = {
  condId: OdontogramCondition;
  label: string;
  icon: string;
  color: string;
  border: string;
  teeth: string[];          // raw IDs for teethConditions prop
  toothDetails: ToothWithSurfs[];  // IDs + surfaces for display
};

function buildPanelEntries(
  state: OdontogramState,
  getLabel: (c: OdontogramCondition) => string,
): PanelEntry[] {
  // condId → Map<toothId, string[]> (surface labels)
  const condMap = new Map<OdontogramCondition, Map<string, string[]>>();

  const addToMap = (cond: OdontogramCondition, toothId: string, surfLabel: string) => {
    if (!condMap.has(cond)) condMap.set(cond, new Map());
    const toothMap = condMap.get(cond)!;
    const surfs = toothMap.get(toothId) ?? [];
    if (!surfs.includes(surfLabel)) surfs.push(surfLabel);
    toothMap.set(toothId, surfs);
  };

  for (const [toothId, ts] of Object.entries(state)) {
    if (!ts) continue;
    if (ts.whole) addToMap(ts.whole, toothId, 'pieza');
    for (const surf of SURFACES) {
      if (ts[surf]) addToMap(ts[surf]!, toothId, SURF_ABBR[surf]);
    }
    if (ts.overlays) {
      for (const ov of ts.overlays) addToMap(ov, toothId, 'sup.');
    }
  }

  return Array.from(condMap.entries()).map(([condId, toothMap]) => {
    const sorted = Array.from(toothMap.entries())
      .sort((a, b) => Number(a[0]) - Number(b[0]));
    return {
      condId,
      label: getLabel(condId),
      icon: CONDITION_MAP[condId]?.icon ?? condId,
      color: CONDITION_MAP[condId]?.color ?? '#6b7280',
      border: CONDITION_MAP[condId]?.border ?? '#4b5563',
      teeth: sorted.map(([id]) => id),
      toothDetails: sorted.map(([id, surfs]) => ({ id, surfs })),
    };
  });
}

function buildToothSummary(panelEntries: PanelEntry[]): Record<string, string[]> {
  const summary: Record<string, string[]> = {};
  for (const e of panelEntries) {
    for (const { id, surfs } of e.toothDetails) {
      const suffix = surfs.length > 0 ? ` (${surfs.join(', ')})` : '';
      summary[id] = [...(summary[id] ?? []), `${e.label}${suffix}`];
    }
  }
  return summary;
}

interface OdontogramArchViewProps {
  state: OdontogramState;
  selectedToothId?: string | null;
  onSelectTooth: (id: string) => void;
  className?: string;
}

export function OdontogramArchView({
  state,
  selectedToothId,
  onSelectTooth,
  className,
}: OdontogramArchViewProps) {
  const t = useTranslations('DentalRecord');
  const isMobile = useViewportNarrow(768);
  const [panelOpen, setPanelOpen] = useState(false);

  const getLabel = useMemo(
    () => (c: OdontogramCondition) => {
      try { return t(`conditions.${c}`); } catch { return CONDITION_MAP[c]?.icon ?? c; }
    },
    [t],
  );

  const panelEntries = useMemo(() => buildPanelEntries(state, getLabel), [state, getLabel]);
  const toothSummary = useMemo(() => buildToothSummary(panelEntries), [panelEntries]);

  const teethConditions: ToothConditionGroup[] = useMemo(
    () => panelEntries.map((e) => ({
      label: e.label,
      teeth: e.teeth.map((id) => `teeth-${id}`),
      fillColor: e.color,
      outlineColor: e.border,
    })),
    [panelEntries],
  );

  // react-odontogram fires onChange on every re-render with the internally-held
  // selection, not only on user clicks. We track the "last tooth we deliberately
  // selected" so we can ignore the re-render echo that would otherwise toggle the
  // shared selectedToothId back to null.
  const lastSelectedRef = useRef<string | null>(null);

  // Keep the ref in sync when the parent clears the selection from outside
  // (e.g. the close button in ToothDetailPanel).
  useEffect(() => {
    if (!selectedToothId) lastSelectedRef.current = null;
  }, [selectedToothId]);

  const handleChange = useCallback((selected: ToothDetail[]) => {
    const fdi = selected[0]?.notations?.fdi;
    if (!fdi) return;

    // Suppress the re-render echo: react-odontogram re-fires onChange with the
    // same tooth when it re-renders after teethConditions changes. Ignore it if
    // this tooth is already the active selection.
    if (fdi === lastSelectedRef.current) return;

    lastSelectedRef.current = fdi;
    // Defer to avoid setState-in-render if onChange fires during render cycle.
    setTimeout(() => {
      console.log('[OdontogramArchView] tooth click → fdi:', fdi);
      onSelectTooth(fdi);
    }, 0);
  }, [onSelectTooth]);

  return (
    <div className={cn('relative w-full', className)}>
      {/* Floating conditions panel */}
      {panelEntries.length > 0 && (
        <div className="absolute top-2 right-2 z-20">
          <button
            onClick={() => setPanelOpen((o) => !o)}
            className="flex items-center gap-1.5 rounded-lg border bg-background/80 backdrop-blur-sm px-2.5 py-1.5 text-xs font-medium shadow-sm hover:bg-muted/70 transition-colors"
          >
            <ListFilter className="h-3.5 w-3.5" />
            {t('conditionsPanel')}
            <ChevronDown
              className={cn('h-3 w-3 transition-transform duration-150', panelOpen && 'rotate-180')}
            />
          </button>

          {panelOpen && (
            <div
              className={cn(
                'absolute top-full right-0 mt-1 w-80 max-h-60 overflow-y-auto rounded-xl border shadow-xl p-3 z-30',
                // Mobile: transparent/glassy; Desktop: nearly opaque
                isMobile
                  ? 'bg-background/40 backdrop-blur-md'
                  : 'bg-background/95 backdrop-blur-sm',
              )}
            >
              <div className="flex flex-col gap-1.5">
                {panelEntries.map((e) => (
                  <div key={e.condId} className="flex items-start gap-2">
                    <span
                      className="mt-0.5 h-3.5 w-3.5 rounded-sm shrink-0"
                      style={{ backgroundColor: e.color, border: `1.5px solid ${e.border}` }}
                    />
                    <span className="text-xs font-semibold shrink-0" style={{ color: e.color }}>
                      {e.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground flex-1 text-right leading-relaxed">
                      {e.toothDetails.map(({ id, surfs }) =>
                        surfs.length > 0 ? `D${id}(${surfs.join(',')})` : `D${id}`,
                      ).join(' · ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* react-odontogram */}
      <Odontogram
        notation="FDI"
        showHalf="full"
        layout="circle"
        showLabels
        showTooltip
        singleSelect
        teethConditions={teethConditions}
        onChange={handleChange}
        selectedColor="hsl(var(--primary))"
        styles={{ width: '100%' }}
        tooltip={{
          content: (tooth?: ToothDetail) => {
            if (!tooth) return null;
            const fdi = tooth.notations?.fdi ?? '';
            const parts = toothSummary[fdi] ?? [];
            return (
              <div style={{ padding: '6px 10px', fontSize: 11, lineHeight: 1.6, minWidth: 56, fontFamily: 'sans-serif' }}>
                <div style={{ fontWeight: 700, marginBottom: 2 }}>D{fdi}</div>
                {parts.length > 0
                  ? parts.map((p, i) => <div key={i}>{p}</div>)
                  : <div style={{ opacity: 0.45 }}>—</div>
                }
              </div>
            );
          },
        }}
      />
    </div>
  );
}
