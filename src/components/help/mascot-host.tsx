'use client';

import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import * as React from 'react';

import { MascotProvider, useMascot, useMascotRouteTravel, type MascotController } from '@/components/invoke-mascot';

import { useAuth } from '@/context/AuthContext';
import { useMascotHome, useMascotPreference } from '@/hooks/use-mascot-preference';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { waitForHelpTarget } from '@/lib/help/guide-engine';
import { stopGuide } from '@/lib/help/guide-runner';
import { MASCOT_SIZE, placeGuideMascot } from '@/lib/help/placement';
import { useHelpAssistant, type HelpSpotlight } from '@/stores/help-assistant-store';

import { HELP_PERMISSIONS } from '@/constants/permissions';

/** Por encima del contenido y del sidebar, por debajo del riel (z-50) y de los diálogos de Radix (z-50). */
const MASCOT_Z = 45;
/** Durante una guía señala por encima de diálogos, del oscurecido y de la barra de pasos. */
const MASCOT_Z_GUIDING = 2147483601;
const IDLE_AFTER_MS = 45_000;
const SLEEP_AFTER_MS = 3 * 60 * 60 * 1000;
const SIDEBAR_PX = 80;
const MOBILE_TOPBAR_PX = 48;
const MOBILE_FOOTER_PX = 24;
const MOBILE_BREAKPOINT_PX = 640;
/** Navegación que tarda más que esto (en desarrollo, Next compila la pantalla): "cargando". */
const SLOW_NAVIGATION_MS = 500;
/** Tras festejar el final de una guía, se cierra sola. */
const FINISHED_CLOSE_MS = 3200;
/** Con el chat abierto y sin actividad, cada cuánto hace un gesto invitando a escribir. */
const CHAT_NUDGE_MS = 11_000;

/** Lo que dice la mascota en su globo mientras señala un paso. */
function stepSpeech(spot: HelpSpotlight): string {
  const parts = spot.mode === 'action' ? [spot.title] : [spot.title, spot.description, spot.details];
  return parts.filter(Boolean).map((p) => p!.trim().replace(/[.:]$/, '')).join('. ') + '.';
}

/** Márgenes para el anclaje: el riel derecho (si está expandido) y el sidebar. */
function useMascotInsets() {
  const [insets, setInsets] = React.useState({ top: 0, right: 0, bottom: 0, left: 0 });
  React.useEffect(() => {
    const measure = () => {
      const mobile = window.innerWidth < MOBILE_BREAKPOINT_PX;
      const rail = document.querySelector('[data-help-rail]')?.getBoundingClientRect();
      const next = mobile
        ? { top: MOBILE_TOPBAR_PX, right: 0, bottom: MOBILE_FOOTER_PX, left: 0 }
        : { top: 0, right: rail && rail.width > 0 ? rail.width : 0, bottom: 0, left: SIDEBAR_PX };
      setInsets((prev) => (prev.top === next.top && prev.right === next.right && prev.bottom === next.bottom && prev.left === next.left ? prev : next));
    };
    measure();
    // El riel se colapsa/expande sin evento propio: se mide cada tanto.
    const interval = setInterval(measure, 1000);
    window.addEventListener('resize', measure);
    return () => { clearInterval(interval); window.removeEventListener('resize', measure); };
  }, []);
  return insets;
}

/**
 * Monta la mascota de Invoke (src/components/invoke-mascot) para el staff con
 * acceso al asistente y la conecta con el asistente guiado. Va en el layout
 * autenticado, envolviendo el header (su riel es el escondite) y el asistente.
 */
