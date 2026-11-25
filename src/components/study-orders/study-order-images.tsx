'use client';

import * as React from 'react';
import { Camera, FileText, ImagePlus, RefreshCw, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { FileViewerDialog, getFileViewerKind } from '@/components/ui/image-viewer';

import { Thumbnail, useOrderFiles, type OrderFile } from './order-file-gallery';

import { cn } from '@/lib/utils';
import type { StudyOrderImage, StudyOrderImageSide } from '@/lib/types';
import { isAbortError } from '@/services/api';
import { STUDY_ORDER_IMAGE_LIMITS, studyOrderImageLoader } from '@/services/study-orders';

/**
 * Frente y dorso de una orden cargada a mano: los recuadros del formulario y las miniaturas del
 * detalle. Los archivos se piden con la sesión del usuario a n8n; el navegador nunca habla con Drive.
 */

export const STUDY_ORDER_IMAGE_SIDES: readonly StudyOrderImageSide[] = ['front', 'back'];

/** Lo que se eligió para un lado y todavía no se guardó. Sin entrada = queda como está. */
export type PendingOrderImages = Partial<Record<StudyOrderImageSide, File | 'remove'>>;

const ACCEPT = STUDY_ORDER_IMAGE_LIMITS.mimeTypes.join(',');

/** Miniaturas de las imágenes guardadas y visor compartido. */
function useImageViewer(orderId: string, images: StudyOrderImage[]) {
    const files = React.useMemo<OrderFile[]>(
        () => images.map((image) => ({ id: image.id, name: image.file_name, mimeType: image.mime_type })),
        [images],
    );
    const loadFile = React.useMemo(() => studyOrderImageLoader(orderId), [orderId]);
    const { urls, failed, load } = useOrderFiles(files, loadFile);

    const [current, setCurrent] = React.useState<OrderFile | null>(null);
    const [open, setOpen] = React.useState(false);
    const [status, setStatus] = React.useState<'idle' | 'loading' | 'error'>('idle');
    const requestRef = React.useRef<AbortController | null>(null);
    React.useEffect(() => () => requestRef.current?.abort(), []);

    const view = React.useCallback(async (file: OrderFile) => {
        requestRef.current?.abort();
        const controller = new AbortController();
        requestRef.current = controller;
        setCurrent(file);
        setOpen(true);
        setStatus('loading');
        try {
            await load(file, controller.signal);
            if (!controller.signal.aborted) setStatus('idle');
        } catch (error) {
            if (!isAbortError(error) && !controller.signal.aborted) setStatus('error');
        }
    }, [load]);

    const t = useTranslations('FileViewer');
    const viewer = (
        <FileViewerDialog
            open={open && !!current}
            onClose={() => { requestRef.current?.abort(); setOpen(false); }}
            name={current?.name}
            mimeType={current?.mimeType}
            url={current ? urls[current.id] ?? null : null}
            isLoading={status === 'loading'}
            error={status === 'error' ? t('loadError') : null}
            onRetry={current ? () => void view(current) : undefined}
        />
    );

    return { files, urls, failed, view, viewer };
}

/** Miniatura de un archivo: la imagen, o un ícono si es PDF. */
function Preview({ file, url, failed }: { file: OrderFile; url?: string; failed: boolean }) {
    if (getFileViewerKind(file.name, file.mimeType) === 'image') {
        return <Thumbnail url={url} name={file.name} failed={failed} />;
    }
    return (
        <span className="grid h-full w-full place-items-center">
            <FileText className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        </span>
    );
}

export interface StudyOrderImagesProps {
    orderId: string;
    images: StudyOrderImage[];
}

/** Detalle: las imágenes de la orden, con su lado y vista ampliada. */
export function StudyOrderImages({ orderId, images }: StudyOrderImagesProps) {
    const t = useTranslations('StudyOrdersPage.images');
    const { files, urls, failed, view, viewer } = useImageViewer(orderId, images);
    if (images.length === 0) return null;

    return (
        <section className="rounded-lg border p-4">
            <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">{t('title')}</p>
            <div className="grid grid-cols-2 gap-3 sm:max-w-md">
                {images.map((image, index) => {
                    const file = files[index];
                    const label = t(image.side);
                    return (
                        <figure key={image.id} className="space-y-1">
                            <button
                                type="button"
                                onClick={() => void view(file)}
                                aria-label={t('view', { side: label })}
                                title={t('view', { side: label })}
                                className="block aspect-[4/3] w-full overflow-hidden rounded-md border bg-muted transition-opacity hover:opacity-80"
                            >
                                <Preview file={file} url={urls[file.id]} failed={failed.has(file.id)} />
                            </button>
                            <figcaption className="text-sm">{label}</figcaption>
                        </figure>
                    );
                })}
            </div>
            {viewer}
        </section>
    );
}

export interface StudyOrderImageFieldsProps {
    /** Vacío = orden sin guardar: todavía no hay imágenes guardadas. */
    orderId: string;
    images: StudyOrderImage[];
    pending: PendingOrderImages;
    onChange: (side: StudyOrderImageSide, value: File | 'remove' | undefined) => void;
    /** El frente se exige al guardar. */
    frontRequired: boolean;
    disabled?: boolean;
}

/** Formulario: un recuadro por lado para adjuntar, reemplazar o quitar. Se guarda con la orden. */
export function StudyOrderImageFields({ orderId, images, pending, onChange, frontRequired, disabled }: StudyOrderImageFieldsProps) {
    const t = useTranslations('StudyOrdersPage.images');
    const { files, urls, failed, view, viewer } = useImageViewer(orderId, images);

    return (
        <div className="space-y-2">
            <p className="text-sm font-semibold">{t('title')}</p>
            <div className="grid gap-4 sm:grid-cols-2">
                {STUDY_ORDER_IMAGE_SIDES.map((side) => {
                    const index = images.findIndex((image) => image.side === side);
                    return (
                        <ImageField
                            key={side}
                            side={side}
                            required={side === 'front' && frontRequired}
                            saved={index >= 0 ? files[index] : undefined}
                            savedUrl={index >= 0 ? urls[files[index].id] : undefined}
                            savedFailed={index >= 0 && failed.has(files[index].id)}
                            onView={(file) => void view(file)}
                            value={pending[side]}
                            onChange={(value) => onChange(side, value)}
                            disabled={disabled}
                        />
                    );
                })}
            </div>
            <p className="text-xs text-muted-foreground">{t('help')}</p>
            {viewer}
        </div>
    );
}

interface ImageFieldProps {
    side: StudyOrderImageSide;
    required: boolean;
    saved?: OrderFile;
    savedUrl?: string;
    savedFailed: boolean;
    onView: (file: OrderFile) => void;
    value: File | 'remove' | undefined;
    onChange: (value: File | 'remove' | undefined) => void;
    disabled?: boolean;
}

function ImageField({ side, required, saved, savedUrl, savedFailed, onView, value, onChange, disabled }: ImageFieldProps) {
    const t = useTranslations('StudyOrdersPage.images');
    const inputRef = React.useRef<HTMLInputElement>(null);
    const cameraRef = React.useRef<HTMLInputElement>(null);
    const [error, setError] = React.useState<string | null>(null);
    const [isDragging, setIsDragging] = React.useState(false);

    const picked = value instanceof File ? value : null;
    const [pickedUrl, setPickedUrl] = React.useState<string>();
    React.useEffect(() => {
        if (!picked) {
            setPickedUrl(undefined);
            return;
        }
        const url = URL.createObjectURL(picked);
        setPickedUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [picked]);

    const pick = (file?: File | null) => {
        if (!file) return;
        if (!(STUDY_ORDER_IMAGE_LIMITS.mimeTypes as readonly string[]).includes(file.type)) {
            setError(t('invalidType'));
            return;
        }
        if (file.size === 0 || file.size > STUDY_ORDER_IMAGE_LIMITS.maxBytes) {
            setError(t('invalidSize'));
            return;
        }
        setError(null);
        onChange(file);
    };

    const label = t(side);
    const shown: OrderFile | null = picked
        ? { id: 'picked', name: picked.name, mimeType: picked.type }
        : value !== 'remove' && saved ? saved : null;

    return (
        <div className="space-y-1.5">
            <p className="text-sm">
                {label}
                {required
                    ? <span className="text-destructive" aria-hidden="true"> *</span>
                    : <span className="text-muted-foreground"> ({t('optional')})</span>}
            </p>
            <div
                className={cn(
                    'relative h-44 overflow-hidden rounded-lg border bg-muted/40 transition-colors',
                    !shown && 'border-dashed',
                    isDragging && 'border-primary bg-primary/5',
                )}
                onDragOver={(e) => { e.preventDefault(); if (!disabled) setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (!disabled) pick(e.dataTransfer.files?.[0]);
                }}
            >
                {shown ? (
                    picked ? (
                        <Preview file={shown} url={pickedUrl} failed={false} />
                    ) : (
                        <button type="button" className="block h-full w-full" onClick={() => onView(shown)} aria-label={t('view', { side: label })}>
                            <Preview file={shown} url={savedUrl} failed={savedFailed} />
                        </button>
                    )
                ) : (
                    <button
                        type="button"
                        disabled={disabled}
                        onClick={() => inputRef.current?.click()}
                        aria-label={t('attachSide', { side: label })}
                        className="flex h-full w-full flex-col items-center justify-center gap-2 px-3 text-center text-sm text-muted-foreground hover:bg-muted"
                    >
                        <ImagePlus className="h-7 w-7" aria-hidden="true" />
                        {t('attach')}
                    </button>
                )}
            </div>
            <div className="flex flex-wrap gap-1.5">
                {/* Cámara: solo en pantallas táctiles, donde abre la del teléfono. */}
                <Button type="button" variant="outline" size="sm" className="hidden h-8 px-2.5 [@media(pointer:coarse)]:inline-flex" disabled={disabled} onClick={() => cameraRef.current?.click()}>
                    <Camera className="mr-1.5 h-4 w-4" aria-hidden="true" />
                    {t('takePhoto')}
                </Button>
                {shown && (
                    <Button type="button" variant="outline" size="sm" className="h-8 px-2.5" disabled={disabled} onClick={() => inputRef.current?.click()}>
                        <RefreshCw className="mr-1.5 h-4 w-4" aria-hidden="true" />
                        {t('replace')}
                    </Button>
                )}
                {/* Lo elegido se descarta (vuelve lo guardado); lo guardado se quita, salvo el frente obligatorio. */}
                {(picked || (shown && !required)) && (
                    <Button type="button" variant="ghost" size="sm" className="h-8 px-2.5" disabled={disabled} onClick={() => { setError(null); onChange(picked ? undefined : 'remove'); }}>
                        <Trash2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
                        {t('remove')}
                    </Button>
                )}
            </div>
            {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
            <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" data-side={side} onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
    );
}

export default StudyOrderImages;
