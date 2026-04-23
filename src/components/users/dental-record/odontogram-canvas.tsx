'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import type { OdontogramCondition, OdontogramState, OdontogramSurface, OdontogramToothState } from '@/lib/types';
import { CONDITION_MAP } from './condition-toolbar';

// FDI arrangement — patient's right on viewer's left
const UPPER_RIGHT = ['18', '17', '16', '15', '14', '13', '12', '11'];
const UPPER_LEFT  = ['21', '22', '23', '24', '25', '26', '27', '28'];
const LOWER_RIGHT = ['48', '47', '46', '45', '44', '43', '42', '41'];
const LOWER_LEFT  = ['31', '32', '33', '34', '35', '36', '37', '38'];

// Cross-diagram SVG paths (viewBox 0 0 90 90)
const SURFACE_PATHS: Record<OdontogramSurface, string> = {
  top:    'M25,0 L65,0 L65,25 L25,25 Z',
  left:   'M0,25 L25,25 L25,65 L0,65 Z',
  center: 'M25,25 L65,25 L65,65 L25,65 Z',
  right:  'M65,25 L90,25 L90,65 L65,65 Z',
  bottom: 'M25,65 L65,65 L65,90 L25,90 Z',
};

const SURFACES: OdontogramSurface[] = ['top', 'left', 'center', 'right', 'bottom'];

function conditionFill(c?: OdontogramCondition): string | null {
  if (!c) return null;
  return CONDITION_MAP[c]?.color ?? null;
}

// ── SmallTooth ─────────────────────────────────────────────────────────────────

interface SmallToothProps {
  toothId: string;
  state: OdontogramToothState;
  selected: boolean;
  readOnly: boolean;
  arch: 'upper' | 'lower';
  size: number;
  onClick: () => void;
}

function SmallTooth({ toothId, state, selected, readOnly, arch, size, onClick }: SmallToothProps) {
  const wholeDef = state.whole ? CONDITION_MAP[state.whole] : null;
  const clipId = `tc-${toothId}`;
  const fontSize = Math.max(6, size * 0.32);

  const handleClick = () => { if (!readOnly) onClick(); };
  const handleKey = (e: React.KeyboardEvent) => {
    if (!readOnly && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick(); }
  };

  // Warm cream tooth background — visible in both light and dark modes
  const toothFill = wholeDef ? `${wholeDef.color}30` : '#f2e8d8';
  const borderColor = selected ? '#6366f1' : '#baa898';
  const borderWidth = selected ? 3 : 1.8;
  const dividerColor = '#a89888';

  return (
    <div
      className="flex flex-col items-center"
      style={{ width: size }}
    >
      {/* Number above for lower arch */}
      {arch === 'lower' && (
        <span
          className={cn('leading-none select-none font-bold', selected ? 'text-primary' : 'text-muted-foreground')}
          style={{ fontSize, marginBottom: 2 }}
        >
          {toothId}
        </span>
      )}

      {/* Circular tooth cross-diagram */}
      <svg
        viewBox="0 0 90 90"
        width={size}
        height={size}
        onClick={handleClick}
        onKeyDown={handleKey}
        role={readOnly ? undefined : 'button'}
        tabIndex={readOnly ? undefined : 0}
        className={cn('block focus:outline-none', !readOnly && 'cursor-pointer')}
        aria-label={`Diente ${toothId}`}
      >
        <defs>
          <clipPath id={clipId}>
            <circle cx="45" cy="45" r="43" />
          </clipPath>
        </defs>

        {/* Base circle — the tooth */}
        <circle
          cx="45" cy="45" r="43"
          fill={toothFill}
          stroke={borderColor}
          strokeWidth={borderWidth}
        />

        {/* Zone fills — clipped to circle */}
        <g clipPath={`url(#${clipId})`}>
          {SURFACES.map((s) => {
            const fill = conditionFill(state[s]);
            if (!fill) return null;
            return <path key={s} d={SURFACE_PATHS[s]} fill={fill} opacity="0.9" />;
          })}
        </g>

        {/* Grid dividers — clipped to circle */}
        <g clipPath={`url(#${clipId})`}>
          <line x1="25" y1="0"  x2="25" y2="90" stroke={dividerColor} strokeWidth="1" />
          <line x1="65" y1="0"  x2="65" y2="90" stroke={dividerColor} strokeWidth="1" />
          <line x1="0"  y1="25" x2="90" y2="25" stroke={dividerColor} strokeWidth="1" />
          <line x1="0"  y1="65" x2="90" y2="65" stroke={dividerColor} strokeWidth="1" />
        </g>

        {/* Whole-tooth condition symbols — clipped */}
        <g clipPath={`url(#${clipId})`}>
          {state.whole === 'missing' && (
            <>
              <line x1="10" y1="10" x2="80" y2="80" stroke={CONDITION_MAP.missing.color} strokeWidth="3" strokeLinecap="round" />
              <line x1="80" y1="10" x2="10" y2="80" stroke={CONDITION_MAP.missing.color} strokeWidth="3" strokeLinecap="round" />
            </>
          )}
          {state.whole === 'extracted' && (
            <rect x="0" y="0" width="90" height="90" fill={CONDITION_MAP.extracted.color} opacity="0.22" />
          )}
          {(state.whole === 'crown' || state.whole === 'crown_temp') && (
            <rect
              x="4" y="4" width="82" height="82" rx="6"
              fill="none"
              stroke={CONDITION_MAP[state.whole].color}
              strokeWidth="4"
              strokeDasharray={state.whole === 'crown_temp' ? '8,4' : undefined}
            />
          )}
          {state.whole === 'root_canal' && (
            <circle cx="45" cy="45" r="16" fill="none" stroke={CONDITION_MAP.root_canal.color} strokeWidth="3" />
          )}
          {state.whole === 'bridge' && (
            <line x1="0" y1="45" x2="90" y2="45" stroke={CONDITION_MAP.bridge.color} strokeWidth="4" strokeDasharray="7,3" />
          )}
          {state.whole === 'implant' && (
            <>
              <line x1="45" y1="8"  x2="45" y2="82" stroke={CONDITION_MAP.implant.color} strokeWidth="3" strokeLinecap="round" />
              <line x1="28" y1="26" x2="62" y2="26" stroke={CONDITION_MAP.implant.color} strokeWidth="2.5" strokeLinecap="round" />
              <line x1="30" y1="42" x2="60" y2="42" stroke={CONDITION_MAP.implant.color} strokeWidth="2" strokeLinecap="round" />
            </>
          )}
          {state.overlays?.includes('fracture') && (
            <line x1="15" y1="5" x2="75" y2="85" stroke={CONDITION_MAP.fracture.color} strokeWidth="2.5" strokeLinecap="round" />
          )}
          {state.overlays?.includes('orthodontics') && (
            <rect x="26" y="36" width="38" height="18" rx="3" fill={CONDITION_MAP.orthodontics.color} opacity="0.85" />
          )}
        </g>

        {/* Selected highlight ring (outside clip — always fully visible) */}
        {selected && (
          <circle cx="45" cy="45" r="43" fill="none" stroke="#6366f1" strokeWidth="3" />
        )}
      </svg>

      {/* Number below for upper arch */}
      {arch === 'upper' && (
        <span
          className={cn('leading-none select-none font-bold', selected ? 'text-primary' : 'text-muted-foreground')}
          style={{ fontSize, marginTop: 2 }}
        >
          {toothId}
        </span>
      )}
    </div>
  );
}

