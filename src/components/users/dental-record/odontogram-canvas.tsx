'use client';

import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { OdontogramCondition, OdontogramState, OdontogramSurface, OdontogramToothState } from '@/lib/types';
import { CONDITION_MAP } from './condition-toolbar';

// FDI arrangement — patient's right on viewer's left
const UPPER_RIGHT = ['18', '17', '16', '15', '14', '13', '12', '11'];
const UPPER_LEFT  = ['21', '22', '23', '24', '25', '26', '27', '28'];
const LOWER_RIGHT = ['48', '47', '46', '45', '44', '43', '42', '41'];
const LOWER_LEFT  = ['31', '32', '33', '34', '35', '36', '37', '38'];

const ALL_UPPER = [...UPPER_RIGHT, ...UPPER_LEFT];
const ALL_LOWER = [...LOWER_RIGHT, ...LOWER_LEFT];

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

// ── ToothSilhouette ────────────────────────────────────────────────────────────
function ToothSilhouette({
  arch,
  size,
  selected,
}: {
  arch: 'upper' | 'lower';
  size: number;
  selected: boolean;
}) {
  const h = Math.round(size * 0.48);
  const strokeColor = selected ? '#6366f1' : '#baa898';
  const path = arch === 'upper'
    ? 'M8,40 L8,16 Q8,2 45,2 Q82,2 82,16 L82,40 Z'
    : 'M8,0 L8,24 Q8,38 45,38 Q82,38 82,24 L82,0 Z';
  return (
    <svg
      viewBox="0 0 90 40"
      width={size}
      height={h}
      aria-hidden
      style={{
        display: 'block',
        marginBottom: arch === 'upper' ? -1 : 0,
        marginTop: arch === 'lower' ? -1 : 0,
      }}
    >
      <path d={path} fill="#f5f0e8" stroke={strokeColor} strokeWidth="1.8" />
    </svg>
  );
}

// ── SmallTooth ─────────────────────────────────────────────────────────────────

interface SmallToothProps {
  toothId: string;
  state: OdontogramToothState;
  selected: boolean;
  readOnly: boolean;
  arch: 'upper' | 'lower';
  size: number;
  showSilhouette?: boolean;
  onClick: () => void;
}

function SmallTooth({ toothId, state, selected, readOnly, arch, size, showSilhouette, onClick }: SmallToothProps) {
  const wholeDef = state.whole ? CONDITION_MAP[state.whole] : null;
  const clipId = `tc-${toothId}`;
  const fontSize = Math.max(6, size * 0.32);

  const handleClick = () => { if (!readOnly) onClick(); };
  const handleKey = (e: React.KeyboardEvent) => {
    if (!readOnly && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick(); }
  };

  const toothFill = wholeDef ? `${wholeDef.color}30` : '#f2e8d8';
  const borderColor = selected ? '#6366f1' : '#baa898';
  const borderWidth = selected ? 3 : 1.8;
  const dividerColor = '#a89888';

  return (
    <div
      className="flex flex-col items-center"
      style={{ width: size }}
      data-tooth={toothId}
    >
      {showSilhouette && arch === 'upper' && (
        <ToothSilhouette arch="upper" size={size} selected={selected} />
      )}
      {arch === 'lower' && (
        <span
          className={cn('leading-none select-none font-bold', selected ? 'text-primary' : 'text-muted-foreground')}
          style={{ fontSize, marginBottom: 2 }}
        >
          {toothId}
        </span>
      )}
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
        <circle cx="45" cy="45" r="43" fill={toothFill} stroke={borderColor} strokeWidth={borderWidth} />
        <g clipPath={`url(#${clipId})`}>
          {SURFACES.map((s) => {
            const fill = conditionFill(state[s]);
            if (!fill) return null;
            return <path key={s} d={SURFACE_PATHS[s]} fill={fill} opacity="0.9" />;
          })}
        </g>
        <g clipPath={`url(#${clipId})`}>
          <line x1="25" y1="0"  x2="25" y2="90" stroke={dividerColor} strokeWidth="1" />
          <line x1="65" y1="0"  x2="65" y2="90" stroke={dividerColor} strokeWidth="1" />
          <line x1="0"  y1="25" x2="90" y2="25" stroke={dividerColor} strokeWidth="1" />
          <line x1="0"  y1="65" x2="90" y2="65" stroke={dividerColor} strokeWidth="1" />
        </g>
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
        {selected && (
          <circle cx="45" cy="45" r="43" fill="none" stroke="#6366f1" strokeWidth="3" />
        )}
      </svg>
      {arch === 'upper' && (
        <span
          className={cn('leading-none select-none font-bold', selected ? 'text-primary' : 'text-muted-foreground')}
          style={{ fontSize, marginTop: 2 }}
        >
          {toothId}
        </span>
      )}
      {showSilhouette && arch === 'lower' && (
        <ToothSilhouette arch="lower" size={size} selected={selected} />
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
  showSilhouette,
  onSelectTooth,
}: {
  leftTeeth: string[];
  rightTeeth: string[];
  arch: 'upper' | 'lower';
  state: OdontogramState;
  selectedToothId: string | null;
  readOnly: boolean;
  toothSize: number;
  showSilhouette?: boolean;
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
          showSilhouette={showSilhouette}
          onClick={() => onSelectTooth(id)}
        />
      ))}
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
          showSilhouette={showSilhouette}
          onClick={() => onSelectTooth(id)}
        />
      ))}
    </div>
  );
}

