'use client';

import { AlertTriangle, Check, ChevronRight, Circle, Compass, PlayCircle, SkipForward, Undo2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import { useKeyedAsyncAction } from '@/hooks/use-async-action';
import { useCurrentHelpRoute } from '@/hooks/use-current-help-route';
import { usePermissions } from '@/hooks/usePermissions';
import { getErrorMessage } from '@/lib/error-utils';
import { findUseCase } from '@/lib/help/catalog';
import { startGuide } from '@/lib/help/guide-runner';
import { cn } from '@/lib/utils';
import { isAbortError } from '@/services/api';
import { getOnboardingStatus, updateOnboardingProgress } from '@/services/help-assistant';
import { useHelpAssistant } from '@/stores/help-assistant-store';

import { HELP_PERMISSIONS } from '@/constants/permissions';
import type { HelpCatalog, HelpJourneyStep, OnboardingStepState } from '@/lib/types';

interface OnboardingChecklistProps {
  catalog: HelpCatalog;
  /** Avisa al panel cuántos pasos obligatorios faltan (badge del lanzador). */
  onPendingChange?: (pending: number) => void;
}

export function OnboardingChecklist({ catalog, onPendingChange }: OnboardingChecklistProps) {
  const t = useTranslations('HelpAssistant.onboarding');
  const router = useRouter();
  const locale = useLocale();
  const { route } = useCurrentHelpRoute();
  const { hasPermission } = usePermissions();
  const refreshKey = useHelpAssistant((s) => s.onboardingRefreshKey);
  const refreshOnboarding = useHelpAssistant((s) => s.refreshOnboarding);

  const [states, setStates] = React.useState<Record<string, OnboardingStepState>>({});
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState<string | null>(null);

  const canManage = hasPermission(HELP_PERMISSIONS.ONBOARDING_MANAGE);

  // Se vuelve a pedir al cambiar de pantalla: lo más común es volver de crear algo.
  React.useEffect(() => {
    const controller = new AbortController();
    getOnboardingStatus(controller.signal)
      .then((res) => {
        setStates(Object.fromEntries(res.steps.map((s) => [s.step_id, s])));
        setLoadError(null);
      })
      .catch((error) => { if (!isAbortError(error)) setLoadError(getErrorMessage(error)); })
      .finally(() => { if (!controller.signal.aborted) setIsLoading(false); });
    return () => controller.abort();
  }, [refreshKey, route]);

  const journey = catalog.journey;
  const required = journey.filter((s) => s.required);
  const isDone = (s: HelpJourneyStep) => states[s.id]?.status === 'done';
  const isSkipped = (s: HelpJourneyStep) => states[s.id]?.status === 'skipped';
  const requiredDone = required.filter(isDone).length;
  const nextStepId = required.find((s) => !isDone(s) && !isSkipped(s))?.id
    ?? journey.find((s) => !isDone(s) && !isSkipped(s))?.id;
  const allRequiredDone = !isLoading && !loadError && requiredDone === required.length;

  React.useEffect(() => {
    if (!isLoading && !loadError) onPendingChange?.(required.length - requiredDone);
  }, [isLoading, loadError, required.length, requiredDone, onPendingChange]);

  const toggleSkip = useKeyedAsyncAction(
    (step: HelpJourneyStep) => updateOnboardingProgress(step.id, isSkipped(step) ? 'pending' : 'skipped'),
    { onSuccess: () => refreshOnboarding(), errorTitle: t('skipError') },
  );

  const guide = (step: HelpJourneyStep) => {
    const useCase = findUseCase(catalog, step.useCaseId);
    if (useCase) startGuide({ title: useCase.title, steps: useCase.steps }, { useCaseId: useCase.id });
  };

  const goTo = (step: HelpJourneyStep) => router.push(`/${locale}${step.route === '/' ? '' : step.route}`);

  const openStep = expanded ?? nextStepId ?? null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-none px-4 pb-2 pt-3">
        {isLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <>
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-semibold">{allRequiredDone ? t('readyTitle') : t('title')}</p>
              {!loadError && <span className="text-xs font-medium text-muted-foreground">{t('progress', { done: requiredDone, total: required.length })}</span>}
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-gradient-to-r from-[#00AEEF] via-[#A6CE39] to-[#EC008C] transition-all duration-500" style={{ width: `${(requiredDone / Math.max(1, required.length)) * 100}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">{allRequiredDone ? t('readyDescription') : t('description')}</p>
          </>
        )}
        {loadError && (
          <div className="mt-2 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-xs text-destructive">
            <AlertTriangle className="h-3.5 w-3.5 flex-none" />
            <span className="flex-1">{t('loadError')}</span>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => { setIsLoading(true); refreshOnboarding(); }}>
              {t('retry')}
            </Button>
          </div>
        )}
      </div>

      <ol className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-3">
        {journey.map((step, index) => {
          const done = isDone(step);
          const skipped = isSkipped(step);
          const isNext = step.id === nextStepId;
          const isOpen = openStep === step.id;
          const showOptionalHeader = !step.required && (index === 0 || journey[index - 1].required);
          return (
            <React.Fragment key={step.id}>
              {showOptionalHeader && (
                <li className="px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t('optionalHeader')}</li>
              )}
              <li className={cn('rounded-lg border transition-colors', isNext ? 'border-primary/40 bg-primary/5' : 'border-transparent', isOpen && !isNext && 'border-border bg-muted/30')}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left"
                  onClick={() => setExpanded(isOpen ? '' : step.id)}
                  aria-expanded={isOpen}
                >
                  {done ? (
                    <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-green-600 text-white"><Check className="h-3 w-3" /></span>
                  ) : skipped ? (
                    <SkipForward className="h-5 w-5 flex-none text-muted-foreground" />
                  ) : (
                    <Circle className={cn('h-5 w-5 flex-none', isNext ? 'text-primary' : 'text-muted-foreground/60')} />
                  )}
                  <span className={cn('flex-1 text-sm', done ? 'text-muted-foreground' : 'font-medium')}>
                    {step.title}
                    {states[step.id]?.count ? <span className="ml-1.5 text-[10px] text-muted-foreground">({states[step.id]?.count})</span> : null}
                  </span>
                  {isNext && <span className="rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-semibold uppercase text-primary-foreground">{t('next')}</span>}
                  <ChevronRight className={cn('h-4 w-4 flex-none text-muted-foreground transition-transform', isOpen && 'rotate-90')} />
                </button>
                {isOpen && (
                  <div className="space-y-2 px-2.5 pb-2.5 pl-10">
                    <p className="text-xs leading-relaxed text-muted-foreground">{step.description}</p>
                    {states[step.id]?.notes && <p className="rounded bg-amber-500/10 px-2 py-1 text-[11px] text-amber-800 dark:text-amber-300">{states[step.id]?.notes}</p>}
                    <div className="flex flex-wrap gap-1.5">
                      {/* Acción principal: la guía empieza navegando, así que lleva y guía a la vez. */}
                      {step.useCaseId && (
                        <Button size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => guide(step)}>
                          <PlayCircle className="h-3.5 w-3.5" />
                          {done ? t('guideAgain') : t('guideMe')}
                        </Button>
                      )}
                      <Button size="sm" variant={step.useCaseId ? 'ghost' : 'outline'} className="h-7 gap-1 px-2 text-xs" onClick={() => goTo(step)}>
                        <Compass className="h-3.5 w-3.5" />
                        {t('takeMeThere')}
                      </Button>
                      {canManage && !done && (
                        <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs" loading={toggleSkip.isPending(step.id)} onClick={() => toggleSkip.run(step.id, step)}>
                          {skipped ? <Undo2 className="h-3.5 w-3.5" /> : <SkipForward className="h-3.5 w-3.5" />}
                          {skipped ? t('unskip') : t('skip')}
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </li>
            </React.Fragment>
          );
        })}
      </ol>
    </div>
  );
}
