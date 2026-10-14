import { toLocalISOString } from '@/lib/utils';
import type {
    StudyOrder,
    StudyOrderChatter,
    StudyOrderFollower,
    StudyOrderFollowerAction,
    StudyOrderFollowersResult,
    StudyOrderMessage,
    StudyOrderMessageKind,
} from '@/lib/types';

import { getStudyOrder, getStudyOrderAssignees } from './study-orders';

/**
 * Demo del chatter sin backend (NEXT_PUBLIC_STUDY_ORDER_CHATTER=mock).
 *
 * Imita a los endpoints del chatter (study-orders/chatter, messages/post, followers y
 * followers/candidates) sin tocar la base: no hace falta el script 131 ni los workflows nuevos.
 *
 *   · La bitácora, el doctor, el responsable y los candidatos a seguidor son REALES: salen del
 *     detalle de la orden y de /study-orders/assignees, que ya están desplegados.
 *   · Mensajes, notas y seguidores se guardan en el localStorage de este navegador, por orden.
 *     Sobreviven a recargar la página y a cambiar de usuario (para mostrar la conversación entre
 *     el doctor y la clínica), pero no los ve nadie más ni llegan a la base.
 *   · No hay notificaciones: el aviso a los seguidores necesita el backend.
 *
 * Las reglas de quién puede hacer qué son las mismas que el SQL (study-orders-sql.mjs), con los
 * permisos de la sesión en vez de STUDY_ORDERS_MESSAGE, que todavía no existe en la base.
 */

/** Quién usa la demo: el usuario de la sesión y lo que sus permisos le dejan hacer. */
export interface ChatterMockViewer {
    id: string;
    name: string;
    email?: string | null;
    /** STUDY_ORDERS_VIEW_ALL: la clínica. Ve y escribe notas, maneja seguidores. */
    canViewAll: boolean;
    /** Puede escribir en el chatter (en la demo: ver órdenes, propias o todas). */
    canMessage: boolean;
}

/** Textos con que arranca el hilo de una orden la primera vez, ya traducidos. */
export interface ChatterMockSeed {
    doctorMessage: string;
    clinicNote: string;
    clinicAuthor: string;
}

interface MockStore {
    version: 1;
    /** Doctor de la orden, guardado al sembrar: también es candidato a seguidor. */
    doctor: StudyOrderFollower | null;
    followers: StudyOrderFollower[];
    messages: StudyOrderMessage[];
}

const STORAGE_PREFIX = 'study-order-chatter-demo:v1:';
const storageKey = (orderId: string) => `${STORAGE_PREFIX}${orderId}`;

/** Para que la demo se sienta como una llamada de verdad (y se vean los spinners). */
const LATENCY_MS = 350;

/** Clave de localStorage de una orden: el componente escucha `storage` para recargar entre pestañas. */
export const isChatterMockStorageKey = (key: string | null, orderId: string) => key === storageKey(orderId);

function readStore(orderId: string): MockStore | null {
    try {
        const raw = localStorage.getItem(storageKey(orderId));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<MockStore>;
        if (parsed?.version !== 1 || !Array.isArray(parsed.followers) || !Array.isArray(parsed.messages)) return null;
        return { version: 1, doctor: parsed.doctor ?? null, followers: parsed.followers, messages: parsed.messages };
    } catch {
        return null;
    }
}

function writeStore(orderId: string, store: MockStore) {
    try {
        localStorage.setItem(storageKey(orderId), JSON.stringify(store));
    } catch {
        // Sin almacenamiento (ventana privada, cuota): la demo sigue andando hasta recargar.
    }
}

/** Borra los mensajes y seguidores de prueba de la orden: el próximo acceso la vuelve a sembrar. */
export function resetChatterMock(orderId: string) {
    try {
        localStorage.removeItem(storageKey(orderId));
    } catch {
        // Nada que borrar.
    }
    memory.delete(orderId);
}

/** Respaldo en memoria por si localStorage no está disponible. */
const memory = new Map<string, MockStore>();

const load = (orderId: string) => readStore(orderId) ?? memory.get(orderId) ?? null;
const save = (orderId: string, store: MockStore) => {
    memory.set(orderId, store);
    writeStore(orderId, store);
};

const wait = (signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, LATENCY_MS);
    signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
});

const throwIfAborted = (signal?: AbortSignal) => {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
};

const now = () => toLocalISOString(new Date());

const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `demo-${Date.now()}-${Math.random().toString(36).slice(2)}`);

/** `base` + minutos, en el mismo formato que las fechas del backend (hora local, sin zona), sin pasar de ahora. */
function minutesAfter(base: string, minutes: number): string {
    const parsed = new Date(base.replace(/Z$/, ''));
    if (Number.isNaN(parsed.getTime())) return now();
    const at = new Date(parsed.getTime() + minutes * 60_000);
    return at.getTime() > Date.now() ? now() : toLocalISOString(at);
}

async function fetchOrder(orderId: string, signal?: AbortSignal): Promise<StudyOrder> {
    const order = await getStudyOrder(orderId);
    throwIfAborted(signal);
    // getStudyOrder devuelve null sin acceso o si falla: el chatter muestra el error genérico.
    if (!order) throw new Error('');
    return order;
}

/**
 * Primera vez que se abre la orden en este navegador: siguen el doctor y el responsable (lo que
 * hace el trigger de la migración) y el hilo arranca con un mensaje del doctor y una nota interna,
 * para que la demo no empiece vacía.
 */
