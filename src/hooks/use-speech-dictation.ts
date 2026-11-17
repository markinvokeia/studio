'use client';

import * as React from 'react';

import { getSpeechRecognitionCtor as getCtor, speechLang, type ISpeechRecognition } from '@/lib/voice/speech-recognition';

/**
 * Dictado para el chat del asistente: transcribe en vivo en el navegador y,
 * al terminar, entrega el texto final. Pensado para dictar los datos de una
 * guía ("creá la sede Centro en Av. Brasil 2020, teléfono…").
 */
export function useSpeechDictation(locale: string, onFinal: (text: string) => void) {
  const [isListening, setIsListening] = React.useState(false);
  const [interim, setInterim] = React.useState('');
  const recognitionRef = React.useRef<ISpeechRecognition | null>(null);
  const finalRef = React.useRef('');
  const onFinalRef = React.useRef(onFinal);
  React.useEffect(() => { onFinalRef.current = onFinal; });

  const isSupported = React.useMemo(() => Boolean(getCtor()), []);

  const stop = React.useCallback(() => recognitionRef.current?.stop(), []);

  const start = React.useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor || recognitionRef.current) return;
    const recognition = new Ctor();
    recognition.lang = speechLang(locale);
    recognition.continuous = true;
    recognition.interimResults = true;
    finalRef.current = '';
    recognition.onresult = (event) => {
      let live = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalRef.current += `${result[0].transcript} `;
        else live += result[0].transcript;
      }
      setInterim(`${finalRef.current}${live}`.trim());
    };
    recognition.onerror = () => recognition.stop();
    recognition.onend = () => {
      recognitionRef.current = null;
      setIsListening(false);
      setInterim('');
      const text = finalRef.current.trim();
      if (text) onFinalRef.current(text);
    };
    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  }, [locale]);

  React.useEffect(() => () => recognitionRef.current?.abort(), []);

  return { isSupported, isListening, interim, start, stop };
}
