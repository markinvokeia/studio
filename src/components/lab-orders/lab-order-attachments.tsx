'use client';

import * as React from 'react';
import { Box, Download, FileText, Image as ImageIcon, Loader2, Paperclip, Plus, Trash2, Upload, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { ConfirmActionDialog } from '@/components/ui/confirm-action-dialog';

import { useLabOrderErrorText } from '@/components/lab-orders/lab-order-shared';

import { useAsyncAction } from '@/hooks/use-async-action';
import { toast } from '@/hooks/use-toast';
import { cn, formatUtcDateTime } from '@/lib/utils';
import { REQUEST_TIMEOUT_MS } from '@/services/api';
import { deleteLabOrderAttachment, fetchLabOrderAttachment, uploadLabOrderAttachments } from '@/services/lab-orders';

import type { LabOrderAttachment } from '@/lib/types';

/**
 * Adjuntos de una orden de laboratorio (script 173): fotos, PDF y escaneos 3D. Se guardan como
 * los de las sesiones de la historia clínica (tabla attachments + Google Drive). Los mismos
 * límites los valida el flujo de n8n.
 */
export const LAB_ATTACHMENT_MAX_FILES = 10;
export const LAB_ATTACHMENT_MAX_MB = 10;
const MAX_BYTES = LAB_ATTACHMENT_MAX_MB * 1024 * 1024;
const SCAN_EXT = /\.(stl|ply|obj)$/i;
/** Para el selector de archivos: imágenes, PDF y escaneos intraorales (STL/PLY/OBJ). */
export const LAB_ATTACHMENT_ACCEPT = 'image/*,application/pdf,.pdf,.stl,.ply,.obj';

type AttachmentKind = 'image' | 'pdf' | 'scan' | 'other';

function kindOf(name: string, mime: string | null | undefined): AttachmentKind {
  if (mime?.startsWith('image/')) return 'image';
  if (mime === 'application/pdf' || /\.pdf$/i.test(name)) return 'pdf';
  if (SCAN_EXT.test(name)) return 'scan';
  return 'other';
}

function isAllowed(file: File): boolean {
  return kindOf(file.name, file.type) !== 'other';
}

const KIND_ICON: Record<AttachmentKind, React.ComponentType<{ className?: string }>> = {
  image: ImageIcon,
  pdf: FileText,
  scan: Box,
  other: Paperclip,
};

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Filtra los archivos elegidos: tipo, tamaño y cupo (`room` = cuántos entran todavía). Devuelve los
 * que entran y por qué quedaron afuera los otros (se muestra junto a la zona, no en un toast: el
 * aviso de "agregados" lo taparía).
 */
function useFilterAttachments() {
  const t = useTranslations('LabOrdersPage.attachments');
  return React.useCallback((files: File[], room: number): { accepted: File[]; problems: string[] } => {
    const accepted: File[] = [];
    const problems: string[] = [];
    for (const file of files) {
      if (!isAllowed(file)) problems.push(t('invalidType', { name: file.name }));
      else if (file.size > MAX_BYTES) problems.push(t('tooLarge', { name: file.name, max: LAB_ATTACHMENT_MAX_MB }));
      else if (accepted.length >= room) problems.push(t('tooMany', { max: LAB_ATTACHMENT_MAX_FILES }));
      else accepted.push(file);
    }
    return { accepted, problems: Array.from(new Set(problems)) };
  }, [t]);
}

/** Lo que quedó afuera en la última selección. */
function RejectedFiles({ problems }: { problems: string[] }) {
  const t = useTranslations('LabOrdersPage.attachments');
  if (problems.length === 0) return null;
  return (
    <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
      <p className="font-medium">{t('rejectedTitle')}</p>
      <ul className="mt-0.5 list-disc pl-4">
        {problems.map((problem) => <li key={problem}>{problem}</li>)}
      </ul>
    </div>
  );
}

/** Zona para elegir o soltar archivos. */
function AttachmentDropZone({
  onFiles, disabled, compact = false, helpId,
}: { onFiles: (files: File[]) => void; disabled?: boolean; compact?: boolean; helpId: string }) {
  const t = useTranslations('LabOrdersPage.attachments');
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = React.useState(false);

  const pick = (list: FileList | null) => {
    if (list?.length) onFiles(Array.from(list));
  };

  return (
    <div
      onDragOver={(e) => { if (disabled) return; e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); if (!disabled) pick(e.dataTransfer.files); }}
      className={cn(
        'rounded-lg border border-dashed border-border transition-colors',
        dragOver && 'border-primary bg-primary/5',
        compact ? 'p-2' : 'p-3',
      )}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={LAB_ATTACHMENT_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => { pick(e.target.files); e.target.value = ''; }}
      />
      <div className={cn('flex items-center gap-3', compact ? 'justify-between' : 'flex-col text-center sm:flex-row sm:text-left')}>
        <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <Upload className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{t('dropHint', { max: LAB_ATTACHMENT_MAX_MB })}</span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-help-id={helpId}
          className="shrink-0 sm:ml-auto"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          {t('add')}
        </Button>
      </div>
    </div>
  );
}

