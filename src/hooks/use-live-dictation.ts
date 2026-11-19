'use client';

import * as React from 'react';

import { isSpeechRecognitionSupported, startContinuousListening, type ContinuousListening, type ContinuousListeningError } from '@/lib/voice/speech-recognition';

export type LiveDictationError = ContinuousListeningError | null;

/**
 * Dictado continuo para cargar datos mientras se habla (periodontograma): entrega cada frase
 * apenas el navegador la da por terminada, sin esperar a que se apague el micrófono. El navegador
 * corta el reconocimiento tras un silencio; mientras siga encendido, se reinicia solo.
 */
export function useLiveDictation(locale: string, onPhrase: (text: string) => void) {
  const [isListening, setIsListening] = React.useState(false);
  const [interim, setInterim] = React.useState('');
  const [error, setError] = React.useState<LiveDictationError>(null);
  const listeningRef = React.useRef<ContinuousListening | null>(null);
  const onPhraseRef = React.useRef(onPhrase);
  React.useEffect(() => { onPhraseRef.current = onPhrase; });

  const isSupported = React.useMemo(() => isSpeechRecognitionSupported(), []);

  const start = React.useCallback(() => {
    if (listeningRef.current) return;
    setError(null);
    // `let` antes de empezar: si el navegador no deja empezar, onEnd llega antes de que vuelva.
    let listening: ContinuousListening | null = null;
    listening = startContinuousListening(locale, {
      onPhrase: (text) => onPhraseRef.current(text),
      onInterim: setInterim,
      onError: setError,
      onEnd: () => {
        if (listeningRef.current === listening) listeningRef.current = null;
        setInterim('');
        setIsListening(false);
      },
    });
    if (!listening) {
      setError((prev) => prev ?? 'unavailable');
      setIsListening(false);
      return;
    }
    listeningRef.current = listening;
    setIsListening(true);
  }, [locale]);

  const stop = React.useCallback(() => {
    setIsListening(false);
    listeningRef.current?.stop();
  }, []);

  React.useEffect(() => () => {
    const listening = listeningRef.current;
    listeningRef.current = null;
    listening?.abort();
  }, []);

  /** Mientras habla el asistente: el micrófono no se escucha a sí mismo. */
  const pause = React.useCallback(() => listeningRef.current?.pause(), []);
  const resume = React.useCallback(() => listeningRef.current?.resume(), []);

  return { isSupported, isListening, interim, error, start, stop, pause, resume };
}
