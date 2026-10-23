'use client';

import { ArrowRight, CheckCircle2, FastForward, Hand, Info, MousePointerClick, PencilLine, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { createPortal } from 'react-dom';

import { Button } from '@/components/ui/button';

import { InvokeMascot } from '@/components/help/invoke-mascot';

import { findHelpTarget } from '@/lib/help/guide-engine';
import { pickPlacement, revealElement, toRect, VIEWPORT_MARGIN, type Rect } from '@/lib/help/placement';
import { nextStep, stopGuide } from '@/lib/help/guide-runner';
import { cn } from '@/lib/utils';
import { useHelpAssistant, type HelpSpotlight } from '@/stores/help-assistant-store';

/** Por encima de diálogos y sheets de Radix (z-50). El panel del asistente va por encima (HELP_PANEL_Z_ON_SPOTLIGHT). */
const Z_TOP = 2147483600;
export const HELP_PANEL_Z_ON_SPOTLIGHT = Z_TOP + 5;
const PADDING = 6;
/** La mascota que señala. Su caja incluye el aire para las manitas: el cuerpo es ~60%. */
const HAND_SIZE = 96;
const BUBBLE_WIDTH = 300;
const LEVEL_STEP_MS = 2500;
const MAX_LEVEL = 5;

type Side = 'left' | 'right' | 'top' | 'bottom';

type Box = Rect;

function sameBox(a: Box | null, b: Box | null) {
  if (!a || !b) return a === b;
  return Math.abs(a.top - b.top) < 0.5 && Math.abs(a.left - b.left) < 0.5
    && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5;
}

// Negativo: la caja de la mascota tiene aire alrededor del cuerpo, así la manita llega al borde.
const HAND_GAP = -18;
const BUBBLE_GAP = 14;

/** Rectángulo del panel de pasos del asistente: la burbuja y la manito no lo tapan. */
function guidePanelRect(): Rect | null {
  const el = document.querySelector('[data-help-guide-panel]');
  return el ? toRect(el.getBoundingClientRect()) : null;
}

function placeBubble(box: Rect, height: number, obstacles: Rect[]): Rect {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const alignedLeft = Math.max(VIEWPORT_MARGIN, Math.min(vw - BUBBLE_WIDTH - VIEWPORT_MARGIN, box.left));
  const midTop = box.top + box.height / 2 - height / 2;
  const candidates = [
    { rect: { top: box.top + box.height + BUBBLE_GAP, left: alignedLeft, width: BUBBLE_WIDTH, height } },
    { rect: { top: box.top - BUBBLE_GAP - height, left: alignedLeft, width: BUBBLE_WIDTH, height } },
    { rect: { top: midTop, left: box.left + box.width + BUBBLE_GAP + HAND_SIZE, width: BUBBLE_WIDTH, height } },
    { rect: { top: midTop, left: box.left - BUBBLE_GAP - HAND_SIZE - BUBBLE_WIDTH, width: BUBBLE_WIDTH, height } },
    // Elemento enorme (una tabla, un diálogo entero): una esquina libre.
    { rect: { top: vh - height - 16, left: 16 + 80, width: BUBBLE_WIDTH, height } },
    { rect: { top: 16, left: vw - BUBBLE_WIDTH - 16, width: BUBBLE_WIDTH, height } },
  ];
  return pickPlacement(candidates, [box, ...obstacles]).rect;
}

/**
 * La mascota: arriba del elemento señalando hacia abajo si hay lugar; si no, a
 * un costado; si el elemento está pegado arriba y sin lugar a los costados,
 * abajo señalando hacia arriba. Nunca encima de la burbuja ni del panel de pasos.
 */
function placeHand(box: Rect, obstacles: Rect[]): { side: Side; rect: Rect } {
  const anchorX = box.left + Math.min(box.width / 2, 56) - HAND_SIZE / 2;
  const midY = box.top + box.height / 2 - HAND_SIZE / 2;
  const size = { width: HAND_SIZE, height: HAND_SIZE };
  const candidates: { side: Side; rect: Rect }[] = [
    { side: 'top', rect: { ...size, top: box.top - HAND_SIZE - HAND_GAP, left: anchorX } },
    { side: 'right', rect: { ...size, top: midY, left: box.left + box.width + HAND_GAP } },
    { side: 'left', rect: { ...size, top: midY, left: box.left - HAND_SIZE - HAND_GAP } },
    { side: 'bottom', rect: { ...size, top: box.top + box.height + HAND_GAP, left: anchorX } },
  ];
  return pickPlacement(candidates, obstacles);
}

const MODE_ICON: Record<HelpSpotlight['mode'], React.ElementType> = {
  info: Hand,
  action: MousePointerClick,
  filled: CheckCircle2,
  input: PencilLine,
  confirm: MousePointerClick,
};

export function GuideSpotlight() {
  const t = useTranslations('HelpAssistant.spotlight');
  const spotlight = useHelpAssistant((s) => s.spotlight);
  const guide = useHelpAssistant((s) => s.guide);
  const [box, setBox] = React.useState<Box | null>(null);
  const [level, setLevel] = React.useState(1);
  const [bubbleHeight, setBubbleHeight] = React.useState(140);
  const bubbleRef = React.useRef<HTMLDivElement | null>(null);

  const targetId = spotlight?.targetId;

  // Sigue al elemento: scroll, cambios de layout, diálogos que se animan.
  React.useEffect(() => {
    if (!targetId) { setBox(null); return; }
    let frame = 0;
    let scrolled = false;
    let last: Box | null = null;
    const tick = () => {
      const target = findHelpTarget(targetId);
      if (target) {
        if (!scrolled) {
          revealElement(target.highlight);
          scrolled = true;
        }
        const r = target.highlight.getBoundingClientRect();
        const next = { top: r.top - PADDING, left: r.left - PADDING, width: r.width + PADDING * 2, height: r.height + PADDING * 2 };
        if (!sameBox(last, next)) { last = next; setBox(next); }
      } else if (last) {
        last = null;
        setBox(null);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [targetId]);

  // Cuanto más tiempo sin atención, más fuerte titila.
  React.useEffect(() => {
    setLevel(1);
    if (!targetId) return;
    const interval = setInterval(() => setLevel((l) => Math.min(MAX_LEVEL, l + 1)), LEVEL_STEP_MS);
    return () => clearInterval(interval);
  }, [targetId, spotlight?.mode]);

  // Los clics en la burbuja no deben cerrar el diálogo de Radix que está debajo
  // (escucha pointerdown en document para detectar "clic afuera").
  const hasBubble = Boolean(spotlight && box);
  React.useEffect(() => {
    const el = bubbleRef.current;
    if (!el) return;
    const stop = (e: Event) => e.stopPropagation();
    el.addEventListener('pointerdown', stop);
    // La altura decide si la burbuja va arriba o abajo del elemento.
    const observer = new ResizeObserver(() => setBubbleHeight(el.offsetHeight));
    observer.observe(el);
    return () => { el.removeEventListener('pointerdown', stop); observer.disconnect(); };
  }, [hasBubble]);

  if (!spotlight || !box || typeof document === 'undefined') return null;

  const panel = guidePanelRect();
  const bubble = placeBubble(box, bubbleHeight, panel ? [panel] : []);
  const hand = placeHand(box, panel ? [panel, bubble] : [bubble]);
  // Señala (y mira) al punto del elemento más cercano a la mascota, un poco hacia adentro.
  const handCenter = { x: hand.rect.left + HAND_SIZE / 2, y: hand.rect.top + HAND_SIZE / 2 };
  const aim = {
    x: Math.min(box.left + box.width - 12, Math.max(box.left + 12, handCenter.x)),
    y: Math.min(box.top + box.height - 8, Math.max(box.top + 8, handCenter.y)),
  };
  const pointAngle = (Math.atan2(aim.y - handCenter.y, aim.x - handCenter.x) * 180) / Math.PI;
  const ModeIcon = MODE_ICON[spotlight.mode];
  // Un campo ya completado queda señalado mientras `current` apunta al paso siguiente.
  const stepIndex = guide ? (spotlight.mode === 'filled' ? guide.current : guide.current + 1) : 0;
  const stepTotal = guide?.steps.length ?? 0;

  return createPortal(
    <div data-help-ignore aria-live="polite">
      <div
        className="help-spotlight-ring"
        data-mode={spotlight.mode}
        style={{ top: box.top, left: box.left, width: box.width, height: box.height, zIndex: Z_TOP, ['--help-level' as string]: level }}
      />
      <div
        className="help-mascot-pointer"
        style={{ top: hand.rect.top, left: hand.rect.left, width: HAND_SIZE, height: HAND_SIZE, zIndex: Z_TOP + 1 }}
      >
        <InvokeMascot state="pointing" pointAngle={pointAngle} lookAt={aim} className="h-full w-full" aria-hidden="true" />
      </div>
      <div
        ref={bubbleRef}
        role="dialog"
        aria-label={spotlight.title}
        className="fixed rounded-xl border border-border bg-card p-3 text-card-foreground shadow-2xl"
        style={{ position: 'fixed', top: bubble.top, left: bubble.left, width: BUBBLE_WIDTH, zIndex: Z_TOP + 2, pointerEvents: 'auto' }}
        // Evita que el FocusScope del diálogo de abajo pelee por el foco.
        onMouseDown={(e) => e.preventDefault()}
      >
        <div className="mb-1 flex items-center justify-between gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
              spotlight.mode === 'confirm' && 'bg-green-600/15 text-green-700 dark:text-green-400',
              spotlight.mode === 'input' && 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
              spotlight.mode === 'filled' && 'bg-green-600/10 text-green-700 dark:text-green-400',
              (spotlight.mode === 'info' || spotlight.mode === 'action') && 'bg-primary/10 text-primary',
            )}
          >
            <ModeIcon className="h-3 w-3" />
            {t(`mode.${spotlight.mode}`)}
          </span>
          {stepTotal > 0 && (
            <span className="text-[10px] font-medium text-muted-foreground">{t('stepOf', { current: stepIndex, total: stepTotal })}</span>
          )}
        </div>
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold leading-snug">{spotlight.title}</p>
          {spotlight.required !== undefined && (
            <span
              className={cn(
                'mt-0.5 flex-none rounded px-1.5 py-0.5 text-[10px] font-semibold',
                spotlight.required ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground',
              )}
            >
              {spotlight.required ? t('required') : t('optional')}
            </span>
          )}
        </div>
        {spotlight.description && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{spotlight.description}</p>}
        {spotlight.details && (
          <p className="mt-2 flex gap-1.5 rounded-md bg-muted/60 px-2 py-1.5 text-[11px] leading-relaxed text-foreground/80">
            <Info className="mt-0.5 h-3 w-3 flex-none text-primary" />
            <span>{spotlight.details}</span>
          </p>
        )}
        <div className="mt-3 flex items-center justify-end gap-1.5">
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={stopGuide}>
            <X className="h-3.5 w-3.5" />
            {t('exit')}
          </Button>
          {guide && spotlight.mode !== 'action' && spotlight.mode !== 'confirm' && (
            <Button type="button" variant="outline" size="sm" className="h-8 px-2 text-xs" onClick={() => nextStep('untilConfirm')}>
              <FastForward className="h-3.5 w-3.5" />
              {t('doAll')}
            </Button>
          )}
          {guide && spotlight.mode !== 'action' && (
            <Button type="button" size="sm" className="h-8 px-2.5 text-xs" onClick={() => nextStep('single')}>
              {spotlight.mode === 'confirm' ? t('alreadyDone') : t('next')}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
