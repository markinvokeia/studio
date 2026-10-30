'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogCancelButton,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

import { Eraser, Undo2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

/** Punto normalizado 0..1 — así los trazos sobreviven a un cambio de tamaño. */
interface Point { x: number; y: number }
type Stroke = Point[];

/** Lienzo de exportación. 3:1 se acerca a la caja de firma de la receta (440×128). */
const EXPORT_WIDTH = 1200;
const EXPORT_HEIGHT = 400;
/** Grosor del trazo relativo al ancho, para que se vea igual en pantalla y al exportar. */
const STROKE_RATIO = 0.0035;
const INK_COLOR = '#111827';
/** Margen que se deja alrededor del recorte, en px del lienzo de exportación. */
const TRIM_PADDING = 12;

function drawStrokes(
    ctx: CanvasRenderingContext2D,
    strokes: Stroke[],
    width: number,
    height: number,
): void {
    ctx.clearRect(0, 0, width, height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = INK_COLOR;
    ctx.lineWidth = Math.max(1.5, width * STROKE_RATIO);

    strokes.forEach((stroke) => {
        if (stroke.length === 0) return;
        ctx.beginPath();
        if (stroke.length === 1) {
            // Un toque suelto: un punto no dibuja nada con lineTo, se pinta redondo.
            const { x, y } = stroke[0];
            ctx.arc(x * width, y * height, ctx.lineWidth / 2, 0, Math.PI * 2);
            ctx.fillStyle = INK_COLOR;
            ctx.fill();
            return;
        }
        ctx.moveTo(stroke[0].x * width, stroke[0].y * height);
        stroke.slice(1).forEach((point) => ctx.lineTo(point.x * width, point.y * height));
        ctx.stroke();
    });
}

/**
 * Recorta el PNG a la caja que ocupa la tinta. Sin esto la firma sale rodeada
 * de transparencia y, al entrar en la receta con `object-fit:contain`, se ve
 * diminuta por más que la caja sea grande.
 */
function trimToInk(source: HTMLCanvasElement): HTMLCanvasElement {
    const ctx = source.getContext('2d');
    if (!ctx) return source;

    const { width, height } = source;
    const { data } = ctx.getImageData(0, 0, width, height);

    let minX = width, minY = height, maxX = -1, maxY = -1;
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            if (data[(y * width + x) * 4 + 3] === 0) continue;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }
    }

    if (maxX < 0) return source; // lienzo vacío

    minX = Math.max(0, minX - TRIM_PADDING);
    minY = Math.max(0, minY - TRIM_PADDING);
    maxX = Math.min(width - 1, maxX + TRIM_PADDING);
    maxY = Math.min(height - 1, maxY + TRIM_PADDING);

    const cropped = document.createElement('canvas');
    cropped.width = maxX - minX + 1;
    cropped.height = maxY - minY + 1;
    cropped.getContext('2d')?.drawImage(
        source,
        minX, minY, cropped.width, cropped.height,
        0, 0, cropped.width, cropped.height,
    );
    return cropped;
}

interface SignaturePadDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Recibe el PNG dibujado, con fondo transparente y recortado a la tinta. */
    onConfirm: (file: File) => void;
}

/**
 * Diálogo para trazar la firma a mano, con ratón, dedo o lápiz. Usa Pointer
 * Events, que unifican los tres, y devuelve un PNG transparente.
 */
