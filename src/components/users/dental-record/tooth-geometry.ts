import type { OdontogramSurface } from '@/lib/types';

import { isRightQuadrant, isTemporalTooth, isUpperTooth } from './odontogram-catalog';

// Tooth drawings shared by the odontogram and the periodontogram. Coordinates are for an upper
// tooth with its root pointing up and the cemento-enamel junction at y = 50 on a 60-unit-wide box;
// lower teeth are mirrored vertically.

export type ToothShape = 'inc' | 'can' | 'pre' | 'mol';

export interface ToothGeometry {
  crown: string;
  roots: string[];
  /** Root canals as [x1, y1, x2, y2] (from the crown towards the apex) */
  canals: [number, number, number, number][];
}

export const TOOTH_GEOMETRY: Record<ToothShape, ToothGeometry> = {
  inc: {
    crown: 'M18 50 L42 50 L44 74 Q30 88 16 74 Z',
    roots: ['M20 50 L40 50 L33 8 Q30 3 27 8 Z'],
    canals: [[30, 47, 30, 12]],
  },
  can: {
    crown: 'M16 50 L44 50 L45 70 L30 88 L15 70 Z',
    roots: ['M20 50 L40 50 L32 2 Q30 -1 28 2 Z'],
    canals: [[30, 47, 30, 6]],
  },
  pre: {
    crown: 'M14 50 L46 50 L47 74 Q39 86 30 79 Q21 86 13 74 Z',
    roots: ['M18 50 L42 50 L34 10 Q30 5 26 10 Z'],
    canals: [[30, 47, 30, 14]],
  },
  mol: {
    crown: 'M8 50 L52 50 L53 72 Q46 86 38 78 Q30 86 22 78 Q14 86 7 72 Z',
    roots: ['M10 50 L28 50 L22 12 Q18 7 15 12 Z', 'M32 50 L50 50 L45 12 Q42 7 38 12 Z'],
    canals: [[19, 47, 19, 16], [41, 47, 41, 16]],
  },
};

export function toothShape(tooth: number): ToothShape {
  const d = tooth % 10;
  if (isTemporalTooth(tooth)) return d <= 2 ? 'inc' : d === 3 ? 'can' : 'mol';
  return d <= 2 ? 'inc' : d === 3 ? 'can' : d <= 5 ? 'pre' : 'mol';
}

/** Where each stored surface is drawn in the 5-surface diagram */
export type ScreenPosition = 'top' | 'right' | 'bottom' | 'left' | 'center';

/**
 * Surface drawn at each screen position. Vestibular always faces the silhouette (outwards),
 * mesial faces the midline: on the viewer's left half (quadrants 1, 4, 5 and 8) it is on the right.
 */
export function surfaceAt(tooth: number, position: ScreenPosition): OdontogramSurface {
  const upper = isUpperTooth(tooth);
  switch (position) {
    case 'top': return upper ? 'top' : 'bottom';
    case 'bottom': return upper ? 'bottom' : 'top';
    case 'right': return isRightQuadrant(tooth) ? 'left' : 'right';
    case 'left': return isRightQuadrant(tooth) ? 'right' : 'left';
    default: return 'center';
  }
}

export const RING_POSITIONS: Exclude<ScreenPosition, 'center'>[] = ['top', 'right', 'bottom', 'left'];

/** Ring sector of the 5-surface diagram centered on (cx, cy) */
export function sectorPath(cx: number, cy: number, r1: number, r2: number, position: Exclude<ScreenPosition, 'center'>): string {
  const [a0, a1] = { top: [-135, -45], right: [-45, 45], bottom: [45, 135], left: [135, 225] }[position];
  const p = (r: number, a: number) => `${(cx + r * Math.cos((a * Math.PI) / 180)).toFixed(2)} ${(cy + r * Math.sin((a * Math.PI) / 180)).toFixed(2)}`;
  return `M${p(r2, a0)} A${r2} ${r2} 0 0 1 ${p(r2, a1)} L${p(r1, a1)} A${r1} ${r1} 0 0 0 ${p(r1, a0)} Z`;
}

/** Relative widths along the arch */
const ARCH_WEIGHT: Record<ToothShape, number> = { mol: 1.3, pre: 1, can: 1, inc: 0.9 };

export interface ArchPlacement {
  tooth: number;
  x: number;
  y: number;
  /** Outward normal of the arch at the tooth */
  nx: number;
  ny: number;
  /** Rotation (degrees) that turns the vestibular face outwards */
  angle: number;
  radius: number;
}

/** Places `teeth` (screen order) on a half ellipse; the upper arch opens downwards */
export function placeArch(teeth: number[], a: number, b: number, cx: number, cy: number, upper: boolean): ArchPlacement[] {
  const points: { x: number; y: number; t: number; length: number }[] = [];
  let length = 0;
  let prev: [number, number] | null = null;
  for (let i = 0; i <= 600; i++) {
    const t = Math.PI - (Math.PI * i) / 600;
    const x = cx + a * Math.cos(t);
    const y = upper ? cy - b * Math.sin(t) : cy + b * Math.sin(t);
    if (prev) length += Math.hypot(x - prev[0], y - prev[1]);
    points.push({ x, y, t, length });
    prev = [x, y];
  }
  const weights = teeth.map((n) => ARCH_WEIGHT[toothShape(n)]);
  const total = weights.reduce((sum, w) => sum + w, 0);
  const margin = length * 0.035;
  const unit = (length - 2 * margin) / total;
  let cumulative = 0;
  return teeth.map((tooth, i) => {
    const target = margin + unit * (cumulative + weights[i] / 2);
    cumulative += weights[i];
    const p = points.find((q) => q.length >= target) ?? points[points.length - 1];
    let nx = Math.cos(p.t) / a;
    let ny = ((upper ? -1 : 1) * Math.sin(p.t)) / b;
    const k = Math.hypot(nx, ny);
    nx /= k;
    ny /= k;
    const angle = ((upper ? Math.atan2(nx, -ny) : Math.atan2(-nx, ny)) * 180) / Math.PI;
    return { tooth, x: p.x, y: p.y, nx, ny, angle, radius: Math.min((unit * weights[i]) / 2 * 0.97, 28) };
  });
}
