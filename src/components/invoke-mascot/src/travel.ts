import type { Point } from './types';

/**
 * Generadores de keyframes (Web Animations API) para los viajes.
 * Todas las posiciones son la esquina superior izquierda de la caja de la mascota.
 * El elemento animado usa `transform-origin: 50% 100%` (los pies), así el
 * aplastar/estirar se apoya en el piso.
 */

export function T(p: Point, dy = 0, sx = 1, sy = 1, rot = 0): string {
  return `translate3d(${p.x.toFixed(1)}px, ${(p.y + dy).toFixed(1)}px, 0) rotate(${rot.toFixed(1)}deg) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
}

const lerp = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/** Saltitos: n saltos cortos aplastándose al tocar el piso. */
export function hopFrames(from: Point, to: Point, hops: number, height: number): Keyframe[] {
  const lean = Math.sign(to.x - from.x) * 7;
  const frames: Keyframe[] = [];
  for (let k = 0; k < hops; k++) {
    const a = lerp(from, to, k / hops);
    const b = lerp(from, to, (k + 1) / hops);
    const o = k / hops;
    const seg = 1 / hops;
    frames.push({ offset: o, transform: T(a, 0, 1.12, 0.88, 0), easing: 'ease-out' });
    frames.push({ offset: o + seg * 0.22, transform: T(lerp(a, b, 0.15), -height * 0.55, 0.93, 1.08, lean), easing: 'ease-out' });
    frames.push({ offset: o + seg * 0.5, transform: T(lerp(a, b, 0.5), -height, 1, 1, lean), easing: 'ease-in' });
    frames.push({ offset: o + seg * 0.82, transform: T(lerp(a, b, 0.88), -height * 0.4, 0.96, 1.05, lean * 0.5), easing: 'ease-in' });
  }
  frames.push({ offset: 1 - 0.09 / hops, transform: T(to, 0, 1.14, 0.86, 0) });
  frames.push({ offset: 1, transform: T(to) });
  return frames;
}

/** Salto grande en arco con preparación (agacharse) y aterrizaje. */
export function jumpFrames(from: Point, to: Point): Keyframe[] {
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const H = Math.min(260, 90 + dist * 0.25);
  const lean = Math.sign(to.x - from.x) * 10;
  const frames: Keyframe[] = [
    { offset: 0, transform: T(from) },
    { offset: 0.14, transform: T(from, 0, 1.18, 0.82), easing: 'ease-out' },
    { offset: 0.22, transform: T(from, -10, 0.88, 1.14, lean) },
  ];
  const steps = 10;
  for (let i = 1; i < steps; i++) {
    const u = i / steps;
    const p = lerp(from, to, u);
    const y = -H * 4 * u * (1 - u) - 10 * (1 - u);
    const st = 0.1 * Math.abs(Math.cos(u * Math.PI));
    frames.push({ offset: 0.22 + 0.62 * u, transform: T(p, y, 1 - st * 0.6, 1 + st, lean * (1 - u * 1.4)) });
  }
  frames.push({ offset: 0.86, transform: T(to, 0, 1.22, 0.78) });
  frames.push({ offset: 0.94, transform: T(to, -7, 0.95, 1.05) });
  frames.push({ offset: 1, transform: T(to) });
  return frames;
}

/** Teletransporte, parte 1: salta, se estira y se desvanece. */
export function vanishFrames(from: Point): Keyframe[] {
  return [
    { offset: 0, transform: T(from), opacity: 1 },
    { offset: 0.22, transform: T(from, 0, 1.18, 0.82), opacity: 1, easing: 'ease-out' },
    { offset: 0.55, transform: T(from, -34, 0.72, 1.32), opacity: 0.95, easing: 'ease-in' },
    { offset: 1, transform: T(from, -70, 0.08, 1.9), opacity: 0 },
  ];
}

/** Teletransporte, parte 2: cae desde arriba en el destino y rebota. */
export function appearFrames(to: Point): Keyframe[] {
  return [
    { offset: 0, transform: T(to, -80, 0.15, 1.7), opacity: 0, easing: 'ease-in' },
    { offset: 0.42, transform: T(to, -8, 0.9, 1.12), opacity: 1 },
    { offset: 0.6, transform: T(to, 0, 1.22, 0.8), opacity: 1, easing: 'ease-out' },
    { offset: 0.8, transform: T(to, -9, 0.95, 1.06), opacity: 1, easing: 'ease-in' },
    { offset: 1, transform: T(to), opacity: 1 },
  ];
}

export function fadeOutFrames(p: Point): Keyframe[] {
  return [
    { transform: T(p), opacity: 1 },
    { transform: T(p), opacity: 0 },
  ];
}
export function fadeInFrames(p: Point): Keyframe[] {
  return [
    { transform: T(p), opacity: 0 },
    { transform: T(p), opacity: 1 },
  ];
}
