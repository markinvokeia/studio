'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { getErrorMessage } from '@/lib/error-utils';
import { isAbortError } from '@/services/api';

export interface UseDataLoaderOptions {
  /** When false the loader does not fetch on mount / deps change (e.g. waiting for an id). Defaults to `true`. */
  enabled?: boolean;
}

/**
 * Loads data for a view and tracks the three read states the UI must tell apart:
 * first load (`isLoading` → skeleton), refetch (`isRefreshing` → keep the current data visible)
 * and failure (`error` → message + retry, never an empty state).
 *
 * Only the latest request may write state: a slower, older response can't overwrite fresh data,
 * and a superseded request is aborted through the `signal` passed to the fetcher.
 * `reload()` never throws, so it can be awaited inside `useAsyncAction`'s `onSuccess`.
 */
export function useDataLoader<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  initialData: T,
  deps: React.DependencyList = [],
  options: UseDataLoaderOptions = {}
) {
  const t = useTranslations('Common');
  const { enabled = true } = options;
  const [data, setData] = React.useState<T>(initialData);
  // True until the first request settles (also while `enabled` is false): never "no results" before data.
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const fetcherRef = React.useRef(fetcher);
  const controllerRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const reload = React.useCallback(async (): Promise<T | undefined> => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setIsRefreshing(true);
    try {
      const result = await fetcherRef.current(controller.signal);
      if (controller.signal.aborted) return undefined;
      setData(result);
      setError(null);
      return result;
    } catch (err) {
      if (controller.signal.aborted || isAbortError(err)) return undefined;
      setError(getErrorMessage(err) || t('loadError'));
      return undefined;
    } finally {
      if (controllerRef.current === controller) {
        setIsRefreshing(false);
        setIsLoading(false);
      }
    }
  }, [t]);

  React.useEffect(() => {
    if (!enabled) return;
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, reload, ...deps]);

  React.useEffect(() => () => controllerRef.current?.abort(), []);

  return { data, setData, isLoading, isRefreshing, error, reload };
}
