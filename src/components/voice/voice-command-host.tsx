'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, Check, CheckCircle2, Loader2, Mic, Volume2, X, XCircle } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';

import { VoiceLabOrderDialogHost } from '@/components/voice/voice-lab-order-dialog-host';

import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';
import '@/lib/voice/commands';
import { LAB_ORDERS_VOICE_DOMAIN } from '@/lib/voice/commands/lab-orders';
import { answerFromCard, cancelVoice, configureVoiceSession, endPushToTalk, listenByClick, startPushToTalk } from '@/lib/voice/session';
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
export function VoiceCommandHost({ domains }: { domains: readonly string[] }) {
  if (!useRecognitionSupported()) return null;
  return <VoiceCommandRoot domains={domains} />;
}

/** Micrófono de la pantalla: escucha una frase (lo mismo que mantener Ctrl+Espacio). */
export function VoiceCommandButton({ compact = false, className }: { compact?: boolean; className?: string }) {
  const t = useTranslations('VoiceCommands');
  const listening = useVoiceCommand((s) => s.phase === 'listening');
  if (!useRecognitionSupported()) return null;
  return (
    <Button
      type="button"
      data-help-id="lab-orders.btn.voice"
      size="sm"
      variant={listening ? 'destructive' : 'outline'}
      className={cn('h-9 gap-1.5', className)}
      aria-pressed={listening}
      aria-label={t('button')}
      title={t('buttonHint')}
      // Escuchando: el clic corta. Si el asistente espera una respuesta, el clic la escucha.
      onClick={() => (listening ? cancelVoice() : void listenByClick())}
    >
      <Mic className={cn('h-4 w-4', listening && 'animate-pulse')} />
      <span className={cn('hidden', !compact && 'sm:inline')}>{t('button')}</span>
    </Button>
  );
}

function VoiceCommandRoot({ domains }: { domains: readonly string[] }) {
  // Estable aunque la pantalla pase un array nuevo en cada render.
  const domainsKey = domains.join(',');
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const permissionRef = React.useRef(hasPermission);
  React.useLayoutEffect(() => { permissionRef.current = hasPermission; });

  React.useEffect(() => {
    configureVoiceSession({
      locale,
      t: (key, values) => t(key as Parameters<typeof t>[0], values),
      hasPermission: (code) => permissionRef.current(code),
      navigate: (route) => router.push(`/${locale}${route === '/' ? '' : route}`),
      domains: domainsKey ? domainsKey.split(',') : [],
    });
    return () => configureVoiceSession(null);
  }, [locale, router, t, domainsKey]);

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
      if (e.key === 'Escape' && useVoiceCommand.getState().phase !== 'idle') cancelVoice();
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
      <span className="relative flex h-3 w-3" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive/60" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-destructive" />
      </span>
    );
  }
  if (phase === 'speaking') return <Volume2 className="h-4 w-4 text-[#7C3AED]" aria-hidden="true" />;
  if (phase === 'thinking' || phase === 'running') return <Loader2 className="h-4 w-4 animate-spin text-[#7C3AED]" aria-hidden="true" />;
  return <Mic className="h-4 w-4 text-[#7C3AED]" aria-hidden="true" />;
}

const MESSAGE_TONE: Record<NonNullable<VoiceCard['tone']>, string> = {
  info: 'text-foreground',
  confirm: 'text-foreground',
  danger: 'text-destructive font-medium',
  success: 'text-emerald-700 dark:text-emerald-400 font-medium',
  error: 'text-destructive font-medium',
};

function ToneIcon({ tone }: { tone: VoiceCard['tone'] }) {
  if (tone === 'success') return <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />;
  if (tone === 'error') return <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />;
  if (tone === 'danger') return <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />;
  return null;
}

