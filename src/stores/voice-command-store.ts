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
  /** Modo «siempre escuchando» (botón Voz): el micrófono queda abierto hasta apagarlo. */
  alwaysOn: boolean;
  /** Siempre escuchando: conversación abierta (no hace falta decir «Invoke»). */
  awake: boolean;
  /** Cita en foco (nombre del paciente) para la tarjeta. */
  focusLabel: string | null;
  /** Lo que se pidió y se está haciendo (la tarea de la pila). */
  task: string | null;
  /** Plan de varios pasos: en cuál va. */
  step: { index: number; total: number } | null;
  /** La tarea quedó guardada al dormirse con una pregunta abierta. */
  suspended: boolean;
  /** Siempre escuchando: el micrófono está oyendo a alguien ahora (aunque esté dormido). */
  hearing: boolean;
  set: (patch: Partial<Omit<VoiceCommandState, 'set' | 'reset'>>) => void;
  /** Cierra la tarjeta y la tarea; mantiene el modo de escucha y el foco. */
  reset: () => void;
}

const INITIAL = {
  phase: 'idle' as VoicePhase,
  interim: '',
  heard: '',
  card: null,
  awaiting: null,
  task: null,
  step: null,
  suspended: false,
};

export const useVoiceCommand = create<VoiceCommandState>((set) => ({
  ...INITIAL,
  alwaysOn: false,
  awake: false,
  focusLabel: null,
  hearing: false,
  set: (patch) => set(patch),
  reset: () => set(INITIAL),
}));
