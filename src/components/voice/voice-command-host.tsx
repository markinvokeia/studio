'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, Check, CheckCircle2, ListChecks, Loader2, Mic, MicOff, Pin, Stethoscope, Volume2, X, XCircle } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';

import { VoiceLabOrderDialogHost } from '@/components/voice/voice-lab-order-dialog-host';
import { VoiceRichText } from '@/components/voice/voice-rich-text';

import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';
import '@/lib/voice/commands';
import { LAB_ORDERS_VOICE_DOMAIN } from '@/lib/voice/commands/lab-orders';
import { answerFromCard, cancelVoice, configureVoiceSession, endPushToTalk, startAlwaysOn, startPushToTalk, stopAlwaysOn, toggleAlwaysOn, updateVoiceDomains, wasAlwaysOn } from '@/lib/voice/session';
import { CORE_VOICE_DOMAIN } from '@/lib/voice/commands/core';
import { isVoiceEscape } from '@/lib/voice/dom-dialog';
import { readSurface } from '@/lib/voice/dom-ui';
import { activeScreenDomains, useVoiceScreenStore } from '@/stores/voice-screen-store';
import { isSpeechRecognitionSupported } from '@/lib/voice/speech-recognition';
import { useVoiceCommand } from '@/stores/voice-command-store';

import type { VoiceCard, VoicePhase } from '@/lib/types';

/** Mantener apretado para hablar. */
const isPushToTalk = (e: KeyboardEvent) => e.code === 'Space' && e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey;

function useRecognitionSupported() {
  const [supported, setSupported] = React.useState(false);
  React.useEffect(() => { setSupported(isSpeechRecognitionSupported()); }, []);
  return supported;
}

/**
 * Comandos de voz: Ctrl+Espacio mantenido (o el micrófono de la pantalla, VoiceCommandButton)
 * para hablar, y la tarjeta flotante con lo que entendió, lo que pregunta y el resultado. Lo monta
 * cada pantalla que tiene comandos de voz, con sus módulos (`domains`, p. ej. Órdenes de
 * laboratorio: ['lab_orders']): solo esos comandos se prueban y solo su contexto va a la IA. Fuera
 * de ella el atajo no hace nada. Sin reconocimiento de voz en el navegador (Firefox) no se monta.
 */
function VoiceCommandHostInner({ domains }: { domains?: readonly string[] }) {
  if (!useRecognitionSupported()) return null;
  return <VoiceCommandRoot domains={domains} />;
}

interface VoiceCommandButtonProps {
  compact?: boolean;
  className?: string;
  /** Help id de la pantalla (`<ruta>.btn.voice`). */
  helpId?: string;
  /** Ayuda del botón con un ejemplo de la pantalla (default: el de órdenes de laboratorio). */
  hint?: string;
}

/**
 * Botón Voz: prende o apaga el micrófono permanente («siempre escuchando»). Prendido y dormido
 * (gris) espera «Invoke …»; atento (violeta) la conversación está abierta.
 */
function VoiceCommandButtonInner({ compact = false, className, helpId = 'rail.btn.voice', hint }: VoiceCommandButtonProps) {
  const t = useTranslations('VoiceCommands');
  const alwaysOn = useVoiceCommand((s) => s.alwaysOn);
  const awake = useVoiceCommand((s) => s.awake);
  const listening = useVoiceCommand((s) => s.phase === 'listening');
  const hearing = useVoiceCommand((s) => s.hearing);
  const suspended = useVoiceCommand((s) => s.suspended);
  // Todos los hooks van antes de este return (si no, React tira la pantalla entera).
  const supported = useRecognitionSupported();
  if (!supported) return null;
  const label = alwaysOn ? t('buttonAwake') : suspended ? t('buttonAsleep') : t('button');
  return (
    <Button
      type="button"
      data-help-id={helpId}
      size="sm"
      variant={alwaysOn && awake ? 'default' : 'outline'}
      className={cn('h-9 gap-1.5', alwaysOn && awake && 'bg-[#7C3AED] text-white hover:bg-[#6D28D9]', alwaysOn && !awake && 'border-[#7C3AED]/50 text-[#5B21B6] dark:text-violet-300', className)}
      aria-pressed={alwaysOn}
      aria-label={label}
      title={hint ?? t('buttonHint')}
      onClick={() => toggleAlwaysOn()}
    >
      <span className="relative inline-flex">
        {alwaysOn ? <Mic className={cn('h-4 w-4', (awake || listening) && 'animate-pulse')} /> : <MicOff className="h-4 w-4" />}
        {alwaysOn && hearing && <span className="absolute -right-1 -top-1 h-2 w-2 animate-ping rounded-full bg-emerald-500" aria-hidden="true" />}
      </span>
      <span className={cn('hidden', !compact && 'sm:inline')}>{label}</span>
    </Button>
  );
}

