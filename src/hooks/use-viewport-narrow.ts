import * as React from 'react';

/**
 * Returns true when the viewport width is below the given threshold (default: 768px).
 * Used to automatically switch DataTable from grid to card-list view on small screens.
 *
 * Always returns `false` on the first render (server + initial client render) so that
 * SSR HTML matches client hydration. The real value is set after mount via useEffect.
 */
export function useViewportNarrow(threshold = 768): boolean {
  const [narrow, setNarrow] = React.useState<boolean>(false);

  React.useEffect(() => {
    const handler = () => setNarrow(window.innerWidth < threshold);
    handler();
    window.addEventListener('resize', handler, { passive: true });
    return () => window.removeEventListener('resize', handler);
  }, [threshold]);

  return narrow;
}
