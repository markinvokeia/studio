/**
 * Guion de la promo de la mascota: lo usan make-promo.mjs (corta los tramos de
 * video) y el escenario (stage/main.tsx, arma las escenas).
 *
 * 16:9 usa los clips de escritorio; 9:16 los de mobile (la app en un ancho de
 * teléfono, dentro de un marco de celular). Los clips se ven enteros (sin zoom) y
 * acelerados: dan la idea de cómo funciona, no cada detalle.
 *
 * Tramos: de qué grabación sale cada uno, desde/hasta qué marca (segundos), a qué
 * velocidad y (`shift`) cuántos segundos correrlo en un idioma. Las marcas y las
 * posiciones para resaltar salen de videos/promo/clips/*.json (record-clips.mjs).
 * La guía de citas termina en un horario ocupado: su aviso real es el «¡Ohhh!».
 */

export const FORMATS = {
  landscape: { width: 1920, height: 1080 },
  reel: { width: 1080, height: 1920 },
};

/** Grabación de cada fuente, por idioma. */
export const SOURCES = {
  onboarding: (l) => `videos/promo/clips/onboarding-${l}.webm`,
  screen: (l) => `videos/promo/clips/screen-${l}.webm`,
  chat: (l) => `videos/promo/clips/chat-${l}.webm`,
  guide: (l) => `videos/promo/clips/guide-${l}.webm`,
  'm-onboarding': (l) => `videos/promo/clips/m-onboarding-${l}.webm`,
  'm-screen': (l) => `videos/promo/clips/m-screen-${l}.webm`,
  'm-chat': (l) => `videos/promo/clips/m-chat-${l}.webm`,
  'm-guide': (l) => `videos/promo/clips/m-guide-${l}.webm`,
};

/**
 * Tramos. `from`/`to`: [marca, segundos] (marca null = segundo absoluto).
 * `hl`: qué resaltar y cuándo ([caja del clip, marca, segundos desde la marca]).
 */
export const SEGMENTS = {
  landscape: {
    onb: { src: 'onboarding', from: ['checklist', -0.3], to: ['guide', 5.0], speed: 1.1, hl: ['guideMe', 'guide', -1.4] },
    ops: { src: 'screen', from: ['screen', -0.3], to: ['elements', -0.2], speed: 1.1 },
    field: { src: 'screen', from: ['elements', -0.2], to: ['show', 3.2], speed: 1.05, hl: ['show', 'show', -0.9] },
    ask: { src: 'chat', from: ['typing', -0.2], to: ['sent', 0.4], speed: 1, hl: ['mic', 'typing', 0.0] },
    reply: { src: 'chat', from: ['reply', -0.4], to: ['video', -0.1], speed: 1, hl: ['watch', 'video', -1.2] },
    video: { src: 'chat', from: ['video', -0.1], to: ['video', 5.0], speed: 1 },
    guide: { src: 'guide', from: ['guide', 0.2], to: ['save', -0.6], speed: 1.3 },
    ohh: { src: 'guide', from: ['save', -0.4], to: ['save', 3.4], speed: 1 },
  },
  // En el celular se muestra un tramo más corto de cada cosa, a velocidad casi normal.
  reel: {
    onb: { src: 'm-onboarding', from: ['checklist', -0.2], to: ['guide', 1.6], speed: 1.1, hl: ['guideMe', 'guide', -1.0] },
    ops: { src: 'm-screen', from: ['screen', -0.2], to: ['group', 1.6], speed: 1.15 },
    field: { src: 'm-screen', from: ['show', -0.9], to: ['show', 1.8], speed: 1, hl: ['show', 'show', -0.8] },
    ask: { src: 'm-chat', from: ['typing', -0.1], to: ['sent', 0.2], speed: 1.15, hl: ['mic', 'typing', 0.0] },
    reply: { src: 'm-chat', from: ['reply', -0.3], to: ['video', -0.6], speed: 1.1, hl: ['watch', 'video', -1.1] },
    video: { src: 'm-chat', from: ['video', -0.1], to: ['video', 2.6], speed: 1 },
    guide: { src: 'm-guide', from: ['guide', 3.0], to: ['save', -0.8], speed: 1.5 },
    ohh: { src: 'm-guide', from: ['save', -0.2], to: ['save', 2.2], speed: 1 },
  },
};

