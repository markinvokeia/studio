/**
 * Acceso al catálogo generado (src/generated/help-catalog.json). Se carga con
 * import dinámico — ~25 KB gzip — sólo cuando el asistente se abre.
 *
 * La búsqueda local es el respaldo cuando el backend no responde: sin IA, pero
 * con la ficha de la pantalla y la guía más parecida, que ya alcanza para
 * "Llevarme ahí" y "Guiarme".
 */

import { routeToHelpScope } from '@/lib/help/help-id';

import type { HelpAssistantLink, HelpAssistantReply, HelpCatalog, HelpCatalogElement, HelpCatalogScreen, HelpGuideStep, HelpUseCase } from '@/lib/types';

let cached: Promise<HelpCatalog> | null = null;

export function loadHelpCatalog(): Promise<HelpCatalog> {
  if (!cached) {
    cached = import('@/generated/help-catalog.json')
      .then((m) => (m.default ?? m) as unknown as HelpCatalog)
      .catch((error) => { cached = null; throw error; });
  }
  return cached;
}

export function findScreen(catalog: HelpCatalog, scope: string): HelpCatalogScreen | undefined {
  return catalog.screens.find((s) => s.id === scope);
}

export function findUseCase(catalog: HelpCatalog, id: string | null | undefined): HelpUseCase | undefined {
  return id ? catalog.useCases.find((u) => u.id === id) : undefined;
}

const normalize = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const words = (v: string) => normalize(v).split(/[^a-z0-9]+/).filter((w) => w.length >= 3);

export interface LocalSearchResult {
  useCase?: HelpUseCase;
  screen?: HelpCatalogScreen;
}

/** Puntaje por palabras compartidas (con prefijo): título y keywords pesan más que el resumen. */
export function searchCatalogLocally(catalog: HelpCatalog, query: string): LocalSearchResult {
  const q = words(query);
  if (!q.length) return {};
  const score = (strong: string, weak: string) => {
    const s = words(strong);
    const w = words(weak);
    return q.reduce((acc, word) =>
      acc + (s.some((x) => x.startsWith(word) || word.startsWith(x)) ? 3 : 0) + (w.some((x) => x.startsWith(word)) ? 1 : 0), 0);
  };
  const best = <T,>(items: T[], fn: (item: T) => number) => {
    let top: T | undefined;
    let topScore = 0;
    for (const item of items) {
      const s = fn(item);
      if (s > topScore) { top = item; topScore = s; }
    }
    return topScore >= 3 ? top : undefined;
  };
  return {
    useCase: best(catalog.useCases, (u) => score(`${u.title} ${(u.keywords ?? []).join(' ')}`, u.summary ?? '')),
    screen: best(catalog.screens.filter((s) => s.inMenu), (s) => score(s.title, `${s.module ?? ''} ${s.summary ?? ''}`)),
  };
}

export interface ResolvedGuide {
  title: string;
  steps: HelpGuideStep[];
  useCaseId?: string;
}

/** Ruta a la que lleva un caso de uso (su primer paso `navigate`). */
export function routeOfUseCase(useCase: HelpUseCase): string | undefined {
  return useCase.steps.find((s) => s.action === 'navigate')?.route;
}

/** La guía principal de una pantalla: la que empieza ahí o la que la declara. */
export function guideUseCaseForRoute(catalog: HelpCatalog, route: string): HelpUseCase | undefined {
  const scope = routeToHelpScope(route);
  return catalog.useCases.find((u) => routeOfUseCase(u) === route) ?? catalog.useCases.find((u) => u.screens.includes(scope));
}

const TOUR_KIND_ORDER: Record<string, number> = { filter: 0, btn: 1, tab: 2, section: 3, field: 4 };
const TOUR_MAX_STEPS = 6;

/**
 * Recorrido por una pantalla sin guía propia: señala sus elementos principales
 * de a uno. Sin `isVisible` (pantalla a la que todavía hay que ir) se omiten los
 * campos, que suelen vivir en diálogos cerrados; los pasos cuyo elemento no
 * aparece se saltan solos.
 */
