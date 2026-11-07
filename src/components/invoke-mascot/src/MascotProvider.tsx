'use client';
import * as React from 'react';
import { createPortal } from 'react-dom';
import { InvokeMascot } from './InvokeMascot';
import { ensureMascotStyles } from './styles';
import { useLookVector } from './useLookVector';
import {
  T,
  appearFrames,
  fadeInFrames,
  fadeOutFrames,
  hopFrames,
  jumpFrames,
  vanishFrames,
} from './travel';
import type {
  MascotActions,
  DockPosition,
  MascotAnchor,
  MascotHome,
  MascotHomeSide,
  MascotController,
  MascotGesture,
  MascotMood,
  MascotPhase,
  MascotTarget,
  Point,
  PointAtOptions,
  SayOptions,
  TravelAnimation,
  TravelOptions,
} from './types';

export interface MascotProviderProps {
  children?: React.ReactNode;
  /** Tamaño de la mascota en px. Por defecto 96. */
  size?: number;
  /** Lugar inicial. Por defecto 'bottom-right'. */
  dock?: DockPosition;
  /** Distancia a los bordes de la pantalla. Por defecto 20. */
  margin?: number;
  /** Espacio extra a respetar (ej. alto del header o de una barra inferior fija). */
  insets?: { top?: number; right?: number; bottom?: number; left?: number };
  /** Tras cuánto tiempo sin interacción se esconde detrás de la barra (MascotPeekZone). Por defecto 45 s. 0 = nunca. */
  idleAfterMs?: number;
  /** Tras cuánto tiempo sin pedidos se duerme/hiberna. Por defecto 3 horas. 0 = nunca. */
  sleepAfterMs?: number;
  /** Activada o no. Desactivada = durmiendo. Por defecto true. */
  enabled?: boolean;
  /** Animación por defecto de travelTo. Por defecto 'auto'. */
  defaultTravel?: TravelAnimation;
  /** Clave de localStorage donde se guarda la hora del último pedido (para dormirse aunque se recargue la página). null = no guardar. */
  storageKey?: string | null;
  /** z-index del escenario flotante. Por defecto 1000. */
  zIndex?: number;
  /** Oculta por completo la mascota (por ejemplo en el login). */
  hidden?: boolean;
  /** Qué hacer al hacer clic en la mascota. Por defecto: si duerme, despierta; si está escondida, sale; si no, saluda. */
  onMascotClick?: (mascot: MascotController) => void;
  /** Texto accesible. */
  label?: string;
  /** nonce para Content-Security-Policy, si la app lo usa. */
  styleNonce?: string;
  /** Lugar elegido arrastrándola (controlado: guardalo con `onHomeChange`). Sin él, usa `dock`. */
  home?: MascotHome | null;
  /** Se puede arrastrar para elegir su lugar. Sólo en reposo (sin acciones en curso). Por defecto false. */
  draggable?: boolean;
  /** Al soltarla en un lugar nuevo. */
  onHomeChange?: (home: MascotHome) => void;
  /**
   * En qué `MascotPeekZone` (por `name`) se esconde según el lado de su lugar; `default`
   * sin lugar elegido. Si ninguna zona tiene nombre, usa la última montada.
   */
  hideZones?: Partial<Record<MascotHomeSide | 'default', string>>;
  /** Selector de elementos que el globo no debe tapar (además del elemento señalado). */
  bubbleAvoid?: string;
  /**
   * false: la mascota y su globo dejan pasar clics, clic derecho y arrastres a lo que
   * hay debajo. Mientras guía se para encima del elemento que señala, y sin esto el
   * clic derecho de la persona caía en la mascota (salía el menú del navegador en vez
   * del menú contextual de la pantalla). Por defecto true.
   */
  interactive?: boolean;
  /**
   * false: nunca pone la boca de hablar (ánimo `talking` → `happy`). El globo se
   * sigue mostrando; sirve para cuando la voz está apagada. Por defecto true.
   */
  canTalk?: boolean;
}

interface Zone {
  id: number;
  name?: string;
  usable: () => boolean;
}

interface BubblePlace {
  left: number;
  top: number;
  /** Esquina del globo que apunta a la mascota. */
  tail: 'bl' | 'br' | 'tl' | 'tr' | 'l' | 'r';
}

const DEFAULT_HIDE_ZONES: Record<MascotHomeSide | 'default', string> = {
  default: 'right',
  right: 'right',
  left: 'left',
  top: 'content',
  bottom: 'content',
};
/** Distancia mínima del puntero para que un clic pase a ser arrastre. */
const DRAG_THRESHOLD = 6;
/** Franja de cada costado (fracción del ancho) que cuenta como "izquierda" o "derecha". */
const SIDE_BAND = 0.25;

interface Burst {
  id: number;
  x: number;
  y: number;
}

interface Internal {
  size: number;
  phase: MascotPhase;
  activeZone: number | null;
  peekExiting: boolean;
  /** Lugar elegido (para las zonas con `edge="auto"` y para asomarse donde la soltaron). */
  home: MascotHome | null;
  /** Centro de la mascota (viewport) al esconderse. */
  peekAt: Point | null;
  registerZone(name: string | undefined, usable: () => boolean): { id: number; unregister: () => void };
  onPeekExited(): void;
  onPeekClick(): void;
}

