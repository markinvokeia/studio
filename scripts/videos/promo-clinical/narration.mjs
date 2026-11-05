#!/usr/bin/env node
/**
 * Guiones de narración (ElevenLabs) de las promos de la historia clínica, con los tiempos de cada
 * escena del render actual (videos/promo-clinical/build/<promo>.html).
 *
 *   node scripts/videos/promo-clinical/narration.mjs  → videos/promo-clinical/out/guiones.md
 *
 * Un párrafo por escena, escrito para durar lo que la escena. Por video: la tabla con los tiempos
 * y el texto continuo para pegar.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { FEATURES, FORMATS, TEXT, scenes } from './storyboard.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const BUILD = join(ROOT, 'videos', 'promo-clinical', 'build');
/** Caracteres por segundo de los modelos nuevos (v3/v4), a velocidad 1.0 */
const CPS = { es: 16, en: 15 };
const NAMES = { odo: 'Odontograma', aes: 'Estética', perio: 'Periodontograma' };

/**
 * Lo que dice la voz: un párrafo por escena, del largo justo para llenarla (los números, escritos
 * como se dicen). Narración continua, sin etiquetas de pausa: los modelos nuevos de ElevenLabs
 * (v3/v4) no respetan <break>; el salto de párrafo ya marca una pausa natural.
 */
