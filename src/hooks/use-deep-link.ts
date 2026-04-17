'use client';

/**
 * useDeepLink — URL-driven navigation hook
 *
 * Reads ?f=&t=&st=&act= query params on mount and executes a sequential
 * navigation: filter → auto-select first result → navigate tab → navigate
 * subtab → execute action.  Every step is protected by a timeout so the UI
 * has time to render.  The sequence runs only once per page mount and never
 * throws — if a step cannot be performed it is silently skipped.
 *
 * @example
 * useDeepLink({
 *   tabMap: { 'Historia-Clinica': 'clinical-history' },
 *   subtabMap: { 'Timeline': 'timeline' },
 *   onFilter: (v) => setColumnFilters([{ id: 'email', value: v }]),
 *   items: users,
 *   allItems: users,          // same as items for server-side pages
 *   isLoading: isRefreshing,
 *   onAutoSelect: (user) => handleRowSelectionChange([user]),
 *   setRowSelection: setRowSelection,
 *   onTabChange: (id) => setActiveTab(id),
 *   actionMap: { 'Crear': () => setCreateSessionTrigger(n => n + 1) },
 * });
 */

import { useSearchParams } from 'next/navigation';
import * as React from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DeepLinkOptions<T> {
  /**
   * Map from URL-slug to internal tab id.
   * e.g. { 'Historia-Clinica': 'clinical-history', 'Presupuestos': 'quotes' }
   * Falls back to using the raw param value if not found in the map,
   * so internal IDs also work directly (e.g. t=clinical-history).
   */
  tabMap?: Record<string, string>;

  /**
   * Map from URL-slug to internal subtab id.
   * e.g. { 'Timeline': 'timeline', 'Anamnesis': 'anamnesis' }
   */
  subtabMap?: Record<string, string>;

  /** Called once to apply the ?f= filter to the main table search */
  onFilter?: (value: string) => void;

  /**
   * Current list items — used to detect when filtered data has loaded and
   * to pick the first item for auto-select.
   * For server-side pages: pass the current page of results.
   * For in-memory filtered pages: pass the pre-filtered subset.
   */
  items?: T[];

  /**
   * Full unfiltered data array (only needed for in-memory pages where `items`
   * is a filtered subset).  Used to find the correct TanStack row index for
   * `setRowSelection`.  For server-side pages, omit this — `items` IS the
   * full current page and index 0 is always correct.
   */
  allItems?: T[];

  /** Whether data is currently loading (isRefreshing / isLoading) */
  isLoading?: boolean;

  /** Called to auto-select the first item after filtering */
  onAutoSelect?: (item: T) => void;

  /**
   * TanStack's setRowSelection dispatcher.  When provided, the hook syncs
   * the visual row selection state after auto-selecting, preventing the
   * DataTable from undoing the selection on the next render cycle.
   */
  setRowSelection?: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;

  /** Called to navigate the detail panel to a tab */
  onTabChange?: (tabId: string) => void;

  /** Called to navigate a subtab within the active tab */
  onSubtabChange?: (subtabId: string) => void;

  /**
   * Map from URL action name to handler function.
   * e.g. { 'Crear': () => openCreateDialog(), 'Cita': () => openApptDialog() }
   */
  actionMap?: Record<string, () => void>;

  /**
   * Milliseconds to wait after applying the filter before checking for
   * results.  Should exceed the page's debounce delay + typical API latency.
   * Default: 1 200 ms
   */
  filterDelay?: number;

  /**
   * Milliseconds to wait between each navigation step (tab, subtab, action).
   * Default: 400 ms
   */
  stepDelay?: number;
}

type Step =
  | 'ready'        // params present, sequence not yet started
  | 'filtering'    // filter applied, waiting filterDelay ms
  | 'await-data'   // filterDelay elapsed, waiting for isLoading→false
  | 'tabbing'      // navigating to tab
  | 'subtabbing'   // navigating to subtab
  | 'acting'       // executing action
  | 'done';        // sequence complete (or no params)

