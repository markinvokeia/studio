'use client';

import * as React from 'react';
import { AlertTriangle, CheckCircle2, FileText, ImageIcon, Loader2, Upload, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

import { useAsyncAction } from '@/hooks/use-async-action';
import { getErrorMessage } from '@/lib/error-utils';
import { cn } from '@/lib/utils';
import type { StudyOrderImportStatus } from '@/lib/types';
import { isAbortError } from '@/services/api';
import {
    getStudyOrderImportStatus,
    importStudyOrder,
    STUDY_ORDER_IMPORT_LIMITS,
} from '@/services/study-orders';

/**
 * Importar una orden en papel: recepción sube las fotos o el PDF (frente, dorso, hojas de UNA
 * orden) y el asistente la lee con el mismo proceso que las que llegan por WhatsApp. El resultado
 * es siempre un BORRADOR con lo que no quedó claro como puntos a revisar; desde acá se abre para
 * completarlo y enviarlo.
 *
 * La subida responde enseguida y la lectura sigue en el servidor (tarda lo que tarde el modelo):
 * mientras tanto se consulta el estado. Se puede cerrar el diálogo sin perder nada; la orden
 * aparece en Borradores cuando termina.
 */

const POLL_MS = 3000;
const ACCEPT = STUDY_ORDER_IMPORT_LIMITS.mimeTypes.join(',');

type Phase = 'select' | 'reading' | 'done' | 'failed';

interface SelectedFile {
    id: string;
    file: File;
    previewUrl: string | null;
}

export interface StudyOrderImportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** El borrador quedó creado: la pantalla recarga la lista y lo abre para completarlo. */
    onImported: (order: { id: string; order_number: string | null }) => void;
    /** Se cerró con la lectura en curso: la lista se recarga para que aparezca cuando termine. */
    onClosedWhileReading?: () => void;
}

