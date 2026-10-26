import { create } from 'zustand';

import type { HelpAssistantReply, HelpGuideStep } from '@/lib/types';

export type HelpAssistantTab = 'onboarding' | 'chat' | 'screen';

export type GuideStepStatus = 'pending' | 'running' | 'waiting' | 'done' | 'skipped' | 'failed';

export interface GuideRun {
  key: number;
  title: string;
  useCaseId?: string;
  steps: HelpGuideStep[];
  statuses: GuideStepStatus[];
  current: number;
  values: Record<string, unknown>;
  /** Mensaje del último paso que no se pudo ejecutar (elemento no encontrado, etc.). */
  error?: string;
  /** Espera larga en curso (en desarrollo, Next compila cada pantalla la primera vez). */
  notice?: 'loadingScreen' | 'loadingElement';
  finished: boolean;
  /** Desde dónde se abrió: al cerrar la guía se vuelve ahí (el chat donde quedó). */
  returnTo?: HelpAssistantTab;
}

/** Qué se está resaltando. El spotlight resuelve el elemento por help id. */
export interface HelpSpotlight {
  targetId: string;
  title: string;
  description?: string;
  /** `action`: lo está haciendo; `filled`: ya lo completó; `input`: completalo vos; `confirm`: pulsalo vos. */
  mode: 'info' | 'action' | 'filled' | 'input' | 'confirm';
  /** Detalle funcional del paso (qué hace, qué cambia según lo que elijas). */
  details?: string;
  /** Sólo campos: true obligatorio, false opcional, undefined no aplica. */
  required?: boolean;
}

export interface HelpChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  reply?: HelpAssistantReply;
  /** La pregunta que respondió: ordena las guías sugeridas de la pantalla. */
  question?: string;
  isVoice?: boolean;
}

type HelpAssistantStore = {
  isOpen: boolean;
  tab: HelpAssistantTab;
  guide: GuideRun | null;
  spotlight: HelpSpotlight | null;
  messages: HelpChatMessage[];
  /** La lista de pasos junto a la barra de navegación (se puede plegar). */
  stepsListOpen: boolean;
  /**
   * Preferencias de Clínica → "Mascota visible" (`system_configurations.help_mascot_visible`).
   * Apagada, las guías siguen igual (resaltado, globo, barra y pasos) pero sin la mascota,
   * y al asistente se entra por el ícono de ayuda del riel.
   */
  clinicMascotVisible: boolean;
  /** Se incrementa cuando conviene volver a pedir el estado del onboarding. */
  onboardingRefreshKey: number;
  open: (tab?: HelpAssistantTab) => void;
  close: () => void;
  setTab: (tab: HelpAssistantTab) => void;
  setGuide: (updater: (guide: GuideRun | null) => GuideRun | null) => void;
  setSpotlight: (spotlight: HelpSpotlight | null) => void;
  addMessage: (message: HelpChatMessage) => void;
  refreshOnboarding: () => void;
  setStepsListOpen: (open: boolean) => void;
  setClinicMascotVisible: (visible: boolean) => void;
};

export const useHelpAssistant = create<HelpAssistantStore>((set) => ({
  isOpen: false,
  tab: 'chat',
  guide: null,
  spotlight: null,
  messages: [],
  stepsListOpen: true,
  clinicMascotVisible: true,
  onboardingRefreshKey: 0,
  open: (tab) => set((s) => ({ isOpen: true, tab: tab ?? s.tab })),
  close: () => set({ isOpen: false }),
  setTab: (tab) => set({ tab }),
  setGuide: (updater) => set((s) => ({ guide: updater(s.guide) })),
  setSpotlight: (spotlight) => set({ spotlight }),
  addMessage: (message) => set((s) => ({ messages: [...s.messages, message].slice(-60) })),
  refreshOnboarding: () => set((s) => ({ onboardingRefreshKey: s.onboardingRefreshKey + 1 })),
  setStepsListOpen: (stepsListOpen) => set({ stepsListOpen }),
  setClinicMascotVisible: (clinicMascotVisible) => set({ clinicMascotVisible }),
}));