/**
 * Regla de oro: la voz nunca puede tirar la pantalla. Si algo de la voz falla al dibujarse, se
 * apaga el micrófono, se muestra el botón deshabilitado y la agenda sigue funcionando.
 */
class VoiceErrorBoundary extends React.Component<{ fallback?: React.ReactNode; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error('[voice] UI failed; voice disabled for this screen', error);
    try { cancelVoice(); stopAlwaysOn(); } catch { /* ya está apagada */ }
  }
  render() {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children;
  }
}

function VoiceUnavailableButton({ className }: { className?: string }) {
  const t = useTranslations('VoiceCommands');
  return (
    <Button type="button" size="sm" variant="outline" disabled className={cn('h-9 gap-1.5', className)} title={t('unavailable')} aria-label={t('unavailable')}>
      <MicOff className="h-4 w-4" />
    </Button>
  );
}

/** Comandos de voz de la pantalla (ver VoiceCommandHostInner), protegidos: si fallan, la pantalla sigue. */
export function VoiceCommandHost(props: { domains?: readonly string[] }) {
  return <VoiceErrorBoundary><VoiceCommandHostInner {...props} /></VoiceErrorBoundary>;
}

/** Botón Voz (ver VoiceCommandButtonInner), protegido: si falla, queda deshabilitado. */
export function VoiceCommandButton(props: VoiceCommandButtonProps) {
  return (
    <VoiceErrorBoundary fallback={<VoiceUnavailableButton className={props.className} />}>
      <VoiceCommandButtonInner {...props} />
    </VoiceErrorBoundary>
  );
}

/**
 * Un solo host para toda la app (montado en el riel derecho): el contexto lo dan los módulos que
 * registró la pantalla abierta (useVoiceScreen) más el general (desplazarse…). `domains` fijo solo
 * para pruebas o pantallas sueltas.
 */
function VoiceCommandRoot({ domains: fixed }: { domains?: readonly string[] }) {
  const entries = useVoiceScreenStore((s) => s.entries);
  const domains = React.useMemo(() => [...new Set([...(fixed ?? activeScreenDomains(entries)), CORE_VOICE_DOMAIN])], [fixed, entries]);
  // Estable aunque cambie la identidad del array.
  const domainsKey = domains.join(',');
  const domainsRef = React.useRef(domains);
  React.useLayoutEffect(() => { domainsRef.current = domains; });
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const permissionRef = React.useRef(hasPermission);
  React.useLayoutEffect(() => { permissionRef.current = hasPermission; });

  // Diagnóstico (solo lectura): lo que la voz ve en la pantalla, para las pruebas en la app real.
  React.useEffect(() => {
    const w = window as unknown as { __voiceSurface?: () => Array<{ kind: string; label: string }>; __voiceSurfaceEls?: () => HTMLElement[] };
    w.__voiceSurface = () => (readSurface()?.controls ?? []).map((c) => ({ kind: c.kind, label: c.label }));
    w.__voiceSurfaceEls = () => (readSurface()?.controls ?? []).map((c) => c.element as HTMLElement);
    return () => { delete w.__voiceSurface; delete w.__voiceSurfaceEls; };
  }, []);

  React.useEffect(() => {
    configureVoiceSession({
      locale,
      t: (key, values) => t(key as Parameters<typeof t>[0], values),
      hasPermission: (code) => permissionRef.current(code),
      navigate: (route) => router.push(`/${locale}${route === '/' ? '' : route}`),
      domains: domainsRef.current,
    });
    // El micrófono permanente sigue como se dejó en este navegador.
    if (wasAlwaysOn()) startAlwaysOn();
    return () => {
      stopAlwaysOn();
      configureVoiceSession(null);
    };
  }, [locale, router, t]);

  // Al cambiar de página cambia el contexto, sin apagar el micrófono ni cortar lo que se está haciendo.
  React.useEffect(() => { updateVoiceDomains(domainsKey.split(',')); }, [domainsKey]);

  // Ctrl+Espacio: apretado escucha, al soltar (o al salir de la ventana) se interpreta. Escape cancela.
  React.useEffect(() => {
    let holding = false;
    const release = () => {
      if (!holding) return;
      holding = false;
      void endPushToTalk();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (isPushToTalk(e)) {
        e.preventDefault();
        if (!e.repeat && !holding) {
          holding = true;
          startPushToTalk();
        }
        return;
      }
      // El Escape que manda la propia voz (para cerrar una lista o una ventana) no la corta.
      if (e.key === 'Escape' && !isVoiceEscape(e) && useVoiceCommand.getState().phase !== 'idle') cancelVoice();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === 'Control') release();
    };
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('blur', release);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('blur', release);
      cancelVoice();
    };
  }, []);

  return (
    <>
      <VoiceCardView />
      {domains.includes(LAB_ORDERS_VOICE_DOMAIN) && <VoiceLabOrderDialogHost />}
    </>
  );
}

