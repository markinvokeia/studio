'use client';
import * as React from 'react';
import { InvokeMascot } from './InvokeMascot';
import { MascotInternalContext } from './MascotProvider';
import { useLookVector } from './useLookVector';
import type { MascotGesture, MascotMood, Point } from './types';

export interface MascotPeekZoneProps {
  children: React.ReactNode;
  /**
   * Por qué borde de la barra se asoma:
   * - `top` (por defecto): la barra está abajo o en el medio; la mascota asoma la cabeza por ARRIBA de la barra.
   * - `bottom`: la barra está arriba (header); la mascota asoma cabeza abajo por DEBAJO de la barra.
   * - `left`: barra vertical sobre el borde derecho (riel de widgets); asoma de costado por la IZQUIERDA.
   * - `right`: barra vertical sobre el borde izquierdo; asoma de costado por la DERECHA.
   * - `auto`: `bottom` si el lugar elegido está abajo, si no `top` (el panel del contenido).
   */
  edge?: Edge | 'auto';
  /** Nombre de la zona: el provider elige dónde esconderse por nombre (`hideZones`). */
  name?: string;
  /** Margen dentro de la barra (a lo largo) donde puede aparecer (px). Por defecto 16. */
  inset?: number;
  className?: string;
  style?: React.CSSProperties;
}

type Level = 'hidden' | 'peek' | 'up' | 'leave';
type Edge = 'top' | 'bottom' | 'left' | 'right';

const isVertical = (edge: Edge) => edge === 'left' || edge === 'right';

/** Rotación de la mascota según el borde: siempre con la cabeza hacia afuera de la barra. */
const ROTATION: Record<Edge, number> = { top: 0, bottom: 180, left: -90, right: 90 };

/** Pasa un vector de mirada de la pantalla al marco de la mascota rotada. */
function toLocal(edge: Edge, v: Point): Point {
  switch (edge) {
    case 'bottom': return { x: -v.x, y: -v.y };
    case 'left': return { x: -v.y, y: v.x };
    case 'right': return { x: v.y, y: -v.x };
    default: return v;
  }
}

/** Mirar "afuera" de la barra y a lo largo de ella, en coordenadas de pantalla. */
function outward(edge: Edge, k: number): Point {
  switch (edge) {
    case 'bottom': return { x: 0, y: k };
    case 'left': return { x: -k, y: 0 };
    case 'right': return { x: k, y: 0 };
    default: return { x: 0, y: -k };
  }
}
const along = (edge: Edge, sign: 1 | -1): Point => (isVertical(edge) ? { x: 0, y: sign } : { x: sign, y: 0 });

/**
 * Envolvé con este componente la barra de widgets de la app. Cuando la mascota está en
 * reposo, se esconde DETRÁS de esa barra y se asoma de a ratos (mira a un lado y al otro,
 * a veces saluda) en distintos lugares de la barra.
 *
 * Requisitos: la barra debe tener fondo opaco, y sus contenedores padres no deben recortar
 * (`overflow: hidden`) el espacio por donde asoma la mascota.
 */
export function MascotPeekZone({ children, edge: edgeProp = 'top', name, inset = 16, className, style }: MascotPeekZoneProps) {
  const internal = React.useContext(MascotInternalContext);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [zoneId, setZoneId] = React.useState<number | null>(null);
  const [box, setBox] = React.useState({ w: 0, h: 0 });
  const edge: Edge = edgeProp === 'auto' ? (internal?.home?.side === 'bottom' ? 'bottom' : 'top') : edgeProp;

  React.useEffect(() => {
    if (!internal) return;
    // Sólo sirve de escondite si se ve (con `display: none` en mobile, no).
    const usable = () => !!rootRef.current && rootRef.current.offsetWidth > 0 && rootRef.current.offsetHeight > 0;
    const { id, unregister } = internal.registerZone(name, usable);
    setZoneId(id);
    return unregister;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!internal, name]);

  React.useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => setBox({ w: el.offsetWidth, h: el.offsetHeight });
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const isActiveZone = !!internal && internal.activeZone !== null && internal.activeZone === zoneId;
  const showActor = !!internal && internal.phase === 'peeking' && isActiveZone && box.h > 0 && box.w > 0;
  const vertical = isVertical(edge);
  const extra = internal?.size ?? 0;
  // Con un lugar elegido, se asoma justo donde la soltaron (si no, en lugares al azar).
  let fixedAt: number | undefined;
  if (showActor && internal?.home && internal.peekAt && rootRef.current) {
    const r = rootRef.current.getBoundingClientRect();
    const along = vertical ? internal.peekAt.y - r.top : internal.peekAt.x - r.left;
    const length = vertical ? box.h : box.w;
    fixedAt = Math.round(Math.min(Math.max(inset, along - extra / 2), Math.max(inset, length - extra - inset)));
  }
  const layerStyle: React.CSSProperties =
    edge === 'top' ? { bottom: 0, height: box.h + extra }
    : edge === 'bottom' ? { top: 0, height: box.h + extra }
    : edge === 'left' ? { top: 0, bottom: 0, right: 0, left: 'auto', width: box.w + extra }
    : { top: 0, bottom: 0, left: 0, right: 'auto', width: box.w + extra };

  return (
    <div ref={rootRef} className={`ivm-peekzone${className ? ' ' + className : ''}`} style={style}>
      {showActor && internal && (
        <div className="ivm-peek-layer" style={layerStyle} aria-hidden={false}>
          <PeekingMascot
            size={internal.size}
            barH={vertical ? box.w : box.h}
            width={vertical ? box.h : box.w}
            inset={inset}
            edge={edge}
            fixedAt={fixedAt}
            exiting={internal.peekExiting}
            onExited={internal.onPeekExited}
            onClick={internal.onPeekClick}
          />
        </div>
      )}
      <div className="ivm-peekzone-content">{children}</div>
    </div>
  );
}

