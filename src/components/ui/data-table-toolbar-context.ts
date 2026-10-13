'use client';

import * as React from 'react';

/**
 * Whether the DataTable toolbar is in compact mode: its own width (not the viewport's) is too
 * small for labelled controls, so buttons, filters and pagination render icon-only.
 *
 * Pages can read it from the nodes they pass as `extraButtons` to shrink their own controls.
 * Outside a toolbar it is always `false`.
 */
const DataTableToolbarCompactContext = React.createContext(false);

export const DataTableToolbarCompactProvider = DataTableToolbarCompactContext.Provider;

export function useDataTableToolbarCompact(): boolean {
  return React.useContext(DataTableToolbarCompactContext);
}

/** Below this toolbar width the controls switch to icon-only. */
export const TOOLBAR_COMPACT_MAX_WIDTH = 560;

/**
 * Tracks whether the element is narrower than `TOOLBAR_COMPACT_MAX_WIDTH`. Measured before paint
 * so the labelled layout never flashes on a narrow panel; an unmeasured (0px) element counts as wide.
 */
export function useCompactWidth(ref: React.RefObject<HTMLElement | null>): boolean {
  const [compact, setCompact] = React.useState(false);

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = (width: number) => setCompact(width > 0 && width < TOOLBAR_COMPACT_MAX_WIDTH);
    update(el.getBoundingClientRect().width);
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) update(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return compact;
}