function PhaseIcon({ phase }: { phase: VoicePhase }) {
  if (phase === 'listening') {
    return (
      <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive/60" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-destructive" />
      </span>
    );
  }
  if (phase === 'speaking') return <Volume2 className="h-3.5 w-3.5 text-[#7C3AED]" aria-hidden="true" />;
  if (phase === 'thinking' || phase === 'running') return <Loader2 className="h-3.5 w-3.5 animate-spin text-[#7C3AED]" aria-hidden="true" />;
  return <Mic className="h-3.5 w-3.5 text-[#7C3AED]" aria-hidden="true" />;
}

const MESSAGE_TONE: Record<NonNullable<VoiceCard['tone']>, string> = {
  info: 'text-foreground',
  confirm: 'text-foreground',
  danger: 'text-destructive font-medium',
  success: 'text-emerald-700 dark:text-emerald-400 font-medium',
  error: 'text-destructive font-medium',
};

function ToneIcon({ tone }: { tone: VoiceCard['tone'] }) {
  if (tone === 'success') return <CheckCircle2 className="mt-px h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />;
  if (tone === 'error') return <XCircle className="mt-px h-3.5 w-3.5 shrink-0 text-destructive" aria-hidden="true" />;
  if (tone === 'danger') return <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0 text-destructive" aria-hidden="true" />;
  return null;
}

const CARD_MARGIN = 12;
const CARD_WIDTH = 320;
/** Una respuesta larga con formato (el agente clínico) va un poco más ancha. */
const CARD_WIDTH_RICH = 380;
const CARD_MIN_WIDTH = 240;
/** Lo que se separa del botón Voz (lugar para la flechita). */
const ANCHOR_GAP = 10;
/** Pegada al botón, la tarjeta ocupa como mucho esto del alto (deja ver la pantalla). */
const ANCHORED_MAX_VH = 0.6;

interface CardPlacement {
  style: React.CSSProperties;
  /** Flechita hacia el botón Voz: en qué borde y a cuánto del principio (o del final) de ese borde. */
  arrow: { side: 'right' | 'top'; offset: number; fromEnd?: boolean } | null;
}

/** El diálogo abierto de más arriba (editar/crear cita, avisos…), o null. */
function topOpenDialog(): HTMLElement | null {
  const open = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]'))
    .filter((el) => !el.closest('[data-voice-card]') && el.offsetWidth > 0);
  return open.length ? open[open.length - 1] : null;
}

/** El botón Voz que se ve (el del riel derecho en escritorio o el de la barra de arriba en el celular). */
function visibleVoiceButton(): HTMLElement | null {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-help-id="rail.btn.voice"]')).find((el) => el.offsetWidth > 0 && el.offsetHeight > 0) ?? null;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));

