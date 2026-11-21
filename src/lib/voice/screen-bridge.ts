'use client';

import * as React from 'react';

/**
 * Puente entre una parte de la pantalla y la voz: la pantalla (el riel derecho, el cobro rápido,
 * una página) publica lo que tiene y lo que sabe hacer con una clave ('rail', 'billing'…), y los
 * comandos de voz lo leen. El mismo patrón que la agenda (calendar-bridge), genérico.
 *
 * Cada publicación lleva su dueño: si una pantalla nueva publica antes de que la vieja se desmonte,
 * la vieja no borra lo de la nueva al irse.
 */
const bridges = new Map<string, { owner: object; value: unknown }>();

export function publishVoiceBridge<T>(key: string, value: T | null, owner: object) {
  if (value === null) {
    if (bridges.get(key)?.owner === owner) bridges.delete(key);
    return;
  }
  bridges.set(key, { owner, value });
}

export function getVoiceBridge<T>(key: string): T | null {
  return (bridges.get(key)?.value as T | undefined) ?? null;
}

/** Espera a que la pantalla publique (recién abierta o recién navegada). */
export async function waitVoiceBridge<T>(key: string, signal?: AbortSignal, timeoutMs = 3000): Promise<T | null> {
  const start = Date.now();
  for (;;) {
    const value = getVoiceBridge<T>(key);
    if (value || signal?.aborted || Date.now() - start > timeoutMs) return value;
    await new Promise((r) => setTimeout(r, 40));
  }
}

/** Para las pruebas. */
export function resetVoiceBridges() {
  bridges.clear();
}

/**
 * La pantalla publica `value` mientras está montada (se actualiza en cada render, sin efectos de
 * más: lo que se lee siempre es lo último).
 */
export function useVoiceBridge<T>(key: string, value: T) {
  const [owner] = React.useState(() => ({}));
  React.useLayoutEffect(() => { publishVoiceBridge(key, value, owner); });
  React.useEffect(() => () => publishVoiceBridge(key, null, owner), [key, owner]);
}
