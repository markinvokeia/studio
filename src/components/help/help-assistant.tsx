'use client';

import { ArrowLeft, EyeOff, Volume2, VolumeX, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { Skeleton } from '@/components/ui/skeleton';

import { useMascot } from '@/components/invoke-mascot';

import { GuideSpotlight } from '@/components/help/guide-spotlight';
import { HelpChat } from '@/components/help/help-chat';
import { HelpScopeProvider } from '@/components/help/help-scope';
import { OnboardingChecklist } from '@/components/help/onboarding-checklist';
import { ScreenHelp } from '@/components/help/screen-help';

import { useAuth } from '@/context/AuthContext';
import { isSpeechSupported, stopAssistantSpeech, useAssistantVoice } from '@/hooks/use-assistant-voice';
import { useMascotPreference } from '@/hooks/use-mascot-preference';
import { useCurrentHelpRoute } from '@/hooks/use-current-help-route';
import { usePermissions } from '@/hooks/usePermissions';
import { findScreen, findUseCase, loadHelpCatalog } from '@/lib/help/catalog';
import { configureGuideRunner, nextStep, startGuide } from '@/lib/help/guide-runner';
import { findHelpTarget } from '@/lib/help/guide-engine';
import { stripLocale } from '@/lib/help/help-id';
import { pickPlacement, rectOf, type Rect } from '@/lib/help/placement';
import { cn } from '@/lib/utils';
import { getOnboardingStatus, getPublishedCatalogVersion, publishCatalog } from '@/services/help-assistant';
import { useHelpAssistant } from '@/stores/help-assistant-store';

import { HELP_PERMISSIONS } from '@/constants/permissions';
import type { HelpCatalog } from '@/lib/types';

/** La mascota avisa una vez por sesión cuántos pasos obligatorios faltan. */
const PENDING_SAID_KEY = 'invoke-help:pending-said';
/** Lo prende el grabador de videos (e2e/videos): expone window.__invokeHelp. */
const AUTOMATION_KEY = 'invoke-help:automation';
const SYNCED_KEY = 'invoke-help:catalog-synced';
/** El catálogo (~25 KB gzip) se baja cuando la página ya cargó. */
const CATALOG_IDLE_DELAY_MS = 2500;
const MOBILE_BREAKPOINT_PX = 640;
const WINDOW_WIDTH = 380;
const WINDOW_MAX_HEIGHT = 560;
/** Menos lugar que esto arriba de la mascota: la ventana sale abajo. */
const WINDOW_MIN_SPACE = 360;
const ANCHOR_POLL_MS = 200;
/** Ventana apartada mientras señala: márgenes para el riel (derecha) y el menú (izquierda). */
const DETACHED_RIGHT_PX = 72;
const DETACHED_LEFT_PX = 96;
const DETACHED_SHORT_HEIGHT = 380;

interface Anchor { left: number; top: number; width: number }

/** Dónde está la mascota (la ventana sale arriba de ella). Sin mascota a la vista, su lugar de anclaje. */
function useMascotAnchor(active: boolean): Anchor | null {
  const [anchor, setAnchor] = React.useState<Anchor | null>(null);
  React.useEffect(() => {
    if (!active) return;
    const measure = () => {
      const actor = document.querySelector('.ivm-actor:not(.ivm-hidden)')?.getBoundingClientRect();
      const next = actor && actor.width > 0
        ? { left: actor.left, top: actor.top, width: actor.width }
        : { left: window.innerWidth - 56 - 20 - 88, top: window.innerHeight - 20 - 88, width: 88 };
      setAnchor((prev) => (prev && Math.abs(prev.left - next.left) < 1 && Math.abs(prev.top - next.top) < 1 ? prev : next));
    };
    measure();
    const interval = setInterval(measure, ANCHOR_POLL_MS);
    window.addEventListener('resize', measure);
    return () => { clearInterval(interval); window.removeEventListener('resize', measure); };
  }, [active]);
  return anchor;
}

/** Mientras señala algo con la ventana abierta: el elemento y la barra de pasos, para no taparlos. */
function usePointedRects(targetId: string | null): { target: Rect | null; toolbar: Rect | null } | null {
  const [rects, setRects] = React.useState<{ target: Rect | null; toolbar: Rect | null } | null>(null);
  React.useEffect(() => {
    if (!targetId) { setRects(null); return; }
    const measure = () => {
      const el = findHelpTarget(targetId)?.highlight.getBoundingClientRect();
      const target = el ? { left: el.left - 8, top: el.top - 8, width: el.width + 16, height: el.height + 16 } : null;
      const toolbar = rectOf('[data-help-bubble]');
      setRects((prev) => (prev && sameRect(prev.target, target) && sameRect(prev.toolbar, toolbar) ? prev : { target, toolbar }));
    };
    measure();
    const interval = setInterval(measure, ANCHOR_POLL_MS);
    return () => clearInterval(interval);
  }, [targetId]);
  return rects;
}

function sameRect(a: Rect | null, b: Rect | null) {
  if (!a || !b) return a === b;
  return Math.abs(a.left - b.left) < 1 && Math.abs(a.top - b.top) < 1 && Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1;
}

/** Una esquina (abajo a la derecha primero) donde la ventana no pise nada de `avoid`; si no entra, más baja. */
function placeAwayFrom(avoid: (Rect | null)[]): React.CSSProperties {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const mobile = vw < MOBILE_BREAKPOINT_PX;
  const width = mobile ? vw - 16 : WINDOW_WIDTH;
  const right = mobile ? 8 : vw - width - DETACHED_RIGHT_PX;
  const left = mobile ? 8 : DETACHED_LEFT_PX;
  const candidates = [Math.min(WINDOW_MAX_HEIGHT, vh * 0.75), DETACHED_SHORT_HEIGHT].flatMap((height) => [
    { rect: { width, height, left: right, top: vh - height - 16 } },
    { rect: { width, height, left, top: vh - height - 16 } },
    { rect: { width, height, left: right, top: 16 } },
    { rect: { width, height, left, top: 16 } },
  ]);
  const { rect } = pickPlacement(candidates, avoid.filter((r): r is Rect => !!r));
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height, maxHeight: rect.height };
}

