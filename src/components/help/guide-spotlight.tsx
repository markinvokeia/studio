'use client';

import { Check, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, RotateCcw, SkipForward, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { createPortal } from 'react-dom';

import { findHelpTarget, isMissingOrInvalid } from '@/lib/help/guide-engine';
import { goToStep, lastStep, nextStep, previousStep, retryStep, skipStep, stopGuide } from '@/lib/help/guide-runner';
import { pickPlacement, revealElement, VIEWPORT_MARGIN, type Rect } from '@/lib/help/placement';
import { cn } from '@/lib/utils';
import { useHelpAssistant } from '@/stores/help-assistant-store';

/** Por encima de diálogos y sheets de Radix (z-50). La mascota va encima (MascotHost). */
const Z_TOP = 2147483600;
const PADDING = 6;
const TOOLBAR_WIDTH = 268;
const TOOLBAR_HEIGHT = 40;
const TOOLBAR_GAP = 10;
const LEVEL_STEP_MS = 2500;
const MAX_LEVEL = 5;
/** Cada cuánto se revisa si el campo señalado falta o está mal (borde rojo). */
const ALERT_CHECK_MS = 400;

function sameBox(a: Rect | null, b: Rect | null) {
  if (!a || !b) return a === b;
  return Math.abs(a.top - b.top) < 0.5 && Math.abs(a.left - b.left) < 0.5
    && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5;
}

/** La barra va debajo del elemento; si no entra, arriba; si es enorme, abajo al centro. */
function placeToolbar(box: Rect): Rect {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const left = Math.max(VIEWPORT_MARGIN, Math.min(vw - TOOLBAR_WIDTH - VIEWPORT_MARGIN, box.left));
  const size = { width: TOOLBAR_WIDTH, height: TOOLBAR_HEIGHT };
  return pickPlacement([
    { rect: { ...size, top: box.top + box.height + TOOLBAR_GAP, left } },
    { rect: { ...size, top: box.top - TOOLBAR_GAP - TOOLBAR_HEIGHT, left } },
    { rect: { ...size, top: vh - TOOLBAR_HEIGHT - 16, left: vw / 2 - TOOLBAR_WIDTH / 2 } },
  ], [box]).rect;
}

function ToolbarButton({ label, onClick, disabled, children, primary }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      // Que no se robe el foco: el diálogo de abajo lo atraparía.
      onMouseDown={(e) => e.preventDefault()}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-full transition-colors disabled:pointer-events-none disabled:opacity-35',
        primary ? 'bg-[#7C3AED] text-white hover:bg-[#6D28D9]' : 'text-[#5B21B6] hover:bg-[#7C3AED]/10 dark:text-violet-300',
      )}
    >
      {children}
    </button>
  );
}

/**
 * Resaltado de la guía: oscurece la pantalla, marca el elemento con un borde que
 * titila (violeta; rojo si es obligatorio y falta o si tiene un error) y deja
 * debajo una barra mínima para moverse entre pasos. El texto del paso lo dice la
 * mascota en su globo, mientras lo señala (MascotHost).
 */
