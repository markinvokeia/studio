'use client';

import React from 'react';
import { AlertCircle, Download, FileText, Loader2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import { cn } from '@/lib/utils';
import type { NormalizedBox } from '@/lib/types';

/**
 * Visor de archivos compartido: imágenes con zoom y arrastre, PDF dentro del
 * visor y, para el resto, un botón de descarga. Lo usan el odontograma
 * (`ImageLightbox`) y los adjuntos de las órdenes de estudio (`FileViewerDialog`).
 */

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 10;
const ZOOM_STEP = 0.25;

const clampZoom = (value: number) => Math.max(MIN_ZOOM, Math.min(value, MAX_ZOOM));

export type FileViewerKind = 'image' | 'pdf' | 'other';

/** Qué puede mostrar el visor según el tipo MIME o, si no viene, la extensión. */
export function getFileViewerKind(name?: string | null, mimeType?: string | null): FileViewerKind {
  const mime = (mimeType ?? '').toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime === 'application/pdf') return 'pdf';
  const fileName = (name ?? '').toLowerCase();
  if (/\.(jpe?g|png|gif|webp|bmp)$/.test(fileName)) return 'image';
  if (/\.pdf$/.test(fileName)) return 'pdf';
  return 'other';
}

// ── ZoomPanImage ───────────────────────────────────────────────────────────────

interface ZoomPanImageProps {
  src: string;
  alt?: string;
  className?: string;
  /**
   * Zona a señalar (0 a 1000 sobre la imagen): se dibuja encima, se oscurece el resto y se hace
   * zoom hasta ella. Es aproximada, así que se agranda un poco para no cortar el dato.
   */
  highlight?: NormalizedBox | null;
  /** Cambia cada vez que se pide ir a la zona, aunque sea la misma (vuelve a centrarla). */
  highlightKey?: string | number;
  /**
   * Algo para mostrar pegado a la zona (arriba, o abajo si arriba no entra), a tamaño normal
   * aunque la imagen tenga zoom. Se puede tocar sin arrastrar la imagen.
   */
  highlightContent?: React.ReactNode;
}

/** Ancho de lo que va pegado a la zona, y lo que se deja libre alrededor dentro del área. */
const HIGHLIGHT_CONTENT_WIDTH = 256;
const HIGHLIGHT_CONTENT_GAP = 8;
/** Alto supuesto hasta medirlo (el contenido puede crecer: un campo para corregir, una nota). */
const HIGHLIGHT_CONTENT_DEFAULT_HEIGHT = 130;

/** Margen alrededor de la zona señalada (en milésimas): la ubicación del modelo es aproximada. */
const HIGHLIGHT_PAD = 30;
const HIGHLIGHT_MIN = 60;

/** La zona con margen y un tamaño mínimo, dentro de la imagen. */
function padBox(box: NormalizedBox): NormalizedBox {
  const grow = (a: number, b: number) => {
    const half = Math.max((b - a) / 2 + HIGHLIGHT_PAD, HIGHLIGHT_MIN / 2);
    const center = (a + b) / 2;
    return [Math.max(0, center - half), Math.min(1000, center + half)] as const;
  };
  const [top, bottom] = grow(box.top, box.bottom);
  const [left, right] = grow(box.left, box.right);
  return { top, left, bottom, right };
}

