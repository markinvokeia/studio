'use client';

import { AlertCircle, Check, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Circle, CircleDot, ListOrdered, LocateFixed, RotateCcw, SkipForward, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { createPortal } from 'react-dom';

import { useMascotOnStage } from '@/hooks/use-mascot-preference';
import { findHelpTarget, isMissingOrInvalid } from '@/lib/help/guide-engine';
import { goToStep, isBlockingStep, lastStep, nextStep, previousStep, retryStep, revealGuide, skipStep, stopGuide } from '@/lib/help/guide-runner';
import { intersects, MASCOT_SIZE, menuRectOf, pickPlacement, placeGuideMascot, placeGuideMascotBesideMenu, revealElement, VIEWPORT_MARGIN, type Rect } from '@/lib/help/placement';
import { cn } from '@/lib/utils';
import { useHelpAssistant, type GuideRun, type GuideStepStatus } from '@/stores/help-assistant-store';

/** Por encima de diálogos y sheets de Radix (z-50). La mascota va encima (MascotHost). */
const Z_TOP = 2147483600;
const PADDING = 6;
const TOOLBAR_WIDTH = 300;
const TOOLBAR_HEIGHT = 40;
const TOOLBAR_GAP = 10;
/** Lista de pasos: alto de cada fila y cuántas se ven antes de scrollear. */
const STEP_ROW_PX = 26;
const STEP_ROWS_VISIBLE = 6;
const LIST_GAP = 6;
const LEVEL_STEP_MS = 2500;
const MAX_LEVEL = 5;
/** Cada cuánto se revisa si el campo señalado falta o está mal (borde rojo). */
const ALERT_CHECK_MS = 400;
/** Globo propio (sin mascota): ancho máximo. */
const BUBBLE_MAX_WIDTH = 280;
/** Lo señalado desapareció (se cerró el diálogo, otra pantalla): tras esto la barra queda abajo al centro. */
const LOST_AFTER_MS = 1200;

function sameBox(a: Rect | null, b: Rect | null) {
  if (!a || !b) return a === b;
  return Math.abs(a.top - b.top) < 0.5 && Math.abs(a.left - b.left) < 0.5
    && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5;
}

/** Dónde va a pararse la mascota para señalar `box` (al costado del menú si es una opción de menú). */
function mascotRectFor(box: Rect, menu: Rect | null): Rect {
  const spot = menu ? placeGuideMascotBesideMenu(box, menu, MASCOT_SIZE) : placeGuideMascot(box, MASCOT_SIZE, []);
  return { left: spot.x - MASCOT_SIZE / 2, top: spot.y - MASCOT_SIZE / 2, width: MASCOT_SIZE, height: MASCOT_SIZE };
}

/** Área que `a` le tapa a `b` (con 4 px de aire). */
function overlapArea(a: Rect, b: Rect): number {
  const x = Math.min(a.left + a.width, b.left + b.width + 4) - Math.max(a.left, b.left - 4);
  const y = Math.min(a.top + a.height, b.top + b.height + 4) - Math.max(a.top, b.top - 4);
  return x > 0 && y > 0 ? x * y : 0;
}

/**
 * La barra va debajo del elemento (o del menú que lo contiene); si no entra, al costado
 * de la mascota, nunca debajo de ella; si no, al costado del menú o arriba; como último
 * recurso abajo al centro. Si ninguno queda libre, el que menos tapa. Usa el lugar al
 * que va a ir la mascota (el mismo cálculo que MascotHost, que después la ubica
 * esquivando esta barra, así que queda en ese lugar).
 */
function placeToolbar(anchor: Rect, box: Rect, mascot: Rect | null): Rect {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const size = { width: TOOLBAR_WIDTH, height: TOOLBAR_HEIGHT };
  const clampLeft = (left: number) => Math.max(VIEWPORT_MARGIN, Math.min(vw - TOOLBAR_WIDTH - VIEWPORT_MARGIN, left));
  const clampTop = (top: number) => Math.max(VIEWPORT_MARGIN, Math.min(vh - TOOLBAR_HEIGHT - VIEWPORT_MARGIN, top));
  const boxMid = clampTop(box.top + box.height / 2 - TOOLBAR_HEIGHT / 2);
  const rightOf = Math.max(anchor.left + anchor.width, mascot ? mascot.left + mascot.width : 0) + TOOLBAR_GAP;
  const candidates: Rect[] = [{ ...size, top: anchor.top + anchor.height + TOOLBAR_GAP, left: clampLeft(anchor.left) }];
  if (mascot) {
    const besideTop = mascot.top + mascot.height / 2 - TOOLBAR_HEIGHT / 2;
    candidates.push(
      { ...size, top: besideTop, left: mascot.left + mascot.width + TOOLBAR_GAP },
      { ...size, top: besideTop, left: mascot.left - TOOLBAR_WIDTH - TOOLBAR_GAP },
    );
  }
  candidates.push(
    { ...size, top: boxMid, left: anchor.left - TOOLBAR_WIDTH - TOOLBAR_GAP },
    { ...size, top: boxMid, left: rightOf },
    { ...size, top: anchor.top - TOOLBAR_GAP - TOOLBAR_HEIGHT, left: clampLeft(anchor.left) },
    { ...size, top: vh - TOOLBAR_HEIGHT - 16, left: vw / 2 - TOOLBAR_WIDTH / 2 },
  );
  const avoid = mascot ? [anchor, box, mascot] : [anchor, box];
  const inside = candidates.filter((c) => c.left >= VIEWPORT_MARGIN && c.top >= VIEWPORT_MARGIN && c.left + c.width <= vw - VIEWPORT_MARGIN && c.top + c.height <= vh - VIEWPORT_MARGIN);
  if (!inside.length) return pickPlacement(candidates.map((rect) => ({ rect })), avoid).rect;
  const covered = (c: Rect) => avoid.reduce((sum, o) => sum + overlapArea(c, o), 0);
  return inside.find((c) => covered(c) === 0) ?? inside.reduce((best, c) => (covered(c) < covered(best) ? c : best));
}

/** La lista de pasos va pegada a la barra: abajo si entra, si no arriba; sin pisar el elemento ni la mascota. */
function placeList(toolbar: Rect, height: number, obstacles: Rect[], dialog: Rect | null = null): Rect {
  const base = { width: TOOLBAR_WIDTH, height, left: toolbar.left };
  const below = { ...base, top: toolbar.top + toolbar.height + LIST_GAP };
  const above = { ...base, top: toolbar.top - LIST_GAP - height };
  if (!dialog) return pickPlacement([{ rect: below }, { rect: above }], obstacles).rect;
  // Dentro de un diálogo: si pegada a la barra taparía los otros campos del diálogo, va
  // al costado del diálogo (a la altura de la barra), donde no tapa nada.
  const top = Math.max(VIEWPORT_MARGIN, Math.min(window.innerHeight - height - VIEWPORT_MARGIN, toolbar.top));
  return pickPlacement([
    { rect: below },
    { rect: above },
    { rect: { ...base, top, left: dialog.left + dialog.width + LIST_GAP * 2 } },
    { rect: { ...base, top, left: dialog.left - TOOLBAR_WIDTH - LIST_GAP * 2 } },
  ], [...obstacles, dialog]).rect;
}


/**
 * Globo propio: arriba del elemento, si no a un costado (dentro de la pantalla aunque
 * el elemento esté pegado al tope), si no debajo de la barra y la lista; sin tapar el
 * elemento, la barra ni la lista. Si ninguno queda libre, el que menos tapa.
 */
function placeBubble(box: Rect, size: { width: number; height: number }, obstacles: Rect[]): Rect {
  const gap = 10;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const clampTop = (top: number) => Math.max(VIEWPORT_MARGIN, Math.min(vh - size.height - VIEWPORT_MARGIN, top));
  const left = Math.max(VIEWPORT_MARGIN, Math.min(vw - size.width - VIEWPORT_MARGIN, box.left));
  const midTop = clampTop(box.top + box.height / 2 - size.height / 2);
  const below = Math.max(box.top + box.height, ...obstacles.map((o) => o.top + o.height)) + gap;
  const candidates: Rect[] = [
    { ...size, top: box.top - gap - size.height, left },
    { ...size, top: midTop, left: box.left + box.width + gap },
    { ...size, top: midTop, left: box.left - gap - size.width },
    { ...size, top: box.top + box.height + gap, left },
    { ...size, top: below, left },
  ];
  const avoid = [box, ...obstacles];
  const inside = candidates.filter((c) => c.left >= VIEWPORT_MARGIN && c.top >= VIEWPORT_MARGIN && c.left + c.width <= vw - VIEWPORT_MARGIN && c.top + c.height <= vh - VIEWPORT_MARGIN);
  const covered = (c: Rect) => avoid.reduce((sum, o) => sum + overlapArea(c, o), 0);
  if (!inside.length) return pickPlacement(candidates.map((rect) => ({ rect })), avoid).rect;
  return inside.reduce((best, c) => (covered(c) < covered(best) ? c : best));
}

function ToolbarButton({ label, onClick, disabled, children, primary, pressed }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode; primary?: boolean; pressed?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      // Que no se robe el foco: el diálogo de abajo lo atraparía.
      onMouseDown={(e) => e.preventDefault()}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-full transition-colors disabled:pointer-events-none disabled:opacity-35',
        primary ? 'bg-[#7C3AED] text-white hover:bg-[#6D28D9]' : 'text-[#5B21B6] hover:bg-[#7C3AED]/10 dark:text-violet-300',
        pressed && !primary && 'bg-[#7C3AED]/10',
      )}
    >
      {children}
    </button>
  );
}

