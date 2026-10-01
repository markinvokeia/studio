'use client';

import { ImageIcon, Loader2, Trash2, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { ConfirmActionDialog } from '@/components/ui/confirm-action-dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

import { API_ROUTES } from '@/constants/routes';
import {
  MAX_SERVICE_IMAGE_BYTES,
  MAX_SERVICE_IMAGE_MB,
  RECOMMENDED_SERVICE_IMAGE,
  SERVICE_IMAGE_ACCEPTED_TYPES,
  SERVICE_IMAGE_MAX_RENDER_PX,
} from '@/constants/service-image';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/error-utils';
import { cn } from '@/lib/utils';
import api, { isTimeoutError, REQUEST_TIMEOUT_MS } from '@/services/api';

interface ServiceImageUploaderProps {
  /**
   * Servicio dueño de la imagen. `null` ⇒ el servicio todavía no existe (se
   * está creando): el archivo se elige igual, pero se sube después de guardar.
   */
  serviceId: string | null;
  /** `false` ⇒ sólo se muestra la imagen actual, sin acciones. */
  canManage?: boolean;
  className?: string;
  /**
   * Sólo en modo creación: el archivo elegido se entrega a quien nos monta,
   * que lo sube cuando el servicio ya tiene id.
   */
  onPendingFileChange?: (file: File | null) => void;
  /** Se invoca tras guardar o borrar, para refrescar quien la use. */
  onImageChange?: () => void;
}

/**
 * Sube y muestra la imagen de un servicio del catálogo.
 *
 * Mismo mecanismo que el logo de la clínica y la firma del doctor: el archivo
 * vive en Google Drive y la imagen se pide siempre al webhook
 * `GET /services/image?service_id=…`, nunca a una URL de Drive directa (la auth
 * la resuelve n8n).
 *
 * La imagen sólo se ve en el portal del paciente, en las tarjetas del paso de
 * selección de servicios, así que conviene que sea reconocible en chico.
 */
export function ServiceImageUploader({
  serviceId,
  canManage = false,
  className,
  onPendingFileChange,
  onImageChange,
}: ServiceImageUploaderProps) {
  const t = useTranslations('ServiceImageUploader');
  const tCommon = useTranslations('Common');
  const { toast } = useToast();

  const [currentUrl, setCurrentUrl] = React.useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [isLoading, setIsLoading] = React.useState(!!serviceId);
  // Un fetch fallido no es "no hay imagen": ofrecer subir o borrar sobre un
  // estado desconocido sería engañoso.
  const [loadFailed, setLoadFailed] = React.useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const loadImage = React.useCallback(async () => {
    if (!serviceId) {
      setCurrentUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setLoadFailed(false);
    let objectUrl: string | null = null;
    try {
      const blob = (await api.getBlob(API_ROUTES.SERVICE_IMAGE, { service_id: serviceId })) as unknown as Blob;
      objectUrl = blob?.size > 0 ? URL.createObjectURL(blob) : null;
    } catch (err) {
      // 404/204 = el servicio no tiene imagen todavía; el resto es un fallo real.
      const status = (err as { status?: number } | null)?.status;
      if (status !== 404 && status !== 204) setLoadFailed(true);
      objectUrl = null;
    }
    setCurrentUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return objectUrl;
    });
    setIsLoading(false);
  }, [serviceId]);

  React.useEffect(() => {
    loadImage();
  }, [loadImage]);

  // Los object URLs vivos al desmontar hay que liberarlos a mano.
  React.useEffect(
    () => () => {
      setCurrentUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    },
    [],
  );

  const resetSelection = () => {
    setFile(null);
    setPreviewUrl(null);
    setError(null);
    onPendingFileChange?.(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (!selected) return;
    if (selected.size > MAX_SERVICE_IMAGE_BYTES) {
      setError(t('errors.tooLarge', { maxMb: MAX_SERVICE_IMAGE_MB }));
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    setError(null);
    setFile(selected);
    // En modo creación no hay a dónde subirlo todavía: lo guarda quien nos monta.
    onPendingFileChange?.(selected);
    const reader = new FileReader();
    reader.onloadend = () => setPreviewUrl(reader.result as string);
    reader.readAsDataURL(selected);
  };

  const save = useAsyncAction(
    async (selected: File) => {
      if (!serviceId) return;
      setError(null);
      const formData = new FormData();
      formData.append('service_id', serviceId);
      formData.append('data', selected);
      const response = await api.post(API_ROUTES.SERVICE_IMAGE_UPLOAD, formData, undefined, undefined, {
        timeoutMs: REQUEST_TIMEOUT_MS.mutation,
      });
      if (Array.isArray(response) && response[0]?.code >= 400) {
        throw new Error(response[0]?.message || t('errors.generic'));
      }
    },
    {
      onSuccess: async () => {
        toast({ title: t('toast.saved') });
        resetSelection();
        await loadImage();
        onImageChange?.();
      },
      onError: (err) => {
        if (isTimeoutError(err)) {
          // Puede haber terminado igual: se muestra lo que hay guardado ahora.
          setError(tCommon('timeoutError'));
          loadImage();
          return;
        }
        setError(getErrorMessage(err) || t('errors.generic'));
      },
      showErrorToast: false,
    },
  );

  const remove = useAsyncAction(
    async () => {
      if (!serviceId) return;
      const response = await api.post(
        API_ROUTES.SERVICE_IMAGE_DELETE,
        { service_id: serviceId },
        undefined,
        undefined,
        { timeoutMs: REQUEST_TIMEOUT_MS.mutation },
      );
      if (Array.isArray(response) && response[0]?.code >= 400) {
        throw new Error(response[0]?.message || t('errors.generic'));
      }
    },
    {
      onSuccess: async () => {
        toast({ title: t('toast.deleted') });
        setIsDeleteOpen(false);
        resetSelection();
        await loadImage();
        onImageChange?.();
      },
      onError: (err) => {
        if (isTimeoutError(err)) loadImage();
      },
      errorTitle: t('errors.generic'),
    },
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

        <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start">
          {/* Columna 1 — la imagen y lo que se hace con ella */}
          <div className="flex flex-col gap-2">
            {/* La vista previa usa el MISMO ancho que la tarjeta en el portal y
                muestra la imagen entera, sin recortar: es la única forma de que
                quien la sube vea de antemano lo que va a ver el paciente.
                Mientras no hay imagen se reserva la proporción recomendada. */}
            <div
              className={cn(
                'flex w-full items-center justify-center overflow-hidden rounded-md border border-dashed bg-muted/30',
                !shownUrl || isLoading ? 'aspect-[16/9]' : null,
              )}
              style={{ maxWidth: SERVICE_IMAGE_MAX_RENDER_PX }}
            >
              {isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : loadFailed && !previewUrl ? (
                <div className="flex flex-col items-center gap-1 px-2 text-center text-destructive" role="alert">
                  <span className="text-xs">{tCommon('loadError')}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-xs"
                    onClick={() => loadImage()}
                  >
                    {tCommon('retry')}
                  </Button>
                </div>
              ) : shownUrl ? (
                // `h-auto`: el alto sale de la proporción del archivo. Ni
                // recorte ni deformación — lo mismo que hace el portal.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={shownUrl} alt={t('alt')} className="h-auto w-full" />
              ) : (
                <div className="flex flex-col items-center gap-1 text-muted-foreground">
                  <ImageIcon className="h-5 w-5" />
                  <span className="text-xs">{t('empty')}</span>
                </div>
              )}
            </div>

            {canManage && serviceId && (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    if (file) save.run(file);
                  }}
                  disabled={!file || isSaving}
                  aria-busy={save.isPending || undefined}
                >
                  {save.isPending ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="mr-1.5 h-3.5 w-3.5" />
                  )}
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
              <Input
                ref={inputRef}
                type="file"
                accept={SERVICE_IMAGE_ACCEPTED_TYPES}
                onChange={handleFileChange}
                disabled={isSaving}
                className="w-full sm:max-w-xs"
              />
              <p className="text-xs text-muted-foreground">
                {t('hint', {
                  width: RECOMMENDED_SERVICE_IMAGE.width,
                  height: RECOMMENDED_SERVICE_IMAGE.height,
                  maxMb: MAX_SERVICE_IMAGE_MB,
                })}
              </p>
              <p className="text-xs text-muted-foreground">{t('ratioHint')}</p>
              {/* En creación no hay servicio al que subirla: se avisa que se
                  guarda junto con el resto del formulario. */}
              {!serviceId && file && <p className="text-xs text-muted-foreground">{t('pendingCreate')}</p>}
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
          )}
        </div>
      </div>

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

/**
 * Sube la imagen que quedó pendiente durante la creación de un servicio.
 *
 * Vive acá y no en el componente porque quien la dispara es el submit del
 * formulario, ya con el id que devolvió el upsert. Nunca lanza: el servicio ya
 * se creó, y perder la imagen no puede hacer fallar la operación entera.
 */
export async function uploadPendingServiceImage(serviceId: string, file: File): Promise<boolean> {
  try {
    const formData = new FormData();
    formData.append('service_id', serviceId);
    formData.append('data', file);
    const response = await api.post(API_ROUTES.SERVICE_IMAGE_UPLOAD, formData, undefined, undefined, {
      timeoutMs: REQUEST_TIMEOUT_MS.mutation,
    });
    if (Array.isArray(response) && response[0]?.code >= 400) return false;
    return true;
  } catch (error) {
    console.error('Failed to upload the service image:', error);
    return false;
  }
}
