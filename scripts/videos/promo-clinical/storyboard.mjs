/**
 * Guion de las promos de la historia clínica: lo usan make-promo.mjs (corta los tramos) y el
 * escenario (stage/main.tsx, arma las escenas).
 *
 * Cada escena muestra una funcionalidad: en 16:9 se suma a la lista de la izquierda cuando aparece
 * en pantalla; en 9:16, en la etiqueta de abajo del celular. 16:9 usa los clips de escritorio
 * (1920×1080); 9:16 los de mobile (780×1688).
 *
 * Tramos: [marca, segundos desde la marca] de record-clips.mjs. Una lista de candidatos
 * ([[marca, s], [marca, s]]) usa la primera marca que exista en el clip (los pasos opcionales).
 */

export const FEATURES = ['odo', 'aes', 'perio'];

export const FORMATS = {
  landscape: { width: 1920, height: 1080 },
  reel: { width: 1080, height: 1920 },
};

/** Tramos por promo (los mismos en los dos formatos; las marcas salen de cada clip). */
const SEGS = {
  odo: {
    unified: { src: 'odo', from: ['timeline', 0.2], to: ['scrolled', 0.2], speed: 1.15 },
    previews: { src: 'odo', from: ['filter', -0.2], to: ['viewer', -0.4], speed: 1.15 },
    today: { src: 'odo', from: ['viewer', -0.1], to: ['prev1', -0.1], speed: 1 },
    back: { src: 'odo', from: ['prev1', -0.1], to: ['next1', -0.1], speed: 1 },
    forward: { src: 'odo', from: ['next1', -0.1], to: ['next2', 1.8], speed: 1 },
    dentition: { src: 'odo', from: ['next2', 1.8], to: ['arch', -0.2], speed: 1.05 },
    arch: { src: 'odo', from: ['arch', -0.2], to: ['history', -0.2], speed: 1 },
    history: { src: 'odo', from: ['history', -0.2], to: ['edit', -1.0], speed: 1.05 },
    dictation: { src: 'odo', from: ['edit', -0.3], to: ['proposed', -0.1], speed: 1.05 },
    proposals: { src: 'odo', from: ['proposed', -0.1], to: ['proposed', 4.0], speed: 1 },
    catalog: { src: 'odo', from: ['proposed', 4.0], to: ['end', 0], speed: 1 },
  },
  aes: {
    unified: { src: 'aes', from: ['filter', -0.4], to: [['list', 0.8], ['open', -0.4]], speed: 1.1 },
    consent: { src: 'aes', from: ['consent', -0.1], to: ['photos', -0.1], speed: 1.05 },
    photos: { src: 'aes', from: ['photos', -0.1], to: ['initial', 0], speed: 1.1 },
    slider: { src: 'aes', from: ['initial', 0.1], to: ['slid', 0.2], speed: 1 },
    marks: { src: 'aes', from: ['slid', 0.2], to: [['h2', -0.1], ['side', -0.1]], speed: 1 },
    sessions: { src: 'aes', from: [['h2', -0.1], ['side', -0.1]], to: ['side', -0.1], speed: 1 },
    modes: { src: 'aes', from: ['side', -0.1], to: ['treatment', -0.1], speed: 1.05 },
    treatment: { src: 'aes', from: ['treatment', -0.1], to: ['close', -0.1], speed: 1.1 },
    close: { src: 'aes', from: ['close', -0.1], to: ['end', 0], speed: 1.1 },
  },
  perio: {
    unified: { src: 'perio', from: ['filter', -0.4], to: ['filtered', 2.2], speed: 1.05 },
    screening: { src: 'perio', from: ['filtered', 2.2], to: ['open', -0.1], speed: 1.05 },
    probe: { src: 'perio', from: ['probe', -0.1], to: [['passMg', -0.1], ['guide', -2]], speed: 1 },
    passes: { src: 'perio', from: [['passMg', -0.1], ['guide', -2]], to: [['guide', -1.5], ['voice', -4]], speed: 1 },
    guide: { src: 'perio', from: [['guide', -1.6], ['voice', -4]], to: [['voice', -3.8], ['evolution', -0.1]], speed: 1 },
    voice: { src: 'perio', from: [['voice', -3.8], ['evolution', -2]], to: ['evolution', -0.1], speed: 1 },
    slider: { src: 'perio', from: ['slide', -0.6], to: ['slid', 0.3], speed: 1 },
    overlay: { src: 'perio', from: ['overlay', -0.1], to: ['changes', -0.1], speed: 1 },
    changes: { src: 'perio', from: ['changes', -0.1], to: ['map', -0.3], speed: 1 },
    map: { src: 'perio', from: ['map', -0.3], to: ['play', -0.6], speed: 1 },
    play: { src: 'perio', from: ['play', -0.1], to: [['reeval', -0.1], ['trends', -0.1]], speed: 1.05 },
    trends: { src: 'perio', from: [['reeval', -0.1], ['trends', -0.1]], to: ['diagnosis', -0.1], speed: 1 },
    diagnosis: { src: 'perio', from: ['diagnosis', -0.1], to: ['diagnosis', 3.2], speed: 1 },
    risk: { src: 'perio', from: ['diagnosis', 3.2], to: [['risk', 0.4], ['diagnosis', 7]], speed: 1 },
    close: { src: 'perio', from: ['close', -0.1], to: ['end', 0], speed: 1.1 },
  },
};
export const SEGMENTS = Object.fromEntries(Object.entries(SEGS).map(([f, s]) => [f, { landscape: s, reel: s }]));

