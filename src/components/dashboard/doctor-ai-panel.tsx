'use client';

import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import type { DoctorAiQueryResponse, DoctorClinicalBrief } from '@/lib/types';
import { cn, sanitizeTextForSpeech } from '@/lib/utils';
import { queryDoctorAi } from '@/services/doctor-ai';
import { Bot, Loader2, Sparkles, Volume2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface DoctorAiPanelProps {
  appointmentId?: string;
  locale: string;
  className?: string;
}

const PREFERRED_VOICE_NAMES = [
  'Google español',
  'Microsoft Sabina',
  'Microsoft Helena',
  'Paulina',
  'Monica',
  'Google US English',
  'Microsoft Aria',
  'Samantha',
];

function pickVoice(targetLocale: string): Promise<SpeechSynthesisVoice | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      resolve(null);
      return;
    }

    const synth = window.speechSynthesis;
    const langPrefix = targetLocale.startsWith('es') ? 'es' : 'en';

    const findVoice = () => {
      const voices = synth.getVoices();
      if (voices.length === 0) return null;

      for (const name of PREFERRED_VOICE_NAMES) {
        const voice = voices.find((item) => item.name.includes(name) && item.lang.startsWith(langPrefix));
        if (voice) return voice;
      }

      return voices.find((item) => item.lang.startsWith(langPrefix)) ?? null;
    };

    const voice = findVoice();
    if (voice) {
      resolve(voice);
      return;
    }

    const onVoicesChanged = () => {
      synth.removeEventListener('voiceschanged', onVoicesChanged);
      resolve(findVoice());
    };

    synth.addEventListener('voiceschanged', onVoicesChanged);
    setTimeout(() => {
      synth.removeEventListener('voiceschanged', onVoicesChanged);
      resolve(findVoice());
    }, 1500);
  });
}

async function speakText(text: string, locale: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis || !text.trim()) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(sanitizeTextForSpeech(text));
  utterance.lang = locale.startsWith('es') ? 'es-ES' : 'en-US';
  utterance.rate = 0.94;

  const voice = await pickVoice(locale);
  if (voice) {
    utterance.voice = voice;
  }

  window.speechSynthesis.speak(utterance);
}

