'use client';
import * as React from 'react';
import type { Point } from './types';

/**
 * Devuelve hacia dónde deben mirar los ojos (vector -1..1) para que la mascota
 * mire el cursor o un punto fijo del viewport.
 * - `target = 'cursor'`: sigue el puntero; si el puntero se queda quieto 5 s, vuelve a mirar al frente.
 * - `target = {x, y}`: mira ese punto (coordenadas de viewport).
 * - `target = null`: mira al frente.
 */
export function useLookVector(
  ref: React.RefObject<HTMLElement | SVGElement | null>,
  target: 'cursor' | Point | null,
  enabled = true,
): Point {
  const [v, setV] = React.useState<Point>({ x: 0, y: 0 });
  const tx = target && target !== 'cursor' ? target.x : null;
  const ty = target && target !== 'cursor' ? target.y : null;
  const mode = target === 'cursor' ? 'cursor' : target ? 'point' : 'none';

  React.useEffect(() => {
    if (!enabled || mode === 'none') {
      setV({ x: 0, y: 0 });
      return;
    }
    const compute = (px: number, py: number) => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height * 0.45;
      const dx = px - cx;
      const dy = py - cy;
      const d = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, d / Math.max(40, r.width * 0.9));
      setV({ x: (dx / d) * k, y: (dy / d) * k });
    };

    if (mode === 'point' && tx !== null && ty !== null) {
      compute(tx, ty);
      const t = setTimeout(() => compute(tx, ty), 80);
      const onResize = () => compute(tx, ty);
      window.addEventListener('resize', onResize);
      return () => {
        clearTimeout(t);
        window.removeEventListener('resize', onResize);
      };
    }

    let raf = 0;
    let lx = 0;
    let ly = 0;
    let idle: ReturnType<typeof setTimeout> | undefined;
    const onMove = (e: PointerEvent) => {
      lx = e.clientX;
      ly = e.clientY;
      if (!raf) {
        raf = requestAnimationFrame(() => {
          raf = 0;
          compute(lx, ly);
        });
      }
      if (idle) clearTimeout(idle);
      idle = setTimeout(() => setV({ x: 0, y: 0 }), 5000);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (raf) cancelAnimationFrame(raf);
      if (idle) clearTimeout(idle);
    };
  }, [enabled, mode, tx, ty, ref]);

  return v;
}