function AttachmentRow({
  name, kind, meta, actions,
}: { name: string; kind: AttachmentKind; meta?: React.ReactNode; actions: React.ReactNode }) {
  const Icon = KIND_ICON[kind];
  return (
    <li className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm" title={name}>{name}</p>
        {meta && <p className="truncate text-[11px] text-muted-foreground">{meta}</p>}
      </div>
      <div className="flex shrink-0 items-center">{actions}</div>
    </li>
  );
}

export interface LabOrderAttachmentPickerProps {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
}

/** Archivos elegidos en el alta: se suben después de crear la orden. */
export function LabOrderAttachmentPicker({ files, onChange, disabled }: LabOrderAttachmentPickerProps) {
  const t = useTranslations('LabOrdersPage.attachments');
  const filterFiles = useFilterAttachments();
  const [rejected, setRejected] = React.useState<string[]>([]);
  const full = files.length >= LAB_ATTACHMENT_MAX_FILES;

  return (
    <section data-help-id="lab-orders.section.form-attachments" className="space-y-2">
      <div>
        <p className="text-sm font-medium">{t('title')}</p>
        <p className="text-xs text-muted-foreground">{t('formHint')}</p>
      </div>
      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((file, index) => (
            <AttachmentRow
              key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
              name={file.name}
              kind={kindOf(file.name, file.type)}
              meta={formatSize(file.size)}
              actions={(
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive"
                  aria-label={t('remove', { name: file.name })}
                  onClick={() => onChange(files.filter((_, i) => i !== index))}
                  disabled={disabled}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            />
          ))}
        </ul>
      )}
      {!full && (
        <AttachmentDropZone
          helpId="lab-orders.btn.add-attachment"
          disabled={disabled}
          compact={files.length > 0}
          onFiles={(picked) => {
            const { accepted, problems } = filterFiles(picked, LAB_ATTACHMENT_MAX_FILES - files.length);
            setRejected(problems);
            if (accepted.length) onChange([...files, ...accepted]);
          }}
        />
      )}
      <RejectedFiles problems={rejected} />
    </section>
  );
}

/** Guarda el blob con su nombre (o lo abre en otra pestaña si es imagen/PDF y `open`). */
function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || 'archivo';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export interface LabOrderAttachmentsSectionProps {
  orderId: number;
  attachments: LabOrderAttachment[];
  /** Puede agregar y quitar (permiso de editar la orden y no es solo lectura). */
  canEdit: boolean;
  /** Después de subir o quitar: la lista que quedó. */
  onChange: (attachments: LabOrderAttachment[]) => void;
}