const QUICK_ACTION_PX = 36;
const QUICK_ACTION_GAP = 8;

/** Columna de iconos al costado de la mascota, del lado que da al centro de la pantalla. */
function quickActionsStyle(anchor: Anchor, count: number): React.CSSProperties {
  const height = count * QUICK_ACTION_PX + (count - 1) * QUICK_ACTION_GAP;
  const onRightHalf = anchor.left + anchor.width / 2 > window.innerWidth / 2;
  return {
    top: Math.max(8, anchor.top + anchor.width / 2 - height / 2),
    left: onRightHalf ? anchor.left - QUICK_ACTION_PX - QUICK_ACTION_GAP : anchor.left + anchor.width + QUICK_ACTION_GAP,
  };
}

function QuickAction({ label, onClick, pressed, delay, children }: { label: string; onClick: () => void; pressed?: boolean; delay: number; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'both', width: QUICK_ACTION_PX, height: QUICK_ACTION_PX }}
      className="flex items-center justify-center rounded-full border border-[#7C3AED]/25 bg-white text-[#5B21B6] shadow-[0_6px_16px_rgba(60,20,90,0.22)] transition-colors animate-in fade-in zoom-in-50 duration-300 hover:bg-[#7C3AED] hover:text-white dark:bg-card dark:text-violet-300"
    >
      {children}
    </button>
  );
}

function readStorage(storage: 'local' | 'session', key: string): string | null {
  try { return (storage === 'local' ? localStorage : sessionStorage).getItem(key); } catch { return null; }
}
function writeStorage(storage: 'local' | 'session', key: string, value: string) {
  try { (storage === 'local' ? localStorage : sessionStorage).setItem(key, value); } catch { /* modo privado */ }
}

/**
 * Asistente guiado de Invoke. Se monta una vez en el layout autenticado.
 * Ver docs/onboarding-asistente.md.
 */
export function HelpAssistant() {
  const { hasPermission, isLoading } = usePermissions();
  if (isLoading || !hasPermission(HELP_PERMISSIONS.ASSISTANT_USE)) return null;
  return <HelpAssistantRoot />;
}

