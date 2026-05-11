'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { DoctorAiQueryResponse, DoctorClinicalBrief } from '@/lib/types';
import { queryDoctorAi } from '@/services/doctor-ai';
import { Loader2, Sparkles, Volume2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface DoctorAiPanelProps {
  appointmentId?: string;
  locale: string;
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
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = locale.startsWith('es') ? 'es-ES' : 'en-US';
  utterance.rate = 0.94;

  const voice = await pickVoice(locale);
  if (voice) {
    utterance.voice = voice;
  }

  window.speechSynthesis.speak(utterance);
}

export function DoctorAiPanel({ appointmentId, locale }: DoctorAiPanelProps) {
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

    if (result.answer) {
      setAnswer(result.answer);
    }

    const speechText = result.speak_text || result.answer;
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
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={handleGenerateBrief} disabled={!appointmentId || isGenerating}>
          {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          {t('generateSummary')}
        </Button>
        {quickQuestions.map((item) => (
          <Button
            key={item}
            variant="ghost"
            className="h-8 rounded-full border border-border/70 px-3 text-xs"
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

      {brief ? (
        <div className="overflow-hidden rounded-3xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50 via-white to-teal-50 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset]">
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
        <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
          {t('summaryEmpty')}
        </div>
      )}

      <div className="rounded-2xl border border-border/70 bg-background p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{t('voiceAssistantTitle')}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t('voiceAssistantDescription')}</p>

        <div className="mt-3 space-y-3">
          <Textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder={t('questionPlaceholder')}
            className="min-h-[84px] resize-y"
          />

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void handleAsk()} disabled={!appointmentId || !question.trim() || isAnswering}>
              {isAnswering ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Volume2 className="mr-2 h-4 w-4" />}
              {t('askAndRead')}
            </Button>
          </div>

          {answer && (
            <div className="rounded-2xl bg-muted/40 p-3 text-sm leading-6 text-foreground">
              {answer}
            </div>
          )}

          {suggestions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {suggestions.map((item, index) => (
                <Button
                  key={`${item}-${index}`}
                  type="button"
                  variant="ghost"
                  className="h-8 rounded-full border border-border/70 px-3 text-xs"
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
          )}
        </div>
      </div>
    </div>
  );
}
