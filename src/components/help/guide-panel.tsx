'use client';

import { AlertTriangle, ArrowRight, Check, Circle, CircleDot, FastForward, Loader2, MousePointerClick, PartyPopper, RotateCcw, SkipForward, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

import { Button } from '@/components/ui/button';

import { nextStep, retryStep, stopGuide } from '@/lib/help/guide-runner';
import { cn } from '@/lib/utils';
import { useHelpAssistant, type GuideStepStatus } from '@/stores/help-assistant-store';

const STATUS_ICON: Record<GuideStepStatus, React.ElementType> = {
  pending: Circle,
  running: Loader2,
  waiting: CircleDot,
  done: Check,
  skipped: SkipForward,
  failed: AlertTriangle,
};

/** Lista de pasos de la guía en curso. Vive dentro del panel del asistente, en modo compacto. */
export function GuidePanel() {
  const t = useTranslations('HelpAssistant.guide');
  const guide = useHelpAssistant((s) => s.guide);
  const listRef = React.useRef<HTMLOListElement | null>(null);

  const currentIndex = guide?.current;
  React.useEffect(() => {
    listRef.current?.querySelector('[data-current="true"]')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [currentIndex]);

  if (!guide) return null;

  const currentStatus = guide.statuses[guide.current];
  const currentStep = guide.steps[guide.current];
  const doneCount = guide.statuses.filter((s) => s === 'done' || s === 'skipped').length;
  const waitingForHuman = currentStatus === 'waiting' && currentStep?.action === 'confirm';

  if (guide.finished) {
    return (
      <div className="flex flex-col items-center gap-3 p-5 text-center">
        <PartyPopper className="h-8 w-8 text-primary" />
        <div>
          <p className="text-sm font-semibold">{t('finishedTitle')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('finishedDescription', { title: guide.title })}</p>
        </div>
        <Button size="sm" onClick={stopGuide}>{t('close')}</Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-none px-4 pt-3">
        <p className="text-sm font-semibold leading-tight">{guide.title}</p>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(doneCount / guide.steps.length) * 100}%` }} />
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">{t('progress', { done: doneCount, total: guide.steps.length })}</p>
      </div>

      <ol ref={listRef} className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {guide.steps.map((step, i) => {
          const status = guide.statuses[i];
          const Icon = step.action === 'confirm' && status === 'waiting' ? MousePointerClick : STATUS_ICON[status];
          const isCurrent = i === guide.current;
          return (
            <li
              key={step.id}
              data-current={isCurrent}
              className={cn(
                'flex items-start gap-2 rounded-lg px-2 py-1.5 text-xs',
                isCurrent ? 'bg-primary/8 ring-1 ring-primary/20' : 'opacity-80',
              )}
            >
              <Icon
                className={cn(
                  'mt-0.5 h-3.5 w-3.5 flex-none',
                  status === 'done' && 'text-green-600',
                  status === 'running' && 'animate-spin text-primary',
                  status === 'waiting' && 'text-amber-500',
                  status === 'failed' && 'text-destructive',
                  (status === 'pending' || status === 'skipped') && 'text-muted-foreground',
                )}
              />
              <div className="min-w-0">
                <p className={cn('font-medium leading-snug', status === 'done' && 'text-muted-foreground line-through decoration-muted-foreground/40')}>
                  {step.title}
                </p>
                {isCurrent && step.description && <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{step.description}</p>}
                {isCurrent && status === 'failed' && guide.error && (
                  <p className="mt-0.5 text-[11px] text-destructive">{t(`errors.${guide.error}`)}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-none flex-wrap items-center justify-end gap-1.5 border-t px-3 py-2">
        <Button type="button" variant="ghost" size="sm" className="mr-auto h-8 px-2 text-xs" onClick={stopGuide}>
          <X className="h-3.5 w-3.5" />
          {t('exit')}
        </Button>
        {currentStatus === 'failed' ? (
          <Button type="button" variant="outline" size="sm" className="h-8 px-2 text-xs" onClick={retryStep}>
            <RotateCcw className="h-3.5 w-3.5" />
            {t('retry')}
          </Button>
        ) : (
          !waitingForHuman && (
            <Button type="button" variant="outline" size="sm" className="h-8 px-2 text-xs" onClick={() => nextStep('untilConfirm')} disabled={currentStatus === 'running'}>
              <FastForward className="h-3.5 w-3.5" />
              {t('doAll')}
            </Button>
          )
        )}
        <Button type="button" size="sm" className="h-8 px-2.5 text-xs" onClick={() => nextStep('single')} disabled={currentStatus === 'running'}>
          {waitingForHuman ? t('alreadyDone') : currentStatus === 'failed' ? t('skip') : t('next')}
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
