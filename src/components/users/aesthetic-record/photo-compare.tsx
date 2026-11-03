'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeftRight, ChevronsLeftRight, Columns2, ImageOff, MapPin, SplitSquareHorizontal } from 'lucide-react';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

import { cn, formatDisplayDate } from '@/lib/utils';

import type { AestheticPhoto, AestheticPhotoKind, AestheticSession } from '@/lib/types';
import { useAestheticFileUrl } from './use-aesthetic-file-url';
import type { CompareMode } from './use-aesthetic-view-prefs';

/** Colour that tells "before" and "after" photos apart */
export const KIND_DOT: Record<AestheticPhotoKind, string> = { before: 'bg-slate-500', after: 'bg-emerald-500' };

export interface PhotoRef {
  photo: AestheticPhoto;
  session: AestheticSession;
}

/** A photo offered to the comparison: stored, or taken in the open edit and not saved yet */
export interface ComparePhoto {
  photo: Pick<AestheticPhoto, 'id' | 'kind' | 'view' | 'alignment'>;
  date: string;
  /** Object URL of a photo that is not saved yet (its `photo.id` is the pending key) */
  previewUrl?: string;
}

/** Default pair: the oldest "before" and the newest "after" (the photos are all of one view) */
function pickDefaultPair(refs: ComparePhoto[]): [string | undefined, string | undefined] {
  const before = refs.find((r) => r.photo.kind === 'before');
  const after = [...refs].reverse().find((r) => r.photo.kind === 'after' && r !== before);
  if (before && after) return [before.photo.id, after.photo.id];
  return [refs[0]?.photo.id, refs[refs.length - 1]?.photo.id];
}

/** Where a photo that was just added goes, with the best partner for it: "before" on the left, "after" on the right */
function pickPairFor(added: ComparePhoto, refs: ComparePhoto[]): { leftId: string; rightId: string } | null {
  const others = refs.filter((r) => r !== added);
  if (added.photo.kind === 'after') {
    const before = others.find((r) => r.photo.kind === 'before');
    return before ? { leftId: before.photo.id, rightId: added.photo.id } : null;
  }
  const after = [...others].reverse().find((r) => r.photo.kind === 'after');
  return after ? { leftId: added.photo.id, rightId: after.photo.id } : null;
}

function CompareImage({ fileId, previewUrl, alt, contain = false }: { fileId: string | undefined; previewUrl?: string; alt: string; contain?: boolean }) {
  const storedUrl = useAestheticFileUrl(previewUrl ? undefined : fileId);
  const url = previewUrl ?? storedUrl;
  if (url === undefined) return <Skeleton className="absolute inset-0 rounded-none" />;
  if (!url) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground">
        <ImageOff className="h-6 w-6" />
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- local object URL
  return <img src={url} alt={alt} className={cn('absolute inset-0 h-full w-full', contain ? 'object-contain' : 'object-cover')} draggable={false} />;
}

interface PhotoCompareProps {
  /** Photos of the view on the map, oldest first, plus the ones not saved yet */
  photos: ComparePhoto[];
  /** Name of the view, for the empty state */
  viewLabel: string;
  /** Draws a photo behind the map with the session's marks; it enables the "on the map" mode */
  renderOnMap?: (ref: ComparePhoto) => React.ReactNode;
  /** Controls placed at the start of the toolbar (the canvas mode switch) */
  leading?: React.ReactNode;
  /** How the pair is shown; the user's last choice */
  mode: CompareMode;
  onModeChange: (mode: CompareMode) => void;
  className?: string;
}