// ── TeethRow ───────────────────────────────────────────────────────────────────

function TeethRow({
  leftTeeth,
  rightTeeth,
  arch,
  state,
  selectedToothId,
  readOnly,
  toothSize,
  onSelectTooth,
}: {
  leftTeeth: string[];
  rightTeeth: string[];
  arch: 'upper' | 'lower';
  state: OdontogramState;
  selectedToothId: string | null;
  readOnly: boolean;
  toothSize: number;
  onSelectTooth: (id: string) => void;
}) {
  return (
    <div className="flex items-center justify-center" style={{ gap: 2 }}>
      {leftTeeth.map((id) => (
        <SmallTooth
          key={id}
          toothId={id}
          state={state[id] ?? {}}
          selected={selectedToothId === id}
          readOnly={readOnly}
          arch={arch}
          size={toothSize}
          onClick={() => onSelectTooth(id)}
        />
      ))}
      {/* Midline gap */}
      <div style={{ width: 8, flexShrink: 0 }} />
      {rightTeeth.map((id) => (
        <SmallTooth
          key={id}
          toothId={id}
          state={state[id] ?? {}}
          selected={selectedToothId === id}
          readOnly={readOnly}
          arch={arch}
          size={toothSize}
          onClick={() => onSelectTooth(id)}
        />
      ))}
    </div>
  );
}

// ── OdontogramCanvas ───────────────────────────────────────────────────────────

interface OdontogramCanvasProps {
  state: OdontogramState;
  selectedToothId: string | null;
  onSelectTooth: (id: string) => void;
  readOnly?: boolean;
  /** 'upper' | 'lower' | 'full' */
  half?: 'upper' | 'lower' | 'full';
  toothSize?: number;
}

export function OdontogramCanvas({
  state,
  selectedToothId,
  onSelectTooth,
  readOnly = false,
  half = 'full',
  toothSize = 28,
}: OdontogramCanvasProps) {
  return (
    <div className="w-full overflow-x-auto">
      <div className="flex flex-col items-center" style={{ gap: 4 }}>
        {(half === 'full' || half === 'upper') && (
          <TeethRow
            leftTeeth={UPPER_RIGHT}
            rightTeeth={UPPER_LEFT}
            arch="upper"
            state={state}
            selectedToothId={selectedToothId}
            readOnly={readOnly}
            toothSize={toothSize}
            onSelectTooth={onSelectTooth}
          />
        )}
        {(half === 'full' || half === 'lower') && (
          <TeethRow
            leftTeeth={LOWER_RIGHT}
            rightTeeth={LOWER_LEFT}
            arch="lower"
            state={state}
            selectedToothId={selectedToothId}
            readOnly={readOnly}
            toothSize={toothSize}
            onSelectTooth={onSelectTooth}
          />
        )}
      </div>
    </div>
  );
}
