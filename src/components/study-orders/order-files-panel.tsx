'use client';

import * as React from 'react';
import { AlertCircle, Download, FileText, Loader2, LocateFixed } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { ZoomPanImage, getFileViewerKind } from '@/components/ui/image-viewer';

import { Thumbnail, useOrderFiles, type OrderFile, type OrderFileLoader } from './order-file-gallery';
import { ReviewFocusCard, type ReviewFocusCardProps, type ReviewFocusNavigation } from './review-focus-card';
import type { OriginalFocus } from './review-locate';

import { isAbortError } from '@/services/api';
import { cn } from '@/lib/utils';
import type { StudyOrderReviewItem } from '@/lib/types';

/**
 * Los originales de la orden, a la vista mientras se carga el formulario: el
 * archivo elegido en grande (con zoom y arrastre, o el PDF adentro) y una tira
 * de miniaturas para cambiar de archivo. Es lo que permite pasar la orden del
 * papel al sistema sin abrir y cerrar un visor por cada dato.
 *
 * Con `focus` (un punto a revisar que dice dónde se leyó el dato) abre ese archivo, va a esa página
 * del PDF o hace zoom a esa zona de la imagen. Sobre el recuadro (o arriba, si no hay recuadro)
 * muestra qué leyó el asistente, con qué confianza y las acciones para marcar el punto.
 */

export interface OrderFilesPanelProps {
    files: OrderFile[];
    loadFile: OrderFileLoader;
    focus?: OriginalFocus | null;
    /** El punto del foco con su estado actual (null si ya no está). */
    focusItem?: StudyOrderReviewItem | null;
    onClearFocus?: () => void;
    /** Después de marcar el punto desde la tarjeta del foco. */
    onFocusResolved?: (item: StudyOrderReviewItem) => void;
    /** Ir al punto anterior o al siguiente desde la tarjeta del foco. */
    focusNavigation?: ReviewFocusNavigation | null;
    /** El campo del formulario del punto, para corregirlo desde la tarjeta del foco. */
    renderFocusEditor?: ReviewFocusCardProps['renderEditor'];
    className?: string;
}

