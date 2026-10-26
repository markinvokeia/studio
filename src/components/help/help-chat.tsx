'use client';

import { BarChart2, Calendar, ChevronRight, Clapperboard, Compass, ListChecks, Mic, PlayCircle, Plug, Route, SendHorizontal, Square, ThumbsDown, ThumbsUp, Users, Video, Volume2, Wallet } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { Button } from '@/components/ui/button';

import { useMascot } from '@/components/invoke-mascot';

import { isSpeechSupported, speakAssistant, stopAssistantSpeech, useAssistantVoice } from '@/hooks/use-assistant-voice';
import { useKeyedAsyncAction } from '@/hooks/use-async-action';
import { useToast } from '@/hooks/use-toast';
import { useCurrentHelpRoute } from '@/hooks/use-current-help-route';
import { useSpeechDictation } from '@/hooks/use-speech-dictation';
import { resolveReplyActions, searchCatalogLocally, type ResolvedGuide } from '@/lib/help/catalog';
import { collectVisibleTargets } from '@/lib/help/guide-engine';
import { startGuide } from '@/lib/help/guide-runner';
import { cn } from '@/lib/utils';
import { isAbortError } from '@/services/api';
import { askAssistant, requestHelpVideo, sendAssistantFeedback } from '@/services/help-assistant';
import { useHelpAssistant, type HelpChatMessage } from '@/stores/help-assistant-store';

import type { HelpAssistantReply, HelpCatalog } from '@/lib/types';

/** "guiame", "hacelo", "cargalo", "paso a paso"… (también en inglés). */
const WANTS_GUIDE = /\b(gu[ií]a(me|nos)?|paso a paso|hac[eé]lo|carg[aá](lo|la|me)?|ayud[aá]me a|llev[aá]me|guide me|walk me|do it|show me how)\b/i;
const COMPOSER_MAX_HEIGHT = 128;
/** Si la respuesta tarda más que esto, la mascota pasa de "pensando" a "cargando". */
const LOADING_MOOD_AFTER_MS = 2500;

const QUICK_ACTIONS = [
  { id: 'patients', icon: Users },
  { id: 'agenda', icon: Calendar },
  { id: 'sales', icon: Wallet },
  { id: 'reports', icon: BarChart2 },
  { id: 'integrations', icon: Plug },
] as const;

/** Respuesta sin ayuda útil: la mascota se pone apenada. */
export function isSadReply(reply: HelpAssistantReply): boolean {
  return reply.escalated === true || (reply.confidence !== undefined && reply.confidence < 0.4 && !reply.useCaseId && !reply.links?.length);
}

function renderAnswer(text: string): React.ReactNode {
  return text.replace(/\\n/g, '\n').split('\n').map((line, i) => (
    <p key={i} className={cn(line.trim() === '' && 'h-2')}>
      {line.split(/(\*\*.*?\*\*)/g).map((part, j) => {
        const bold = part.match(/^\*\*(.*)\*\*$/);
        return bold ? <strong key={j} className="font-semibold">{bold[1]}</strong> : <React.Fragment key={j}>{part}</React.Fragment>;
      })}
    </p>
  ));
}

function hasValues(reply: HelpAssistantReply) {
  return Object.keys(reply.values ?? {}).length > 0;
}

interface HelpChatProps {
  catalog: HelpCatalog;
  /** Pasos obligatorios del onboarding que faltan (la opción sólo se muestra si hay). */
  pendingSteps: number;
  /** Nombre de la pantalla actual, para "Guiame en esta pantalla". */
  screenTitle?: string;
  /** Llegó a una pantalla nueva desde la última vez: se destaca "Guiame en esta pantalla". */
  highlightScreen: boolean;
  onOpenScreen: () => void;
  onOpenOnboarding: () => void;
}

/** Colores de la mascota (globo de la librería invoke-mascot). */
const BUBBLE = 'bg-[#7C3AED] text-white';

