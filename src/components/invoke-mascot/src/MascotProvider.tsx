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
}

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
  registerZone(): { id: number; unregister: () => void };
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

const DOCKS: DockPosition[] = ['bottom-right', 'bottom-left', 'top-right', 'top-left', 'center-right', 'center-left'];
const isDock = (t: unknown): t is DockPosition => typeof t === 'string' && (DOCKS as string[]).includes(t);
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

  // ---------- refs (fuente de verdad para los flujos async) ----------
  const actorRef = React.useRef<HTMLDivElement>(null);
  const phaseRef = React.useRef<MascotPhase>('active');
  const enabledRef = React.useRef<boolean>(enabledProp);
  const messageRef = React.useRef<string | null>(null);
  const posRef = React.useRef<Point>({ x: -9999, y: -9999 });
  const dockRef = React.useRef<DockPosition | null>(dock);
  const lastRequestRef = React.useRef<number>(Date.now());
  const lastInteractionRef = React.useRef<number>(Date.now());
  const busyRef = React.useRef(0);
  const queueRef = React.useRef<Promise<unknown>>(Promise.resolve());
  const zonesRef = React.useRef<number[]>([]);
  const zoneSeq = React.useRef(0);
  const peekExitResolve = React.useRef<(() => void) | null>(null);
  const burstSeq = React.useRef(0);
  const aliveRef = React.useRef(true);
  const lastPersist = React.useRef(0);

  const props = { size, dock, margin, insets, defaultTravel, storageKey, idleAfterMs, sleepAfterMs };
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
  const dockPoint = (d: DockPosition): Point => {
    const { size: s, margin: m, insets: ins } = propsRef.current;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const L = m + (ins?.left ?? 0);
    const R = vw - s - m - (ins?.right ?? 0);
    const Tt = m + (ins?.top ?? 0);
    const B = vh - s - m - (ins?.bottom ?? 0);
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
  const resolvePoint = (t: MascotTarget | DockPosition): Point | null => {
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
  const resolveTL = (t: MascotTarget | DockPosition): { tl: Point; dock: DockPosition | null } | null => {
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
  const doTravel = async (target: MascotTarget | DockPosition, opts: TravelOptions = {}) => {
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

  const doHide = async () => {
    if (!zonesRef.current.length) return;
    if (phaseRef.current !== 'active') return;
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
    if (zonesRef.current.length) {
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
          // Señalamiento sin fin (guías): habla lo que tarda en leerse y después sigue
          // señalando contenta, con el globo todavía visible.
          const talkTimer =
            o.say && o.duration !== undefined && !Number.isFinite(o.duration)
              ? setTimeout(() => { if (aliveRef.current && messageRef.current === o.say) setMoodS('happy'); }, readDuration(o.say))
              : undefined;
          await holdFor(o.duration ?? (o.say ? readDuration(o.say) : 3500), o.signal);
          if (talkTimer) clearTimeout(talkTimer);
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
      if (busyRef.current > 0) return;
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
        zonesRef.current.length > 0 &&
        now - lastInteractionRef.current > ia
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
      registerZone: () => {
        const id = ++zoneSeq.current;
        zonesRef.current = [...zonesRef.current, id];
        setActiveZone(id);
        const unregister = () => {
          zonesRef.current = zonesRef.current.filter((z) => z !== id);
          const next = zonesRef.current[zonesRef.current.length - 1] ?? null;
          setActiveZone(next);
          if (next === null && phaseRef.current === 'peeking') {
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
    [size, phase, activeZone, peekExiting, onMascotClick],
  );

  // ---------- render ----------
  const look = useLookVector(actorRef, lookMode, mounted && phase !== 'sleeping' && stageVisible);

  const handleClick = () => {
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
          <div className="ivm-stage" style={{ zIndex }} data-ivm-phase={phase}>
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
              className={`ivm-actor${stageVisible ? '' : ' ivm-hidden'}`}
              style={{ width: size, height: size, transform: T(pos), zIndex }}
            >
              {message && stageVisible && (
                <div className={`ivm-bubble ivm-bubble-${side}`} role="status" aria-live="polite">
                  {message}
                </div>
              )}
              <button
                type="button"
                className="ivm-hit"
                aria-label={phase === 'sleeping' ? `${label} (durmiendo)` : label}
                onClick={handleClick}
                onPointerEnter={markInteraction}
              >
                <InvokeMascot
                  size={size}
                  mood={mood}
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