export function ZoomPanImage({ src, alt = '', className, highlight = null, highlightKey, highlightContent }: ZoomPanImageProps) {
  const t = useTranslations('FileViewer');
  const [zoom, setZoom] = React.useState(1);
  const [position, setPosition] = React.useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = React.useState(false);
  // El arrastre en curso vive en refs: un pointermove que llega antes del re-render no se pierde.
  const draggingRef = React.useRef(false);
  const dragStart = React.useRef({ x: 0, y: 0 });
  /** Dedos apoyados (celular/tablet): con dos se hace zoom pellizcando en vez de arrastrar. */
  const pointers = React.useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = React.useRef<{ distance: number; zoom: number } | null>(null);
  const areaRef = React.useRef<HTMLDivElement>(null);
  const imgRef = React.useRef<HTMLImageElement>(null);
  /** Caja de la imagen sin transformar (dentro del área): el resaltado se dibuja sobre ella. */
  const [frame, setFrame] = React.useState<{ left: number; top: number; width: number; height: number } | null>(null);
  /** Tamaño del área visible: para que lo pegado a la zona no se salga. */
  const [areaSize, setAreaSize] = React.useState<{ width: number; height: number } | null>(null);
  /** Lo pegado a la zona: se mide para decidir si entra arriba o va abajo. */
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const [contentHeight, setContentHeight] = React.useState(HIGHLIGHT_CONTENT_DEFAULT_HEIGHT);
  const contentObserver = React.useRef<ResizeObserver | null>(null);
  const setContentNode = React.useCallback((node: HTMLDivElement | null) => {
    contentObserver.current?.disconnect();
    contentObserver.current = null;
    contentRef.current = node;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setContentHeight(node.offsetHeight));
    observer.observe(node);
    contentObserver.current = observer;
  }, []);
  const zone = React.useMemo(() => (highlight ? padBox(highlight) : null), [highlight]);

  const measure = React.useCallback(() => {
    const img = imgRef.current;
    const area = areaRef.current;
    if (area) setAreaSize({ width: area.clientWidth, height: area.clientHeight });
    if (!img || !img.offsetWidth) return;
    setFrame({ left: img.offsetLeft, top: img.offsetTop, width: img.offsetWidth, height: img.offsetHeight });
  }, []);

  React.useEffect(() => {
    const img = imgRef.current;
    const area = areaRef.current;
    if (!img || !area || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(img);
    observer.observe(area);
    return () => observer.disconnect();
  }, [measure]);

  // Ir a la zona: zoom para que ocupe más o menos la mitad del área, y centrada.
  React.useEffect(() => {
    const area = areaRef.current;
    if (!zone || !frame || !area) return;
    const boxW = ((zone.right - zone.left) / 1000) * frame.width;
    const boxH = ((zone.bottom - zone.top) / 1000) * frame.height;
    const next = Math.max(1, Math.min(6, (area.clientWidth * 0.55) / boxW, (area.clientHeight * 0.55) / boxH));
    // El zoom es desde el centro de la imagen: se corre la imagen para que el centro de la zona
    // quede en el centro del área.
    const dx = ((zone.left + zone.right) / 2000 - 0.5) * frame.width;
    const dy = ((zone.top + zone.bottom) / 2000 - 0.5) * frame.height;
    setZoom(next);
    setPosition({ x: -dx * next, y: -dy * next });
    // `frame` no va: ajustar la ventana no tiene que volver a mover lo que la persona movió.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone, highlightKey, frame !== null]);

  // La rueda se registra a mano y no con onWheel: React la agrega como listener
  // pasivo y ahí preventDefault() no hace nada, así que la rueda además movía la página.
  React.useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    const onWheel = (e: WheelEvent) => {
      // Sobre lo pegado a la zona la rueda lo desplaza a él (si es alto), no hace zoom.
      if (contentRef.current?.contains(e.target as Node)) return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      setZoom((prev) => clampZoom(prev * factor));
    };
    area.addEventListener('wheel', onWheel, { passive: false });
    return () => area.removeEventListener('wheel', onWheel);
  }, []);

  // Eventos de puntero (mouse, lápiz o dedo): el arrastre también funciona en tablets.
  const pinchDistance = () => {
    const [a, b] = Array.from(pointers.current.values());
    return Math.hypot(a.x - b.x, a.y - b.y) || 1;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    // Con la captura el arrastre sigue aunque el puntero salga del área. Si no se puede
    // capturar, el arrastre funciona igual mientras el puntero esté adentro.
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* sin captura */ }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      // Segundo dedo: deja de arrastrar y empieza el pellizco.
      draggingRef.current = false;
      pinchStart.current = { distance: pinchDistance(), zoom };
      return;
    }
    draggingRef.current = true;
    setIsDragging(true);
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinchStart.current && pointers.current.size === 2) {
      setZoom(clampZoom(pinchStart.current.zoom * (pinchDistance() / pinchStart.current.distance)));
      return;
    }
    if (!draggingRef.current) return;
    setPosition({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
  };

  const stopDragging = (e: React.PointerEvent<HTMLDivElement>) => {
    // Al soltar un dedo del pellizco no se sigue arrastrando con el otro (evita un salto):
    // el pellizco termina recién cuando no queda ninguno.
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) pinchStart.current = null;
    draggingRef.current = false;
    setIsDragging(false);
  };

  const zoomIn = () => setZoom((prev) => clampZoom(prev + ZOOM_STEP));
  const zoomOut = () => setZoom((prev) => clampZoom(prev - ZOOM_STEP));
  const reset = () => { setZoom(1); setPosition({ x: 0, y: 0 }); };

  // Dónde queda la zona en pantalla. La imagen escala desde su centro y después se corre.
  let contentStyle: React.CSSProperties | null = null;
  if (zone && frame && areaSize && highlightContent) {
    const toX = (v: number) => frame.left + frame.width / 2 + position.x + (v / 1000 - 0.5) * frame.width * zoom;
    const toY = (v: number) => frame.top + frame.height / 2 + position.y + (v / 1000 - 0.5) * frame.height * zoom;
    const width = Math.min(HIGHLIGHT_CONTENT_WIDTH, areaSize.width - HIGHLIGHT_CONTENT_GAP * 2);
    const left = Math.max(HIGHLIGHT_CONTENT_GAP, Math.min(toX(zone.left), areaSize.width - width - HIGHLIGHT_CONTENT_GAP));
    const top = toY(zone.top);
    const bottom = toY(zone.bottom);
    const gap = HIGHLIGHT_CONTENT_GAP;
    // Arriba si entra, o si arriba hay más lugar que abajo. Si no entra en ningún lado se pega al
    // borde (y puede tapar parte de la zona) antes que salirse del área.
    const roomAbove = top - gap * 2;
    const roomBelow = areaSize.height - bottom - gap * 2;
    const above = roomAbove >= contentHeight || roomAbove >= roomBelow;
    contentStyle = {
      left,
      width,
      top: above
        ? Math.max(gap, top - gap - contentHeight)
        : Math.min(bottom + gap, Math.max(gap, areaSize.height - gap - contentHeight)),
      maxHeight: areaSize.height - gap * 2,
      overflowY: 'auto',
      transition: isDragging ? 'none' : 'left 0.1s ease-out, top 0.1s ease-out',
    };
  }

  return (
    <div className={cn('flex flex-col h-full w-full min-h-0', className)}>
      {/* Pan/zoom area */}
      <div
        ref={areaRef}
        className={cn(
          'relative flex-1 w-full overflow-hidden flex items-center justify-center bg-black/80 touch-none',
          isDragging ? 'cursor-grabbing' : 'cursor-grab',
        )}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
        onPointerLeave={stopDragging}
        onDoubleClick={reset}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          className="max-w-full max-h-full object-contain transform-gpu select-none"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
          }}
          draggable={false}
          onLoad={measure}
        />
        {/* La zona va en una capa con la misma caja y la misma transformación que la imagen:
            acompaña el zoom y el arrastre sin cálculos. */}
        {zone && frame && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute transform-gpu"
            style={{
              left: frame.left, top: frame.top, width: frame.width, height: frame.height,
              transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
              transition: isDragging ? 'none' : 'transform 0.1s ease-out',
            }}
          >
            <div
              className="absolute rounded-sm border-amber-400"
              style={{
                top: `${zone.top / 10}%`,
                left: `${zone.left / 10}%`,
                height: `${(zone.bottom - zone.top) / 10}%`,
                width: `${(zone.right - zone.left) / 10}%`,
                borderWidth: 2 / zoom,
                boxShadow: '0 0 0 100vmax rgba(0, 0, 0, 0.45)',
              }}
            />
          </div>
        )}
        {contentStyle && (
          // Fuera de la capa con zoom (así no se agranda) y sin iniciar el arrastre de la imagen.
          <div
            ref={setContentNode}
            className="absolute z-10 cursor-auto"
            style={contentStyle}
            onPointerDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
          >
            {highlightContent}
          </div>
        )}
      </div>

      {/* Controls bar */}
      <div className="shrink-0 flex items-center justify-center gap-2 py-2 border-t bg-background">
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={zoomOut} disabled={zoom <= MIN_ZOOM}
          title={t('zoomOut')} aria-label={t('zoomOut')}>
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <span className="text-xs font-medium w-12 text-center tabular-nums select-none" aria-live="polite">
          {(zoom * 100).toFixed(0)}%
        </span>
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={zoomIn} disabled={zoom >= MAX_ZOOM}
          title={t('zoomIn')} aria-label={t('zoomIn')}>
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={reset}
          title={t('reset')} aria-label={t('reset')}>
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ── FileViewerDialog ───────────────────────────────────────────────────────────