/** Textos. */
export const TEXT = {
  es: {
    powered: 'Powered by Invoke IA',
    site: 'www.invokeia.com',
    hook: { title: 'Lo que vas a ver no es un video hecho con IA.', sub: 'Es Invoke IA, funcionando de verdad.' },
    hookBadge: 'Grabación real del sistema',
    intro: { title: '¡Hola! Soy el asistente de Invoke IA', sub: 'Vivo dentro de tu sistema y estoy para ayudarte.' },
    introSay: ['¿Hay alguien ahí?', '¡Hola! Soy yo, tu asistente.', 'Pensando en cómo ayudarte…', '¡Vamos!'],
    onb: { title: '¿Recién llegás?', sub: 'Te guío para dejar tu clínica lista, paso a paso.' },
    onbSay: 'Te armo la lista de lo que falta y te llevo a cada paso.',
    ops: { title: 'Todo lo que podés hacer, en una sola página', sub: 'Cada pantalla con sus guías y sus videos.' },
    opsSay: 'Acá están todas las operaciones de esta pantalla.',
    field: { title: '¿Dónde estaba ese campo?', sub: 'Te llevo directo y te explico para qué sirve.' },
    fieldSay: '¡Ahí está! Te lo marco.',
    ask: { title: 'Preguntame como a un compañero', sub: 'Con tu voz o por escrito, con tus palabras.' },
    askSay: 'Te escucho…',
    dictating: 'Dictando…',
    transcribed: 'Transcripto',
    question: '¿Cómo le agendo una cita a Carlos Delgado?',
    replySay: '¡Listo! Ya sé qué necesitás.',
    video: { title: '¿Preferís verlo?', sub: 'Hay un video de cada paso, desde cualquier lado.' },
    videoSay: '¡Mirá! En un minuto lo ves.',
    guide: { title: 'O te llevo de la mano', sub: 'Te voy guiando y vos solo confirmás.' },
    guideSay: 'Carlos Delgado, el servicio, el profesional…',
    ohh: { title: '¿Algo no está bien?', sub: 'Te aviso en el momento.' },
    ohhSay: '¡Ohhh! Ese horario está ocupado.',
    save: { title: 'Y guardás vos', sub: 'Nunca guardo sin que lo confirmes.' },
    saveSay: 'Revisá y guardá. ¡Listo!',
    outro: { title: 'En Invoke hay IA…', sub: '…y detrás, personas reales que te ayudan.' },
    outroSay: 'Y si algo no lo sé, te paso con el equipo.',
    support: { who: 'Equipo de soporte de Invoke', msg: '¡Hola! Ya vimos tu consulta, te ayudamos ahora.' },
    end: { brand: 'Seré tu asistente en Invoke IA', tag: 'IA que te guía. Personas que te acompañan.' },
    poster: { kicker: 'Conocé a', title: 'tu asistente de Invoke IA', sub: 'Onboarding guiado · Voz o texto · Videos · Paso a paso' },
  },
  en: {
    powered: 'Powered by Invoke IA',
    site: 'www.invokeia.com',
    hook: { title: "What you're about to see isn't an AI-generated video.", sub: "It's Invoke IA, working for real." },
    hookBadge: 'Real screen recording',
    intro: { title: "Hi! I'm the Invoke IA assistant", sub: 'I live inside your system and I’m here to help.' },
    introSay: ['Anybody there?', "Hi! It's me, your assistant.", 'Thinking how to help you…', "Let's go!"],
    onb: { title: 'New here?', sub: 'I guide you until your clinic is ready, step by step.' },
    onbSay: "I list what's left and take you to each step.",
    ops: { title: 'Everything you can do, on one page', sub: 'Every screen with its guides and videos.' },
    opsSay: 'Here are all the things you can do on this screen.',
    field: { title: 'Where was that field?', sub: 'I take you straight to it and explain what it does.' },
    fieldSay: "There it is! I'll highlight it.",
    ask: { title: 'Ask me like you’d ask a teammate', sub: 'By voice or in writing, in your own words.' },
    askSay: "I'm listening…",
    dictating: 'Dictating…',
    transcribed: 'Transcribed',
    question: 'How do I book an appointment for Carlos Delgado?',
    replySay: 'Done! I know what you need.',
    video: { title: 'Rather watch it?', sub: 'Every task has a video, from anywhere.' },
    videoSay: "Look! You'll see it in a minute.",
    guide: { title: 'Or I take you by the hand', sub: 'I guide you and you just confirm.' },
    guideSay: 'Carlos Delgado, the service, the doctor…',
    ohh: { title: 'Something off?', sub: 'I let you know right away.' },
    ohhSay: 'Ohhh! That time is taken.',
    save: { title: 'And you save it', sub: 'I never save without your OK.' },
    saveSay: 'Check it and save. Done!',
    outro: { title: 'Invoke has AI…', sub: '…and behind it, real people who help you.' },
    outroSay: "And if I don't know something, I'll hand you to the team.",
    support: { who: 'Invoke support team', msg: "Hi! We've seen your question, let's sort it out." },
    end: { brand: "I'll be your assistant at Invoke IA", tag: 'AI that guides you. People who back you up.' },
    poster: { kicker: 'Meet', title: 'your Invoke IA assistant', sub: 'Guided onboarding · Voice or text · Videos · Step by step' },
  },
};

