// Genera videos/promo/out/guiones-elevenlabs.md a partir de vo.json y los tiempos de cada build.
// Uso: node scripts/videos/promo/narration.cjs   (desde la raíz del repo; textos en narration-vo.json)
const fs = require('fs');
const path = require('path');
const VO = JSON.parse(fs.readFileSync(path.join(__dirname, 'narration-vo.json'), 'utf8'));
const NAMES = { hook: 'Gancho', intro: 'Presentación', onb: 'Onboarding guiado', ops: 'Todo en una página', field: 'Directo al campo', ask: 'Voz o texto (pregunta y respuesta)', video: 'Ver video', guide: 'Paso a paso', ohh: '¡Ohhh! (aviso)', outro: 'Cierre' };
const fmt = (t) => { const m = Math.floor(t / 60); return `${m}:${(t - m * 60).toFixed(1).padStart(4, '0')}`; };
const dur = (text, locale) => text.length / (locale === 'es' ? 15 : 16);

let md = `# Guiones de narración para ElevenLabs — promo del asistente de Invoke IA

Narración en primera persona: habla la mascota. Hay una sección por video, con los tiempos de las versiones actuales de \`videos/promo/out/\`.

## Configuración (Eleven Multilingual v2, valores por defecto)

| Ajuste | Valor |
|---|---|
| Modelo | **Eleven Multilingual v2** (\`eleven_multilingual_v2\`) |
| Stability | 50 % |
| Similarity | 75 % |
| Style exaggeration | 0 % |
| Speaker boost | Activado |
| Speed | 1.0 |
| Formato de salida | MP3 44,1 kHz 128 kbps (o WAV si lo vas a editar) |

Recomendaciones:
- **Una toma por escena (recomendado).** Generá cada frase por separado y colocala en el editor en su "Desde". Es lo más preciso: si una frase sale más larga, no corre a las demás.
- **Toma única (alternativa).** Al final de cada sección está el texto completo con pausas \`<break time="…s" />\`; Multilingual v2 las respeta hasta 3 s. Las pausas suponen un ritmo de unos 15 caracteres por segundo en español y 16 en inglés. Si la voz es más lenta o más rápida, ajustá las pausas o usá la toma por escena.
- **"Invoke"** se dice solo, sin "IA". Donde se habla de inteligencia artificial ("no es un video hecho con I.A.") va con puntos para que se lea deletreado ("i-a"; en inglés, "ei-ai").
- **"¡Ohhh!"** a veces sale cortado. Si pasa, probá "¡Ooooh!" o "¡Oh, oh!".
- La pregunta y la respuesta del chat ("Voz o texto") van en una sola frase que cubre las dos escenas.
- Para el español conviene una voz rioplatense: los textos usan voseo ("llegás", "preferís"), igual que la app.
- "Dura aprox." compara lo que se estima que dura la voz con lo que dura la escena.
`;

const warns = [];
for (const locale of ['es', 'en']) for (const format of ['landscape', 'reel']) {
  const tag = `${locale}-${format}`;
  const html = fs.readFileSync(`videos/promo/build/${tag}.html`, 'utf8');
  const promo = JSON.parse(html.match(/__PROMO=(.*?)<\/script>/)[1]);
  const L = format === 'landscape';
  // Escenas fijas del escenario (hook, intro, outro) y las de video con la duración de su tramo.
  const order = L
    ? [['hook', 3.8], ['intro', 7.6], 'onb', 'ops', 'field', 'ask', 'reply', 'video', 'guide', 'ohh', ['outro', 8.6]]
    : [['hook', 2.3], ['intro', 3.2], 'onb', 'ops', 'field', 'ask', 'reply', 'video', 'guide', 'ohh', ['outro', 3.6]];
  let t = 0;
  const rows = [];
  for (const s of order) { const [id, d] = Array.isArray(s) ? s : [s, promo.segments[s].dur]; rows.push({ id, start: t, dur: d }); t += d; }
  const reply = rows.find((x) => x.id === 'reply');
  const lines = rows.filter((r) => VO[locale][format][r.id]).map((r) => ({
    ...r, end: r.id === 'ask' ? reply.start + reply.dur : r.start + r.dur, text: VO[locale][format][r.id],
  }));

  md += `\n---\n\n## ${locale === 'es' ? 'Español' : 'Inglés'} · ${L ? '16:9' : '9:16 (reel)'} — \`invoke-asistente-${locale}-${L ? '16x9' : '9x16'}.mp4\` (${t.toFixed(1)} s)\n\n`;
  md += '| # | Escena | Desde | Hasta | Texto | Dura aprox. |\n|---|---|---|---|---|---|\n';
  lines.forEach((l, i) => {
    const d = dur(l.text, locale);
    if (d > l.end - l.start) warns.push(`${tag} ${l.id}`);
    md += `| ${i + 1} | ${NAMES[l.id]} | ${fmt(l.start)} | ${fmt(l.end)} | ${l.text} | ${d.toFixed(1)} s / ${(l.end - l.start).toFixed(1)} s |\n`;
  });

  // Toma única: una pausa antes de cada frase (0,4–3 s) para que empiece con su escena sin pisar la anterior.
  let one = '';
  let cursor = 0;
  lines.forEach((l, i) => {
    const at = l.start + (i === 0 ? 0.3 : 0.1);
    const gap = Math.max(i === 0 ? 0 : 0.4, Math.min(3, at - cursor));
    if (gap >= 0.2) one += `<break time="${gap.toFixed(1)}s" /> `;
    one += l.text + ' ';
    cursor += gap + dur(l.text, locale);
  });
  md += `\n**Toma única (pegar tal cual):**\n\n\`\`\`text\n${one.trim()}\n\`\`\`\n`;
}
fs.writeFileSync('videos/promo/out/guiones-elevenlabs.md', md);
console.log(warns.length ? 'DESBORDES: ' + warns.join(', ') : 'sin desbordes');
