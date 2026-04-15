import * as React from 'react';

/**
 * Returns true when the viewport width is below the given threshold (default: 768px).
 * Used to automatically switch DataTable from grid to card-list view on small screens.
 */
export function useViewportNarrow(threshold = 768): boolean {
  const [narrow, setNarrow] = React.useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < threshold;
  });

  React.useEffect(() => {
    const handler = () => setNarrow(window.innerWidth < threshold);
    window.addEventListener('resize', handler, { passive: true });
    return () => window.removeEventListener('resize', handler);
  }, [threshold]);

  return narrow;
}
