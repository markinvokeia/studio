/**
 * De la `url` publicada en help_videos a lo que usa el reproductor del asistente.
 *
 * - Google Drive (`https://drive.google.com/file/d/<id>/view`, carpeta pública): Drive
 *   no deja que un <video> de otro sitio lea el archivo (403), así que pasa por
 *   `/api/help-video/<id>` (src/app/api/help-video); la miniatura es la que genera
 *   Drive (la intro del video). Sin subtítulos: la guía ya se lee en el globo.
 * - Cualquier otro hosting (GCS, `public/help-videos`): el mp4 tal cual, con la
 *   miniatura `.jpg` y los subtítulos `.vtt` al lado (los arma scripts/videos).
 */

export interface HelpVideoSource {
  src: string;
  poster: string;
  subtitles?: string;
  /** Para abrir el video fuera de Invoke si no carga. */
  external: string;
}

const DRIVE_ID = /drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:.*&)?id=)([\w-]{10,})/;

export function driveFileId(url: string): string | null {
  return url.match(DRIVE_ID)?.[1] ?? null;
}

export function helpVideoSource(url: string): HelpVideoSource {
  const driveId = driveFileId(url);
  if (driveId) {
    return {
      src: `/api/help-video/${driveId}`,
      poster: `https://drive.google.com/thumbnail?id=${driveId}&sz=w640`,
      external: `https://drive.google.com/file/d/${driveId}/view`,
    };
  }
  return {
    src: url,
    poster: url.replace(/\.mp4(\?.*)?$/, '.jpg$1'),
    subtitles: url.replace(/\.mp4(\?.*)?$/, '.vtt$1'),
    external: url,
  };
}

/** 75 → "1:15". */
export function formatVideoTime(seconds: number | null | undefined): string {
  if (!seconds || !Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
