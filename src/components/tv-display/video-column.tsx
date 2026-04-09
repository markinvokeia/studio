'use client';

import * as React from 'react';

interface VideoColumnProps {
  videoUrls: string[];
  /** Max seconds per video before forcing advance (for iframes). Default 120. */
  maxDurationSeconds?: number;
}

function getEmbedUrl(url: string): string {
  const ytMatch = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/
  );
  if (ytMatch) {
    return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&mute=1&loop=0&controls=0&rel=0&modestbranding=1`;
  }
  return url;
}

function isDirectVideo(url: string) {
  return /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url);
}

export function VideoColumn({ videoUrls, maxDurationSeconds = 120 }: VideoColumnProps) {
  const [currentIdx, setCurrentIdx] = React.useState(0);
  const fallbackTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const validUrls = videoUrls.filter(Boolean);

  const advance = React.useCallback(() => {
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    setCurrentIdx((i) => (i + 1) % validUrls.length);
  }, [validUrls.length]);

  // Fallback timer — fires for iframes that can't report onEnded
  React.useEffect(() => {
    if (validUrls.length === 0) return;
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    fallbackTimerRef.current = setTimeout(advance, maxDurationSeconds * 1000);
    return () => {
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    };
  }, [currentIdx, validUrls.length, maxDurationSeconds, advance]);

  if (validUrls.length === 0) {
    return (
      <div
        className="w-full h-full flex items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.4)' }}
      >
        <span
          className="font-bold uppercase tracking-widest"
          style={{ fontSize: '0.65rem', opacity: 0.2, writingMode: 'vertical-rl' }}
        >
          Sin videos
        </span>
      </div>
    );
  }

  const currentUrl = validUrls[currentIdx];
  const isDirect = isDirectVideo(currentUrl);
  const embedUrl = getEmbedUrl(currentUrl);

  return (
    <div className="w-full h-full bg-black overflow-hidden">
      {isDirect ? (
        <video
          key={`${currentUrl}-${currentIdx}`}
          src={currentUrl}
          className="w-full h-full object-cover"
          autoPlay
          muted
          onEnded={advance}
          playsInline
        />
      ) : (
        <iframe
          key={`${currentUrl}-${currentIdx}`}
          src={embedUrl}
          className="w-full h-full border-0"
          allow="autoplay; fullscreen"
          allowFullScreen
          title="video-column"
        />
      )}
    </div>
  );
}