function seedStore(order: StudyOrder, seed: ChatterMockSeed): MockStore {
    const doctor = order.doctor_id ? { id: order.doctor_id, name: order.doctor_name || seed.clinicAuthor } : null;
    const followers: StudyOrderFollower[] = [];
    if (doctor) followers.push(doctor);
    if (order.assigned_to && order.assigned_to !== doctor?.id) {
        followers.push({ id: order.assigned_to, name: order.assigned_to_name || seed.clinicAuthor });
    }

    const base = order.submitted_at || order.created_at;
    const messages: StudyOrderMessage[] = [];
    if (doctor) {
        messages.push({
            id: newId(), kind: 'message', body: seed.doctorMessage,
            author_id: doctor.id, author_name: doctor.name, created_at: minutesAfter(base, 12),
        });
    }
    messages.push({
        id: newId(), kind: 'note', body: seed.clinicNote,
        author_id: order.assigned_to ?? null,
        author_name: order.assigned_to_name || seed.clinicAuthor,
        created_at: minutesAfter(base, 47),
    });

    return { version: 1, doctor, followers, messages };
}

async function ensureStore(orderId: string, seed: ChatterMockSeed, signal?: AbortSignal) {
    const order = await fetchOrder(orderId, signal);
    let store = load(orderId);
    if (!store) {
        store = seedStore(order, seed);
        save(orderId, store);
    }
    return { order, store };
}

/** Misma regla que MESSAGE_POST_SQL: la clínica o el doctor de la orden. */
const canWrite = (viewer: ChatterMockViewer, order: StudyOrder) =>
    viewer.canMessage && (viewer.canViewAll || order.doctor_id === viewer.id);

const followersResult = (store: MockStore, viewer: ChatterMockViewer): StudyOrderFollowersResult => ({
    followers: [...store.followers].sort((a, b) => a.name.localeCompare(b.name)),
    is_following: store.followers.some((f) => f.id === viewer.id),
});

export async function getStudyOrderChatterMock(
    orderId: string,
    viewer: ChatterMockViewer,
    seed: ChatterMockSeed,
    signal?: AbortSignal,
): Promise<StudyOrderChatter> {
    const [{ order, store }] = await Promise.all([ensureStore(orderId, seed, signal), wait(signal)]);
    const writer = canWrite(viewer, order);

    return {
        order_id: order.id,
        ...followersResult(store, viewer),
        can_post_message: writer,
        can_post_note: writer && viewer.canViewAll,
        can_manage_followers: writer && viewer.canViewAll,
        // Las notas son internas: el doctor derivador no las ve.
        messages: store.messages
            .filter((m) => m.kind === 'message' || viewer.canViewAll)
            .sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
        events: [...(order.events ?? [])].reverse(),
    };
}

export async function postStudyOrderMessageMock(
    params: { orderId: string; kind: StudyOrderMessageKind; body: string },
    viewer: ChatterMockViewer,
    seed: ChatterMockSeed,
): Promise<StudyOrderMessage> {
    const [{ order, store }] = await Promise.all([ensureStore(params.orderId, seed), wait()]);
    if (!canWrite(viewer, order) || (params.kind === 'note' && !viewer.canViewAll)) {
        throw new Error('');
    }

    const message: StudyOrderMessage = {
        id: newId(),
        kind: params.kind,
        body: params.body.trim(),
        author_id: viewer.id,
        author_name: viewer.name,
        created_at: now(),
    };
    // Re-leer: otra pestaña pudo escribir mientras tanto.
    const fresh = load(params.orderId) ?? store;
    const followers = fresh.followers.some((f) => f.id === viewer.id)
        ? fresh.followers
        : [...fresh.followers, { id: viewer.id, name: viewer.name, email: viewer.email ?? null }];
    save(params.orderId, { ...fresh, followers, messages: [...fresh.messages, message] });
    return message;
}

export async function updateStudyOrderFollowersMock(
    params: { orderId: string; action: StudyOrderFollowerAction; target?: StudyOrderFollower },
    viewer: ChatterMockViewer,
    seed: ChatterMockSeed,
): Promise<StudyOrderFollowersResult> {
    const [{ order, store }] = await Promise.all([ensureStore(params.orderId, seed), wait()]);
    const self: StudyOrderFollower = { id: viewer.id, name: viewer.name, email: viewer.email ?? null };
    const manages = canWrite(viewer, order) && viewer.canViewAll;

    let followers = store.followers;
    switch (params.action) {
        case 'follow':
            if (!canWrite(viewer, order)) throw new Error('');
            if (!followers.some((f) => f.id === self.id)) followers = [...followers, self];
            break;
        case 'unfollow':
            followers = followers.filter((f) => f.id !== self.id);
            break;
        case 'add':
            if (!manages || !params.target) throw new Error('');
            if (!followers.some((f) => f.id === params.target!.id)) followers = [...followers, params.target];
            break;
        case 'remove':
            if (!manages || !params.target) throw new Error('');
            followers = followers.filter((f) => f.id !== params.target!.id);
            break;
    }

    const next = { ...store, followers };
    save(params.orderId, next);
    return followersResult(next, viewer);
}

/** Igual que FOLLOWER_CANDIDATES_SQL: la clínica (los asignables) y el doctor de la orden. */
export async function getStudyOrderFollowerCandidatesMock(
    orderId: string,
    seed: ChatterMockSeed,
    signal?: AbortSignal,
): Promise<StudyOrderFollower[]> {
    const [{ store }, staff] = await Promise.all([
        ensureStore(orderId, seed, signal),
        getStudyOrderAssignees(signal),
    ]);
    const following = new Set(store.followers.map((f) => f.id));
    const byId = new Map<string, StudyOrderFollower>();
    for (const person of [...staff, ...(store.doctor ? [store.doctor] : [])]) {
        if (!following.has(person.id) && !byId.has(person.id)) {
            byId.set(person.id, { id: person.id, name: person.name, email: person.email ?? null });
        }
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}
