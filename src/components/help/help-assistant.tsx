'use client';

import { ArrowLeft, X } from 'lucide-react';
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

import { useCurrentHelpRoute } from '@/hooks/use-current-help-route';
import { usePermissions } from '@/hooks/usePermissions';
import { findScreen, findUseCase, loadHelpCatalog } from '@/lib/help/catalog';
import { configureGuideRunner, nextStep, startGuide } from '@/lib/help/guide-runner';
import { stripLocale } from '@/lib/help/help-id';
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
const ANCHOR_POLL_MS = 200;

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
  let windowStyle: React.CSSProperties = {};
  let tailLeft = 0;
  if (anchor && typeof window !== 'undefined') {
    const vw = window.innerWidth;
    const mobile = vw < MOBILE_BREAKPOINT_PX;
    const width = mobile ? vw - 16 : WINDOW_WIDTH;
    const center = anchor.left + anchor.width / 2;
    const onRight = center > vw / 2;
    const left = Math.max(8, Math.min(vw - width - 8, onRight ? center - width + 48 : center - 48));
    windowStyle = {
      left,
      width,
      bottom: window.innerHeight - anchor.top + 4,
      maxHeight: Math.max(240, Math.min(WINDOW_MAX_HEIGHT, anchor.top - 20)),
    };
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
            <span
              aria-hidden="true"
              className="absolute -bottom-[9px] h-4 w-4 rotate-45 border-b-2 border-r-2 border-[#7C3AED]/25 bg-white dark:bg-card"
              style={{ left: tailLeft }}
            />
          </div>
        )}
      </div>
    </HelpScopeProvider>
  );
}
