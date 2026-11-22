#!/usr/bin/env node
/**
 * Genera con ElevenLabs la voz de cada frase de la promo (lo que «dice» el doctor), en es y en.
 *
 *   ELEVENLABS_API_KEY=… node scripts/videos/promo-voice/gen-audio.mjs [es|en|all]
 *
 * La clave nunca va al repo: se pasa por variable de entorno. Salida:
 * videos/promo-voice/audio/<locale>/<clave>.mp3 (una por frase del guion, script.mjs).
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { LINES, VOICES } from './script.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY) throw new Error('Falta ELEVENLABS_API_KEY');
const LOCALES = process.argv[2] && process.argv[2] !== 'all' ? [process.argv[2]] : ['es', 'en'];
const FORCE = process.env.FORCE === '1';

for (const locale of LOCALES) {
  const dir = join(ROOT, 'videos', 'promo-voice', 'audio', locale);
  mkdirSync(dir, { recursive: true });
  for (const [key, line] of Object.entries(LINES[locale])) {
    const file = join(dir, `${key}.mp3`);
    if (existsSync(file) && !FORCE) continue;
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICES[locale]}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({
        text: line.voice ?? line.say,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true, speed: 1.2 },
      }),
    });
    if (!res.ok) throw new Error(`ElevenLabs ${res.status} en ${locale}/${key}: ${(await res.text()).slice(0, 200)}`);
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    console.log(`[audio] ${locale}/${key}.mp3`);
  }
}
