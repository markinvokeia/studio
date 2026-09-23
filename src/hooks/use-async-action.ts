'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { toast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/error-utils';
import { isAbortError, isTimeoutError } from '@/services/api';

export interface UseAsyncActionOptions<TResult> {
  /** Runs after the action resolves, while the action is still marked as pending. */
  onSuccess?: (result: TResult) => void | Promise<void>;
  /** Runs when the action throws (not on caller aborts). Use it for inline form errors. */
  onError?: (error: unknown) => void;
  /** Show the default destructive toast on error. Defaults to `true`. */
  showErrorToast?: boolean;
  /** Title for the default error toast. Defaults to `Common.errorTitle`. */
  errorTitle?: string;
}

function useLatest<T>(value: T) {
  const ref = React.useRef(value);
  React.useEffect(() => {
    ref.current = value;
  });
  return ref;
}

function useActionErrorReporter() {
  const t = useTranslations('Common');

  return React.useCallback(
    <TResult,>(error: unknown, options: UseAsyncActionOptions<TResult>) => {
      options.onError?.(error);
      if (options.showErrorToast === false) return;
      toast({
        variant: 'destructive',
        title: options.errorTitle ?? t('errorTitle'),
        description: isTimeoutError(error) ? t('timeoutError') : getErrorMessage(error) || t('genericError'),
      });
    },
    [t]
  );
}

/**
 * Wraps a backend mutation so it can only run once at a time.
 *
 * The lock is a ref, so it holds even for clicks that land before React re-renders with
 * `isPending = true` (double-click, Enter + click, async validation windows). Calls made while
 * the action is in flight resolve to `undefined` without running it.
 */
export function useAsyncAction<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
  options: UseAsyncActionOptions<TResult> = {}
) {
  const [isPending, setIsPending] = React.useState(false);
  const inFlightRef = React.useRef(false);
  const mountedRef = React.useRef(true);
  const latest = useLatest({ action, options });
  const reportError = useActionErrorReporter();

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const run = React.useCallback(
    async (...args: TArgs): Promise<TResult | undefined> => {
      if (inFlightRef.current) return undefined;
      inFlightRef.current = true;
      setIsPending(true);
      const { action: currentAction, options: currentOptions } = latest.current;
      try {
        const result = await currentAction(...args);
        await currentOptions.onSuccess?.(result);
        return result;
      } catch (error) {
        if (!isAbortError(error)) reportError(error, currentOptions);
        return undefined;
      } finally {
        inFlightRef.current = false;
        if (mountedRef.current) setIsPending(false);
      }
    },
    [latest, reportError]
  );

  return { run, isPending };
}

/**
 * Same as `useAsyncAction`, but locks per key (row id) so different rows can run in parallel
 * while each row's own button stays blocked until its request settles.
 */
export function useKeyedAsyncAction<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
  options: UseAsyncActionOptions<TResult> = {}
) {
  const [pendingKeys, setPendingKeys] = React.useState<ReadonlySet<string>>(() => new Set());
  const inFlightRef = React.useRef(new Set<string>());
  const latest = useLatest({ action, options });
  const reportError = useActionErrorReporter();

  const release = React.useCallback((key: string) => {
    inFlightRef.current.delete(key);
    setPendingKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const run = React.useCallback(
    async (key: string, ...args: TArgs): Promise<TResult | undefined> => {
      if (inFlightRef.current.has(key)) return undefined;
      inFlightRef.current.add(key);
      setPendingKeys((prev) => new Set(prev).add(key));
      const { action: currentAction, options: currentOptions } = latest.current;
      try {
        const result = await currentAction(...args);
        await currentOptions.onSuccess?.(result);
        return result;
      } catch (error) {
        if (!isAbortError(error)) reportError(error, currentOptions);
        return undefined;
      } finally {
        release(key);
      }
    },
    [latest, release, reportError]
  );

  const isPending = React.useCallback((key: string) => pendingKeys.has(key), [pendingKeys]);

  return { run, isPending, hasPending: pendingKeys.size > 0 };
}