function formatSize(bytes: number): string {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function StudyOrderImportDialog({
    open,
    onOpenChange,
    onImported,
    onClosedWhileReading,
}: StudyOrderImportDialogProps) {
    const t = useTranslations('StudyOrdersPage.importDialog');
    const inputRef = React.useRef<HTMLInputElement>(null);

    const [files, setFiles] = React.useState<SelectedFile[]>([]);
    const [fileError, setFileError] = React.useState<string | null>(null);
    const [submitError, setSubmitError] = React.useState<string | null>(null);
    const [isDragging, setIsDragging] = React.useState(false);
    const [phase, setPhase] = React.useState<Phase>('select');
    const [intakeId, setIntakeId] = React.useState<string | null>(null);
    const [result, setResult] = React.useState<StudyOrderImportStatus | null>(null);

    // Las vistas previas son object URLs: se liberan al quitarlas o al cerrar.
    const filesRef = React.useRef(files);
    React.useEffect(() => {
        filesRef.current = files;
    }, [files]);
    React.useEffect(() => () => {
        filesRef.current.forEach((f) => f.previewUrl && URL.revokeObjectURL(f.previewUrl));
    }, []);

    const reset = React.useCallback(() => {
        filesRef.current.forEach((f) => f.previewUrl && URL.revokeObjectURL(f.previewUrl));
        setFiles([]);
        setFileError(null);
        setSubmitError(null);
        setPhase('select');
        setIntakeId(null);
        setResult(null);
    }, []);

    const addFiles = React.useCallback((incoming: FileList | File[]) => {
        setFileError(null);
        const list = Array.from(incoming);
        const accepted: SelectedFile[] = [];
        for (const file of list) {
            if (!(STUDY_ORDER_IMPORT_LIMITS.mimeTypes as readonly string[]).includes(file.type)) {
                setFileError(t('errors.format', { name: file.name }));
                continue;
            }
            if (file.size > STUDY_ORDER_IMPORT_LIMITS.maxBytes) {
                setFileError(t('errors.size', { name: file.name }));
                continue;
            }
            accepted.push({
                id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
                file,
                previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
            });
        }
        const room = Math.max(0, STUDY_ORDER_IMPORT_LIMITS.maxFiles - filesRef.current.length);
        if (accepted.length > room) {
            setFileError(t('errors.tooMany', { max: STUDY_ORDER_IMPORT_LIMITS.maxFiles }));
            accepted.slice(room).forEach((f) => f.previewUrl && URL.revokeObjectURL(f.previewUrl));
        }
        const kept = accepted.slice(0, room);
        if (kept.length > 0) setFiles((prev) => [...prev, ...kept]);
    }, [t]);

    const removeFile = React.useCallback((id: string) => {
        setFiles((prev) => {
            const target = prev.find((f) => f.id === id);
            if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
            return prev.filter((f) => f.id !== id);
        });
        setFileError(null);
    }, []);

    const upload = useAsyncAction(
        () => importStudyOrder(files.map((f) => f.file)),
        {
            onSuccess: (res) => {
                setIntakeId(res.intake_id);
                setPhase('reading');
            },
            onError: (error) => setSubmitError(getErrorMessage(error) || t('errors.upload')),
            showErrorToast: false,
        },
    );

    // Consulta el estado de la lectura hasta que termina. Cada vuelta aborta la anterior: una
    // respuesta lenta no pisa a una más nueva.
    React.useEffect(() => {
        if (phase !== 'reading' || !intakeId) return;
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        let controller: AbortController | null = null;

        const poll = async () => {
            controller = new AbortController();
            try {
                const status = await getStudyOrderImportStatus(intakeId, controller.signal);
                if (cancelled) return;
                if (status.status === 'done') {
                    setResult(status);
                    setPhase('done');
                    return;
                }
                if (status.status === 'failed') {
                    setResult(status);
                    setPhase('failed');
                    return;
                }
            } catch (error) {
                // Un corte puntual no termina la espera: se reintenta en la próxima vuelta.
                if (cancelled || isAbortError(error)) return;
            }
            timer = setTimeout(() => void poll(), POLL_MS);
        };

        timer = setTimeout(() => void poll(), POLL_MS);
        return () => {
            cancelled = true;
            if (timer) clearTimeout(timer);
            controller?.abort();
        };
    }, [phase, intakeId]);

    const handleOpenChange = (next: boolean) => {
        if (!next && upload.isPending) return; // no se cierra con la subida en vuelo
        if (!next) {
            if (phase === 'reading') onClosedWhileReading?.();
            reset();
        }
        onOpenChange(next);
    };

    const handleOpenOrder = () => {
        if (!result?.order_id) return;
        onImported({ id: result.order_id, order_number: result.order_number ?? null });
        reset();
        onOpenChange(false);
    };

    const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
        if (upload.isPending) return;
        if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{t('title')}</DialogTitle>
                    <DialogDescription>{t('description')}</DialogDescription>
                </DialogHeader>

                {phase === 'select' && (
                    <div className="space-y-3">
                        <div
                            role="button"
                            tabIndex={0}
                            aria-disabled={upload.isPending}
                            onClick={() => !upload.isPending && inputRef.current?.click()}
                            onKeyDown={(e) => {
                                if ((e.key === 'Enter' || e.key === ' ') && !upload.isPending) {
                                    e.preventDefault();
                                    inputRef.current?.click();
                                }
                            }}
                            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={onDrop}
                            className={cn(
                                'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors',
                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/40',
                                upload.isPending && 'pointer-events-none opacity-60',
                            )}
                        >
                            <Upload className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
                            <p className="text-sm font-medium">{t('dropzone')}</p>
                            <p className="text-xs text-muted-foreground">
                                {t('hint', { max: STUDY_ORDER_IMPORT_LIMITS.maxFiles })}
                            </p>
                            <input
                                ref={inputRef}
                                type="file"
                                accept={ACCEPT}
                                multiple
                                className="hidden"
                                onChange={(e) => {
                                    if (e.target.files?.length) addFiles(e.target.files);
                                    e.target.value = '';
                                }}
                            />
                        </div>

                        {files.length > 0 && (
                            <ul className="space-y-1.5" aria-label={t('selectedFiles')}>
                                {files.map((f, idx) => (
                                    <li key={f.id} className="flex items-center gap-3 rounded-md border px-2 py-1.5">
                                        {f.previewUrl ? (
                                            // eslint-disable-next-line @next/next/no-img-element -- vista previa local (object URL)
                                            <img src={f.previewUrl} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
                                        ) : (
                                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-muted">
                                                {f.file.type === 'application/pdf'
                                                    ? <FileText className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                                                    : <ImageIcon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />}
                                            </span>
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm">{f.file.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {t('page', { n: idx + 1 })} · {formatSize(f.file.size)}
                                            </p>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 shrink-0"
                                            disabled={upload.isPending}
                                            onClick={() => removeFile(f.id)}
                                            aria-label={t('remove', { name: f.file.name })}
                                        >
                                            <X className="h-4 w-4" aria-hidden="true" />
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        )}

                        {(fileError || submitError) && (
                            <p className="text-sm text-destructive" role="alert">{submitError ?? fileError}</p>
                        )}
                    </div>
                )}

                {phase === 'reading' && (
                    <div className="flex flex-col items-center gap-3 py-6 text-center" role="status" aria-live="polite">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
                        <p className="text-sm font-medium">{t('reading.title')}</p>
                        <p className="max-w-sm text-xs text-muted-foreground">{t('reading.description')}</p>
                    </div>
                )}

                {phase === 'done' && result && (
                    <div className="flex items-start gap-3 rounded-md border bg-muted/30 p-3" role="status">
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
                        <div className="min-w-0 space-y-1 text-sm">
                            <p className="font-medium">
                                {t('done.title', { number: result.order_number ?? '' })}
                            </p>
                            {result.patient_name && <p className="truncate">{result.patient_name}</p>}
                            <p className="text-muted-foreground">
                                {t('done.items', { count: Number(result.items_total ?? 0) })}
                                {' · '}
                                {Number(result.review_pending ?? 0) > 0
                                    ? t('done.review', { count: Number(result.review_pending) })
                                    : t('done.noReview')}
                            </p>
                        </div>
                    </div>
                )}

                {phase === 'failed' && (
                    <div className="flex items-start gap-3 rounded-md border border-destructive/40 p-3" role="alert">
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
                        <p className="text-sm">{t('failed.description')}</p>
                    </div>
                )}

                <DialogFooter>
                    {phase === 'select' && (
                        <>
                            <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={upload.isPending}>
                                {t('cancel')}
                            </Button>
                            <Button
                                onClick={() => { setSubmitError(null); void upload.run(); }}
                                loading={upload.isPending}
                                disabled={files.length === 0}
                            >
                                {t('submit')}
                            </Button>
                        </>
                    )}
                    {phase === 'reading' && (
                        <Button variant="outline" onClick={() => handleOpenChange(false)}>{t('closeWhileReading')}</Button>
                    )}
                    {phase === 'done' && (
                        <>
                            <Button variant="outline" onClick={() => handleOpenChange(false)}>{t('close')}</Button>
                            <Button onClick={handleOpenOrder}>{t('done.open')}</Button>
                        </>
                    )}
                    {phase === 'failed' && (
                        <Button variant="outline" onClick={() => handleOpenChange(false)}>{t('close')}</Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default StudyOrderImportDialog;