/** Adjuntos en el detalle: descargar, agregar y quitar. */
export function LabOrderAttachmentsSection({ orderId, attachments, canEdit, onChange }: LabOrderAttachmentsSectionProps) {
  const t = useTranslations('LabOrdersPage.attachments');
  const errorText = useLabOrderErrorText();
  const filterFiles = useFilterAttachments();
  const [downloadingId, setDownloadingId] = React.useState<number | null>(null);
  const [toDelete, setToDelete] = React.useState<LabOrderAttachment | null>(null);
  const [uploadingCount, setUploadingCount] = React.useState(0);
  const [rejected, setRejected] = React.useState<string[]>([]);

  const upload = useAsyncAction(
    (files: File[]) => uploadLabOrderAttachments(orderId, files, { timeoutMs: REQUEST_TIMEOUT_MS.longRunning }),
    {
      onSuccess: (list) => {
        onChange(list);
        toast({ title: t('uploaded') });
      },
      describeError: errorText,
      errorTitle: t('uploadError'),
    },
  );

  const remove = useAsyncAction(
    (attachment: LabOrderAttachment) => deleteLabOrderAttachment(orderId, attachment.id, { timeoutMs: REQUEST_TIMEOUT_MS.mutation }),
    {
      onSuccess: (list) => {
        onChange(list);
        setToDelete(null);
        toast({ title: t('removed') });
      },
      describeError: errorText,
      errorTitle: t('removeError'),
    },
  );

  const download = useAsyncAction(
    async (attachment: LabOrderAttachment) => {
      setDownloadingId(attachment.id);
      try {
        const blob = await fetchLabOrderAttachment(orderId, attachment.id, { timeoutMs: REQUEST_TIMEOUT_MS.longRunning });
        saveBlob(blob, attachment.file_name);
      } finally {
        setDownloadingId(null);
      }
    },
    { describeError: errorText, errorTitle: t('downloadError') },
  );

  const room = LAB_ATTACHMENT_MAX_FILES - attachments.length;

  return (
    <div data-help-id="lab-orders.section.detail-attachments" className="space-y-2">
      {attachments.length === 0 && !upload.isPending && (
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      )}
      {(attachments.length > 0 || upload.isPending) && (
        <ul className="space-y-1.5">
          {attachments.map((attachment) => (
            <AttachmentRow
              key={attachment.id}
              name={attachment.file_name}
              kind={kindOf(attachment.file_name, attachment.mime_type)}
              meta={attachment.created_at ? formatUtcDateTime(attachment.created_at) : undefined}
              actions={(
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    data-help-id="lab-orders.btn.download-attachment"
                    aria-label={t('download', { name: attachment.file_name })}
                    title={t('download', { name: attachment.file_name })}
                    onClick={() => download.run(attachment)}
                    disabled={download.isPending}
                  >
                    {downloadingId === attachment.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  </Button>
                  {canEdit && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive"
                      data-help-id="lab-orders.btn.remove-attachment"
                      aria-label={t('remove', { name: attachment.file_name })}
                      title={t('remove', { name: attachment.file_name })}
                      onClick={() => setToDelete(attachment)}
                      disabled={remove.isPending || upload.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </>
              )}
            />
          ))}
          {upload.isPending && (
            <li className="flex items-center gap-2 rounded-md border border-dashed border-border px-2 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t('uploading', { count: uploadingCount })}
            </li>
          )}
        </ul>
      )}
      {canEdit && room > 0 && (
        <AttachmentDropZone
          helpId="lab-orders.btn.upload-attachment"
          compact
          disabled={upload.isPending}
          onFiles={(picked) => {
            const { accepted, problems } = filterFiles(picked, room);
            setRejected(problems);
            if (!accepted.length) return;
            setUploadingCount(accepted.length);
            void upload.run(accepted);
          }}
        />
      )}
      <RejectedFiles problems={rejected} />

      <ConfirmActionDialog
        open={toDelete !== null}
        onOpenChange={(open) => { if (!open) setToDelete(null); }}
        title={t('removeTitle')}
        description={t('removeDescription', { name: toDelete?.file_name ?? '' })}
        confirmLabel={t('removeConfirm')}
        cancelLabel={t('cancel')}
        onConfirm={() => { if (toDelete) void remove.run(toDelete); }}
        isPending={remove.isPending}
      />
    </div>
  );
}