export function MascotHost({ children }: { children: React.ReactNode }) {
  const t = useTranslations('HelpAssistant.mascot');
  const { user } = useAuth();
  const { hasPermission, isLoading } = usePermissions();
  const [showMascot] = useMascotPreference(user?.id);
  const guiding = useHelpAssistant((s) => !!s.spotlight);
  // Se arrastra sólo en reposo: sin guía ni chat abierto.
  const idle = useHelpAssistant((s) => !s.guide && !s.isOpen);
  const home = useMascotHome((s) => s.home);
  const setHome = useMascotHome((s) => s.setHome);
  const insets = useMascotInsets();
  const canUse = !isLoading && hasPermission(HELP_PERMISSIONS.ASSISTANT_USE);

  // La mascota es la puerta de entrada al asistente: despierta o sale del escondite y abre el panel.
  const handleClick = React.useCallback((m: MascotController) => {
    m.notifyRequest();
    if (m.enabled && m.phase === 'sleeping') void m.wake();
    else if (m.phase === 'peeking') void m.show();
    useHelpAssistant.getState().open();
  }, []);

  return (
    <MascotProvider
      size={MASCOT_SIZE}
      dock="bottom-right"
      insets={insets}
      idleAfterMs={IDLE_AFTER_MS}
      sleepAfterMs={SLEEP_AFTER_MS}
      enabled={showMascot}
      // Escondida desde sus iconos (o apagada en Preferencias): queda dormida en el riel.
      hidden={!canUse || !showMascot}
      zIndex={guiding ? MASCOT_Z_GUIDING : MASCOT_Z}
      onMascotClick={handleClick}
      label={t('label')}
      // Arrastrándola elige su lugar: a la derecha se esconde tras el riel, a la izquierda
      // tras el menú, arriba o abajo tras el panel del contenido (zonas en header, sidebar y layout).
      home={home}
      draggable={idle}
      onHomeChange={setHome}
      // El globo de cada paso no tapa la barra de pasos.
      bubbleAvoid="[data-help-bubble]"
    >
      {children}
      {canUse && <MascotBridge />}
    </MascotProvider>
  );
}

