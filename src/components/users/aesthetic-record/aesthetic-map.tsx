'use client';

import React from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import { cn } from '@/lib/utils';

import type { AestheticBodyFigure, AestheticMapView, AestheticMark, AestheticMarkKind, AestheticPhotoAlignment, AestheticZoneId } from '@/lib/types';
import { layerTitle, polygonCentroid, type PlacedMark } from './layers';
import { isFaceView, type MapArtwork } from './map-templates';
import { useMapArtwork } from './use-map-artwork';
import { useZoneLabel } from './use-zone-label';

/** Sizes below are tuned for a 300-unit-wide template and scaled to the artwork's width */
const BASE_WIDTH = 300;
const POINT_RADIUS = 6.5;
/** Below this distance a press on a point is a click, not a drag */
const DRAG_THRESHOLD = 2;
const KEYBOARD_STEP = 0.01;
/** A click this close (screen px) to the first vertex closes the area being drawn */
const CLOSE_AREA_DISTANCE = 10;
const MIN_AREA_VERTICES = 3;
/** A line this close (degrees) to vertical or horizontal snaps to it; Shift draws it free */
const LINE_SNAP_DEGREES = 8;
/** Shorter lines (screen px) are taken as a stray click */
const MIN_LINE_LENGTH = 6;
/** Drawing order: areas below, lines over them, points on top so they stay clickable */
const KIND_ORDER: Record<AestheticMarkKind, number> = { area: 0, line: 1, point: 2 };

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
  photoId: string;
  url: string;
  /** `null` while the photo has no alignment of its own: the map places it with {@link fitBackdrop} */
  alignment: AestheticPhotoAlignment | null;
  /** 0–1 */
  opacity: number;
  /** Hide the line art, keeping zones and points */
  hideArt: boolean;
}

const CENTERED_ALIGNMENT: AestheticPhotoAlignment = { x: 0.5, y: 0.5, scale: 1, rotation: 0, mirrored: false };

export const clampBackdropScale = (scale: number) => Math.min(BACKDROP_MAX_SCALE, Math.max(BACKDROP_MIN_SCALE, scale));

/**
 * First placement of a photo that was never aligned. Photos of the face frame it to fill the
 * shot, so they cover the whole template (no empty bands, centred); photos of the body show
 * the whole figure, so they are only fitted inside it. Fine tuning stays manual.
 */
export function fitBackdrop(view: AestheticMapView, image: { width: number; height: number }, template: { width: number; height: number }): AestheticPhotoAlignment {
  const aspect = image.height / image.width;
  const contained = Math.min(template.width, template.height / aspect);
  const covering = Math.max(template.width, template.height / aspect);
  const scale = isFaceView(view) ? Math.round(clampBackdropScale(covering / contained) * 100) / 100 : 1;
  return { x: 0.5, y: 0.5, scale, rotation: 0, mirrored: false };
}

interface AestheticMapProps {
  view: AestheticMapView;
  /** Figure used by the body views */
  figure: AestheticBodyFigure;
  /** Marks of every view and layer; only the ones of `view` are drawn */
  marks: PlacedMark[];
  selectedMarkId: string | null;
  readOnly?: boolean;
  /** Marks drawn with an error ring (missing required data) */
  invalidMarkIds?: Set<string>;
  /** Zones painted as highlighted (e.g. the selected mark's zone) */
  highlightZones?: AestheticZoneId[];
  /** What a click on the map adds: a point, a vertex of the area being drawn, or an end of a line */
  tool?: AestheticMarkKind;
  /** Color of what is being added (the active layer's) */
  toolColor?: string;
  onAddPoint?: (x: number, y: number, zone: AestheticZoneId | null) => void;
  /** An area was closed; `x`/`y` is its centre */
  onAddArea?: (polygon: [number, number][], x: number, y: number, zone: AestheticZoneId | null) => void;
  /** A line was drawn; `x`/`y` is its midpoint */
  onAddLine?: (ends: [number, number][], x: number, y: number, zone: AestheticZoneId | null) => void;
  onMoveMark?: (id: string, position: Pick<AestheticMark, 'x' | 'y' | 'polygon'>, zone: AestheticZoneId | null) => void;
  onSelectMark: (id: string | null) => void;
  onDeleteMark?: (id: string) => void;
  backdrop?: MapBackdrop | null;
  /** The map worked out where to put a backdrop photo that has no alignment yet */
  onBackdropFit?: (photoId: string, alignment: AestheticPhotoAlignment) => void;
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
  kind: AestheticMarkKind;
  startX: number;
  startY: number;
  x: number;
  y: number;
  moved: boolean;
}