/** Fondo y colores de cada promo */
export const THEMES = {
  odo: { photo: 'bg-odo.jpg', bg: ['#03121f', '#0a2c44'], accent: '#22d3ee', accent2: '#60a5fa' },
  aes: { photo: 'bg-aes.jpg', bg: ['#16050f', '#3a0d2b'], accent: '#f472b6', accent2: '#c084fc' },
  perio: { photo: 'bg-perio.jpg', bg: ['#14040a', '#3a0b17'], accent: '#fb7185', accent2: '#2dd4bf' },
};

/** Miniatura: [escena, segundo dentro de la escena] */
export const THUMB = {
  odo: { landscape: ['proposals', 2.5], reel: ['proposals', 2.5] },
  aes: { landscape: ['slider', 3.5], reel: ['slider', 3.5] },
  perio: { landscape: ['slider', 3.5], reel: ['slider', 3.5] },
};

export const TEXT = {
  es: {
    real: 'Grabación real del sistema',
    pills: ['Historia clínica unificada', 'Odontograma', 'Estética', 'Periodoncia'],
    odo: {
      name: 'Odontograma',
      hook: { title: 'Cada diente.\nCada sesión.', sub: 'El odontograma de Invoke IA, dentro de la historia clínica unificada.' },
      outro: 'La boca de tu paciente, sesión a sesión.',
      scenes: {
        unified: ['Historia clínica unificada', 'Citas, sesiones, odontogramas, estética y periodoncia en una misma línea de tiempo.'],
        previews: ['Vista previa de cada sesión', 'Filtrás por tipo y ves la boca sin abrir nada.'],
        today: ['Un odontograma por sesión', 'Lo realizado hoy queda en verde; lo indicado, en rojo.'],
        back: ['Compará con el diagnóstico', 'Con las flechas volvés a cualquier sesión anterior.'],
        forward: ['Lo indicado, resuelto', 'Sesión a sesión, cada hallazgo pasa a tratamiento hecho.'],
        dentition: ['Permanente, mixta y temporal', 'La numeración correcta para adultos y niños.'],
        arch: ['Vista de arcada', 'Maxilar y mandíbula, como los ve el paciente.'],
        history: ['Historial de sesiones', 'Toda la evolución en una tira, con su fecha.'],
        dictation: ['Dictado de hallazgos', 'Por voz o por escrito, como se lo dirías a tu asistente.'],
        proposals: ['Invoke propone, vos confirmás', 'Cada cambio marcado sobre la pieza, antes de guardarlo.'],
        catalog: ['Catálogo de tratamientos', 'Restauración, endodoncia, prótesis, implantes, cirugía y más; con cobro rápido y presupuesto.'],
      },
      callouts: {
        today: ['Hecho hoy · 09/11', 'Corona en <em>37</em>'],
        back: ['Diagnóstico · 14/07', '<em>8</em> indicados'],
        forward: ['Julio → noviembre', '<em>8 → 0</em> pendientes'],
        proposals: ['Dictado', '<em>4</em> cambios propuestos'],
      },
    },
    aes: {
      name: 'Estética',
      hook: { title: 'Antes y después,\nen segundos.', sub: 'La ficha estética de Invoke IA, dentro de la historia clínica unificada.' },
      outro: 'Cada tratamiento, con su antes y después.',
      scenes: {
        unified: ['Historia clínica unificada', 'Cada sesión estética con su mapa facial, sus servicios y su estado.'],
        consent: ['Consentimiento informado firmado', 'Por servicio, con la firma del paciente y su huella digital.'],
        photos: ['Fotos guiadas', 'Frontal y perfiles, con cámara, desde el celular o subidas.'],
        slider: ['Antes y después', 'Deslizá entre el primer día y hoy, alineados.'],
        marks: ['Marcas sobre la foto', 'Dónde se aplicó cada punto, sobre la foto de antes.'],
        sessions: ['Contra cualquier sesión', 'Una semana, un mes, tres meses: elegís con cuál comparar.'],
        modes: ['Lado a lado y superpuestas', 'Tres formas de comparar para mostrársela al paciente.'],
        treatment: ['Mapa de tratamiento', 'Puntos, áreas y líneas; producto, lote, vencimiento y unidades.'],
        close: ['Cierre de la sesión', 'Resumen, cobro sugerido, indicaciones y próxima cita.'],
      },
      callouts: {
        slider: ['09/08 → 09/11', '<em>92</em> días'],
        treatment: ['Toxina botulínica', '<em>18 U</em> · 12 puntos'],
        modes: ['Evolución', '<em>4</em> sesiones'],
      },
    },
    perio: {
      name: 'Periodoncia',
      hook: { title: 'Encías que mejoran,\nmedidas.', sub: 'El periodontograma de Invoke IA, dentro de la historia clínica unificada.' },
      outro: 'La salud de las encías, en números claros.',
      scenes: {
        unified: ['Historia clínica unificada', 'Cada periodontograma con sus curvas y su diagnóstico.'],
        screening: ['Cribado PSR/BPE', 'Un código por sextante cuando no hace falta el sondaje completo.'],
        probe: ['Sondaje de 6 sitios por diente', 'Margen y fondo de bolsa se dibujan mientras se carga.'],
        passes: ['Tres pasadas', 'Profundidad y sangrado, margen gingival, furcas y movilidad.'],
        guide: ['El examen anterior como guía', 'Sus valores al lado de cada sitio, para cargar más rápido.'],
        voice: ['Dictado por voz', 'Sondeás con las dos manos y dictás: «38 lingual 3 2 4, sangra distal».'],
        slider: ['Hoy contra el primer examen', 'Deslizá entre mayo y hoy: las bolsas se achican.'],
        overlay: ['Superponé los exámenes', 'Verde donde se ganó inserción; rojo donde se perdió.'],
        changes: ['Cambios sitio por sitio', 'Cada profundidad coloreada según cuánto cambió.'],
        map: ['Mapa oclusal', 'Toda la boca de un vistazo, diente por diente.'],
        play: ['Evolución animada', 'Del diagnóstico a hoy, examen por examen.'],
        trends: ['Tendencias', 'Sangrado, placa, bolsas, PS y NIC en todas las sesiones.'],
        diagnosis: ['Diagnóstico 2017', 'Estadio, grado y extensión, con el porqué de cada uno.'],
        risk: ['Riesgo y plan de tratamiento', 'Hexágono de Lang y Tonetti y plan por pasos de la EFP.'],
        close: ['Reporte para el paciente', 'Por WhatsApp o impreso; con cobro y próxima cita.'],
      },
      callouts: {
        slider: ['Sangrado al sondaje', '40% → <em>2%</em>'],
        overlay: ['Bolsas de 5 mm o más', '55 → <em>0</em>'],
        trends: ['Placa', '53% → <em>16%</em>'],
        risk: ['Hoy', '<em>Estable</em>'],
      },
    },
  },
  en: {
    real: 'Real screen recording',
    pills: ['Unified clinical record', 'Odontogram', 'Aesthetics', 'Periodontics'],
    odo: {
      name: 'Odontogram',
      hook: { title: 'Every tooth.\nEvery visit.', sub: 'The Invoke IA odontogram, inside the unified clinical record.' },
      outro: "Your patient's mouth, visit by visit.",
      scenes: {
        unified: ['Unified clinical record', 'Appointments, sessions, odontograms, aesthetics and periodontics on one timeline.'],
        previews: ['Every session, previewed', 'Filter by type and see the mouth without opening anything.'],
        today: ['One odontogram per visit', "Today's work shows in green; findings in red."],
        back: ['Compare with the diagnosis', 'Step back to any earlier visit with the arrows.'],
        forward: ['Findings, resolved', 'Visit by visit, every finding becomes completed work.'],
        dentition: ['Permanent, mixed and primary', 'The right numbering for adults and children.'],
        arch: ['Arch view', 'Upper and lower jaw, the way the patient sees them.'],
        history: ['Visit history', 'The whole story in one strip, with its dates.'],
        dictation: ['Findings by dictation', "By voice or typed, the way you'd tell your assistant."],
        proposals: ['Invoke proposes, you confirm', 'Every change marked on the tooth before it is saved.'],
        catalog: ['Treatment catalog', 'Restorations, root canals, prosthetics, implants, surgery and more; with quick billing and quotes.'],
      },
      callouts: {
        today: ['Done today · 11/09', 'Crown on <em>37</em>'],
        back: ['Diagnosis · 07/14', '<em>8</em> findings'],
        forward: ['July → November', '<em>8 → 0</em> pending'],
        proposals: ['Dictation', '<em>4</em> proposed changes'],
      },
    },
    aes: {
      name: 'Aesthetics',
      hook: { title: 'Before and after,\nin seconds.', sub: 'The Invoke IA aesthetic record, inside the unified clinical record.' },
      outro: 'Every treatment, with its before and after.',
      scenes: {
        unified: ['Unified clinical record', 'Every aesthetic session with its face map, services and status.'],
        consent: ['Signed informed consent', "Per service, with the patient's signature and fingerprint hash."],
        photos: ['Guided photos', 'Front and profiles, by camera, from a phone or uploaded.'],
        slider: ['Before and after', 'Slide between day one and today, aligned.'],
        marks: ['Marks on the photo', 'Where every point went, over the before photo.'],
        sessions: ['Against any session', 'One week, one month, three months: you choose.'],
        modes: ['Side by side and overlaid', 'Three ways to compare, ready to show your patient.'],
        treatment: ['Treatment map', 'Points, areas and lines; product, lot, expiry and units.'],
        close: ['Closing the session', 'Summary, suggested billing, aftercare and next visit.'],
      },
      callouts: {
        slider: ['08/09 → 11/09', '<em>92</em> days'],
        treatment: ['Botulinum toxin', '<em>18 U</em> · 12 points'],
        modes: ['Progress', '<em>4</em> sessions'],
      },
    },
    perio: {
      name: 'Periodontics',
      hook: { title: 'Healthier gums,\nmeasured.', sub: 'The Invoke IA periodontal chart, inside the unified clinical record.' },
      outro: 'Gum health, in clear numbers.',
      scenes: {
        unified: ['Unified clinical record', 'Every periodontal chart with its curves and its diagnosis.'],
        screening: ['PSR/BPE screening', 'One code per sextant when a full chart is not needed.'],
        probe: ['Six sites per tooth', 'Gingival margin and pocket depth are drawn as you enter them.'],
        passes: ['Three passes', 'Depth and bleeding, gingival margin, furcation and mobility.'],
        guide: ['Previous exam as a guide', 'Its values next to every site, for faster entry.'],
        voice: ['Voice dictation', 'Probe with both hands and dictate: "38 lingual 3 2 4, bleeds distal".'],
        slider: ['Today versus the first exam', 'Slide between May and today: pockets shrink.'],
        overlay: ['Overlay the exams', 'Green where attachment was gained; red where it was lost.'],
        changes: ['Site-by-site changes', 'Every depth colored by how much it changed.'],
        map: ['Occlusal map', 'The whole mouth at a glance, tooth by tooth.'],
        play: ['Animated progress', 'From diagnosis to today, exam by exam.'],
        trends: ['Trends', 'Bleeding, plaque, pockets, PD and CAL across all visits.'],
        diagnosis: ['2017 diagnosis', 'Stage, grade and extent, with the reason for each.'],
        risk: ['Risk and treatment plan', 'Lang & Tonetti hexagon and the EFP step-by-step plan.'],
        close: ['Patient report', 'By WhatsApp or printed; with billing and next visit.'],
      },
      callouts: {
        slider: ['Bleeding on probing', '40% → <em>2%</em>'],
        overlay: ['Pockets of 5 mm or more', '55 → <em>0</em>'],
        trends: ['Plaque', '53% → <em>16%</em>'],
        risk: ['Today', '<em>Stable</em>'],
      },
    },
  },
};

