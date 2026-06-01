import * as React from 'react';

export type TableViewMode = 'table' | 'list';

/**
 * View-mode preference (table vs DataListRow list) for a DataTable, persisted in
 * localStorage under `storageKey` so it stays consistent across reopens. Each
 * list passes its own key so preferences are independent.
 *
 * SSR-safe: returns `defaultMode` on first render and syncs from localStorage
 * after mount to avoid hydration mismatches.
 */
export function useTableViewMode(storageKey: string, defaultMode: TableViewMode = 'table') {
  const [mode, setMode] = React.useState<TableViewMode>(defaultMode);

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(`table-view-mode:${storageKey}`);
      if (stored === 'table' || stored === 'list') setMode(stored);
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  const setViewMode = React.useCallback((next: TableViewMode) => {
    setMode(next);
    try {
      localStorage.setItem(`table-view-mode:${storageKey}`, next);
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  return [mode, setViewMode] as const;
}