export interface FileViewerDialogProps {
  open: boolean;
  onClose: () => void;
  /** Nombre que se muestra arriba y con el que se descarga. */
  name?: string;
  /** URL del archivo (normalmente un object URL). Nula mientras carga o si falló. */
  url: string | null;
  mimeType?: string | null;
  /** Fuerza el tipo; si no, se deduce de `mimeType` y del nombre. */
  kind?: FileViewerKind;
  isLoading?: boolean;
  /** Mensaje de error de la carga. Con `onRetry` se ofrece reintentar. */
  error?: string | null;
  onRetry?: () => void;
}

export function FileViewerDialog({
  open, onClose, name, url, mimeType, kind, isLoading = false, error = null, onRetry,
}: FileViewerDialogProps) {
  const t = useTranslations('FileViewer');
  const tCommon = useTranslations('Common');
  const title = name || t('untitled');
  const resolvedKind = kind ?? getFileViewerKind(name, mimeType);

  let body: React.ReactNode;
  if (isLoading) {
    body = (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">{t('loading')}</p>
      </div>
    );
  } else if (error || !url) {
    body = (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <AlertCircle className="h-8 w-8 text-destructive" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">{error || t('loadError')}</p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>{tCommon('retry')}</Button>
        )}
      </div>
    );
  } else if (resolvedKind === 'image') {
    // `key`: otra imagen arranca sin el zoom ni el desplazamiento de la anterior.
    body = <ZoomPanImage key={url} src={url} alt={title} className="h-full" />;
  } else if (resolvedKind === 'pdf') {
    body = <iframe src={url} title={title} className="h-full w-full border-0 bg-white" />;
  } else {
    body = (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <FileText className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">{t('noPreview')}</p>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        maxWidth="full"
        className="w-[95vw] h-[90vh] p-0 flex flex-col gap-0 overflow-hidden"
        showMaximize
        maximizeLabel={t('maximize')}
        restoreLabel={t('restore')}
      >
        <DialogDescription className="sr-only">{t('description')}</DialogDescription>

        {/* Cabecera estándar de los diálogos: sobre su fondo se ven los controles de maximizar y
            cerrar del DialogContent (sobre fondo blanco quedaban invisibles). */}
        <DialogHeader className="h-14 flex-row items-center gap-3 space-y-0 pl-4">
          <DialogTitle className="min-w-0 flex-1 truncate text-sm font-medium">{title}</DialogTitle>
          {url && !isLoading && !error && (
            <Button asChild variant="secondary" size="sm" className="h-7 shrink-0">
              {/* `download` con el nombre real: sin esto un object URL baja con su uuid por nombre. */}
              <a href={url} download={title} target="_blank" rel="noopener noreferrer">
                <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                {t('download')}
              </a>
            </Button>
          )}
        </DialogHeader>

        <div className="flex-1 min-h-0">{body}</div>
      </DialogContent>
    </Dialog>
  );
}

// ── ImageLightbox ──────────────────────────────────────────────────────────────

interface ImageLightboxProps {
  src: string;
  alt?: string;
  open: boolean;
  onClose: () => void;
}

/** Atajo para una imagen ya cargada (odontograma). */
export function ImageLightbox({ src, alt = '', open, onClose }: ImageLightboxProps) {
  return <FileViewerDialog open={open} onClose={onClose} name={alt} url={src} kind="image" />;
}