const VO = {
  es: {
    odo: {
      hook: 'Cada diente. Cada sesión. Todo, dentro de la historia clínica de Invoke.',
      unified: 'Citas, sesiones clínicas, odontogramas, estética y periodoncia, en una sola línea de tiempo.',
      previews: 'Filtrás por odontograma y cada sesión aparece con su vista previa: ves la boca completa sin abrir nada.',
      today: 'Abrís la de hoy: la corona en el treinta y siete.',
      back: 'Con las flechas volvés al diagnóstico de julio: caries en tres molares y una endodoncia indicada.',
      forward: 'Y avanzando, ves cómo cada hallazgo en rojo pasó a tratamiento hecho.',
      dentition: 'Funciona con dentición permanente, mixta o temporal, para adultos y niños.',
      arch: 'La vista de arcada la entiende cualquier paciente.',
      history: 'Y el historial muestra toda la evolución, sesión a sesión.',
      dictation: '¿Hallazgos nuevos? Dictalos o escribilos, como se los dirías a tu asistente.',
      proposals: 'Invoke los marca en cada pieza, y vos revisás y confirmás.',
      catalog: 'Con el catálogo de tratamientos y el cobro a mano.',
      outro: 'Invoke. La boca de tu paciente, sesión a sesión.',
    },
    aes: {
      hook: 'Antes y después, en segundos. La ficha estética de Invoke.',
      unified: 'Cada sesión estética vive en la historia clínica del paciente, con su mapa facial, sus servicios y su estado.',
      consent: 'Antes de empezar, el consentimiento informado se firma por servicio y queda guardado con su huella digital.',
      photos: 'Después vienen las fotos guiadas, de frente y de perfil.',
      slider: 'Deslizás entre el primer día y hoy: noventa y dos días después, las líneas de expresión se suavizaron.',
      marks: 'Activás las marcas y ves dónde se aplicó cada punto.',
      sessions: 'Podés comparar hoy con cualquier sesión: una semana, un mes…',
      modes: '…lado a lado o superpuestas, la comparación que tu paciente entiende al instante.',
      treatment: 'En el mapa de tratamiento queda cada punto, área o línea, con su zona, producto, lote, vencimiento y unidades aplicadas.',
      close: 'Y al cerrar la sesión tenés el resumen, el cobro sugerido, las indicaciones y la próxima cita, todo en un mismo lugar.',
      outro: 'Invoke. Cada tratamiento, con su antes y después.',
    },
    perio: {
      hook: 'Encías que mejoran, medidas. El periodontograma de Invoke.',
      unified: 'Cada periodontograma, en la historia clínica.',
      screening: 'Y cuando alcanza, un cribado rápido con un código por sextante.',
      probe: 'Seis sitios por diente, y las curvas se dibujan solas.',
      passes: 'Profundidad y sangrado, margen, furcas y movilidad.',
      guide: 'Con el examen anterior de guía.',
      voice: 'Y si tenés las manos ocupadas, lo dictás en voz alta.',
      slider: 'Después, hoy contra el primer examen: el sangrado bajó del cuarenta al dos por ciento y las bolsas profundas desaparecieron.',
      overlay: 'Superponés los dos exámenes, en verde y rojo…',
      changes: '…ves cuánto cambió cada sitio…',
      map: '…o toda la boca de un vistazo, diente por diente.',
      play: 'Y con la evolución animada, tu paciente ve cómo fueron cambiando sus encías, del diagnóstico a hoy.',
      trends: 'Con la tendencia de cada índice, sesión a sesión.',
      diagnosis: 'El diagnóstico sigue la clasificación dos mil diecisiete.',
      risk: 'Riesgo y plan por pasos… y hoy, encías estables.',
      close: 'Al cerrar, un reporte en palabras simples para el paciente, por WhatsApp o impreso, con su próxima cita de mantenimiento.',
      outro: 'Invoke. La salud de las encías, en números claros.',
    },
  },
  en: {
    odo: {
      hook: 'Every tooth. Every visit. All inside the Invoke clinical record.',
      unified: 'Appointments, sessions, odontograms, aesthetics and periodontics, on a single timeline.',
      previews: 'Filter by odontogram and every visit shows its own preview: you see the whole mouth without opening anything.',
      today: "Open today's: the crown on thirty-seven.",
      back: 'Step back with the arrows to the July diagnosis: three caries and a root canal.',
      forward: 'Move forward, and every red finding turns into completed work.',
      dentition: 'It handles permanent, mixed and primary teeth, for adults and kids.',
      arch: 'The arch view makes sense to any patient.',
      history: 'And the history strip shows the whole journey.',
      dictation: "New findings? Dictate or type them, the way you'd tell your assistant.",
      proposals: 'Invoke marks them on each tooth; you review and confirm.',
      catalog: 'With treatments, quotes and billing at hand.',
      outro: "Invoke. Your patient's mouth, visit by visit.",
    },
    aes: {
      hook: 'Before and after, in seconds. The Invoke aesthetic record.',
      unified: "Every aesthetic session lives in the patient's clinical record, with its face map, services and status.",
      consent: 'Before you start, informed consent is signed per service and stored with its digital fingerprint.',
      photos: 'Then come the guided photos, front and profile.',
      slider: 'Slide between day one and today: ninety-two days later, the expression lines have softened.',
      marks: 'Turn on the marks and see where every point went.',
      sessions: 'Compare today with any session: one week, one month…',
      modes: '…side by side or overlaid, a comparison your patient gets instantly.',
      treatment: 'The treatment map keeps every point, area or line, with its zone, product, lot, expiry and units.',
      close: 'And when you close the session, you get the summary, suggested billing, aftercare and the next visit.',
      outro: 'Invoke. Every treatment, with its before and after.',
    },
    perio: {
      hook: 'Healthier gums, measured. The Invoke periodontal chart.',
      unified: 'Every periodontal chart, in the clinical record.',
      screening: "And when that's enough, a quick screening with one code per sextant.",
      probe: 'Six sites per tooth, and the curves draw themselves.',
      passes: 'Depth and bleeding, margin, furcation and mobility.',
      guide: 'With the last exam as a guide.',
      voice: 'Hands busy while you probe? Just dictate it out loud.',
      slider: 'Then, today versus the first exam: bleeding dropped from forty to two percent, and the deep pockets are gone.',
      overlay: 'Overlay both exams in green and red…',
      changes: '…see how much each site changed…',
      map: '…or the whole mouth at a glance, tooth by tooth.',
      play: 'And with the animated progress, your patient sees their gums change, from diagnosis to today.',
      trends: 'With every index trending, visit by visit.',
      diagnosis: 'The diagnosis follows the twenty seventeen classification.',
      risk: 'Then the risk hexagon and a step-by-step treatment plan… and today, the gums are stable.',
      close: 'When you close, a plain-language report for your patient, by WhatsApp or printed, with the next maintenance visit.',
      outro: 'Invoke. Gum health, in clear numbers.',
    },
  },
};

