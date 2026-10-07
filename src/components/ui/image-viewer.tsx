'use client';

import React from 'react';
import { AlertCircle, Download, FileText, Loader2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import { cn } from '@/lib/utils';

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
}

export function ZoomPanImage({ src, alt = '', className }: ZoomPanImageProps) {
  const t = useTranslations('FileViewer');
  const [zoom, setZoom] = React.useState(1);
  const [position, setPosition] = React.useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = React.useState(false);
  // El arrastre en curso vive en refs: un pointermove que llega antes del re-render no se pierde.
  const draggingRef = React.useRef(false);
  const dragStart = React.useRef({ x: 0, y: 0 });
  const areaRef = React.useRef<HTMLDivElement>(null);

  // La rueda se registra a mano y no con onWheel: React la agrega como listener
  // pasivo y ahí preventDefault() no hace nada, así que la rueda además movía la página.
  React.useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      setZoom((prev) => clampZoom(prev * factor));
    };
    area.addEventListener('wheel', onWheel, { passive: false });
    return () => area.removeEventListener('wheel', onWheel);
  }, []);

  // Eventos de puntero (mouse, lápiz o dedo): el arrastre también funciona en tablets.
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    // Con la captura el arrastre sigue aunque el puntero salga del área. Si no se puede
    // capturar, el arrastre funciona igual mientras el puntero esté adentro.
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* sin captura */ }
    draggingRef.current = true;
    setIsDragging(true);
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    setPosition({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
  };

  const stopDragging = () => {
    draggingRef.current = false;
    setIsDragging(false);
  };

  const zoomIn = () => setZoom((prev) => clampZoom(prev + ZOOM_STEP));
  const zoomOut = () => setZoom((prev) => clampZoom(prev - ZOOM_STEP));
  const reset = () => { setZoom(1); setPosition({ x: 0, y: 0 }); };

  return (
    <div className={cn('flex flex-col h-full w-full min-h-0', className)}>
      {/* Pan/zoom area */}
      <div
        ref={areaRef}
        className={cn(
          'flex-1 w-full overflow-hidden flex items-center justify-center bg-black/80 touch-none',
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
          src={src}
          alt={alt}
          className="max-w-full max-h-full object-contain transform-gpu select-none"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
          }}
          draggable={false}
        />
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
