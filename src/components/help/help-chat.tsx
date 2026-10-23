'use client';

import { BarChart2, Calendar, Compass, Mic, PlayCircle, Plug, SendHorizontal, Square, ThumbsDown, ThumbsUp, Users, Video, Wallet } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { Button } from '@/components/ui/button';

import { InvokeMascot } from '@/components/help/invoke-mascot';

import { useKeyedAsyncAction } from '@/hooks/use-async-action';
import { useCurrentHelpRoute } from '@/hooks/use-current-help-route';
import { useSpeechDictation } from '@/hooks/use-speech-dictation';
import { resolveReplyActions, searchCatalogLocally } from '@/lib/help/catalog';
import { collectVisibleTargets } from '@/lib/help/guide-engine';
import { startGuide } from '@/lib/help/guide-runner';
import { cn } from '@/lib/utils';
import { isAbortError } from '@/services/api';
import { askAssistant, sendAssistantFeedback } from '@/services/help-assistant';
import { useHelpAssistant, type HelpChatMessage } from '@/stores/help-assistant-store';

import type { HelpAssistantReply, HelpCatalog } from '@/lib/types';

/** "guiame", "hacelo", "cargalo", "paso a paso"… (también en inglés). */
const WANTS_GUIDE = /\b(gu[ií]a(me|nos)?|paso a paso|hac[eé]lo|carg[aá](lo|la|me)?|ayud[aá]me a|llev[aá]me|guide me|walk me|do it|show me how)\b/i;
const COMPOSER_MAX_HEIGHT = 128;

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
  onThinkingChange?: (thinking: boolean) => void;
}

