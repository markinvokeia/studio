'use client';

import { AlertCircle, ExternalLink, GripHorizontal, Loader2, Maximize, Maximize2, Minimize, Minimize2, Pause, Play, PlayCircle, Volume2, VolumeX, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { createPortal } from 'react-dom';

import { stopAssistantSpeech } from '@/hooks/use-assistant-voice';
import { formatVideoTime, helpVideoSource } from '@/lib/help/video-source';
import { cn } from '@/lib/utils';
import { useHelpVideo } from '@/stores/help-video-store';

import type { HelpVideo } from '@/lib/types';

/** Encima de la guía (oscurecido, mascota y sus controles): lo maneja la persona y lo puede mover. */
const PLAYER_Z = 2147483604;
const SMALL_WIDTH = 380;
const LARGE_WIDTH = 760;
const HEADER_PX = 36;
const CONTROLS_PX = 72;
const MARGIN = 16;
/** A la izquierda queda el menú lateral: el reproductor arranca abajo a la izquierda, lejos de la mascota. */
const SIDEBAR_PX = 80;
const SPEEDS = [1, 1.25, 1.5, 2] as const;
const SEEK_STEP_S = 5;

interface Position { left: number; top: number }

function playerSize(large: boolean) {
  const vw = window.innerWidth;
  const width = Math.min(large ? LARGE_WIDTH : SMALL_WIDTH, vw - MARGIN * 2);
  return { width, height: Math.round((width * 9) / 16) + HEADER_PX + CONTROLS_PX };
}

function clampPosition(p: Position, large: boolean): Position {
  const { width, height } = playerSize(large);
  return {
    left: Math.max(MARGIN / 2, Math.min(window.innerWidth - width - MARGIN / 2, p.left)),
    top: Math.max(MARGIN / 2, Math.min(window.innerHeight - height - MARGIN / 2, p.top)),
  };
}

function ControlButton({ label, onClick, children, pressed }: { label: string; onClick: () => void; children: React.ReactNode; pressed?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      className="flex h-8 min-w-8 items-center justify-center rounded-full px-1.5 text-white/90 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
    >
      {children}
    </button>
  );
}

/**
 * Reproductor de videos de guías: flota sobre la app (se arrastra por el encabezado)
 * para ir siguiendo el video mientras se trabaja, se agranda, va a pantalla completa
 * y se cierra. Se monta una vez (HelpAssistant) y lo abre `useHelpVideo().open()`.
 */
export function HelpVideoPlayer({ onGuide }: { onGuide?: (video: HelpVideo) => void }) {
  const video = useHelpVideo((s) => s.video);
  if (!video || typeof document === 'undefined') return null;
  return createPortal(<PlayerWindow key={video.url} video={video} onGuide={onGuide} />, document.body);
}

function PlayerWindow({ video, onGuide }: { video: HelpVideo; onGuide?: (video: HelpVideo) => void }) {
  const t = useTranslations('HelpAssistant.video');
  const close = useHelpVideo((s) => s.close);
  const source = React.useMemo(() => helpVideoSource(video.url), [video.url]);
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  const [large, setLarge] = React.useState(false);
  const [fullscreen, setFullscreen] = React.useState(false);
  const [position, setPosition] = React.useState<Position>(() => {
    const { height } = playerSize(false);
    return clampPosition({ left: SIDEBAR_PX + MARGIN, top: window.innerHeight - height - MARGIN }, false);
  });
  const [playing, setPlaying] = React.useState(false);
  const [muted, setMuted] = React.useState(false);
  const [speed, setSpeed] = React.useState<(typeof SPEEDS)[number]>(1);
  const [time, setTime] = React.useState(0);
  const [duration, setDuration] = React.useState(video.durationSeconds ?? 0);
  const [loading, setLoading] = React.useState(true);
  const [failed, setFailed] = React.useState(false);

  // Siempre dentro de la pantalla (al agrandarlo o al cambiar el tamaño de la ventana).
  React.useEffect(() => {
    setPosition((p) => clampPosition(p, large));
    const onResize = () => setPosition((p) => clampPosition(p, large));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [large]);

  React.useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // Foco en el reproductor: el teclado (espacio, flechas, M, F) lo maneja enseguida.
  React.useEffect(() => { rootRef.current?.focus({ preventScroll: true }); }, []);

  const togglePlay = React.useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => { /* el navegador pidió un gesto: queda en pausa */ });
    else el.pause();
  }, []);

  const toggleFullscreen = React.useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void rootRef.current?.requestFullscreen().catch(() => {});
  }, []);

  const seekBy = (delta: number) => {
    const el = videoRef.current;
    if (el) el.currentTime = Math.max(0, Math.min(el.duration || 0, el.currentTime + delta));
  };

  const toggleMute = () => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = !el.muted;
    setMuted(el.muted);
  };

  const cycleSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    if (videoRef.current) videoRef.current.playbackRate = next;
    setSpeed(next);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement && e.key !== ' ') return;
    const key = e.key.toLowerCase();
    if (key === ' ' || key === 'k') { e.preventDefault(); togglePlay(); }
    else if (key === 'arrowleft') { e.preventDefault(); seekBy(-SEEK_STEP_S); }
    else if (key === 'arrowright') { e.preventDefault(); seekBy(SEEK_STEP_S); }
    else if (key === 'm') toggleMute();
    else if (key === 'f') toggleFullscreen();
    else if (key === 'escape' && !document.fullscreenElement) close();
  };

  // Arrastrar por el encabezado: se sigue al puntero en toda la ventana hasta soltarlo.
  const onDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (fullscreen || e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    const { pointerId } = e;
    const dx = e.clientX - position.left;
    const dy = e.clientY - position.top;
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId === pointerId) setPosition(clampPosition({ left: ev.clientX - dx, top: ev.clientY - dy }, large));
    };
    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const { width } = typeof window === 'undefined' ? { width: SMALL_WIDTH } : playerSize(large);
  const progress = duration > 0 ? Math.min(100, (time / duration) * 100) : 0;

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-label={t('label', { title: video.title })}
      tabIndex={-1}
      data-help-ignore
      onKeyDown={onKeyDown}
      // Los clics no deben cerrar un diálogo de Radix abierto debajo.
      onPointerDown={(e) => e.stopPropagation()}
      className={cn(
        'flex flex-col overflow-hidden bg-black text-white shadow-[0_18px_48px_rgba(20,10,40,0.45)] outline-none',
        fullscreen ? 'h-full w-full' : 'fixed rounded-2xl border border-white/10 animate-in fade-in zoom-in-95 duration-200',
      )}
      style={fullscreen ? { zIndex: PLAYER_Z } : { zIndex: PLAYER_Z, left: position.left, top: position.top, width, pointerEvents: 'auto' }}
    >
      {/* Encabezado: se arrastra para moverlo. */}
      <div
        className={cn('flex flex-none items-center gap-1.5 bg-gradient-to-r from-[#5B21B6] to-[#7C3AED] pl-2 pr-1', !fullscreen && 'cursor-grab touch-none active:cursor-grabbing')}
        style={{ height: HEADER_PX }}
        onPointerDown={onDragStart}
        title={fullscreen ? undefined : t('move')}
      >
        {!fullscreen && <GripHorizontal className="h-4 w-4 flex-none text-white/60" aria-hidden="true" />}
        <p className="min-w-0 flex-1 truncate text-xs font-semibold">{video.title}</p>
        {onGuide && (
          <ControlButton label={t('guideMe')} onClick={() => onGuide(video)}>
            <PlayCircle className="h-4 w-4" />
            <span className="ml-1 hidden text-[11px] font-medium sm:inline">{t('guideMeShort')}</span>
          </ControlButton>
        )}
        {!fullscreen && (
          <ControlButton label={large ? t('shrink') : t('enlarge')} onClick={() => setLarge((v) => !v)}>
            {large ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </ControlButton>
        )}
        <ControlButton label={t('close')} onClick={close}>
          <X className="h-4 w-4" />
        </ControlButton>
      </div>

      {/* Video: tocarlo pausa o reanuda. */}
      <div className={cn('relative bg-black', fullscreen ? 'min-h-0 flex-1' : 'aspect-video')}>
        <video
          ref={videoRef}
          src={source.src}
          poster={source.poster}
          autoPlay
          playsInline
          preload="metadata"
          className="h-full w-full cursor-pointer object-contain"
          onClick={togglePlay}
          onPlay={() => { setPlaying(true); stopAssistantSpeech(); }}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => { if (Number.isFinite(e.currentTarget.duration)) setDuration(e.currentTarget.duration); }}
          onWaiting={() => setLoading(true)}
          onCanPlay={() => setLoading(false)}
          onPlaying={() => setLoading(false)}
          onError={() => { setFailed(true); setLoading(false); }}
        >
          {source.subtitles && <track kind="subtitles" src={source.subtitles} default />}
        </video>
        {loading && !failed && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-label={t('loading')}>
            <Loader2 className="h-8 w-8 animate-spin text-white/80" />
          </div>
        )}
        {!playing && !loading && !failed && (
          <button
            type="button"
            onClick={togglePlay}
            aria-label={t('play')}
            className="absolute inset-0 m-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#7C3AED]/90 shadow-lg transition-transform hover:scale-105"
          >
            <Play className="ml-0.5 h-6 w-6 fill-current" />
          </button>
        )}
        {failed && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80 p-4 text-center">
            <AlertCircle className="h-6 w-6 text-white/80" />
            <p className="text-sm">{t('error')}</p>
            <a href={source.external} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-violet-200 underline-offset-2 hover:underline">
              <ExternalLink className="h-3.5 w-3.5" />
              {t('openExternal')}
            </a>
          </div>
        )}
      </div>

      {/* Controles. */}
      <div className="flex flex-none flex-col justify-center gap-1 bg-[#14101f] px-2" style={{ height: CONTROLS_PX }}>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={Math.min(time, duration || 0)}
          onChange={(e) => { const el = videoRef.current; if (el) el.currentTime = Number(e.target.value); setTime(Number(e.target.value)); }}
          aria-label={t('seek')}
          className="h-1.5 w-full cursor-pointer accent-[#A855F7]"
          style={{ background: `linear-gradient(to right, #A855F7 ${progress}%, rgba(255,255,255,0.2) ${progress}%)` }}
        />
        <div className="flex items-center gap-0.5">
          <ControlButton label={playing ? t('pause') : t('play')} onClick={togglePlay}>
            {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
          </ControlButton>
          <ControlButton label={muted ? t('unmute') : t('mute')} onClick={toggleMute} pressed={muted}>
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </ControlButton>
          <span className="px-1 text-[11px] tabular-nums text-white/75">{formatVideoTime(time)} / {formatVideoTime(duration)}</span>
          <span className="flex-1" />
          <ControlButton label={t('speed', { rate: speed })} onClick={cycleSpeed}>
            <span className="text-[11px] font-semibold tabular-nums">{speed}x</span>
          </ControlButton>
          <ControlButton label={fullscreen ? t('exitFullscreen') : t('fullscreen')} onClick={toggleFullscreen}>
            {fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </ControlButton>
        </div>
      </div>
    </div>
  );
}