const MascotContext = React.createContext<MascotController | null>(null);
export const MascotInternalContext = React.createContext<Internal | null>(null);

/** Hook para controlar la mascota desde cualquier componente. */
export function useMascot(): MascotController {
  const c = React.useContext(MascotContext);
  if (!c) throw new Error('useMascot() debe usarse dentro de <MascotProvider>.');
  return c;
}

const DOCKS: MascotAnchor[] = ['bottom-right', 'bottom-left', 'top-right', 'top-left', 'center-right', 'center-left', 'home'];
const isDock = (t: unknown): t is MascotAnchor => typeof t === 'string' && (DOCKS as string[]).includes(t);
const sameHome = (a: MascotHome | null, b: MascotHome | null) =>
  a === b || (!!a && !!b && a.side === b.side && Math.abs(a.x - b.x) < 1e-4 && Math.abs(a.y - b.y) < 1e-4);
const isPoint = (t: unknown): t is Point =>
  !!t && typeof t === 'object' && typeof (t as Point).x === 'number' && typeof (t as Point).y === 'number' && !(t instanceof Element);

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
/** Espera `ms` o hasta que se aborte `signal` (lo que pase primero). Sin señal, `Infinity` = 3,5 s. */
const holdFor = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((r) => {
    if (signal?.aborted) return r();
    const t = Number.isFinite(ms) ? setTimeout(r, ms) : signal ? undefined : setTimeout(r, 3500);
    signal?.addEventListener('abort', () => { if (t) clearTimeout(t); r(); }, { once: true });
  });
const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const reducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function readStorage(key: string | null): number | null {
  if (!key) return null;
  try {
    const v = window.localStorage.getItem(key);
    return v ? Number(v) || null : null;
  } catch {
    return null;
  }
}
function writeStorage(key: string | null, value: number) {
  if (!key) return;
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    /* modo privado o storage bloqueado: se ignora */
  }
}

const BURST_COLORS = ['#2F9BF2', '#8B5CF6', '#E040C8', '#FF7A3D', '#5FD068', '#FACC15'];

/**
 * Monta la mascota flotante y expone su control con `useMascot()`.
 * Ponelo una sola vez, cerca de la raíz de la app.
 */