export function HelpChat({ catalog, onThinkingChange }: HelpChatProps) {
  const t = useTranslations('HelpAssistant.chat');
  const locale = useLocale();
  const router = useRouter();
  const { route, scope } = useCurrentHelpRoute();
  const messages = useHelpAssistant((s) => s.messages);
  const addMessage = useHelpAssistant((s) => s.addMessage);

  const [input, setInput] = React.useState('');
  const [isSending, setIsSending] = React.useState(false);
  const [rated, setRated] = React.useState<Record<string, 1 | -1>>({});
  const lockRef = React.useRef(false);
  const abortRef = React.useRef<AbortController | null>(null);
  const bottomRef = React.useRef<HTMLDivElement | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  React.useEffect(() => () => abortRef.current?.abort(), []);
  React.useEffect(() => { bottomRef.current?.scrollIntoView({ block: 'end' }); }, [messages, isSending]);
  React.useEffect(() => { onThinkingChange?.(isSending); }, [isSending, onThinkingChange]);

  const actionsFor = React.useCallback(
    (reply: HelpAssistantReply) => resolveReplyActions(catalog, reply, route, (title) => t('tourTitle', { screen: title })),
    [catalog, route, t],
  );

  const runGuide = React.useCallback((reply: HelpAssistantReply) => {
    const { guide } = actionsFor(reply);
    if (!guide?.steps.length) return;
    startGuide(guide, {
      useCaseId: guide.useCaseId,
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
    let reply: HelpAssistantReply;
    try {
      reply = await askAssistant(
        { message, locale, route, screenId: scope, visibleTargets: collectVisibleTargets(), history },
        controller.signal,
      );
    } catch (error) {
      if (isAbortError(error)) { lockRef.current = false; return; }
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
      setIsSending(false);
      lockRef.current = false;
    }

    addMessage({ id: `${Date.now()}-a`, role: 'assistant', content: reply.answer, reply });
    if (reply.autoStart) runGuide(reply);
  }, [addMessage, catalog, locale, route, runGuide, scope, t]);

  const dictation = useSpeechDictation(locale, (text) => { void send(text, true); });

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

  const rate = (msg: HelpChatMessage, rating: 1 | -1) => {
    const questionId = msg.reply?.questionId;
    if (!questionId || rated[msg.id]) return;
    setRated((r) => ({ ...r, [msg.id]: rating }));
    void feedback.run(questionId, questionId, rating);
  };

  const go = (target: string) => router.push(`/${locale}${target === '/' ? '' : target}`);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {messages.length === 0 && (
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <InvokeMascot withHands={false} className="h-9 w-9 flex-none" state="happy" aria-hidden="true" />
              <div className="rounded-2xl rounded-tl-sm bg-muted px-3 py-2 text-sm">
                <p className="font-medium">{t('welcomeTitle')}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{t('welcomeDescription')}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-1.5 pl-11">
              {QUICK_ACTIONS.map(({ id, icon: Icon }) => (
                <Button key={id} variant="outline" size="sm" className="h-auto justify-start gap-2 whitespace-normal py-1.5 text-left text-xs" onClick={() => void send(t(`quick.${id}.prompt`))} disabled={isSending}>
                  <Icon className="h-3.5 w-3.5 flex-none text-primary" />
                  {t(`quick.${id}.label`)}
                </Button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => {
          if (msg.role === 'user') {
            return (
              <div key={msg.id} className="flex justify-end">
                <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
                  {msg.isVoice && <Mic className="mb-0.5 mr-1 inline h-3 w-3 opacity-70" />}
                  {msg.content}
                </div>
              </div>
            );
          }
          const reply = msg.reply;
          const sad = reply ? isSadReply(reply) : false;
          const actions = reply ? actionsFor(reply) : null;
          return (
            <div key={msg.id} className="flex items-start gap-2">
              <InvokeMascot withHands={false} className="h-8 w-8 flex-none" state={sad ? 'sad' : 'idle'} aria-hidden="true" />
              <div className="min-w-0 max-w-[88%] space-y-2">
                <div className="space-y-0.5 rounded-2xl rounded-tl-sm bg-muted px-3 py-2 text-sm leading-relaxed">{renderAnswer(msg.content)}</div>
                {actions && (
                  <div className="flex flex-wrap gap-1.5">
                    {/* Siempre las dos: guiar y llevar. */}
                    {actions.guide && (
                      <Button size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => runGuide(reply!)}>
                        <PlayCircle className="h-3.5 w-3.5" />
                        {hasValues(reply!) ? t('fillForMe') : t('guideMe')}
                      </Button>
                    )}
                    {actions.links.map((link) => (
                      <Button key={link.route} size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={() => go(link.route)}>
                        <Compass className="h-3.5 w-3.5" />
                        {t('takeMeTo', { label: link.label })}
                      </Button>
                    ))}
                    {reply!.videoUrl && (
                      <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" asChild>
                        <a href={reply!.videoUrl} target="_blank" rel="noopener noreferrer"><Video className="h-3.5 w-3.5" />{t('watchVideo')}</a>
                      </Button>
                    )}
                  </div>
                )}
                {reply?.escalated && <p className="text-[11px] text-muted-foreground">{t('escalated')}</p>}
                {reply?.questionId && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <button type="button" aria-label={t('helpful')} disabled={!!rated[msg.id]} onClick={() => rate(msg, 1)}
                      className={cn('rounded p-1 hover:bg-muted disabled:cursor-default', rated[msg.id] === 1 && 'text-green-600')}>
                      <ThumbsUp className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" aria-label={t('notHelpful')} disabled={!!rated[msg.id]} onClick={() => rate(msg, -1)}
                      className={cn('rounded p-1 hover:bg-muted disabled:cursor-default', rated[msg.id] === -1 && 'text-destructive')}>
                      <ThumbsDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isSending && (
          <div className="flex items-center gap-2 pl-1 text-xs text-muted-foreground">
            <InvokeMascot withHands={false} className="h-8 w-8" state="thinking" aria-hidden="true" />
            {t('thinking')}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Barra de escribir: caja que crece, con micrófono y enviar adentro. */}
      <form
        className="flex-none border-t bg-card px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5"
        onSubmit={(e) => { e.preventDefault(); void send(input); }}
      >
        <div
          className={cn(
            'flex items-end gap-1 rounded-2xl border bg-background py-1 pl-3 pr-1 shadow-sm transition-colors focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/15',
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
              onClick={dictation.isListening ? dictation.stop : dictation.start}
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
            className="h-9 w-9 flex-none rounded-full"
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
