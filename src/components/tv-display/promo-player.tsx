'use client';

import * as React from 'react';

interface PromoPlayerProps {
  videoUrls: string[];
  musicUrl?: string;
  musicEnabled?: boolean;
  /** Called when all videos have finished (or immediately if no videos configured) */
  onEnded?: () => void;
  /** Max seconds to show each video/promo before returning to schedule. Default 60. */
  maxDurationSeconds?: number;
}

function getEmbedUrl(url: string): string {
  const ytMatch = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/
  );
  if (ytMatch) {
    return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&mute=0&loop=1&playlist=${ytMatch[1]}&controls=0&rel=0&modestbranding=1`;
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
  onEnded,
  maxDurationSeconds = 60,
}: PromoPlayerProps) {
  const [currentIdx, setCurrentIdx] = React.useState(0);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const fallbackTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const onEndedRef = React.useRef(onEnded);
  onEndedRef.current = onEnded;

  const validUrls = videoUrls.filter(Boolean);
  const hasVideos = validUrls.length > 0;

  // If no videos configured, return to schedule after a brief moment
  React.useEffect(() => {
    if (!hasVideos) {
      const t = setTimeout(() => onEndedRef.current?.(), 500);
      return () => clearTimeout(t);
    }
  }, [hasVideos]);

  // Safety fallback: if video never fires onEnded (e.g. iframe), return after maxDuration
  React.useEffect(() => {
    if (!hasVideos) return;
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    fallbackTimerRef.current = setTimeout(() => {
      onEndedRef.current?.();
    }, maxDurationSeconds * 1000);
    return () => {
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    };
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

  const handleVideoEnd = () => {
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    if (currentIdx < validUrls.length - 1) {
      setCurrentIdx((i) => i + 1);
    } else {
      setCurrentIdx(0);
      onEndedRef.current?.();
    }
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
          key={currentUrl}
          src={currentUrl}
          className="w-full h-full object-cover"
          autoPlay
          muted={musicEnabled && !!musicUrl}
          onEnded={handleVideoEnd}
          playsInline
        />
      ) : (
        <iframe
          key={currentUrl}
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