function MapCanvas({
  view,
  artwork,
  marks,
  selectedMarkId,
  readOnly = false,
  highlightZones,
  invalidMarkIds,
  tool = 'point',
  toolColor,
  onAddPoint,
  onAddArea,
  onAddLine,
  onMoveMark,
  onSelectMark,
  onDeleteMark,
  backdrop: backdropProp,
  adjustingBackdrop = false,
  onBackdropChange,
  onBackdropFit,
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
  const viewMarks = marks.filter((m) => m.mark.view === view);
  /** Vertices of the area (or the start of the line) being drawn, normalized, and where the pointer is to preview the next edge */
  const [draftArea, setDraftArea] = React.useState<[number, number][] | null>(null);
  /** `free`: Shift is held, the line doesn't snap */
  const [cursor, setCursor] = React.useState<{ x: number; y: number; free: boolean } | null>(null);
  const drawingArea = tool === 'area' && !!onAddArea && !readOnly;
  const drawingLine = tool === 'line' && !!onAddLine && !readOnly;
  const isDrafting = !!draftArea?.length;
  // A new view or tool starts over
  React.useEffect(() => { setDraftArea(null); }, [view, tool, readOnly]);
  const highlighted = new Set(highlightZones ?? []);
  const imageSize = useImageSize(backdropProp?.url);
  const fit = React.useMemo(() => (imageSize ? fitBackdrop(view, imageSize, { width: W, height: H }) : null), [imageSize, view, W, H]);
  const backdrop = backdropProp && { ...backdropProp, alignment: backdropProp.alignment ?? fit ?? CENTERED_ALIGNMENT };
  const adjusting = adjustingBackdrop && !!backdrop && !!onBackdropChange;
  const fitPhotoId = backdropProp && !backdropProp.alignment ? backdropProp.photoId : undefined;
  React.useEffect(() => {
    if (fit && fitPhotoId) onBackdropFit?.(fitPhotoId, fit);
  }, [fit, fitPhotoId, onBackdropFit]);
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
    if (adjusting) return;
    if (!isDrafting && (e.target as Element).closest('[data-point-id]')) return;
    const p = toSvgPoint(e.clientX, e.clientY);
    if (drawingArea) {
      if (p) addAreaVertex(p);
      return;
    }
    if (drawingLine) {
      if (p) addLineEnd(p, e.shiftKey);
      return;
    }
    if (readOnly || !onAddPoint) {
      onSelectMark(null);
      return;
    }
    if (!p) return;
    const n = toNormalized(p.x, p.y);
    onAddPoint(n.x, n.y, zoneAt(p.x, p.y));
  }

  /** Screen pixels → viewBox units at the current render size */
  function screenDistance(px: number): number {
    const ctm = svgRef.current?.getScreenCTM();
    return ctm ? px / ctm.a : px * scale;
  }

  function addAreaVertex(p: { x: number; y: number }) {
    const vertices = draftArea ?? [];
    if (vertices.length >= MIN_AREA_VERTICES) {
      const first = fromNormalized(...vertices[0]);
      if (Math.hypot(p.x - first.x, p.y - first.y) <= screenDistance(CLOSE_AREA_DISTANCE)) {
        finishArea(vertices);
        return;
      }
    }
    const n = toNormalized(p.x, p.y);
    const last = vertices[vertices.length - 1];
    // The clicks of a double click land on the same spot: keep one vertex
    if (last && Math.hypot((n.x - last[0]) * W, (n.y - last[1]) * H) <= screenDistance(2)) return;
    setDraftArea([...vertices, [n.x, n.y]]);
  }

  function finishArea(vertices = draftArea) {
    if (!vertices || vertices.length < MIN_AREA_VERTICES || !onAddArea) return;
    const [cx, cy] = polygonCentroid(vertices);
    const at = fromNormalized(cx, cy);
    onAddArea(vertices, cx, cy, zoneAt(at.x, at.y));
    setDraftArea(null);
  }

  /** End of a line from `from` towards `to`: on the axis it is close to, unless drawn free */
  function snapLineEnd(from: { x: number; y: number }, to: { x: number; y: number }, free: boolean): { x: number; y: number; axis: 'vertical' | 'horizontal' | null } {
    if (free) return { ...to, axis: null };
    const angle = Math.abs((Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI);
    if (Math.min(angle, 180 - angle) <= LINE_SNAP_DEGREES) return { x: to.x, y: from.y, axis: 'horizontal' };
    if (Math.abs(angle - 90) <= LINE_SNAP_DEGREES) return { x: from.x, y: to.y, axis: 'vertical' };
    return { ...to, axis: null };
  }

  /** The first click starts the line, the second one ends it */
  function addLineEnd(p: { x: number; y: number }, free: boolean) {
    const start = draftArea?.[0];
    if (!start) {
      const n = toNormalized(p.x, p.y);
      setDraftArea([[n.x, n.y]]);
      return;
    }
    const from = fromNormalized(...start);
    const end = snapLineEnd(from, p, free);
    if (!onAddLine || Math.hypot(end.x - from.x, end.y - from.y) < screenDistance(MIN_LINE_LENGTH)) return;
    const n = toNormalized(end.x, end.y);
    const mid = { x: (from.x + end.x) / 2, y: (from.y + end.y) / 2 };
    const m = toNormalized(mid.x, mid.y);
    onAddLine([start, [n.x, n.y]], m.x, m.y, zoneAt(mid.x, mid.y));
    setDraftArea(null);
  }

  // Enter closes the area being drawn, Escape drops it, Backspace removes its last vertex
  const finishAreaRef = React.useRef(finishArea);
  React.useEffect(() => { finishAreaRef.current = finishArea; });
  React.useEffect(() => {
    if (!isDrafting) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable]')) return;
      if (e.key === 'Enter') { e.preventDefault(); finishAreaRef.current(); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setDraftArea(null); }
      else if (e.key === 'Backspace') { e.preventDefault(); setDraftArea((v) => (v && v.length > 1 ? v.slice(0, -1) : null)); }
    };
    // Capture: Escape must not close the sheet while an area is being drawn
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [isDrafting]);

  function handleMarkPointerDown(e: React.PointerEvent, mark: AestheticMark) {
    // While an area is drawn the clicks go to the map, even over other marks
    if (isDrafting) return;
    e.stopPropagation();
    if (readOnly || !onMoveMark) return;
    const p = toSvgPoint(e.clientX, e.clientY);
    if (!p) return;
    svgRef.current?.setPointerCapture(e.pointerId);
    // A point follows the pointer; an area or a line moves by the pointer's offset
    const at = mark.kind === 'point' ? fromNormalized(mark.x, mark.y) : p;
    setDrag({ id: mark.id, kind: mark.kind, startX: p.x, startY: p.y, x: at.x, y: at.y, moved: false });
  }

  /** Mark moved by (dx, dy), normalized; areas and lines stay inside the template */
  function translated(mark: AestheticMark, dx: number, dy: number): Pick<AestheticMark, 'x' | 'y' | 'polygon'> & { at: { x: number; y: number } } {
    if (mark.kind === 'point' || !mark.polygon) {
      const x = Math.min(1, Math.max(0, mark.x + dx));
      const y = Math.min(1, Math.max(0, mark.y + dy));
      return { x, y, at: fromNormalized(x, y) };
    }
    const xs = mark.polygon.map((v) => v[0]);
    const ys = mark.polygon.map((v) => v[1]);
    const cdx = Math.min(1 - Math.max(...xs), Math.max(-Math.min(...xs), dx));
    const cdy = Math.min(1 - Math.max(...ys), Math.max(-Math.min(...ys), dy));
    const polygon = mark.polygon.map(([x, y]) => [x + cdx, y + cdy] as [number, number]);
    const x = mark.x + cdx;
    const y = mark.y + cdy;
    return { x, y, polygon, at: fromNormalized(x, y) };
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
    if ((drawingArea || drawingLine) && draftArea?.length) {
      const p = toSvgPoint(e.clientX, e.clientY);
      if (p) setCursor({ ...p, free: e.shiftKey });
    }
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
    const placed = marks.find((m) => m.mark.id === drag.id);
    if (drag.moved && placed) {
      const { at, ...position } = drag.kind === 'point'
        ? translated(placed.mark, (drag.x - X) / W - placed.mark.x, (drag.y - Y) / H - placed.mark.y)
        : translated(placed.mark, (drag.x - drag.startX) / W, (drag.y - drag.startY) / H);
      onMoveMark?.(drag.id, position, zoneAt(at.x, at.y));
    } else {
      onSelectMark(drag.id);
    }
    setDrag(null);
  }

  function handleMarkKeyDown(e: React.KeyboardEvent, mark: AestheticMark) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelectMark(mark.id);
      return;
    }
    if (readOnly) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && onDeleteMark) {
      e.preventDefault();
      onDeleteMark(mark.id);
      return;
    }
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-KEYBOARD_STEP, 0],
      ArrowRight: [KEYBOARD_STEP, 0],
      ArrowUp: [0, -KEYBOARD_STEP * (W / H)],
      ArrowDown: [0, KEYBOARD_STEP * (W / H)],
    };
    const step = delta[e.key];
    if (!step || !onMoveMark) return;
    e.preventDefault();
    const { at, ...position } = translated(mark, step[0], step[1]);
    onMoveMark(mark.id, position, zoneAt(at.x, at.y));
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
  const lineStart = drawingLine && draftArea?.[0];
  const lineAxis = lineStart && cursor ? snapLineEnd(fromNormalized(...lineStart), cursor, cursor.free).axis : null;
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
          'h-auto max-h-[var(--aes-map-max-h,none)] w-full touch-none select-none rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring',
          adjusting ? 'cursor-move' : !readOnly && 'cursor-crosshair',
        )}
        onClick={handleBackgroundClick}
        onDoubleClick={() => drawingArea && finishArea()}
        onPointerLeave={() => setCursor(null)}
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

        {/* Marks: areas first, then lines, so the points stay clickable on top of them */}
        <g pointerEvents={adjusting ? 'none' : undefined} opacity={adjusting ? 0.5 : undefined}>
          {[...viewMarks].sort((a, b) => KIND_ORDER[a.mark.kind] - KIND_ORDER[b.mark.kind]).map(({ mark, layer, color, number }) => {
            const isDragging = drag?.id === mark.id;
            const isSelected = selectedMarkId === mark.id;
            const isInvalid = invalidMarkIds?.has(mark.id) ?? false;
            const label = t('map.pointLabel', {
              number,
              product: layerTitle(layer) || t('point.noProduct'),
              zone: mark.zone ? zoneLabel(mark.zone) : t('zones.none'),
            });
            let at = fromNormalized(mark.x, mark.y);
            let offset: { x: number; y: number } | null = null;
            if (isDragging) {
              if (drag.kind === 'point') at = { x: drag.x, y: drag.y };
              else offset = { x: drag.x - drag.startX, y: drag.y - drag.startY };
            }
            return (
              <g
                key={mark.id}
                data-point-id={mark.id}
                role="button"
                tabIndex={isDrafting ? -1 : 0}
                aria-label={label}
                aria-pressed={isSelected}
                transform={offset ? `translate(${offset.x} ${offset.y})` : undefined}
                onPointerDown={(e) => handleMarkPointerDown(e, mark)}
                onClick={(e) => {
                  if (isDrafting) return;
                  e.stopPropagation();
                  if (readOnly || !onMoveMark) onSelectMark(mark.id);
                }}
                onKeyDown={(e) => handleMarkKeyDown(e, mark)}
                className={cn(
                  'outline-none [&:focus-visible>.mark-ring]:stroke-ring',
                  isDrafting ? 'pointer-events-none' : !readOnly ? 'cursor-grab' : 'cursor-pointer',
                  isDragging && 'cursor-grabbing',
                )}
              >
                <title>{label}</title>
                {mark.kind === 'area' && mark.polygon ? (
                  <>
                    <polygon
                      points={mark.polygon.map(([x, y]) => { const v = fromNormalized(x, y); return `${v.x},${v.y}`; }).join(' ')}
                      fill={color}
                      fillOpacity={isSelected ? 0.4 : 0.25}
                      stroke={isInvalid || isSelected ? undefined : color}
                      className={cn('mark-ring', isInvalid ? 'stroke-destructive' : isSelected && 'stroke-amber-500')}
                      strokeWidth={isSelected || isInvalid ? 2.5 : 1.5}
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                    />
                    <circle cx={at.x} cy={at.y} r={r * 0.85} fill={color} className="stroke-white" strokeWidth={1.5 * scale} />
                    <text x={at.x} y={at.y} dy="0.35em" textAnchor="middle" fontSize={6.5 * scale} className="fill-white font-semibold" pointerEvents="none">
                      {number}
                    </text>
                  </>
                ) : mark.kind === 'line' && mark.polygon?.length === 2 ? (
                  <LineMark
                    ends={mark.polygon.map(([x, y]) => fromNormalized(x, y))}
                    at={at}
                    color={color}
                    number={number}
                    scale={scale}
                    ringClassName={isInvalid ? 'stroke-destructive/40' : isSelected ? 'stroke-amber-400/50' : 'stroke-transparent'}
                  />
                ) : (
                  <>
                    <circle
                      cx={at.x}
                      cy={at.y}
                      r={r + 4 * scale}
                      className={cn(
                        'mark-ring',
                        isInvalid ? 'fill-destructive/20 stroke-destructive' : isSelected ? 'fill-amber-400/25 stroke-amber-500' : 'fill-transparent stroke-transparent',
                      )}
                      strokeWidth={(isInvalid ? 2 : 1.5) * scale}
                    />
                    <circle cx={at.x} cy={at.y} r={r} fill={color} className="stroke-white" strokeWidth={1.5 * scale} />
                    <text x={at.x} y={at.y} dy="0.35em" textAnchor="middle" fontSize={7 * scale} className="fill-white font-semibold" pointerEvents="none">
                      {number}
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </g>

        {/* Line being drawn: its start, the line to the pointer and, when it snapped, the axis across the template */}
        {draftArea && draftArea.length > 0 && drawingLine && (() => {
          const start = fromNormalized(...draftArea[0]);
          const stroke = toolColor ?? 'currentColor';
          const end = cursor && snapLineEnd(start, cursor, cursor.free);
          return (
            <g pointerEvents="none">
              {end?.axis && (
                <line
                  x1={end.axis === 'horizontal' ? X : start.x}
                  y1={end.axis === 'horizontal' ? start.y : Y}
                  x2={end.axis === 'horizontal' ? X + W : start.x}
                  y2={end.axis === 'horizontal' ? start.y : Y + H}
                  stroke={stroke}
                  strokeOpacity={0.4}
                  strokeWidth={1}
                  strokeDasharray="2 4"
                  vectorEffect="non-scaling-stroke"
                />
              )}
              {end && <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={stroke} strokeOpacity={0.75} strokeWidth={LINE_MARK_WIDTH * scale} strokeLinecap="round" />}
              <circle cx={start.x} cy={start.y} r={3 * scale} fill="white" stroke={stroke} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
            </g>
          );
        })()}

        {/* Area being drawn: its edges, the edge to the pointer and the vertices (the first one closes it) */}
        {draftArea && draftArea.length > 0 && !drawingLine && (() => {
          const vertices = draftArea.map(([x, y]) => fromNormalized(x, y));
          const stroke = toolColor ?? 'currentColor';
          const canClose = vertices.length >= MIN_AREA_VERTICES;
          const last = vertices[vertices.length - 1];
          return (
            <g pointerEvents="none">
              {canClose && <polygon points={vertices.map((v) => `${v.x},${v.y}`).join(' ')} fill={stroke} fillOpacity={0.15} stroke="none" />}
              <polyline points={vertices.map((v) => `${v.x},${v.y}`).join(' ')} fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              {cursor && <line x1={last.x} y1={last.y} x2={cursor.x} y2={cursor.y} stroke={stroke} strokeWidth={1.5} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />}
              {vertices.map((v, i) => (
                <circle key={i} cx={v.x} cy={v.y} r={(i === 0 && canClose ? 4.5 : 3) * scale} fill={i === 0 && canClose ? stroke : 'white'} stroke={stroke} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
              ))}
            </g>
          );
        })()}
      </svg>
      {draftArea && draftArea.length > 0 && drawingLine ? (
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs" aria-live="polite">
          <span className="text-muted-foreground">{lineAxis ? t('map.line.snapped', { axis: lineAxis }) : t('map.line.drawing')}</span>
          <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setDraftArea(null)}>{t('map.area.cancel')}</Button>
        </div>
      ) : draftArea && draftArea.length > 0 ? (
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs" aria-live="polite">
          <span className="text-muted-foreground">{t('map.area.drawing', { count: draftArea.length })}</span>
          <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setDraftArea(null)}>{t('map.area.cancel')}</Button>
          <Button type="button" size="sm" className="h-7 px-2 text-xs" disabled={draftArea.length < MIN_AREA_VERTICES} onClick={() => finishArea()}>
            {t('map.area.finish')}
          </Button>
        </div>
      ) : (
        // Name of the zone under the pointer: the panels are small and the title tooltip is slow
        <p className="min-h-4 truncate text-center text-xs font-medium text-muted-foreground" aria-live="polite">
          {caption ? zoneLabel(caption) : '\u00a0'}
        </p>
      )}
    </div>
  );
}

const LINE_MARK_WIDTH = 3.5;

/** A line mark (a thread): the stroke with its ends and its number at the midpoint */
function LineMark({ ends: [a, b], at, color, number, scale, ringClassName }: {
  ends: { x: number; y: number }[];
  at: { x: number; y: number };
  color: string;
  number: number;
  scale: number;
  ringClassName: string;
}) {
  return (
    <>
      {/* Wide transparent stroke: a thin line is hard to grab */}
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={14 * scale} strokeLinecap="round" />
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={cn('mark-ring', ringClassName)} strokeWidth={9 * scale} strokeLinecap="round" />
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={LINE_MARK_WIDTH * scale} strokeLinecap="round" />
      {[a, b].map((v, i) => <circle key={i} cx={v.x} cy={v.y} r={2.5 * scale} fill="white" stroke={color} strokeWidth={1.5 * scale} />)}
      <circle cx={at.x} cy={at.y} r={POINT_RADIUS * 0.85 * scale} fill={color} className="stroke-white" strokeWidth={1.5 * scale} />
      <text x={at.x} y={at.y} dy="0.35em" textAnchor="middle" fontSize={6.5 * scale} className="fill-white font-semibold" pointerEvents="none">
        {number}
      </text>
    </>
  );
}
