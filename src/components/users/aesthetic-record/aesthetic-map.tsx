'use client';

import React from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import { cn } from '@/lib/utils';

import type { AestheticBodyFigure, AestheticMapView, AestheticPoint, AestheticZoneId } from '@/lib/types';
import { UNIT_COLORS, type MapArtwork } from './map-templates';
import { useMapArtwork } from './use-map-artwork';
import { useZoneLabel } from './use-zone-label';

/** Sizes below are tuned for a 300-unit-wide template and scaled to the artwork's width */
const BASE_WIDTH = 300;
const POINT_RADIUS = 6.5;
/** Below this distance a press on a point is a click, not a drag */
const DRAG_THRESHOLD = 2;
const KEYBOARD_STEP = 0.01;

/** Stroke widths and dashes in screen pixels (non-scaling), the same on every artwork */
const LINE_WIDTH = 1.5;
const DETAIL_WIDTH = 1;
const ZONE_DASH = '3 3';

interface AestheticMapProps {
  view: AestheticMapView;
  /** Figure used by the body views */
  figure: AestheticBodyFigure;
  /** Points of every view; only the ones of `view` are drawn */
  points: AestheticPoint[];
  /** Number shown on each point (its position in the session list) */
  pointNumbers: Map<string, number>;
  selectedPointId: string | null;
  readOnly?: boolean;
  /** Points drawn with an error ring (missing required data) */
  invalidPointIds?: Set<string>;
  /** Zones painted as highlighted (e.g. the selected point's zone) */
  highlightZones?: AestheticZoneId[];
  onAddPoint?: (x: number, y: number, zone: AestheticZoneId | null) => void;
  onMovePoint?: (id: string, x: number, y: number, zone: AestheticZoneId | null) => void;
  onSelectPoint: (id: string | null) => void;
  onDeletePoint?: (id: string) => void;
  className?: string;
}

export function AestheticMap({ view, figure, className, ...rest }: AestheticMapProps) {
  const t = useTranslations('AestheticRecord');
  const { artwork, error, retry } = useMapArtwork(view, figure);

  if (error) {
    return (
      <div className={cn('flex aspect-[1/2] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed p-4 text-center', className)}>
        <p className="text-xs text-muted-foreground">{t('map.loadError')}</p>
        <Button size="sm" variant="outline" onClick={retry}>{t('retry')}</Button>
      </div>
    );
  }
  if (!artwork) return <Skeleton className={cn('aspect-[1/2] w-full rounded-2xl', className)} />;
  return <MapCanvas view={view} artwork={artwork} className={className} {...rest} />;
}

interface DragState {
  id: string;
  startX: number;
  startY: number;
  x: number;
  y: number;
  moved: boolean;
}

