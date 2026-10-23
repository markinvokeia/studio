'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

export type InvokeMascotState = 'idle' | 'waving' | 'thinking' | 'talking' | 'pointing' | 'happy' | 'sad';

interface InvokeMascotProps extends React.SVGProps<SVGSVGElement> {
  state?: InvokeMascotState;
  /** Punto de pantalla hacia el que miran los ojos (el elemento resaltado). */
  lookAt?: { x: number; y: number } | null;
  /**
   * Hacia dónde señala en `pointing`, en grados (0 = derecha, 90 = abajo).
   * Si es hacia la izquierda señala con la mano izquierda.
   */
  pointAngle?: number;
  /** Sin manitas: avatar chico (mensajes del chat). */
  withHands?: boolean;
  /** Con qué mano saluda en `waving` (la del lado visible cuando se asoma). */
  waveWith?: 'left' | 'right';
}

// Silueta y degradés del logo de Invoke (src/components/icons/logo.tsx), sin las letras.
const BLOB =
  'M512 0c55.378 0 108.97 12.06 158.423 35.313C729.133 62.43 789.28 103.88 836.92 156.456c47.64 52.574 81.16 115.34 98.412 183.4C952.583 399.71 958 459.77 958 521c0 58.078-4.99 115.42-14.73 169.873-10.45 57.51-29.23 112.98-55.78 164.21-27.18 52.48-62.58 98.98-105.23 137.6-43.21 39.14-93.88 69.82-149.88 90.6-56 20.78-116.48 31.717-179.88 31.717-64.21 0-125.79-11.21-182.26-33.09C258.752 982.93 205.613 952.92 160.03 913.06c-45.584-39.86-82.68-88.85-109.11-144.57C24.488 712.77 4.998 650.05 0 581.527.012 562.14 0 541.49 0 520.592c0-21.31-.01-42.34.002-63.092C.92 387.97 8.04 319.46 22.84 255.77c15.22-65.51 38.45-127.35 69.1-182.88C123.63 21.6 156.32 0 216.59 0H512Z';

/** Centro del cuerpo: las manitas orbitan alrededor de este punto. */
const CX = 479;
const CY = 540;
const HAND_RADIUS = 600;
const MAX_PUPIL_SHIFT = 26;
const NAVY = '#1e1b4b';

const DEFAULT_LEFT_ANGLE = 160;
const DEFAULT_RIGHT_ANGLE = 20;
const WAVE_ANGLE = -40;
const WAVE_ANGLE_LEFT = -145;

function normalizeAngle(deg: number) {
  return ((((deg + 180) % 360) + 360) % 360) - 180;
}

/**
 * Una manita dibujada a la derecha del cuerpo (ángulo 0) y rotada alrededor
 * del centro. Las que quedan del lado izquierdo se espejan para que el pulgar
 * siga arriba.
 */
function Hand({ angle, pointing, className }: { angle: number; pointing: boolean; className?: string }) {
  const a = normalizeAngle(angle);
  const mirror = Math.abs(a) > 90;
  const palmX = CX + HAND_RADIUS;
  return (
    <g transform={`rotate(${a} ${CX} ${CY})${mirror ? ` translate(0 ${2 * CY}) scale(1 -1)` : ''}`}>
      <g className={cn('help-mascot__hand', className)}>
        {pointing && (
          <rect className="help-mascot__finger" x={palmX + 40} y={CY - 30} width={190} height={60} rx={30} fill="#fff" stroke={NAVY} strokeWidth={26} />
        )}
        <ellipse cx={palmX} cy={CY} rx={130} ry={118} fill="#fff" stroke={NAVY} strokeWidth={28} />
        <path d={`M${palmX - 40} ${CY - 95} q20 -70 95 -40`} fill="none" stroke={NAVY} strokeWidth={26} strokeLinecap="round" />
      </g>
    </g>
  );
}

/**
 * Mascota del asistente: el logo de Invoke con ojitos, sonrisa y manitas.
 * Señala con la manita (`pointAngle`), mira hacia `lookAt` y pone cara apenada
 * en `sad` (un paso que falló, una pregunta sin respuesta).
 */
