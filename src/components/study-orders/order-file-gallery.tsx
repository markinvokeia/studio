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

/** Descarga un archivo. Tiene que ser estable (useCallback): las miniaturas se recargan si cambia. */
export type OrderFileLoader = (id: string, signal: AbortSignal) => Promise<Blob>;

/**
 * Carga de los archivos de una orden: miniaturas de las imágenes de a una, carga a pedido del
 * resto y liberación de todos los object URL al desmontar. La comparten la galería y el panel
 * de originales del asistente de órdenes.
 */
export function useOrderFiles(files: OrderFile[], loadFile: OrderFileLoader) {
    const [urls, setUrls] = React.useState<Record<string, string>>({});
    const [failed, setFailed] = React.useState<Set<string>>(new Set());
    /** Todos los object URL creados, de miniaturas y de archivos abiertos: se liberan al desmontar. */
    const createdRef = React.useRef<Set<string>>(new Set());
    // Para leer lo ya cargado desde callbacks y efectos sin recrearlos en cada carga.
    const urlsRef = React.useRef(urls);
    React.useEffect(() => { urlsRef.current = urls; }, [urls]);

    const images = React.useMemo(() => files.filter((f) => getFileViewerKind(f.name, f.mimeType) === 'image'), [files]);
    const others = React.useMemo(() => files.filter((f) => getFileViewerKind(f.name, f.mimeType) !== 'image'), [files]);

    const remember = React.useCallback((id: string, blob: Blob) => {
        const url = URL.createObjectURL(blob);
        createdRef.current.add(url);
        urlsRef.current = { ...urlsRef.current, [id]: url };
        setUrls((prev) => ({ ...prev, [id]: url }));
        setFailed((prev) => {
            if (!prev.has(id)) return prev;
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
        return url;
    }, []);

    // Miniaturas: de a una, canceladas si cambian los archivos o se desmonta.
    React.useEffect(() => {
        const controller = new AbortController();
        void (async () => {
            for (const file of images) {
                if (urlsRef.current[file.id]) continue;
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
            created.forEach((url) => URL.revokeObjectURL(url));
            created.clear();
        };
    }, []);

    /** URL del archivo: la ya cargada o la descarga. Lanza si falla o se cancela. */
    const load = React.useCallback(async (file: OrderFile, signal: AbortSignal): Promise<string> => {
        const existing = urlsRef.current[file.id];
        if (existing) return existing;
        const blob = await loadFile(file.id, signal);
        if (signal.aborted) throw new DOMException('aborted', 'AbortError');
        return remember(file.id, blob);
    }, [loadFile, remember]);

    return { images, others, urls, failed, load };
}

export interface OrderFileGalleryProps {
    files: OrderFile[];
    loadFile: OrderFileLoader;
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
    const { images, others, urls, failed, load } = useOrderFiles(files, loadFile);

    const [viewer, setViewer] = React.useState<ViewerState | null>(null);
    // Abierto aparte del contenido: al cerrar, el último archivo sigue visible durante la
    // animación de salida (si se limpiara, el diálogo mostraría un instante el estado de error).
    const [viewerOpen, setViewerOpen] = React.useState(false);
    /** Pedido del archivo abierto: abrir otro antes de que termine cancela el anterior. */
    const openRequestRef = React.useRef<AbortController | null>(null);

    React.useEffect(() => () => openRequestRef.current?.abort(), []);

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
            await load(file, controller.signal);
            if (controller.signal.aborted) return;
            setViewer({ file, isLoading: false, error: false });
        } catch (error) {
            if (isAbortError(error) || controller.signal.aborted) return;
            setViewer({ file, isLoading: false, error: true });
        }
    }, [urls, load]);

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
                    {images.map((file) => (
                        <button
                            key={file.id}
                            type="button"
                            onClick={() => void openFile(file)}
                            title={file.name}
                            aria-label={`${t('open')}: ${file.name}`}
                            className="relative aspect-square overflow-hidden rounded-md border bg-muted transition-opacity hover:opacity-80"
                        >
                            <Thumbnail url={urls[file.id]} name={file.name} failed={failed.has(file.id)} />
                        </button>
                    ))}
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

/** Miniatura de una imagen: la imagen, su carga o el aviso de que falló. */
export function Thumbnail({ url, name, failed }: { url?: string; name: string; failed: boolean }) {
    const t = useTranslations('FileViewer');
    if (url) {
        // eslint-disable-next-line @next/next/no-img-element
        return <img src={url} alt={name} className="h-full w-full object-cover" />;
    }
    return (
        <span className="grid h-full w-full place-items-center px-1 text-center">
            {failed ? (
                <span className="flex flex-col items-center gap-1 text-[10px] text-muted-foreground">
                    <FileText className="h-5 w-5" aria-hidden="true" />
                    {t('thumbnailError')}
                </span>
            ) : (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
            )}
        </span>
    );
}

export default OrderFileGallery;