export function SignaturePadDialog({ open, onOpenChange, onConfirm }: SignaturePadDialogProps) {
    const t = useTranslations('SignaturePad');

    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [strokes, setStrokes] = React.useState<Stroke[]>([]);
    const isDrawingRef = React.useRef(false);
    // Espejo de `strokes` para que `resizeCanvas` repinte lo actual sin
    // depender de él: si dependiera, al reabrir el diálogo repintaría el
    // estado anterior a la limpieza y el lienzo mostraría trazos fantasma.
    const strokesRef = React.useRef<Stroke[]>([]);

    const repaint = React.useCallback((nextStrokes: Stroke[]) => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        const dpr = window.devicePixelRatio || 1;
        drawStrokes(ctx, nextStrokes, canvas.width / dpr, canvas.height / dpr);
    }, []);

    // Ajusta el buffer del canvas al tamaño real en CSS (y al DPR, si no se ve
    // borroso). Como los trazos son normalizados, redibujar tras un resize los
    // conserva intactos.
    const resizeCanvas = React.useCallback(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;
        const dpr = window.devicePixelRatio || 1;
        const rect = container.getBoundingClientRect();
        if (rect.width === 0) return;
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
        const ctx = canvas.getContext('2d');
        ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
        repaint(strokesRef.current);
    }, [repaint]);

    React.useEffect(() => {
        if (!open) return;
        setStrokes([]);
        isDrawingRef.current = false;
        // El diálogo se mide después de montarse: se espera un frame.
        const frame = requestAnimationFrame(resizeCanvas);
        return () => cancelAnimationFrame(frame);
    }, [open, resizeCanvas]);

    React.useEffect(() => {
        if (!open) return;
        window.addEventListener('resize', resizeCanvas);
        return () => window.removeEventListener('resize', resizeCanvas);
    }, [open, resizeCanvas]);

    React.useEffect(() => {
        strokesRef.current = strokes;
        repaint(strokes);
    }, [repaint, strokes]);

    const pointFromEvent = (event: React.PointerEvent<HTMLCanvasElement>): Point | null => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return null;
        return {
            x: (event.clientX - rect.left) / rect.width,
            y: (event.clientY - rect.top) / rect.height,
        };
    };

    const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
        const point = pointFromEvent(event);
        if (!point) return;
        // La captura mantiene el trazo aunque el puntero salga del lienzo.
        event.currentTarget.setPointerCapture(event.pointerId);
        isDrawingRef.current = true;
        setStrokes((prev) => [...prev, [point]]);
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
        if (!isDrawingRef.current) return;
        const point = pointFromEvent(event);
        if (!point) return;
        setStrokes((prev) => {
            if (prev.length === 0) return prev;
            const next = prev.slice();
            next[next.length - 1] = [...next[next.length - 1], point];
            return next;
        });
    };

    const endStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
        if (!isDrawingRef.current) return;
        isDrawingRef.current = false;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
    };

    const handleUndo = () => setStrokes((prev) => prev.slice(0, -1));
    const handleClear = () => setStrokes([]);

    const handleConfirm = () => {
        if (strokes.length === 0) return;
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = EXPORT_WIDTH;
        exportCanvas.height = EXPORT_HEIGHT;
        const ctx = exportCanvas.getContext('2d');
        if (!ctx) return;

        drawStrokes(ctx, strokes, EXPORT_WIDTH, EXPORT_HEIGHT);

        trimToInk(exportCanvas).toBlob((blob) => {
            if (!blob) return;
            onConfirm(new File([blob], 'firma.png', { type: 'image/png' }));
            onOpenChange(false);
        }, 'image/png');
    };

    const isEmpty = strokes.length === 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent maxWidth="2xl">
                <DialogHeader>
                    <DialogTitle>{t('title')}</DialogTitle>
                    <DialogDescription>{t('description')}</DialogDescription>
                </DialogHeader>

                <div className="px-6 py-4">
                    <div
                        ref={containerRef}
                        className="relative h-52 w-full rounded-lg border-2 border-dashed bg-white sm:h-64"
                    >
                        {/* Línea de referencia, como al firmar en papel */}
                        <div className="pointer-events-none absolute inset-x-8 bottom-10 border-b border-gray-300" />
                        <canvas
                            ref={canvasRef}
                            // `touch-none` evita que el gesto de dibujar haga scroll en móvil.
                            className="absolute inset-0 h-full w-full cursor-crosshair touch-none"
                            onPointerDown={handlePointerDown}
                            onPointerMove={handlePointerMove}
                            onPointerUp={endStroke}
                            onPointerCancel={endStroke}
                        />
                        {isEmpty && (
                            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                                <span className="text-sm text-gray-400">{t('placeholder')}</span>
                            </div>
                        )}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={handleUndo} disabled={isEmpty}>
                            <Undo2 className="mr-1.5 h-3.5 w-3.5" />
                            {t('undo')}
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={handleClear} disabled={isEmpty}>
                            <Eraser className="mr-1.5 h-3.5 w-3.5" />
                            {t('clear')}
                        </Button>
                    </div>
                </div>

                <DialogFooter>
                    <DialogCancelButton variant="outline">{t('cancel')}</DialogCancelButton>
                    <Button type="button" onClick={handleConfirm} disabled={isEmpty}>
                        {t('use')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