/** Conecta la mascota con el asistente: rutas, panel, guías y resultados. */
function MascotBridge() {
  const t = useTranslations('HelpAssistant.mascot');
  const { toasts } = useToast();
  const m = useMascot();
  const mRef = React.useRef(m);
  React.useLayoutEffect(() => { mRef.current = m; });
  const pathname = usePathname() ?? '/';
  const hasHome = useMascotHome((s) => !!s.home);
  const spotlight = useHelpAssistant((s) => s.spotlight);
  const guideActive = useHelpAssistant((s) => !!s.guide && !s.guide.finished);
  const hasGuide = useHelpAssistant((s) => !!s.guide);
  const guideFinishedKey = useHelpAssistant((s) => (s.guide?.finished ? s.guide.key : null));
  const guideFailedError = useHelpAssistant((s) => (s.guide && s.guide.statuses[s.guide.current] === 'failed' ? s.guide.error ?? 'targetNotFound' : null));
  const guideTitle = useHelpAssistant((s) => s.guide?.title ?? '');
  const isOpen = useHelpAssistant((s) => s.isOpen);
  const guideLoading = useHelpAssistant((s) => s.guide?.notice ?? null);

  // Al cambiar de página cruza al otro lado, salvo mientras guía (hasta que termina de
  // festejar) o acompaña al chat: ahí la ruta la maneja la guía o el panel.
  const busy = hasGuide || isOpen;
  const [routeKey, setRouteKey] = React.useState(pathname);
  // Con un lugar elegido no cruza de lado: se queda donde la dejaron.
  useMascotRouteTravel(routeKey, { animation: 'teleport', disabled: hasHome });

  // La clave de ruta sólo avanza cuando la mascota está libre. Al terminar de guiar o
  // cerrar el chat: si cambió la página, el hook la cruza; si no, vuelve a su lugar.
  const wasBusy = React.useRef(busy);
  React.useEffect(() => {
    if (!busy) {
      if (wasBusy.current && (routeKey === pathname || hasHome)) void mRef.current.travelTo('home', { animation: 'hop' });
      setRouteKey(pathname);
    }
    wasBusy.current = busy;
  }, [busy, pathname, routeKey, hasHome]);

  // Chat abierto (sin guía): el chat sale arriba de la mascota; ella saluda y, si nadie
  // escribe, cada tanto hace un gesto invitando a pedirle algo.
  React.useEffect(() => {
    if (!isOpen || guideActive) return;
    void mRef.current.gesture('wave', 1400);
    let turn = 0;
    const interval = setInterval(() => {
      const typing = document.activeElement?.closest('[data-help-panel]');
      if (typing || mRef.current.phase !== 'active') return;
      turn += 1;
      void mRef.current.gesture(turn % 2 ? 'nod' : 'wave', 1200);
    }, CHAT_NUDGE_MS);
    return () => clearInterval(interval);
  }, [isOpen, guideActive]);

  // Guías: viaja junto al elemento señalado y lo señala mientras el paso siga ahí.
  React.useEffect(() => {
    if (!spotlight) return;
    const controller = new AbortController();
    const { signal } = controller;
    (async () => {
      const target = await waitForHelpTarget(spotlight.targetId, { signal, timeoutMs: 30_000 }).catch(() => null);
      if (!target || signal.aborted) return;
      // Un frame para que la barra de pasos ya estén ubicados (son obstáculos).
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      if (signal.aborted) return;
      const spot = placeGuideMascot(target.highlight.getBoundingClientRect(), MASCOT_SIZE);
      await mRef.current.travelTo(spot, { animation: 'auto', speed: spotlight.mode === 'action' ? 2 : 1.4 });
      if (signal.aborted) return;
      // El texto del paso sale del globo de la propia mascota mientras señala.
      await mRef.current.pointAt(target.highlight, { highlight: false, duration: Infinity, signal, say: stepSpeech(spotlight) });
    })();
    return () => controller.abort();
  }, [spotlight]);

  // Mientras algo carga, cara de "cargando": la guía esperando una pantalla o un
  // elemento, o una navegación del menú que tarda (en desarrollo, compila la página).
  React.useEffect(() => {
    if (!guideLoading) return;
    // Lo dice en su globo ("Abriendo la pantalla…") con cara de cargando.
    void mRef.current.say(t(`loading.${guideLoading}`), { mood: 'loading', duration: 3500 });
    return () => { void mRef.current.setMood('neutral'); };
  }, [guideLoading, t]);

  const [navigatingTo, setNavigatingTo] = React.useState<string | null>(null);
  React.useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = e.target instanceof Element ? e.target.closest<HTMLAnchorElement>('a[href]') : null;
      if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin === window.location.origin && url.pathname !== window.location.pathname) setNavigatingTo(url.pathname);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);
  React.useEffect(() => { setNavigatingTo(null); }, [pathname]);
  React.useEffect(() => {
    if (!navigatingTo) return;
    let slow = false;
    const timer = setTimeout(() => { slow = true; void mRef.current.setMood('loading'); }, SLOW_NAVIGATION_MS);
    return () => {
      clearTimeout(timer);
      if (slow) void mRef.current.setMood('neutral');
    };
  }, [navigatingTo]);

  // Último paso: festeja, lo dice y la guía se cierra sola.
  React.useEffect(() => {
    if (guideFinishedKey === null) return;
    void mRef.current.say(t('guideFinished', { title: guideTitle }), { mood: 'happy', gesture: 'celebrate', duration: 2600 });
    const timer = setTimeout(() => {
      if (useHelpAssistant.getState().guide?.key === guideFinishedKey) stopGuide();
    }, FINISHED_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [guideFinishedKey, guideTitle, t]);

  // Un paso que no se pudo hacer: triste y explica por qué (la barra queda para reintentar o saltar).
  React.useEffect(() => {
    if (!guideFailedError) return;
    void mRef.current.say(t(`guideError.${guideFailedError}`), { mood: 'sad', duration: 6000 });
  }, [guideFailedError, t]);

  // Cualquier error de la app (un guardado que falló, un timeout): triste, con una frase corta.
  const seenToasts = React.useRef(new Set<string>());
  React.useEffect(() => {
    for (const toast of toasts) {
      if (seenToasts.current.has(toast.id)) continue;
      seenToasts.current.add(toast.id);
      if (toast.variant === 'destructive' && mRef.current.phase !== 'sleeping') {
        void mRef.current.say(t('appError'), { mood: 'sad', duration: 3500 });
      }
    }
  }, [toasts, t]);

  return null;
}
