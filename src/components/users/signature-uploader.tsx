'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import { ConfirmActionDialog } from '@/components/ui/confirm-action-dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

import { SignaturePadDialog } from '@/components/users/signature-pad-dialog';

import { API_ROUTES } from '@/constants/routes';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/error-utils';
import api, { isTimeoutError, REQUEST_TIMEOUT_MS } from '@/services/api';

import { Loader2, PenLine, Signature, Trash2, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';

const MAX_SIGNATURE_BYTES = 1024 * 1024; // 1 MB — mismo límite que el logo de clínica
const ACCEPTED_TYPES = 'image/png,image/jpeg,image/webp';

interface SignatureUploaderProps {
    /** Usuario dueño de la firma. */
    userId: string;
    /** False ⇒ sólo se muestra la firma actual, sin acciones. */
    canManage?: boolean;
    className?: string;
    /** Se invoca tras guardar o borrar la firma, para refrescar quien la use. */
    onSignatureChange?: () => void;
}

/**
 * Sube y muestra la firma de un doctor. El archivo vive en Google Drive; la
 * imagen se pide siempre al webhook `GET /users/signature?user_id=…`, nunca a
 * una URL de Drive directa (la auth la resuelve n8n), igual que el logo de
 * clínica.
 *
 * Se monta tanto en Preferencias (firma propia) como en la ficha de un usuario
 * o doctor (firma ajena, con permiso).
 */
export function SignatureUploader({ userId, canManage = false, className, onSignatureChange }: SignatureUploaderProps) {
    const t = useTranslations('SignatureUploader');
    const tCommon = useTranslations('Common');
    const { toast } = useToast();

    const [currentUrl, setCurrentUrl] = React.useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
    const [file, setFile] = React.useState<File | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    // A failed fetch is not "no signature": offering to upload/delete over an unknown state would mislead.
    const [loadFailed, setLoadFailed] = React.useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);
    const [isPadOpen, setIsPadOpen] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const inputRef = React.useRef<HTMLInputElement>(null);

    const loadSignature = React.useCallback(async () => {
        if (!userId) return;
        setIsLoading(true);
        setLoadFailed(false);
        let objectUrl: string | null = null;
        try {
            const blob = await api.getBlob(API_ROUTES.USER_SIGNATURE, { user_id: userId }) as unknown as Blob;
            objectUrl = blob?.size > 0 ? URL.createObjectURL(blob) : null;
        } catch (err) {
            // 404 = the user has no signature yet; anything else is a real load failure.
            if ((err as { status?: number } | null)?.status !== 404) setLoadFailed(true);
            objectUrl = null;
        }
        // Libera el object URL anterior antes de reemplazarlo.
        setCurrentUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return objectUrl;
        });
        setIsLoading(false);
    }, [userId]);

    React.useEffect(() => {
        loadSignature();
    }, [loadSignature]);

    // Los object URLs vivos al desmontar hay que liberarlos a mano.
    React.useEffect(() => () => {
        setCurrentUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
    }, []);

    const resetSelection = () => {
        setFile(null);
        setPreviewUrl(null);
        setError(null);
        if (inputRef.current) inputRef.current.value = '';
    };

    /** El trazo del pad entra por la misma vía que un archivo elegido a mano. */
    const handleDrawn = (drawn: File) => {
        setError(null);
        setFile(drawn);
        const reader = new FileReader();
        reader.onloadend = () => setPreviewUrl(reader.result as string);
        reader.readAsDataURL(drawn);
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selected = event.target.files?.[0];
        if (!selected) return;
        if (selected.size > MAX_SIGNATURE_BYTES) {
            setError(t('errors.tooLarge'));
            if (inputRef.current) inputRef.current.value = '';
            return;
        }
        setError(null);
        setFile(selected);
        const reader = new FileReader();
        reader.onloadend = () => setPreviewUrl(reader.result as string);
        reader.readAsDataURL(selected);
    };

    const save = useAsyncAction(
        async (selected: File) => {
            setError(null);
            const formData = new FormData();
            formData.append('user_id', userId);
            formData.append('data', selected);
            const response = await api.post(API_ROUTES.USER_SIGNATURE_UPLOAD, formData, undefined, undefined, { timeoutMs: REQUEST_TIMEOUT_MS.mutation });
            if (Array.isArray(response) && response[0]?.code >= 400) {
                throw new Error(response[0]?.message || t('errors.generic'));
            }
        },
        {
            onSuccess: async () => {
                toast({ title: t('toast.saved') });
                resetSelection();
                await loadSignature();
                onSignatureChange?.();
            },
            onError: (err) => {
                if (isTimeoutError(err)) {
                    // The upload may have finished anyway: show what is stored now.
                    setError(tCommon('timeoutError'));
                    loadSignature();
                    return;
                }
                setError(getErrorMessage(err) || t('errors.generic'));
            },
            showErrorToast: false,
        }
    );

    const remove = useAsyncAction(
        async () => {
            const response = await api.delete(API_ROUTES.USER_SIGNATURE_DELETE, { user_id: userId }, undefined, undefined, { timeoutMs: REQUEST_TIMEOUT_MS.mutation });
            if (Array.isArray(response) && response[0]?.code >= 400) {
                throw new Error(response[0]?.message || t('errors.generic'));
            }
        },
        {
            onSuccess: async () => {
                toast({ title: t('toast.deleted') });
                setIsDeleteOpen(false);
                resetSelection();
                await loadSignature();
                onSignatureChange?.();
            },
            onError: (err) => { if (isTimeoutError(err)) loadSignature(); },
            errorTitle: t('errors.generic'),
        }
    );

    const isSaving = save.isPending || remove.isPending;

    const shownUrl = previewUrl || currentUrl;

    return (
        <div className={className}>
            <div className="space-y-3">
                <div>
                    <p className="text-sm font-medium text-foreground">{t('label')}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{t('description')}</p>
                </div>

                {/* Dos columnas desde `sm`: la firma y sus acciones a la izquierda,
                    el origen de la imagen a la derecha. En móvil cae a una sola
                    columna y queda el orden firma → guardar → subir/dibujar. */}
                <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start">
                    {/* Columna 1 — la firma y lo que se hace con ella */}
                    <div className="flex flex-col gap-2">
                        <div className="flex h-24 w-full items-center justify-center rounded-md border border-dashed bg-muted/30 p-2 sm:w-56">
                            {isLoading ? (
                                <Skeleton className="h-full w-full" />
                            ) : loadFailed && !previewUrl ? (
                                <div className="flex flex-col items-center gap-1 text-center text-destructive" role="alert">
                                    <span className="text-xs">{tCommon('loadError')}</span>
                                    <Button type="button" size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => loadSignature()}>
                                        {tCommon('retry')}
                                    </Button>
                                </div>
                            ) : shownUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={shownUrl} alt={t('alt')} className="h-full w-full object-contain" />
                            ) : (
                                <div className="flex flex-col items-center gap-1 text-muted-foreground">
                                    <PenLine className="h-5 w-5" />
                                    <span className="text-xs">{t('empty')}</span>
                                </div>
                            )}
                        </div>

                        {canManage && (
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => { if (file) save.run(file); }}
                                    disabled={!file || isSaving}
                                    aria-busy={save.isPending || undefined}
                                >
                                    {save.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
                                    {t('save')}
                                </Button>
                                {file && (
                                    <Button type="button" size="sm" variant="outline" onClick={resetSelection} disabled={isSaving}>
                                        {t('cancel')}
                                    </Button>
                                )}
                                {currentUrl && !file && (
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                        onClick={() => setIsDeleteOpen(true)}
                                        disabled={isSaving}
                                    >
                                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                                        {t('delete')}
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Columna 2 — de dónde sale la imagen */}
                    {canManage && (
                        <div className="flex min-w-0 flex-col gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <Input
                                    ref={inputRef}
                                    type="file"
                                    accept={ACCEPTED_TYPES}
                                    onChange={handleFileChange}
                                    disabled={isSaving}
                                    className="w-full sm:w-auto sm:max-w-xs"
                                />
                                <span className="text-xs text-muted-foreground">{t('or')}</span>
                                <Button type="button" variant="outline" size="sm" onClick={() => setIsPadOpen(true)} disabled={isSaving}>
                                    <Signature className="mr-1.5 h-3.5 w-3.5" />
                                    {t('draw')}
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">{t('hint')}</p>
                            {error && <p className="text-xs text-destructive">{error}</p>}
                        </div>
                    )}
                </div>
            </div>

            <SignaturePadDialog open={isPadOpen} onOpenChange={setIsPadOpen} onConfirm={handleDrawn} />

            <ConfirmActionDialog
                open={isDeleteOpen}
                onOpenChange={setIsDeleteOpen}
                title={t('deleteDialog.title')}
                description={t('deleteDialog.description')}
                cancelLabel={t('deleteDialog.cancel')}
                confirmLabel={t('deleteDialog.confirm')}
                onConfirm={() => remove.run()}
                isPending={remove.isPending}
            />
        </div>
    );
}
