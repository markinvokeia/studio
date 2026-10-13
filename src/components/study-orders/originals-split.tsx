'use client';

import * as React from 'react';
import { Group, Panel, Separator, useDefaultLayout, usePanelRef, type Layout, type PanelSize } from 'react-resizable-panels';
import { Maximize2, Minimize2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';

import { cn } from '@/lib/utils';

/**
 * El contenido (formulario o lista de puntos a revisar) con los originales de la orden al lado.
 *
 * Con lugar suficiente son dos columnas con un separador que se arrastra para cambiar el ancho
 * (como en las demás pantallas de dos paneles) y el ancho elegido se recuerda. Desde el botón de
 * pantalla entera —o arrastrando el separador hasta el borde— los originales ocupan todo; el
 * contenido sigue montado debajo, así no se pierde lo que se estaba escribiendo.
 *
 * Sin lugar (celular o un panel angosto) los originales tapan el contenido y se cierran con el
 * botón de quien los muestra.
 */

export interface OriginalsSplitProps {
    children: React.ReactNode;
    /**
     * Los originales, o null si están ocultos. Recibe el botón de pantalla entera para ponerlo en
     * la cabecera del visor (null cuando no corresponde: ahí ya ocupan todo).
     */
    originals: ((maximizeButton: React.ReactNode) => React.ReactNode) | null;
    /** Nombre de los originales para lectores de pantalla. */
    label: string;
    /** Dónde se recuerda el ancho elegido. */
    storageKey: string;
    /** Los originales pasaron a ocupar todo (o volvieron a su ancho). */
    onMaximizedChange?: (maximized: boolean) => void;
    className?: string;
}

/** Por debajo de este ancho (del contenedor, no de la pantalla) no entran las dos columnas. */
const SIDE_BY_SIDE_MIN_WIDTH = 640;
const MAIN_ID = 'main';
const ORIGINALS_ID = 'originals';

/** Ancho del contenedor, medido antes de pintar para no mostrar primero el modo equivocado. */
function useIsWide(ref: React.RefObject<HTMLElement | null>): boolean | null {
    const [wide, setWide] = React.useState<boolean | null>(null);
    React.useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        const update = (width: number) => setWide(width >= SIDE_BY_SIDE_MIN_WIDTH);
        update(el.getBoundingClientRect().width);
        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (entry) update(entry.contentRect.width);
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, [ref]);
    return wide;
}

export function OriginalsSplit({ children, originals, label, storageKey, onMaximizedChange, className }: OriginalsSplitProps) {
    const t = useTranslations('FileViewer');
    const containerRef = React.useRef<HTMLDivElement>(null);
    const wide = useIsWide(containerRef);
    const mainRef = usePanelRef();
    const [maximized, setMaximized] = React.useState(false);
    const showOriginals = !!originals;

    const { defaultLayout, onLayoutChanged } = useDefaultLayout({
        id: storageKey,
        panelIds: showOriginals ? [MAIN_ID, ORIGINALS_ID] : [MAIN_ID],
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    });
    // Pantalla entera no se recuerda: al volver a abrir, el contenido tiene que estar a la vista.
    const saveLayout = React.useCallback((layout: Layout) => {
        if ((layout[MAIN_ID] ?? 0) >= 1) onLayoutChanged(layout);
    }, [onLayoutChanged]);

    const handleMainResize = React.useCallback((size: PanelSize) => {
        setMaximized(size.asPercentage < 1);
    }, []);

    // Sin originales o sin las dos columnas no hay nada maximizado.
    const isMaximized = maximized && showOriginals && !!wide;
    React.useEffect(() => { onMaximizedChange?.(isMaximized); }, [isMaximized, onMaximizedChange]);

    const toggleMaximized = () => {
        const panel = mainRef.current;
        if (!panel) return;
        if (panel.isCollapsed()) panel.expand();
        else panel.collapse();
    };

    const maximizeLabel = isMaximized ? t('restore') : t('maximize');
    const maximizeButton = (
        <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={toggleMaximized}
            aria-pressed={isMaximized}
            aria-label={maximizeLabel}
            title={maximizeLabel}
        >
            {isMaximized
                ? <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" />
                : <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />}
        </Button>
    );

    return (
        <div ref={containerRef} className={cn('relative flex min-h-0 min-w-0 flex-1 overflow-hidden', className)}>
            {wide ? (
                <Group
                    orientation="horizontal"
                    className="min-w-0 flex-1"
                    defaultLayout={defaultLayout}
                    onLayoutChanged={saveLayout}
                >
                    <Panel
                        id={MAIN_ID}
                        panelRef={mainRef}
                        defaultSize={showOriginals ? '55%' : '100%'}
                        minSize={showOriginals ? '30%' : '100%'}
                        collapsible={showOriginals}
                        collapsedSize="0%"
                        onResize={handleMainResize}
                        className="relative h-full overflow-hidden"
                    >
                        {/* Con los originales a pantalla entera queda montado pero fuera del foco. */}
                        <div className={cn('absolute inset-0 flex flex-col', isMaximized && 'invisible')}>
                            {children}
                        </div>
                    </Panel>

                    {originals && (
                        <Separator
                            aria-label={t('resizeOriginals')}
                            className="group relative z-10 flex w-2 shrink-0 cursor-col-resize items-center justify-center border-l bg-card outline-none transition-colors hover:bg-primary/5 focus-visible:bg-primary/10"
                        >
                            <div className="h-8 w-1 rounded-full bg-border transition-colors group-hover:bg-primary/30" />
                        </Separator>
                    )}

                    {originals && (
                        <Panel
                            id={ORIGINALS_ID}
                            defaultSize="45%"
                            minSize="20%"
                            className="relative h-full overflow-hidden"
                        >
                            <aside aria-label={label} className="absolute inset-0 flex flex-col bg-card">
                                {originals(maximizeButton)}
                            </aside>
                        </Panel>
                    )}
                </Group>
            ) : (
                <>
                    <div className="flex min-w-0 flex-1 flex-col">{children}</div>
                    {originals && wide === false && (
                        <aside aria-label={label} className="absolute inset-0 z-30 flex flex-col bg-card">
                            {originals(null)}
                        </aside>
                    )}
                </>
            )}
        </div>
    );
}

export default OriginalsSplit;
