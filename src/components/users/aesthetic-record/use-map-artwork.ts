'use client';

import React from 'react';

import type { AestheticBodyFigure, AestheticMapView } from '@/lib/types';
import { getFaceArtwork, isFaceView, loadBodyArtwork, type MapArtwork } from './map-templates';

interface ArtworkState {
  key: string;
  artwork: MapArtwork | null;
  error: boolean;
}

/** Face artwork is immediate; the body one is loaded on demand. `null` while loading. */
export function useMapArtwork(view: AestheticMapView, figure: AestheticBodyFigure): { artwork: MapArtwork | null; error: boolean; retry: () => void } {
  const key = isFaceView(view) ? view : `${view}:${figure}`;
  const faceArtwork = React.useMemo(() => (isFaceView(view) ? getFaceArtwork(view) : null), [view]);
  const [body, setBody] = React.useState<ArtworkState>({ key: '', artwork: null, error: false });
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    if (isFaceView(view)) return;
    let active = true;
    loadBodyArtwork(figure, view)
      .then((artwork) => { if (active) setBody({ key, artwork, error: false }); })
      .catch(() => { if (active) setBody({ key, artwork: null, error: true }); });
    return () => { active = false; };
  }, [view, figure, key, attempt]);

  if (faceArtwork) return { artwork: faceArtwork, error: false, retry: () => undefined };
  // A stale body artwork (other view or figure) is never shown
  const current = body.key === key ? body : null;
  return {
    artwork: current?.artwork ?? null,
    error: current?.error ?? false,
    retry: () => {
      setBody({ key: '', artwork: null, error: false });
      setAttempt((n) => n + 1);
    },
  };
}
