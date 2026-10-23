'use client';

import * as React from 'react';

import { InvokeMascot, type InvokeMascotState } from '@/components/help/invoke-mascot';

const SIZE = 92;
/** Cuánto queda escondido detrás del riel (o del borde de la pantalla). */
const TUCK = 30;
/** Mismo ciclo que @keyframes help-peek (11 s): saluda mientras está afuera. */
const PEEK_CYCLE_MS = 11_000;
const PEEK_OUT_FROM = 0.16;
const PEEK_OUT_TO = 0.58;

interface MascotLauncherProps {
  label: string;
  pending: number | null;
  /** Estado que manda sobre el saludo (pensando, apenada…). */
  state?: InvokeMascotState;
  onOpen: () => void;
}

/**
 * Lanzador en reposo: la mascota se asoma de detrás del riel derecho del header
 * (o del borde si el riel está colapsado), mira hacia la pantalla, saluda y
 * vuelve a esconderse. Queda por debajo del riel en z-index para "salir de atrás".
 */
export function MascotLauncher({ label, pending, state, onOpen }: MascotLauncherProps) {
  const [right, setRight] = React.useState(-TUCK);
  const [waving, setWaving] = React.useState(false);
  const [center, setCenter] = React.useState<{ x: number; y: number } | null>(null);

  // El riel puede colapsarse o no existir (mobile): se mide cada tanto.
  React.useEffect(() => {
    const measure = () => {
      const rail = document.querySelector('[data-help-rail]');
      const r = rail?.getBoundingClientRect();
      setRight(r && r.width > 0 ? r.width - TUCK : -TUCK);
      setCenter({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    };
    measure();
    const interval = setInterval(measure, 1000);
    window.addEventListener('resize', measure);
    return () => { clearInterval(interval); window.removeEventListener('resize', measure); };
  }, []);

  React.useEffect(() => {
    const start = Date.now();
    const tick = () => {
      const phase = ((Date.now() - start) % PEEK_CYCLE_MS) / PEEK_CYCLE_MS;
      setWaving(phase >= PEEK_OUT_FROM && phase <= PEEK_OUT_TO);
    };
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, []);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={label}
      title={label}
      className="help-peek fixed bottom-10 z-[45] rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring sm:bottom-6"
      style={{ right, width: SIZE, height: SIZE }}
    >
      <InvokeMascot
        state={state ?? (waving ? 'waving' : 'idle')}
        // Se asoma desde la derecha: saluda con la mano que queda a la vista.
        waveWith="left"
        lookAt={waving ? center : null}
        className="h-full w-full drop-shadow-lg"
        aria-hidden="true"
      />
      {pending !== null && pending > 0 && (
        <span className="absolute bottom-2 left-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#EC008C] px-1 text-[10px] font-bold text-white shadow">
          {pending}
        </span>
      )}
    </button>
  );
}
