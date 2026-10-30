'use client';

import { VideoOff } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';
import { resolveVideoEmbed } from '@/lib/video-embed';

interface WelcomeVideoProps {
  /** URL cruda tal como la cargó la clínica: archivo, YouTube, Instagram o Vimeo. */
  url: string | null | undefined;
  /** Texto accesible del reproductor. */
  title: string;
  /** Se muestra cuando la URL no se puede reproducir. */
  emptyLabel?: string;
  className?: string;
}

/**
 * Video de bienvenida del portal.
 *
 * Reproduce indistintamente un archivo (`<video>`) o un embed de YouTube /
 * Instagram / Vimeo (`<iframe>`), según lo que resuelva `resolveVideoEmbed`.
 * Siempre en 16:9, para que la portada no salte según el proveedor.
 */
export function WelcomeVideo({ url, title, emptyLabel, className }: WelcomeVideoProps) {
  const embed = React.useMemo(() => resolveVideoEmbed(url), [url]);

  return (
    <div className={cn('overflow-hidden rounded-2xl border bg-muted shadow-sm', className)}>
      {embed.kind === 'file' && (
        <video
          key={embed.src}
          className="aspect-video w-full object-cover"
          src={embed.src}
          title={title}
          autoPlay
          muted
          loop
          playsInline
          controls
          preload="metadata"
        />
      )}

      {embed.kind === 'iframe' && (
        <iframe
          key={embed.src}
          className="aspect-video w-full"
          src={embed.src}
          title={title}
          // `autoplay` sólo funciona si el navegador lo permite; el resolver ya
          // pide mute para ganárselo. `clipboard-write` lo exige Instagram.
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      )}

      {embed.kind === 'none' && (
        <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 text-muted-foreground">
          <VideoOff className="h-6 w-6" />
          {emptyLabel && <span className="px-4 text-center text-xs">{emptyLabel}</span>}
        </div>
      )}
    </div>
  );
}
