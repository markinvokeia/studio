'use client';

import React from 'react';

export type CompareMode = 'onMap' | 'sideBySide' | 'slider';

/** How the user likes to see the aesthetic record; kept in this browser, it never touches the session */
export interface AestheticViewPrefs {
  /** Photo behind the map; unset until the user flips it, so the first photos taken can turn it on */
  backdropEnabled?: boolean;
  backdropOpacity: number;
  backdropHideArt: boolean;
  /** Side panels folded to a strip of icons */
  dockCollapsed: boolean;
  compareMode: CompareMode;
}

const STORAGE_KEY = 'aesthetic-record-view-prefs';

export const DEFAULT_VIEW_PREFS: AestheticViewPrefs = {
  backdropOpacity: 0.85,
  backdropHideArt: false,
  dockCollapsed: false,
  compareMode: 'onMap',
};

const COMPARE_MODES: CompareMode[] = ['onMap', 'sideBySide', 'slider'];

/** Keeps only the stored values that are still valid, so an old or edited entry falls back to the defaults */
function readStored(): AestheticViewPrefs {
  if (typeof window === 'undefined') return DEFAULT_VIEW_PREFS;
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (!raw || typeof raw !== 'object') return DEFAULT_VIEW_PREFS;
    const stored = raw as Record<string, unknown>;
    return {
      backdropEnabled: typeof stored.backdropEnabled === 'boolean' ? stored.backdropEnabled : undefined,
      backdropOpacity: typeof stored.backdropOpacity === 'number' && stored.backdropOpacity >= 0 && stored.backdropOpacity <= 1
        ? stored.backdropOpacity
        : DEFAULT_VIEW_PREFS.backdropOpacity,
      backdropHideArt: typeof stored.backdropHideArt === 'boolean' ? stored.backdropHideArt : DEFAULT_VIEW_PREFS.backdropHideArt,
      dockCollapsed: typeof stored.dockCollapsed === 'boolean' ? stored.dockCollapsed : DEFAULT_VIEW_PREFS.dockCollapsed,
      compareMode: COMPARE_MODES.includes(stored.compareMode as CompareMode) ? stored.compareMode as CompareMode : DEFAULT_VIEW_PREFS.compareMode,
    };
  } catch {
    return DEFAULT_VIEW_PREFS;
  }
}

/** The view preferences of the aesthetic record and a setter that stores each change */
export function useAestheticViewPrefs(): [AestheticViewPrefs, <K extends keyof AestheticViewPrefs>(key: K, value: AestheticViewPrefs[K]) => void] {
  // The sheet only renders in the browser, so the stored values can be read on the first render
  const [prefs, setPrefs] = React.useState<AestheticViewPrefs>(readStored);

  const setPref = React.useCallback(<K extends keyof AestheticViewPrefs>(key: K, value: AestheticViewPrefs[K]) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: value };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* storage full or blocked: the preference lasts until the sheet closes */
      }
      return next;
    });
  }, []);

  return [prefs, setPref];
}
