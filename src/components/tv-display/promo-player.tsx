'use client';

import * as React from 'react';

interface PromoPlayerProps {
  videoUrls: string[];
  musicUrl?: string;
  musicEnabled?: boolean;
  /** Index to resume from (persists across promo interruptions) */
  initialIndex?: number;
  /** Called with the next index whenever a video ends, so the parent can persist it */
  onIndexChange?: (nextIndex: number) => void;
  /** Called when promo should close (interrupted or all videos done) */
  onEnded?: () => void;
  /** Max seconds per video before forcing advance. Default 90. */
  maxDurationSeconds?: number;
}

function getEmbedUrl(url: string, startSeconds = 0): string {
  const ytMatch = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/
  );
  if (ytMatch) {
    return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&mute=0&loop=0&controls=0&rel=0&modestbranding=1&start=${startSeconds}`;
  }
  return url;
}

function isDirectVideo(url: string) {
  return /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url);
}

export function PromoPlayer({
  videoUrls,
  musicUrl,
  musicEnabled,
  initialIndex = 0,
  onIndexChange,
  onEnded,
  maxDurationSeconds = 90,
}: PromoPlayerProps) {
  const validUrls = videoUrls.filter(Boolean);
  const hasVideos = validUrls.length > 0;

  // Start from the persisted index, clamped to valid range
  const [currentIdx, setCurrentIdx] = React.useState(() =>
    hasVideos ? initialIndex % validUrls.length : 0
  );

  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const fallbackTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const onEndedRef = React.useRef(onEnded);
  const onIndexChangeRef = React.useRef(onIndexChange);
  onEndedRef.current = onEnded;
  onIndexChangeRef.current = onIndexChange;

  // If no videos, close immediately
  React.useEffect(() => {
    if (!hasVideos) {
      const t = setTimeout(() => onEndedRef.current?.(), 300);
      return () => clearTimeout(t);
    }
  }, [hasVideos]);

  // Safety fallback per video (for iframes that never fire onEnded)
  React.useEffect(() => {
    if (!hasVideos) return;
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    fallbackTimerRef.current = setTimeout(() => {
      advanceToNext(currentIdx);
    }, maxDurationSeconds * 1000);
    return () => {
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIdx, hasVideos, maxDurationSeconds]);

  // Music
  React.useEffect(() => {
    if (musicEnabled && musicUrl && audioRef.current) {
      audioRef.current.src = musicUrl;
      audioRef.current.volume = 0.3;
      audioRef.current.play().catch(() => {});
    } else if (audioRef.current) {
      audioRef.current.pause();
    }
  }, [musicEnabled, musicUrl]);

  const advanceToNext = (fromIdx: number) => {
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    const nextIdx = (fromIdx + 1) % validUrls.length;
    setCurrentIdx(nextIdx);
    onIndexChangeRef.current?.(nextIdx);
    // Loop indefinitely — promo only closes when externally interrupted (NEXT_PATIENT)
  };

  if (!hasVideos) {
    return (
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        {musicEnabled && musicUrl && <audio ref={audioRef} loop />}
        <div className="text-white/10 font-black tracking-[0.3em] uppercase" style={{ fontSize: '3rem' }}>
          INVOKE IA
        </div>
      </div>
    );
  }

  const currentUrl = validUrls[currentIdx];
  const embedUrl = getEmbedUrl(currentUrl);
  const isDirect = isDirectVideo(currentUrl);

  return (
    <div className="absolute inset-0 bg-black overflow-hidden">
      {musicEnabled && musicUrl && <audio ref={audioRef} loop />}

      {isDirect ? (
        <video
          key={`${currentUrl}-${currentIdx}`}
          src={currentUrl}
          className="w-full h-full object-cover"
          autoPlay
          muted={musicEnabled && !!musicUrl}
          onEnded={() => advanceToNext(currentIdx)}
          playsInline
        />
      ) : (
        <iframe
          key={`${currentUrl}-${currentIdx}`}
          src={embedUrl}
          className="w-full h-full border-0"
          allow="autoplay; fullscreen"
          allowFullScreen
          title="promo"
        />
      )}
    </div>
  );
}
