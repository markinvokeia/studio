'use client';

import { create } from 'zustand';

/**
 * Qué módulos de voz tiene la pantalla abierta (calendar, lab_orders…). El botón Voz vive en un solo
 * lugar (el riel derecho, debajo de la mascota) y la voz trabaja con el contexto de la página donde
 * se está: cada pantalla registra sus módulos con useVoiceScreen al montarse y los saca al irse.
 */
interface VoiceScreenState {
  /** Registros vivos (una pantalla puede tener varios componentes que registran). */
  entries: Array<{ id: number; domains: readonly string[] }>;
  add: (domains: readonly string[]) => number;
  remove: (id: number) => void;
}

let nextId = 1;

export const useVoiceScreenStore = create<VoiceScreenState>((set) => ({
  entries: [],
  add: (domains) => {
    const id = nextId++;
    set((s) => ({ entries: [...s.entries, { id, domains }] }));
    return id;
  },
  remove: (id) => set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),
}));

/** Los módulos activos, sin repetir, en el orden en que se registraron. */
export function activeScreenDomains(entries: VoiceScreenState['entries']): string[] {
  return [...new Set(entries.flatMap((e) => e.domains))];
}
