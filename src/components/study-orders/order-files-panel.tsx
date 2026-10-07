'use client';

import * as React from 'react';
import { AlertCircle, Download, FileText, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { ZoomPanImage, getFileViewerKind } from '@/components/ui/image-viewer';

import { Thumbnail, useOrderFiles, type OrderFile, type OrderFileLoader } from './order-file-gallery';

import { isAbortError } from '@/services/api';
import { cn } from '@/lib/utils';

/**
 * Los originales de la orden, a la vista mientras se carga el formulario: el
 * archivo elegido en grande (con zoom y arrastre, o el PDF adentro) y una tira
 * de miniaturas para cambiar de archivo. Es lo que permite pasar la orden del
 * papel al sistema sin abrir y cerrar un visor por cada dato.
 */

export interface OrderFilesPanelProps {
    files: OrderFile[];
    loadFile: OrderFileLoader;
    className?: string;
}

export function OrderFilesPanel({ files, loadFile, className }: OrderFilesPanelProps) {
    const t = useTranslations('FileViewer');
    const tCommon = useTranslations('Common');
    const { urls, failed, load } = useOrderFiles(files, loadFile);

    const [selectedId, setSelectedId] = React.useState<string | null>(files[0]?.id ?? null);
    const [status, setStatus] = React.useState<'idle' | 'loading' | 'error'>('idle');
    const [retryKey, setRetryKey] = React.useState(0);

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

    let body: React.ReactNode;
    if (url) {
        body = kind === 'image'
            ? <ZoomPanImage key={url} src={url} alt={selected.name} className="h-full" />
            : kind === 'pdf'
                ? <iframe src={url} title={selected.name} className="h-full w-full border-0 bg-white" />
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