/**
 * Escenas. `seg`: tramo de video (duración = la del tramo); si no, `dur` (s).
 * `say`: [segundo, texto, ánimo, gesto, duración]. `act`: [segundo, acción, …args] para la
 * mascota (travel a un punto con su animación, mood, gesture). Entre escena y escena la
 * mascota desaparece y vuelve con sus propios efectos (teletransporte, salto, saltitos).
 */
export function scenes(format, t) {
  if (format === 'landscape') {
    return [
      { id: 'hook', dur: 3.8, layout: 'hook', title: t.hook },
      { id: 'intro', dur: 7.6, layout: 'intro', title: t.intro },
      { id: 'onb', seg: 'onb', title: t.onb, act: [[0.0, 'travel', 'home', 'teleport']], say: [[0.7, t.onbSay, 'talking', 'none', 3.4]] },
      { id: 'ops', seg: 'ops', title: t.ops, act: [[0.0, 'travel', 'low', 'jump']], say: [[1.0, t.opsSay, 'happy', 'none', 2.4]] },
      { id: 'field', seg: 'field', title: t.field, act: [[0.0, 'travel', 'home', 'hop']], say: [[1.3, t.fieldSay, 'happy', 'nod', 1.8]] },
      { id: 'ask', seg: 'ask', title: t.ask, overlay: 'dictation', act: [[0.0, 'travel', 'low', 'teleport']], say: [[1.0, t.askSay, 'thinking', 'none', 1.6]] },
      { id: 'reply', seg: 'reply', title: t.ask, act: [[0.0, 'mood', 'loading']], say: [[0.9, t.replySay, 'happy', 'celebrate', 1.8]] },
      { id: 'video', seg: 'video', title: t.video, act: [[0.0, 'travel', 'home', 'jump']], say: [[1.0, t.videoSay, 'surprised', 'none', 2.0]] },
      { id: 'guide', seg: 'guide', title: t.guide, act: [[0.0, 'travel', 'low', 'teleport']], say: [[0.9, t.guideSay, 'talking', 'none', 3.6]] },
      { id: 'ohh', seg: 'ohh', title: t.ohh, overlay: 'error', act: [[0.0, 'travel', 'home', 'hop']], say: [[0.9, t.ohhSay, 'surprised', 'shake', 2.2]] },
      { id: 'outro', dur: 8.6, layout: 'outro', title: t.outro,
        act: [[0.0, 'travel', 'left', 'teleport'], [5.4, 'travel', 'end', 'teleport'], [6.4, 'gesture', 'celebrate']],
        say: [[0.9, t.outroSay, 'talking', 'wave', 3.6]] },
    ];
  }
  return [
    { id: 'hook', dur: 2.3, layout: 'hook', title: t.hook },
    { id: 'intro', dur: 3.2, layout: 'intro', title: t.intro },
    { id: 'onb', seg: 'onb', title: t.onb, act: [[0.0, 'travel', 'home', 'teleport']], say: [[0.6, t.onbSay, 'talking', 'none', 2.3]] },
    { id: 'ops', seg: 'ops', title: t.ops, act: [[0.0, 'travel', 'right', 'jump']], say: [[0.9, t.opsSay, 'happy', 'none', 1.6]] },
    { id: 'field', seg: 'field', title: t.field, act: [[0.0, 'travel', 'home', 'hop']], say: [[0.8, t.fieldSay, 'happy', 'nod', 1.0]] },
    { id: 'ask', seg: 'ask', title: t.ask, overlay: 'dictation', act: [[0.0, 'travel', 'right', 'teleport']], say: [[0.7, t.askSay, 'thinking', 'none', 0.8]] },
    { id: 'reply', seg: 'reply', title: t.ask, act: [[0.0, 'mood', 'loading']], say: [[0.6, t.replySay, 'happy', 'celebrate', 1.5]] },
    { id: 'video', seg: 'video', title: t.video, act: [[0.0, 'travel', 'home', 'jump']], say: [[0.8, t.videoSay, 'surprised', 'none', 1.1]] },
    { id: 'guide', seg: 'guide', title: t.guide, act: [[0.0, 'travel', 'right', 'teleport']], say: [[0.7, t.guideSay, 'talking', 'none', 2.6]] },
    { id: 'ohh', seg: 'ohh', title: t.ohh, overlay: 'error', act: [[0.0, 'travel', 'home', 'jump']], say: [[0.6, t.ohhSay, 'surprised', 'shake', 1.5]] },
    { id: 'outro', dur: 3.6, layout: 'outro', title: t.outro,
      act: [[0.0, 'travel', 'home', 'hop'], [2.0, 'travel', 'end', 'teleport'], [2.7, 'gesture', 'celebrate']],
      say: [[0.5, t.outroSay, 'talking', 'wave', 1.4]] },
  ];
}

/** Segundo absoluto de una marca de un clip (null = segundo absoluto). */
export function resolveTime([mark, offset], marks) {
  if (mark === null) return offset;
  if (!(mark in marks)) throw new Error(`falta la marca ${mark}`);
  return marks[mark] / 1000 + offset;
}
