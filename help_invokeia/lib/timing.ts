/**
 * Presupuesto de tiempo de las demos.
 *
 * Todas las pausas del sistema viven acá para poder ajustarlas en un solo lugar
 * después de mirar los videos del piloto, en vez de repartir `waitForTimeout`
 * por los specs.
 *
 * Deliberadamente NO se usa `slowMo`: es una opción de lanzamiento que retrasa
 * cada operación del cliente, incluidos los sondeos internos de auto-waiting y
 * los reintentos de `expect`. Infla el runtime sin mejorar la legibilidad,
 * porque el clic sigue siendo instantáneo (el puntero real no se dibuja en el
 * screencast). Preferimos pausas explícitas y un cursor falso.
 */

/** 1 = ritmo de publicación · 0 = sin pausas (dry run para clavar selectores). */
export const DEMO_SPEED = Number(process.env.DEMO_SPEED ?? 1);

/** true cuando corremos como test funcional, sin grabar ni pausar. */
export const DEMO_DRY = process.env.DEMO_DRY === '1';

const s = (ms: number) => Math.round(ms * DEMO_SPEED);

export const T = {
  /**
   * Techo real del cartel de apertura y del de cierre. `Demo.intro()` lo baja al
   * cumplirse este tiempo aunque la pantalla siga cargando, así que es un máximo
   * y no un mínimo: la carga se ve en el video, no detrás de un cartel.
   */
  introCard: s(2500),
  outroCard: s(2000),

  /** Desplazamiento del cursor falso. Se solapa con la lectura del subtítulo. */
  cursorMove: s(500),

  /**
   * Reposo después de que el texto ya se leyó y el área ya está resaltada,
   * antes de ejecutar la acción. Es lo que evita que el video vaya corriendo.
   */
  dwell: s(3000),

  /** Respiro después de una acción, para ver el resultado en pantalla. */
  afterAction: s(900),

  /** Cuánto se sostiene un toast resaltado (ya incluye su propio reposo). */
  toastHold: s(2800),

  /** Micro-pausa para que el ojo aterrice en el texto antes de que se mueva el cursor. */
  beat: s(260),

  /** Retardo entre teclas al escribir en cámara. */
  keystroke: s(38),

  /** Espera real de red/spinners. NO escala con DEMO_SPEED: no es ritmo, es correctitud. */
  settle: 8_000,

  /**
   * Tiempo de lectura de un subtítulo: ~200 palabras/min más un arranque fijo,
   * acotado entre 1,2 s y 3,2 s. Al total de cada paso se le suma `dwell`.
   */
  read(text: string): number {
    const words = text.trim().split(/\s+/).length;
    return s(Math.min(3_200, Math.max(1_200, (words / 200) * 60_000 + 500)));
  },
} as const;

/**
 * Pausa de reloj. Usa el `setTimeout` de Node y no `page.waitForTimeout()`:
 * no hace ida y vuelta por CDP y no se rompe si la página está navegando.
 */
export function pause(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}
