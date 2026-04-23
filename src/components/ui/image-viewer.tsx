'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── ZoomPanImage ───────────────────────────────────────────────────────────────

interface ZoomPanImageProps {
  src: string;
  alt?: string;
  className?: string;
}

export function ZoomPanImage({ src, alt = '', className }: ZoomPanImageProps) {
  const [zoom, setZoom] = React.useState(1);
  const [position, setPosition] = React.useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    e.preventDefault();
    setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom((prev) => Math.max(0.1, Math.min(prev * factor, 10)));
  };

  const zoomIn  = () => setZoom((prev) => Math.min(prev + 0.25, 10));
  const zoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.1));
  const reset   = () => { setZoom(1); setPosition({ x: 0, y: 0 }); };

  return (
    <div className={cn('flex flex-col h-full w-full min-h-0', className)}>
      {/* Pan/zoom area */}
      <div
        className={cn(
          'flex-1 w-full overflow-hidden flex items-center justify-center bg-black/80',
          isDragging ? 'cursor-grabbing' : 'cursor-grab',
        )}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
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
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={zoomOut} title="Alejar">
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <span className="text-xs font-medium w-12 text-center tabular-nums select-none">
          {(zoom * 100).toFixed(0)}%
        </span>
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={zoomIn} title="Acercar">
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={reset} title="Restablecer">
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ── ImageLightbox ──────────────────────────────────────────────────────────────

interface ImageLightboxProps {
  src: string;
  alt?: string;
  open: boolean;
  onClose: () => void;
}

export function ImageLightbox({ src, alt = '', open, onClose }: ImageLightboxProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        maxWidth="full"
        className="w-[95vw] h-[90vh] p-0 flex flex-col gap-0 overflow-hidden"
        showMaximize
      >
        {/* Accessible title (visually present in header bar) */}
        <DialogTitle className="sr-only">{alt || 'Adjunto'}</DialogTitle>

        {/* Header bar */}
        <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-2.5 border-b bg-background">
          <span className="text-sm font-medium text-foreground truncate" aria-hidden>
            {alt || 'Adjunto'}
          </span>
          {/* Visible close button — overrides the dialog's faint control */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="shrink-0 flex items-center justify-center h-7 w-7 rounded-md bg-muted hover:bg-destructive hover:text-destructive-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Viewer */}
        <div className="flex-1 min-h-0">
          <ZoomPanImage src={src} alt={alt} className="h-full" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