export function MascotProvider({
  children,
  size = 96,
  dock = 'bottom-right',
  margin = 20,
  insets,
  idleAfterMs = 45_000,
  sleepAfterMs = 3 * 60 * 60 * 1000,
  enabled: enabledProp = true,
  defaultTravel = 'auto',
  storageKey = 'invoke-mascot:last-request',
  zIndex = 1000,
  hidden = false,
  onMascotClick,
  label = 'Asistente de Invoke',
  styleNonce,
  home: homeProp = null,
  draggable = false,
  onHomeChange,
  hideZones,
  bubbleAvoid,
  interactive = true,
  canTalk = true,
}: MascotProviderProps) {
  // ---------- estado visible ----------
  const [phase, setPhaseS] = React.useState<MascotPhase>('active');
  const [mood, setMoodS] = React.useState<MascotMood>('neutral');
  const [gesture, setGestureS] = React.useState<MascotGesture>('none');
  const [pointAngle, setPointAngle] = React.useState<number | null>(null);
  const [message, setMessageS] = React.useState<string | null>(null);
  const [enabled, setEnabledS] = React.useState<boolean>(enabledProp);
  const [lookMode, setLookMode] = React.useState<'cursor' | Point>('cursor');
  const [stageVisible, setStageVisible] = React.useState(true);
  const [pos, setPos] = React.useState<Point>({ x: -9999, y: -9999 });
  const [highlight, setHighlight] = React.useState<DOMRect | null>(null);
  const [bursts, setBursts] = React.useState<Burst[]>([]);
  const [activeZone, setActiveZone] = React.useState<number | null>(null);
  const [peekExiting, setPeekExiting] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const [home, setHomeS] = React.useState<MascotHome | null>(homeProp);
  const [peekAt, setPeekAt] = React.useState<Point | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const [bubblePlace, setBubblePlace] = React.useState<BubblePlace | null>(null);

  // ---------- refs (fuente de verdad para los flujos async) ----------
  const actorRef = React.useRef<HTMLDivElement>(null);
  const phaseRef = React.useRef<MascotPhase>('active');
  const enabledRef = React.useRef<boolean>(enabledProp);
  const messageRef = React.useRef<string | null>(null);
  const posRef = React.useRef<Point>({ x: -9999, y: -9999 });
  const dockRef = React.useRef<MascotAnchor | null>(homeProp ? 'home' : dock);
  const homeRef = React.useRef<MascotHome | null>(homeProp);
  const zonesRef = React.useRef<Zone[]>([]);
  const activeZoneRef = React.useRef<number | null>(null);
  const draggingRef = React.useRef(false);
  const dragRef = React.useRef<{ id: number; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);
  const suppressClickRef = React.useRef(false);
  const bubbleRef = React.useRef<HTMLDivElement>(null);
  /** Elemento que está señalando (el globo no lo tapa). */
  const pointedRef = React.useRef<Element | null>(null);
  const lastRequestRef = React.useRef<number>(Date.now());
  const lastInteractionRef = React.useRef<number>(Date.now());
  const busyRef = React.useRef(0);
  const queueRef = React.useRef<Promise<unknown>>(Promise.resolve());
  const zoneSeq = React.useRef(0);
  const peekExitResolve = React.useRef<(() => void) | null>(null);
  const burstSeq = React.useRef(0);
  const aliveRef = React.useRef(true);
  const lastPersist = React.useRef(0);

  const props = { size, dock, margin, insets, defaultTravel, storageKey, idleAfterMs, sleepAfterMs, draggable, onHomeChange, hideZones, bubbleAvoid };
  const propsRef = React.useRef(props);
  propsRef.current = props;

  const setPhase = (p: MascotPhase) => {
    phaseRef.current = p;
    setPhaseS(p);
  };
  const setMessage = (m: string | null) => {
    messageRef.current = m;
    setMessageS(m);
  };

  // ---------- geometría ----------
  /** Límites de la esquina superior izquierda respetando márgenes e insets. */
  const bounds = () => {
    const { size: s, margin: m, insets: ins } = propsRef.current;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const L = m + (ins?.left ?? 0);
    const Tt = m + (ins?.top ?? 0);
    return {
      L,
      R: Math.max(L, vw - s - m - (ins?.right ?? 0)),
      Tt,
      B: Math.max(Tt, vh - s - m - (ins?.bottom ?? 0)),
    };
  };

  /** Dónde descansa en su lugar elegido (esquina superior izquierda). */
  const homeTL = (h: MascotHome): Point => {
    const s = propsRef.current.size;
    const { L, R, Tt, B } = bounds();
    return {
      x: clamp(h.x * window.innerWidth - s / 2, L, R),
      y: clamp(h.y * window.innerHeight - s / 2, Tt, B),
    };
  };

  const dockPoint = (d: MascotAnchor): Point => {
    if (d === 'home') return homeRef.current ? homeTL(homeRef.current) : dockPoint(propsRef.current.dock);
    const s = propsRef.current.size;
    const vh = window.innerHeight;
    const { L, R, Tt, B } = bounds();
    const C = (vh - s) / 2;
    switch (d) {
      case 'bottom-left':
        return { x: L, y: B };
      case 'top-right':
        return { x: R, y: Tt };
      case 'top-left':
        return { x: L, y: Tt };
      case 'center-right':
        return { x: R, y: C };
      case 'center-left':
        return { x: L, y: C };
      default:
        return { x: R, y: B };
    }
  };

  const clampTL = (p: Point): Point => {
    const { size: s, margin: m } = propsRef.current;
    return {
      x: clamp(p.x, m, Math.max(m, window.innerWidth - s - m)),
      y: clamp(p.y, m, Math.max(m, window.innerHeight - s - m)),
    };
  };

  const resolveElement = (t: unknown): Element | null => {
    if (typeof window === 'undefined') return null;
    if (t instanceof Element) return t;
    if (typeof t === 'string' && !isDock(t)) {
      try {
        return document.querySelector(t);
      } catch {
        return null;
      }
    }
    return null;
  };

  /** Punto del viewport que representa el destino (para mirar/señalar). */
  const resolvePoint = (t: MascotTarget | MascotAnchor): Point | null => {
    const s = propsRef.current.size;
    if (isPoint(t)) return t;
    if (isDock(t)) {
      const p = dockPoint(t);
      return { x: p.x + s / 2, y: p.y + s / 2 };
    }
    const el = resolveElement(t);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };

  /** Esquina superior izquierda donde debe quedar la mascota al viajar a `t`. */
  const resolveTL = (t: MascotTarget | MascotAnchor): { tl: Point; dock: MascotAnchor | null } | null => {
    const s = propsRef.current.size;
    if (isDock(t)) return { tl: dockPoint(t), dock: t };
    if (isPoint(t)) return { tl: clampTL({ x: t.x - s / 2, y: t.y - s / 2 }), dock: null };
    const el = resolveElement(t);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const gap = 10;
    let x = r.right + gap;
    let y = r.top + r.height / 2 - s * 0.6;
    if (x + s > window.innerWidth - propsRef.current.margin) x = r.left - s - gap;
    if (x < propsRef.current.margin) {
      x = r.left + r.width / 2 - s / 2;
      y = r.bottom + gap;
    }
    return { tl: clampTL({ x, y }), dock: null };
  };

  const actorCenter = (): Point => ({
    x: posRef.current.x + propsRef.current.size / 2,
    y: posRef.current.y + propsRef.current.size * 0.52,
  });

  const setPosNow = (p: Point) => {
    posRef.current = p;
    const el = actorRef.current;
    if (el) el.style.transform = T(p);
    setPos(p);
  };

  // ---------- animación del actor ----------
  const runFrames = async (frames: Keyframe[], duration: number) => {
    const el = actorRef.current;
    if (!el || typeof el.animate !== 'function') return;
    const a = el.animate(frames, { duration, fill: 'forwards', easing: 'linear' });
    try {
      await a.finished;
    } catch {
      /* cancelada */
    }
    const last = frames[frames.length - 1];
    if (typeof last.transform === 'string') el.style.transform = last.transform;
    el.style.opacity = last.opacity !== undefined ? String(last.opacity) : '';
    a.cancel();
  };

  const burst = (p: Point) => {
    const id = ++burstSeq.current;
    setBursts((b) => [...b, { id, x: p.x, y: p.y }]);
    setTimeout(() => aliveRef.current && setBursts((b) => b.filter((x) => x.id !== id)), 900);
  };

  // ---------- cola de acciones ----------
  const enqueue = <R,>(fn: () => Promise<R>): Promise<R> => {
    const run = async () => {
      busyRef.current++;
      try {
        return await fn();
      } finally {
        busyRef.current--;
        lastInteractionRef.current = Date.now();
      }
    };
    const p = queueRef.current.then(run, run);
    queueRef.current = p.catch(() => undefined);
    return p;
  };

  const markInteraction = () => {
    lastInteractionRef.current = Date.now();
  };
  const markRequest = () => {
    const now = Date.now();
    lastRequestRef.current = now;
    lastInteractionRef.current = now;
    if (now - lastPersist.current > 5000) {
      lastPersist.current = now;
      writeStorage(propsRef.current.storageKey, now);
    }
  };

  // ---------- flujos internos ----------
  const doTravel = async (target: MascotTarget | MascotAnchor, opts: TravelOptions = {}) => {
    const r = resolveTL(target);
    if (!r) return;
    const to = r.tl;
    const from = posRef.current;
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    if (dist < 4) {
      dockRef.current = r.dock;
      return;
    }
    let anim: TravelAnimation | 'fade' = opts.animation ?? propsRef.current.defaultTravel;
    if (anim === 'auto') anim = dist < 260 ? 'hop' : dist < 760 ? 'jump' : 'teleport';
    if (reducedMotion()) anim = 'fade';
    const speed = clamp(opts.speed ?? 1, 0.25, 4);
    const s = propsRef.current.size;
    const center = (p: Point) => ({ x: p.x + s / 2, y: p.y + s / 2 });

    setPhase('traveling');
    setMessage(null);
    setGestureS('none');
    setPointAngle(null);
    setHighlight(null);
    setLookMode(center(to)); // mira hacia donde va
    setMoodS('happy');
    await wait(240 / speed);

    if (anim === 'hop') {
      const hops = clamp(Math.round(dist / 110), 2, 10);
      await runFrames(hopFrames(from, to, hops, Math.min(48, 24 + dist / 30)), (hops * 360) / speed);
    } else if (anim === 'jump') {
      setMoodS('surprised');
      setTimeout(() => aliveRef.current && setMoodS('happy'), 380 / speed);
      await runFrames(jumpFrames(from, to), (900 + Math.min(500, dist * 0.4)) / speed);
    } else if (anim === 'teleport') {
      setTimeout(() => aliveRef.current && burst({ x: from.x + s / 2, y: from.y + s * 0.3 }), 300 / speed);
      await runFrames(vanishFrames(from), 440 / speed);
      setPosNow(to);
      if (actorRef.current) actorRef.current.style.opacity = '0';
      await wait(160 / speed);
      setMoodS('surprised');
      setTimeout(() => aliveRef.current && burst({ x: to.x + s / 2, y: to.y + s * 0.75 }), 220 / speed);
      await runFrames(appearFrames(to), 580 / speed);
    } else {
      await runFrames(fadeOutFrames(from), 160);
      setPosNow(to);
      await runFrames(fadeInFrames(to), 160);
    }
    setPosNow(to);
    dockRef.current = r.dock;
    setLookMode('cursor');
    setMoodS('neutral');
    setPhase('active');
  };

  const showStage = async () => {
    // Al salir del escondite vuelve a su lugar de anclaje.
    const d = dockRef.current ?? propsRef.current.dock;
    dockRef.current = d;
    setPosNow(dockPoint(d));
    if (actorRef.current) actorRef.current.style.opacity = '0';
    setStageVisible(true);
    setPhase('active');
    await nextFrame();
    const s = propsRef.current.size;
    if (reducedMotion()) {
      await runFrames(fadeInFrames(posRef.current), 160);
    } else {
      setTimeout(() => aliveRef.current && burst({ x: posRef.current.x + s / 2, y: posRef.current.y + s * 0.75 }), 220);
      await runFrames(appearFrames(posRef.current), 580);
    }
  };

  /** Zona donde esconderse: la del lado de su lugar (o la de por defecto), si está visible. */
  const pickZone = (): number | null => {
    const usable = zonesRef.current.filter((z) => z.usable());
    if (!usable.length) return null;
    const named = usable.filter((z) => z.name);
    if (!named.length) return usable[usable.length - 1].id;
    const zones = { ...DEFAULT_HIDE_ZONES, ...propsRef.current.hideZones };
    const want = homeRef.current && dockRef.current === 'home' ? zones[homeRef.current.side] : zones.default;
    return named.find((z) => z.name === want)?.id ?? null;
  };

  const doHide = async () => {
    if (phaseRef.current !== 'active') return;
    const zone = pickZone();
    if (zone === null) return;
    activeZoneRef.current = zone;
    setActiveZone(zone);
    setPeekAt(actorCenter());
    setMessage(null);
    setGestureS('none');
    setPointAngle(null);
    setHighlight(null);
    setMoodS('happy');
    await wait(250);
    const s = propsRef.current.size;
    const from = posRef.current;
    if (reducedMotion()) {
      await runFrames(fadeOutFrames(from), 160);
    } else {
      setTimeout(() => aliveRef.current && burst({ x: from.x + s / 2, y: from.y + s * 0.3 }), 300);
      await runFrames(vanishFrames(from), 440);
    }
    setStageVisible(false);
    if (actorRef.current) actorRef.current.style.opacity = '';
    setMoodS('neutral');
    setLookMode('cursor');
    setPhase('peeking');
  };

  const doShow = async () => {
    if (phaseRef.current !== 'peeking') return;
    if (activeZoneRef.current !== null && zonesRef.current.some((z) => z.id === activeZoneRef.current)) {
      await Promise.race([
        new Promise<void>((res) => {
          peekExitResolve.current = res;
          setPeekExiting(true);
        }),
        wait(1600),
      ]);
    }
    peekExitResolve.current = null;
    setPeekExiting(false);
    await showStage();
    setMoodS('happy');
    await wait(350);
    setMoodS('neutral');
  };

  const doSleep = async () => {
    if (phaseRef.current === 'sleeping') return;
    if (phaseRef.current === 'peeking') await doShow();
    setMessage(null);
    setGestureS('none');
    setPointAngle(null);
    setHighlight(null);
    setLookMode('cursor');
    setMoodS('sleepy');
    await wait(1900);
    setMoodS('sleeping');
    setPhase('sleeping');
  };

  const doWake = async () => {
    if (phaseRef.current !== 'sleeping' || !enabledRef.current) return;
    markRequest();
    setPhase('active');
    setMoodS('surprised');
    await wait(450);
    setMoodS('happy');
    setGestureS('celebrate');
    await wait(900);
    setGestureS('none');
    setMoodS('neutral');
  };

  /** Despierta o saca de su escondite antes de una acción. false = está desactivada. */
  const ensureAwake = async (): Promise<boolean> => {
    if (phaseRef.current === 'sleeping') {
      if (!enabledRef.current) return false;
      await doWake();
    }
    if (phaseRef.current === 'peeking') await doShow();
    return true;
  };

  const readDuration = (text: string) => clamp(1800 + text.length * 55, 2500, 9000);

  // ---------- API pública (estable) ----------
  const apiRef = React.useRef<MascotActions>();
  if (!apiRef.current) {
    apiRef.current = {
      setMood: async (m: MascotMood) => {
        markInteraction();
        if (phaseRef.current === 'sleeping' || phaseRef.current === 'peeking') return;
        setMoodS(m);
      },
      gesture: (g: Exclude<MascotGesture, 'point'>, durationMs = 1600) =>
        enqueue(async () => {
          markRequest();
          if (!(await ensureAwake())) return;
          setGestureS(g);
          if (g === 'celebrate') setMoodS('happy');
          await wait(durationMs);
          setGestureS('none');
          if (g === 'celebrate') setMoodS('neutral');
        }),
      say: (text: string, o: SayOptions = {}) =>
        enqueue(async () => {
          markRequest();
          if (!(await ensureAwake())) return;
          setMessage(text);
          setMoodS(o.mood ?? 'talking');
          if (o.gesture) setGestureS(o.gesture);
          await wait(o.duration ?? readDuration(text));
          if (messageRef.current === text) setMessage(null);
          setMoodS('neutral');
          if (o.gesture) setGestureS('none');
        }),
      pointAt: (target: MascotTarget, o: PointAtOptions = {}) =>
        enqueue(async () => {
          markRequest();
          if (o.signal?.aborted) return;
          if (!(await ensureAwake())) return;
          if (o.travel) await doTravel(target, { animation: typeof o.travel === 'string' ? o.travel : 'auto' });
          const p = resolvePoint(target);
          if (!p) return;
          const c = actorCenter();
          const angle = (Math.atan2(p.y - c.y, p.x - c.x) * 180) / Math.PI;
          const el = resolveElement(target);
          pointedRef.current = el;
          setPointAngle(angle);
          setGestureS('point');
          setLookMode(p);
          if (el && o.highlight !== false) setHighlight(el.getBoundingClientRect());
          if (o.say) {
            setMessage(o.say);
            setMoodS('talking');
          } else {
            setMoodS('happy');
          }
          // Señalamiento sin fin (guías): habla lo que tarda en leerse (o hasta que la voz
          // termina) y después sigue señalando contenta, con el globo todavía visible.
          const stopTalking = () => { if (aliveRef.current && messageRef.current === o.say) setMoodS('happy'); };
          if (o.say && o.talkUntil) void o.talkUntil.then(stopTalking, stopTalking);
          const talkTimer =
            o.say && !o.talkUntil && o.duration !== undefined && !Number.isFinite(o.duration)
              ? setTimeout(stopTalking, readDuration(o.say))
              : undefined;
          await holdFor(o.duration ?? (o.say ? readDuration(o.say) : 3500), o.signal);
          if (talkTimer) clearTimeout(talkTimer);
          if (pointedRef.current === el) pointedRef.current = null;
          setGestureS('none');
          setPointAngle(null);
          setLookMode('cursor');
          setHighlight(null);
          if (o.say && messageRef.current === o.say) setMessage(null);
          setMoodS('neutral');
        }),
      lookAt: (target) => {
        markInteraction();
        if (target === 'cursor') setLookMode('cursor');
        else setLookMode(resolvePoint(target) ?? 'cursor');
      },
      travelTo: (target, o = {}) =>
        enqueue(async () => {
          markInteraction();
          if (!(await ensureAwake())) return;
          await doTravel(target, o);
        }),
      hide: () => enqueue(doHide),
      show: () =>
        enqueue(async () => {
          markInteraction();
          await doShow();
        }),
      sleep: () => enqueue(doSleep),
      wake: () =>
        enqueue(async () => {
          markRequest();
          await doWake();
        }),
      setEnabled: (v: boolean) => {
        enabledRef.current = v;
        setEnabledS(v);
        return v
          ? enqueue(async () => {
              markRequest();
              await doWake();
            })
          : enqueue(doSleep);
      },
      notifyRequest: () => markRequest(),
    };
  }
  const api = apiRef.current!;

  const controller = React.useMemo<MascotController>(
    () => ({ ...api, phase, mood, currentGesture: gesture, message, enabled }),
    [api, phase, mood, gesture, message, enabled],
  );
  const controllerRef = React.useRef(controller);
  controllerRef.current = controller;

  // ---------- efectos ----------
  React.useEffect(() => {
    aliveRef.current = true;
    ensureMascotStyles(styleNonce);
    setMounted(true);
    // ¿Hace horas que no le piden nada? Arranca dormida, sin animación.
    const stored = readStorage(propsRef.current.storageKey);
    const now = Date.now();
    if (stored) lastRequestRef.current = stored;
    else writeStorage(propsRef.current.storageKey, now);
    const sa = propsRef.current.sleepAfterMs;
    if (!enabledRef.current || (sa > 0 && stored && now - stored > sa)) {
      setMoodS('sleeping');
      setPhase('sleeping');
    }
    return () => {
      aliveRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Posición inicial y al redimensionar.
  React.useLayoutEffect(() => {
    if (!mounted) return;
    const place = () => {
      if (phaseRef.current === 'traveling') return;
      if (dockRef.current) setPosNow(dockPoint(dockRef.current));
      else setPosNow(clampTL(posRef.current));
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, size, margin, insets?.top, insets?.right, insets?.bottom, insets?.left]);

  // Cambio de dock por prop.
  React.useEffect(() => {
    if (!mounted) return;
    if (dock !== dockRef.current) void api.travelTo(dock);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dock]);

  // enabled controlado por prop.
  React.useEffect(() => {
    if (enabledProp !== enabledRef.current) void api.setEnabled(enabledProp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabledProp]);

  // Temporizadores: esconderse en reposo y dormirse tras horas sin pedidos.
  React.useEffect(() => {
    const t = setInterval(() => {
      if (busyRef.current > 0 || draggingRef.current) return;
      const now = Date.now();
      const { idleAfterMs: ia, sleepAfterMs: sa } = propsRef.current;
      if (!enabledRef.current) {
        if (phaseRef.current !== 'sleeping') void enqueue(doSleep);
        return;
      }
      if (sa > 0 && phaseRef.current !== 'sleeping' && now - lastRequestRef.current > sa) {
        void enqueue(doSleep);
        return;
      }
      if (
        ia > 0 &&
        phaseRef.current === 'active' &&
        !messageRef.current &&
        now - lastInteractionRef.current > ia &&
        pickZone() !== null
      ) {
        void enqueue(doHide);
      }
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- zonas para esconderse ----------
  const internal = React.useMemo<Internal>(
    () => ({
      size,
      phase,
      activeZone,
      peekExiting,
      home,
      peekAt,
      registerZone: (name, usable) => {
        const id = ++zoneSeq.current;
        zonesRef.current = [...zonesRef.current, { id, name, usable }];
        const unregister = () => {
          zonesRef.current = zonesRef.current.filter((z) => z.id !== id);
          if (activeZoneRef.current !== id) return;
          activeZoneRef.current = null;
          setActiveZone(null);
          if (phaseRef.current === 'peeking') {
            // La barra desapareció (cambio de página): vuelve a escena.
            if (peekExitResolve.current) peekExitResolve.current();
            else void enqueue(async () => {
              if (phaseRef.current === 'peeking') await showStage();
            });
          }
        };
        return { id, unregister };
      },
      onPeekExited: () => {
        peekExitResolve.current?.();
      },
      onPeekClick: () => {
        markRequest();
        if (onMascotClick) onMascotClick(controllerRef.current);
        else void api.show();
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [size, phase, activeZone, peekExiting, home, peekAt, onMascotClick],
  );

  // Lugar elegido controlado por prop (la app lo guarda y lo devuelve; o lo borra).
  React.useEffect(() => {
    if (sameHome(homeProp, homeRef.current)) return;
    homeRef.current = homeProp;
    setHomeS(homeProp);
    if (!mounted || draggingRef.current) return;
    if (homeProp) {
      if (dockRef.current === 'home' || dockRef.current === null) {
        dockRef.current = 'home';
        if (phaseRef.current === 'active' && busyRef.current === 0) setPosNow(homeTL(homeProp));
      }
    } else if (dockRef.current === 'home') {
      void api.travelTo(propsRef.current.dock);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeProp?.side, homeProp?.x, homeProp?.y, mounted]);

  // ---------- arrastrar para elegir su lugar ----------
  /** Lado según dónde la soltó: franjas de los costados, si no arriba o abajo. */
  const homeFromDrop = (center: Point): MascotHome => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const side: MascotHomeSide =
      center.x < vw * SIDE_BAND ? 'left' : center.x > vw * (1 - SIDE_BAND) ? 'right' : center.y < vh / 2 ? 'top' : 'bottom';
    const draft = { side, x: center.x / vw, y: center.y / vh };
    // Se acomoda dentro de los márgenes (no queda debajo del riel ni del menú).
    const tl = homeTL(draft);
    const s = propsRef.current.size;
    return { side, x: (tl.x + s / 2) / vw, y: (tl.y + s / 2) / vh };
  };

  const onHitPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!propsRef.current.draggable || e.button !== 0) return;
    if (phaseRef.current !== 'active' || busyRef.current > 0) return;
    dragRef.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: posRef.current.x, oy: posRef.current.y, moved: false };
  };

  const onHitPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moved) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      if (phaseRef.current !== 'active' || busyRef.current > 0) {
        dragRef.current = null;
        return;
      }
      d.moved = true;
      draggingRef.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragging(true);
      setMessage(null);
      setGestureS('none');
      setPointAngle(null);
      setLookMode('cursor');
      setMoodS('surprised');
    }
    setPosNow(clampTL({ x: d.ox + dx, y: d.oy + dy }));
  };

  const onHitPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    dragRef.current = null;
    if (!d.moved) return;
    draggingRef.current = false;
    suppressClickRef.current = true;
    setDragging(false);
    const next = homeFromDrop(actorCenter());
    homeRef.current = next;
    setHomeS(next);
    dockRef.current = 'home';
    setPosNow(homeTL(next));
    markInteraction();
    setMoodS('happy');
    setTimeout(() => {
      if (aliveRef.current && phaseRef.current === 'active' && !messageRef.current) setMoodS('neutral');
    }, 900);
    propsRef.current.onHomeChange?.(next);
  };

  // ---------- globo: dónde entra completo ----------
  React.useLayoutEffect(() => {
    const el = bubbleRef.current;
    if (!message || !el || !stageVisible) {
      setBubblePlace(null);
      return;
    }
    const place = () => {
      const s = propsRef.current.size;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const m = 8;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const { x, y } = posRef.current;
      const above = y + 6 - h;
      const below = y + s - 6;
      const right = x + s * 0.62;
      const left = x + s * 0.38 - w;
      // Al costado prueba varias alturas: alineado arriba, centrado y alineado abajo con la mascota.
      const sideTops = [y + s * 0.12, y + s / 2 - h / 2, y + s - h, y - h / 2].map((t) => clamp(t, m, Math.max(m, vh - h - m)));
      const sideR = sideTops.map((top) => ({ left: x + s * 0.9, top, tail: 'l' as const }));
      const sideL = sideTops.map((top) => ({ left: x + s * 0.1 - w, top, tail: 'r' as const }));
      const aboveR: BubblePlace = { left: right, top: above, tail: 'bl' };
      const aboveL: BubblePlace = { left, top: above, tail: 'br' };
      const belowR: BubblePlace = { left: right, top: below, tail: 'tl' };
      const belowL: BubblePlace = { left, top: below, tail: 'tr' };
      // Primero arriba del lado de siempre; si no entra (cerca del tope), a un costado; si no, abajo.
      const preferRight = x + s / 2 <= vw / 2;
      const candidates: BubblePlace[] = preferRight
        ? [aboveR, aboveL, ...sideR, ...sideL, belowR, belowL]
        : [aboveL, aboveR, ...sideL, ...sideR, belowL, belowR];
      const avoid: DOMRect[] = [];
      if (pointedRef.current) avoid.push(pointedRef.current.getBoundingClientRect());
      const sel = propsRef.current.bubbleAvoid;
      if (sel) {
        try {
          document.querySelectorAll(sel).forEach((n) => avoid.push(n.getBoundingClientRect()));
        } catch {
          /* selector inválido */
        }
      }
      const fits = (b: BubblePlace) => b.left >= m && b.top >= m && b.left + w <= vw - m && b.top + h <= vh - m;
      /** Cuánto tapa de lo que no debe tapar (área, con 4 px de aire). */
      const covered = (b: BubblePlace) =>
        avoid.reduce((sum, r) => {
          const ox = Math.min(b.left + w, r.right + 4) - Math.max(b.left, r.left - 4);
          const oy = Math.min(b.top + h, r.bottom + 4) - Math.max(b.top, r.top - 4);
          return sum + (r.width > 0 && ox > 0 && oy > 0 ? ox * oy : 0);
        }, 0);
      const inside = candidates.filter(fits);
      // Si ninguno queda libre, el que menos tapa (y siempre completo en pantalla).
      const pick =
        inside.find((b) => covered(b) === 0) ??
        (inside.length ? inside.reduce((best, b) => (covered(b) < covered(best) ? b : best)) : null) ?? {
          ...candidates[0],
          left: clamp(candidates[0].left, m, Math.max(m, vw - w - m)),
          top: clamp(candidates[0].top, m, Math.max(m, vh - h - m)),
        };
      const next = { left: pick.left - x, top: pick.top - y, tail: pick.tail };
      setBubblePlace((prev) =>
        prev && prev.tail === next.tail && Math.abs(prev.left - next.left) < 0.5 && Math.abs(prev.top - next.top) < 0.5 ? prev : next,
      );
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [message, pos.x, pos.y, size, stageVisible]);

  // ---------- render ----------
  const look = useLookVector(actorRef, lookMode, mounted && phase !== 'sleeping' && stageVisible);

  const handleClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    markRequest();
    if (onMascotClick) return onMascotClick(controllerRef.current);
    if (phaseRef.current === 'sleeping') void api.wake();
    else if (phaseRef.current === 'active' && !messageRef.current) void api.gesture('wave', 1400);
  };

  const side: 'left' | 'right' =
    typeof window !== 'undefined' && pos.x + size / 2 > window.innerWidth / 2 ? 'left' : 'right';

  const stage =
    mounted && !hidden
      ? createPortal(
          <div className={`ivm-stage${interactive ? '' : ' ivm-passthrough'}`} style={{ zIndex }} data-ivm-phase={phase}>
            {highlight && (
              <div
                className="ivm-highlight"
                style={{
                  left: highlight.left - 6,
                  top: highlight.top - 6,
                  width: highlight.width + 12,
                  height: highlight.height + 12,
                  zIndex,
                }}
              />
            )}
            {bursts.map((b) => (
              <div key={b.id} className="ivm-burst" style={{ left: b.x, top: b.y, zIndex }}>
                {Array.from({ length: 12 }, (_, i) => {
                  const a = (i / 12) * Math.PI * 2 + (b.id % 7) * 0.3;
                  const d = 34 + ((i * 37 + b.id * 13) % 30);
                  return (
                    <i
                      key={i}
                      style={
                        {
                          background: BURST_COLORS[i % BURST_COLORS.length],
                          '--dx': `${Math.cos(a) * d}px`,
                          '--dy': `${Math.sin(a) * d}px`,
                        } as React.CSSProperties
                      }
                    />
                  );
                })}
              </div>
            ))}
            <div
              ref={actorRef}
              className={`ivm-actor${stageVisible ? '' : ' ivm-hidden'}${dragging ? ' ivm-dragging' : ''}`}
              style={{ width: size, height: size, transform: T(pos), zIndex }}
            >
              {message && stageVisible && (
                <div
                  ref={bubbleRef}
                  className={bubblePlace ? `ivm-bubble ivm-bubble-placed ivm-tail-${bubblePlace.tail}` : `ivm-bubble ivm-bubble-${side}`}
                  style={bubblePlace ? { left: bubblePlace.left, top: bubblePlace.top, right: 'auto', bottom: 'auto', height: 'auto' } : undefined}
                  role="status"
                  aria-live="polite"
                >
                  {message}
                </div>
              )}
              <button
                type="button"
                className={`ivm-hit${draggable && phase === 'active' ? ' ivm-draggable' : ''}`}
                aria-label={phase === 'sleeping' ? `${label} (durmiendo)` : label}
                onClick={handleClick}
                onPointerEnter={markInteraction}
                onPointerDown={onHitPointerDown}
                onPointerMove={onHitPointerMove}
                onPointerUp={onHitPointerUp}
                onPointerCancel={onHitPointerUp}
              >
                <InvokeMascot
                  size={size}
                  mood={!canTalk && mood === 'talking' ? 'happy' : mood}
                  gesture={gesture}
                  pointAngle={pointAngle}
                  look={look}
                  title={label}
                />
              </button>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <MascotContext.Provider value={controller}>
      <MascotInternalContext.Provider value={internal}>
        {children}
        {stage}
      </MascotInternalContext.Provider>
    </MascotContext.Provider>
  );
}