/** Variantes para las escenas que en el celular duran menos */
const VO_REEL = {
  es: {
    aes: {
      consent: 'El consentimiento se firma por servicio y queda guardado con su huella.',
      slider: 'Del primer día a hoy: noventa y dos días.',
      treatment: 'Cada punto queda en el mapa, con su producto, lote, vencimiento y unidades.',
      close: 'Y al cerrar: resumen, cobro sugerido, indicaciones y próxima cita.',
    },
    perio: {
      slider: 'Hoy contra el primero: el sangrado, del cuarenta al dos.',
      risk: 'Riesgo, plan de tratamiento por pasos… y hoy, encías estables.',
      close: 'Y un reporte simple para el paciente, por WhatsApp o impreso, con su próxima cita.',
    },
  },
  en: {
    aes: {
      consent: 'Consent is signed per service and stored with its fingerprint.',
      slider: 'Day one to today: ninety-two days.',
      treatment: 'Every point stays on the map, with product, lot, expiry and units.',
      close: 'And when you close: summary, suggested billing, aftercare and next visit.',
    },
    perio: {
      slider: 'Today versus the first: bleeding, forty to two.',
      risk: 'Risk and a step-by-step plan… and today, stable gums.',
      close: 'And a simple report for your patient, by WhatsApp or printed, with the next visit.',
    },
  },
};

const fmt = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;

let md = `# Guiones de narración — promos de la historia clínica

Una sección por video, con los tiempos del render actual de \`videos/promo-clinical/out/\`.

## Cómo generarlos en ElevenLabs (v3/v4)

- Pegá el bloque de cada video tal cual: **narración continua, un párrafo por escena**. Los modelos
  nuevos no respetan las etiquetas \`<break>\`; el salto de párrafo ya hace una pausa natural.
- Cada párrafo está escrito para durar lo que su escena, a unos ${CPS.es} caracteres por segundo en español y
  ${CPS.en} en inglés. Cada sección dice cuánto debería durar el audio y cuánto dura el video.
- Si el audio sale más corto o más largo que eso, ajustá **Speed** (por ejemplo 0,9 si sobra video, 1,1
  si falta) o generá párrafo por párrafo y ubicá cada uno en su "Desde" de la tabla.
- Español: voz rioplatense (los textos usan voseo, como la app). "Invoke" se dice solo, sin "IA".
`;

for (const feature of FEATURES) for (const locale of ['es', 'en']) for (const format of Object.keys(FORMATS)) {
  const tag = `${feature}-${locale}-${format}`;
  const promo = JSON.parse(readFileSync(join(BUILD, `${tag}.html`), 'utf8').match(/__PROMO=(.*?)<\/script>/)[1]);
  const vo = { ...VO[locale][feature], ...(format === 'reel' ? VO_REEL[locale][feature] : {}) };
  let at = 0;
  const rows = [];
  for (const sc of scenes(feature, format, TEXT[locale], promo.available)) {
    const dur = sc.seg ? promo.segments[sc.seg].dur : sc.dur;
    rows.push({ from: at, to: at + dur, text: vo[sc.id] });
    at += dur;
  }
  const speech = rows.reduce((n, r) => n + r.text.length / CPS[locale], 0);
  const file = `invoke-${feature}-${locale}-${format === 'reel' ? '9x16' : '16x9'}.mp4`;
  md += `\n---\n\n## ${NAMES[feature]} · ${locale === 'es' ? 'español' : 'inglés'} · ${format === 'reel' ? '9:16' : '16:9'} — \`${file}\`\n\n`;
  md += `Video: **${at.toFixed(1)} s** · audio estimado: **${speech.toFixed(1)} s**\n\n`;
  md += '| # | Desde | Hasta | Texto | Dura aprox. |\n|---|---|---|---|---|\n';
  rows.forEach((r, i) => {
    const d = r.text.length / CPS[locale];
    const warn = d > r.to - r.from + 0.8 ? ' ⚠️' : '';
    md += `| ${i + 1} | ${fmt(r.from)} | ${fmt(r.to)} | ${r.text} | ${d.toFixed(1)} s / ${(r.to - r.from).toFixed(1)} s${warn} |\n`;
  });
  md += `\n**Para pegar en ElevenLabs:**\n\n\`\`\`text\n${rows.map((r) => r.text).join('\n\n')}\n\`\`\`\n`;
}
writeFileSync(join(ROOT, 'videos', 'promo-clinical', 'out', 'guiones.md'), md);
console.log('[promo] guiones.md listo');
