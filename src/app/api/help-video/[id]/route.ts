/**
 * Videos de las guías guardados en Google Drive (carpeta pública), servidos desde
 * Invoke para el reproductor del asistente.
 *
 * Drive rechaza (403) que un <video> de otro sitio lea el archivo directo
 * (`Sec-Fetch-Dest: video`): sólo lo entrega si se abre como página. Desde el
 * servidor sí lo entrega, así que acá se pasa tal cual, con soporte de `Range`
 * (adelantar y retroceder sin bajar el video entero). Sólo ids de archivos de
 * Drive: no es un proxy abierto. Para producción conviene un bucket propio
 * (scripts/videos/publish-videos.mjs), que el reproductor usa directo.
 */

const DRIVE_ID = /^[\w-]{10,100}$/;
const PASS_HEADERS = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'last-modified', 'etag'];
const UPSTREAM_TIMEOUT_MS = 30_000;

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!DRIVE_ID.test(id)) return new Response('Invalid video id', { status: 400 });

  const range = request.headers.get('range');
  let upstream: Response;
  try {
    upstream = await fetch(`https://drive.usercontent.google.com/download?id=${id}&export=download`, {
      headers: range ? { Range: range } : undefined,
      redirect: 'follow',
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)]),
      cache: 'no-store',
    });
  } catch {
    return new Response('Video unavailable', { status: 502 });
  }

  // Sin acceso o archivo muy grande, Drive responde una página HTML en vez del video.
  const type = upstream.headers.get('content-type') ?? '';
  if (!upstream.ok || !upstream.body || !type.startsWith('video/')) {
    await upstream.body?.cancel();
    return new Response('Video unavailable', { status: upstream.status === 404 ? 404 : 502 });
  }

  const headers = new Headers({ 'Cache-Control': 'public, max-age=3600', 'Accept-Ranges': 'bytes' });
  for (const name of PASS_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(upstream.body, { status: upstream.status, headers });
}
