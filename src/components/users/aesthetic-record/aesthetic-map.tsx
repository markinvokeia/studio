'use client';

import React from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import { cn } from '@/lib/utils';

import type { AestheticBodyFigure, AestheticMapView, AestheticPhotoAlignment, AestheticPoint, AestheticZoneId } from '@/lib/types';
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

/** Zoom limits of a backdrop photo, relative to the photo fitted inside the template */
export const BACKDROP_MIN_SCALE = 0.3;
export const BACKDROP_MAX_SCALE = 4;
const WHEEL_ZOOM_SPEED = 0.0015;

/** Photo shown behind the template */
export interface MapBackdrop {
  url: string;
  alignment: AestheticPhotoAlignment;
  /** 0–1 */
  opacity: number;
  /** Hide the line art, keeping zones and points */
  hideArt: boolean;
}

export const clampBackdropScale = (scale: number) => Math.min(BACKDROP_MAX_SCALE, Math.max(BACKDROP_MIN_SCALE, scale));

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
  backdrop?: MapBackdrop | null;
  /** Dragging and the wheel move and zoom the backdrop instead of touching points */
  adjustingBackdrop?: boolean;
  onBackdropChange?: (alignment: AestheticPhotoAlignment) => void;
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

/** Natural size of an image, `null` until it loads */
function useImageSize(url: string | undefined): { width: number; height: number } | null {
  const [size, setSize] = React.useState<{ url: string; width: number; height: number } | null>(null);
  React.useEffect(() => {
    if (!url) return;
    let active = true;
    const img = new Image();
    img.onload = () => { if (active) setSize({ url, width: img.naturalWidth, height: img.naturalHeight }); };
    img.src = url;
    return () => { active = false; };
  }, [url]);
  return size && size.url === url ? size : null;
}

interface PanState {
  pointerId: number;
  startX: number;
  startY: number;
  origin: AestheticPhotoAlignment;
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
  backdrop,
  adjustingBackdrop = false,
  onBackdropChange,
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
  const adjusting = adjustingBackdrop && !!backdrop && !!onBackdropChange;
  const imageSize = useImageSize(backdrop?.url);
  const panRef = React.useRef<PanState | null>(null);
  const clipId = `aes-map-clip-${React.useId().replace(/:/g, '')}`;

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
    if ((e.target as Element).closest('[data-point-id]') || adjusting) return;
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

  /** Client coordinates → viewBox coordinates, not clamped */
  function toSvgPointRaw(clientX: number, clientY: number): { x: number; y: number } | null {
    const ctm = svgRef.current?.getScreenCTM();
    if (!ctm) return null;
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }

