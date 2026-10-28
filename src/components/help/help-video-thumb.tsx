'use client';

import { Play } from 'lucide-react';
import * as React from 'react';

import { formatVideoTime, helpVideoSource } from '@/lib/help/video-source';

import type { HelpVideo } from '@/lib/types';

/** Miniatura del video: al tocarla se abre el reproductor flotante de Invoke. */
export function HelpVideoThumb({ video, label, onPlay }: { video: HelpVideo; label: string; onPlay: () => void }) {
  const [broken, setBroken] = React.useState(false);
  const poster = helpVideoSource(video.url).poster;
  return (
    <button
      type="button"
      onClick={onPlay}
      aria-label={label}
      title={label}
      className="group relative aspect-video w-24 flex-none overflow-hidden rounded-lg bg-gradient-to-br from-[#5B21B6] to-[#A855F7] shadow-sm"
    >
      {!broken && (
        // eslint-disable-next-line @next/next/no-img-element -- miniatura externa (Drive / bucket), sin optimizar
        <img src={poster} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} className="h-full w-full object-cover" />
      )}
      <span className="absolute inset-0 flex items-center justify-center bg-black/15 transition-colors group-hover:bg-black/30">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-[#7C3AED] shadow">
          <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />
        </span>
      </span>
      {video.durationSeconds ? (
        <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[9px] font-medium tabular-nums text-white">{formatVideoTime(video.durationSeconds)}</span>
      ) : null}
    </button>
  );
}