interface PeekingProps {
  size: number;
  barH: number;
  width: number;
  inset: number;
  edge: Edge;
  /** Posición fija a lo largo de la barra (px); sin ella, cambia al azar cada vez. */
  fixedAt?: number;
  exiting: boolean;
  onExited(): void;
  onClick(): void;
}

function PeekingMascot({ size, barH, width, inset, edge, fixedAt, exiting, onExited, onClick }: PeekingProps) {
  const [level, setLevel] = React.useState<Level>('hidden');
  const [x, setX] = React.useState(() => fixedAt ?? Math.max(inset, width - size - inset));
  const [mood, setMood] = React.useState<MascotMood>('neutral');
  const [gesture, setGesture] = React.useState<MascotGesture>('none');
  const [scripted, setScripted] = React.useState<Point | 'cursor'>({ x: 0, y: -0.4 });
  const [fast, setFast] = React.useState(false);
  const innerRef = React.useRef<HTMLDivElement>(null);
  const cursorLook = useLookVector(innerRef, 'cursor', scripted === 'cursor');

  // Bucle de "escondidas": se asoma, mira, a veces saluda, se vuelve a esconder y aparece en otro lado.
  React.useEffect(() => {
    if (exiting) return;
    let alive = true;
    const w8 = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
    (async () => {
      await w8(350);
      while (alive) {
        setFast(false);
        const maxX = Math.max(inset, width - size - inset);
        setX(fixedAt ?? Math.round(inset + Math.random() * (maxX - inset)));
        await w8(90);
        if (!alive) return;
        setMood('neutral');
        setScripted(outward(edge, 0.4));
        setLevel('peek');
        await w8(950);
        if (!alive) return;
        setScripted(along(edge, -1));
        await w8(850);
        if (!alive) return;
        setScripted(along(edge, 1));
        await w8(850);
        if (!alive) return;
        const r = Math.random();
        if (r < 0.35) {
          setLevel('up');
          setMood('happy');
          setGesture('wave');
          await w8(1700);
          if (!alive) return;
          setGesture('none');
          setMood('neutral');
          setLevel('peek');
          await w8(600);
        } else if (r < 0.6) {
          setScripted('cursor');
          setMood('surprised');
          await w8(700);
          if (!alive) return;
          setMood('neutral');
          await w8(1300);
        } else {
          setScripted('cursor');
          await w8(1900);
        }
        if (!alive) return;
        setFast(true);
        setLevel('hidden');
        await w8(2600 + Math.random() * 5400);
      }
    })();
    return () => {
      alive = false;
    };
  }, [exiting, width, size, inset, edge, fixedAt]);

  // Salida: sube del todo, se pone contenta y "salta" fuera de la barra.
  React.useEffect(() => {
    if (!exiting) return;
    setFast(false);
    setGesture('none');
    setMood('happy');
    setLevel('up');
    const t1 = setTimeout(() => {
      setFast(true);
      setLevel('leave');
    }, 420);
    const t2 = setTimeout(onExited, 420 + 340);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [exiting, onExited]);

  // Desplazamiento hacia afuera de la barra (en el eje del borde). `top`/`left` se
  // asoman en sentido negativo; `bottom`/`right`, positivo.
  const ty = (lv: Level): number => {
    if (edge === 'top' || edge === 'left') {
      if (lv === 'hidden') return size;
      if (lv === 'peek') return 0.48 * size - barH;
      if (lv === 'up') return 0.17 * size - barH;
      return -barH - 0.4 * size;
    }
    if (lv === 'hidden') return -size;
    if (lv === 'peek') return barH - 0.48 * size;
    if (lv === 'up') return barH - 0.17 * size;
    return barH + 0.4 * size;
  };

  // La mascota está rotada (cabeza hacia afuera): la mirada se pasa a su marco.
  const look: Point = toLocal(edge, scripted === 'cursor' ? cursorLook : scripted);
  const axis = isVertical(edge) ? 'translateX' : 'translateY';
  const actorStyle: React.CSSProperties =
    edge === 'top' ? { bottom: 0, left: x, width: size, height: size }
    : edge === 'bottom' ? { top: 0, left: x, width: size, height: size }
    : edge === 'left' ? { right: 0, top: x, width: size, height: size }
    : { left: 0, top: x, width: size, height: size };

  return (
    <div className="ivm-peek-actor" style={actorStyle}>
      <div
        ref={innerRef}
        className={`ivm-peek-actor-inner${fast ? ' ivm-fast' : ''}`}
        style={{
          transform: `${axis}(${ty(level)}px)${ROTATION[edge] ? ` rotate(${ROTATION[edge]}deg)` : ''}`,
          opacity: level === 'leave' ? 0 : 1,
          transitionProperty: 'transform, opacity',
        }}
      >
        <button type="button" className="ivm-hit" aria-label="Asistente de Invoke (escondido)" onClick={onClick}>
          <InvokeMascot size={size} mood={mood} gesture={gesture} look={look} animated={false} />
        </button>
      </div>
    </div>
  );
}
