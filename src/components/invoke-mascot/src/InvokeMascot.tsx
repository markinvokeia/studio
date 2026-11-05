'use client';
import * as React from 'react';
import type { MascotGesture, MascotMood, Point } from './types';
import { ensureMascotStyles } from './styles';

export interface InvokeMascotProps {
  /** Tamaño en px (ancho = alto). Por defecto 120. */
  size?: number;
  mood?: MascotMood;
  gesture?: MascotGesture;
  /**
   * Ángulo en grados hacia donde señala cuando `gesture="point"`
   * (0 = derecha, 90 = abajo, -90 = arriba, 180 = izquierda).
   */
  pointAngle?: number | null;
  /** Dirección de la mirada, vector con x,y entre -1 y 1. */
  look?: Point;
  /** Parpadeo automático. Por defecto true. */
  autoBlink?: boolean;
  /** Animación de reposo (flotar). Por defecto true. */
  animated?: boolean;
  /** Etiqueta accesible. */
  title?: string;
  className?: string;
  style?: React.CSSProperties;
}

const SHOULDER_R = { x: 182, y: 124 };
const SHOULDER_L = { x: 58, y: 124 };
/** Ángulo de reposo de cada brazo (del hombro a la mano), en grados de pantalla. */
const BASE_R = 60.6;
const BASE_L = 119.4;

const BODY_PATH =
  'M187.7 118.0 C184.9 122.7 180.0 126.3 177.7 130.3 C175.4 134.3 174.4 137.4 173.9 142.0 C173.4 146.6 175.2 152.3 174.8 157.8 C174.3 163.3 173.9 170.4 171.2 174.8 C168.4 179.3 163.3 183.0 158.2 184.2 C153.2 185.5 146.3 183.7 140.9 182.4 C135.6 181.1 130.7 177.6 126.2 176.7 C121.7 175.7 118.3 175.7 113.8 176.7 C109.3 177.6 104.4 181.1 99.1 182.4 C93.7 183.7 86.8 185.5 81.8 184.2 C76.7 183.0 71.6 179.3 68.8 174.8 C66.1 170.4 65.7 163.3 65.2 157.8 C64.8 152.3 66.6 146.6 66.1 142.0 C65.6 137.4 64.6 134.3 62.3 130.3 C60.0 126.3 55.1 122.7 52.3 118.0 C49.4 113.3 45.5 107.3 45.2 102.1 C44.8 96.9 46.8 90.9 50.1 86.9 C53.5 82.9 60.2 80.3 65.2 78.2 C70.3 76.1 76.3 76.0 80.5 74.1 C84.7 72.3 87.4 70.3 90.5 66.9 C93.6 63.5 95.5 57.8 99.1 53.6 C102.7 49.4 107.2 43.9 112.0 41.9 C116.8 40.0 123.2 40.0 128.0 41.9 C132.8 43.9 137.3 49.4 140.9 53.6 C144.5 57.8 146.4 63.5 149.5 66.9 C152.6 70.3 155.3 72.3 159.5 74.1 C163.7 76.0 169.7 76.1 174.8 78.2 C179.8 80.3 186.5 82.9 189.9 86.9 C193.2 90.9 195.2 96.9 194.8 102.1 C194.5 107.3 190.6 113.3 187.7 118.0 Z';

const INK = '#2A0B26';
const PUPIL = '#1B0718';
const HEADSET = '#1E1630';

const BROWS: Record<MascotMood, string> = {
  neutral: 'M95 91 Q103 86 111 90 M129 90 Q137 86 145 91',
  talking: 'M95 90 Q103 85 111 89 M129 89 Q137 85 145 90',
  loading: 'M95 91 Q103 86 111 90 M129 90 Q137 86 145 91',
  happy: 'M95 86 Q103 81 111 85 M129 85 Q137 81 145 86',
  thinking: 'M95 92 Q103 92 111 92 M129 87 Q137 82 145 87',
  surprised: 'M94 82 Q103 76 112 81 M128 81 Q137 76 146 82',
  sad: 'M95 91 Q104 89 111 84 M129 84 Q136 89 145 91',
  sleepy: 'M95 93 Q103 91 111 93 M129 93 Q137 91 145 93',
  sleeping: 'M95 94 Q103 92 111 94 M129 94 Q137 92 145 94',
};