function HelpAssistantRoot() {
  const t = useTranslations('HelpAssistant');
  const router = useRouter();
  const locale = useLocale();
  const { route, scope } = useCurrentHelpRoute();
  const { hasPermission } = usePermissions();
  const { isOpen, tab, guide, close, setTab } = useHelpAssistant();
  const mascot = useMascot();
  const mascotRef = React.useRef(mascot);
  React.useLayoutEffect(() => { mascotRef.current = mascot; });

  const [catalog, setCatalog] = React.useState<HelpCatalog | null>(null);
  const [catalogError, setCatalogError] = React.useState(false);
  const [pendingSteps, setPendingSteps] = React.useState(0);
  const windowRef = React.useRef<HTMLDivElement | null>(null);

  const canSeeOnboarding = hasPermission(HELP_PERMISSIONS.ONBOARDING_VIEW);
  const canSync = hasPermission(HELP_PERMISSIONS.CATALOG_SYNC);

  // Runner de guías: necesita el router de Next y el locale.
  React.useEffect(() => {
    configureGuideRunner({
      navigate: (target) => router.push(`/${locale}${target === '/' ? '' : target}`),
      currentPath: () => stripLocale(window.location.pathname, locale),
    });
    return () => configureGuideRunner(null);
  }, [router, locale]);

  const automation = React.useMemo(() => readStorage('local', AUTOMATION_KEY) === '1', []);

  // Catálogo: en diferido, o enseguida si se abre el asistente (o lo pide el grabador).
  React.useEffect(() => {
    if (catalog) return;
    let cancelled = false;
    const load = () => loadHelpCatalog()
      .then((c) => { if (!cancelled) setCatalog(c); })
      .catch(() => { if (!cancelled) setCatalogError(true); });
    const timer = setTimeout(load, isOpen || automation ? 0 : CATALOG_IDLE_DELAY_MS);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [catalog, isOpen, automation]);

  // Fase 3: el grabador maneja la guía real (la mascota señalando) para el video demo.
  React.useEffect(() => {
    if (!automation || !catalog) return;
    const w = window as unknown as Record<string, unknown>;
    w.__invokeHelp = {
      ready: true,
      startUseCase: (id: string, values?: Record<string, unknown>) => {
        const useCase = findUseCase(catalog, id);
        if (!useCase) return false;
        startGuide({ title: useCase.title, steps: useCase.steps }, { useCaseId: useCase.id, values: values ?? {} });
        return true;
      },
      next: () => nextStep('single'),
      state: () => {
        const { guide: g, spotlight: sp } = useHelpAssistant.getState();
        return { guide: g && { current: g.current, statuses: g.statuses, finished: g.finished, steps: g.steps }, spotlight: sp };
      },
      catalogVersion: catalog.version,
    };
    return () => { delete w.__invokeHelp; };
  }, [automation, catalog]);

  // Cada deploy trae su catálogo: si la BD del cliente tiene otra versión, se publica.
  React.useEffect(() => {
    if (!catalog || !canSync || readStorage('session', SYNCED_KEY) === catalog.version) return;
    const controller = new AbortController();
    getPublishedCatalogVersion(controller.signal)
      .then(async (published) => {
        if (published !== catalog.version) await publishCatalog(catalog);
        writeStorage('session', SYNCED_KEY, catalog.version);
      })
      .catch((error) => console.warn('[help] no se pudo publicar el catálogo de ayuda', error));
    return () => controller.abort();
  }, [catalog, canSync]);

  // Onboarding: cuántos pasos obligatorios faltan. La opción sólo aparece si falta
  // alguno, y la mascota lo avisa una vez por sesión invitando a abrirla.
  React.useEffect(() => {
    if (!catalog || !canSeeOnboarding) return;
    const controller = new AbortController();
    getOnboardingStatus(controller.signal)
      .then((res) => {
        const done = new Set(res.steps.filter((s) => s.status !== 'pending').map((s) => s.step_id));
        const pending = catalog.journey.filter((s) => s.required && !done.has(s.id)).length;
        setPendingSteps(pending);
        if (pending > 0 && !automation && !readStorage('session', PENDING_SAID_KEY)) {
          writeStorage('session', PENDING_SAID_KEY, '1');
          void mascotRef.current.say(t('mascot.pendingSteps', { count: pending }), { gesture: 'wave' });
        }
      })
      .catch(() => { /* sin estado no se muestra la opción */ });
    return () => controller.abort();
  }, [catalog, canSeeOnboarding, automation, t]);

  // Mientras guía, lo primario es la guía (la mascota y la barra de pasos): la ventana se oculta.
  const showWindow = isOpen && !guide;
  const anchor = useMascotAnchor(showWindow);
  const spotlightId = useHelpAssistant((s) => s.spotlight?.targetId ?? null);
  const pointing = usePointedRects(showWindow ? spotlightId : null);
  const voiceMuted = useAssistantVoice((s) => s.muted);
  const setVoiceMuted = useAssistantVoice((s) => s.setMuted);
  const [canSpeak, setCanSpeak] = React.useState(false);
  React.useEffect(() => { setCanSpeak(isSpeechSupported()); }, []);
  const { user } = useAuth();
  const [, setShowMascot] = useMascotPreference(user?.id);

  // Esconderla: se despide y queda dormida en el riel (MascotWakeButton) hasta que la despierten.
  const hideMascot = React.useCallback(async () => {
    close();
    stopAssistantSpeech();
    await mascotRef.current.gesture('wave', 900);
    setShowMascot(false);
  }, [close, setShowMascot]);

  // "Guiame en esta pantalla" se destaca si llegó a una pantalla nueva desde la última vez que la abrió.
  const lastSeenRoute = React.useRef<string | null>(null);
  const [highlightScreen, setHighlightScreen] = React.useState(true);
  React.useEffect(() => {
    if (!showWindow) return;
    setHighlightScreen(lastSeenRoute.current !== route);
    lastSeenRoute.current = route;
  }, [showWindow, route]);

  // Al abrirse, la mascota deja de hablar (su globo quedaría debajo de la ventana).
  React.useEffect(() => {
    if (showWindow) void mascotRef.current.setMood('happy');
  }, [showWindow]);

  // Los clics en la ventana no deben cerrar el diálogo de Radix abierto debajo.
  React.useEffect(() => {
    const el = windowRef.current;
    if (!el) return;
    const stop = (e: Event) => e.stopPropagation();
    el.addEventListener('pointerdown', stop);
    return () => el.removeEventListener('pointerdown', stop);
  }, [showWindow]);

  const view = tab === 'onboarding' && (!canSeeOnboarding || !catalog) ? 'chat' : tab;
  const screenTitle = catalog ? findScreen(catalog, scope)?.title : undefined;

  // Ventana anclada arriba de la mascota, con la colita apuntándola.
  // Si la dejaron arriba y no entra, sale abajo de ella.
  // Mientras señala algo ("Mostrar" en la ficha de la pantalla) no la sigue: va a una
  // esquina que no tape el elemento, la mascota ni la barra.
  let windowStyle: React.CSSProperties = {};
  let tailLeft = 0;
  let below = false;
  const detached = !!pointing && !!anchor;
  if (detached && typeof window !== 'undefined') {
    windowStyle = placeAwayFrom([pointing.target, pointing.toolbar, { left: anchor.left, top: anchor.top, width: anchor.width, height: anchor.width }]);
  } else if (anchor && typeof window !== 'undefined') {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const mobile = vw < MOBILE_BREAKPOINT_PX;
    const width = mobile ? vw - 16 : WINDOW_WIDTH;
    const center = anchor.left + anchor.width / 2;
    const onRight = center > vw / 2;
    const left = Math.max(8, Math.min(vw - width - 8, onRight ? center - width + 48 : center - 48));
    const spaceAbove = anchor.top - 20;
    const spaceBelow = vh - (anchor.top + anchor.width) - 20;
    below = spaceAbove < WINDOW_MIN_SPACE && spaceBelow > spaceAbove;
    windowStyle = below
      ? { left, width, top: anchor.top + anchor.width + 4, maxHeight: Math.max(240, Math.min(WINDOW_MAX_HEIGHT, spaceBelow)) }
      : { left, width, bottom: vh - anchor.top + 4, maxHeight: Math.max(240, Math.min(WINDOW_MAX_HEIGHT, spaceAbove)) };
    tailLeft = Math.max(20, Math.min(width - 36, center - left - 8));
  }

  return (
    <HelpScopeProvider scope="help-assistant">
      <div data-help-ignore>
        <GuideSpotlight />

        {/* El lanzador es la mascota (MascotHost): al hacerle clic se abre esta ventana arriba de ella. */}
        {showWindow && anchor && (
          <div
            ref={windowRef}
            role="dialog"
            aria-label={t('title')}
            data-help-panel
            style={{ ...windowStyle, pointerEvents: 'auto' }}
            className="fixed z-[9985] flex h-[min(560px,75dvh)] flex-col rounded-[22px] border-2 border-[#7C3AED]/25 bg-white text-card-foreground shadow-[0_18px_48px_rgba(60,20,90,0.28)] animate-in fade-in slide-in-from-bottom-2 duration-200 dark:bg-card"
          >
            <div className="flex flex-none items-center gap-1.5 rounded-t-[20px] bg-gradient-to-r from-[#7C3AED] to-[#A855F7] px-2 py-2 text-white">
              {view !== 'chat' ? (
                <button type="button" onClick={() => setTab('chat')} className="rounded-full p-1.5 hover:bg-white/15" aria-label={t('back')}>
                  <ArrowLeft className="h-4 w-4" />
                </button>
              ) : (
                <span className="ml-1.5 h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_0_3px_rgba(110,231,183,0.3)]" aria-hidden="true" />
              )}
              <p className="min-w-0 flex-1 truncate px-1 text-sm font-semibold">
                {view === 'onboarding' ? t('tabs.onboarding') : view === 'screen' ? screenTitle ?? t('tabs.screen') : t('title')}
              </p>
              <button type="button" onClick={close} className="rounded-full p-1.5 hover:bg-white/15" aria-label={t('close')}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-b-[20px]">
              {!catalog ? (
                <div className="space-y-2 p-4">
                  {catalogError ? (
                    <p className="text-sm text-destructive">{t('catalogError')}</p>
                  ) : (
                    <>
                      <Skeleton className="h-6 w-2/3" />
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                    </>
                  )}
                </div>
              ) : view === 'onboarding' ? (
                <OnboardingChecklist catalog={catalog} onPendingChange={setPendingSteps} />
              ) : view === 'screen' ? (
                <ScreenHelp key={route} catalog={catalog} />
              ) : (
                <HelpChat
                  catalog={catalog}
                  pendingSteps={canSeeOnboarding ? pendingSteps : 0}
                  screenTitle={screenTitle}
                  highlightScreen={highlightScreen}
                  onOpenScreen={() => setTab('screen')}
                  onOpenOnboarding={() => setTab('onboarding')}
                />
              )}
            </div>

            {/* Colita del globo, hacia la mascota. */}
            {!detached && <span
              aria-hidden="true"
              className={cn(
                'absolute h-4 w-4 rotate-45 border-[#7C3AED]/25',
                below ? '-top-[9px] border-l-2 border-t-2 bg-[#7C3AED]' : '-bottom-[9px] border-b-2 border-r-2 bg-white dark:bg-card',
              )}
              style={{ left: tailLeft }}
            />}
          </div>
        )}

        {/* Iconos que salen al lado de la mascota al tocarla: silenciar la voz y esconderla. */}
        {showWindow && anchor && !detached && (
          <div
            role="toolbar"
            aria-label={t('mascotActions')}
            onPointerDown={(e) => e.stopPropagation()}
            className="fixed z-[9986] flex flex-col gap-2"
            style={quickActionsStyle(anchor, canSpeak ? 2 : 1)}
          >
            {canSpeak && (
              <QuickAction
                label={voiceMuted ? t('voiceOn') : t('voiceOff')}
                pressed={voiceMuted}
                onClick={() => setVoiceMuted(!voiceMuted)}
                delay={0}
              >
                {voiceMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </QuickAction>
            )}
            <QuickAction label={t('hideMascot')} onClick={() => void hideMascot()} delay={canSpeak ? 70 : 0}>
              <EyeOff className="h-4 w-4" />
            </QuickAction>
          </div>
        )}
      </div>
    </HelpScopeProvider>
  );
}
