'use client';

import * as React from 'react';

import { useVoiceScreenStore } from '@/stores/voice-screen-store';

/**
 * La pantalla dice qué módulos de voz tiene (p. ej. la agenda: ['calendar']). Mientras esté
 * montada, la voz (el botón del riel derecho) trabaja con ese contexto.
 */
export function useVoiceScreen(domains: readonly string[]) {
  const key = domains.join(',');
  React.useEffect(() => {
    const id = useVoiceScreenStore.getState().add(key ? key.split(',') : []);
    return () => useVoiceScreenStore.getState().remove(id);
  }, [key]);
}
