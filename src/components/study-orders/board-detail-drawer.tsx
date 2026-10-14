'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

/**
 * Detalle de una orden sobre el Dashboard de Estados: entra desde la derecha y deja el tablero a la
 * vista detrás. No es modal: se puede tocar otra tarjeta para cambiar de orden sin cerrarlo.
 *
 * El ancho se ajusta arrastrando el borde izquierdo (se recuerda) y `expanded` lo lleva a todo el
 * ancho del tablero. Donde no hay lugar para el tablero al costado (celular) ocupa todo.
 */

export interface BoardDetailDrawerProps {
    open: boolean;
    /** A todo el ancho del tablero. */
    expanded: boolean;
    /** Nombre del panel para lectores de pantalla. */
    label: string;
    children: React.ReactNode;
}

const STORAGE_KEY = 'study-orders-board-drawer-width';
/** Sin un ancho elegido por la persona, abre ocupando esta parte del tablero. */
const DEFAULT_FRACTION = 0.7;
const MIN_WIDTH = 420;
/** Lo mínimo del tablero que tiene que seguir viéndose al costado al agrandar el panel. */
const BOARD_PEEK = 96;
/** Por debajo de este ancho del tablero el panel lo ocupa todo. */
const FULL_BELOW = 720;

export function BoardDetailDrawer({ open, expanded, label, children }: BoardDetailDrawerProps) {
    const t = useTranslations('StudyOrdersPage.board');
    const hostRef = React.useRef<HTMLDivElement>(null);
    const [hostWidth, setHostWidth] = React.useState(0);
    /** Ancho elegido arrastrando el borde; null = el de por defecto (proporcional al tablero). */
    const [width, setWidth] = React.useState<number | null>(null);
    const [isResizing, setIsResizing] = React.useState(false);
    /** Entra deslizándose: arranca afuera y en el cuadro siguiente pasa a su lugar. */
    const [entered, setEntered] = React.useState(false);
    const dragRef = React.useRef<{ startX: number; startWidth: number } | null>(null);

    React.useEffect(() => {
        try {
            const saved = Number(localStorage.getItem(STORAGE_KEY));
            if (saved >= MIN_WIDTH) setWidth(saved);
        } catch { /* sin storage: ancho por defecto */ }
    }, []);

    // Ancho del tablero: limita el panel y decide si ocupa todo.
    React.useLayoutEffect(() => {
        const el = hostRef.current;
        if (!el) return;
        setHostWidth(el.getBoundingClientRect().width);
        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (entry) setHostWidth(entry.contentRect.width);
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    React.useEffect(() => {
        if (!open) { setEntered(false); return; }
        const frame = requestAnimationFrame(() => setEntered(true));
        return () => cancelAnimationFrame(frame);
    }, [open]);

    const maxWidth = Math.max(MIN_WIDTH, hostWidth - BOARD_PEEK);
    const full = expanded || (hostWidth > 0 && hostWidth < FULL_BELOW);
    const appliedWidth = Math.min(Math.max(width ?? hostWidth * DEFAULT_FRACTION, MIN_WIDTH), maxWidth);

    // Arrastre del borde con eventos de puntero: mouse, lápiz o dedo.
    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.button !== 0) return;
        e.preventDefault();
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* sin captura */ }
        dragRef.current = { startX: e.clientX, startWidth: appliedWidth };
        setIsResizing(true);
    };
    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current;
        if (!drag) return;
        const next = drag.startWidth + (drag.startX - e.clientX);
        setWidth(Math.min(Math.max(next, MIN_WIDTH), maxWidth));
    };
    const onPointerUp = () => {
        if (!dragRef.current) return;
        dragRef.current = null;
        setIsResizing(false);
        try { localStorage.setItem(STORAGE_KEY, String(Math.round(appliedWidth))); } catch { /* sin storage */ }
    };
    // Con el teclado: flechas para angostar o ensanchar de a 40px.
    const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        const next = Math.min(Math.max(appliedWidth + (e.key === 'ArrowLeft' ? 40 : -40), MIN_WIDTH), maxWidth);
        setWidth(next);
        try { localStorage.setItem(STORAGE_KEY, String(Math.round(next))); } catch { /* sin storage */ }
    };

    return (
        // Capa sobre el tablero que no intercepta nada: solo el panel recibe clics.
        <div ref={hostRef} className="pointer-events-none absolute inset-0 z-40 overflow-hidden">
            {/* Velo sobre el tablero mientras el panel está abierto: lo deja atrás sin taparlo, y se
                pueden seguir tocando las tarjetas para cambiar de orden. */}
            <div
                aria-hidden="true"
                className={cn(
                    'absolute inset-0 bg-foreground/25 transition-opacity duration-200 dark:bg-black/50',
                    open && entered ? 'opacity-100' : 'opacity-0',
                )}
            />
            {open && (
                <aside
                    aria-label={label}
                    className={cn(
                        'pointer-events-auto absolute inset-y-0 right-0 flex flex-col bg-card shadow-2xl',
                        // Solo el borde izquierdo, donde está el control del ancho: la tarjeta de
                        // adentro va sin marco, así no se cruzan esquinas redondeadas y rectas.
                        !full && 'border-l',
                        'transition-[transform,width] duration-200 ease-out',
                        isResizing && 'transition-none',
                        entered ? 'translate-x-0' : 'translate-x-full',
                    )}
                    style={{ width: full ? '100%' : appliedWidth }}
                >
                    {!full && (
                        <div
                            role="separator"
                            aria-orientation="vertical"
                            aria-label={t('resizeDetail')}
                            aria-valuemin={MIN_WIDTH}
                            aria-valuemax={maxWidth}
                            aria-valuenow={Math.round(appliedWidth)}
                            tabIndex={0}
                            onPointerDown={onPointerDown}
                            onPointerMove={onPointerMove}
                            onPointerUp={onPointerUp}
                            onPointerCancel={onPointerUp}
                            onKeyDown={onKeyDown}
                            title={t('resizeDetail')}
                            className="group absolute inset-y-0 left-0 z-10 flex w-3 -translate-x-1/2 cursor-col-resize touch-none items-center justify-center outline-none"
                        >
                            <div className={cn(
                                'h-12 w-1 rounded-full bg-border transition-colors',
                                'group-hover:bg-primary/50 group-focus-visible:bg-primary',
                                isResizing && 'bg-primary',
                            )} />
                        </div>
                    )}
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
                </aside>
            )}
        </div>
    );
}

export default BoardDetailDrawer;
