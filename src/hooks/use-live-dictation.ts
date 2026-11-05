'use client';

import * as React from 'react';

// Web Speech API (no está en lib.dom de TypeScript).
interface ISpeechRecognitionAlternative { readonly transcript: string }
interface ISpeechRecognitionResult { readonly isFinal: boolean; readonly 0: ISpeechRecognitionAlternative }
interface ISpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: { readonly length: number; readonly [index: number]: ISpeechRecognitionResult };
}
interface ISpeechRecognitionErrorEvent extends Event { readonly error: string }
interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((ev: ISpeechRecognitionEvent) => void) | null;
  onerror: ((ev: ISpeechRecognitionErrorEvent) => void) | null;
  onend: ((ev: Event) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SpeechRecognitionCtor = new () => ISpeechRecognition;

const SPEECH_LANG: Record<string, string> = { es: 'es-UY', 'es-ES': 'es-ES', en: 'en-US' };

function getCtor(): SpeechRecognitionCtor | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export type LiveDictationError = 'not-allowed' | 'unavailable' | null;

/**
 * Dictado continuo para cargar datos mientras se habla (periodontograma): entrega cada frase
 * apenas el navegador la da por terminada, sin esperar a que se apague el micrófono. El navegador
 * corta el reconocimiento tras un silencio; mientras siga encendido, se reinicia solo.
 */
export function useLiveDictation(locale: string, onPhrase: (text: string) => void) {
  const [isListening, setIsListening] = React.useState(false);
  const [interim, setInterim] = React.useState('');
  const [error, setError] = React.useState<LiveDictationError>(null);
  const recognitionRef = React.useRef<ISpeechRecognition | null>(null);
  const wantedRef = React.useRef(false);
  const onPhraseRef = React.useRef(onPhrase);
  React.useEffect(() => { onPhraseRef.current = onPhrase; });

  const isSupported = React.useMemo(() => Boolean(getCtor()), []);
  /** The browser ended the session: start it again (through a ref, the callback can't name itself) */
  const relaunchRef = React.useRef<() => void>(() => undefined);

  const launch = React.useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) { setError('unavailable'); return; }
    const recognition = new Ctor();
    recognition.lang = SPEECH_LANG[locale] ?? locale;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let live = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const text = result[0].transcript.trim();
          if (text) onPhraseRef.current(text);
        } else {
          live += result[0].transcript;
        }
      }
      setInterim(live.trim());
    };
    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        wantedRef.current = false;
        setError('not-allowed');
      } else if (event.error === 'audio-capture') {
        wantedRef.current = false;
        setError('unavailable');
      }
      // 'no-speech' and 'network' end the session; onend starts it again
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setInterim('');
      if (wantedRef.current) {
        window.setTimeout(() => { if (wantedRef.current && !recognitionRef.current) relaunchRef.current(); }, 150);
      } else {
        setIsListening(false);
      }
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      wantedRef.current = false;
      setIsListening(false);
      setError('unavailable');
    }
  }, [locale]);
  React.useEffect(() => { relaunchRef.current = launch; }, [launch]);

  const start = React.useCallback(() => {
    if (wantedRef.current) return;
    wantedRef.current = true;
    setError(null);
    setIsListening(true);
    launch();
  }, [launch]);

  const stop = React.useCallback(() => {
    wantedRef.current = false;
    setIsListening(false);
    recognitionRef.current?.stop();
  }, []);

  React.useEffect(() => () => {
    wantedRef.current = false;
    recognitionRef.current?.abort();
  }, []);

  return { isSupported, isListening, interim, error, start, stop };
}
