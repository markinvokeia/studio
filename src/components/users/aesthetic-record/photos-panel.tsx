'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Camera, ImageOff, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ImageLightbox } from '@/components/ui/image-viewer';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

import type { AestheticMapView, AestheticPhoto, AestheticPhotoKind } from '@/lib/types';
import type { AestheticPhotoUpload } from '@/services/aesthetic-record';
import { MAP_VIEWS } from './map-templates';
import { PhotoCompare, type PhotoRef } from './photo-compare';
import { useAestheticFileUrl } from './use-aesthetic-file-url';

const PHOTO_KINDS: AestheticPhotoKind[] = ['before', 'after'];

export interface PendingPhoto extends AestheticPhotoUpload {
  key: string;
  previewUrl: string;
}

interface ThumbProps {
  src: string | null | undefined;
  kind: AestheticPhotoKind;
  view: AestheticMapView;
  pending?: boolean;
  onOpen?: () => void;
  onRemove?: () => void;
}

function PhotoThumb({ src, kind, view, pending, onOpen, onRemove }: ThumbProps) {
  const t = useTranslations('AestheticRecord');
  const label = t('photos.optionLabelShort', { kind: t(`photos.kinds.${kind}`), view: t(`views.${view}`) });
  return (
    <div className="group relative aspect-[3/4] overflow-hidden rounded-xl border bg-muted">
      {src === undefined ? (
        <Skeleton className="h-full w-full rounded-none" />
      ) : src ? (
        <button type="button" onClick={onOpen} className="h-full w-full" aria-label={label}>
          {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
          <img src={src} alt={label} className="h-full w-full object-cover" />
        </button>
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-center text-[11px] text-muted-foreground">
          <ImageOff className="h-5 w-5" />
          {t('photos.unavailable')}
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-1.5 bottom-1.5 flex flex-wrap gap-1">
        <Badge className={kind === 'before' ? 'bg-slate-700 text-white' : 'bg-emerald-600 text-white'}>{t(`photos.kinds.${kind}`)}</Badge>
        <Badge variant="secondary" className="bg-background/85">{t(`views.${view}`)}</Badge>
        {pending && <Badge variant="outline" className="bg-background/85">{t('photos.pending')}</Badge>}
      </div>
      {onRemove && (
        <Button
          type="button"
          size="icon"
          variant="secondary"
          onClick={onRemove}
          className="absolute right-1.5 top-1.5 h-7 w-7 rounded-full bg-background/90 shadow"
          aria-label={t('photos.remove', { label })}
          title={t('photos.remove', { label })}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

function StoredPhotoThumb({ photo, onOpen, onRemove }: { photo: AestheticPhoto; onOpen: (src: string, alt: string) => void; onRemove?: () => void }) {
  const t = useTranslations('AestheticRecord');
  const url = useAestheticFileUrl(photo.id);
  return (
    <PhotoThumb
      src={url}
      kind={photo.kind}
      view={photo.view}
      onOpen={url ? () => onOpen(url, t('photos.optionLabelShort', { kind: t(`photos.kinds.${photo.kind}`), view: t(`views.${photo.view}`) })) : undefined}
      onRemove={onRemove}
    />
  );
}

interface PhotosPanelProps {
  /** Photos stored on the session (minus the ones removed in this edit) */
  photos: AestheticPhoto[];
  pending: PendingPhoto[];
  isEditing: boolean;
  /** Every stored photo of the patient for the comparison, oldest first */
  allPhotos: PhotoRef[];
  onAddFiles: (files: File[], kind: AestheticPhotoKind, view: AestheticMapView) => void;
  onRemoveStored: (id: string) => void;
  onRemovePending: (key: string) => void;
}

export function PhotosPanel({ photos, pending, isEditing, allPhotos, onAddFiles, onRemoveStored, onRemovePending }: PhotosPanelProps) {
  const t = useTranslations('AestheticRecord');
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [kind, setKind] = React.useState<AestheticPhotoKind>('before');
  const [view, setView] = React.useState<AestheticMapView>('front');
  const [lightbox, setLightbox] = React.useState<{ src: string; alt: string } | null>(null);
  const isEmpty = photos.length === 0 && pending.length === 0;

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">{t('photos.sessionTitle')}</h3>
        </div>

        {isEditing && (
          <div className="flex flex-col gap-2 rounded-xl border bg-muted/30 p-3 sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label className="text-xs">{t('photos.kind')}</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as AestheticPhotoKind)}>
                <SelectTrigger className="h-9" aria-label={t('photos.kind')}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PHOTO_KINDS.map((k) => <SelectItem key={k} value={k}>{t(`photos.kinds.${k}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label className="text-xs">{t('photos.view')}</Label>
              <Select value={view} onValueChange={(v) => setView(v as AestheticMapView)}>
                <SelectTrigger className="h-9" aria-label={t('photos.view')}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MAP_VIEWS.map((v) => <SelectItem key={v} value={v}>{t(`views.${v}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} className="h-9">
              <Camera className="mr-2 h-4 w-4" />
              {t('photos.add')}
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith('image/'));
                if (files.length) onAddFiles(files, kind, view);
                e.target.value = '';
              }}
            />
          </div>
        )}

        {isEmpty ? (
          <p className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">
            {isEditing ? t('photos.emptyEditing') : t('photos.empty')}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {photos.map((photo) => (
              <StoredPhotoThumb
                key={photo.id}
                photo={photo}
                onOpen={(src, alt) => setLightbox({ src, alt })}
                onRemove={isEditing ? () => onRemoveStored(photo.id) : undefined}
              />
            ))}
            {pending.map((p) => (
              <PhotoThumb
                key={p.key}
                src={p.previewUrl}
                kind={p.kind}
                view={p.view}
                pending
                onOpen={() => setLightbox({ src: p.previewUrl, alt: p.file.name })}
                onRemove={() => onRemovePending(p.key)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">{t('photos.compareTitle')}</h3>
        <PhotoCompare photos={allPhotos} />
      </section>

      {lightbox && <ImageLightbox src={lightbox.src} alt={lightbox.alt} open onClose={() => setLightbox(null)} />}
    </div>
  );
}