export const InvokeMascot = React.forwardRef<SVGSVGElement, InvokeMascotProps>(
  ({ state = 'idle', lookAt, pointAngle = 0, withHands = true, waveWith = 'right', className, ...props }, ref) => {
    const uid = React.useId().replace(/:/g, '');
    const innerRef = React.useRef<SVGSVGElement | null>(null);
    const [pupil, setPupil] = React.useState({ x: 0, y: 0 });

    React.useImperativeHandle(ref, () => innerRef.current as SVGSVGElement);

    React.useEffect(() => {
      if (!lookAt || !innerRef.current) { setPupil({ x: 0, y: state === 'sad' ? MAX_PUPIL_SHIFT * 0.6 : 0 }); return; }
      const rect = innerRef.current.getBoundingClientRect();
      const dx = lookAt.x - (rect.left + rect.width / 2);
      const dy = lookAt.y - (rect.top + rect.height / 2);
      const len = Math.hypot(dx, dy) || 1;
      setPupil({ x: (dx / len) * MAX_PUPIL_SHIFT, y: (dy / len) * MAX_PUPIL_SHIFT });
    }, [lookAt, state]);

    const g = (n: string) => `${uid}-${n}`;
    const pointWithLeft = state === 'pointing' && Math.abs(normalizeAngle(pointAngle)) > 90;
    const waving = state === 'waving';
    const rightAngle = state === 'pointing' && !pointWithLeft ? pointAngle : waving && waveWith === 'right' ? WAVE_ANGLE : DEFAULT_RIGHT_ANGLE;
    const leftAngle = pointWithLeft ? pointAngle : waving && waveWith === 'left' ? WAVE_ANGLE_LEFT : DEFAULT_LEFT_ANGLE;
    const mouth = state === 'sad'
      ? 'M395 780 q90 -75 180 0'
      : state === 'thinking'
        ? 'M420 735 h130'
        : state === 'happy' || state === 'waving'
          ? 'M375 690 q110 120 220 0'
          : 'M395 700 q90 85 180 0';

    return (
      <svg
        ref={innerRef}
        // Con manitas: encuadre para el cuerpo y las manos a los costados; el dedo
        // que señala puede salir del encuadre (overflow visible).
        viewBox={withHands ? '-260 -200 1480 1480' : '-20 -20 1000 1070'}
        xmlns="http://www.w3.org/2000/svg"
        className={cn('help-mascot', `help-mascot--${state}`, className)}
        role="img"
        {...props}
      >
        <defs>
          <radialGradient id={g('b')} cx={0} cy={0} r={1} gradientTransform="matrix(0 -512 512 0 512 512)" gradientUnits="userSpaceOnUse">
            <stop stopColor="#00AEEF" />
            <stop offset={1} stopColor="#A6CE39" />
          </radialGradient>
          <radialGradient id={g('c')} cx={0} cy={0} r={1} gradientTransform="matrix(270.38 -450.45 448.98 269.45 500.15 512.42)" gradientUnits="userSpaceOnUse">
            <stop stopColor="#A6CE39" />
            <stop offset={1} stopColor="#EC008C" />
          </radialGradient>
          <radialGradient id={g('d')} cx={0} cy={0} r={1} gradientTransform="matrix(-244.15 -460.7 459.25 -243.39 527.15 500.03)" gradientUnits="userSpaceOnUse">
            <stop stopColor="#EC008C" />
            <stop offset={1} stopColor="#FFF200" />
          </radialGradient>
          <radialGradient id={g('e')} cx={0} cy={0} r={1} gradientTransform="matrix(-507.03 147.2 -146.7 -505.47 508.03 521.82)" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFF200" />
            <stop offset={1} stopColor="#00AEEF" />
          </radialGradient>
        </defs>

        <g className="help-mascot__body">


          {/* Mismas capas que el logo. */}
          <path d={BLOB} fill={`url(#${g('b')})`} />
          <path d={BLOB} fill={`url(#${g('c')})`} />
          <path d={BLOB} fill={`url(#${g('d')})`} />
          <path d={BLOB} fill={`url(#${g('e')})`} />

          <g className="help-mascot__eyes">
            <ellipse cx={355} cy={470} rx={98} ry={115} fill="#fff" />
            <ellipse cx={605} cy={470} rx={98} ry={115} fill="#fff" />
            <g style={{ transform: `translate(${pupil.x}px, ${pupil.y}px)`, transition: 'transform 300ms ease-out' }}>
              <circle cx={365} cy={485} r={50} fill={NAVY} />
              <circle cx={615} cy={485} r={50} fill={NAVY} />
              <circle cx={383} cy={465} r={16} fill="#fff" />
              <circle cx={633} cy={465} r={16} fill="#fff" />
            </g>
          </g>

          {state === 'sad' && (
            <g className="help-mascot__sad">
              {/* Cejitas caídas y una lagrimita. */}
              <path d="M270 340 L420 300" stroke={NAVY} strokeWidth={30} strokeLinecap="round" />
              <path d="M540 300 L690 340" stroke={NAVY} strokeWidth={30} strokeLinecap="round" />
              <path className="help-mascot__tear" d="M690 600 q-28 52 0 78 q28 -26 0 -78Z" fill="#7dd3fc" stroke={NAVY} strokeWidth={10} />
            </g>
          )}

          <path className="help-mascot__mouth" d={mouth} fill="none" stroke={NAVY} strokeWidth={30} strokeLinecap="round" />

          {withHands && (
            <Hand
              angle={leftAngle}
              pointing={pointWithLeft}
              className={cn('help-mascot__hand--left', waving && waveWith === 'left' && 'help-mascot__hand--waving')}
            />
          )}
          {/* Las manitas van por delante del cuerpo: en diagonal (saludo) la cabeza las taparía. */}
          {withHands && (
            <Hand
              angle={rightAngle}
              pointing={state === 'pointing' && !pointWithLeft}
              className={cn('help-mascot__hand--right', waving && waveWith === 'right' && 'help-mascot__hand--waving')}
            />
          )}

          {state === 'thinking' && (
            <g className="help-mascot__thinking">
              <circle cx={760} cy={150} r={26} fill="#8b5cf6" />
              <circle cx={850} cy={80} r={34} fill="#8b5cf6" />
              <circle cx={960} cy={10} r={44} fill="#8b5cf6" />
            </g>
          )}
        </g>
      </svg>
    );
  },
);
InvokeMascot.displayName = 'InvokeMascot';
