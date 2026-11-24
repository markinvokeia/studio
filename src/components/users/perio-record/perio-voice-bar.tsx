'use client';

import React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle, Check, CornerDownLeft, HelpCircle, MessageCircle, Mic, MicOff, Trash2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';

import { speakAssistant, stopAssistantSpeech } from '@/hooks/use-assistant-voice';
import { useLiveDictation } from '@/hooks/use-live-dictation';
import { inventedNumbers, parseVoice, shouldAskAiFirst, voiceCommandsToPhrase, type VoiceCommand } from '@/lib/perio/voice';
import { cn } from '@/lib/utils';
import { interpretPerioPhrase, type PerioAiContext } from '@/lib/voice/commands/perio';
import { normalizeSpeech, parseYesNo } from '@/lib/voice/parse';
import { startHoldListening, type HoldListening } from '@/lib/voice/speech-recognition';

export interface VoiceFeedback {
  heard: string;
  understood: string[];
  warnings: string[];
  unknown: string[];
  /** The phrase asked to stop listening */
  stop?: boolean;
  /** The AI interpreted what the parser did not understand: the commands read as a phrase */
  rewritten?: string;
  /** Weighty (tooth status, copy, discard): nothing ran; `run` does it after a "sí" */
  confirm?: { message: string; run: () => VoiceFeedback };
  /** Answer to a question ("¿cuánto tenía el 16?"): shown, and said aloud if replies are on */
  answer?: string;
}

/** Wait for the AI before giving up on a phrase (the phrases said meanwhile wait their turn) */
const AI_TIMEOUT_MS = 8000;
/** Below this the AI guessed: the phrase stays as not understood */
const MIN_AI_CONFIDENCE = 0.5;
/** From this up (and with every number said) it is written at once; in between, it asks first */
const APPLY_AI_CONFIDENCE = 0.8;
/** Per-viewer conveniences (browser storage): replies aloud and the key that toggles the microphone */
const REPLIES_KEY = 'invokeia.perio.voiceReplies';
const TOGGLE_KEY = 'invokeia.perio.voiceToggleKey';

/** Hold to talk when the microphone is off (the same shortcut as the other voice commands) */
const isPushToTalk = (e: KeyboardEvent) => e.code === 'Space' && e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey;
const isEditable = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  const tag = el?.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || Boolean(el?.isContentEditable);
};