function MapCanvas({
  view,
  artwork,
  points,
  pointNumbers,
  selectedPointId,
  readOnly = false,
  highlightZones,
  invalidPointIds,
  onAddPoint,
  onMovePoint,
  onSelectPoint,
  onDeletePoint,
  className,
}: Omit<AestheticMapProps, 'figure'> & { artwork: MapArtwork }) {
  const t = useTranslations('AestheticRecord');
  const zoneLabel = useZoneLabel();
  const svgRef = React.useRef<SVGSVGElement>(null);
  const shapeRefs = React.useRef(new Map<string, SVGPathElement>());
  const [drag, setDrag] = React.useState<DragState | null>(null);
  const suppressClickRef = React.useRef(false);
  const [hoveredZone, setHoveredZone] = React.useState<AestheticZoneId | null>(null);

  const { x: X, y: Y, width: W, height: H } = artwork.viewBox;
  const scale = W / BASE_WIDTH;
  const viewPoints = points.filter((p) => p.view === view);
  const highlighted = new Set(highlightZones ?? []);

  /** Client coordinates → viewBox coordinates, clamped to the artwork */
  function toSvgPoint(clientX: number, clientY: number): { x: number; y: number } | null {
    const ctm = svgRef.current?.getScreenCTM();
    if (!ctm) return null;
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: Math.min(X + W, Math.max(X, p.x)), y: Math.min(Y + H, Math.max(Y, p.y)) };
  }

  const toNormalized = (x: number, y: number) => ({ x: (x - X) / W, y: (y - Y) / H });
  const fromNormalized = (x: number, y: number) => ({ x: X + x * W, y: Y + y * H });

  /** Topmost zone shape under a viewBox point, each tested in its own (transformed) coordinates */
  function zoneAt(x: number, y: number): AestheticZoneId | null {
    const svgCtm = svgRef.current?.getScreenCTM();
    if (!svgCtm) return null;
    const screen = new DOMPoint(x, y).matrixTransform(svgCtm);
    for (let i = artwork.zones.length - 1; i >= 0; i--) {
      const path = shapeRefs.current.get(artwork.zones[i].key);
      const pathCtm = path?.getScreenCTM();
      if (!path || !pathCtm) continue;
      if (path.isPointInFill(screen.matrixTransform(pathCtm.inverse()))) return artwork.zones[i].zone;
    }
    return null;
  }

  function handleBackgroundClick(e: React.MouseEvent<SVGSVGElement>) {
    // With pointer capture the click after a drag lands on the svg itself
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if ((e.target as Element).closest('[data-point-id]')) return;
    if (readOnly || !onAddPoint) {
      onSelectPoint(null);
      return;
    }
    const p = toSvgPoint(e.clientX, e.clientY);
    if (!p) return;
    const n = toNormalized(p.x, p.y);
    onAddPoint(n.x, n.y, zoneAt(p.x, p.y));
  }

  function handlePointPointerDown(e: React.PointerEvent, point: AestheticPoint) {
    e.stopPropagation();
    if (readOnly || !onMovePoint) return;
    const p = toSvgPoint(e.clientX, e.clientY);
    if (!p) return;
    svgRef.current?.setPointerCapture(e.pointerId);
    const at = fromNormalized(point.x, point.y);
    setDrag({ id: point.id, startX: p.x, startY: p.y, x: at.x, y: at.y, moved: false });
  }

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!drag) return;
    const p = toSvgPoint(e.clientX, e.clientY);
    if (!p) return;
    const moved = drag.moved || Math.hypot(p.x - drag.startX, p.y - drag.startY) > DRAG_THRESHOLD * scale;
    setDrag({ ...drag, x: p.x, y: p.y, moved });
  }

  function handlePointerUp(e: React.PointerEvent<SVGSVGElement>) {
    if (!drag) return;
    svgRef.current?.releasePointerCapture(e.pointerId);
    suppressClickRef.current = true;
    if (drag.moved) {
      const n = toNormalized(drag.x, drag.y);
      onMovePoint?.(drag.id, n.x, n.y, zoneAt(drag.x, drag.y));
    } else {
      onSelectPoint(drag.id);
    }
    setDrag(null);
  }

  function handlePointKeyDown(e: React.KeyboardEvent, point: AestheticPoint) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelectPoint(point.id);
      return;
    }
    if (readOnly) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && onDeletePoint) {
      e.preventDefault();
      onDeletePoint(point.id);
      return;
    }
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-KEYBOARD_STEP, 0],
      ArrowRight: [KEYBOARD_STEP, 0],
      ArrowUp: [0, -KEYBOARD_STEP * (W / H)],
      ArrowDown: [0, KEYBOARD_STEP * (W / H)],
    };
    const step = delta[e.key];
    if (!step || !onMovePoint) return;
    e.preventDefault();
    const x = Math.min(1, Math.max(0, point.x + step[0]));
    const y = Math.min(1, Math.max(0, point.y + step[1]));
    const at = fromNormalized(x, y);
    onMovePoint(point.id, x, y, zoneAt(at.x, at.y));
  }

  // Highlights use amber, not the theme primary: the dark theme's primary is a dark grey that
  // barely shows, and amber also differs from the point colours
  const zoneShapes = artwork.zones.map((shape) => {
    const isHighlighted = highlighted.has(shape.zone);
    const isHovered = hoveredZone === shape.zone;
    return (
      <path
        key={shape.key}
        ref={(el) => {
          if (el) shapeRefs.current.set(shape.key, el);
          else shapeRefs.current.delete(shape.key);
        }}
        d={shape.d}
        transform={shape.transform}
        onPointerEnter={() => setHoveredZone(shape.zone)}
        onPointerLeave={() => setHoveredZone((z) => (z === shape.zone ? null : z))}
        className={cn(
          'transition-colors duration-150',
          isHighlighted
            ? 'fill-amber-400/30 stroke-amber-500'
            : isHovered
              ? 'fill-amber-300/20 stroke-amber-500/70'
              : cn('fill-transparent', shape.inert ? 'stroke-foreground/15 dark:stroke-foreground/25' : 'stroke-foreground/30 dark:stroke-foreground/45'),
        )}
        strokeWidth={1}
        strokeDasharray={isHighlighted ? undefined : ZONE_DASH}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      >
        <title>{zoneLabel(shape.zone)}</title>
      </path>
    );
  });

  const r = POINT_RADIUS * scale;
  const caption = drag ? null : hoveredZone;

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <svg
        ref={svgRef}
        viewBox={`${X} ${Y} ${W} ${H}`}
        role="img"
        aria-label={t(`views.${view}`)}
        className={cn('h-auto w-full touch-none select-none', !readOnly && 'cursor-crosshair')}
        onClick={handleBackgroundClick}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => setDrag(null)}
      >
        <rect x={X} y={Y} width={W} height={H} rx={16 * scale} className="fill-muted/30" />

        {/* Same layering for face and body: zones below the line art so its strokes stay crisp */}
        <g>{zoneShapes}</g>
        <g pointerEvents="none">
          {artwork.details.map((shape) => (
            <path
              key={shape.key}
              d={shape.d}
              transform={shape.transform}
              fill="none"
              className="stroke-foreground/35"
              strokeWidth={DETAIL_WIDTH}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {artwork.lines.map((shape) => (
            <path
              key={shape.key}
              d={shape.d}
              transform={shape.transform}
              fill="none"
              className="stroke-foreground/55"
              strokeWidth={LINE_WIDTH}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {artwork.fills.map((shape) => (
            <path key={shape.key} d={shape.d} transform={shape.transform} className="fill-foreground/45" />
          ))}
        </g>

        {/* Points */}
        {viewPoints.map((point) => {
          const isDragging = drag?.id === point.id;
          const at = isDragging ? { x: drag.x, y: drag.y } : fromNormalized(point.x, point.y);
          const isSelected = selectedPointId === point.id;
        const isInvalid = invalidPointIds?.has(point.id) ?? false;
          const number = pointNumbers.get(point.id);
          const label = t('map.pointLabel', {
            number: number ?? 0,
            product: point.productName || t('point.noProduct'),
            zone: point.zone ? zoneLabel(point.zone) : t('zones.none'),
          });
          return (
            <g
              key={point.id}
              data-point-id={point.id}
              role="button"
              tabIndex={0}
              aria-label={label}
              aria-pressed={isSelected}
              onPointerDown={(e) => handlePointPointerDown(e, point)}
              onClick={(e) => {
                e.stopPropagation();
                if (readOnly || !onMovePoint) onSelectPoint(point.id);
              }}
              onKeyDown={(e) => handlePointKeyDown(e, point)}
              className={cn('outline-none [&:focus-visible>circle:first-child]:stroke-ring', !readOnly ? 'cursor-grab' : 'cursor-pointer', isDragging && 'cursor-grabbing')}
            >
              <title>{label}</title>
              <circle
                cx={at.x}
                cy={at.y}
                r={r + 4 * scale}
                className={cn(
                  isInvalid ? 'fill-destructive/20 stroke-destructive' : isSelected ? 'fill-amber-400/25 stroke-amber-500' : 'fill-transparent stroke-transparent',
                )}
                strokeWidth={(isInvalid ? 2 : 1.5) * scale}
              />
              <circle cx={at.x} cy={at.y} r={r} fill={UNIT_COLORS[point.unit]} className="stroke-white" strokeWidth={1.5 * scale} />
              {number !== undefined && (
                <text x={at.x} y={at.y} dy="0.35em" textAnchor="middle" fontSize={7 * scale} className="fill-white font-semibold" pointerEvents="none">
                  {number}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {/* Name of the zone under the pointer: the panels are small and the title tooltip is slow */}
      <p className="min-h-4 truncate text-center text-xs font-medium text-muted-foreground" aria-live="polite">
        {caption ? zoneLabel(caption) : '\u00a0'}
      </p>
    </div>
  );
}
