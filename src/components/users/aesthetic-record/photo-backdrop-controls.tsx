'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { FlipHorizontal2, ImageIcon, Move, RotateCcw, SlidersHorizontal } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';

import { cn, formatDisplayDate } from '@/lib/utils';

import type { AestheticPhoto, AestheticPhotoAlignment } from '@/lib/types';
import { BACKDROP_MAX_SCALE, BACKDROP_MIN_SCALE } from './aesthetic-map';
import { KIND_DOT } from './photo-compare';

export const DEFAULT_PHOTO_ALIGNMENT: AestheticPhotoAlignment = { x: 0.5, y: 0.5, scale: 1, rotation: 0, mirrored: false };

const MAX_ROTATION = 45;

/** A photo that can sit behind the map: stored, or taken in the open edit and not saved yet */
export interface BackdropRef {
  photo: Pick<AestheticPhoto, 'id' | 'kind' | 'view' | 'alignment'>;
  date: string;
  /** Object URL of a photo that is not saved yet (its `photo.id` is the pending key) */
  previewUrl?: string;
}

interface PhotoBackdropToolbarProps {
  /** Photos of the current view, the preferred one first */
  candidates: BackdropRef[];
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  selected: BackdropRef | null;
  onSelect: (photoId: string) => void;
  /** `undefined` while loading, `null` when the file is not in this browser */
  url: string | null | undefined;
  opacity: number;
  onOpacityChange: (opacity: number) => void;
  hideArt: boolean;
  onHideArtChange: (hide: boolean) => void;
  canAdjust: boolean;
  isAdjusting: boolean;
  onStartAdjust: () => void;
  /** Stacked in the map's rail instead of laid out in a row */
  vertical?: boolean;
}