/** Orden de las escenas de cada promo (el mismo en los dos formatos) */
const ORDER = {
  odo: ['unified', 'previews', 'today', 'back', 'forward', 'dentition', 'arch', 'history', 'dictation', 'proposals', 'catalog'],
  aes: ['unified', 'consent', 'photos', 'slider', 'marks', 'sessions', 'modes', 'treatment', 'close'],
  perio: ['unified', 'screening', 'probe', 'passes', 'guide', 'voice', 'slider', 'overlay', 'changes', 'map', 'play', 'trends', 'diagnosis', 'risk', 'close'],
};
/** Escenas que siguen mostrando la misma funcionalidad que la anterior (no suman a la lista) */
const SAME_FEATURE = { odo: { forward: 'back' } };

/**
 * Escenas. `seg`: tramo; `feature`: índice en la lista de funcionalidades; `callouts`: tarjetas
 * con un dato. `available`: los tramos que se pudieron cortar (los pasos opcionales pueden faltar).
 */
export function scenes(feature, format, t, available) {
  const reel = format === 'reel';
  const x = t[feature];
  const list = ORDER[feature].filter((id) => !available || available.includes(id));
  const features = [];
  const out = [{ id: 'hook', dur: reel ? 3.6 : 4.0, layout: 'hook' }];
  for (const id of list) {
    const same = SAME_FEATURE[feature]?.[id];
    if (!same || !list.includes(same)) features.push(id);
    const [title, sub] = x.scenes[id];
    const call = x.callouts[id];
    out.push({
      id, seg: id, title: { title, sub },
      feature: features.indexOf(same && list.includes(same) ? same : id),
      callouts: call ? [{ t: 0.9, dur: 3.0, kicker: call[0], big: call[1] }] : undefined,
    });
  }
  out.push({ id: 'outro', dur: reel ? 4.0 : 4.4, layout: 'outro' });
  return out;
}

/** Nombres de la lista de funcionalidades de una promo, en el orden en que aparecen */
export function featureList(feature, t, available) {
  const list = ORDER[feature].filter((id) => !available || available.includes(id));
  return list.filter((id) => { const same = SAME_FEATURE[feature]?.[id]; return !same || !list.includes(same); }).map((id) => t[feature].scenes[id][0]);
}

/** Segundo absoluto de una marca (o de la primera de una lista de candidatas que exista). */
export function resolveTime(ref, marks) {
  const candidates = Array.isArray(ref[0]) ? ref : [ref];
  for (const [mark, offset] of candidates) {
    if (mark === null) return offset;
    if (mark in marks) return marks[mark] / 1000 + offset;
  }
  throw new Error(`falta la marca ${candidates.map((c) => c[0]).join(' / ')}`);
}
