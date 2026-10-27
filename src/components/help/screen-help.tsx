'use client';

import { ChevronRight, Eye, Info, Lightbulb, ListChecks, ListTree, PlayCircle, Route } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { Button } from '@/components/ui/button';

import { useCurrentHelpRoute } from '@/hooks/use-current-help-route';
import { findScreen, findUseCase, screenTour } from '@/lib/help/catalog';
import { findHelpTarget } from '@/lib/help/guide-engine';
import { startGuide } from '@/lib/help/guide-runner';
import { cn } from '@/lib/utils';
import { useHelpAssistant } from '@/stores/help-assistant-store';

import type { HelpCatalog, HelpCatalogElement } from '@/lib/types';

/** "¿Qué es esto?": la ficha de la pantalla actual, desde el catálogo. */
export function ScreenHelp({ catalog }: { catalog: HelpCatalog }) {
  const t = useTranslations('HelpAssistant.screen');
  const router = useRouter();
  const locale = useLocale();
  const { scope } = useCurrentHelpRoute();
  const setSpotlight = useHelpAssistant((s) => s.setSpotlight);
  const screen = findScreen(catalog, scope);

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
  const prerequisites = (screen.prerequisites ?? []).map((id) => findScreen(catalog, id)).filter((s) => !!s);

  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3 text-sm">
      <div>
        <p className="text-base font-semibold">{screen.title}</p>
        {screen.module && <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{screen.module}</p>}
        {screen.summary && <p className="mt-1.5 leading-relaxed">{screen.summary}</p>}
        {screen.purpose && <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{screen.purpose}</p>}
        {screen.status === 'auto' && (
          <p className="mt-2 flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground">
            <Info className="h-3.5 w-3.5 flex-none" />
            {t('autoOnly')}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        {tour && (
          <Button size="sm" className="h-8 justify-start gap-1.5 text-xs" onClick={() => startGuide(tour, { returnTo: 'screen' })}>
            <Route className="h-3.5 w-3.5" />
            {t('tourCta')}
          </Button>
        )}
      </div>

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
                        <Button key={u.id} variant="outline" size="sm" className="h-auto justify-start whitespace-normal py-1.5 text-left text-xs"
                          onClick={() => startGuide({ title: u.title, steps: u.steps }, { useCaseId: u.id, returnTo: 'screen' })}>
                          {u.title}
                        </Button>
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
  );
}

/** Título de una sección que se abre y cierra (Guías de esta pantalla, Campos y botones). */
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
