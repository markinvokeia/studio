/**
 * Caché en memoria de archivos descargados (imágenes y PDF de órdenes, adjuntos de sesiones).
 *
 * Son archivos que no cambian para un mismo id: una vez bajados no hace falta volver a pedirlos
 * al cerrar y abrir un panel, cambiar de pestaña o volver a una orden. Vive mientras dure la
 * pestaña del navegador; al recargar la página se vuelve a bajar.
 *
 * - Dos pedidos del mismo archivo a la vez (la miniatura y el visor) comparten una sola descarga.
 * - Cancelar un pedido solo corta la descarga si nadie más la está esperando.
 * - Con un tope de memoria: pasado, se descartan los menos usados.
 * - Cada archivo tiene un único object URL, de la caché: quien lo muestra no lo crea ni lo libera
 *   (así sobrevive a desmontar y volver a montar el visor). Se libera al descartar el archivo.
 */

/** Tope de lo que se retiene en memoria. */
const MAX_BYTES = 300 * 1024 * 1024;

interface Entry {
    blob: Blob;
    /** Se crea la primera vez que alguien lo pide. */
    url?: string;
}

/** Orden de inserción = orden de uso (se reinsertan al leerlos): el primero es el menos usado. */
const entries = new Map<string, Entry>();
let totalBytes = 0;

interface InFlight {
    promise: Promise<Blob>;
    controller: AbortController;
    waiters: number;
}
const inFlight = new Map<string, InFlight>();

function store(key: string, blob: Blob) {
    // Uno solo más grande que el tope no se guarda: desalojaría todo lo demás.
    if (blob.size > MAX_BYTES) return;
    const previous = entries.get(key);
    if (previous) drop(key, previous);
    entries.set(key, { blob });
    totalBytes += blob.size;
    for (const [oldKey, oldEntry] of entries) {
        if (totalBytes <= MAX_BYTES) break;
        drop(oldKey, oldEntry);
    }
}

function drop(key: string, entry: Entry) {
    entries.delete(key);
    totalBytes -= entry.blob.size;
    if (entry.url) URL.revokeObjectURL(entry.url);
}

/** La entrada si ya se bajó, marcada como recién usada. */
function touch(key: string): Entry | undefined {
    const entry = entries.get(key);
    if (entry) {
        entries.delete(key);
        entries.set(key, entry);
    }
    return entry;
}

/** El archivo si ya se bajó; sin pedir nada. */
export function peekBlob(key: string): Blob | undefined {
    return touch(key)?.blob;
}

/**
 * Object URL del archivo si ya se bajó; sin pedir nada. Es de la caché: no hay que liberarlo, y
 * es siempre el mismo para el mismo archivo.
 */
export function peekBlobUrl(key: string): string | undefined {
    const entry = touch(key);
    if (!entry) return undefined;
    entry.url ??= URL.createObjectURL(entry.blob);
    return entry.url;
}

const abortError = () => new DOMException('The operation was aborted.', 'AbortError');

/**
 * El archivo de `key`: el ya bajado, el que se está bajando o una descarga nueva con `fetcher`.
 * Rechaza con AbortError si `signal` se cancela antes de tenerlo.
 */
export function cachedBlob(key: string, fetcher: (signal: AbortSignal) => Promise<Blob>, signal?: AbortSignal): Promise<Blob> {
    const cached = peekBlob(key);
    if (cached) return Promise.resolve(cached);
    if (signal?.aborted) return Promise.reject(abortError());

    let entry = inFlight.get(key);
    if (!entry) {
        const controller = new AbortController();
        /** Solo se borra a sí misma: otra descarga del mismo archivo pudo haberla reemplazado. */
        const forget = () => { if (inFlight.get(key)?.controller === controller) inFlight.delete(key); };
        const promise = fetcher(controller.signal).then(
            (blob) => {
                forget();
                store(key, blob);
                return blob;
            },
            (error) => {
                forget();
                throw error;
            },
        );
        entry = { promise, controller, waiters: 0 };
        inFlight.set(key, entry);
    }

    const current = entry;
    current.waiters += 1;
    return new Promise<Blob>((resolve, reject) => {
        let settled = false;
        const leave = () => {
            if (settled) return false;
            settled = true;
            current.waiters -= 1;
            signal?.removeEventListener('abort', onAbort);
            return true;
        };
        const onAbort = () => {
            if (!leave()) return;
            // Nadie más la espera: se corta la descarga, y un pedido nuevo empieza otra.
            if (current.waiters === 0 && inFlight.get(key) === current) {
                inFlight.delete(key);
                current.controller.abort();
            }
            reject(abortError());
        };
        signal?.addEventListener('abort', onAbort, { once: true });
        current.promise.then(
            (blob) => { if (leave()) resolve(blob); },
            (error) => { if (leave()) reject(error); },
        );
    });
}
