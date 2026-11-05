'use client';

import React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle, Check, CornerDownLeft, HelpCircle, Mic, MicOff, Trash2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { API_ROUTES } from '@/constants/routes';
import { useLiveDictation } from '@/hooks/use-live-dictation';
import { cn } from '@/lib/utils';

export interface VoiceFeedback {
  heard: string;
  understood: string[];
  warnings: string[];
  unknown: string[];
  /** The phrase asked to stop listening */
  stop?: boolean;
  /** The AI rewrote what the parser did not understand */
  rewritten?: string;
}

/** Wait for the AI rewrite before giving up on a phrase */
const FALLBACK_TIMEOUT_MS = 8000;

/** The phrase in the command language, or null (no fallback configured, timeout, nothing to say) */
async function rewriteWithAi(text: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), FALLBACK_TIMEOUT_MS);
  try {
    const res = await fetch(API_ROUTES.PERIO_RECORD.DICTATION_FALLBACK, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }), signal: controller.signal });
    if (!res.ok) return null;
    const data = (await res.json()) as { phrase?: string };
    return data.phrase?.trim() || null;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

interface HelpGroup {
  title: string;
  items: [string, string][];
}

export interface PerioVoiceBarProps {
  inputRef: React.RefObject<HTMLInputElement>;
  /** Runs one phrase (dictated or typed) and says what was understood */
  onPhrase: (text: string) => VoiceFeedback;
  pendingCount: number;
  onConfirm: () => void;
  onDiscard: () => void;
  /** Row of marks being filled ("SS · 23 P · distal"), if any */
  lineLabel: string | null;
  onLeaveLine: () => void;
}