function VoiceCardView() {
  const t = useTranslations('VoiceCommands');
  const locale = useLocale();
  const { phase, interim, heard, card, awaiting } = useVoiceCommand();
  if (phase === 'idle' && !card) return null;

  const status = phase === 'listening' ? t('status.listening')
    : phase === 'thinking' || phase === 'running' ? t('status.thinking')
      : phase === 'speaking' ? t('status.speaking')
        : phase === 'waiting' ? t('status.waiting')
          : null;
  const said = phase === 'listening' ? interim : heard;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[80] flex justify-center px-4 print:hidden"
      data-voice-card
    >
      <div
        role="region"
        aria-label={t('label')}
        className="pointer-events-auto w-full max-w-md overflow-hidden rounded-2xl border border-[#7C3AED]/25 bg-card text-card-foreground shadow-[0_12px_40px_rgba(60,20,90,0.28)] animate-in fade-in slide-in-from-bottom-2"
      >
        <div className="flex items-center gap-2 border-b border-[#7C3AED]/15 bg-[#7C3AED]/5 px-4 py-2">
          <PhaseIcon phase={phase} />
          <p className="min-w-0 flex-1 truncate text-xs font-medium text-[#5B21B6] dark:text-violet-300" aria-live="polite">
            {status ?? t('label')}
          </p>
          <button
            type="button"
            onClick={cancelVoice}
            onMouseDown={(e) => e.preventDefault()}
            className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={t('close')}
            title={t('close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 px-4 py-3">
          {said && (
            <p className={cn('text-sm italic text-muted-foreground', phase === 'listening' && 'text-foreground')}>
              «{said}»
            </p>
          )}

          {card && (
            <div className="space-y-2.5">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{card.title}</p>
                {card.subtitle && <p className="truncate text-xs text-muted-foreground">{card.subtitle}</p>}
              </div>

              {!!card.rows?.length && (
                <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-lg bg-muted/40 px-3 py-2 text-sm">
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
                <div className="flex items-start gap-2">
                  <ToneIcon tone={card.tone} />
                  <p className={cn('text-sm', MESSAGE_TONE[card.tone ?? 'info'])}>{card.message}</p>
                </div>
              )}

              {!!card.choices?.length && (
                <ol className="space-y-1">
                  {card.choices.map((choice, index) => (
                    <li key={`${choice.label}-${index}`}>
                      <button
                        type="button"
                        disabled={awaiting !== 'choice'}
                        onClick={() => answerFromCard(String(index + 1))}
                        onMouseDown={(e) => e.preventDefault()}
                        className="flex w-full items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-left text-sm transition-colors hover:border-[#7C3AED]/50 hover:bg-[#7C3AED]/5 disabled:pointer-events-none disabled:opacity-60"
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#7C3AED]/10 text-xs font-semibold text-[#5B21B6] dark:text-violet-300">
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{choice.label}</span>
                        {choice.detail && <span className="truncate text-xs text-muted-foreground">{choice.detail}</span>}
                      </button>
                    </li>
                  ))}
                </ol>
              )}

              {(awaiting === 'confirm' || card.link) && (
                <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                  {card.link && (
                    <Button asChild variant="link" size="sm" className="mr-auto h-8 px-0">
                      <Link href={`/${locale}${card.link.href}`} onClick={cancelVoice}>{card.link.label}</Link>
                    </Button>
                  )}
                  {awaiting === 'confirm' && (
                    <>
                      <Button type="button" variant="outline" size="sm" onClick={() => answerFromCard('no')} onMouseDown={(e) => e.preventDefault()}>
                        {t('no')}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={card.tone === 'danger' ? 'destructive' : 'default'}
                        className="gap-1.5"
                        onClick={() => answerFromCard('si')}
                        onMouseDown={(e) => e.preventDefault()}
                      >
                        <Check className="h-4 w-4" />
                        {t('yes')}
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <p className="border-t border-border/60 px-4 py-1.5 text-[11px] text-muted-foreground">
          {awaiting ? t('hintAnswer') : t('hint')}
        </p>
      </div>
    </div>
  );
}
