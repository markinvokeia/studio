'use client';

import React from 'react';

import { cn } from '@/lib/utils';

/** Points as fractions of the pad's width, on both axes, so resizing it never distorts the strokes */
type Stroke = [number, number][];

interface SignaturePadProps {
  /** The drawn signature as a PNG, or `null` when the pad is empty */
  onChange: (file: File | null) => void;
  /** Bump to clear the pad */
  resetKey?: number;
  placeholder: string;
  label: string;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
}

const EXPORT_WIDTH = 900;
const EXPORT_HEIGHT = 300;
const EXPORT_MARGIN = 24;
/** A small signature is enlarged at most this much relative to the pad */
const EXPORT_MAX_ZOOM = 2;

/** Inline pad: signed with the finger, a stylus or the mouse, right on the consent step */
export function SignaturePad({ onChange, resetKey = 0, placeholder, label, invalid, disabled, className }: SignaturePadProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const strokesRef = React.useRef<Stroke[]>([]);
  const currentRef = React.useRef<Stroke | null>(null);
  const [empty, setEmpty] = React.useState(true);

  const draw = React.useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = '#1E1A33';
    ctx.lineWidth = Math.max(2, width / 320);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const stroke of strokesRef.current) {
      ctx.beginPath();
      stroke.forEach(([x, y], i) => (i ? ctx.lineTo(x * width, y * width) : ctx.moveTo(x * width, y * width)));
      if (stroke.length === 1) ctx.lineTo(stroke[0][0] * width + 0.5, stroke[0][1] * width);
      ctx.stroke();
    }
  }, []);

  // The buffer follows the CSS size (and the pixel ratio) so the stroke stays sharp
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      draw();
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [draw]);

  React.useEffect(() => {
    strokesRef.current = [];
    setEmpty(true);
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a new reset key clears it
  }, [resetKey]);

  function point(e: React.PointerEvent<HTMLCanvasElement>): [number, number] {
    const rect = e.currentTarget.getBoundingClientRect();
    return [(e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.width];
  }

  function exportFile() {
    const out = document.createElement('canvas');
    out.width = EXPORT_WIDTH;
    out.height = EXPORT_HEIGHT;
    const ctx = out.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.strokeStyle = '#1E1A33';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // Whatever the pad's size, the image has one format: the strokes fitted and centered, undistorted
    const points = strokesRef.current.flat();
    const minX = Math.min(...points.map(([x]) => x));
    const maxX = Math.max(...points.map(([x]) => x));
    const minY = Math.min(...points.map(([, y]) => y));
    const maxY = Math.max(...points.map(([, y]) => y));
    const scale = Math.min(
      EXPORT_WIDTH * EXPORT_MAX_ZOOM,
      (EXPORT_WIDTH - 2 * EXPORT_MARGIN) / Math.max(maxX - minX, 1e-6),
      (EXPORT_HEIGHT - 2 * EXPORT_MARGIN) / Math.max(maxY - minY, 1e-6),
    );
    const toX = (x: number) => (EXPORT_WIDTH - (maxX - minX) * scale) / 2 + (x - minX) * scale;
    const toY = (y: number) => (EXPORT_HEIGHT - (maxY - minY) * scale) / 2 + (y - minY) * scale;
    for (const stroke of strokesRef.current) {
      ctx.beginPath();
      stroke.forEach(([x, y], i) => (i ? ctx.lineTo(toX(x), toY(y)) : ctx.moveTo(toX(x), toY(y))));
      if (stroke.length === 1) ctx.lineTo(toX(stroke[0][0]) + 0.5, toY(stroke[0][1]));
      ctx.stroke();
    }
    out.toBlob((blob) => {
      if (blob) onChange(new File([blob], 'signature.png', { type: 'image/png' }));
    }, 'image/png');
  }

  return (
    <div
      className={cn(
        'relative h-36 touch-none rounded-xl border-[1.5px] border-dashed bg-muted/40',
        invalid ? 'border-destructive bg-destructive/5' : 'border-border',
        disabled && 'pointer-events-none opacity-60',
        className,
      )}
    >
      <span className="pointer-events-none absolute inset-x-4 bottom-7 border-b border-border" aria-hidden />
      <canvas
        ref={canvasRef}
        aria-label={label}
        role="img"
        className="absolute inset-0 h-full w-full cursor-crosshair rounded-xl"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          currentRef.current = [point(e)];
          strokesRef.current.push(currentRef.current);
          setEmpty(false);
          draw();
        }}
        onPointerMove={(e) => {
          if (!currentRef.current) return;
          currentRef.current.push(point(e));
          draw();
        }}
        onPointerUp={() => {
          if (!currentRef.current) return;
          currentRef.current = null;
          exportFile();
        }}
      />
      {empty && <span className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-muted-foreground">{placeholder}</span>}
    </div>
  );
}