// ── ArchTooth ──────────────────────────────────────────────────────────────────
// Tooth for the curved open-mouth layout, always clickable, number label
// positioned outside the circle based on location in the arch.

type LabelSide = 'left' | 'right' | 'top' | 'bottom';

interface ArchToothProps {
  toothId: string;
  state: OdontogramToothState;
  selected: boolean;
  x: number;
  y: number;
  cx: number;
  a: number;
  size: number;
  arch: 'upper' | 'lower';
  onClick: () => void;
}

function ArchTooth({ toothId, state, selected, x, y, cx, a, size, arch, onClick }: ArchToothProps) {
  const wholeDef = state.whole ? CONDITION_MAP[state.whole] : null;
  const clipId = `atc-${toothId}`;
  const fontSize = Math.max(9, Math.round(size * 0.75));

  const toothFill = wholeDef ? `${wholeDef.color}30` : '#f2e8d8';
  const borderColor = selected ? '#6366f1' : '#baa898';
  const borderWidth = selected ? 3 : 1.8;
  const dividerColor = '#a89888';

  let labelSide: LabelSide;
  if (x < cx - a / 3) {
    labelSide = 'left';
  } else if (x > cx + a / 3) {
    labelSide = 'right';
  } else {
    labelSide = arch === 'upper' ? 'top' : 'bottom';
  }

  const gap = 3;
  const labelStyle: React.CSSProperties = {
    position: 'absolute',
    fontSize,
    fontWeight: 700,
    lineHeight: 1,
    color: selected ? '#6366f1' : '#6b7280',
    userSelect: 'none',
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
  };

  // Place the label outside the tooth circle on the correct side.
  // For left/right: center vertically on the tooth.
  // For top/bottom: center horizontally over the tooth width.
  if (labelSide === 'left') {
    labelStyle.right = size + gap;
    labelStyle.top = (size - fontSize) / 2;
  } else if (labelSide === 'right') {
    labelStyle.left = size + gap;
    labelStyle.top = (size - fontSize) / 2;
  } else if (labelSide === 'top') {
    labelStyle.bottom = size + gap;
    labelStyle.left = '50%';
    labelStyle.transform = 'translateX(-50%)';
  } else {
    labelStyle.top = size + gap;
    labelStyle.left = '50%';
    labelStyle.transform = 'translateX(-50%)';
  }

  return (
    <div
      data-tooth={toothId}
      style={{
        position: 'absolute',
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
      }}
    >
      <span style={labelStyle}>{toothId}</span>
      <svg
        viewBox="0 0 90 90"
        width={size}
        height={size}
        onClick={onClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
        role="button"
        tabIndex={0}
        className="block focus:outline-none cursor-pointer"
        aria-label={`Diente ${toothId}`}
      >
        <defs>
          <clipPath id={clipId}>
            <circle cx="45" cy="45" r="43" />
          </clipPath>
        </defs>
        <circle cx="45" cy="45" r="43" fill={toothFill} stroke={borderColor} strokeWidth={borderWidth} />
        <g clipPath={`url(#${clipId})`}>
          {SURFACES.map((s) => {
            const fill = conditionFill(state[s]);
            if (!fill) return null;
            return <path key={s} d={SURFACE_PATHS[s]} fill={fill} opacity="0.9" />;
          })}
        </g>
        <g clipPath={`url(#${clipId})`}>
          <line x1="25" y1="0"  x2="25" y2="90" stroke={dividerColor} strokeWidth="1" />
          <line x1="65" y1="0"  x2="65" y2="90" stroke={dividerColor} strokeWidth="1" />
          <line x1="0"  y1="25" x2="90" y2="25" stroke={dividerColor} strokeWidth="1" />
          <line x1="0"  y1="65" x2="90" y2="65" stroke={dividerColor} strokeWidth="1" />
        </g>
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
        {selected && <circle cx="45" cy="45" r="43" fill="none" stroke="#6366f1" strokeWidth="3" />}
      </svg>
    </div>
  );
}

// ── MobileArchCanvas ───────────────────────────────────────────────────────────
// Parabolic open-mouth layout.
// Upper arch: incisors at TOP (apex), molars curve DOWN to the sides.
// Lower arch: incisors at BOTTOM (apex), molars curve UP to the sides.
// The two arches almost touch at the molar region, wide open at the incisors.

interface MobileArchCanvasProps {
  state: OdontogramState;
  selectedToothId: string | null;
  onSelectTooth: (id: string) => void;
  zoom?: number;
}

function MobileArchCanvas({ state, selectedToothId, onSelectTooth, zoom = 1 }: MobileArchCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(300);
  const [containerHeight, setContainerHeight] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      if (rect.width > 50) setContainerWidth(rect.width);
      if (rect.height > 80) setContainerHeight(rect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const a = Math.min((containerWidth - 80) / 2, 160);
  const spacing = containerWidth > 100 ? (2 * a) / 15 : 14;
  const toothSize = Math.max(14, Math.min(26, Math.floor(spacing * 0.9)));
  const cx = containerWidth / 2;
  const topMargin = toothSize + 6;
  const molarGap = toothSize + 8;

  // Stretch b to fill available height; fallback to a×1.2 if height not yet measured
  const bMinimum = a * 1.2;
  const bFromHeight = containerHeight > 0
    ? (containerHeight - 2 * topMargin - toothSize - molarGap) / 2
    : 0;
  const b = Math.max(bMinimum, bFromHeight);

  const upperCy = topMargin + toothSize / 2;
  const lowerCy = upperCy + 2 * b + molarGap;
  const totalHeight = lowerCy + toothSize / 2 + topMargin;

  const upperTeeth = ALL_UPPER.map((id, i) => {
    const xi = (cx - a) + i * (2 * a / 15);
    const yi = upperCy + (b * Math.pow(xi - cx, 2) / Math.pow(a, 2));
    return { id, x: xi, y: yi };
  });

  const lowerTeeth = ALL_LOWER.map((id, i) => {
    const xi = (cx - a) + i * (2 * a / 15);
    const yi = lowerCy - (b * Math.pow(xi - cx, 2) / Math.pow(a, 2));
    return { id, x: xi, y: yi };
  });

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}
    >
      {/* Zoom scale applied to inner content; origin top-center so arch stays anchored */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: totalHeight,
          transform: `scale(${zoom})`,
          transformOrigin: 'top center',
        }}
      >
        {upperTeeth.map(({ id, x, y }) => (
          <ArchTooth
            key={id}
            toothId={id}
            state={state[id] ?? {}}
            selected={selectedToothId === id}
            x={x}
            y={y}
            cx={cx}
            a={a}
            size={toothSize}
            arch="upper"
            onClick={() => onSelectTooth(id)}
          />
        ))}
        {lowerTeeth.map(({ id, x, y }) => (
          <ArchTooth
            key={id}
            toothId={id}
            state={state[id] ?? {}}
            selected={selectedToothId === id}
            x={x}
            y={y}
            cx={cx}
            a={a}
            size={toothSize}
            arch="lower"
            onClick={() => onSelectTooth(id)}
          />
        ))}
      </div>
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
  /**
   * 'flat'  — two straight rows (default)
   * 'mouth' — parabolic open-mouth curved layout
   */
  layout?: 'flat' | 'mouth';
  /** When true, scrolls the selected tooth into view horizontally (flat layout only) */
  scrollToSelected?: boolean;
  /** Scale factor applied to the canvas content (1 = normal, >1 = zoomed in) */
  zoom?: number;
}

export function OdontogramCanvas({
  state,
  selectedToothId,
  onSelectTooth,
  readOnly = false,
  half = 'full',
  toothSize = 28,
  layout = 'flat',
  scrollToSelected = false,
  zoom = 1,
}: OdontogramCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (layout === 'mouth' || !scrollToSelected || !selectedToothId || !containerRef.current) return;
    const el = containerRef.current.querySelector<HTMLElement>(`[data-tooth="${selectedToothId}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [selectedToothId, scrollToSelected, layout]);

  if (layout === 'mouth') {
    return (
      <MobileArchCanvas
        state={state}
        selectedToothId={selectedToothId}
        onSelectTooth={onSelectTooth}
        zoom={zoom}
      />
    );
  }

  return (
    <div className="w-full overflow-x-auto" ref={containerRef}>
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
