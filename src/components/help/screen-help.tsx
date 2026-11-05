'use client';

import { ChevronRight, Eye, Info, Lightbulb, ListChecks, ListTree, PlayCircle, Route, Video } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import * as React from 'react';

import { Button } from '@/components/ui/button';

import { HelpVideoThumb } from '@/components/help/help-video-thumb';

import { useCurrentHelpRoute } from '@/hooks/use-current-help-route';
import { findScreen, findUseCase, screenTour } from '@/lib/help/catalog';
import { findHelpTarget } from '@/lib/help/guide-engine';
import { startGuide } from '@/lib/help/guide-runner';
import { cn } from '@/lib/utils';
import { useHelpAssistant } from '@/stores/help-assistant-store';
import { useHelpVideo, useHelpVideoList } from '@/stores/help-video-store';

import type { HelpCatalog, HelpCatalogElement, HelpVideo } from '@/lib/types';

/** "¿Qué es esto?": la ficha de la pantalla actual, desde el catálogo. */
export function ScreenHelp({ catalog }: { catalog: HelpCatalog }) {
  const t = useTranslations('HelpAssistant.screen');
  const tChat = useTranslations('HelpAssistant.chat');
  const router = useRouter();
  const locale = useLocale();
  const { scope } = useCurrentHelpRoute();
  const setSpotlight = useHelpAssistant((s) => s.setSpotlight);
  const screen = findScreen(catalog, scope);
  // Videos grabados (uno por guía, en el idioma de la app o el español): "Ver video" junto a "Guiarme".
  const videos = useHelpVideoList((s) => s.byLocale[locale]);
  const loadVideos = useHelpVideoList((s) => s.load);
  React.useEffect(() => { loadVideos(locale); }, [loadVideos, locale]);
  const openVideo = useHelpVideo((s) => s.open);

  // The assistant's window: the "about" bubble is drawn inside it (see AboutScreen)
  const [container, setContainer] = React.useState<HTMLElement | null>(null);
  const rootRef = React.useCallback((el: HTMLDivElement | null) => {
    setContainer((el?.closest('[data-help-window]') as HTMLElement | null) ?? null);
  }, []);

  // Sólo se ofrece "Mostrar" para lo que está en pantalla ahora (un diálogo cerrado no se puede resaltar).
  const [visibleIds, setVisibleIds] = React.useState<Set<string>>(new Set());
  React.useEffect(() => {
    if (!screen) return;
    const check = () => setVisibleIds(new Set(screen.elements.filter((e) => findHelpTarget(e.id)).map((e) => e.id)));
    check();
    const interval = setInterval(check, 1500);
    return () => clearInterval(interval);
  }, [screen]);

  // Las guías se ven de entrada (sus grupos, colapsados); los campos y botones, a pedido.
  const [guidesOpen, setGuidesOpen] = React.useState(true);
  const [elementsOpen, setElementsOpen] = React.useState(false);
  // Los grupos de guías arrancan colapsados: con muchas guías (la ficha del paciente) la lista no se hace eterna.
  const [openGroups, setOpenGroups] = React.useState<Set<string>>(new Set());
  const toggleGroup = (name: string) =>
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  if (!screen) {
    return <p className="p-4 text-sm text-muted-foreground">{t('noScreen')}</p>;
  }

  const show = (el: HelpCatalogElement) =>
    setSpotlight({ targetId: el.id, title: el.label ?? el.id, description: el.description, mode: 'info' });

  const documented = screen.elements.filter((e) => e.description || visibleIds.has(e.id));
  // Guiar siempre disponible: recorrido por lo que se ve ahora (si no se ve nada, por lo principal).
  const tour = screenTour(screen, t('tourTitle', { screen: screen.title }), visibleIds.size ? (id) => visibleIds.has(id) : undefined);
  const useCases = (screen.useCases ?? []).map((id) => findUseCase(catalog, id)).filter((u) => !!u);
  // Pantallas con muchas guías (p. ej. la ficha del paciente) las agrupan por pestaña, en el orden de la ficha.
  const useCaseGroups = useCases.reduce<{ name?: string; items: typeof useCases }[]>((groups, u) => {
    const last = groups[groups.length - 1];
    if (last && last.name === u.group) last.items.push(u);
    else groups.push({ name: u.group, items: [u] });
    return groups;
  }, []);
  const tourVideo = videos?.[`tour.${screen.id}`];
  const prerequisites = (screen.prerequisites ?? []).map((id) => findScreen(catalog, id)).filter((s) => !!s);

  return (
    <div ref={rootRef} className="flex min-h-0 flex-1 flex-col text-sm">
      {/* Fijo arriba: título y recorrido. La descripción va en un globo al costado, así las guías tienen el espacio */}
      <div className="flex shrink-0 flex-col gap-2 border-b px-4 pb-2.5 pt-3">
        <div className="flex items-start gap-1.5">
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold leading-tight">{screen.title}</p>
            {screen.module && <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{screen.module}</p>}
          </div>
          {(screen.summary || screen.purpose || screen.status === 'auto') && (
            <AboutScreen container={container} label={t('about')}>
              {screen.summary && <p className="leading-relaxed">{screen.summary}</p>}
              {screen.purpose && <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{screen.purpose}</p>}
              {screen.status === 'auto' && (
                <p className="mt-2 flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                  <Info className="h-3.5 w-3.5 flex-none" />
                  {t('autoOnly')}
                </p>
              )}
            </AboutScreen>
          )}
        </div>
        {tour && (
          <div className="flex gap-1.5">
            <Button size="sm" className="h-8 flex-1 justify-start gap-1.5 text-xs" onClick={() => startGuide(tour, { returnTo: 'screen' })}>
              <Route className="h-3.5 w-3.5" />
              {t('tourCta')}
            </Button>
            {tourVideo && (
              <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => openVideo({ ...tourVideo, title: tour.title })}>
                <Video className="h-3.5 w-3.5" />
                {tChat('watchVideo')}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Un solo scroll para todo lo demás: con muchas guías o grupos, se baja y se ven todos */}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-3 [scrollbar-width:thin]">
        {useCases.length > 0 && (
          <section>
            <SectionToggle icon={PlayCircle} label={t('guides')} count={useCases.length} open={guidesOpen} onToggle={() => setGuidesOpen((v) => !v)} />
            {guidesOpen && (
            <div className="flex flex-col gap-1.5">
              {useCaseGroups.map((group, i) => {
                const isOpen = !group.name || openGroups.has(group.name);
                return (
                  <div key={group.name ?? i} className="flex flex-col gap-1">
                    {group.name && (
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => toggleGroup(group.name!)}
                        className="flex items-center gap-1.5 rounded-md px-1 py-1 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <ChevronRight className={cn('h-3.5 w-3.5 flex-none transition-transform', isOpen && 'rotate-90')} />
                        <span className="min-w-0 flex-1 truncate">{group.name}</span>
                        <span className="flex-none rounded-full bg-muted px-1.5 text-[10px] font-medium normal-case tracking-normal">{group.items.length}</span>
                      </button>
                    )}
                    {isOpen && (
                      <div className={cn('flex flex-col gap-1', group.name && 'pl-2')}>
                        {group.items.map((u) => (
                          <GuideRow
                            key={u.id}
                            title={u.title}
                            video={videos?.[u.id]}
                            guideLabel={tChat('guideMe')}
                            videoLabel={tChat('watchVideo')}
                            videoOfLabel={tChat('watchVideoOf', { title: u.title })}
                            locale={locale}
                            onGuide={() => startGuide({ title: u.title, steps: u.steps }, { useCaseId: u.id, returnTo: 'screen' })}
                            onVideo={(v) => openVideo({ ...v, title: u.title })}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            )}
          </section>
        )}

        {prerequisites.length > 0 && (
          <section>
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold"><ListChecks className="h-3.5 w-3.5" />{t('prerequisites')}</p>
            <div className="flex flex-wrap gap-1">
              {prerequisites.map((p) => (
                <Button key={p.id} variant="secondary" size="sm" className="h-6 px-2 text-[11px]" onClick={() => router.push(`/${locale}${p.route === '/' ? '' : p.route}`)}>
                  {p.title}
                </Button>
              ))}
            </div>
          </section>
        )}

        {(screen.tips?.length ?? 0) > 0 && (
          <section>
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold"><Lightbulb className="h-3.5 w-3.5" />{t('tips')}</p>
            <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
              {screen.tips!.map((tip) => <li key={tip}>{tip}</li>)}
            </ul>
          </section>
        )}

        {documented.length > 0 && (
          <section>
            <SectionToggle icon={ListTree} label={t('elements')} count={documented.length} open={elementsOpen} onToggle={() => setElementsOpen((v) => !v)} />
            {elementsOpen && (
            <ul className="divide-y rounded-lg border">
              {documented.map((el) => (
                <li key={el.id} className="flex items-start gap-2 px-2.5 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium">{el.label ?? el.id}</p>
                    {el.description && <p className="text-[11px] leading-snug text-muted-foreground">{el.description}</p>}
                  </div>
                  {visibleIds.has(el.id) && (
                    <Button variant="ghost" size="sm" className="h-6 flex-none gap-1 px-1.5 text-[11px]" onClick={() => show(el)}>
                      <Eye className="h-3 w-3" />
                      {t('show')}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

/**
 * "Sobre esta pantalla": la descripción, en un globo a la izquierda de la ventana que apunta al
 * título. Se abre al pasar el mouse o al tocar el ícono. Se dibuja dentro de la ventana del
 * asistente (`container`): sus clics no cierran el diálogo que haya abierto debajo.
 */
const BUBBLE_WIDTH = 320;
const BUBBLE_GAP = 12;

function AboutScreen({ container, label, children }: { container: HTMLElement | null; label: string; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  // Outside the window, on the side with room (the window may sit on either side of the screen),
  // pointing at the title from the window's edge
  const [place, setPlace] = React.useState<{ side: 'left' | 'right'; offset: number }>({ side: 'left', offset: BUBBLE_GAP });
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const closeTimer = React.useRef<number | undefined>(undefined);
  const measure = () => {
    const panel = container?.getBoundingClientRect();
    const trigger = triggerRef.current?.getBoundingClientRect();
    if (!panel || !trigger) return;
    const side = panel.left >= BUBBLE_WIDTH + BUBBLE_GAP * 2 || panel.left > window.innerWidth - panel.right ? 'left' : 'right';
    setPlace({ side, offset: (side === 'left' ? trigger.left - panel.left : panel.right - trigger.right) + BUBBLE_GAP });
  };
  const show = () => { window.clearTimeout(closeTimer.current); measure(); setOpen(true); };
  const hide = () => { closeTimer.current = window.setTimeout(() => setOpen(false), 150); };
  React.useEffect(() => () => window.clearTimeout(closeTimer.current), []);
  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          ref={triggerRef}
          type="button"
          onClick={measure}
          onMouseEnter={show}
          onMouseLeave={hide}
          className={cn('grid h-7 w-7 flex-none place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground', open && 'bg-muted text-foreground')}
          aria-label={label}
          title={label}
        >
          <Info className="h-4 w-4" />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal container={container ?? undefined}>
        <PopoverPrimitive.Content
          side={place.side}
          align="start"
          alignOffset={-14}
          sideOffset={place.offset}
          avoidCollisions={false}
          collisionPadding={12}
          onMouseEnter={show}
          onMouseLeave={hide}
          onOpenAutoFocus={(e) => e.preventDefault()}
          style={{ width: BUBBLE_WIDTH }}
          className="z-50 max-w-[calc(100vw-2rem)] rounded-2xl border-2 border-[#7C3AED]/25 bg-white p-3.5 text-sm text-card-foreground shadow-[0_12px_32px_rgba(60,20,90,0.22)] outline-none animate-in fade-in dark:bg-card"
        >
          {children}
          <PopoverPrimitive.Arrow width={14} height={8} className="fill-white dark:fill-card" />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

/** Título de una sección que se abre y cierra (Guías de esta pantalla, Campos y botones). */
/** Una guía de la pantalla: Guiarme y, si está grabada, su miniatura y Ver video (como en el chat). */
function GuideRow({ title, video, guideLabel, videoLabel, videoOfLabel, locale, onGuide, onVideo }: {
  title: string;
  video?: HelpVideo;
  guideLabel: string;
  videoLabel: string;
  videoOfLabel: string;
  locale: string;
  onGuide: () => void;
  onVideo: (video: HelpVideo) => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border p-1.5">
      {video && <HelpVideoThumb video={video} label={videoOfLabel} onPlay={() => onVideo(video)} />}
      <div className="min-w-0 flex-1 space-y-1 px-0.5">
        <p className="text-xs font-medium leading-snug">{title}</p>
        <div className="flex flex-wrap gap-1">
          <Button size="sm" className="h-6 gap-1 rounded-full px-2 text-[11px]" onClick={onGuide}>
            <PlayCircle className="h-3 w-3" />
            {guideLabel}
          </Button>
          {video && (
            <Button size="sm" variant="outline" className="h-6 gap-1 rounded-full px-2 text-[11px]" onClick={() => onVideo(video)}>
              <Video className="h-3 w-3" />
              {videoLabel}
              {video.locale && video.locale.slice(0, 2) !== locale.slice(0, 2) && (
                <span className="rounded bg-muted px-1 text-[9px] font-semibold uppercase text-muted-foreground">{video.locale.slice(0, 2)}</span>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionToggle({ icon: Icon, label, count, open, onToggle }: { icon: React.ComponentType<{ className?: string }>; label: string; count: number; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onToggle}
      className="mb-1.5 flex w-full items-center gap-1.5 rounded-md px-1 py-1 text-left text-xs font-semibold transition-colors hover:bg-muted"
    >
      <ChevronRight className={cn('h-3.5 w-3.5 flex-none text-muted-foreground transition-transform', open && 'rotate-90')} />
      <Icon className="h-3.5 w-3.5 flex-none" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="flex-none rounded-full bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">{count}</span>
    </button>
  );
}
