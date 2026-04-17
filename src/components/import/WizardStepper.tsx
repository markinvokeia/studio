'use client';

import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface WizardStepperProps {
  currentStep: number;
  totalSteps: number;
}

const STEP_KEYS = ['selectType', 'upload', 'preview', 'mapping', 'validate', 'result'] as const;

export function WizardStepper({ currentStep, totalSteps }: WizardStepperProps) {
  const t = useTranslations('ImportPage.steps');
  const currentKey = STEP_KEYS[currentStep];
  const progress = Math.round((currentStep / (totalSteps - 1)) * 100);

  return (
    <div className="w-full space-y-2">
      {/* Mobile: progress bar + step label */}
      <div className="sm:hidden space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Paso {currentStep + 1} de {totalSteps}
          </span>
          <span className="text-xs font-semibold text-primary">
            {currentKey ? t(currentKey) : ''}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-1.5 rounded-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Desktop: circles + labels */}
      <div className="hidden sm:flex items-center justify-between">
        {Array.from({ length: totalSteps }).map((_, index) => {
          const isCompleted = index < currentStep;
          const isActive = index === currentStep;
          const stepKey = STEP_KEYS[index];

          return (
            <div key={index} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors',
                    isCompleted && 'border-primary bg-primary text-primary-foreground',
                    isActive && 'border-primary bg-background text-primary',
                    !isCompleted && !isActive && 'border-muted-foreground/30 bg-background text-muted-foreground'
                  )}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : <span>{index + 1}</span>}
                </div>
                <span
                  className={cn(
                    'text-xs font-medium',
                    isActive && 'text-primary',
                    isCompleted && 'text-primary',
                    !isCompleted && !isActive && 'text-muted-foreground'
                  )}
                >
                  {stepKey ? t(stepKey) : ''}
                </span>
              </div>
              {index < totalSteps - 1 && (
                <div
                  className={cn(
                    'mx-2 mb-5 h-0.5 flex-1 transition-colors',
                    index < currentStep ? 'bg-primary' : 'bg-muted-foreground/20'
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