/**
 * Dónde va la tarjeta. Con un diálogo abierto, al costado donde haya lugar (izquierda, si no
 * derecha) o abajo/arriba sin taparlo: la ventana es lo importante. Si no, sale del botón Voz con
 * una flechita que lo señala (es la voz la que habla): en escritorio a la izquierda del riel
 * derecho; en el celular debajo de la barra de arriba. Si no entra, a la esquina de abajo a la
 * izquierda. Se recalcula cuando cambia la pantalla y al cambiar de tamaño.
 */
function useCardPlacement(rich: boolean): CardPlacement {
  const [placement, setPlacement] = React.useState<CardPlacement>({ style: { left: CARD_MARGIN, bottom: CARD_MARGIN, width: CARD_WIDTH }, arrow: null });
  React.useLayoutEffect(() => {
    let frame = 0;
    let last = '';
    const compute = () => {
      frame = 0;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const width = Math.min(rich ? CARD_WIDTH_RICH : CARD_WIDTH, vw - CARD_MARGIN * 2);
      const dialog = topOpenDialog();
      let next: CardPlacement = { style: { left: CARD_MARGIN, bottom: CARD_MARGIN, width, maxHeight: vh - CARD_MARGIN * 2 }, arrow: null };
      const button = dialog ? null : visibleVoiceButton();
      if (dialog) {
        const r = dialog.getBoundingClientRect();
        const leftSpace = r.left - CARD_MARGIN * 2;
        const rightSpace = vw - r.right - CARD_MARGIN * 2;
        if (leftSpace >= CARD_MIN_WIDTH || rightSpace >= CARD_MIN_WIDTH) {
          const onLeft = leftSpace >= Math.min(width, rightSpace) || leftSpace >= width;
          const w = Math.min(width, onLeft ? leftSpace : rightSpace);
          next.style = onLeft
            ? { left: Math.max(CARD_MARGIN, r.left - CARD_MARGIN - w), bottom: CARD_MARGIN, width: w, maxHeight: vh - CARD_MARGIN * 2 }
            : { left: r.right + CARD_MARGIN, bottom: CARD_MARGIN, width: w, maxHeight: vh - CARD_MARGIN * 2 };
        } else if (vh - r.bottom >= r.top) {
          next.style = { left: CARD_MARGIN, bottom: CARD_MARGIN, width, maxHeight: Math.max(120, vh - r.bottom - CARD_MARGIN * 2) };
        } else {
          next.style = { left: CARD_MARGIN, top: CARD_MARGIN, width, maxHeight: Math.max(120, r.top - CARD_MARGIN * 2) };
        }
      } else if (button) {
        const r = button.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const maxH = Math.round(vh * ANCHORED_MAX_VH);
        const leftSpace = r.left - ANCHOR_GAP - CARD_MARGIN;
        const belowSpace = vh - r.bottom - ANCHOR_GAP - CARD_MARGIN;
        if (cx > vw / 2 && leftSpace >= CARD_MIN_WIDTH && r.height < vh / 3 && vw >= 640) {
          // Escritorio: el botón está en el riel derecho; la tarjeta a su izquierda, señalándolo.
          const w = Math.min(width, leftSpace);
          if (cy > vh / 2) {
            // El botón abajo: la tarjeta crece hacia arriba desde él.
            const bottom = clamp(vh - cy - 26, CARD_MARGIN, vh - CARD_MARGIN - 140);
            next = { style: { right: vw - r.left + ANCHOR_GAP, bottom, width: w, maxHeight: Math.min(maxH, vh - bottom - CARD_MARGIN) }, arrow: { side: 'right', offset: clamp(vh - bottom - cy, 14, 120), fromEnd: true } };
          } else {
            const top = clamp(cy - 26, CARD_MARGIN, vh - CARD_MARGIN - 140);
            next = { style: { right: vw - r.left + ANCHOR_GAP, top, width: w, maxHeight: Math.min(maxH, vh - top - CARD_MARGIN) }, arrow: { side: 'right', offset: clamp(cy - top, 14, 120) } };
          }
        } else if (belowSpace >= 160) {
          // Celular (o el botón arriba): debajo, con la flechita hacia arriba.
          const w = Math.min(width, vw - CARD_MARGIN * 2);
          const left = clamp(cx + 24 - w, CARD_MARGIN, vw - CARD_MARGIN - w);
          next = { style: { left, top: r.bottom + ANCHOR_GAP, width: w, maxHeight: Math.min(maxH, belowSpace) }, arrow: { side: 'top', offset: clamp(cx - left, 14, w - 14) } };
        }
      }
      const key = JSON.stringify(next);
      if (key !== last) { last = key; setPlacement(next); }
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(compute); };
    compute();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-state', 'style', 'class'] });
    window.addEventListener('resize', schedule);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [rich]);
  return placement;
}

/** La flechita que une la tarjeta con el botón Voz. */
function CardArrow({ arrow }: { arrow: NonNullable<CardPlacement['arrow']> }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute z-10 h-3 w-3 rotate-45 border-[#7C3AED]/25 bg-card',
        arrow.side === 'right' ? 'border-r border-t' : 'border-l border-t',
      )}
      style={arrow.side === 'right'
        ? (arrow.fromEnd ? { right: -6, bottom: arrow.offset - 6 } : { right: -6, top: arrow.offset - 6 })
        : { top: -6, left: arrow.offset - 6 }}
    />
  );
}

