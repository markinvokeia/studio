'use client';

import React, { useCallback, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { SixPointBool, SixPointMeasure, ToothPerioData } from '@/lib/types';
import { NumpadPopover, SIX_POINTS, type PerioPoint } from './numpad-popover';
import { Badge } from '@/components/ui/badge';
import { useTranslations } from 'next-intl';

// FDI notation: upper right (18-11), upper left (21-28), lower left (31-38), lower right (41-48)
const UPPER_TEETH = ['18', '17', '16', '15', '14', '13', '12', '11', '21', '22', '23', '24', '25', '26', '27', '28'];
const LOWER_TEETH = ['48', '47', '46', '45', '44', '43', '42', '41', '31', '32', '33', '34', '35', '36', '37', '38'];

const TOOTH_W = 28; // px per tooth column
const PX_PER_MM = 7; // px per mm
const MAX_MM = 12;
const CHART_H = MAX_MM * PX_PER_MM; // 84px

const EMPTY_MEASURE: SixPointMeasure = { MB: 0, B: 0, DB: 0, ML: 0, L: 0, DL: 0 };
const EMPTY_BOOL: SixPointBool = { MB: false, B: false, DB: false, ML: false, L: false, DL: false };

function emptyTooth(toothId: string): ToothPerioData {
  return {
    toothId,
    probing: { ...EMPTY_MEASURE },
    recession: { ...EMPTY_MEASURE },
    bleeding: { ...EMPTY_BOOL },
    suppuration: { ...EMPTY_BOOL },
    mobility: 0,
    furcation: 0,
  };
}

function depthColor(v: number): string {
  if (v <= 0) return '#e5e7eb';
  if (v <= 3) return '#22c55e';
  if (v === 4) return '#facc15';
  if (v <= 6) return '#f97316';
  return '#ef4444';
}

function depthTextColor(v: number): string {
  if (v <= 0) return '#9ca3af';
  if (v <= 3) return '#15803d';
  if (v === 4) return '#a16207';
  if (v <= 6) return '#c2410c';
  return '#b91c1c';
}

/** The 3 buccal points displayed left→right above/below tooth */
const BUCCAL_POINTS: PerioPoint[] = ['MB', 'B', 'DB'];
/** The 3 lingual points */
const LINGUAL_POINTS: PerioPoint[] = ['DL', 'L', 'ML'];

interface NumpadState {
  toothId: string;
  pointIndex: number; // 0-5 over SIX_POINTS
}

interface PeriodontogramViewProps {
  teeth: ToothPerioData[];
  ghostTeeth?: ToothPerioData[]; // previous session for comparison
  onTeethChange: (teeth: ToothPerioData[]) => void;
}

export function PeriodontogramView({ teeth, ghostTeeth, onTeethChange }: PeriodontogramViewProps) {
  const t = useTranslations('DentalRecord');
  const [numpad, setNumpad] = useState<NumpadState | null>(null);

  // Build lookup map
  const toothMap = useCallback(
    (id: string): ToothPerioData => teeth.find((t) => t.toothId === id) ?? emptyTooth(id),
    [teeth],
  );
  const ghostMap = useCallback(
    (id: string): ToothPerioData | undefined => ghostTeeth?.find((t) => t.toothId === id),
    [ghostTeeth],
  );

  function updateTooth(id: string, updater: (prev: ToothPerioData) => ToothPerioData) {
    const existing = teeth.find((t) => t.toothId === id);
    const base = existing ?? emptyTooth(id);
    const updated = updater(base);
    if (existing) {
      onTeethChange(teeth.map((t) => (t.toothId === id ? updated : t)));
    } else {
      onTeethChange([...teeth, updated]);
    }
  }

  function handleValue(toothId: string, point: PerioPoint, value: number) {
    updateTooth(toothId, (prev) => ({
      ...prev,
      probing: { ...prev.probing, [point]: value },
    }));
  }

  function handleBleedingToggle(toothId: string, point: PerioPoint) {
    updateTooth(toothId, (prev) => ({
      ...prev,
      bleeding: { ...prev.bleeding, [point]: !prev.bleeding[point] },
    }));
  }

  function handleMobilityToggle(toothId: string) {
    updateTooth(toothId, (prev) => ({
      ...prev,
      mobility: ((prev.mobility + 1) % 4) as 0 | 1 | 2 | 3,
    }));
  }

  function openNumpad(toothId: string, pointIndex: number) {
    setNumpad({ toothId, pointIndex });
  }

  function advanceNumpad() {
    if (!numpad) return;
    const next = numpad.pointIndex + 1;
    if (next >= 6) {
      setNumpad(null);
    } else {
      setNumpad({ ...numpad, pointIndex: next });
    }
  }

  const activePoint = numpad ? SIX_POINTS[numpad.pointIndex] : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground items-center">
        <div className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ background: '#22c55e' }} />
          1–3 mm
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ background: '#facc15' }} />
          4 mm
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ background: '#f97316' }} />
          5–6 mm
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ background: '#ef4444' }} />
          ≥7 mm
        </div>
        {ghostTeeth && ghostTeeth.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm border border-dashed border-amber-500" style={{ background: 'transparent' }} />
            Sesión anterior
          </div>
        )}
        <p className="text-[10px] text-muted-foreground ml-auto">
          Toca un diente para ingresar medidas de sondaje
        </p>
      </div>

      {/* Chart — horizontally scrollable */}
      <div className="overflow-x-auto rounded-lg border bg-background">
        <div style={{ minWidth: `${(UPPER_TEETH.length + 2) * TOOTH_W}px` }}>
          <ArchChart
            teeth={UPPER_TEETH}
            arch="upper"
            toothMap={toothMap}
            ghostMap={ghostMap}
            numpad={numpad}
            activePoint={activePoint}
            onOpenNumpad={openNumpad}
            onCloseNumpad={() => setNumpad(null)}
            onValue={handleValue}
            onAdvance={advanceNumpad}
            onBleedingToggle={handleBleedingToggle}
            onMobilityToggle={handleMobilityToggle}
          />

          {/* Midline separator */}
          <div className="h-3 flex items-center px-2">
            <div className="flex-1 border-t-2 border-dashed border-muted-foreground/30" />
            <span className="mx-2 text-[10px] text-muted-foreground">Maxilar superior / Maxilar inferior</span>
            <div className="flex-1 border-t-2 border-dashed border-muted-foreground/30" />
          </div>

          <ArchChart
            teeth={LOWER_TEETH}
            arch="lower"
            toothMap={toothMap}
            ghostMap={ghostMap}
            numpad={numpad}
            activePoint={activePoint}
            onOpenNumpad={openNumpad}
            onCloseNumpad={() => setNumpad(null)}
            onValue={handleValue}
            onAdvance={advanceNumpad}
            onBleedingToggle={handleBleedingToggle}
            onMobilityToggle={handleMobilityToggle}
          />
        </div>
      </div>
    </div>
  );
}