interface EyeShape {
  cy: number;
  rx: number;
  ry: number;
  pr: number;
}
const EYES: Partial<Record<MascotMood, EyeShape>> = {
  neutral: { cy: 109, rx: 11, ry: 13, pr: 7 },
  talking: { cy: 109, rx: 11, ry: 13, pr: 7 },
  loading: { cy: 109, rx: 11, ry: 13, pr: 6.5 },
  thinking: { cy: 109, rx: 11, ry: 13, pr: 6.5 },
  surprised: { cy: 106, rx: 12, ry: 15, pr: 5 },
  sad: { cy: 110, rx: 10.5, ry: 12, pr: 6.5 },
  sleepy: { cy: 112, rx: 11, ry: 6, pr: 4.5 },
};

function norm(a: number): number {
  let x = a;
  while (x > 180) x -= 360;
  while (x <= -180) x += 360;
  return x;
}

/** Rotación (grados) de cada brazo según el gesto. Exportado para tests. */
export function armRotations(
  gesture: MascotGesture,
  pointAngle: number | null | undefined,
): { left: number; right: number; pointing: 'left' | 'right' | null } {
  switch (gesture) {
    case 'wave':
      return { left: 0, right: norm(-62 - BASE_R), pointing: null };
    case 'celebrate':
      return { left: norm(-115 - BASE_L), right: norm(-65 - BASE_R), pointing: null };
    case 'point': {
      const a = norm(pointAngle ?? -30);
      if (Math.cos((a * Math.PI) / 180) >= 0) {
        return { left: 0, right: norm(a - BASE_R), pointing: 'right' };
      }
      const aL = a < 0 ? a + 360 : a; // 90..270
      return { left: aL - BASE_L, right: 0, pointing: 'left' };
    }
    default:
      return { left: 0, right: 0, pointing: null };
  }
}

function useStableId(): string {
  // useId existe desde React 18; en 17 se usa un contador.
  const anyReact = React as unknown as { useId?: () => string };
  const fallback = React.useRef<string>();
  if (anyReact.useId) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return 'ivm' + anyReact.useId().replace(/[^a-zA-Z0-9]/g, '');
  }
  if (!fallback.current) fallback.current = 'ivm' + Math.random().toString(36).slice(2, 8);
  return fallback.current;
}

