import * as React from 'react';

export type ItemsViewMode = 'table' | 'list';

const STORAGE_KEY = 'quote-items-view-mode';

/**
 * View-mode preference (table vs timeline-style list) for the quote items tab,
 * persisted in localStorage so it stays consistent across reopens and between
 * the draft/confirmed item tables.
 *
 * SSR-safe: returns `defaultMode` on first render and syncs from localStorage
 * after mount to avoid hydration mismatches.
 */
export function useItemsViewMode(defaultMode: ItemsViewMode = 'list') {
  const [mode, setMode] = React.useState<ItemsViewMode>(defaultMode);

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'table' || stored === 'list') setMode(stored);
    } catch {
      /* ignore */
    }
  }, []);

  const setViewMode = React.useCallback((next: ItemsViewMode) => {
    setMode(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  return [mode, setViewMode] as const;
}