function readStored(key: string): string | null {
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function writeStored(key: string, value: string | null) {
  try {
    if (value == null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch { /* private window or blocked storage: it just is not remembered */ }
}

/** Something to answer with "sí" / "no" before anything is written */
interface Question {
  heard: string;
  message: string;
  run: () => VoiceFeedback;
  /** The AI interpreted the phrase (its badge, and why it asks) */
  ai: boolean;
  /** AI: numbers it wrote that were not said */
  invented: number[];
}

interface HelpGroup {
  title: string;
  items: [string, string][];
}

interface ToggleKey {
  code: string;
  label: string;
}

export interface PerioVoiceBarProps {
  inputRef: React.RefObject<HTMLInputElement>;
  /** Runs one phrase (dictated or typed) and says what was understood */
  onPhrase: (text: string) => VoiceFeedback;
  /** Runs what the AI interpreted for a phrase (written as dictated by the AI) */
  onAiCommands: (text: string, commands: VoiceCommand[]) => VoiceFeedback;
  /** Where the probe is now, for the AI */
  aiContext: () => PerioAiContext;
  pendingCount: number;
  onConfirm: () => void;
  onDiscard: () => void;
  /** Row of marks being filled ("SS · 23 P · distal"), if any */
  lineLabel: string | null;
  onLeaveLine: () => void;
}

/**
 * Dictation for the probing. One open microphone takes everything: values and marks are written as
 * they are said (underlined until confirmed), questions are answered, and weighty commands (tooth
 * status, copy from the previous exam, discard) wait for a "sí". Phrases run in the order said.
 * A phrase the parser does not understand goes to the AI (POST voice/interpret, domain 'perio') and
 * the next ones wait for it; one understood only in part goes to the AI first when what is left
 * looks like content (shouldAskAiFirst). What the AI understood is written at once when it is sure
 * and every number was said; otherwise it asks "¿Quisiste decir…?". The next "sí" / "no" (said or
 * tapped) answers any question. With replies on, questions and answers are said aloud and the
 * microphone pauses meanwhile. With the microphone off, Ctrl+Space held says one phrase; a key of
 * the viewer's choice (a foot pedal) turns the microphone on and off.
 */
export function PerioVoiceBar({ inputRef, onPhrase, onAiCommands, aiContext, pendingCount, onConfirm, onDiscard, lineLabel, onLeaveLine }: PerioVoiceBarProps) {
  const t = useTranslations('PerioRecord.voice');
  const locale = useLocale();
  const [text, setText] = React.useState('');
  const [feedback, setFeedback] = React.useState<VoiceFeedback | null>(null);
  const [thinking, setThinking] = React.useState(false);
  const [queued, setQueued] = React.useState(0);
  const [question, setQuestionState] = React.useState<Question | null>(null);
  const [pttInterim, setPttInterim] = React.useState<string | null>(null);
  const [replies, setReplies] = React.useState(false);
  const [toggleKey, setToggleKey] = React.useState<ToggleKey | null>(null);
  const [choosingKey, setChoosingKey] = React.useState(false);
  React.useEffect(() => {
    setReplies(readStored(REPLIES_KEY) === '1');
    try {
      const stored = JSON.parse(readStored(TOGGLE_KEY) ?? 'null') as ToggleKey | null;
      if (stored?.code) setToggleKey(stored);
    } catch { /* not a key: none */ }
  }, []);

  const queueRef = React.useRef<string[]>([]);
  const busyRef = React.useRef(false);
  const questionRef = React.useRef<Question | null>(null);
  const aiAbortRef = React.useRef<AbortController | null>(null);
  const aliveRef = React.useRef(true);
  /** "parar dictado" turns the microphone off (through a ref: the hook's result does not exist yet here) */
  const stopRef = React.useRef<() => void>(() => undefined);
  const pauseRef = React.useRef<{ pause: () => void; resume: () => void }>({ pause: () => undefined, resume: () => undefined });

  // The queue runs after re-renders: it must use the probe (and the settings) as they are then
  const latest = React.useRef({ onPhrase, onAiCommands, aiContext, locale, t, replies });
  React.useEffect(() => { latest.current = { onPhrase, onAiCommands, aiContext, locale, t, replies }; });

  React.useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      aiAbortRef.current?.abort();
      queueRef.current = [];
      stopAssistantSpeech();
    };
  }, []);

  /** Says it aloud if replies are on; the microphone does not listen meanwhile */
  const say = (speech: string) => {
    if (!latest.current.replies || !speech) return;
    pauseRef.current.pause();
    void speakAssistant('perio-voice', speech, latest.current.locale, { evenIfHidden: true }).finally(() => {
      if (aliveRef.current) pauseRef.current.resume();
    });
  };

  const setQuestion = (next: Question | null) => {
    questionRef.current = next;
    setQuestionState(next);
    if (next) say(next.message);
  };

  /** Shows what a phrase did: asks first if it was weighty, says the answer if it was a question */
  const settle = (result: VoiceFeedback) => {
    setFeedback(result);
    if (result.confirm) {
      setQuestion({ heard: result.heard, message: result.confirm.message, run: result.confirm.run, ai: false, invented: [] });
      return;
    }
    if (result.answer) say(result.answer);
  };

  const answerQuestion = (yes: boolean) => {
    const q = questionRef.current;
    if (!q) return;
    setQuestion(null);
    if (yes) settle(q.run());
    else setFeedback({ heard: q.heard, understood: [], warnings: [latest.current.t('nothingChanged')], unknown: [] });
  };

  /** The parser did not understand it: ask the AI (the queue waits). True if it wrote or asked something. */
  const askAi = async (phrase: string): Promise<boolean> => {
    const { locale: lang, aiContext: context } = latest.current;
    const controller = new AbortController();
    aiAbortRef.current = controller;
    const timer = window.setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
    setThinking(true);
    try {
      const answer = await interpretPerioPhrase(phrase, { locale: lang, signal: controller.signal, context: context() });
      if (!aliveRef.current) return false;
      const { commands } = answer.result;
      if (!commands.length || answer.confidence < MIN_AI_CONFIDENCE) return false;
      const shown = voiceCommandsToPhrase(commands, lang);
      const run = (): VoiceFeedback => ({ ...latest.current.onAiCommands(phrase, commands), rewritten: shown });
      const invented = inventedNumbers(commands, phrase);
      if (answer.confidence >= APPLY_AI_CONFIDENCE && !invented.length) settle(run());
      else setQuestion({ heard: phrase, message: latest.current.t('aiQuestion', { phrase: shown }), run, ai: true, invented });
      return true;
    } catch (error) {
      // Timeout, no connection or the flow is not there: the phrase stays as not understood
      if (aliveRef.current) console.warn('[perio-voice] AI interpretation failed', error);
      return false;
    } finally {
      window.clearTimeout(timer);
      if (aiAbortRef.current === controller) aiAbortRef.current = null;
      if (aliveRef.current) setThinking(false);
    }
  };

  const processPhrase = async (phrase: string) => {
    const open = questionRef.current;
    let dropped: string | null = null;
    if (open) {
      const yesNo = parseYesNo(normalizeSpeech(phrase));
      if (yesNo) { answerQuestion(yesNo === 'yes'); return; }
      // Anything else: the question is left unanswered (nothing done) and the phrase runs
      setQuestion(null);
      dropped = latest.current.t('questionDropped', { question: open.message });
    }
    const withDropped = (result: VoiceFeedback): VoiceFeedback => (dropped ? { ...result, warnings: [dropped, ...result.warnings] } : result);
    // Understood only in part ("primer molar inferior izquierdo vestibular 4 3 5"): writing the part
    // understood would put it on the wrong tooth, so the AI reads it whole first. If the AI cannot,
    // the part understood is written as before.
    const askedFirst = shouldAskAiFirst(parseVoice(phrase));
    if (askedFirst) {
      if (dropped) setFeedback({ heard: phrase, understood: [], warnings: [dropped], unknown: [] });
      if (await askAi(phrase)) return;
    }
    const result = latest.current.onPhrase(phrase);
    settle(withDropped(result));
    if (result.stop) { stopRef.current(); return; }
    const nothing = !result.understood.length && !result.answer && !result.confirm;
    if (!askedFirst && nothing && result.unknown.length) await askAi(phrase);
  };

  /** One phrase after the other, in the order said: one waiting for the AI holds the rest */
  const enqueue = (phrase: string) => {
    queueRef.current.push(phrase);
    setQueued(queueRef.current.length);
    if (busyRef.current) return;
    busyRef.current = true;
    void (async () => {
      try {
        while (queueRef.current.length && aliveRef.current) {
          const next = queueRef.current.shift()!;
          setQueued(queueRef.current.length);
          await processPhrase(next);
        }
      } finally {
        busyRef.current = false;
        if (aliveRef.current) setQueued(queueRef.current.length);
      }
    })();
  };

  const dictation = useLiveDictation(locale, enqueue);
  React.useEffect(() => {
    stopRef.current = dictation.stop;
    pauseRef.current = { pause: dictation.pause, resume: dictation.resume };
  }, [dictation.stop, dictation.pause, dictation.resume]);

  // Keyboard: Ctrl+Space held says one phrase with the microphone off; the chosen key toggles it
  const listeningRef = React.useRef(dictation.isListening);
  const controls = React.useRef({ start: dictation.start, stop: dictation.stop, toggleKey, choosingKey });
  React.useEffect(() => {
    listeningRef.current = dictation.isListening;
    controls.current = { start: dictation.start, stop: dictation.stop, toggleKey, choosingKey };
  });
  React.useEffect(() => {
    let hold: HoldListening | null = null;
    const release = () => {
      const current = hold;
      if (!current) return;
      hold = null;
      void current.stop().then((said) => {
        if (!aliveRef.current) return;
        setPttInterim(null);
        if (said.trim()) enqueue(said.trim());
      });
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (controls.current.choosingKey) return;
      if (isPushToTalk(e)) {
        if (listeningRef.current) return;
        e.preventDefault();
        e.stopPropagation();
        if (e.repeat || hold) return;
        stopAssistantSpeech();
        hold = startHoldListening(latest.current.locale, (interim) => setPttInterim(interim));
        if (hold) setPttInterim('');
        return;
      }
      const key = controls.current.toggleKey;
      if (!key || e.code !== key.code || e.ctrlKey || e.altKey || e.metaKey || e.repeat) return;
      // A letter typed in a field is just a letter; a function key (a pedal) works anywhere
      if (isEditable(e.target) && e.key.length === 1) return;
      e.preventDefault();
      if (listeningRef.current) controls.current.stop();
      else controls.current.start();
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
      hold?.abort();
    };
    // enqueue only touches refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Choosing the toggle key: the next key pressed (Escape cancels, Backspace clears)
  React.useEffect(() => {
    if (!choosingKey) return;
    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setChoosingKey(false);
      if (e.key === 'Escape') return;
      if (e.key === 'Backspace' || e.key === 'Delete') { setToggleKey(null); writeStored(TOGGLE_KEY, null); return; }
      if (['Control', 'Shift', 'Alt', 'Meta', 'Tab', 'Enter', ' '].includes(e.key)) return;
      const chosen = { code: e.code, label: e.key.length === 1 ? e.key.toUpperCase() : e.key };
      setToggleKey(chosen);
      writeStored(TOGGLE_KEY, JSON.stringify(chosen));
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [choosingKey]);

  const changeReplies = (on: boolean) => {
    setReplies(on);
    writeStored(REPLIES_KEY, on ? '1' : null);
    if (!on) stopAssistantSpeech();
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    enqueue(value);
    setText('');
  };

  // Raw list from the messages; if a locale lacks it, the help is just empty (never a crash)
  const rawGroups: unknown = t.raw('help.groups');
  const groups = Array.isArray(rawGroups) ? (rawGroups as HelpGroup[]) : [];
  const interim = dictation.interim || pttInterim;

  const status = question ? (
    <span
      data-help-id="perio-session.section.voice-question"
      className="inline-flex min-w-0 items-center gap-1 rounded-2xl border border-amber-500/50 bg-amber-500/10 py-0.5 pl-2 pr-1 text-amber-900 dark:text-amber-200"
      title={[question.ai ? (question.invented.length ? t('aiInvented', { numbers: question.invented.join(', ') }) : t('aiUnsure')) : '', t('yesNoHint')].filter(Boolean).join(' · ')}
    >
      {question.ai && <span className="shrink-0 rounded bg-violet-500/12 px-1 text-[11px] font-semibold text-violet-700 dark:text-violet-300">{t('ai')}</span>}
      <span className="line-clamp-2 min-w-0 leading-snug">{question.message}</span>
      <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => answerQuestion(false)} data-help-id="perio-session.btn.voice-no">{t('no')}</Button>
      <Button type="button" size="sm" className="h-6 px-2 text-xs" onClick={() => answerQuestion(true)} data-help-id="perio-session.btn.voice-yes">{t('yes')}</Button>
    </span>
  ) : thinking ? (
    <span className="min-w-0 truncate italic text-muted-foreground">{t('thinking')}{queued > 0 ? ` · ${t('queued', { count: queued })}` : ''}</span>
  ) : interim ? (
    <span className="min-w-0 truncate italic text-muted-foreground">«{interim}…»</span>
  ) : pttInterim === '' ? (
    <span className="min-w-0 truncate italic text-muted-foreground">{t('listening')}</span>
  ) : feedback && (
    <span className="flex min-w-0 items-center gap-2" title={[feedback.answer ?? '', ...feedback.understood, ...feedback.warnings, feedback.unknown.length ? t('unknown', { words: feedback.unknown.join(' ') }) : ''].filter(Boolean).join(' · ') || feedback.heard}>
      {feedback.rewritten && <span className="shrink-0 rounded bg-violet-500/12 px-1 text-[11px] font-semibold text-violet-700 dark:text-violet-300" title={t('rewritten', { phrase: feedback.rewritten })}>{t('ai')}</span>}
      {feedback.answer && <span data-help-id="perio-session.section.voice-answer" className="inline-flex min-w-0 items-center gap-1 text-primary"><MessageCircle className="h-3.5 w-3.5 shrink-0" /><span className="line-clamp-2 leading-snug">{feedback.answer}</span></span>}
      {feedback.understood.length > 0 && <span className="inline-flex min-w-0 items-center gap-1 text-emerald-700 dark:text-emerald-400"><Check className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{feedback.understood.join(' · ')}</span></span>}
      {feedback.warnings.length > 0 && <span className="inline-flex min-w-0 items-center gap-1 text-amber-700 dark:text-amber-400"><AlertTriangle className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{feedback.warnings.join(' · ')}</span></span>}
      {feedback.unknown.length > 0 && <span className="truncate text-muted-foreground">{t('unknown', { words: feedback.unknown.join(' ') })}</span>}
      {!feedback.answer && !feedback.understood.length && !feedback.warnings.length && !feedback.unknown.length && <span className="truncate text-muted-foreground">{t('nothing', { text: feedback.heard })}</span>}
    </span>
  );

  // Sits at the right of the exam banner, on the same row: the chart keeps the height
  return (
    <div data-help-id="perio-session.section.voice" className="flex min-w-0 flex-[1_1_420px] flex-wrap items-center justify-end gap-x-2 gap-y-1 text-[12.5px]" aria-live="polite">
      {lineLabel && (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/12 py-0.5 pl-2 pr-1 font-medium text-primary">
          {t('line', { line: lineLabel })}
          <button type="button" onClick={onLeaveLine} className="grid h-4 w-4 place-items-center rounded-full hover:bg-primary/20" aria-label={t('leaveLine')} title={t('leaveLine')}><X className="h-3 w-3" /></button>
        </span>
      )}
      {dictation.error && <span className="inline-flex shrink-0 items-center gap-1 text-destructive"><AlertTriangle className="h-3.5 w-3.5" />{t(`errors.${dictation.error}`)}</span>}
      {/* A question or an answer needs room: it is what is being confirmed or asked */}
      {status && <span className={cn('flex min-w-0 flex-[0_1_auto] items-center', question || feedback?.answer ? 'max-w-[560px]' : 'max-w-[340px]')}>{status}</span>}
      {pendingCount > 0 && (
        <span data-help-id="perio-session.section.voice-pending" className="inline-flex shrink-0 items-center gap-1 rounded-full border border-violet-500/40 bg-violet-500/10 py-0.5 pl-2.5 pr-1 text-violet-800 dark:text-violet-200">
          <i className="inline-block h-[2px] w-3 rounded" style={{ background: 'var(--perio-dict)' }} aria-hidden />
          {t('pending', { count: pendingCount })}
          <Button type="button" size="sm" variant="ghost" className="h-6 gap-1 px-2 text-xs" onClick={onDiscard} data-help-id="perio-session.btn.voice-discard"><Trash2 className="h-3 w-3" />{t('discard')}</Button>
          <Button type="button" size="sm" className="h-6 gap-1 px-2 text-xs" onClick={onConfirm} data-help-id="perio-session.btn.voice-confirm"><Check className="h-3 w-3" />{t('confirm')}</Button>
        </span>
      )}
      <div className={cn('flex min-w-[260px] max-w-[460px] flex-[1_1_300px] items-center gap-1 rounded-lg border bg-background p-0.5 transition-shadow', (dictation.isListening || pttInterim != null) && 'border-red-400/70 ring-2 ring-red-500/20')}>
        <Button
          type="button"
          size="sm"
          variant={dictation.isListening ? 'destructive' : 'ghost'}
          className="h-7 shrink-0 gap-1.5 px-2"
          onClick={dictation.isListening ? dictation.stop : dictation.start}
          data-help-id="perio-session.btn.dictate"
          disabled={!dictation.isSupported}
          title={!dictation.isSupported ? t('unsupported') : toggleKey ? t('toggleKey.hint', { key: toggleKey.label }) : t('pushToTalk')}
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
            data-help-id="perio-session.field.voice-command"
            className="h-7 min-w-0 border-0 px-1.5 text-[12.5px] shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <Button type="submit" size="icon" variant="ghost" className="h-7 w-7 shrink-0" disabled={!text.trim()} aria-label={t('send')} title={t('send')}>
            <CornerDownLeft className="h-3.5 w-3.5" />
          </Button>
        </form>
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-muted-foreground" aria-label={t('help.button')} title={t('help.title')} data-help-id="perio-session.btn.voice-help">
              <HelpCircle className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="max-h-[70vh] w-[min(560px,92vw)] overflow-auto p-0">
            <div className="border-b px-4 py-3">
              <h3 className="text-sm font-semibold">{t('help.title')}</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">{t('help.lead')}</p>
            </div>
            <div className="flex flex-col gap-2.5 border-b px-4 py-3 text-[12.5px]">
              <label data-help-id="perio-session.field.voice-replies" className="flex items-center justify-between gap-3">
                <span className="flex flex-col">
                  <span className="font-medium">{t('replies.label')}</span>
                  <span className="text-xs text-muted-foreground">{t('replies.hint')}</span>
                </span>
                <Switch checked={replies} onCheckedChange={changeReplies} aria-label={t('replies.label')} />
              </label>
              <div data-help-id="perio-session.field.voice-toggle-key" className="flex items-center justify-between gap-3">
                <span className="flex flex-col">
                  <span className="font-medium">{t('toggleKey.label')}</span>
                  <span className="text-xs text-muted-foreground">{choosingKey ? t('toggleKey.press') : t('toggleKey.description')}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <Button type="button" size="sm" variant={choosingKey ? 'default' : 'outline'} className="h-7 min-w-[84px] text-xs" onClick={() => setChoosingKey((v) => !v)}>
                    {choosingKey ? t('toggleKey.waiting') : toggleKey ? <kbd className="font-mono">{toggleKey.label}</kbd> : t('toggleKey.choose')}
                  </Button>
                  {toggleKey && !choosingKey && (
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label={t('toggleKey.clear')} title={t('toggleKey.clear')} onClick={() => { setToggleKey(null); writeStored(TOGGLE_KEY, null); }}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </span>
              </div>
            </div>
            <div className="grid gap-x-5 gap-y-3 px-4 py-3 sm:grid-cols-2">
              {groups.map((group) => (
                <section key={group.title} className="flex flex-col gap-1">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{group.title}</h4>
                  {group.items.map(([sayIt, does]) => (
                    <p key={sayIt} className="text-[12.5px] leading-snug"><b className="font-semibold text-primary">«{sayIt}»</b> <span className="text-muted-foreground">{does}</span></p>
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