function VoiceCardView() {
  const t = useTranslations('VoiceCommands');
  const locale = useLocale();
  const { phase, interim, heard, card, awaiting, alwaysOn, focusLabel, task, step, suspended, clinicalCase } = useVoiceCommand();
  const caseLabel = clinicalCase?.open ? clinicalCase.patient : null;
  const { style: placement, arrow } = useCardPlacement(!!card?.rich);
  if (phase === 'idle' && !card && !interim) return null;

  const status = phase === 'listening' ? t('status.listening')
    : phase === 'thinking' || phase === 'running' ? t('status.thinking')
      : phase === 'speaking' ? t('status.speaking')
        : phase === 'waiting' ? t('status.waiting')
          : null;
  // Con el micrófono permanente lo que se está diciendo llega sin la fase «escuchando».
  const said = phase === 'listening' || (alwaysOn && interim) ? interim : heard;

  return (
    <div className={cn('pointer-events-none fixed z-[80] flex flex-col print:hidden', arrow?.fromEnd && 'justify-end')} style={placement} data-voice-card data-voice-anchor={arrow?.side ?? 'corner'}>
      {arrow && <CardArrow arrow={arrow} />}
      <div
        role="region"
        aria-label={t('label')}
        className={cn('pointer-events-auto flex min-h-0 w-full flex-col overflow-hidden rounded-xl border border-[#7C3AED]/25 bg-card text-card-foreground shadow-[0_8px_28px_rgba(60,20,90,0.25)] animate-in fade-in',
          arrow?.side === 'right' ? 'slide-in-from-right-1' : arrow?.side === 'top' ? 'slide-in-from-top-1' : 'slide-in-from-bottom-1',
        )}
      >
        <div className="flex shrink-0 items-center gap-1.5 border-b border-[#7C3AED]/15 bg-[#7C3AED]/5 px-3 py-1.5">
          <PhaseIcon phase={phase} />
          <p className="min-w-0 flex-1 truncate text-[11px] font-medium text-[#5B21B6] dark:text-violet-300" aria-live="polite">
            {status ?? (alwaysOn ? t('status.awake') : t('label'))}
          </p>
          <button
            type="button"
            onClick={cancelVoice}
            onMouseDown={(e) => e.preventDefault()}
            className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={t('close')}
            title={t('close')}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {(task || focusLabel || caseLabel || suspended) && (
          <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-border/60 px-3 py-1 text-[10px] text-muted-foreground">
            {task && (
              <span className="inline-flex min-w-0 max-w-full items-center gap-1" title={task}>
                <ListChecks className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="truncate">{step ? t('stepOf', { index: step.index, total: step.total, task }) : task}</span>
              </span>
            )}
            {focusLabel && (
              <span className="inline-flex max-w-full items-center gap-1 truncate rounded-full bg-[#7C3AED]/10 px-1.5 py-px text-[#5B21B6] dark:text-violet-300">
                <Pin className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{t('focus', { name: focusLabel })}</span>
              </span>
            )}
            {caseLabel && (
              <span data-voice-case className="inline-flex max-w-full items-center gap-1 truncate rounded-full bg-emerald-500/10 px-1.5 py-px text-emerald-700 dark:text-emerald-300">
                <Stethoscope className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{t('clinical.chip', { patient: caseLabel })}</span>
              </span>
            )}
            {suspended && <span className="italic">{t('suspended')}</span>}
          </div>
        )}

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-2">
          {said && (
            <p className={cn('line-clamp-2 text-xs italic text-muted-foreground', phase === 'listening' && 'text-foreground')}>
              «{said}»
            </p>
          )}

          {card && (
            <div className="space-y-1.5">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold">{card.title}</p>
                {card.subtitle && <p className="truncate text-[11px] text-muted-foreground">{card.subtitle}</p>}
              </div>

              {!!card.rows?.length && (
                <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-0.5 rounded-md bg-muted/40 px-2 py-1.5 text-[11px] leading-snug">
                  {card.rows.map((row) => (
                    <React.Fragment key={row.label}>
                      <dt className="text-muted-foreground">{row.label}</dt>
                      <dd className={cn(
                        'min-w-0 break-words font-medium',
                        row.tone === 'danger' && 'text-destructive',
                        row.tone === 'warning' && 'text-amber-700 dark:text-amber-400',
                      )}>
                        {row.value}
                      </dd>
                    </React.Fragment>
                  ))}
                </dl>
              )}

              {card.message && (
                <div className="flex items-start gap-1.5">
                  <ToneIcon tone={card.tone} />
                  {card.rich
                    ? <VoiceRichText text={card.message} className={cn('min-w-0 flex-1 text-xs leading-snug', MESSAGE_TONE[card.tone ?? 'info'])} />
                    : <p className={cn('text-xs leading-snug', MESSAGE_TONE[card.tone ?? 'info'])}>{card.message}</p>}
                </div>
              )}

              {!!card.choices?.length && (
                <ol className="space-y-0.5">
                  {card.choices.map((choice, index) => (
                    <li key={`${choice.label}-${index}`}>
                      <button
                        type="button"
                        disabled={awaiting !== 'choice'}
                        onClick={() => answerFromCard(String(index + 1))}
                        onMouseDown={(e) => e.preventDefault()}
                        className="flex w-full items-center gap-1.5 rounded-md border border-border px-2 py-1 text-left text-xs transition-colors hover:border-[#7C3AED]/50 hover:bg-[#7C3AED]/5 disabled:pointer-events-none disabled:opacity-60"
                      >
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#7C3AED]/10 text-[10px] font-semibold text-[#5B21B6] dark:text-violet-300">
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{choice.label}</span>
                        {choice.detail && <span className="max-w-[40%] truncate text-[10px] text-muted-foreground">{choice.detail}</span>}
                      </button>
                    </li>
                  ))}
                </ol>
              )}

              {(awaiting === 'confirm' || card.link) && (
                <div className="flex flex-wrap items-center justify-end gap-1.5 pt-0.5">
                  {card.link && (
                    <Button asChild variant="link" size="sm" className="mr-auto h-7 px-0 text-xs">
                      <Link href={`/${locale}${card.link.href}`} onClick={cancelVoice}>{card.link.label}</Link>
                    </Button>
                  )}
                  {awaiting === 'confirm' && (
                    <>
                      <Button type="button" variant="outline" size="sm" className="h-7 px-2.5 text-xs" onClick={() => answerFromCard('no')} onMouseDown={(e) => e.preventDefault()}>
                        {t('no')}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={card.tone === 'danger' ? 'destructive' : 'default'}
                        className="h-7 gap-1 px-2.5 text-xs"
                        onClick={() => answerFromCard('si')}
                        onMouseDown={(e) => e.preventDefault()}
                      >
                        <Check className="h-3.5 w-3.5" />
                        {t('yes')}
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <p className="shrink-0 truncate border-t border-border/60 px-3 py-1 text-[10px] text-muted-foreground">
          {alwaysOn ? t('hintAwake') : awaiting ? t('hintAnswer') : t('hint')}
        </p>
      </div>
    </div>
  );
}
