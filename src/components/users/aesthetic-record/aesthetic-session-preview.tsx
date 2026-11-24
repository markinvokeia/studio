'use client';

import React from 'react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

import type { AestheticMapView, AestheticSession } from '@/lib/types';
import { AestheticMap } from './aesthetic-map';
import { FaceIllustration, type FaceTone } from './face-models/face-illustration';
import { HintProvider } from './hint';
import { placeMarks } from './layers';
import { isFaceView, MAP_VIEWS } from './map-templates';

/** Same key as the session sheet: the skin tone the professional picked for the model */
const TONE_KEY = 'aesthetic-model-tone';

function storedTone(): FaceTone {
  if (typeof window === 'undefined') return 'light';
  const saved = window.localStorage.getItem(TONE_KEY);
  return saved === 'medium' || saved === 'dark' ? saved : 'light';
}

interface AestheticSessionPreviewProps {
  session: AestheticSession;
  /** Opens the session sheet */
  onOpen?: () => void;
  className?: string;
}

/**
 * Read-only map of a session for the clinical timeline: the view with the most marks, and chips
 * to switch to the other views that have marks.
 */
export function AestheticSessionPreview({ session, onOpen, className }: AestheticSessionPreviewProps) {
  const t = useTranslations('AestheticRecord');
  const placed = React.useMemo(() => placeMarks(session.layers), [session.layers]);
  const views = React.useMemo(() => {
    const count = (v: AestheticMapView) => placed.filter((p) => p.mark.view === v).length;
    return MAP_VIEWS.filter((v) => count(v) > 0).sort((a, b) => count(b) - count(a));
  }, [placed]);
  const [picked, setPicked] = React.useState<AestheticMapView | null>(null);
  const view = picked && views.includes(picked) ? picked : views[0] ?? 'front';
  const figure = session.bodyFigure ?? 'female';
  const [tone] = React.useState(storedTone);

  return (
    <div className={cn('flex w-full flex-col gap-1.5 rounded-xl border bg-card p-2', className)}>
      {views.length > 1 && (
        <div className="flex flex-wrap gap-1">
          {views.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setPicked(v)}
              aria-pressed={v === view}
              className={cn('h-6 rounded-full border px-2 text-[11px] text-muted-foreground', v === view && 'border-foreground bg-foreground text-background')}
            >
              {t(`viewsShort.${v}`)}
            </button>
          ))}
        </div>
      )}
      {/* Not a <button>: the map has controls of its own inside */}
      <div
        role={onOpen ? 'button' : undefined}
        tabIndex={onOpen ? 0 : undefined}
        onClick={onOpen}
        onKeyDown={onOpen ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } } : undefined}
        title={onOpen ? t('flow.timeline.openPreview') : undefined}
        aria-label={onOpen ? t('flow.timeline.openPreview') : t(`views.${view}`)}
        className={cn('relative h-56 w-full overflow-hidden rounded-lg bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', onOpen && 'cursor-pointer')}
      >
        {placed.length ? (
          // The map's marks use the module's tooltips, which need their provider
          <HintProvider>
            <AestheticMap
              fill
              zoomControls={false}
              readOnly
              view={view}
              figure={figure}
              marks={placed}
              selectedMarkId={null}
              onSelectMark={() => undefined}
              illustration={isFaceView(view) ? <FaceIllustration view={view} sex={figure} tone={tone} /> : undefined}
              className="pointer-events-none h-full p-1"
            />
          </HintProvider>
        ) : (
          <span className="grid h-full place-items-center px-3 text-center text-xs text-muted-foreground">{t('flow.timeline.noMarks')}</span>
        )}
      </div>
    </div>
  );
}