/** Icon buttons for the map's controls: the photo switch and its settings */
export function PhotoBackdropToolbar({
  candidates,
  enabled,
  onEnabledChange,
  selected,
  onSelect,
  url,
  opacity,
  onOpacityChange,
  hideArt,
  onHideArtChange,
  canAdjust,
  isAdjusting,
  onStartAdjust,
  vertical = false,
}: PhotoBackdropToolbarProps) {
  const t = useTranslations('AestheticRecord');
  const hasPhotos = candidates.length > 0;
  const isOn = enabled && hasPhotos;
  const describe = (ref: BackdropRef) =>
    t('map.backdrop.option', { kind: t(`photos.kinds.${ref.photo.kind}`), date: formatDisplayDate(ref.date) }) + (ref.previewUrl ? ` · ${t('photos.pending')}` : '');
  const toggleLabel = hasPhotos ? t('map.backdrop.toggle') : t('map.backdrop.noPhotos');

  const size = vertical ? 'h-9 w-9' : 'h-8 w-8';
  const idleVariant = vertical ? 'ghost' : 'outline';

  return (
    <div className={cn('flex shrink-0 gap-1', vertical ? 'flex-col rounded-xl border bg-card/90 p-0.5 shadow-sm backdrop-blur-sm' : 'items-center')}>
      <Button
        type="button"
        size="icon"
        variant={isOn ? 'default' : idleVariant}
        aria-pressed={isOn}
        onClick={() => onEnabledChange(!enabled)}
        disabled={!hasPhotos || isAdjusting}
        aria-label={toggleLabel}
        title={toggleLabel}
        className={size}
      >
        <ImageIcon className="h-3.5 w-3.5" />
      </Button>
      {isOn && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant={idleVariant}
              disabled={isAdjusting}
              className={cn('relative', size)}
              aria-label={t('map.backdrop.settings')}
              title={t('map.backdrop.settings')}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {url && !selected?.photo.alignment && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-500" aria-hidden />}
            </Button>
          </PopoverTrigger>
          <PopoverContent side={vertical ? 'right' : 'bottom'} align={vertical ? 'start' : 'end'} className="flex w-72 flex-col gap-3 p-3">
            {candidates.length > 1 ? (
              <Select value={selected?.photo.id} onValueChange={onSelect}>
                <SelectTrigger className="h-8 text-xs" aria-label={t('map.backdrop.photo')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((ref) => (
                    <SelectItem key={ref.photo.id} value={ref.photo.id}>
                      <span className="inline-flex items-center gap-1.5">
                        <span className={cn('h-2 w-2 shrink-0 rounded-full', KIND_DOT[ref.photo.kind])} aria-hidden />
                        {describe(ref)}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : selected && (
              <span className="inline-flex min-w-0 items-center gap-1.5 truncate text-xs font-medium text-foreground">
                <span className={cn('h-2 w-2 shrink-0 rounded-full', KIND_DOT[selected.photo.kind])} aria-hidden />
                {describe(selected)}
              </span>
            )}

            {url === null ? (
              <p className="text-xs text-muted-foreground">{t('photos.unavailable')}</p>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <Label className="w-20 shrink-0 text-xs">{t('map.backdrop.opacity')}</Label>
                  <Slider
                    value={[Math.round(opacity * 100)]}
                    min={20}
                    max={100}
                    step={5}
                    onValueChange={([v]) => onOpacityChange(v / 100)}
                    aria-label={t('map.backdrop.opacity')}
                  />
                </div>
                <Label className="inline-flex cursor-pointer items-center gap-2 text-xs">
                  <Switch checked={hideArt} onCheckedChange={onHideArtChange} />
                  {t('map.backdrop.hideArt')}
                </Label>
                {!selected?.photo.alignment && (
                  <p className="text-[11px] leading-snug text-muted-foreground">{t('map.backdrop.notAligned')}</p>
                )}
                {canAdjust && url && (
                  <Button type="button" size="sm" variant="outline" onClick={onStartAdjust} className="h-8">
                    <Move className="mr-1.5 h-3.5 w-3.5" />
                    {selected?.photo.alignment ? t('map.backdrop.adjust') : t('map.backdrop.align')}
                  </Button>
                )}
              </>
            )}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

interface PhotoBackdropAdjustProps {
  alignment: AestheticPhotoAlignment;
  onChange: (alignment: AestheticPhotoAlignment) => void;
  onCancel: () => void;
  onSave: () => void;
  isSaving: boolean;
  /** Placement "reset" goes back to (the automatic fit of the photo) */
  resetTo?: AestheticPhotoAlignment;
}

/** Shown under the map controls only while a photo is being aligned */
export function PhotoBackdropAdjust({ alignment, onChange, onCancel, onSave, isSaving, resetTo = DEFAULT_PHOTO_ALIGNMENT }: PhotoBackdropAdjustProps) {
  const t = useTranslations('AestheticRecord');

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-amber-500/50 bg-amber-500/5 p-2.5">
      <p className="text-[11px] leading-snug text-muted-foreground">{t('map.backdrop.adjustHint')}</p>
      <div className="flex items-center gap-3">
        <Label className="w-20 shrink-0 text-xs">{t('map.backdrop.zoom')}</Label>
        <Slider
          value={[alignment.scale]}
          min={BACKDROP_MIN_SCALE}
          max={BACKDROP_MAX_SCALE}
          step={0.01}
          onValueChange={([v]) => onChange({ ...alignment, scale: v })}
          aria-label={t('map.backdrop.zoom')}
        />
      </div>
      <div className="flex items-center gap-3">
        <Label className="w-20 shrink-0 text-xs">{t('map.backdrop.rotation')}</Label>
        <Slider
          value={[alignment.rotation]}
          min={-MAX_ROTATION}
          max={MAX_ROTATION}
          step={0.5}
          onValueChange={([v]) => onChange({ ...alignment, rotation: v })}
          aria-label={t('map.backdrop.rotation')}
        />
        <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">{alignment.rotation}°</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={alignment.mirrored ? 'default' : 'outline'}
          aria-pressed={alignment.mirrored}
          onClick={() => onChange({ ...alignment, mirrored: !alignment.mirrored })}
          disabled={isSaving}
          className="h-8"
        >
          <FlipHorizontal2 className="mr-1.5 h-3.5 w-3.5" />
          {t('map.backdrop.mirror')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => onChange({ ...resetTo, mirrored: alignment.mirrored })}
          disabled={isSaving}
          className="h-8"
        >
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          {t('map.backdrop.reset')}
        </Button>
        <div className="ml-auto flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onCancel} disabled={isSaving} className="h-8">
            {t('cancel')}
          </Button>
          <Button type="button" size="sm" onClick={onSave} loading={isSaving} className="h-8">
            {t('map.backdrop.saveAlignment')}
          </Button>
        </div>
      </div>
    </div>
  );
}