/** Parpadeo con intervalos aleatorios (a veces doble), como una persona. */
export function useBlink(enabled: boolean): boolean {
  const [blink, setBlink] = React.useState(false);
  React.useEffect(() => {
    if (!enabled) {
      setBlink(false);
      return;
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    let alive = true;
    const once = (delay: number) =>
      timers.push(
        setTimeout(() => {
          if (!alive) return;
          setBlink(true);
          timers.push(setTimeout(() => alive && setBlink(false), 130));
        }, delay),
      );
    const loop = () => {
      const next = 2200 + Math.random() * 4200;
      timers.push(
        setTimeout(() => {
          if (!alive) return;
          once(0);
          if (Math.random() < 0.25) once(260);
          loop();
        }, next),
      );
    };
    loop();
    return () => {
      alive = false;
      timers.forEach(clearTimeout);
    };
  }, [enabled]);
  return blink;
}

function star(cx: number, cy: number, r: number): string {
  const k = r * 0.28;
  return `M${cx} ${cy - r} Q${cx + k} ${cy - k} ${cx + r} ${cy} Q${cx + k} ${cy + k} ${cx} ${cy + r} Q${cx - k} ${cy + k} ${cx - r} ${cy} Q${cx - k} ${cy - k} ${cx} ${cy - r} Z`;
}

/**
 * La mascota de Invoke (versión "Recepción"): cuerpo con la flor de 5 pétalos del logo,
 * auriculares con micrófono, guantes, zapatillas y un diente en la panza.
 * Componente puramente visual: el comportamiento lo maneja <MascotProvider>.
 */
export function InvokeMascot({
  size = 120,
  mood = 'neutral',
  gesture = 'none',
  pointAngle = null,
  look = { x: 0, y: 0 },
  autoBlink = true,
  animated = true,
  title = 'Asistente de Invoke',
  className,
  style,
}: InvokeMascotProps) {
  if (typeof document !== 'undefined') ensureMascotStyles();
  const id = useStableId();
  const eyesClosed = mood === 'sleeping' || mood === 'happy';
  const blink = useBlink(autoBlink && !eyesClosed);
  const arms = armRotations(gesture, pointAngle);

  // Mirada: algunos ánimos fijan la mirada.
  const eye = EYES[mood] ?? EYES.neutral!;
  const maxOff = Math.max(1.5, Math.min(eye.rx, eye.ry) - eye.pr - 1);
  let lx = look.x;
  let ly = look.y;
  if (mood === 'thinking' && gesture !== 'point') {
    lx = 0.75;
    ly = -0.85;
  } else if (mood === 'sad') {
    lx = look.x * 0.4;
    ly = 0.75;
  } else if (mood === 'sleepy') {
    lx = 0;
    ly = 0.6;
  }
  const len = Math.hypot(lx, ly);
  if (len > 1) {
    lx /= len;
    ly /= len;
  }
  const pupilT = `translate(${(lx * maxOff).toFixed(2)}px, ${(ly * maxOff * 0.9).toFixed(2)}px)`;

  const cls = [
    'ivm-svg',
    `ivm-mood-${mood}`,
    `ivm-gesture-${gesture}`,
    animated ? 'ivm-anim' : '',
    blink ? 'ivm-blinking' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  const openEyes = (
    <g className="ivm-eyes-open">
      <ellipse cx="103" cy={eye.cy} rx={eye.rx} ry={eye.ry} fill="#FFFFFF" />
      <ellipse cx="137" cy={eye.cy} rx={eye.rx} ry={eye.ry} fill="#FFFFFF" />
      <g className="ivm-pupils" style={{ transform: pupilT }}>
        <g className="ivm-pupils-anim">
          <circle cx="103" cy={eye.cy + 1} r={eye.pr} fill={PUPIL} />
          <circle cx="137" cy={eye.cy + 1} r={eye.pr} fill={PUPIL} />
          <circle cx="100.5" cy={eye.cy - 2.5} r={Math.min(2.4, eye.pr * 0.4)} fill="#FFFFFF" />
          <circle cx="134.5" cy={eye.cy - 2.5} r={Math.min(2.4, eye.pr * 0.4)} fill="#FFFFFF" />
        </g>
      </g>
    </g>
  );

  let eyes: React.ReactNode = openEyes;
  if (mood === 'happy') {
    eyes = (
      <path d="M93 112 Q103 99 113 112 M127 112 Q137 99 147 112" fill="none" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" />
    );
  } else if (mood === 'sleeping') {
    eyes = (
      <path d="M93 109 Q103 117 113 109 M127 109 Q137 117 147 109" fill="none" stroke="#FFFFFF" strokeWidth="4.5" strokeLinecap="round" />
    );
  }

  let mouth: React.ReactNode;
  switch (mood) {
    case 'happy':
      mouth = <path d="M105 124 Q120 146 135 124 Q120 130 105 124 Z" fill="#FFFFFF" />;
      break;
    case 'thinking':
      mouth = <path d="M112 133 Q120 131 128 134" fill="none" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" />;
      break;
    case 'surprised':
      mouth = <ellipse cx="120" cy="133" rx="6" ry="7.5" fill={PUPIL} stroke="#FFFFFF" strokeWidth="3.5" />;
      break;
    case 'sad':
      mouth = <path d="M110 137 Q120 128 130 137" fill="none" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" />;
      break;
    case 'talking':
      mouth = (
        <g className="ivm-mouth-talk">
          <path d="M108 126 Q120 145 132 126 Q120 130 108 126 Z" fill="#FFFFFF" />
        </g>
      );
      break;
    case 'loading':
      mouth = <path d="M113 132 L127 132" fill="none" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" />;
      break;
    case 'sleepy':
      mouth = <ellipse cx="120" cy="134" rx="7" ry="10" fill={PUPIL} stroke="#FFFFFF" strokeWidth="3" />;
      break;
    case 'sleeping':
      mouth = <ellipse cx="120" cy="133" rx="3.5" ry="2.8" fill="#FFFFFF" />;
      break;
    default:
      mouth = <path d="M108 127 Q120 143 132 127 Q120 131 108 127 Z" fill="#FFFFFF" />;
  }

  const showCheeks = mood === 'happy' || mood === 'neutral' || mood === 'talking';

  return (
    <svg
      className={cls}
      width={size}
      height={size}
      viewBox="0 0 240 240"
      role="img"
      aria-label={title}
      style={style}
    >
      <defs>
        <clipPath id={`${id}-clip`}>
          <path d={BODY_PATH} />
        </clipPath>
        <filter id={`${id}-blur`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="16" />
        </filter>
        <radialGradient id={`${id}-core`}>
          <stop offset="0" stopColor="#3B0B33" />
          <stop offset="0.5" stopColor="#3B0B33" stopOpacity="0.8" />
          <stop offset="1" stopColor="#3B0B33" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse className="ivm-shadow" cx="120" cy="224" rx="54" ry="6" fill={INK} opacity="0.16" />

      <g className="ivm-body">
        {/* piernas y zapatillas */}
        <path d="M86 178 L86 194 M154 178 L154 194" stroke={INK} strokeWidth="6" strokeLinecap="round" />
        <path d="M68 200 Q68 190 82 190 Q98 190 98 200 Z" fill={INK} />
        <path d="M142 200 Q142 190 158 190 Q172 190 172 200 Z" fill={INK} />
        <path d="M68 200 L98 200 M142 200 L172 200" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />

        {/* brazo izquierdo */}
        <g
          className={`ivm-arm ivm-arm-l${arms.pointing === 'left' ? ' ivm-pointing' : ''}`}
          style={{ transform: `rotate(${arms.left}deg)` }}
        >
          <g className="ivm-arm-anim">
            <path d="M58 124 Q44 138 40 152" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />
            <path className="ivm-finger" d="M38 160 L33.5 170" stroke={INK} strokeWidth="8.5" strokeLinecap="round" />
            <path className="ivm-finger" d="M38 160 L33.5 170" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" />
            <circle cx="40" cy="156" r="10" fill="#FFFFFF" stroke={INK} strokeWidth="2.5" />
          </g>
        </g>
        {/* brazo derecho */}
        <g
          className={`ivm-arm ivm-arm-r${arms.pointing === 'right' ? ' ivm-pointing' : ''}`}
          style={{ transform: `rotate(${arms.right}deg)` }}
        >
          <g className="ivm-arm-anim">
            <path d="M182 124 Q196 138 200 152" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />
            <path className="ivm-finger" d="M202 160 L206.5 170" stroke={INK} strokeWidth="8.5" strokeLinecap="round" />
            <path className="ivm-finger" d="M202 160 L206.5 170" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" />
            <circle cx="200" cy="156" r="10" fill="#FFFFFF" stroke={INK} strokeWidth="2.5" />
          </g>
        </g>

        {/* cuerpo: flor de 5 pétalos con el gradiente del logo */}
        <g className="ivm-fill">
          <g clipPath={`url(#${id}-clip)`}>
            <rect x="40" y="36" width="160" height="154" fill="#8B5CF6" />
            <g filter={`url(#${id}-blur)`}>
              <circle cx="120" cy="52" r="50" fill="#2F9BF2" />
              <circle cx="177" cy="99" r="50" fill="#8B5CF6" />
              <circle cx="155" cy="167" r="50" fill="#E040C8" />
              <circle cx="85" cy="167" r="50" fill="#FF7A3D" />
              <circle cx="63" cy="99" r="50" fill="#5FD068" />
            </g>
            <circle cx="120" cy="114" r="62" fill={`url(#${id}-core)`} />
          </g>
          {/* diente */}
          <path
            d="M113 150 C113 146 117 145 120 147 C123 145 127 146 127 150 C127 155 125 161 123.5 163 C122.5 164 121.5 159 120 159 C118.5 159 117.5 164 116.5 163 C115 161 113 155 113 150 Z"
            fill="#FFFFFF"
          />
        </g>

        {/* cara */}
        <g className="ivm-face">
          <path className="ivm-brows" d={BROWS[mood]} style={{ d: `path('${BROWS[mood]}')` } as React.CSSProperties} fill="none" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" />
          {eyes}
          {showCheeks && (
            <>
              <ellipse cx="86" cy="128" rx="7" ry="4" fill="#FF6FB0" opacity={mood === 'happy' ? 0.85 : 0.55} />
              <ellipse cx="154" cy="128" rx="7" ry="4" fill="#FF6FB0" opacity={mood === 'happy' ? 0.85 : 0.55} />
            </>
          )}
          {mouth}
          {mood === 'sad' && (
            <path className="ivm-tear" d="M90 119 C87 124 86 127 90 129 C94 127 93 124 90 119 Z" fill="#7DD3FC" />
          )}
        </g>

        {/* auriculares */}
        <path d="M54 112 C50 26, 190 26, 186 112" fill="none" stroke={HEADSET} strokeWidth="6" strokeLinecap="round" />
        <rect x="44" y="96" width="18" height="30" rx="8" fill={HEADSET} />
        <rect x="178" y="96" width="18" height="30" rx="8" fill={HEADSET} />
        <path d="M188 122 Q184 146 150 141" fill="none" stroke={HEADSET} strokeWidth="4" strokeLinecap="round" />
        <circle className="ivm-mic" cx="147" cy="141" r="5.5" fill="#EC4899" />

        {/* extras según ánimo */}
        {mood === 'thinking' && (
          <g className="ivm-think">
            <circle cx="194" cy="42" r="4.5" fill="#7C3AED" />
            <circle cx="207" cy="28" r="6" fill="#7C3AED" />
            <circle cx="222" cy="12" r="8" fill="#7C3AED" />
          </g>
        )}
        {mood === 'loading' && (
          <g className="ivm-orbit">
            <circle cx="120" cy="16" r="6" fill="#7C3AED" />
            <circle cx="203" cy="160" r="6" fill="#EC4899" />
            <circle cx="37" cy="160" r="6" fill="#2F9BF2" />
          </g>
        )}
        {mood === 'sleeping' && (
          <g className="ivm-zzz" fill="#7C3AED" fontFamily="Poppins, system-ui, sans-serif" fontWeight="700">
            <text x="168" y="80" fontSize="26">z</text>
            <text x="168" y="80" fontSize="32">z</text>
            <text x="168" y="80" fontSize="40">Z</text>
          </g>
        )}
        <g className="ivm-sparkles">
          <path d={star(26, 64, 9)} fill="#FACC15" />
          <path d={star(214, 52, 8)} fill="#EC4899" />
          <path d={star(18, 176, 7)} fill="#2F9BF2" />
          <path d={star(224, 168, 9)} fill="#FACC15" />
        </g>
      </g>
    </svg>
  );
}

export const MASCOT_GEOMETRY = { SHOULDER_L, SHOULDER_R, BASE_L, BASE_R } as const;