export function GuideSpotlight() {
  const t = useTranslations('HelpAssistant.toolbar');
  const spotlight = useHelpAssistant((s) => s.spotlight);
  const guide = useHelpAssistant((s) => s.guide);
  const [box, setBox] = React.useState<Rect | null>(null);
  const [alert, setAlert] = React.useState(false);
  const [level, setLevel] = React.useState(1);
  const toolbarRef = React.useRef<HTMLDivElement | null>(null);

  const targetId = spotlight?.targetId;

  // Sigue al elemento (scroll, layout, diálogos que se animan) y revisa si falta o está mal.
  React.useEffect(() => {
    if (!targetId) { setBox(null); return; }
    let frame = 0;
    let scrolled = false;
    let last: Rect | null = null;
    let lastAlertCheck = 0;
    const required = spotlight?.required === true;
    const checkAlert = spotlight?.mode !== 'filled' && spotlight?.mode !== 'action';
    const tick = () => {
      const target = findHelpTarget(targetId);
      if (target) {
        const now = performance.now();
        if (now - lastAlertCheck > ALERT_CHECK_MS) {
          lastAlertCheck = now;
          const next = checkAlert && isMissingOrInvalid(target, required);
          setAlert((prev) => (prev === next ? prev : next));
        }
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
    return () => { cancelAnimationFrame(frame); setAlert(false); };
  }, [targetId, spotlight?.required, spotlight?.mode]);

  // Cuanto más tiempo sin atención, más fuerte titila.
  React.useEffect(() => {
    setLevel(1);
    if (!targetId) return;
    const interval = setInterval(() => setLevel((l) => Math.min(MAX_LEVEL, l + 1)), LEVEL_STEP_MS);
    return () => clearInterval(interval);
  }, [targetId, spotlight?.mode]);

  // Los clics en la barra no deben cerrar el diálogo de Radix que está debajo
  // (escucha pointerdown en document para detectar "clic afuera").
  const hasToolbar = Boolean(spotlight && box);
  React.useEffect(() => {
    const el = toolbarRef.current;
    if (!el) return;
    const stop = (e: Event) => e.stopPropagation();
    el.addEventListener('pointerdown', stop);
    return () => el.removeEventListener('pointerdown', stop);
  }, [hasToolbar]);

  if (typeof document === 'undefined') return null;

  // Un paso que no se pudo hacer (no apareció el elemento): no hay nada que resaltar,
  // la barra queda abajo al centro para reintentar o saltar; la mascota explica por qué.
  const failed = !!guide && !guide.finished && guide.statuses[guide.current] === 'failed';
  if (failed && !spotlight) {
    return createPortal(
      <div
        data-help-ignore
        data-help-bubble
        role="toolbar"
        aria-label={t('label', { current: guide.current + 1, total: guide.steps.length })}
        className="flex items-center gap-0.5 rounded-full border border-destructive/40 bg-white px-1.5 shadow-[0_10px_28px_rgba(60,20,90,0.25)] dark:bg-card"
        style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', height: TOOLBAR_HEIGHT, zIndex: Z_TOP + 2, pointerEvents: 'auto' }}
      >
        <span className="px-2 text-xs font-semibold tabular-nums text-destructive">{t('step', { current: guide.current + 1, total: guide.steps.length })}</span>
        <ToolbarButton label={t('retry')} onClick={retryStep} primary><RotateCcw className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton label={t('skip')} onClick={() => nextStep('single')}><SkipForward className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton label={t('close')} onClick={stopGuide}><X className="h-4 w-4" /></ToolbarButton>
      </div>,
      document.body,
    );
  }

  if (!spotlight || !box) return null;

  const toolbar = placeToolbar(box);
  const total = guide?.steps.length ?? 0;
  // Un campo ya completado queda señalado mientras `current` apunta al paso siguiente.
  const shown = guide ? (spotlight.mode === 'filled' ? guide.current - 1 : guide.current) : 0;
  const running = !!guide && guide.statuses[guide.current] === 'running';
  const doing = spotlight.mode === 'action' || running;
  const waitingConfirm = spotlight.mode === 'confirm';

  return createPortal(
    <div data-help-ignore>
      <div
        className="help-spotlight-ring"
        data-alert={alert || undefined}
        style={{ top: box.top, left: box.left, width: box.width, height: box.height, zIndex: Z_TOP, ['--help-level' as string]: level }}
      />
      <div
        ref={toolbarRef}
        data-help-bubble
        role="toolbar"
        aria-label={guide ? t('label', { current: shown + 1, total }) : t('close')}
        className="flex items-center gap-0.5 rounded-full border border-[#7C3AED]/25 bg-white px-1.5 shadow-[0_10px_28px_rgba(60,20,90,0.25)] dark:bg-card"
        style={{ position: 'fixed', top: toolbar.top, left: toolbar.left, width: guide ? TOOLBAR_WIDTH : undefined, height: TOOLBAR_HEIGHT, zIndex: Z_TOP + 2, pointerEvents: 'auto' }}
      >
        {guide ? (
          <>
            <span className="flex flex-1 items-center gap-1.5 pl-1.5 text-xs font-semibold tabular-nums text-[#5B21B6] dark:text-violet-300">
              {t('step', { current: shown + 1, total })}
              {spotlight.required && (
                <span className={cn('h-1.5 w-1.5 rounded-full', alert ? 'bg-destructive' : 'bg-[#7C3AED]/50')} title={t('required')} aria-label={t('required')} />
              )}
            </span>
            <ToolbarButton label={t('first')} onClick={() => goToStep(0)} disabled={doing || shown <= 0}><ChevronsLeft className="h-4 w-4" /></ToolbarButton>
            <ToolbarButton label={t('previous')} onClick={previousStep} disabled={doing || shown <= 0}><ChevronLeft className="h-4 w-4" /></ToolbarButton>
            <ToolbarButton label={waitingConfirm ? t('alreadyDone') : t('next')} onClick={() => nextStep('single')} disabled={doing} primary>
              {waitingConfirm ? <Check className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </ToolbarButton>
            <ToolbarButton label={t('skip')} onClick={skipStep} disabled={doing}><SkipForward className="h-4 w-4" /></ToolbarButton>
            <ToolbarButton label={t('last')} onClick={lastStep} disabled={doing || shown >= total - 1}><ChevronsRight className="h-4 w-4" /></ToolbarButton>
          </>
        ) : null}
        {/* Sin guía (un "Mostrar" de la ayuda de pantalla) sólo queda cerrar. */}
        <ToolbarButton label={t('close')} onClick={stopGuide}><X className="h-4 w-4" /></ToolbarButton>
      </div>
    </div>,
    document.body,
  );
}
