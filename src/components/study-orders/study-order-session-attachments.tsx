'use client';

import * as React from 'react';
import { Download, FileText, Loader2, Paperclip } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import { useClinicHistory } from '@/hooks/useClinicHistory';
import type { AttachedFile } from '@/lib/types';

/**
 * Los adjuntos de la sesión clínica: las radiografías y fotos que tomó el
 * técnico, que son el resultado de la orden.
 *
 * Las imágenes se cargan como miniatura para poder verlas sin abrir nada — el
 * derivador entra a esta pestaña justamente a mirarlas. El resto de los
 * archivos (PDF, informes) se lista como chip: previsualizarlos costaría más de
 * lo que aporta y se abren de un clic.
 *
 * Los blobs se piden de a uno y se liberan al desmontar. Una sesión trae unos
 * pocos archivos, pero son imágenes médicas: dejar object URLs colgando retiene
 * megabytes por cada orden que se abra.
 */

export interface StudyOrderSessionAttachmentsProps {
    sessionId: string;
    attachments: AttachedFile[];
}

function isImage(file: AttachedFile): boolean {
    const mime = file.mime_type || file.tipo || '';
    if (mime.startsWith('image/')) return true;
    return /\.(jpe?g|png|gif|webp|bmp)$/i.test(file.file_name || file.ruta || '');
}

function fileLabel(file: AttachedFile): string {
    return file.file_name || file.ruta?.split('/').pop() || '—';
}

export function StudyOrderSessionAttachments({ sessionId, attachments }: StudyOrderSessionAttachmentsProps) {
    const t = useTranslations('StudyOrdersPage.sessionTab');
    const { getSessionAttachment } = useClinicHistory();

    /** Object URL por adjunto. Nulo = todavía no se pidió o falló. */
    const [urls, setUrls] = React.useState<Record<string, string>>({});
    const [failed, setFailed] = React.useState<Set<string>>(new Set());
    const [preview, setPreview] = React.useState<{ url: string; name: string; isImage: boolean } | null>(null);
    const [loadingId, setLoadingId] = React.useState<string | null>(null);

    // Las que se pueden pintar se traen solas; el resto espera al clic.
    const images = React.useMemo(() => attachments.filter(isImage), [attachments]);
    const others = React.useMemo(() => attachments.filter((f) => !isImage(f)), [attachments]);

    // Un único efecto que carga y limpia: liberar los object URL al desmontar es
    // lo que evita retener las imágenes de cada orden que se abrió.
    React.useEffect(() => {
        let cancelled = false;
        const created: string[] = [];

        void (async () => {
            for (const file of images) {
                const id = file.id || file.ruta;
                if (!id) continue;
                try {
                    const blob = await getSessionAttachment(sessionId, id);
                    if (cancelled) return;
                    const url = URL.createObjectURL(blob);
                    created.push(url);
                    setUrls((prev) => ({ ...prev, [id]: url }));
                } catch {
                    if (!cancelled) setFailed((prev) => new Set(prev).add(id));
                }
            }
        })();

        return () => {
            cancelled = true;
            created.forEach((url) => URL.revokeObjectURL(url));
        };
    }, [sessionId, images, getSessionAttachment]);

    const openFile = React.useCallback(async (file: AttachedFile) => {
        const id = file.id || file.ruta;
        if (!id) return;
        const existing = urls[id];
        if (existing) {
            setPreview({ url: existing, name: fileLabel(file), isImage: isImage(file) });
            return;
        }
        setLoadingId(id);
        try {
            const blob = await getSessionAttachment(sessionId, id);
            const url = URL.createObjectURL(blob);
            setUrls((prev) => ({ ...prev, [id]: url }));
            setPreview({ url, name: fileLabel(file), isImage: isImage(file) });
        } catch {
            setFailed((prev) => new Set(prev).add(id));
        } finally {
            setLoadingId(null);
        }
    }, [sessionId, urls, getSessionAttachment]);

    if (attachments.length === 0) return null;

    return (
        <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
                {t('attachments', { count: attachments.length })}
            </p>

            {images.length > 0 && (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {images.map((file) => {
                        const id = file.id || file.ruta || '';
                        const url = urls[id];
                        return (
                            <button
                                key={id}
                                type="button"
                                onClick={() => void openFile(file)}
                                title={fileLabel(file)}
                                className="relative aspect-square overflow-hidden rounded-md border bg-muted transition-opacity hover:opacity-80"
                            >
                                {url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={url} alt={fileLabel(file)} className="h-full w-full object-cover" />
                                ) : (
                                    <span className="grid h-full w-full place-items-center">
                                        {failed.has(id)
                                            ? <FileText className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                                            : <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}

            {others.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {others.map((file) => {
                        const id = file.id || file.ruta || '';
                        return (
                            <Button
                                key={id}
                                variant="outline"
                                size="sm"
                                className="h-7 max-w-full text-xs font-normal"
                                onClick={() => void openFile(file)}
                                disabled={loadingId === id}
                            >
                                {loadingId === id
                                    ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                    : <FileText className="mr-1.5 h-3.5 w-3.5" />}
                                <span className="truncate">{fileLabel(file)}</span>
                            </Button>
                        );
                    })}
                </div>
            )}

            <Dialog open={!!preview} onOpenChange={(open) => { if (!open) setPreview(null); }}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle className="truncate pr-8">{preview?.name}</DialogTitle>
                    </DialogHeader>
                    {preview?.isImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={preview.url} alt={preview.name} className="max-h-[70vh] w-full object-contain" />
                    ) : (
                        <div className="py-8 text-center">
                            <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground" aria-hidden="true" />
                            <Button asChild variant="outline">
                                {/* `download` con el nombre real: sin esto el archivo
                                    baja con el uuid del object URL por nombre. */}
                                <a href={preview?.url} download={preview?.name} target="_blank" rel="noopener noreferrer">
                                    <Download className="mr-2 h-4 w-4" />
                                    {t('openAttachment')}
                                </a>
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default StudyOrderSessionAttachments;
