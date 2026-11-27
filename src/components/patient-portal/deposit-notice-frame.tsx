'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

interface DepositNoticeFrameProps {
  /** HTML ya renderizado (con las variables reemplazadas). */
  html: string;
  title: string;
  className?: string;
}

/**
 * Muestra el HTML del aviso de seña tal como lo configuró la clínica.
 *
 * Va en un `iframe` con `sandbox` **sin** `allow-scripts`: el HTML lo escribe el
 * staff, pero se muestra en el portal público, así que nada de lo que traiga
 * (scripts, handlers `on*`, formularios) puede ejecutarse. Además aísla sus
 * estilos: se ve igual que en el email y no rompe el tema del portal.
 *
 * `allow-same-origin` (sin scripts es seguro) sólo está para poder medir el alto
 * del contenido desde afuera y que el marco no tenga scroll propio. Los enlaces
 * se abren en otra pestaña por el `<base target="_blank">`.
 */
export const DepositNoticeFrame = React.forwardRef<HTMLIFrameElement, DepositNoticeFrameProps>(
  ({ html, title, className }, forwardedRef) => {
    const frameRef = React.useRef<HTMLIFrameElement | null>(null);
    const [height, setHeight] = React.useState(160);

    const setRefs = (node: HTMLIFrameElement | null) => {
      frameRef.current = node;
      if (typeof forwardedRef === 'function') forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    };

    const srcDoc = React.useMemo(
      () =>
        `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base target="_blank"><style>html,body{margin:0;padding:0;background:transparent;}img{max-width:100%;height:auto;}</style></head><body>${html}</body></html>`,
      [html],
    );

    // Sin scripts adentro no hay `postMessage`: se mide desde acá al cargar y se
    // vuelve a medir si cambia el ancho (texto que se reacomoda) o cargan imágenes.
    const observerRef = React.useRef<ResizeObserver | null>(null);
    const handleLoad = () => {
      const doc = frameRef.current?.contentDocument;
      if (!doc?.body) return;
      const measure = () => setHeight(Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight));
      measure();
      observerRef.current?.disconnect();
      observerRef.current = new ResizeObserver(measure);
      observerRef.current.observe(doc.body);
      doc.querySelectorAll('img').forEach((img) => img.addEventListener('load', measure));
    };

    React.useEffect(() => () => observerRef.current?.disconnect(), []);

    return (
      <iframe
        ref={setRefs}
        title={title}
        srcDoc={srcDoc}
        sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        onLoad={handleLoad}
        style={{ height }}
        className={cn('block w-full border-0 bg-transparent', className)}
      />
    );
  },
);
DepositNoticeFrame.displayName = 'DepositNoticeFrame';