/** Pasos que se cuentan y se listan (los `na` no aplican en este caso). */
function visibleSteps(guide: GuideRun): number[] {
  return guide.statuses.map((status, i) => (status === 'na' ? -1 : i)).filter((i) => i >= 0);
}

/** "Paso X/Y" sin contar los que no aplican. */
function stepPosition(guide: GuideRun, index: number): { current: number; total: number } {
  const visible = visibleSteps(guide);
  const at = visible.findIndex((i) => i >= index);
  return { current: (at < 0 ? visible.length - 1 : at) + 1, total: visible.length };
}

const STATUS_ICON: Record<GuideStepStatus, React.ComponentType<{ className?: string }>> = {
  na: Circle,
  pending: Circle,
  running: CircleDot,
  waiting: CircleDot,
  done: Check,
  skipped: SkipForward,
  failed: AlertCircle,
};

/** Los pasos de la guía con su estado: cuál se hizo, cuál se está haciendo y cuáles faltan. */
function StepsList({ guide, shown, blocked, rect }: { guide: GuideRun; shown: number; blocked: boolean; rect: Rect }) {
  const t = useTranslations('HelpAssistant.toolbar');
  const listRef = React.useRef<HTMLOListElement | null>(null);

  // El paso actual siempre a la vista.
  React.useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[aria-current="step"]')?.scrollIntoView({ block: 'nearest' });
  }, [shown]);

  return (
    <div
      data-help-steps
      className="overflow-hidden rounded-2xl border border-[#7C3AED]/25 bg-white shadow-[0_10px_28px_rgba(60,20,90,0.22)] dark:bg-card"
      style={{ position: 'fixed', top: rect.top, left: rect.left, width: rect.width, height: rect.height, zIndex: Z_TOP + 2, pointerEvents: 'auto' }}
    >
      <ol ref={listRef} aria-label={t('stepsLabel')} className="h-full overflow-y-auto px-1.5 py-1.5">
        {guide.steps.map((step, i) => {
          if (guide.statuses[i] === 'na') return null;
          const status: GuideStepStatus = i === shown && guide.statuses[i] === 'pending' ? 'waiting' : guide.statuses[i];
          const Icon = STATUS_ICON[status];
          const current = i === shown;
          // Hacia adelante no se salta un paso que la persona tiene que hacer.
          const disabled = current || (blocked && i > shown);
          return (
            <li key={step.id ?? i} aria-current={current ? 'step' : undefined}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => goToStep(i)}
                onMouseDown={(e) => e.preventDefault()}
                title={t('goTo', { title: step.title })}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-1.5 text-left text-xs transition-colors',
                  current ? 'bg-[#7C3AED]/10 font-semibold text-[#5B21B6] dark:text-violet-300' : 'hover:bg-muted disabled:hover:bg-transparent',
                  status === 'done' && !current && 'text-muted-foreground',
                  status === 'skipped' && !current && 'text-muted-foreground/70 line-through decoration-muted-foreground/40',
                  status === 'failed' && 'text-destructive',
                )}
                style={{ height: STEP_ROW_PX }}
              >
                <Icon className={cn('h-3.5 w-3.5 shrink-0', status === 'done' && 'text-emerald-600', current && 'text-[#7C3AED]')} />
                <span className="w-4 shrink-0 text-[10px] tabular-nums text-muted-foreground">{stepPosition(guide, i).current}</span>
                <span className="min-w-0 flex-1 truncate">{step.title}</span>
                {isBlockingStep(step) && status !== 'done' && status !== 'skipped' && (
                  <span className="shrink-0 rounded-full bg-amber-100 px-1.5 text-[9px] font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">{t('yourTurn')}</span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Sin mascota en pantalla, el texto del paso va en un globo propio junto al elemento. */
function StepBubble({ box, obstacles, text }: { box: Rect; obstacles: Rect[]; text: string }) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [size, setSize] = React.useState<{ width: number; height: number } | null>(null);

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const next = { width: el.offsetWidth, height: el.offsetHeight };
    setSize((prev) => (prev && prev.width === next.width && prev.height === next.height ? prev : next));
  }, [text]);

  const rect = size ? placeBubble(box, size, obstacles) : null;
  return (
    <div
      ref={ref}
      role="status"
      aria-live="polite"
      className="rounded-2xl bg-[#7C3AED] px-3.5 py-2.5 text-sm font-medium leading-snug text-white shadow-[0_10px_28px_rgba(60,20,90,0.25)]"
      style={{
        position: 'fixed',
        top: rect?.top ?? -9999,
        left: rect?.left ?? -9999,
        maxWidth: BUBBLE_MAX_WIDTH,
        width: 'max-content',
        zIndex: Z_TOP + 1,
        visibility: rect ? 'visible' : 'hidden',
        pointerEvents: 'none',
      }}
    >
      {text}
    </div>
  );
}

/** Texto del paso: título, descripción y detalle (lo mismo que dice la mascota en su globo). */
export function stepSpeechText(spot: { title: string; description?: string; details?: string; mode: string }): string {
  const parts = spot.mode === 'action' ? [spot.title] : [spot.title, spot.description, spot.details];
  return parts.filter(Boolean).map((p) => p!.trim().replace(/[.:]$/, '')).join('. ') + '.';
}

/**
 * Resaltado de la guía: oscurece la pantalla, marca el elemento con un borde que
 * titila (violeta; rojo si es obligatorio y falta o si tiene un error) y deja
 * debajo una barra mínima para moverse entre pasos, con la lista de pasos pegada.
 * El texto del paso lo dice la mascota en su globo mientras lo señala (MascotHost);
 * si la mascota no está en pantalla, va en un globo propio.
 */
export function GuideSpotlight() {
  const t = useTranslations('HelpAssistant.toolbar');
  const spotlight = useHelpAssistant((s) => s.spotlight);
  const guide = useHelpAssistant((s) => s.guide);
  const listOpen = useHelpAssistant((s) => s.stepsListOpen);
  const setListOpen = useHelpAssistant((s) => s.setStepsListOpen);
  const mascotOnStage = useMascotOnStage();
  const [box, setBox] = React.useState<Rect | null>(null);
  // Si lo señalado es una opción de un menú o una lista, la barra y la lista de pasos se
  // ubican respecto del menú entero: no tapan las otras opciones.
  const [menuBox, setMenuBox] = React.useState<Rect | null>(null);
  // Diálogo que contiene lo señalado: la lista de pasos no tapa sus otros campos.
  const [dialogBox, setDialogBox] = React.useState<Rect | null>(null);
  const [alert, setAlert] = React.useState(false);
  const [level, setLevel] = React.useState(1);
  // Globo de la mascota: si la lista de pasos lo tapa, la lista se esconde en ese paso.
  const [bubbleBox, setBubbleBox] = React.useState<Rect | null>(null);
  const [listYields, setListYields] = React.useState(false);
  const [lost, setLost] = React.useState(false);

  const targetId = spotlight?.targetId;
  React.useEffect(() => { setListYields(false); }, [targetId]);

  // Sigue al elemento (scroll, layout, diálogos que se animan) y revisa si falta o está mal.
  React.useEffect(() => {
    if (!targetId) { setBox(null); setMenuBox(null); return; }
    let frame = 0;
    let scrolled = false;
    let last: Rect | null = null;
    let lastMenu: Rect | null = null;
    let lastDialog: Rect | null = null;
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
        const nextMenu = menuRectOf(target.highlight);
        if (!sameBox(lastMenu, nextMenu)) { lastMenu = nextMenu; setMenuBox(nextMenu); }
        const bubble = document.querySelector<HTMLElement>('.ivm-bubble')?.getBoundingClientRect();
        const nextBubble = bubble && bubble.width > 0 && bubble.height > 0 ? { top: bubble.top, left: bubble.left, width: bubble.width, height: bubble.height } : null;
        setBubbleBox((prev) => (sameBox(prev, nextBubble) ? prev : nextBubble));
        // La lista dibujada tapa el globo: se esconde hasta el próximo paso (no vuelve a aparecer
        // cuando el globo se acomoda, así no titila).
        const steps = document.querySelector<HTMLElement>('[data-help-steps]')?.getBoundingClientRect();
        if (steps && nextBubble && steps.width > 0 && intersects({ top: steps.top, left: steps.left, width: steps.width, height: steps.height }, nextBubble, 2)) setListYields(true);
        const dlg = target.highlight.closest('[role="dialog"], [role="alertdialog"]')?.getBoundingClientRect();
        const nextDialog = dlg && !nextMenu ? { top: dlg.top, left: dlg.left, width: dlg.width, height: dlg.height } : null;
        if (!sameBox(lastDialog, nextDialog)) { lastDialog = nextDialog; setDialogBox(nextDialog); }
      } else if (last) {
        last = null;
        setBox(null);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); setAlert(false); };
  }, [targetId, spotlight?.required, spotlight?.mode]);

  // Si lo señalado ya no está, la guía no puede quedar invisible: la barra pasa abajo al centro
  // con "Mostrar de nuevo" (y la mascota, al tocarla, repite el paso).
  React.useEffect(() => {
    setLost(false);
    if (!spotlight || box) return;
    const timer = setTimeout(() => setLost(true), LOST_AFTER_MS);
    return () => clearTimeout(timer);
  }, [spotlight, box]);

  // Cuanto más tiempo sin atención, más fuerte titila.
  React.useEffect(() => {
    setLevel(1);
    if (!targetId) return;
    const interval = setInterval(() => setLevel((l) => Math.min(MAX_LEVEL, l + 1)), LEVEL_STEP_MS);
    return () => clearInterval(interval);
  }, [targetId, spotlight?.mode]);

  if (typeof document === 'undefined') return null;

  // Los clics en la barra y la lista no deben cerrar el diálogo de Radix que está debajo
  // (escucha pointerdown en document para detectar "clic afuera").
  const stopPointer = (e: React.PointerEvent) => e.stopPropagation();
  // Sin contar los pasos que no aplican en este caso (`na`).
  const total = guide ? visibleSteps(guide).length : 0;
  const blocked = !!guide && guide.statuses[guide.current] === 'waiting' && isBlockingStep(guide.steps[guide.current]);
  const listHeight = Math.min(total, STEP_ROWS_VISIBLE) * STEP_ROW_PX + 12;
  const listToggle = (
    <ToolbarButton label={listOpen ? t('hideSteps') : t('showSteps')} onClick={() => setListOpen(!listOpen)} pressed={listOpen}>
      <ListOrdered className="h-4 w-4" />
    </ToolbarButton>
  );

  // Sin nada que resaltar (cambiando de pantalla, o un paso que no se pudo hacer): la
  // barra queda abajo al centro, con reintentar y saltar si falló; la mascota explica por qué.
  const failed = !!guide && !guide.finished && guide.statuses[guide.current] === 'failed';
  if (guide && !guide.finished && (!spotlight || lost)) {
    const vw = window.innerWidth;
    const toolbar = { width: TOOLBAR_WIDTH, height: TOOLBAR_HEIGHT, top: window.innerHeight - TOOLBAR_HEIGHT - 20, left: vw / 2 - TOOLBAR_WIDTH / 2 };
    return createPortal(
      <div data-help-ignore onPointerDown={stopPointer}>
        <div
          data-help-bubble
          role="toolbar"
          aria-label={t('label', { current: stepPosition(guide, guide.current).current, total })}
          className={cn('flex items-center gap-0.5 rounded-full border bg-white px-1.5 shadow-[0_10px_28px_rgba(60,20,90,0.25)] dark:bg-card', failed ? 'border-destructive/40' : 'border-[#7C3AED]/25')}
          style={{ position: 'fixed', ...toolbar, zIndex: Z_TOP + 2, pointerEvents: 'auto' }}
        >
          <span className={cn('flex-1 px-2 text-xs font-semibold tabular-nums', failed ? 'text-destructive' : 'text-[#5B21B6] dark:text-violet-300')}>
            {t('step', { current: stepPosition(guide, guide.current).current, total })}
          </span>
          {listToggle}
          {!failed && lost && <ToolbarButton label={t('showAgain')} onClick={() => { revealGuide(); }} primary><LocateFixed className="h-4 w-4" /></ToolbarButton>}
          {failed && <ToolbarButton label={t('retry')} onClick={retryStep} primary><RotateCcw className="h-4 w-4" /></ToolbarButton>}
          {failed && <ToolbarButton label={t('skip')} onClick={() => nextStep('single')}><SkipForward className="h-4 w-4" /></ToolbarButton>}
          <ToolbarButton label={t('close')} onClick={stopGuide}><X className="h-4 w-4" /></ToolbarButton>
        </div>
        {listOpen && total > 1 && (
          <StepsList guide={guide} shown={guide.current} blocked={blocked} rect={placeList(toolbar, listHeight, [])} />
        )}
      </div>,
      document.body,
    );
  }

  if (!spotlight || !box) return null;

  const mascot = mascotOnStage ? mascotRectFor(box, menuBox) : null;
  // Dentro de un menú, la barra se ubica respecto del menú entero (debajo o al costado).
  const anchor = menuBox ?? box;
  const toolbar = placeToolbar(anchor, box, mascot);
  // Un campo ya completado queda señalado mientras `current` apunta al paso siguiente.
  const shown = guide ? (spotlight.mode === 'filled' ? guide.current - 1 : guide.current) : 0;
  const running = !!guide && guide.statuses[guide.current] === 'running';
  const doing = spotlight.mode === 'action' || running;
  const waitingConfirm = spotlight.mode === 'confirm';
  const position = guide ? stepPosition(guide, shown) : { current: 0, total: 0 };
  const list = guide && listOpen && total > 1 ? placeList(toolbar, listHeight, mascot ? [anchor, mascot] : [anchor], dialogBox) : null;
  // Si la lista no entra sin pisar el elemento (o su menú), o taparía el globo con la
  // descripción, no se muestra en este paso (queda el botón para abrirla otra vez).
  const coversBubble = !!list && !!bubbleBox && intersects(list, bubbleBox, 2);
  const showList = !!list && !intersects(list, anchor, 2) && !coversBubble && !listYields;

  return createPortal(
    <div data-help-ignore onPointerDown={stopPointer}>
      <div
        className="help-spotlight-ring"
        data-alert={alert || undefined}
        style={{ top: box.top, left: box.left, width: box.width, height: box.height, zIndex: Z_TOP, ['--help-level' as string]: level }}
      />
      {!mascotOnStage && (
        <StepBubble box={box} obstacles={[toolbar, ...(menuBox ? [menuBox] : []), ...(list && showList ? [list] : [])]} text={stepSpeechText(spotlight)} />
      )}
      <div
        data-help-bubble
        role="toolbar"
        aria-label={guide ? t('label', { current: position.current, total }) : t('close')}
        className="flex items-center gap-0.5 rounded-full border border-[#7C3AED]/25 bg-white px-1.5 shadow-[0_10px_28px_rgba(60,20,90,0.25)] dark:bg-card"
        style={{ position: 'fixed', top: toolbar.top, left: toolbar.left, width: guide ? TOOLBAR_WIDTH : undefined, height: TOOLBAR_HEIGHT, zIndex: Z_TOP + 2, pointerEvents: 'auto' }}
      >
        {guide ? (
          <>
            <span className="flex flex-1 items-center gap-1.5 pl-1.5 text-xs font-semibold tabular-nums text-[#5B21B6] dark:text-violet-300">
              {t('step', { current: position.current, total })}
              {spotlight.required && (
                <span className={cn('h-1.5 w-1.5 rounded-full', alert ? 'bg-destructive' : 'bg-[#7C3AED]/50')} title={t('required')} aria-label={t('required')} />
              )}
            </span>
            {listToggle}
            <ToolbarButton label={t('first')} onClick={() => goToStep(0)} disabled={doing || position.current <= 1}><ChevronsLeft className="h-4 w-4" /></ToolbarButton>
            <ToolbarButton label={t('previous')} onClick={previousStep} disabled={doing || position.current <= 1}><ChevronLeft className="h-4 w-4" /></ToolbarButton>
            {/* Un paso que la persona tiene que hacer no se puede pasar de largo: sigue solo cuando lo hace. */}
            <ToolbarButton label={blocked ? t('waitingForYou') : waitingConfirm ? t('alreadyDone') : t('next')} onClick={() => nextStep('single')} disabled={doing || blocked} primary>
              {waitingConfirm ? <Check className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </ToolbarButton>
            <ToolbarButton label={t('skip')} onClick={skipStep} disabled={doing || blocked}><SkipForward className="h-4 w-4" /></ToolbarButton>
            <ToolbarButton label={t('last')} onClick={lastStep} disabled={doing || blocked || position.current >= total}><ChevronsRight className="h-4 w-4" /></ToolbarButton>
          </>
        ) : null}
        {/* Sin guía (un "Mostrar" de la ayuda de pantalla) sólo queda cerrar. */}
        <ToolbarButton label={t('close')} onClick={stopGuide}><X className="h-4 w-4" /></ToolbarButton>
      </div>
      {guide && list && showList && <StepsList guide={guide} shown={shown} blocked={blocked} rect={list} />}
    </div>,
    document.body,
  );
}