/** Before and after of one view, filling the canvas: on the map with the marks, side by side or with a slider */
export function PhotoCompare({ photos, viewLabel, renderOnMap, leading, mode, onModeChange, className }: PhotoCompareProps) {
  const t = useTranslations('AestheticRecord');
  const [defaultA, defaultB] = React.useMemo(() => pickDefaultPair(photos), [photos]);
  const [leftId, setLeftId] = React.useState<string | undefined>(defaultA);
  const [rightId, setRightId] = React.useState<string | undefined>(defaultB);
  const [position, setPosition] = React.useState(50);
  const shownMode: CompareMode = mode === 'onMap' && !renderOnMap ? 'sideBySide' : mode;
  const knownUnsavedRef = React.useRef<Set<string>>(new Set(photos.filter((r) => r.previewUrl).map((r) => r.photo.id)));

  // A photo just taken goes straight into the comparison, against the best photo of its view
  React.useEffect(() => {
    const unsaved = photos.filter((r) => r.previewUrl);
    const added = unsaved.filter((r) => !knownUnsavedRef.current.has(r.photo.id)).pop();
    knownUnsavedRef.current = new Set(unsaved.map((r) => r.photo.id));
    const pair = added && pickPairFor(added, photos);
    if (pair) {
      setLeftId(pair.leftId);
      setRightId(pair.rightId);
    }
  }, [photos]);

  // Fall back to the defaults when the selected photos disappear (view or session switched, photo removed)
  React.useEffect(() => {
    if (!photos.some((r) => r.photo.id === leftId)) setLeftId(defaultA);
    if (!photos.some((r) => r.photo.id === rightId)) setRightId(defaultB);
  }, [photos, leftId, rightId, defaultA, defaultB]);

  const modes = ([
    ['onMap', MapPin],
    ['sideBySide', Columns2],
    ['slider', SplitSquareHorizontal],
  ] as const).filter(([id]) => id !== 'onMap' || renderOnMap);

  const describe = (ref: ComparePhoto) =>
    t('photos.optionLabelDate', { date: formatDisplayDate(ref.date), kind: t(`photos.kinds.${ref.photo.kind}`) })
    + (ref.previewUrl ? ` · ${t('photos.pending')}` : '');
  const left = photos.find((r) => r.photo.id === leftId);
  const right = photos.find((r) => r.photo.id === rightId);
  const enough = photos.length >= 2;

  /** Kind and date of a photo, on a dark chip readable over any image */
  const chip = (ref: ComparePhoto | undefined, className?: string) => ref && (
    <span className={cn('pointer-events-none absolute z-10 inline-flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-sm', className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', KIND_DOT[ref.photo.kind])} aria-hidden />
      {t(`photos.kinds.${ref.photo.kind}`)} · {formatDisplayDate(ref.date)}
      {ref.previewUrl && <span className="rounded bg-white/20 px-1 text-[10px] uppercase tracking-wide">{t('photos.pending')}</span>}
    </span>
  );

  const picker = (id: string | undefined, onChange: (id: string) => void, label: string) => (
    <Select value={id} onValueChange={onChange}>
      <SelectTrigger className="h-8 min-w-0 max-w-[14rem] flex-1 bg-card text-xs" aria-label={label} title={label}><SelectValue /></SelectTrigger>
      <SelectContent>
        {photos.map((ref) => <SelectItem key={ref.photo.id} value={ref.photo.id}>{describe(ref)}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  return (
    <div className={cn('flex min-h-0 flex-col gap-2', className)}>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {leading}
        {enough && (
          <>
            {/* Below this width the pickers drop to their own row instead of truncating the dates */}
            <div className="flex min-w-[17rem] flex-1 items-center gap-1.5">
              {picker(leftId, setLeftId, t('photos.compareLeft'))}
              <ArrowLeftRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              {picker(rightId, setRightId, t('photos.compareRight'))}
            </div>
            <div role="tablist" aria-label={t('photos.compareModeLabel')} className="ml-auto inline-flex shrink-0 rounded-lg border bg-card p-0.5 shadow-sm">
              {modes.map(([id, Icon]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={shownMode === id}
                  onClick={() => onModeChange(id)}
                  aria-label={t(`photos.compareModes.${id}`)}
                  title={t(`photos.compareModes.${id}`)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                    shownMode === id
                      ? 'bg-primary text-primary-foreground shadow-sm dark:bg-foreground dark:text-background'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {shownMode === id && <span>{t(`photos.compareModes.${id}`)}</span>}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {!enough ? (
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <p className="max-w-xs rounded-xl border border-dashed bg-card/60 p-4 text-center text-xs text-muted-foreground">
            {t('photos.compareNeedsTwoOfView', { view: viewLabel })}
          </p>
        </div>
      ) : shownMode === 'slider' ? (
        <div className="flex min-h-0 flex-1 items-center justify-center">
          {/* The box keeps 3:4 inside whatever room the canvas has */}
          <div className="relative aspect-[3/4] h-full max-h-full max-w-full select-none overflow-hidden rounded-2xl border bg-muted">
            <CompareImage fileId={right?.photo.id} previewUrl={right?.previewUrl} alt={right ? describe(right) : ''} />
            <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
              <CompareImage fileId={left?.photo.id} previewUrl={left?.previewUrl} alt={left ? describe(left) : ''} />
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
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-2">
          {[left, right].map((ref, i) => (
            <div key={i} className="relative flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border bg-card">
              {shownMode === 'onMap' && ref && renderOnMap
                ? renderOnMap(ref)
                : <CompareImage fileId={ref?.photo.id} previewUrl={ref?.previewUrl} alt={ref ? describe(ref) : ''} contain />}
              {chip(ref, 'left-2 top-2')}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