export function DoctorAiPanel({ appointmentId, locale, className }: DoctorAiPanelProps) {
  const t = useTranslations('DoctorWorkspace.focus.ai');
  const [brief, setBrief] = React.useState<DoctorClinicalBrief | null>(null);
  const [question, setQuestion] = React.useState('');
  const [answer, setAnswer] = React.useState('');
  const [suggestions, setSuggestions] = React.useState<string[]>([]);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [isAnswering, setIsAnswering] = React.useState(false);

  React.useEffect(() => {
    setBrief(null);
    setQuestion('');
    setAnswer('');
    setSuggestions([]);
  }, [appointmentId]);

  const applyResponse = React.useCallback(async (result: DoctorAiQueryResponse) => {
    setSuggestions(result.suggestions || []);

    if (result.clinical_brief) {
      setBrief(result.clinical_brief);
    }

    const responseText = result.answer || result.output;

    if (responseText) {
      setAnswer(responseText);
    }

    const speechText = result.speak_text || responseText;
    if (speechText) {
      await speakText(speechText, locale);
    }
  }, [locale]);

  const handleGenerateBrief = React.useCallback(async () => {
    if (!appointmentId) return;

    setIsGenerating(true);
    try {
      const result = await queryDoctorAi({
        appointment_id: appointmentId,
        query: t('summaryQuery'),
        channel: 'text',
      });
      await applyResponse(result);
    } catch (error) {
      console.error('Failed to generate doctor clinical brief:', error);
      setBrief(null);
    } finally {
      setIsGenerating(false);
    }
  }, [appointmentId, applyResponse, t]);

  const handleAsk = React.useCallback(async (nextQuestion?: string) => {
    const prompt = (nextQuestion ?? question).trim();
    if (!appointmentId || !prompt) return;

    setIsAnswering(true);
    try {
      const result = await queryDoctorAi({
        appointment_id: appointmentId,
        query: prompt,
        channel: 'text',
      });
      setQuestion(prompt);
      await applyResponse(result);
    } catch (error) {
      console.error('Failed to answer doctor clinical question:', error);
      setAnswer('');
    } finally {
      setIsAnswering(false);
    }
  }, [appointmentId, applyResponse, question]);

  const quickQuestions = React.useMemo(
    () => [t('quickLastDone'), t('quickToday'), t('quickAlerts')],
    [t],
  );

  return (
    <Card className={cn('h-full min-h-[720px] border-border/70 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,0.98))]', className)}>
      <CardHeader className="gap-3 border-b border-border/60 bg-transparent">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">{t('sidebarTitle')}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">{t('sidebarDescription')}</p>
            </div>
          </div>
          <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-emerald-700">
            {t('sidebarStatus')}
          </Badge>
        </div>

        <div className="flex flex-col gap-2 rounded-3xl border border-slate-200/80 bg-white/80 p-3 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{t('workspacePromptTitle')}</p>
          <Button variant="outline" onClick={handleGenerateBrief} disabled={!appointmentId || isGenerating} className="justify-start rounded-2xl border-slate-200 bg-slate-50/70 text-left">
            {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {t('generateSummary')}
          </Button>
          <div className="flex flex-wrap gap-2">
            {quickQuestions.map((item) => (
              <Button
                key={item}
                variant="ghost"
                className="h-8 rounded-full border border-border/70 bg-background/80 px-3 text-xs"
                onClick={() => {
                  setQuestion(item);
                  void handleAsk(item);
                }}
                disabled={!appointmentId || isAnswering}
              >
                {item}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)_auto] gap-4 p-4">
        {brief ? (
          <div className="overflow-hidden rounded-3xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-white to-teal-50 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset]">
            <div className="border-b border-emerald-100/80 bg-white/70 px-4 py-3 backdrop-blur">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{t('summaryCardTitle')}</p>
                  <p className="text-xs text-slate-500">{t('summaryCardSubtitle')}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 p-4">
              <div className="rounded-2xl border border-white/80 bg-white/85 p-3 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-800">{t('summaryClinicalOverview')}</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">{brief.resumen_clinico}</p>
              </div>

              <div className="rounded-2xl border border-white/80 bg-white/85 p-3 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-800">{t('summaryLatestSession')}</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">{brief.ultimo_realizado}</p>
              </div>

              <div className="rounded-2xl border border-white/80 bg-white/85 p-3 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-800">{t('summaryTodayTitle')}</p>
                <div className="mt-2 space-y-2">
                  {brief.que_toca_hoy.map((item, index) => (
                    <div key={`${item}-${index}`} className="flex items-start gap-2 rounded-xl bg-sky-50/80 px-2.5 py-2">
                      <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-sky-600 text-[10px] font-semibold text-white">
                        {index + 1}
                      </div>
                      <p className="text-sm leading-5 text-slate-700">{item}</p>
                    </div>
                  ))}
                </div>
              </div>

              {brief.alertas.length > 0 && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-800">{t('summaryAlerts')}</p>
                  <div className="mt-2 space-y-1.5">
                    {brief.alertas.map((item, index) => (
                      <p key={`${item}-${index}`} className="text-sm leading-5 text-slate-700">{item}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-border bg-white/75 p-4 text-sm text-muted-foreground">
            {t('summaryEmpty')}
          </div>
        )}

        <div className="min-h-0 space-y-3 overflow-auto rounded-3xl border border-slate-200/80 bg-white/85 p-4 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{t('chatTitle')}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t('voiceAssistantDescription')}</p>
            </div>
          </div>

          {answer ? (
            <div className="rounded-[1.5rem] rounded-tr-md bg-slate-900 px-4 py-3 text-sm leading-6 text-white shadow-sm">
              {answer}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-slate-50/70 p-3 text-sm text-muted-foreground">
              {t('chatEmpty')}
            </div>
          )}

          {suggestions.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{t('suggestionsTitle')}</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((item, index) => (
                  <Button
                    key={`${item}-${index}`}
                    type="button"
                    variant="ghost"
                    className="h-8 rounded-full border border-border/70 bg-background/80 px-3 text-xs"
                    onClick={() => {
                      setQuestion(item);
                      void handleAsk(item);
                    }}
                    disabled={isAnswering}
                  >
                    {item}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-[1.75rem] border border-slate-200/90 bg-white p-3 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{t('composerTitle')}</p>
          <div className="space-y-3">
            <Textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder={t('questionPlaceholder')}
              className="min-h-[96px] resize-none rounded-2xl border-slate-200 bg-slate-50/70"
            />

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void handleAsk()} disabled={!appointmentId || !question.trim() || isAnswering} className="rounded-2xl">
                {isAnswering ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Volume2 className="mr-2 h-4 w-4" />}
                {t('askAndRead')}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
