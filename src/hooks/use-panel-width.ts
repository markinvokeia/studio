import * as React from 'react';

/**
 * Returns the current pixel width of the element referenced by `ref`.
 * Uses ResizeObserver, throttled via requestAnimationFrame.
 */
export function usePanelWidth(ref: React.RefObject<HTMLElement | null>): number {
  const [width, setWidth] = React.useState(0);
  const rafRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const entry = entries[0];
        if (entry) setWidth(entry.contentRect.width);
      });
    });

    observer.observe(el);
    // Set initial width
    setWidth(el.getBoundingClientRect().width);

    return () => {
      observer.disconnect();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [ref]);

  return width;
}
