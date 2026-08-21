'use client';

import * as React from 'react';

import { API_ROUTES } from '@/constants/routes';
import { api } from '@/services/api';
import type { ToastPosition, UserPreferences, UserPreferencesResponse } from '@/lib/types';

const CACHE_KEY_PREFIX = 'toast-position';

export const DEFAULT_TOAST_POSITION: ToastPosition = 'top-center';

export const TOAST_POSITIONS = ['top-center', 'top-right', 'bottom-center', 'bottom-right'] as const;

function parsePosition(value: unknown): ToastPosition | null {
  return typeof value === 'string' && (TOAST_POSITIONS as readonly string[]).includes(value)
    ? (value as ToastPosition)
    : null;
}

function readCachedPosition(userId: string): ToastPosition | null {
  try {
    return parsePosition(window.localStorage.getItem(`${CACHE_KEY_PREFIX}:${userId}`));
  } catch {
    return null;
  }
}

function writeCachedPosition(userId: string, position: ToastPosition) {
  try {
    window.localStorage.setItem(`${CACHE_KEY_PREFIX}:${userId}`, position);
  } catch {}
}

// ── Module-level store ───────────────────────────────────────────────────────
// `<Toaster />` is mounted in `[locale]/layout.tsx` above NotificationsProvider and
// never unmounts, so it can't read this value from a React context that the
// preferences page also writes to. A module store is the only way both share it:
// picking a position updates the already-mounted Toaster on the spot, no reload.
let currentPosition: ToastPosition = DEFAULT_TOAST_POSITION;
const listeners = new Set<() => void>();

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

function getSnapshot(): ToastPosition {
  return currentPosition;
}

// SSR and the first client render must agree, so both see the default. The stored
// value is loaded in an effect — never read localStorage at module-import time, or
// the preferences page hydrates with a different button selected than the server
// rendered.
function getServerSnapshot(): ToastPosition {
  return DEFAULT_TOAST_POSITION;
}

function setStorePosition(next: ToastPosition) {
  if (next === currentPosition) return;
  currentPosition = next;
  listeners.forEach((listener) => listener());
}

// ── Per-user load, deduplicated across consumers ─────────────────────────────
// Both `<Toaster />` and the preferences page call this hook; without the guard
// they'd each fire their own GET. Keyed by userId so a logout/login or an account
// switch refetches instead of reusing the previous user's value.
let loadedUserId: string | null = null;
let inFlight: { userId: string; promise: Promise<void> } | null = null;

function fetchPosition(userId: string): Promise<void> {
  if (inFlight?.userId === userId) return inFlight.promise;

  const promise = api
    .get(API_ROUTES.USER_PREFERENCES)
    .then((res: unknown) => {
      // The user switched (or logged out) while this was in flight — drop it.
      if (loadedUserId !== userId) return;
      const parsed = parsePosition((res as UserPreferencesResponse | null)?.preferences?.toast_position);
      if (parsed) {
        setStorePosition(parsed);
        writeCachedPosition(userId, parsed);
      }
    })
    .catch(() => {
      // Clear the marker so `refresh()` can retry after a failed request.
      if (loadedUserId === userId) loadedUserId = null;
    })
    .finally(() => {
      if (inFlight?.userId === userId) inFlight = null;
    });

  inFlight = { userId, promise };
  return promise;
}

function loadOnce(userId: string) {
  if (loadedUserId === userId) return;
  // Marked before awaiting so two simultaneous mounts can't both fetch.
  loadedUserId = userId;
  const cached = readCachedPosition(userId);
  if (cached) setStorePosition(cached); // instant; the backend still wins below
  void fetchPosition(userId);
}

/**
 * Toast position preference, shared through a module store so `<Toaster />` and the
 * preferences page stay in sync without a reload.
 *
 * Self-only: the GET omits `user_id` and resolves to the JWT user, so this must never
 * be called with somebody else's id — it would move the current user's own toasts.
 */
export function useToastPosition(
  userId?: string | number,
): [ToastPosition, (position: ToastPosition) => void, () => void] {
  const position = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const id = userId != null ? String(userId) : null;

  React.useEffect(() => {
    if (!id) {
      // Logged out, or on the login screen: forget the previous user so the next
      // login refetches, and don't leak their position into another session.
      if (loadedUserId !== null) {
        loadedUserId = null;
        setStorePosition(DEFAULT_TOAST_POSITION);
      }
      return;
    }
    loadOnce(id);
  }, [id]);

  const setPosition = React.useCallback(
    (next: ToastPosition) => {
      setStorePosition(next); // optimistic: both consumers re-render now
      if (!id) return;
      writeCachedPosition(id, next);
      api.post(API_ROUTES.USER_PREFERENCES, { toast_position: next } satisfies UserPreferences).catch(() => {});
    },
    [id],
  );

  // Mirrors `refreshAlertStyle`: the preferences page forces a refetch on mount
  // because the store is only as fresh as its last load, and an admin may have
  // changed the value from another session since then.
  const refresh = React.useCallback(() => {
    if (!id) return;
    loadedUserId = id;
    void fetchPosition(id);
  }, [id]);

  return [position, setPosition, refresh];
}
