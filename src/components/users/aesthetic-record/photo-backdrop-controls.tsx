'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { FlipHorizontal2, ImageIcon, Move, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';

import { cn, formatDisplayDate } from '@/lib/utils';

import type { AestheticPhotoAlignment } from '@/lib/types';
import { BACKDROP_MAX_SCALE, BACKDROP_MIN_SCALE } from './aesthetic-map';
import { KIND_DOT, type PhotoRef } from './photo-compare';

export const DEFAULT_PHOTO_ALIGNMENT: AestheticPhotoAlignment = { x: 0.5, y: 0.5, scale: 1, rotation: 0, mirrored: false };

const MAX_ROTATION = 45;

interface PhotoBackdropControlsProps {
  /** Photos of the current view, the preferred one first */
  candidates: PhotoRef[];
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  selected: PhotoRef | null;
  onSelect: (photoId: string) => void;
  /** `undefined` while loading, `null` when the file is not in this browser */
  url: string | null | undefined;
  opacity: number;
  onOpacityChange: (opacity: number) => void;
  hideArt: boolean;
  onHideArtChange: (hide: boolean) => void;
  canAdjust: boolean;
  /** Alignment being edited; `null` when not adjusting */
  adjusting: AestheticPhotoAlignment | null;
  onStartAdjust: () => void;
  onAdjustChange: (alignment: AestheticPhotoAlignment) => void;
  onCancelAdjust: () => void;
  onSaveAdjust: () => void;
  isSaving: boolean;
}

export function PhotoBackdropControls({
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
  adjusting,
  onStartAdjust,
  onAdjustChange,
  onCancelAdjust,
  onSaveAdjust,
  isSaving,
}: PhotoBackdropControlsProps) {
  const t = useTranslations('AestheticRecord');
  const hasPhotos = candidates.length > 0;
  const describe = (ref: PhotoRef) =>
    t('map.backdrop.option', { kind: t(`photos.kinds.${ref.photo.kind}`), date: formatDisplayDate(ref.session.date) });

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={enabled && hasPhotos ? 'default' : 'outline'}
          aria-pressed={enabled && hasPhotos}
          onClick={() => onEnabledChange(!enabled)}
          disabled={!hasPhotos || !!adjusting}
          title={hasPhotos ? undefined : t('map.backdrop.noPhotos')}
          className="h-8"
        >
          <ImageIcon className="mr-1.5 h-3.5 w-3.5" />
          {t('map.backdrop.toggle')}
        </Button>
        {enabled && hasPhotos && candidates.length > 1 && (
          <Select value={selected?.photo.id} onValueChange={onSelect} disabled={!!adjusting}>
            <SelectTrigger className="h-8 min-w-0 flex-1 text-xs" aria-label={t('map.backdrop.photo')}>
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
        )}
        {enabled && hasPhotos && candidates.length === 1 && selected && (
          <span className="inline-flex min-w-0 items-center gap-1.5 truncate text-xs text-muted-foreground">
            <span className={cn('h-2 w-2 shrink-0 rounded-full', KIND_DOT[selected.photo.kind])} aria-hidden />
            {describe(selected)}
          </span>
        )}
      </div>

      {enabled && hasPhotos && url === null && (
        <p className="text-xs text-muted-foreground">{t('photos.unavailable')}</p>
      )}

      {enabled && hasPhotos && url && !adjusting && (
        <div className="flex flex-col gap-2.5 rounded-xl border bg-muted/30 p-2.5">
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label className="inline-flex cursor-pointer items-center gap-2 text-xs">
              <Switch checked={hideArt} onCheckedChange={onHideArtChange} />
              {t('map.backdrop.hideArt')}
            </Label>
            {canAdjust && (
              <Button type="button" size="sm" variant="outline" onClick={onStartAdjust} className="h-8">
                <Move className="mr-1.5 h-3.5 w-3.5" />
                {selected?.photo.alignment ? t('map.backdrop.adjust') : t('map.backdrop.align')}
              </Button>
            )}
          </div>
          {!selected?.photo.alignment && (
            <p className="text-[11px] leading-snug text-muted-foreground">{t('map.backdrop.notAligned')}</p>
          )}
        </div>
      )}

      {adjusting && (
        <div className="flex flex-col gap-2.5 rounded-xl border border-amber-500/50 bg-amber-500/5 p-2.5">
          <p className="text-[11px] leading-snug text-muted-foreground">{t('map.backdrop.adjustHint')}</p>
          <div className="flex items-center gap-3">
            <Label className="w-20 shrink-0 text-xs">{t('map.backdrop.zoom')}</Label>
            <Slider
              value={[adjusting.scale]}
              min={BACKDROP_MIN_SCALE}
              max={BACKDROP_MAX_SCALE}
              step={0.01}
              onValueChange={([v]) => onAdjustChange({ ...adjusting, scale: v })}
              aria-label={t('map.backdrop.zoom')}
            />
          </div>
          <div className="flex items-center gap-3">
            <Label className="w-20 shrink-0 text-xs">{t('map.backdrop.rotation')}</Label>
            <Slider
              value={[adjusting.rotation]}
              min={-MAX_ROTATION}
              max={MAX_ROTATION}
              step={0.5}
              onValueChange={([v]) => onAdjustChange({ ...adjusting, rotation: v })}
              aria-label={t('map.backdrop.rotation')}
            />
            <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">{adjusting.rotation}°</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={adjusting.mirrored ? 'default' : 'outline'}
              aria-pressed={adjusting.mirrored}
              onClick={() => onAdjustChange({ ...adjusting, mirrored: !adjusting.mirrored })}
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
              onClick={() => onAdjustChange({ ...DEFAULT_PHOTO_ALIGNMENT, mirrored: adjusting.mirrored })}
              disabled={isSaving}
              className="h-8"
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              {t('map.backdrop.reset')}
            </Button>
            <div className="ml-auto flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={onCancelAdjust} disabled={isSaving} className="h-8">
                {t('cancel')}
              </Button>
              <Button type="button" size="sm" onClick={onSaveAdjust} loading={isSaving} className="h-8">
                {t('map.backdrop.saveAlignment')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
