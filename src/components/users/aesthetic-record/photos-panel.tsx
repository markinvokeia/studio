'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { CircleAlert, ImageOff, ImagePlus, Megaphone, X } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ImageLightbox } from '@/components/ui/image-viewer';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

import { cn } from '@/lib/utils';

import type { AestheticConsent, AestheticMapView, AestheticPhoto, AestheticPhotoKind } from '@/lib/types';
import type { AestheticPhotoUpload } from '@/services/aesthetic-record';
import { MAP_VIEWS } from './map-templates';
import { KIND_DOT, PhotoCompare, type PhotoRef } from './photo-compare';
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
    <figure className="group flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="relative aspect-[3/4] bg-muted">
        {src === undefined ? (
          <Skeleton className="h-full w-full rounded-none" />
        ) : src ? (
          <button
            type="button"
            onClick={onOpen}
            className="h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            aria-label={label}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
            <img src={src} alt={label} className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]" />
          </button>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-center text-[11px] text-muted-foreground">
            <ImageOff className="h-5 w-5" />
            {t('photos.unavailable')}
          </div>
        )}
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
      <figcaption className="flex min-w-0 items-center gap-1.5 border-t px-2 py-1.5 text-xs">
        <span className={cn('h-2 w-2 shrink-0 rounded-full', KIND_DOT[kind])} aria-hidden />
        <span className="truncate font-medium text-foreground">{t(`views.${view}`)}</span>
        {pending && <span className="ml-auto shrink-0 text-[10px] font-medium text-amber-600 dark:text-amber-400">{t('photos.pending')}</span>}
      </figcaption>
    </figure>
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
  /** Consent of the session (signed or about to be saved); it decides whether photos may be taken */
  consent: AestheticConsent | null;
  /** Every stored photo of the patient for the comparison, oldest first */
  allPhotos: PhotoRef[];
  onAddFiles: (files: File[], kind: AestheticPhotoKind, view: AestheticMapView) => void;
  onRemoveStored: (id: string) => void;
  onRemovePending: (key: string) => void;
  /** Room for the session photos and the comparison side by side */
  wide?: boolean;
}

export function PhotosPanel({ photos, pending, isEditing, consent, allPhotos, onAddFiles, onRemoveStored, onRemovePending, wide = false }: PhotosPanelProps) {
  const t = useTranslations('AestheticRecord');
  const inputRef = React.useRef<HTMLInputElement>(null);
  /** Kind of the column whose "add" tile opened the file picker */
  const kindRef = React.useRef<AestheticPhotoKind>('before');
  const [view, setView] = React.useState<AestheticMapView>('front');
  const [lightbox, setLightbox] = React.useState<{ src: string; alt: string } | null>(null);
  const isEmpty = photos.length === 0 && pending.length === 0;
  const photosForbidden = consent?.allowsClinicalPhotos === false;

  const canAdd = isEditing && !photosForbidden;

  function openPicker(photoKind: AestheticPhotoKind) {
    kindRef.current = photoKind;
    inputRef.current?.click();
  }

  return (
    <div className={cn('grid items-start gap-4', wide && 'grid-cols-[minmax(0,5fr)_minmax(0,6fr)]')}>
      <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h3 className="text-sm font-semibold text-foreground">{t('photos.sessionTitle')}</h3>
            {consent && !photosForbidden && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <Megaphone className="h-3.5 w-3.5 shrink-0" />
                {consent.allowsMarketingPhotos ? t('photos.marketingAllowed') : t('photos.marketingNotAllowed')}
              </span>
            )}
          </div>
          {canAdd && (
            <div className="flex items-center gap-2">
              <Label htmlFor="aes-photo-view" className="text-xs text-muted-foreground">{t('photos.newView')}</Label>
              <Select value={view} onValueChange={(v) => setView(v as AestheticMapView)}>
                <SelectTrigger id="aes-photo-view" className="h-8 w-auto min-w-[120px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MAP_VIEWS.map((v) => <SelectItem key={v} value={v}>{t(`views.${v}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {photosForbidden ? (
          <Alert variant={isEmpty ? 'default' : 'destructive'}>
            <CircleAlert className="h-4 w-4" />
            <AlertDescription>{isEmpty ? t('photos.forbiddenByConsent') : t('photos.forbiddenRemove')}</AlertDescription>
          </Alert>
        ) : isEditing && !consent && (
          <Alert>
            <CircleAlert className="h-4 w-4" />
            <AlertDescription>{t('photos.noConsentWarning')}</AlertDescription>
          </Alert>
        )}

        {isEmpty && !canAdd ? (
          !photosForbidden && <p className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">{t('photos.empty')}</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {PHOTO_KINDS.map((photoKind) => {
              const stored = photos.filter((photo) => photo.kind === photoKind);
              const unsaved = pending.filter((p) => p.kind === photoKind);
              const count = stored.length + unsaved.length;
              const kindLabel = t(`photos.kinds.${photoKind}`);
              return (
                <div key={photoKind} className="flex min-w-0 flex-col gap-2 rounded-xl border bg-muted/20 p-2">
                  <span className="inline-flex items-center gap-1.5 px-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <span className={cn('h-2 w-2 rounded-full', KIND_DOT[photoKind])} aria-hidden />
                    {kindLabel}
                    <span className="font-normal">({count})</span>
                  </span>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2">
                    {stored.map((photo) => (
                      <StoredPhotoThumb
                        key={photo.id}
                        photo={photo}
                        onOpen={(src, alt) => setLightbox({ src, alt })}
                        onRemove={isEditing ? () => onRemoveStored(photo.id) : undefined}
                      />
                    ))}
                    {unsaved.map((p) => (
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
                    {canAdd && (
                      <button
                        type="button"
                        onClick={() => openPicker(photoKind)}
                        aria-label={t('photos.addKind', { kind: kindLabel, view: t(`views.${view}`) })}
                        title={t('photos.addKind', { kind: kindLabel, view: t(`views.${view}`) })}
                        className="flex aspect-[3/4] flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed bg-background/60 p-2 text-center text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/60 hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <ImagePlus className="h-5 w-5" />
                        {t('photos.add')}
                        <span className="font-normal">{t(`views.${view}`)}</span>
                      </button>
                    )}
                    {!count && !canAdd && (
                      <p className="col-span-full py-6 text-center text-[11px] text-muted-foreground">{t('photos.emptyKind')}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith('image/'));
            if (files.length) onAddFiles(files, kindRef.current, view);
            e.target.value = '';
          }}
        />
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm">
        <PhotoCompare photos={allPhotos} title={t('photos.compareTitle')} />
      </section>

      {lightbox && <ImageLightbox src={lightbox.src} alt={lightbox.alt} open onClose={() => setLightbox(null)} />}
    </div>
  );
}