export function HelpChat({ catalog, pendingSteps, screenTitle, highlightScreen, onOpenScreen, onOpenOnboarding }: HelpChatProps) {
  const t = useTranslations('HelpAssistant.chat');
  const locale = useLocale();
  const router = useRouter();
  const { route, scope } = useCurrentHelpRoute();
  const messages = useHelpAssistant((s) => s.messages);
  const addMessage = useHelpAssistant((s) => s.addMessage);

  const [input, setInput] = React.useState('');
  const [isSending, setIsSending] = React.useState(false);
  const [rated, setRated] = React.useState<Record<string, 1 | -1>>({});
  const [videoRequested, setVideoRequested] = React.useState<Record<string, true>>({});
  const [openVideo, setOpenVideo] = React.useState<string | null>(null);
  const { toast } = useToast();
  // La mascota acompaña el chat: piensa mientras espera, se pone contenta o triste con la respuesta.
  const mascot = useMascot();
  const mascotRef = React.useRef(mascot);
  React.useLayoutEffect(() => { mascotRef.current = mascot; });
  const lockRef = React.useRef(false);
  const abortRef = React.useRef<AbortController | null>(null);
  const bottomRef = React.useRef<HTMLDivElement | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const mountedRef = React.useRef(true);
  const speakingId = useAssistantVoice((s) => s.speakingId);
  const [canSpeak, setCanSpeak] = React.useState(false);

  React.useEffect(() => { setCanSpeak(isSpeechSupported()); }, []);
  // Al cerrar el chat se corta la lectura y lo que estuviera en curso.
  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      stopAssistantSpeech();
    };
  }, []);
  React.useEffect(() => { bottomRef.current?.scrollIntoView({ block: 'end' }); }, [messages, isSending]);

  const actionsFor = React.useCallback(
    (reply: HelpAssistantReply, question?: string) =>
      resolveReplyActions(catalog, reply, route, (title) => t('tourTitle', { screen: title }), question),
    [catalog, route, t],
  );

  /** Corre la guía elegida (o la más parecida). Siempre una guía predefinida del catálogo. */
  const runGuide = React.useCallback((reply: HelpAssistantReply, question?: string, chosen?: ResolvedGuide) => {
    const guide = chosen ?? actionsFor(reply, question).guide;
    if (!guide?.steps.length) return;
    stopAssistantSpeech();
    startGuide(guide, {
      useCaseId: guide.useCaseId,
      returnTo: 'chat',
      values: reply.values ?? {},
      // Con datos dictados completa todo y se detiene en el OK; sin datos, va paso a paso.
      autoRun: hasValues(reply) ? 'untilConfirm' : 'first',
    });
  }, [actionsFor]);

  const send = React.useCallback(async (text: string, isVoice = false) => {
    const message = text.trim();
    if (!message || lockRef.current) return;
    lockRef.current = true;
    setIsSending(true);
    setInput('');
    const history = useHelpAssistant.getState().messages.slice(-6).map((m) => ({ role: m.role, content: m.content }));
    addMessage({ id: `${Date.now()}-u`, role: 'user', content: message, isVoice });

    const controller = new AbortController();
    abortRef.current = controller;
    const m = mascotRef.current;
    m.notifyRequest();
    void m.setMood('thinking');
    const loadingTimer = setTimeout(() => { void mascotRef.current.setMood('loading'); }, LOADING_MOOD_AFTER_MS);
    let reply: HelpAssistantReply;
    let failed = false;
    try {
      reply = await askAssistant(
        { message, locale, route, screenId: scope, visibleTargets: collectVisibleTargets(), history },
        controller.signal,
      );
    } catch (error) {
      if (isAbortError(error)) { clearTimeout(loadingTimer); lockRef.current = false; return; }
      failed = true;
      // Sin backend: la mejor ficha y guía del catálogo local.
      const local = searchCatalogLocally(catalog, message);
      reply = {
        answer: local.useCase || local.screen ? t('fallbackFound') : t('fallbackNone'),
        useCaseId: local.useCase?.id ?? null,
        links: local.screen ? [{ route: local.screen.route, label: local.screen.title }] : [],
        autoStart: Boolean(local.useCase) && WANTS_GUIDE.test(message),
        confidence: local.useCase || local.screen ? 0.5 : 0,
      };
    } finally {
      clearTimeout(loadingTimer);
      setIsSending(false);
      lockRef.current = false;
    }

    const replyId = `${Date.now()}-a`;
    addMessage({ id: replyId, role: 'assistant', content: reply.answer, reply, question: message });
    // La mascota lee la respuesta en voz alta (salvo que esté silenciada) antes de guiar.
    void mascotRef.current.setMood('talking');
    const spoken = await speakAssistant(replyId, reply.answer, locale);
    if (!mountedRef.current) return;
    if (!spoken) void mascotRef.current.setMood('neutral');
    // Una frase como máximo por respuesta: acompaña, no repite lo que dice el chat.
    if (failed) void mascotRef.current.say(t('mascotError'), { mood: 'sad' });
    else if (isSadReply(reply)) void mascotRef.current.say(t('mascotSorry'), { mood: 'sad' });
    else if (reply.autoStart) void mascotRef.current.say(t('mascotLetsGo'), { mood: 'happy' });
    else void mascotRef.current.setMood('happy');
    if (reply.autoStart) runGuide(reply, message);
  }, [addMessage, catalog, locale, route, runGuide, scope, t]);

  const dictation = useSpeechDictation(locale, (text) => { void send(text, true); });
  // Que el micrófono no escuche a la mascota.
  const startDictation = () => { stopAssistantSpeech(); dictation.start(); };

  const toggleReading = (msg: HelpChatMessage) => {
    if (speakingId === msg.id) { stopAssistantSpeech(); return; }
    void mascotRef.current.setMood('talking');
    void speakAssistant(msg.id, msg.content, locale).then(() => {
      if (mountedRef.current && useAssistantVoice.getState().speakingId === null) void mascotRef.current.setMood('happy');
    });
  };

  // La caja crece con el texto hasta un máximo y después scrollea.
  const composerValue = dictation.isListening ? dictation.interim : input;
  React.useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(COMPOSER_MAX_HEIGHT, el.scrollHeight)}px`;
  }, [composerValue]);

  const feedback = useKeyedAsyncAction(
    (questionId: string, rating: 1 | -1) => sendAssistantFeedback(questionId, rating),
    { errorTitle: t('feedbackError') },
  );

  // Fase 3: la guía todavía no tiene video → se encola y el worker lo graba y narra.
  const videoRequest = useKeyedAsyncAction(
    (useCaseId: string, questionId?: string | null) => requestHelpVideo(useCaseId, locale, questionId),
    {
      onSuccess: () => { toast({ title: t('videoRequested') }); void mascotRef.current.gesture('nod'); },
      errorTitle: t('videoRequestError'),
    },
  );

  const rate = (msg: HelpChatMessage, rating: 1 | -1) => {
    const questionId = msg.reply?.questionId;
    if (!questionId || rated[msg.id]) return;
    setRated((r) => ({ ...r, [msg.id]: rating }));
    void feedback.run(questionId, questionId, rating);
  };

  const go = (target: string) => router.push(`/${locale}${target === '/' ? '' : target}`);

  // Opciones de siempre: seguir el onboarding (si falta algo) y guiar en esta pantalla.
  const shortcuts = (
    <div className="space-y-1.5">
      {pendingSteps > 0 && (
        <button
          type="button"
          onClick={onOpenOnboarding}
          className="flex w-full items-center gap-2.5 rounded-2xl border border-[#7C3AED]/25 bg-[#7C3AED]/5 px-3 py-2 text-left transition-colors hover:bg-[#7C3AED]/10"
        >
          <ListChecks className="h-4 w-4 flex-none text-[#7C3AED]" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-[#5B21B6] dark:text-violet-300">{t('onboardingTitle')}</span>
            <span className="block text-xs text-muted-foreground">{t('onboardingPending', { count: pendingSteps })}</span>
          </span>
          <ChevronRight className="h-4 w-4 flex-none text-[#7C3AED]" />
        </button>
      )}
      <button
        type="button"
        onClick={onOpenScreen}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-2xl border px-3 py-2 text-left transition-colors',
          highlightScreen
            ? 'border-[#7C3AED] bg-[#7C3AED] text-white shadow-md hover:bg-[#6D28D9]'
            : 'border-[#7C3AED]/25 bg-white hover:bg-[#7C3AED]/5 dark:bg-card',
        )}
      >
        <Route className={cn('h-4 w-4 flex-none', highlightScreen ? 'text-white' : 'text-[#7C3AED]')} />
        <span className="min-w-0 flex-1">
          <span className={cn('block text-sm font-semibold', !highlightScreen && 'text-[#5B21B6] dark:text-violet-300')}>{t('guideThisScreen')}</span>
          {screenTitle && <span className={cn('block truncate text-xs', highlightScreen ? 'text-white/80' : 'text-muted-foreground')}>{screenTitle}</span>}
        </span>
        <ChevronRight className="h-4 w-4 flex-none" />
      </button>
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {messages.length === 0 ? (
          <div className="space-y-3">
            {/* Saludo con el estilo del globo de la mascota. */}
            <div className={cn('rounded-2xl rounded-br-md px-3.5 py-2.5 text-sm shadow-sm', BUBBLE)}>
              <p className="font-semibold">{t('welcomeTitle')}</p>
              <p className="mt-0.5 text-[13px] leading-snug text-white/85">{t('welcomeDescription')}</p>
            </div>
            {shortcuts}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {QUICK_ACTIONS.map(({ id, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => void send(t(`quick.${id}.prompt`))}
                  disabled={isSending}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#7C3AED]/25 bg-white px-2.5 py-1 text-xs font-medium text-[#5B21B6] transition-colors hover:bg-[#7C3AED]/10 disabled:opacity-50 dark:bg-card dark:text-violet-300"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t(`quick.${id}.label`)}
                </button>
              ))}
            </div>
          </div>
        ) : (
          shortcuts
        )}

        {messages.map((msg) => {
          if (msg.role === 'user') {
            return (
              <div key={msg.id} className="flex justify-end">
                <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-muted px-3 py-2 text-sm text-foreground">
                  {msg.isVoice && <Mic className="mb-0.5 mr-1 inline h-3 w-3 opacity-70" />}
                  {msg.content}
                </div>
              </div>
            );
          }
          const reply = msg.reply;
          const actions = reply ? actionsFor(reply, msg.question) : null;
          return (
            <div key={msg.id} className="space-y-2">
              <div className={cn('max-w-[92%] space-y-0.5 rounded-2xl rounded-bl-md px-3.5 py-2.5 text-sm leading-relaxed shadow-sm', BUBBLE)}>{renderAnswer(msg.content)}</div>
              {actions && (
                <div className="flex flex-wrap gap-1.5">
                  {/* Siempre las dos: guiar y llevar. Con varias guías parecidas, se elige cuál. */}
                  {actions.suggestions.length > 1 ? (
                    <div className="w-full space-y-1">
                      <p className="px-0.5 text-[11px] font-medium text-muted-foreground">{t('suggestedGuides')}</p>
                      {actions.suggestions.map((g, i) => (
                        <button
                          key={g.useCaseId ?? g.title}
                          type="button"
                          onClick={() => runGuide(reply!, msg.question, g)}
                          className={cn(
                            'flex w-full items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left text-xs font-medium transition-colors',
                            i === 0
                              ? 'border-[#7C3AED] bg-[#7C3AED] text-white hover:bg-[#6D28D9]'
                              : 'border-[#7C3AED]/25 bg-white text-[#5B21B6] hover:bg-[#7C3AED]/5 dark:bg-card dark:text-violet-300',
                          )}
                        >
                          <PlayCircle className="h-3.5 w-3.5 shrink-0" />
                          <span className="min-w-0 flex-1 truncate">{g.title}</span>
                          <span className="shrink-0 text-[10px] opacity-75">{t('stepsCount', { count: g.steps.length })}</span>
                        </button>
                      ))}
                    </div>
                  ) : actions.guide && (
                    <Button size="sm" className="h-7 gap-1 rounded-full bg-[#7C3AED] px-2.5 text-xs hover:bg-[#6D28D9]" onClick={() => runGuide(reply!, msg.question)}>
                      <PlayCircle className="h-3.5 w-3.5" />
                      {hasValues(reply!) ? t('fillForMe') : t('guideMe')}
                    </Button>
                  )}
                  {actions.links.map((link) => (
                    <Button key={link.route} size="sm" variant="outline" className="h-7 gap-1 rounded-full border-[#7C3AED]/30 px-2.5 text-xs text-[#5B21B6] dark:text-violet-300" onClick={() => go(link.route)}>
                      <Compass className="h-3.5 w-3.5" />
                      {t('takeMeTo', { label: link.label })}
                    </Button>
                  ))}
                  {reply!.videoUrl ? (
                    <Button size="sm" variant="outline" className="h-7 gap-1 rounded-full px-2.5 text-xs" onClick={() => setOpenVideo(openVideo === msg.id ? null : msg.id)} aria-expanded={openVideo === msg.id}>
                      <Video className="h-3.5 w-3.5" />
                      {t('watchVideo')}
                    </Button>
                  ) : actions.guide?.useCaseId && !videoRequested[actions.guide.useCaseId] && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1 rounded-full px-2 text-xs"
                      loading={videoRequest.isPending(actions.guide.useCaseId)}
                      onClick={async () => {
                        const id = actions.guide!.useCaseId!;
                        const ok = await videoRequest.run(id, id, reply!.questionId);
                        if (ok !== undefined) setVideoRequested((v) => ({ ...v, [id]: true }));
                      }}
                    >
                      <Clapperboard className="h-3.5 w-3.5" />
                      {t('requestVideo')}
                    </Button>
                  )}
                </div>
              )}
              {reply?.videoUrl && openVideo === msg.id && (
                // Subtítulos: el .vtt se publica junto al mp4 (scripts/videos). En GCS el bucket necesita CORS.
                <video controls autoPlay playsInline crossOrigin="anonymous" className="w-full rounded-xl border bg-black" src={reply.videoUrl}>
                  <track kind="subtitles" src={reply.videoUrl.replace(/\.mp4(\?.*)?$/, '.vtt')} srcLang={locale.slice(0, 2)} label={t('subtitles')} default />
                </video>
              )}
              {reply?.escalated && (
                <p className="text-[11px] text-muted-foreground">{reply.ticketId ? t('ticketCreated', { id: reply.ticketId }) : t('escalated')}</p>
              )}
              {(reply?.questionId || canSpeak) && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  {canSpeak && (
                    <button
                      type="button"
                      aria-label={speakingId === msg.id ? t('stopReading') : t('readAloud')}
                      title={speakingId === msg.id ? t('stopReading') : t('readAloud')}
                      onClick={() => toggleReading(msg)}
                      className={cn('rounded p-1 hover:bg-muted', speakingId === msg.id && 'text-[#7C3AED]')}
                    >
                      {speakingId === msg.id ? <Square className="h-3 w-3 fill-current" /> : <Volume2 className="h-3.5 w-3.5" />}
                    </button>
                  )}
                  {reply?.questionId && (
                    <>
                      <button type="button" aria-label={t('helpful')} disabled={!!rated[msg.id]} onClick={() => rate(msg, 1)}
                        className={cn('rounded p-1 hover:bg-muted disabled:cursor-default', rated[msg.id] === 1 && 'text-green-600')}>
                        <ThumbsUp className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" aria-label={t('notHelpful')} disabled={!!rated[msg.id]} onClick={() => rate(msg, -1)}
                        className={cn('rounded p-1 hover:bg-muted disabled:cursor-default', rated[msg.id] === -1 && 'text-destructive')}>
                        <ThumbsDown className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {isSending && (
          <div className={cn('inline-flex items-center gap-1 rounded-2xl rounded-bl-md px-3.5 py-3', BUBBLE)} aria-label={t('thinking')}>
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white [animation-delay:-0.3s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white [animation-delay:-0.15s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white" />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Barra de escribir: caja que crece, con micrófono y enviar adentro. */}
      <form
        className="flex-none border-t border-[#7C3AED]/15 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5"
        onSubmit={(e) => { e.preventDefault(); void send(input); }}
      >
        <div
          className={cn(
            'flex items-end gap-1 rounded-2xl border bg-background py-1 pl-3 pr-1 transition-colors focus-within:border-[#7C3AED]/60 focus-within:ring-2 focus-within:ring-[#7C3AED]/15',
            dictation.isListening && 'border-destructive/50 ring-2 ring-destructive/15',
          )}
        >
          <textarea
            ref={textareaRef}
            value={composerValue}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(input); } }}
            placeholder={dictation.isListening ? t('listening') : t('placeholder')}
            readOnly={dictation.isListening}
            rows={1}
            className="max-h-32 min-h-[2.25rem] flex-1 resize-none bg-transparent py-2 text-sm leading-5 outline-none placeholder:text-muted-foreground"
            aria-label={t('placeholder')}
          />
          {dictation.isSupported && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className={cn('h-9 w-9 flex-none rounded-full', dictation.isListening ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : 'text-muted-foreground')}
              onClick={dictation.isListening ? dictation.stop : startDictation}
              disabled={isSending}
              aria-label={dictation.isListening ? t('stopDictation') : t('dictate')}
              title={dictation.isListening ? t('stopDictation') : t('dictate')}
            >
              {dictation.isListening ? <Square className="h-3.5 w-3.5 fill-current" /> : <Mic className="h-4 w-4" />}
            </Button>
          )}
          <Button
            type="submit"
            size="icon"
            className="h-9 w-9 flex-none rounded-full bg-[#7C3AED] hover:bg-[#6D28D9]"
            loading={isSending}
            disabled={!input.trim() || dictation.isListening}
            aria-label={t('send')}
            title={t('send')}
          >
            <SendHorizontal className="h-4 w-4" />
          </Button>
        </div>
        {dictation.isListening && (
          <p className="mt-1.5 flex items-center gap-1.5 px-1 text-[11px] text-destructive">
            <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" />
            {t('listening')}
          </p>
        )}
      </form>
    </div>
  );
}