export function OrderFilesPanel({ files, loadFile, focus = null, focusItem = null, onClearFocus, onFocusResolved, focusNavigation = null, renderFocusEditor, className }: OrderFilesPanelProps) {
    const t = useTranslations('FileViewer');
    const tCommon = useTranslations('Common');
    const { urls, failed, load } = useOrderFiles(files, loadFile);

    const [selectedId, setSelectedId] = React.useState<string | null>(files[0]?.id ?? null);
    const [status, setStatus] = React.useState<'idle' | 'loading' | 'error'>('idle');
    const [retryKey, setRetryKey] = React.useState(0);

    // Ir al archivo del dato. Por `key`: tocar de nuevo el mismo punto vuelve a llevar ahí aunque
    // la persona haya cambiado de archivo.
    const focusFileId = focus?.fileId && files.some((f) => f.id === focus.fileId) ? focus.fileId : null;
    React.useEffect(() => {
        if (focusFileId) { setSelectedId(focusFileId); setRetryKey(0); }
    }, [focusFileId, focus?.key]);

    const selected = files.find((f) => f.id === selectedId) ?? files[0] ?? null;
    const url = selected ? urls[selected.id] : undefined;
    const selectedIsImage = !!selected && getFileViewerKind(selected.name, selected.mimeType) === 'image';

    // Carga del archivo elegido. Elegir otro antes de que termine cancela este pedido.
    // Las imágenes ya las trae la tira de miniaturas: pedirlas acá también las bajaría dos
    // veces. Solo se piden acá al reintentar.
    React.useEffect(() => {
        if (!selected || urls[selected.id]) { setStatus('idle'); return; }
        if (selectedIsImage && retryKey === 0) { setStatus('idle'); return; }
        const controller = new AbortController();
        setStatus('loading');
        load(selected, controller.signal)
            .then(() => { if (!controller.signal.aborted) setStatus('idle'); })
            .catch((error) => { if (!isAbortError(error) && !controller.signal.aborted) setStatus('error'); });
        return () => controller.abort();
        // `urls` no va: cuando la miniatura termina de cargar, ya no hace falta pedirlo.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selected?.id, load, retryKey]);

    if (!selected) {
        return <p className={cn('p-4 text-sm text-muted-foreground', className)}>{t('noFiles')}</p>;
    }

    const kind = getFileViewerKind(selected.name, selected.mimeType);
    const focusHere = !!focus && focusFileId === selected.id;
    // El visor de PDF del navegador abre en la página pedida con `#page=`; la zona no se puede marcar.
    const pdfUrl = url && focusHere && focus.page > 1 ? `${url}#page=${focus.page}` : url;
    // Con recuadro en una imagen la tarjeta va sobre el recuadro; si no, en la franja de arriba.
    const floating = focusHere && kind === 'image' && !!focus.box && !!url;
    const focusCard = (variant: 'floating' | 'inline', hint?: React.ReactNode) => focus && (
        <ReviewFocusCard
            key={focus.itemId}
            focus={focus}
            item={focusItem}
            variant={variant}
            onClose={onClearFocus}
            onResolved={onFocusResolved}
            hint={hint}
            navigation={focusNavigation}
            renderEditor={renderFocusEditor}
            className={variant === 'inline' ? 'min-w-0 flex-1' : undefined}
        />
    );

    let body: React.ReactNode;
    if (url) {
        body = kind === 'image'
            ? (
                <ZoomPanImage
                    key={url}
                    src={url}
                    alt={selected.name}
                    className="h-full"
                    highlight={focusHere ? focus.box : null}
                    highlightKey={focus?.key}
                    highlightContent={floating ? focusCard('floating') : null}
                />
            )
            : kind === 'pdf'
                ? <iframe key={pdfUrl ?? undefined} src={pdfUrl ?? undefined} title={selected.name} className="h-full w-full border-0 bg-white" />
                : (
                    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                        <FileText className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
                        <p className="text-sm text-muted-foreground">{t('noPreview')}</p>
                    </div>
                );
    } else if (status === 'error' || (failed.has(selected.id) && status !== 'loading')) {
        body = (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                <AlertCircle className="h-8 w-8 text-destructive" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">{t('loadError')}</p>
                <Button variant="outline" size="sm" onClick={() => setRetryKey((k) => k + 1)}>{tCommon('retry')}</Button>
            </div>
        );
    } else {
        body = (
            <div className="flex h-full flex-col items-center justify-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">{t('loading')}</p>
            </div>
        );
    }

    return (
        <div className={cn('flex min-h-0 flex-col', className)}>
            <div className="flex items-center gap-2 border-b px-3 py-2">
                <p className="min-w-0 flex-1 truncate text-xs font-medium" title={selected.name}>{selected.name}</p>
                {url && (
                    <Button asChild variant="outline" size="sm" className="h-7 shrink-0 text-xs">
                        <a href={url} download={selected.name} target="_blank" rel="noopener noreferrer">
                            <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                            {t('download')}
                        </a>
                    </Button>
                )}
            </div>

            {focus && !floating && (
                <div className="flex items-start gap-2 border-b border-amber-500/40 bg-amber-500/10 px-3 py-2">
                    <LocateFixed className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden="true" />
                    {/* Sin recuadro (o en un PDF) solo se sabe el archivo y la página. */}
                    {focusCard('inline', !focusFileId
                        ? t('focus.noFile')
                        : focusHere && kind === 'pdf'
                            ? t('focus.pdfPage', { page: focus.page })
                            : focusHere && !focus.box ? t('focus.noBox') : null)}
                </div>
            )}

            <div className="min-h-0 flex-1">{body}</div>

            {files.length > 1 && (
                <div className="flex gap-2 overflow-x-auto border-t p-2" role="tablist" aria-label={t('description')}>
                    {files.map((file) => {
                        const isImage = getFileViewerKind(file.name, file.mimeType) === 'image';
                        const isCurrent = file.id === selected.id;
                        return (
                            <button
                                key={file.id}
                                type="button"
                                role="tab"
                                aria-selected={isCurrent}
                                title={file.name}
                                aria-label={`${t('open')}: ${file.name}`}
                                onClick={() => { setSelectedId(file.id); setRetryKey(0); }}
                                className={cn(
                                    'relative h-14 w-14 shrink-0 overflow-hidden rounded-md border bg-muted transition',
                                    isCurrent ? 'ring-2 ring-primary' : 'opacity-70 hover:opacity-100',
                                )}
                            >
                                {isImage
                                    ? <Thumbnail url={urls[file.id]} name={file.name} failed={failed.has(file.id)} />
                                    : (
                                        <span className="flex h-full w-full flex-col items-center justify-center gap-0.5 px-1">
                                            <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                                            <span className="w-full truncate text-[9px] text-muted-foreground">{file.name}</span>
                                        </span>
                                    )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default OrderFilesPanel;