  function handleBackdropPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (!adjusting || !backdrop) return;
    const p = toSvgPointRaw(e.clientX, e.clientY);
    if (!p) return;
    svgRef.current?.setPointerCapture(e.pointerId);
    panRef.current = { pointerId: e.pointerId, startX: p.x, startY: p.y, origin: backdrop.alignment };
  }

  // Latest values for the native wheel listener
  const wheelRef = React.useRef({ backdrop, onBackdropChange, X, Y, W, H });
  React.useEffect(() => { wheelRef.current = { backdrop, onBackdropChange, X, Y, W, H }; });

  // Wheel zoom keeps the point under the pointer still. React's onWheel is passive and
  // can't stop the panel from scrolling, hence the native listener.
  React.useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !adjusting) return;
    const onWheel = (e: WheelEvent) => {
      const { backdrop: current, onBackdropChange: change, X: x0, Y: y0, W: w, H: h } = wheelRef.current;
      const ctm = svg.getScreenCTM();
      if (!current || !change || !ctm) return;
      e.preventDefault();
      const a = current.alignment;
      const nextScale = clampBackdropScale(a.scale * Math.exp(-e.deltaY * WHEEL_ZOOM_SPEED));
      const ratio = nextScale / a.scale;
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
      const cx = x0 + a.x * w;
      const cy = y0 + a.y * h;
      change({ ...a, scale: nextScale, x: (p.x + (cx - p.x) * ratio - x0) / w, y: (p.y + (cy - p.y) * ratio - y0) / h });
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [adjusting]);

  function handleBackdropKeyDown(e: React.KeyboardEvent<SVGSVGElement>) {
    if (!adjusting || !backdrop || !onBackdropChange || e.target !== e.currentTarget) return;
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-KEYBOARD_STEP, 0],
      ArrowRight: [KEYBOARD_STEP, 0],
      ArrowUp: [0, -KEYBOARD_STEP * (W / H)],
      ArrowDown: [0, KEYBOARD_STEP * (W / H)],
    };
    const step = delta[e.key];
    if (!step) return;
    e.preventDefault();
    const a = backdrop.alignment;
    onBackdropChange({ ...a, x: a.x + step[0], y: a.y + step[1] });
  }

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const pan = panRef.current;
    if (pan && pan.pointerId === e.pointerId) {
      const p = toSvgPointRaw(e.clientX, e.clientY);
      if (!p) return;
      onBackdropChange?.({ ...pan.origin, x: pan.origin.x + (p.x - pan.startX) / W, y: pan.origin.y + (p.y - pan.startY) / H });
      return;
    }
    if (!drag) return;
    const p = toSvgPoint(e.clientX, e.clientY);
    if (!p) return;
    const moved = drag.moved || Math.hypot(p.x - drag.startX, p.y - drag.startY) > DRAG_THRESHOLD * scale;
    setDrag({ ...drag, x: p.x, y: p.y, moved });
  }

  function handlePointerUp(e: React.PointerEvent<SVGSVGElement>) {
    if (panRef.current?.pointerId === e.pointerId) {
      svgRef.current?.releasePointerCapture(e.pointerId);
      panRef.current = null;
      return;
    }
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
              : backdrop
                ? cn('fill-transparent', shape.inert ? 'stroke-white/35' : 'stroke-white/70')
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

  let backdropImage: React.ReactNode = null;
  if (backdrop && imageSize) {
    const a = backdrop.alignment;
    const aspect = imageSize.height / imageSize.width;
    const width = Math.min(W, H / aspect) * a.scale;
    const height = width * aspect;
    backdropImage = (
      <image
        href={backdrop.url}
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        preserveAspectRatio="none"
        opacity={backdrop.opacity}
        transform={`translate(${X + a.x * W} ${Y + a.y * H}) rotate(${a.rotation}) scale(${a.mirrored ? -1 : 1} 1)`}
        pointerEvents="none"
      />
    );
  }
  // Over a photo the line art turns white with a dark halo so it reads on any skin tone
  const onPhoto = !!backdrop;
  const artStyle = onPhoto ? { filter: 'drop-shadow(0 0 1px rgb(0 0 0 / 0.7))' } : undefined;

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <svg
        ref={svgRef}
        viewBox={`${X} ${Y} ${W} ${H}`}
        role="img"
        aria-label={t(`views.${view}`)}
        tabIndex={adjusting ? 0 : undefined}
        className={cn(
          'h-auto w-full touch-none select-none rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring',
          adjusting ? 'cursor-move' : !readOnly && 'cursor-crosshair',
        )}
        onClick={handleBackgroundClick}
        onPointerDown={handleBackdropPointerDown}
        onKeyDown={handleBackdropKeyDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          panRef.current = null;
          setDrag(null);
        }}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={X} y={Y} width={W} height={H} rx={16 * scale} />
          </clipPath>
        </defs>
        <rect x={X} y={Y} width={W} height={H} rx={16 * scale} className="fill-muted/30" />
        {backdropImage && <g clipPath={`url(#${clipId})`}>{backdropImage}</g>}

        {/* Same layering for face and body: zones below the line art so its strokes stay crisp */}
        <g pointerEvents={adjusting ? 'none' : undefined}>{zoneShapes}</g>
        <g pointerEvents="none" style={artStyle} display={backdrop?.hideArt ? 'none' : undefined}>
          {artwork.details.map((shape) => (
            <path
              key={shape.key}
              d={shape.d}
              transform={shape.transform}
              fill="none"
              className={onPhoto ? 'stroke-white/60' : 'stroke-foreground/35'}
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
              className={onPhoto ? 'stroke-white/90' : 'stroke-foreground/55'}
              strokeWidth={LINE_WIDTH}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {artwork.fills.map((shape) => (
            <path key={shape.key} d={shape.d} transform={shape.transform} className={onPhoto ? 'fill-white/70' : 'fill-foreground/45'} />
          ))}
        </g>

        {/* Points */}
        <g pointerEvents={adjusting ? 'none' : undefined} opacity={adjusting ? 0.5 : undefined}>
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
        </g>
      </svg>
      {/* Name of the zone under the pointer: the panels are small and the title tooltip is slow */}
      <p className="min-h-4 truncate text-center text-xs font-medium text-muted-foreground" aria-live="polite">
        {caption ? zoneLabel(caption) : '\u00a0'}
      </p>
    </div>
  );
}