export interface DeepLinkResult {
  /** Current step in the navigation sequence */
  step: Step;
  /** The URL params read on mount */
  params: { f?: string; t?: string; st?: string; act?: string };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDeepLink<T>({
  tabMap = {},
  subtabMap = {},
  onFilter,
  items = [],
  allItems,
  isLoading = false,
  onAutoSelect,
  setRowSelection,
  onTabChange,
  onSubtabChange,
  actionMap = {},
  filterDelay = 1200,
  stepDelay = 400,
}: DeepLinkOptions<T>): DeepLinkResult {
  const searchParams = useSearchParams();

  // Read URL params once on mount — stored in a ref so they never change
  const paramsRef = React.useRef<{ f?: string; t?: string; st?: string; act?: string } | null>(null);
  if (paramsRef.current === null) {
    paramsRef.current = {
      f: searchParams.get('f') ?? undefined,
      t: searchParams.get('t') ?? undefined,
      st: searchParams.get('st') ?? undefined,
      act: searchParams.get('act') ?? undefined,
    };
  }
  const p = paramsRef.current;
  const hasDeepLink = !!(p.f || p.t || p.st || p.act);

  // ── Live refs for all callbacks (avoids stale closures in effects) ──────────
  const cbRef = React.useRef({
    onFilter, onAutoSelect, onTabChange, onSubtabChange,
    actionMap, tabMap, subtabMap, setRowSelection, allItems,
  });
  React.useLayoutEffect(() => {
    cbRef.current = { onFilter, onAutoSelect, onTabChange, onSubtabChange, actionMap, tabMap, subtabMap, setRowSelection, allItems };
  });

  // Live ref for items so setTimeout callbacks read the latest value
  const itemsRef = React.useRef(items);
  React.useLayoutEffect(() => { itemsRef.current = items; });

  const [step, setStep] = React.useState<Step>(hasDeepLink ? 'ready' : 'done');

  // ── Step 1: Start sequence ───────────────────────────────────────────────────
  React.useEffect(() => {
    if (step !== 'ready') return;
    if (!hasDeepLink) { setStep('done'); return; }

    if (p.f) {
      cbRef.current.onFilter?.(p.f);
      setStep('filtering');
    } else if (p.t) {
      setStep('tabbing');
    } else if (p.act) {
      setStep('acting');
    } else {
      setStep('done');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // ── Step 2a: Wait filterDelay for debounce + API ─────────────────────────────
  React.useEffect(() => {
    if (step !== 'filtering') return;
    const t = setTimeout(() => setStep('await-data'), filterDelay);
    return () => clearTimeout(t);
  }, [step, filterDelay]);

  // ── Step 2b: Wait for loading to finish, then auto-select ───────────────────
  React.useEffect(() => {
    if (step !== 'await-data') return;
    if (isLoading) return; // still loading — wait for next render

    const t = setTimeout(() => {
      const first = itemsRef.current[0];
      if (first !== undefined) {
        // 1. Notify the page so the detail panel opens
        cbRef.current.onAutoSelect?.(first);

        // 2. Sync TanStack's rowSelection so the row/card shows as selected.
        //    Find the item's index in the full data array (allItems) or the
        //    filtered items array. Object reference equality works because
        //    Array.filter() preserves references.
        const source = cbRef.current.allItems ?? itemsRef.current;
        const idx = source.indexOf(first);
        cbRef.current.setRowSelection?.({ [String(idx >= 0 ? idx : 0)]: true });
      }
      setStep(p.t ? 'tabbing' : p.act ? 'acting' : 'done');
    }, stepDelay);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, isLoading, stepDelay]);

  // ── Step 3: Navigate to tab ──────────────────────────────────────────────────
  React.useEffect(() => {
    if (step !== 'tabbing') return;
    if (!p.t) { setStep('done'); return; }

    const t = setTimeout(() => {
      // tabMap maps URL slug → internal id; falls back to raw value so
      // both 'Historia-Clinica' and 'clinical-history' work.
      const tabId = cbRef.current.tabMap[p.t!] ?? p.t!;
      cbRef.current.onTabChange?.(tabId);
      setStep(p.st ? 'subtabbing' : p.act ? 'acting' : 'done');
    }, stepDelay);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, stepDelay]);

  // ── Step 4: Navigate to subtab ───────────────────────────────────────────────
  React.useEffect(() => {
    if (step !== 'subtabbing') return;
    if (!p.st) { setStep('done'); return; }

    const t = setTimeout(() => {
      const subtabId = cbRef.current.subtabMap[p.st!] ?? p.st!;
      cbRef.current.onSubtabChange?.(subtabId);
      setStep(p.act ? 'acting' : 'done');
    }, stepDelay);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, stepDelay]);

  // ── Step 5: Execute action ────────────────────────────────────────────────────
  React.useEffect(() => {
    if (step !== 'acting') return;
    if (!p.act) { setStep('done'); return; }

    const t = setTimeout(() => {
      cbRef.current.actionMap[p.act!]?.();
      setStep('done');
    }, stepDelay);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, stepDelay]);

  return { step, params: p };
}
