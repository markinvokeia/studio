'use client';

import * as React from 'react';
import { Download, FileText, Loader2, Paperclip } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import { isAbortError } from '@/services/api';
import { getWhatsappIntakeFile } from '@/services/study-orders';
import type { WhatsappIntakeFile } from '@/lib/types';

/**
 * Los originales (fotos y PDF) que el usuario mandó por WhatsApp junto con su
 * orden. Sirven para auditar: comprobar contra el papel que el asistente leyó
 * bien.
 *
 * Las fotos se cargan solas como miniatura; los PDF esperan al clic. Los
 * archivos se piden con la sesión del usuario a n8n (que los baja de Drive): el
 * navegador nunca habla con Drive. Los object URL se liberan al desmontar, como
 * en los adjuntos de la sesión clínica: son datos de salud y retenerlos por cada
 * orden que se abre ocuparía memoria para nada.
 */

export interface WhatsappIntakeFilesProps {
    intakeId: string;
    files: WhatsappIntakeFile[];
}

function isImage(file: WhatsappIntakeFile): boolean {
    if ((file.mime_type ?? '').startsWith('image/')) return true;
    return /\.(jpe?g|png|webp)$/i.test(file.file_name);
}

export function WhatsappIntakeFiles({ intakeId, files }: WhatsappIntakeFilesProps) {
    const t = useTranslations('StudyOrdersPage.whatsapp');

    const [urls, setUrls] = React.useState<Record<string, string>>({});
    const [failed, setFailed] = React.useState<Set<string>>(new Set());
    const [loadingId, setLoadingId] = React.useState<string | null>(null);
    const [preview, setPreview] = React.useState<{ url: string; name: string; isImage: boolean } | null>(null);

    const images = React.useMemo(() => files.filter(isImage), [files]);
    const others = React.useMemo(() => files.filter((f) => !isImage(f)), [files]);

    // Un único efecto que carga las fotos de a una y libera todo al desmontar.
    React.useEffect(() => {
        const controller = new AbortController();
        const created: string[] = [];

        void (async () => {
            for (const file of images) {
                try {
                    const blob = await getWhatsappIntakeFile(intakeId, file.id, controller.signal);
                    if (controller.signal.aborted) return;
                    const url = URL.createObjectURL(blob);
                    created.push(url);
                    setUrls((prev) => ({ ...prev, [file.id]: url }));
                } catch (error) {
                    if (isAbortError(error) || controller.signal.aborted) return;
                    setFailed((prev) => new Set(prev).add(file.id));
                }
            }
        })();

        return () => {
            controller.abort();
            created.forEach((url) => URL.revokeObjectURL(url));
        };
    }, [intakeId, images]);

    const openFile = React.useCallback(async (file: WhatsappIntakeFile) => {
        const existing = urls[file.id];
        if (existing) {
            setPreview({ url: existing, name: file.file_name, isImage: isImage(file) });
            return;
        }
        setLoadingId(file.id);
        try {
            const blob = await getWhatsappIntakeFile(intakeId, file.id);
            const url = URL.createObjectURL(blob);
            setUrls((prev) => ({ ...prev, [file.id]: url }));
            setPreview({ url, name: file.file_name, isImage: isImage(file) });
        } catch {
            setFailed((prev) => new Set(prev).add(file.id));
        } finally {
            setLoadingId(null);
        }
    }, [intakeId, urls]);

    if (files.length === 0) {
        return <p className="text-xs text-muted-foreground">{t('noFiles')}</p>;
    }

    return (
        <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
                {t('originals')} ({files.length})
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
                                title={file.file_name}
                                aria-label={`${t('openFile')}: ${file.file_name}`}
                                className="relative aspect-square overflow-hidden rounded-md border bg-muted transition-opacity hover:opacity-80"
                            >
                                {url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={url} alt={file.file_name} className="h-full w-full object-cover" />
                                ) : (
                                    <span className="grid h-full w-full place-items-center px-1 text-center">
                                        {failed.has(file.id)
                                            ? <span className="text-[10px] text-muted-foreground">{t('fileLoadError')}</span>
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
                    {others.map((file) => (
                        <Button
                            key={file.id}
                            variant="outline"
                            size="sm"
                            className="h-7 max-w-full text-xs font-normal"
                            onClick={() => void openFile(file)}
                            disabled={loadingId === file.id}
                        >
                            {loadingId === file.id
                                ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                                : <FileText className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />}
                            <span className="truncate">{file.file_name}</span>
                        </Button>
                    ))}
                </div>
            )}

            <Dialog open={!!preview} onOpenChange={(open) => { if (!open) setPreview(null); }}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle className="truncate pr-8">{preview?.name}</DialogTitle>
                        <DialogDescription className="sr-only">{t('originals')}</DialogDescription>
                    </DialogHeader>
                    {preview?.isImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={preview.url} alt={preview.name} className="max-h-[70vh] w-full object-contain" />
                    ) : (
                        <div className="py-8 text-center">
                            <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground" aria-hidden="true" />
                            <Button asChild variant="outline">
                                <a href={preview?.url} download={preview?.name} target="_blank" rel="noopener noreferrer">
                                    <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                                    {t('openFile')}
                                </a>
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default WhatsappIntakeFiles;