export function screenTour(screen: HelpCatalogScreen, title: string, isVisible?: (id: string) => boolean): ResolvedGuide | null {
  const pick = (e: HelpCatalogElement) =>
    e.kind !== 'nav' && !e.id.endsWith('.btn.submit') && !e.id.endsWith('.btn.refresh')
    && (isVisible ? isVisible(e.id) : e.kind !== 'field');
  const elements = screen.elements
    .filter(pick)
    .sort((a, b) => (TOUR_KIND_ORDER[a.kind] ?? 9) - (TOUR_KIND_ORDER[b.kind] ?? 9) || Number(!a.description) - Number(!b.description))
    .slice(0, TOUR_MAX_STEPS);
  const steps: HelpGuideStep[] = [
    { id: 'go', action: 'navigate', route: screen.route, title: screen.title },
    ...elements.map((e, i) => ({
      id: `tour-${i + 1}`,
      action: 'highlight' as const,
      target: e.id,
      title: e.label ?? e.id,
      description: e.description ?? screen.summary,
      skipIfMissing: true,
    })),
  ];
  return elements.length ? { title, steps } : null;
}

const SUGGESTIONS_MAX = 3;

/**
 * Guías de una pantalla ordenadas por parecido con lo que escribió la persona
 * (título y keywords pesan más que el resumen). Con `query` vacío, en su orden.
 */
export function rankScreenUseCases(catalog: HelpCatalog, scope: string, query: string): HelpUseCase[] {
  const q = words(query);
  const own = catalog.useCases.filter((u) => u.screens.includes(scope));
  const score = (u: HelpUseCase) => {
    const strong = words(`${u.title} ${(u.keywords ?? []).join(' ')}`);
    const weak = words(u.summary ?? '');
    return q.reduce((acc, word) => acc + (strong.some((x) => x.startsWith(word) || word.startsWith(x)) ? 3 : 0) + (weak.some((x) => x.startsWith(word)) ? 1 : 0), 0);
  };
  return own.map((u) => ({ u, s: score(u) })).sort((a, b) => b.s - a.s).map(({ u }) => u);
}

/**
 * Toda respuesta del asistente ofrece "Llevarme" y "Guiarme". Las guías son
 * siempre las predefinidas del catálogo: las que propone el agente (hasta 3) o,
 * si no propuso ninguna, las de la pantalla más parecidas a la pregunta; como
 * último recurso, un recorrido de la pantalla.
 */
export function resolveReplyActions(
  catalog: HelpCatalog,
  reply: HelpAssistantReply,
  currentRoute: string,
  tourTitle: (screenTitle: string) => string,
  question = '',
): { guide: ResolvedGuide | null; suggestions: ResolvedGuide[]; links: HelpAssistantLink[] } {
  let links = reply.links ?? [];
  const toGuide = (u: HelpUseCase): ResolvedGuide => ({ title: u.title, steps: u.steps, useCaseId: u.id });
  let useCases = [...(reply.useCaseIds ?? []), reply.useCaseId]
    .map((id) => findUseCase(catalog, id))
    .filter((u, i, all): u is HelpUseCase => !!u && all.findIndex((x) => x?.id === u.id) === i);
  if (!useCases.length) {
    // Las guías de la pantalla del link (o la actual) más parecidas a la pregunta.
    const scopes = [...links.map((l) => routeToHelpScope(l.route)), routeToHelpScope(currentRoute)];
    for (const scope of scopes) {
      useCases = rankScreenUseCases(catalog, scope, question);
      if (useCases.length) break;
    }
    if (!useCases.length) {
      const byRoute = links.map((l) => guideUseCaseForRoute(catalog, l.route)).find(Boolean);
      if (byRoute) useCases = [byRoute];
    }
  }
  useCases = useCases.slice(0, SUGGESTIONS_MAX);
  if (!links.length) {
    const route = useCases[0] ? routeOfUseCase(useCases[0]) : undefined;
    const screen = route ? findScreen(catalog, routeToHelpScope(route)) : undefined;
    if (route && screen) links = [{ route, label: screen.title }];
  }
  let guide: ResolvedGuide | null = useCases[0] ? toGuide(useCases[0]) : null;
  if (!guide) {
    const screen = findScreen(catalog, routeToHelpScope(links[0]?.route ?? currentRoute));
    guide = screen ? screenTour(screen, tourTitle(screen.title)) : null;
  }
  return { guide, suggestions: useCases.map(toGuide), links };
}
