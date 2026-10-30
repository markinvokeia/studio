'use client';

import { create } from 'zustand';

/**
 * Voz del asistente: la mascota lee en voz alta las respuestas del chat con la
 * síntesis de voz del navegador (Web Speech API, sin costo ni backend). Se puede
 * silenciar; la preferencia queda en este navegador.
 */

const MUTED_KEY = 'invoke-help-voice-muted';
/** Chrome corta las locuciones largas (~15 s): se lee de a frases. */
const MAX_CHUNK_CHARS = 180;
/** Si el navegador no avisa que terminó (pasa en Safari), se da por terminada. */
const MS_PER_CHAR = 90;
const END_GRACE_MS = 3000;

/** Voces preferidas por locale de la app, en orden. */
const PREFERRED_LANGS: Record<string, string[]> = {
  es: ['es-UY', 'es-AR', 'es-419', 'es-MX', 'es-US', 'es'],
  'es-ES': ['es-ES', 'es'],
  en: ['en-US', 'en-GB', 'en'],
};

function readMuted(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(MUTED_KEY) === '1';
  } catch {
    return false;
  }
}

interface AssistantVoiceState {
  muted: boolean;
  /** Id del mensaje que se está leyendo. */
  speakingId: string | null;
  setMuted: (muted: boolean) => void;
}

export const useAssistantVoice = create<AssistantVoiceState>((set) => ({
  muted: readMuted(),
  speakingId: null,
  setMuted: (muted) => {
    try { window.localStorage.setItem(MUTED_KEY, muted ? '1' : '0'); } catch { /* sin storage queda en memoria */ }
    if (muted) stopAssistantSpeech();
    set({ muted });
  },
}));

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
}

function pickVoice(locale: string): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  const langs = PREFERRED_LANGS[locale] ?? PREFERRED_LANGS[locale.slice(0, 2)] ?? [locale];
  for (const lang of langs) {
    const matches = voices.filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith(lang.toLowerCase()));
    // Las voces locales suenan antes; entre ellas, la marcada por defecto.
    const voice = matches.find((v) => v.localService && v.default) ?? matches.find((v) => v.localService) ?? matches[0];
    if (voice) return voice;
  }
  return undefined;
}

/** Texto del chat → texto para leer: sin markdown, links ni emojis. */
export function toSpeechText(text: string): string {
  return text
    .replace(/\\n/g, '\n')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[*_`#>]+/g, '')
    .replace(/[\p{Extended_Pictographic}\u{FE0F}]/gu, '')
    .replace(/([.:;!?])?\s*\n+\s*/g, (_, mark?: string) => (mark ? `${mark} ` : '. '))
    .replace(/\s{2,}/g, ' ')
    .replace(/(\.\s*){2,}/g, '. ')
    .trim();
}

function splitChunks(text: string): string[] {
  const sentences = text.match(/[^.!?¡¿]+[.!?]*|[¡¿][^.!?]+[.!?]*/g) ?? [text];
  const chunks: string[] = [];
  let current = '';
  for (const sentence of sentences.map((s) => s.trim()).filter(Boolean)) {
    if (current && current.length + sentence.length + 1 > MAX_CHUNK_CHARS) {
      chunks.push(current);
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

let session = 0;
let finishCurrent: (() => void) | null = null;

export function stopAssistantSpeech() {
  session += 1;
  if (isSpeechSupported()) window.speechSynthesis.cancel();
  finishCurrent?.();
}

/**
 * Lee el texto en voz alta (cortando lo que se estuviera leyendo). Resuelve al
 * terminar o al cortarse; resuelve `false` si no se leyó (silenciado o sin soporte).
 */
export function speakAssistant(id: string, text: string, locale: string): Promise<boolean> {
  const { muted } = useAssistantVoice.getState();
  const speech = toSpeechText(text);
  if (muted || !speech || !isSpeechSupported()) return Promise.resolve(false);
  stopAssistantSpeech();
  const mine = ++session;
  const synth = window.speechSynthesis;
  const voice = pickVoice(locale);
  const chunks = splitChunks(speech);
  useAssistantVoice.setState({ speakingId: id });

  return new Promise<boolean>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(fallback);
      if (finishCurrent === finish) finishCurrent = null;
      if (useAssistantVoice.getState().speakingId === id) useAssistantVoice.setState({ speakingId: null });
      resolve(true);
    };
    const fallback = setTimeout(finish, speech.length * MS_PER_CHAR + END_GRACE_MS);
    finishCurrent = finish;

    chunks.forEach((chunk, i) => {
      const utterance = new SpeechSynthesisUtterance(chunk);
      if (voice) utterance.voice = voice;
      utterance.lang = voice?.lang ?? (PREFERRED_LANGS[locale]?.[0] ?? locale);
      utterance.rate = 1.05;
      if (i === chunks.length - 1) utterance.onend = () => { if (mine === session) finish(); };
      utterance.onerror = () => { if (mine === session) finish(); };
      synth.speak(utterance);
    });
  });
}