// ──── ArchChart ────────────────────────────────────────────────────────────────

interface ArchChartProps {
  teeth: string[];
  arch: 'upper' | 'lower';
  toothMap: (id: string) => ToothPerioData;
  ghostMap: (id: string) => ToothPerioData | undefined;
  numpad: NumpadState | null;
  activePoint: PerioPoint | null;
  onOpenNumpad: (toothId: string, pointIndex: number) => void;
  onCloseNumpad: () => void;
  onValue: (toothId: string, point: PerioPoint, value: number) => void;
  onAdvance: () => void;
  onBleedingToggle: (toothId: string, point: PerioPoint) => void;
  onMobilityToggle: (toothId: string) => void;
}

function ArchChart({
  teeth, arch, toothMap, ghostMap, numpad, activePoint,
  onOpenNumpad, onCloseNumpad, onValue, onAdvance,
  onBleedingToggle, onMobilityToggle,
}: ArchChartProps) {
  const isUpper = arch === 'upper';

  return (
    <div className={cn('py-2 px-1', isUpper ? 'pb-1' : 'pt-1')}>
      <div className="flex">
        {/* Y-axis label */}
        <div className="flex flex-col justify-center items-center w-6 shrink-0">
          <span
            className="text-[9px] text-muted-foreground"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            mm
          </span>
        </div>

        {/* Teeth */}
        <div className="flex">
          {teeth.map((toothId, idx) => {
            const data = toothMap(toothId);
            const ghost = ghostMap(toothId);
            const isNumpadOpen = numpad?.toothId === toothId;

            return (
              <ToothColumn
                key={toothId}
                toothId={toothId}
                arch={arch}
                data={data}
                ghost={ghost}
                isNumpadOpen={isNumpadOpen}
                activePoint={isNumpadOpen ? activePoint : null}
                numpadPointIndex={isNumpadOpen ? (numpad?.pointIndex ?? 0) : 0}
                onOpenNumpad={(ptIdx) => onOpenNumpad(toothId, ptIdx)}
                onCloseNumpad={onCloseNumpad}
                onValue={(pt, v) => onValue(toothId, pt, v)}
                onAdvance={onAdvance}
                onBleedingToggle={(pt) => onBleedingToggle(toothId, pt)}
                onMobilityToggle={() => onMobilityToggle(toothId)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ──── ToothColumn ──────────────────────────────────────────────────────────────

interface ToothColumnProps {
  toothId: string;
  arch: 'upper' | 'lower';
  data: ToothPerioData;
  ghost?: ToothPerioData;
  isNumpadOpen: boolean;
  activePoint: PerioPoint | null;
  numpadPointIndex: number;
  onOpenNumpad: (pointIndex: number) => void;
  onCloseNumpad: () => void;
  onValue: (point: PerioPoint, value: number) => void;
  onAdvance: () => void;
  onBleedingToggle: (point: PerioPoint) => void;
  onMobilityToggle: () => void;
}

function ToothColumn({
  toothId, arch, data, ghost, isNumpadOpen, activePoint,
  numpadPointIndex, onOpenNumpad, onCloseNumpad,
  onValue, onAdvance, onBleedingToggle, onMobilityToggle,
}: ToothColumnProps) {
  const isUpper = arch === 'upper';

  // buccal points displayed: MB, B, DB (left to right)
  // lingual points displayed: DL, L, ML (left to right, mirrored)
  const displayedBuccal: PerioPoint[] = BUCCAL_POINTS;
  const displayedLingual: PerioPoint[] = LINGUAL_POINTS;

  // Map PerioPoint → SIX_POINTS index for numpad state
  const pointToIdx: Record<PerioPoint, number> = { MB: 0, B: 1, DB: 2, ML: 3, L: 4, DL: 5 };

  const ChartBar = ({ points, side }: { points: PerioPoint[]; side: 'buccal' | 'lingual' }) => {
    const barH = CHART_H;
    const barW = TOOTH_W;

    // 3 mini-columns each ~9px wide
    const colW = barW / 3;

    return (
      <svg
        width={barW}
        height={barH}
        className="cursor-pointer hover:opacity-90 block"
        onClick={() => onOpenNumpad(pointToIdx[points[1]])} // click opens on center point
      >
        {/* Grid lines */}
        {[3, 6, 9, 12].map((mm) => (
          <line
            key={mm}
            x1={0} y1={mm * PX_PER_MM}
            x2={barW} y2={mm * PX_PER_MM}
            stroke="#e5e7eb" strokeWidth={mm % 6 === 0 ? 0.8 : 0.4}
            strokeDasharray={mm % 6 === 0 ? '2,2' : undefined}
          />
        ))}

        {/* Depth bars — ghost (previous session) */}
        {ghost && points.map((pt, i) => {
          const v = ghost.probing[pt];
          if (!v) return null;
          const h = Math.min(v * PX_PER_MM, barH);
          const x = i * colW + colW * 0.15;
          const w = colW * 0.7;
          const y = isUpper ? 0 : barH - h;
          return (
            <rect key={`ghost-${pt}`}
              x={x} y={y} width={w} height={h}
              fill="#f59e0b" opacity={0.25} rx={1}
            />
          );
        })}

        {/* Depth bars — current */}
        {points.map((pt, i) => {
          const v = data.probing[pt];
          const h = Math.min(v * PX_PER_MM, barH);
          const x = i * colW + colW * 0.15;
          const w = colW * 0.7;
          const y = isUpper ? 0 : barH - h;
          return (
            <g key={pt}>
              <rect
                x={x} y={y} width={w} height={h}
                fill={depthColor(v)} rx={1}
                className={cn(activePoint === pt && isNumpadOpen ? 'stroke-primary stroke-1' : '')}
              />
              {/* Value text */}
              {v > 0 && (
                <text
                  x={x + w / 2} y={isUpper ? h - 2 : barH - h + 8}
                  textAnchor="middle"
                  fontSize={8}
                  fontWeight="bold"
                  fill={depthTextColor(v)}
                >
                  {v}
                </text>
              )}
            </g>
          );
        })}

        {/* Ghost connecting line */}
        {ghost && (() => {
          const pts = points.map((pt, i) => {
            const v = ghost.probing[pt];
            const x = i * colW + colW / 2;
            const y = isUpper ? Math.min(v * PX_PER_MM, barH) : barH - Math.min(v * PX_PER_MM, barH);
            return `${x},${y}`;
          });
          return (
            <polyline
              points={pts.join(' ')}
              fill="none" stroke="#f59e0b" strokeWidth={1}
              strokeDasharray="3,2" opacity={0.5}
            />
          );
        })()}

        {/* Current connecting line */}
        {(() => {
          const pts = points.map((pt, i) => {
            const v = data.probing[pt];
            const x = i * colW + colW / 2;
            const y = isUpper ? Math.min(v * PX_PER_MM, barH) : barH - Math.min(v * PX_PER_MM, barH);
            return `${x},${y}`;
          });
          return (
            <polyline
              points={pts.join(' ')}
              fill="none" stroke="#6366f1" strokeWidth={1} opacity={0.6}
            />
          );
        })()}
      </svg>
    );
  };

  // Bleeding dots row
  const BleedingRow = ({ points }: { points: PerioPoint[] }) => (
    <div className="flex" style={{ width: TOOTH_W }}>
      {points.map((pt) => (
        <button
          key={pt}
          title={`Sangrado ${pt}`}
          onClick={() => onBleedingToggle(pt)}
          className="flex-1 flex items-center justify-center py-0.5"
        >
          <span
            className={cn(
              'h-2 w-2 rounded-full border transition-colors',
              data.bleeding[pt]
                ? 'bg-red-500 border-red-600'
                : 'bg-transparent border-gray-300 hover:border-red-400',
            )}
          />
        </button>
      ))}
    </div>
  );

  // Number cells row
  const NumberRow = ({ points, isActive }: { points: PerioPoint[]; isActive: boolean }) => (
    <div className="flex" style={{ width: TOOTH_W }}>
      {points.map((pt) => (
        <button
          key={pt}
          onClick={() => onOpenNumpad(pointToIdx[pt])}
          className={cn(
            'flex-1 text-[9px] font-mono text-center py-0.5 rounded-sm transition-colors',
            activePoint === pt && isActive
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-muted',
          )}
          style={{ color: activePoint === pt && isActive ? undefined : depthTextColor(data.probing[pt]) }}
        >
          {data.probing[pt] > 0 ? data.probing[pt] : '–'}
        </button>
      ))}
    </div>
  );

  const content = (
    <div className="flex flex-col items-center" style={{ width: TOOTH_W }}>
      {isUpper ? (
        <>
          {/* Upper arch: buccal on top */}
          <NumberRow points={displayedBuccal} isActive={isNumpadOpen} />
          <BleedingRow points={displayedBuccal} />
          <ChartBar points={displayedBuccal} side="buccal" />
          {/* Tooth number */}
          <div
            className="text-[9px] font-bold text-center text-foreground py-0.5 cursor-pointer select-none"
            title="Movilidad"
            onClick={onMobilityToggle}
          >
            {toothId}
            {data.mobility > 0 && (
              <span className="ml-0.5 text-orange-500">M{data.mobility}</span>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Lower arch: tooth number on top, buccal going down */}
          <div
            className="text-[9px] font-bold text-center text-foreground py-0.5 cursor-pointer select-none"
            title="Movilidad"
            onClick={onMobilityToggle}
          >
            {toothId}
            {data.mobility > 0 && (
              <span className="ml-0.5 text-orange-500">M{data.mobility}</span>
            )}
          </div>
          <ChartBar points={displayedBuccal} side="buccal" />
          <BleedingRow points={displayedBuccal} />
          <NumberRow points={displayedBuccal} isActive={isNumpadOpen} />
        </>
      )}
    </div>
  );

  return (
    <NumpadPopover
      toothId={toothId}
      activePoint={SIX_POINTS[numpadPointIndex]}
      values={data.probing}
      open={isNumpadOpen}
      onOpenChange={(o) => { if (!o) onCloseNumpad(); }}
      onValue={(pt, v) => onValue(pt, v)}
      onAdvance={onAdvance}
    >
      {content}
    </NumpadPopover>
  );
}
