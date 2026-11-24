'use client';

import { create } from 'zustand';

import type { VoiceCard, VoicePhase } from '@/lib/types';

/** Estado visible de la sesión de voz (lo maneja src/lib/voice/session.ts). */
interface VoiceCommandState {
  phase: VoicePhase;
  /** Lo que se está escuchando, en vivo. */
  interim: string;
  /** Lo último que dijo la persona (ya terminado). */
  heard: string;
  card: VoiceCard | null;
  /** Qué espera la tarjeta: una respuesta libre, sí/no o una opción. */
  awaiting: 'answer' | 'confirm' | 'choice' | null;
  set: (patch: Partial<Omit<VoiceCommandState, 'set' | 'reset'>>) => void;
  reset: () => void;
}

const INITIAL = { phase: 'idle' as VoicePhase, interim: '', heard: '', card: null, awaiting: null };

export const useVoiceCommand = create<VoiceCommandState>((set) => ({
  ...INITIAL,
  set: (patch) => set(patch),
  reset: () => set(INITIAL),
}));
