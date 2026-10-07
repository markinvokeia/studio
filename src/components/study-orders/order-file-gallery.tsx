'use client';

import * as React from 'react';
import { FileText, Loader2, Paperclip } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { FileViewerDialog, getFileViewerKind } from '@/components/ui/image-viewer';

import { isAbortError } from '@/services/api';

/**
 * Archivos de una orden de estudio: los originales que llegaron por WhatsApp y
 * los adjuntos de la sesión clínica (las radiografías del técnico).
 *
 * Las imágenes se cargan solas como miniatura, de a una; el resto espera al
 * clic. Se abren en el visor compartido (`FileViewerDialog`): zoom, arrastre y
 * PDF dentro del visor, igual que en la historia clínica del paciente.
 *
 * Todos los object URL que se crean se liberan al desmontar: son imágenes
 * médicas y retenerlas por cada orden que se abre ocuparía memoria para nada.
 */

export interface OrderFile {
    id: string;
    name: string;
    mimeType?: string | null;
}

export interface OrderFileGalleryProps {
    files: OrderFile[];
    /** Descarga un archivo. Tiene que ser estable (useCallback): las miniaturas se recargan si cambia. */
    loadFile: (id: string, signal: AbortSignal) => Promise<Blob>;
    /** Texto de la cabecera, p. ej. "Originales (3)". */
    label: string;
}

interface ViewerState {
    file: OrderFile;
    isLoading: boolean;
    error: boolean;
}

export function OrderFileGallery({ files, loadFile, label }: OrderFileGalleryProps) {
    const t = useTranslations('FileViewer');

    const [urls, setUrls] = React.useState<Record<string, string>>({});
    const [failed, setFailed] = React.useState<Set<string>>(new Set());
    const [viewer, setViewer] = React.useState<ViewerState | null>(null);
    // Abierto aparte del contenido: al cerrar, el último archivo sigue visible durante la
    // animación de salida (si se limpiara, el diálogo mostraría un instante el estado de error).
    const [viewerOpen, setViewerOpen] = React.useState(false);

    /** Todos los object URL creados, de miniaturas y de archivos abiertos: se liberan al desmontar. */
    const createdRef = React.useRef<Set<string>>(new Set());
    /** Pedido del archivo abierto: abrir otro antes de que termine cancela el anterior. */
    const openRequestRef = React.useRef<AbortController | null>(null);

    const images = React.useMemo(() => files.filter((f) => getFileViewerKind(f.name, f.mimeType) === 'image'), [files]);
    const others = React.useMemo(() => files.filter((f) => getFileViewerKind(f.name, f.mimeType) !== 'image'), [files]);

    const remember = React.useCallback((id: string, blob: Blob) => {
        const url = URL.createObjectURL(blob);
        createdRef.current.add(url);
        setUrls((prev) => ({ ...prev, [id]: url }));
        return url;
    }, []);

    // Miniaturas: de a una, canceladas si cambian los archivos o se desmonta.
    React.useEffect(() => {
        const controller = new AbortController();
        void (async () => {
            for (const file of images) {
                try {
                    const blob = await loadFile(file.id, controller.signal);
                    if (controller.signal.aborted) return;
                    remember(file.id, blob);
                } catch (error) {
                    if (isAbortError(error) || controller.signal.aborted) return;
                    setFailed((prev) => new Set(prev).add(file.id));
                }
            }
        })();
        return () => controller.abort();
    }, [images, loadFile, remember]);

    React.useEffect(() => {
        const created = createdRef.current;
        return () => {
            openRequestRef.current?.abort();
            created.forEach((url) => URL.revokeObjectURL(url));
            created.clear();
        };
    }, []);

    const openFile = React.useCallback(async (file: OrderFile) => {
        openRequestRef.current?.abort();
        setViewerOpen(true);
        if (urls[file.id]) {
            setViewer({ file, isLoading: false, error: false });
            return;
        }

        // El visor se abre en el acto con su estado de carga; la respuesta solo se
        // aplica si sigue siendo el archivo abierto (abrir otro cancela este pedido).
        const controller = new AbortController();
        openRequestRef.current = controller;
        setViewer({ file, isLoading: true, error: false });
        try {
            const blob = await loadFile(file.id, controller.signal);
            if (controller.signal.aborted) return;
            remember(file.id, blob);
            setFailed((prev) => {
                if (!prev.has(file.id)) return prev;
                const next = new Set(prev);
                next.delete(file.id);
                return next;
            });
            setViewer({ file, isLoading: false, error: false });
        } catch (error) {
            if (isAbortError(error) || controller.signal.aborted) return;
            setViewer({ file, isLoading: false, error: true });
        }
    }, [urls, loadFile, remember]);

    const closeViewer = React.useCallback(() => {
        openRequestRef.current?.abort();
        setViewerOpen(false);
    }, []);

    return (
        <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
                {label}
            </p>

            {images.length > 0 && (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {images.map((file) => {
                        const url = urls[file.id];
                        return (
                            <button
                                key={file.id}
                                type="button"
                                onClick={() => void openFile(file)}
                                title={file.name}
                                aria-label={`${t('open')}: ${file.name}`}
                                className="relative aspect-square overflow-hidden rounded-md border bg-muted transition-opacity hover:opacity-80"
                            >
                                {url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={url} alt={file.name} className="h-full w-full object-cover" />
                                ) : (
                                    <span className="grid h-full w-full place-items-center px-1 text-center">
                                        {failed.has(file.id) ? (
                                            <span className="flex flex-col items-center gap-1 text-[10px] text-muted-foreground">
                                                <FileText className="h-5 w-5" aria-hidden="true" />
                                                {t('thumbnailError')}
                                            </span>
                                        ) : (
                                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
                                        )}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}

            {others.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {others.map((file) => (
                        <Button
                            key={file.id}
                            variant="outline"
                            size="sm"
                            className="h-7 max-w-full text-xs font-normal"
                            onClick={() => void openFile(file)}
                            title={file.name}
                        >
                            <FileText className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                            <span className="truncate">{file.name}</span>
                        </Button>
                    ))}
                </div>
            )}

            <FileViewerDialog
                open={viewerOpen && !!viewer}
                onClose={closeViewer}
                name={viewer?.file.name}
                mimeType={viewer?.file.mimeType}
                url={viewer ? urls[viewer.file.id] ?? null : null}
                isLoading={viewer?.isLoading}
                error={viewer?.error ? t('loadError') : null}
                onRetry={viewer ? () => void openFile(viewer.file) : undefined}
            />
        </div>
    );
}

export default OrderFileGallery;