/** Dictation for the probing: phrases are applied while you speak; dictated values stay underlined until confirmed */
export function PerioVoiceBar({ inputRef, onPhrase, pendingCount, onConfirm, onDiscard, lineLabel, onLeaveLine }: PerioVoiceBarProps) {
  const t = useTranslations('PerioRecord.voice');
  const locale = useLocale();
  const [text, setText] = React.useState('');
  const [feedback, setFeedback] = React.useState<VoiceFeedback | null>(null);
  // The AI answers after a re-render: it must run the phrase against the probe as it is then
  const onPhraseRef = React.useRef(onPhrase);
  React.useEffect(() => { onPhraseRef.current = onPhrase; });

  const [thinking, setThinking] = React.useState(false);
  const run = (phrase: string) => {
    const result = onPhrase(phrase);
    setFeedback(result);
    // Nothing understood: the AI rewrites it in the command language and the parser tries again
    if (!result.understood.length && result.unknown.length && !result.stop) {
      setThinking(true);
      void rewriteWithAi(phrase).then((rewritten) => {
        if (rewritten && rewritten.toLowerCase() !== phrase.toLowerCase()) setFeedback({ ...onPhraseRef.current(rewritten), rewritten });
      }).finally(() => setThinking(false));
    }
    return result;
  };
  /** "parar dictado" turns the microphone off (through a ref: the hook's result does not exist yet here) */
  const stopRef = React.useRef<() => void>(() => undefined);
  const dictation = useLiveDictation(locale, (phrase) => {
    if (run(phrase).stop) stopRef.current();
  });
  React.useEffect(() => { stopRef.current = dictation.stop; }, [dictation.stop]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    run(value);
    setText('');
  };

  // Raw list from the messages; if a locale lacks it, the help is just empty (never a crash)
  const rawGroups: unknown = t.raw('help.groups');
  const groups = Array.isArray(rawGroups) ? (rawGroups as HelpGroup[]) : [];

  const status = thinking ? (
    <span className="min-w-0 truncate italic text-muted-foreground">{t('thinking')}</span>
  ) : dictation.interim ? (
    <span className="min-w-0 truncate italic text-muted-foreground">«{dictation.interim}…»</span>
  ) : feedback && (
    <span className="flex min-w-0 items-center gap-2" title={[...feedback.understood, ...feedback.warnings, feedback.unknown.length ? t('unknown', { words: feedback.unknown.join(' ') }) : ''].filter(Boolean).join(' · ') || feedback.heard}>
      {feedback.rewritten && <span className="shrink-0 rounded bg-violet-500/12 px-1 text-[11px] font-semibold text-violet-700 dark:text-violet-300" title={t('rewritten', { phrase: feedback.rewritten })}>{t('ai')}</span>}
      {feedback.understood.length > 0 && <span className="inline-flex min-w-0 items-center gap-1 text-emerald-700 dark:text-emerald-400"><Check className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{feedback.understood.join(' · ')}</span></span>}
      {feedback.warnings.length > 0 && <span className="inline-flex min-w-0 items-center gap-1 text-amber-700 dark:text-amber-400"><AlertTriangle className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{feedback.warnings.join(' · ')}</span></span>}
      {feedback.unknown.length > 0 && <span className="truncate text-muted-foreground">{t('unknown', { words: feedback.unknown.join(' ') })}</span>}
      {!feedback.understood.length && !feedback.warnings.length && !feedback.unknown.length && <span className="truncate text-muted-foreground">{t('nothing', { text: feedback.heard })}</span>}
    </span>
  );

  // Sits at the right of the exam banner, on the same row: the chart keeps the height
  return (
    <div className="flex min-w-0 flex-[1_1_420px] flex-wrap items-center justify-end gap-x-2 gap-y-1 text-[12.5px]" aria-live="polite">
      {lineLabel && (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/12 py-0.5 pl-2 pr-1 font-medium text-primary">
          {t('line', { line: lineLabel })}
          <button type="button" onClick={onLeaveLine} className="grid h-4 w-4 place-items-center rounded-full hover:bg-primary/20" aria-label={t('leaveLine')} title={t('leaveLine')}><X className="h-3 w-3" /></button>
        </span>
      )}
      {dictation.error && <span className="inline-flex shrink-0 items-center gap-1 text-destructive"><AlertTriangle className="h-3.5 w-3.5" />{t(`errors.${dictation.error}`)}</span>}
      {status && <span className="flex min-w-0 max-w-[340px] flex-[0_1_auto] items-center">{status}</span>}
      {pendingCount > 0 && (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-violet-500/40 bg-violet-500/10 py-0.5 pl-2.5 pr-1 text-violet-800 dark:text-violet-200">
          <i className="inline-block h-[2px] w-3 rounded" style={{ background: 'var(--perio-dict)' }} aria-hidden />
          {t('pending', { count: pendingCount })}
          <Button type="button" size="sm" variant="ghost" className="h-6 gap-1 px-2 text-xs" onClick={onDiscard}><Trash2 className="h-3 w-3" />{t('discard')}</Button>
          <Button type="button" size="sm" className="h-6 gap-1 px-2 text-xs" onClick={onConfirm}><Check className="h-3 w-3" />{t('confirm')}</Button>
        </span>
      )}
      <div className={cn('flex min-w-[260px] max-w-[460px] flex-[1_1_300px] items-center gap-1 rounded-lg border bg-background p-0.5 transition-shadow', dictation.isListening && 'border-red-400/70 ring-2 ring-red-500/20')}>
        <Button
          type="button"
          size="sm"
          variant={dictation.isListening ? 'destructive' : 'ghost'}
          className="h-7 shrink-0 gap-1.5 px-2"
          onClick={dictation.isListening ? dictation.stop : dictation.start}
          disabled={!dictation.isSupported}
          title={!dictation.isSupported ? t('unsupported') : undefined}
          aria-pressed={dictation.isListening}
        >
          {dictation.isListening ? <><span className="h-2 w-2 animate-pulse rounded-full bg-white" aria-hidden /><MicOff className="h-4 w-4" />{t('stop')}</> : <><Mic className="h-4 w-4" />{t('start')}</>}
        </Button>
        <form onSubmit={submit} className="flex min-w-0 flex-1 items-center">
          <Input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') (e.target as HTMLInputElement).blur(); }}
            placeholder={dictation.isListening ? t('listening') : t('placeholder')}
            aria-label={t('label')}
            className="h-7 min-w-0 border-0 px-1.5 text-[12.5px] shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <Button type="submit" size="icon" variant="ghost" className="h-7 w-7 shrink-0" disabled={!text.trim()} aria-label={t('send')} title={t('send')}>
            <CornerDownLeft className="h-3.5 w-3.5" />
          </Button>
        </form>
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-muted-foreground" aria-label={t('help.button')} title={t('help.title')}>
              <HelpCircle className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="max-h-[70vh] w-[min(560px,92vw)] overflow-auto p-0">
            <div className="border-b px-4 py-3">
              <h3 className="text-sm font-semibold">{t('help.title')}</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">{t('help.lead')}</p>
            </div>
            <div className="grid gap-x-5 gap-y-3 px-4 py-3 sm:grid-cols-2">
              {groups.map((group) => (
                <section key={group.title} className="flex flex-col gap-1">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{group.title}</h4>
                  {group.items.map(([say, does]) => (
                    <p key={say} className="text-[12.5px] leading-snug"><b className="font-semibold text-primary">«{say}»</b> <span className="text-muted-foreground">{does}</span></p>
                  ))}
                </section>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
