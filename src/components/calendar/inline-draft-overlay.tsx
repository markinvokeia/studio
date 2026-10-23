'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';

/**
 * Renders the inline appointment-creation card centered on the screen (via a
 * portal to `document.body`) with a light backdrop. Centering avoids the card
 * being clipped when a slot near the bottom of the viewport is clicked. The
 * backdrop absorbs clicks so the calendar behind can't be interacted with while
 * the draft is open (closing is handled by the card's actions / Esc).
 */
export function CalendarInlineDraftOverlay({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div
      data-testid="calendar-inline-draft-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/55 p-4 backdrop-blur-[1px] dark:bg-background/70"
    >
      <div
        className="w-[340px] max-w-[calc(100vw-2rem)] sm:w-[520px]"
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** Separación entre la card y la cita previsualizada, y margen contra los bordes. */
const ANCHOR_GAP = 12;
const VIEWPORT_MARGIN = 12;

/**
 * La misma card, flotando al lado de la cita previsualizada en la rejilla (estilo
 * Google Calendar) en vez de centrada con backdrop. Sin backdrop: la grilla sigue
 * visible e interactiva, así que se ve cómo encaja la cita y un clic en otro slot la
 * mueve.
 *
 * Se ancla a `[data-draft-preview]` dentro de `anchorRoot`: va del lado `side`
 * (izquierda por defecto) y, si no entra, del opuesto; si no entra de ningún lado,
 * del lado con más espacio, acotada a la pantalla. Con `side="right"` (vista de un
 * día, donde la cita ocupa casi todo el ancho) cae pegada al borde derecho, para que
 * no tape el texto de la cita, que arranca a la izquierda. Verticalmente se centra en la cita, también acotada. Un
 * rAF la mantiene pegada mientras la grilla hace scroll (el centrado es animado) o
 * la cita cambia de día/hora/duración; escribe el `transform` directo en el nodo,
 * sin re-render. Mientras la cita no está a la vista (cargando otro rango, agenda
 * oculta) se queda centrada en la pantalla.
 */
export function CalendarAnchoredInlineDraft({
  children,
  anchorRoot,
  side = 'left',
}: {
  children: React.ReactNode;
  anchorRoot: React.RefObject<HTMLElement | null>;
  side?: 'left' | 'right';
}) {
  const [mounted, setMounted] = React.useState(false);
  const cardRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!mounted) return;
    let raf = 0;
    let lastTransform = '';
    const frame = () => {
      const card = cardRef.current;
      if (card) {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const cw = card.offsetWidth;
        const ch = card.offsetHeight;
        const anchor = anchorRoot.current?.querySelector<HTMLElement>('[data-draft-preview]');
        const ar = anchor?.getBoundingClientRect();
        let left: number;
        let top: number;
        if (ar && ar.bottom > 0 && ar.top < vh && ar.right > 0 && ar.left < vw) {
          const spaceLeft = ar.left - ANCHOR_GAP - VIEWPORT_MARGIN;
          const spaceRight = vw - ar.right - ANCHOR_GAP - VIEWPORT_MARGIN;
          const leftPos = ar.left - ANCHOR_GAP - cw;
          const rightPos = ar.right + ANCHOR_GAP;
          if (side === 'right') {
            if (spaceRight >= cw) left = rightPos;
            else if (spaceLeft >= cw) left = leftPos;
            else left = vw - VIEWPORT_MARGIN - cw;
          } else if (spaceLeft >= cw) left = leftPos;
          else if (spaceRight >= cw) left = rightPos;
          else left = spaceLeft >= spaceRight ? VIEWPORT_MARGIN : vw - VIEWPORT_MARGIN - cw;
          top = ar.top + ar.height / 2 - ch / 2;
        } else {
          left = (vw - cw) / 2;
          top = (vh - ch) / 2;
        }
        left = Math.max(VIEWPORT_MARGIN, Math.min(left, vw - VIEWPORT_MARGIN - cw));
        top = Math.max(VIEWPORT_MARGIN, Math.min(top, vh - VIEWPORT_MARGIN - ch));
        const transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
        if (transform !== lastTransform) {
          card.style.transform = transform;
          card.style.visibility = 'visible';
          lastTransform = transform;
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [mounted, anchorRoot, side]);

  if (!mounted) return null;

  return createPortal(
    <div
      ref={cardRef}
      data-testid="calendar-inline-draft-anchored"
      className="fixed left-0 top-0 z-50 max-h-[calc(100vh-1.5rem)] w-[340px] max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-lg shadow-2xl sm:w-[520px]"
      // Oculta hasta el primer posicionamiento, para que no aparezca un frame en la esquina.
      style={{ visibility: 'hidden' }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  );
}
