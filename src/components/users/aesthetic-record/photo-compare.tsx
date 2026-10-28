'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeftRight, ChevronsLeftRight, Columns2, ImageOff, SplitSquareHorizontal } from 'lucide-react';

import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

import { cn, formatDisplayDate } from '@/lib/utils';

import type { AestheticPhoto, AestheticPhotoKind, AestheticSession } from '@/lib/types';
import { MAP_VIEWS } from './map-templates';
import { useAestheticFileUrl } from './use-aesthetic-file-url';

/** Colour that tells "before" and "after" photos apart */
export const KIND_DOT: Record<AestheticPhotoKind, string> = { before: 'bg-slate-500', after: 'bg-emerald-500' };

type CompareMode = 'sideBySide' | 'slider';

export interface PhotoRef {
  photo: AestheticPhoto;
  session: AestheticSession;
}

/** Default pair: the oldest "before" and the newest "after" of the same view */
function pickDefaultPair(refs: PhotoRef[]): [string | undefined, string | undefined] {
  for (const view of MAP_VIEWS) {
    const ofView = refs.filter((r) => r.photo.view === view);
    const before = ofView.find((r) => r.photo.kind === 'before');
    const after = [...ofView].reverse().find((r) => r.photo.kind === 'after' && r !== before);
    if (before && after) return [before.photo.id, after.photo.id];
  }
  return [refs[0]?.photo.id, refs[refs.length - 1]?.photo.id];
}

function CompareImage({ fileId, alt }: { fileId: string | undefined; alt: string }) {
  const url = useAestheticFileUrl(fileId);
  if (url === undefined) return <Skeleton className="absolute inset-0 rounded-none" />;
  if (!url) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground">
        <ImageOff className="h-6 w-6" />
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- local object URL
  return <img src={url} alt={alt} className="absolute inset-0 h-full w-full object-cover" draggable={false} />;
}

interface PhotoCompareProps {
  /** Every photo of the patient, oldest first */
  photos: PhotoRef[];
}

export function PhotoCompare({ photos }: PhotoCompareProps) {
  const t = useTranslations('AestheticRecord');
  const [defaultA, defaultB] = React.useMemo(() => pickDefaultPair(photos), [photos]);
  const [leftId, setLeftId] = React.useState<string | undefined>(defaultA);
  const [rightId, setRightId] = React.useState<string | undefined>(defaultB);
  const [position, setPosition] = React.useState(50);
  const [mode, setMode] = React.useState<CompareMode>('sideBySide');

  // Fall back to the defaults when the selected photos disappear (session switched or photo removed)
  React.useEffect(() => {
    if (!photos.some((r) => r.photo.id === leftId)) setLeftId(defaultA);
    if (!photos.some((r) => r.photo.id === rightId)) setRightId(defaultB);
  }, [photos, leftId, rightId, defaultA, defaultB]);

  if (photos.length < 2) {
    return <p className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">{t('photos.compareNeedsTwo')}</p>;
  }

  const describe = (ref: PhotoRef) =>
    t('photos.optionLabel', {
      date: formatDisplayDate(ref.session.date),
      kind: t(`photos.kinds.${ref.photo.kind}`),
      view: t(`views.${ref.photo.view}`),
    });
  const left = photos.find((r) => r.photo.id === leftId);
  const right = photos.find((r) => r.photo.id === rightId);

  /** Kind and date of a photo, on a dark chip readable over any image */
  const chip = (ref: PhotoRef | undefined, className?: string) => ref && (
    <span className={cn('pointer-events-none absolute inline-flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-sm', className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', KIND_DOT[ref.photo.kind])} aria-hidden />
      {t(`photos.kinds.${ref.photo.kind}`)} · {formatDisplayDate(ref.session.date)}
    </span>
  );

  const picker = (id: string | undefined, onChange: (id: string) => void, label: string) => (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <Label className="text-xs">{label}</Label>
      <Select value={id} onValueChange={onChange}>
        <SelectTrigger className="h-9" aria-label={label}><SelectValue /></SelectTrigger>
        <SelectContent>
          {photos.map((ref) => <SelectItem key={ref.photo.id} value={ref.photo.id}>{describe(ref)}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        {picker(leftId, setLeftId, t('photos.compareLeft'))}
        <ArrowLeftRight className="hidden h-4 w-4 shrink-0 self-center text-muted-foreground sm:mb-2.5 sm:block" aria-hidden />
        {picker(rightId, setRightId, t('photos.compareRight'))}
      </div>

      <div role="tablist" aria-label={t('photos.compareModeLabel')} className="inline-flex self-start rounded-lg border bg-muted/40 p-0.5">
        {([['sideBySide', Columns2], ['slider', SplitSquareHorizontal]] as const).map(([id, Icon]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={mode === id}
            onClick={() => setMode(id)}
            className={cn(
              'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              mode === id
                ? 'bg-primary text-primary-foreground shadow-sm dark:bg-foreground dark:text-background'
                : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {t(`photos.compareModes.${id}`)}
          </button>
        ))}
      </div>

      {mode === 'sideBySide' ? (
        <div className="grid w-full max-w-2xl grid-cols-2 gap-2 self-center">
          {[left, right].map((ref, i) => (
            <div key={i} className="relative aspect-[3/4] overflow-hidden rounded-2xl border bg-muted">
              <CompareImage fileId={ref?.photo.id} alt={ref ? describe(ref) : ''} />
              {chip(ref, 'bottom-2 left-2')}
            </div>
          ))}
        </div>
      ) : (
        <div className="relative mx-auto aspect-[3/4] w-full max-w-md select-none overflow-hidden rounded-2xl border bg-muted">
          <CompareImage fileId={right?.photo.id} alt={right ? describe(right) : ''} />
          <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
            <CompareImage fileId={left?.photo.id} alt={left ? describe(left) : ''} />
          </div>
          <div className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.25)]" style={{ left: `${position}%` }} aria-hidden>
            <span className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-slate-700 shadow-md ring-1 ring-black/10">
              <ChevronsLeftRight className="h-4 w-4" />
            </span>
          </div>
          {chip(left, 'bottom-2 left-2')}
          {chip(right, 'bottom-2 right-2')}
          <input
            type="range"
            min={0}
            max={100}
            value={position}
            onChange={(e) => setPosition(Number(e.target.value))}
            aria-label={t('photos.compareSlider')}
            className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
          />
        </div>
      )}
    </div>
  );
}
