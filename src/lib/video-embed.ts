/**
 * Resuelve una URL de video pegada por la clínica a algo reproducible.
 *
 * El campo "video de bienvenida" del portal lo completa una persona no técnica,
 * que va a pegar lo que tenga a mano: el link de YouTube, el de un reel de
 * Instagram, o la URL de un archivo. Cada uno se reproduce distinto — un
 * `<video>` no sirve para YouTube y un `<iframe>` no sirve para un .mp4 suelto.
 */

export type VideoEmbedKind = 'file' | 'iframe' | 'none';

export interface VideoEmbed {
  kind: VideoEmbedKind;
  /** URL lista para el `src` del `<video>` o del `<iframe>`. */
  src: string;
  /** Proveedor detectado, para decidir detalles de presentación. */
  provider: 'file' | 'youtube' | 'instagram' | 'vimeo' | 'unknown';
}

const DIRECT_FILE = /\.(mp4|webm|ogg|ogv|mov|m4v)(\?|#|$)/i;

const YOUTUBE = /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([a-zA-Z0-9_-]{11})/;
const INSTAGRAM = /instagram\.com\/(?:[\w.-]+\/)?(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/;
const VIMEO = /vimeo\.com\/(?:video\/)?(\d+)/;

interface ResolveOptions {
  /** Arranca solo y en silencio. Es lo que corresponde a un video de portada. */
  autoplay?: boolean;
  loop?: boolean;
}

export function resolveVideoEmbed(
  url: string | null | undefined,
  { autoplay = true, loop = true }: ResolveOptions = {},
): VideoEmbed {
  const value = (url ?? '').trim();
  if (!value) return { kind: 'none', src: '', provider: 'unknown' };

  // Un archivo de video se reproduce nativo: mejor control y sin terceros.
  if (DIRECT_FILE.test(value)) {
    return { kind: 'file', src: value, provider: 'file' };
  }

  const youtube = value.match(YOUTUBE);
  if (youtube) {
    const id = youtube[1];
    const params = new URLSearchParams({
      rel: '0',
      modestbranding: '1',
      playsinline: '1',
      autoplay: autoplay ? '1' : '0',
      // El autoplay sólo lo permiten los navegadores si el video va en silencio.
      mute: autoplay ? '1' : '0',
    });
    // YouTube sólo repite si se le pasa el propio id como playlist.
    if (loop) {
      params.set('loop', '1');
      params.set('playlist', id);
    }
    return { kind: 'iframe', src: `https://www.youtube.com/embed/${id}?${params}`, provider: 'youtube' };
  }

  const instagram = value.match(INSTAGRAM);
  if (instagram) {
    // Instagram ignora autoplay y loop: sirve su propio reproductor.
    return {
      kind: 'iframe',
      src: `https://www.instagram.com/${instagram[1]}/${instagram[2]}/embed`,
      provider: 'instagram',
    };
  }

  const vimeo = value.match(VIMEO);
  if (vimeo) {
    const params = new URLSearchParams({
      autoplay: autoplay ? '1' : '0',
      muted: autoplay ? '1' : '0',
      loop: loop ? '1' : '0',
      byline: '0',
      title: '0',
    });
    return { kind: 'iframe', src: `https://player.vimeo.com/video/${vimeo[1]}?${params}`, provider: 'vimeo' };
  }

  // Cualquier otra URL http(s) se intenta como iframe: es lo que más chance
  // tiene de funcionar frente a un proveedor que no conocemos.
  if (/^https?:\/\//i.test(value)) {
    return { kind: 'iframe', src: value, provider: 'unknown' };
  }

  return { kind: 'none', src: '', provider: 'unknown' };
}
