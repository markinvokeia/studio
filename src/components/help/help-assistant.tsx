'use client';

import { BookOpen, ListChecks, MessageCircleQuestion, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import { GuidePanel } from '@/components/help/guide-panel';
import { GuideSpotlight, HELP_PANEL_Z_ON_SPOTLIGHT } from '@/components/help/guide-spotlight';
import { HelpChat, isSadReply } from '@/components/help/help-chat';
import { HelpScopeProvider } from '@/components/help/help-scope';
import { InvokeMascot, type InvokeMascotState } from '@/components/help/invoke-mascot';
import { MascotLauncher } from '@/components/help/mascot-launcher';
import { OnboardingChecklist } from '@/components/help/onboarding-checklist';
import { ScreenHelp } from '@/components/help/screen-help';

import { useCurrentHelpRoute } from '@/hooks/use-current-help-route';
import { usePermissions } from '@/hooks/usePermissions';
import { loadHelpCatalog } from '@/lib/help/catalog';
import { findHelpTarget } from '@/lib/help/guide-engine';
import { configureGuideRunner } from '@/lib/help/guide-runner';
import { intersects, toRect, type Rect } from '@/lib/help/placement';
import { stripLocale } from '@/lib/help/help-id';
import { cn } from '@/lib/utils';
import { getOnboardingStatus, getPublishedCatalogVersion, publishCatalog } from '@/services/help-assistant';
import { useHelpAssistant, type HelpAssistantTab } from '@/stores/help-assistant-store';

import { HELP_PERMISSIONS } from '@/constants/permissions';
import type { HelpCatalog } from '@/lib/types';

const AUTO_OPEN_KEY = 'invoke-help:onboarding-auto-opened';
const SYNCED_KEY = 'invoke-help:catalog-synced';
/** El catálogo (~25 KB gzip) se baja cuando la página ya cargó. */
const CATALOG_IDLE_DELAY_MS = 2500;

type PanelCorner = 'bottom-right' | 'top-right' | 'bottom-left' | 'top-left';
const PANEL_CORNERS: PanelCorner[] = ['bottom-right', 'top-right', 'bottom-left', 'top-left'];
/** Margen derecho: deja libre el riel del header (w-14). En mobile el panel ocupa el ancho. */
const PANEL_RIGHT_PX = 72;
/** Margen izquierdo: deja libre el sidebar (w-20). */
const PANEL_LEFT_PX = 96;
const PANEL_EDGE_PX = 16;
const MOBILE_BREAKPOINT_PX = 640;

function cornerRect(corner: PanelCorner, width: number, height: number): Rect {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const mobile = vw < MOBILE_BREAKPOINT_PX;
  const left = mobile ? 0 : corner.endsWith('left') ? PANEL_LEFT_PX : vw - PANEL_RIGHT_PX - width;
  const top = corner.startsWith('top') ? (mobile ? 0 : PANEL_EDGE_PX) : vh - height - (mobile ? 0 : PANEL_EDGE_PX);
  return { top, left, width: mobile ? vw : width, height };
}

function cornerStyle(corner: PanelCorner): React.CSSProperties {
  const mobile = window.innerWidth < MOBILE_BREAKPOINT_PX;
  if (mobile) return corner.startsWith('top') ? { top: 0, left: 0, right: 0 } : { bottom: 0, left: 0, right: 0 };
  return {
    ...(corner.startsWith('top') ? { top: PANEL_EDGE_PX } : { bottom: PANEL_EDGE_PX }),
    ...(corner.endsWith('left') ? { left: PANEL_LEFT_PX } : { right: PANEL_RIGHT_PX }),
  };
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
  const { route } = useCurrentHelpRoute();
  const { hasPermission } = usePermissions();
  const { isOpen, tab, guide, spotlight, messages, open, close, setTab } = useHelpAssistant();

  const [catalog, setCatalog] = React.useState<HelpCatalog | null>(null);
  const [catalogError, setCatalogError] = React.useState(false);
  const [pendingRequired, setPendingRequired] = React.useState<number | null>(null);
  const [thinking, setThinking] = React.useState(false);
  const [lookAt, setLookAt] = React.useState<{ x: number; y: number } | null>(null);
  const [targetRect, setTargetRect] = React.useState<Rect | null>(null);
  const [panelCorner, setPanelCorner] = React.useState<PanelCorner>('bottom-right');
  const panelRef = React.useRef<HTMLDivElement | null>(null);

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

  // Catálogo: en diferido, o enseguida si se abre el panel.
  React.useEffect(() => {
    if (catalog) return;
    let cancelled = false;
    const load = () => loadHelpCatalog()
      .then((c) => { if (!cancelled) setCatalog(c); })
      .catch(() => { if (!cancelled) setCatalogError(true); });
    const timer = setTimeout(load, isOpen ? 0 : CATALOG_IDLE_DELAY_MS);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [catalog, isOpen]);

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

  // Badge del lanzador y primera apertura automática para clínicas sin configurar.
  React.useEffect(() => {
    if (!catalog || !canSeeOnboarding) return;
    const controller = new AbortController();
    getOnboardingStatus(controller.signal)
      .then((res) => {
        const done = new Set(res.steps.filter((s) => s.status !== 'pending').map((s) => s.step_id));
        const pending = catalog.journey.filter((s) => s.required && !done.has(s.id)).length;
        setPendingRequired(pending);
        if (pending > 0 && !readStorage('session', AUTO_OPEN_KEY)) {
          writeStorage('session', AUTO_OPEN_KEY, '1');
          open('onboarding');
        }
      })
      .catch(() => { /* el badge es opcional */ });
    return () => controller.abort();
  }, [catalog, canSeeOnboarding, open]);

  // Los ojos de la mascota siguen al elemento resaltado, y el panel de pasos lo esquiva.
  React.useEffect(() => {
    if (!spotlight) { setLookAt(null); setTargetRect(null); return; }
    const update = () => {
      const target = findHelpTarget(spotlight.targetId);
      if (!target) return;
      const r = target.highlight.getBoundingClientRect();
      setLookAt({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
      setTargetRect((prev) => (prev && Math.abs(prev.top - r.top) < 1 && Math.abs(prev.left - r.left) < 1 && Math.abs(prev.height - r.height) < 1 ? prev : toRect(r)));
    };
    update();
    const interval = setInterval(update, 400);
    return () => clearInterval(interval);
  }, [spotlight]);

  const guideActive = !!guide;
  const showPanel = isOpen || guideActive;

  // Durante una guía el panel de pasos va a la primera esquina que no tapa el elemento resaltado.
  React.useLayoutEffect(() => {
    if (!guideActive || !targetRect || !panelRef.current) { setPanelCorner('bottom-right'); return; }
    const { width, height } = panelRef.current.getBoundingClientRect();
    const free = PANEL_CORNERS.find((corner) => !intersects(cornerRect(corner, width, height), targetRect, 12));
    setPanelCorner(free ?? 'bottom-right');
  }, [guideActive, targetRect]);

  // Los clics en el panel no deben cerrar el diálogo de Radix abierto debajo.
  React.useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const stop = (e: Event) => e.stopPropagation();
    el.addEventListener('pointerdown', stop);
    return () => el.removeEventListener('pointerdown', stop);
  }, [showPanel]);
  // Apenada si el paso actual falló o la última respuesta no encontró ayuda.
  const guideFailed = !!guide && guide.statuses[guide.current] === 'failed';
  const lastMessage = messages[messages.length - 1];
  const lastReplySad = tab === 'chat' && lastMessage?.role === 'assistant' && !!lastMessage.reply && isSadReply(lastMessage.reply);
  const mascotState: InvokeMascotState = thinking
    ? 'thinking'
    : guideFailed || (lastReplySad && !guide)
      ? 'sad'
      : guide?.finished || pendingRequired === 0 ? 'happy' : 'idle';
  const activeTab: HelpAssistantTab = tab === 'onboarding' && !canSeeOnboarding ? 'chat' : tab;

  const tabs: { id: HelpAssistantTab; icon: React.ElementType; label: string; visible: boolean }[] = [
    { id: 'onboarding', icon: ListChecks, label: t('tabs.onboarding'), visible: canSeeOnboarding },
    { id: 'chat', icon: MessageCircleQuestion, label: t('tabs.chat'), visible: true },
    { id: 'screen', icon: BookOpen, label: t('tabs.screen'), visible: true },
  ];

  return (
    <HelpScopeProvider scope="help-assistant">
      <div data-help-ignore>
        <GuideSpotlight />

        {!showPanel && (
          <MascotLauncher
            label={t('open')}
            pending={pendingRequired}
            state={thinking ? 'thinking' : undefined}
            onOpen={() => open()}
          />
        )}

        {showPanel && (
          <div
            ref={panelRef}
            role="dialog"
            aria-label={t('title')}
            // La burbuja y la manito del spotlight esquivan este panel.
            data-help-guide-panel={guideActive ? '' : undefined}
            // Con algo resaltado, el panel queda por encima del oscurecido: es parte de la guía.
            style={{
              pointerEvents: 'auto',
              zIndex: spotlight ? HELP_PANEL_Z_ON_SPOTLIGHT : undefined,
              ...(guideActive ? cornerStyle(panelCorner) : {}),
            }}
            className={cn(
              'fixed z-[9985] flex flex-col overflow-hidden border border-border bg-card text-card-foreground shadow-2xl',
              guideActive
                ? 'max-h-[40dvh] rounded-2xl sm:max-h-[min(420px,55vh)] sm:w-80'
                : 'inset-x-0 bottom-0 h-[75dvh] rounded-t-2xl sm:inset-x-auto sm:bottom-4 sm:right-[4.5rem] sm:h-[min(640px,78vh)] sm:w-[400px] sm:rounded-2xl',
            )}
          >
            <div className="flex flex-none items-center gap-2 border-b bg-gradient-to-r from-primary/10 via-transparent to-transparent px-3 py-2">
              <InvokeMascot state={mascotState} lookAt={lookAt} className="h-10 w-10 flex-none" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{guideActive ? t('guideTitle') : t('title')}</p>
                <p className="truncate text-[11px] text-muted-foreground">{guideActive ? t('guideSubtitle') : t('subtitle')}</p>
              </div>
              {!guideActive && (
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={close} aria-label={t('close')}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {guideActive ? (
              <GuidePanel />
            ) : (
              <>
                <div className="flex flex-none gap-1 border-b px-2 py-1.5" role="tablist">
                  {tabs.filter((x) => x.visible).map(({ id, icon: Icon, label }) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={activeTab === id}
                      onClick={() => setTab(id)}
                      className={cn(
                        'flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                        activeTab === id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </button>
                  ))}
                </div>
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
                ) : activeTab === 'onboarding' ? (
                  <OnboardingChecklist catalog={catalog} onPendingChange={setPendingRequired} />
                ) : activeTab === 'chat' ? (
                  <HelpChat catalog={catalog} onThinkingChange={setThinking} />
                ) : (
                  <ScreenHelp key={route} catalog={catalog} />
                )}
              </>
            )}
          </div>
        )}
      </div>
    </HelpScopeProvider>
  );
}
