/** Estado de ánimo: cambia cejas, ojos, boca y extras (burbujas, Zzz, lágrima…). */
export type MascotMood =
  | 'neutral'
  | 'happy'
  | 'thinking'
  | 'surprised'
  | 'sad'
  | 'talking'
  | 'loading'
  | 'sleepy'
  | 'sleeping';

/** Gesto corporal: brazos y cuerpo. */
export type MascotGesture = 'none' | 'wave' | 'celebrate' | 'point' | 'nod' | 'shake';

/**
 * Cómo viaja de un punto de la pantalla a otro.
 * - `hop`: saltitos cortos, cruzando la pantalla.
 * - `jump`: un salto grande en arco.
 * - `teleport`: salta, se desvanece y reaparece en el destino (ideal para cambio de página).
 * - `auto`: elige según la distancia.
 */
export type TravelAnimation = 'hop' | 'jump' | 'teleport' | 'auto';

/**
 * Fase del ciclo de vida.
 * - `active`: visible y atento.
 * - `traveling`: moviéndose.
 * - `peeking`: escondido detrás de la barra de widgets, asomándose de vez en cuando (en reposo).
 * - `sleeping`: hibernando (tras horas sin pedidos o al desactivarla).
 */
export type MascotPhase = 'active' | 'traveling' | 'peeking' | 'sleeping';

export interface Point {
  x: number;
  y: number;
}

export type DockPosition =
  | 'bottom-right'
  | 'bottom-left'
  | 'top-right'
  | 'top-left'
  | 'center-right'
  | 'center-left';

/**
 * Destino de un viaje o de un señalamiento:
 * - un punto `{x, y}` en px del viewport (centro de la mascota / punto señalado),
 * - un elemento del DOM,
 * - un selector CSS (`'#nuevo-turno'`),
 * - una posición de anclaje (`'bottom-left'`…).
 */
export type MascotTarget = Point | Element | string;

export interface SayOptions {
  /** Ánimo mientras habla. Por defecto `talking`. */
  mood?: MascotMood;
  /** Duración en ms. Por defecto se calcula según el largo del texto. */
  duration?: number;
  /** Gesto mientras habla. */
  gesture?: MascotGesture;
}

export interface PointAtOptions {
  /** Texto a decir mientras señala. */
  say?: string;
  /** Duración en ms del gesto. Por defecto 3500 (o lo que dure el texto). */
  duration?: number;
  /** Dibuja un anillo que pulsa sobre el elemento señalado. Por defecto true si el destino es un elemento. */
  highlight?: boolean;
  /** Si es true, primero viaja junto al elemento y después señala. */
  travel?: boolean | TravelAnimation;
  /**
   * Corta el señalamiento al abortarse (y libera la cola). Con `duration: Infinity`
   * sigue señalando hasta que se aborte: lo usan las guías paso a paso, que señalan
   * mientras el paso espera a la persona.
   */
  signal?: AbortSignal;
}

export interface TravelOptions {
  animation?: TravelAnimation;
  /** Multiplicador de duración (1 = normal). */
  speed?: number;
}

export type MascotActions = Omit<MascotController, 'phase' | 'mood' | 'currentGesture' | 'message' | 'enabled'>;

export interface MascotController {
  /** Estado actual (solo lectura). */
  phase: MascotPhase;
  mood: MascotMood;
  currentGesture: MascotGesture;
  message: string | null;
  enabled: boolean;

  setMood(mood: MascotMood): Promise<void>;
  gesture(gesture: Exclude<MascotGesture, 'point'>, durationMs?: number): Promise<void>;
  say(text: string, options?: SayOptions): Promise<void>;
  /** Señala un elemento o punto con la mano y lo mira con los ojos. */
  pointAt(target: MascotTarget, options?: PointAtOptions): Promise<void>;
  /** Mira un punto/elemento (o `'cursor'` para volver a seguir el puntero). */
  lookAt(target: MascotTarget | 'cursor'): void;
  /** Viaja a otro lugar de la pantalla. */
  travelTo(target: MascotTarget | DockPosition, options?: TravelOptions): Promise<void>;
  /** Se esconde detrás de la barra de widgets (MascotPeekZone) y se asoma de a ratos. */
  hide(): Promise<void>;
  /** Sale de su escondite y vuelve a su lugar. */
  show(): Promise<void>;
  /** Se duerme (hiberna). */
  sleep(): Promise<void>;
  /** Se despierta. */
  wake(): Promise<void>;
  /** Activa/desactiva. Desactivada = durmiendo y sin reaccionar. */
  setEnabled(enabled: boolean): Promise<void>;
  /**
   * Avisa que el usuario le pidió algo al asistente (reinicia los temporizadores de
   * reposo y de sueño). Las acciones say/pointAt/gesture ya lo llaman solas.
   */
  notifyRequest(): void;
}
