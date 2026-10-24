'use client';
import * as React from 'react';
import { useMascot } from './MascotProvider';
import type { DockPosition, MascotTarget, TravelAnimation } from './types';

export interface RouteTravelOptions {
  /** Dónde ubicarse en cada ruta. Si una ruta no está, alterna entre los dos lados de `sides`. */
  positions?: Record<string, MascotTarget | DockPosition>;
  /** Lados entre los que alterna al cambiar de página. Por defecto ['bottom-right', 'bottom-left']. */
  sides?: [DockPosition, DockPosition];
  /**
   * Animación del viaje. `cycle` va rotando teletransporte → saltitos → salto.
   * Por defecto `teleport` (salta, se desvanece y reaparece del otro lado).
   */
  animation?: TravelAnimation | 'cycle';
  /** Frase opcional al llegar a cada ruta. */
  say?: Record<string, string> | ((route: string) => string | undefined);
  /** Si está escondida o dormida, ¿debe salir para viajar? Por defecto false (sigue en lo suyo). */
  wakeOnNavigate?: boolean;
}

const CYCLE: TravelAnimation[] = ['teleport', 'hop', 'jump'];

/**
 * Hace que la mascota se mueva de un lado al otro de la pantalla cada vez que cambia la página.
 *
 * React Router:  `useMascotRouteTravel(useLocation().pathname)`
 * Next.js (app): `useMascotRouteTravel(usePathname())`
 */
export function useMascotRouteTravel(routeKey: string, options: RouteTravelOptions = {}): void {
  const mascot = useMascot();
  const first = React.useRef(true);
  const sideIdx = React.useRef(0);
  const cycleIdx = React.useRef(0);
  const mascotRef = React.useRef(mascot);
  mascotRef.current = mascot;
  const optsRef = React.useRef(options);
  optsRef.current = options;

  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const m = mascotRef.current;
    const o = optsRef.current;
    if (!o.wakeOnNavigate && (m.phase === 'peeking' || m.phase === 'sleeping')) return;
    const sides = o.sides ?? ['bottom-right', 'bottom-left'];
    let target = o.positions?.[routeKey];
    if (!target) {
      sideIdx.current = (sideIdx.current + 1) % 2;
      target = sides[sideIdx.current];
    }
    let animation: TravelAnimation;
    if (o.animation === 'cycle') {
      animation = CYCLE[cycleIdx.current % CYCLE.length];
      cycleIdx.current++;
    } else {
      animation = o.animation ?? 'teleport';
    }
    void (async () => {
      // espera un frame para que la nueva página esté pintada (por si el destino es un elemento)
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      await m.travelTo(target!, { animation });
      const phrase = typeof o.say === 'function' ? o.say(routeKey) : o.say?.[routeKey];
      if (phrase) await m.say(phrase);
    })();
  }, [routeKey]);
}
