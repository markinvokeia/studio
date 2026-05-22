'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface WizardStep {
  title: string;
  description?: string;
}

interface BillingWizardStepperProps {
  steps: WizardStep[];
  currentStep: number;
}

export function BillingWizardStepper({ steps, currentStep }: BillingWizardStepperProps) {
  const totalSteps = steps.length;
  const progress = totalSteps > 1 ? Math.round((currentStep / (totalSteps - 1)) * 100) : 100;

  return (
    <div className="w-full space-y-2">
      {/* Mobile: progress bar + label */}
      <div className="sm:hidden space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            Paso {currentStep + 1} de {totalSteps}
          </span>
          <span className="font-semibold text-primary">{steps[currentStep]?.title}</span>
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
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isActive = index === currentStep;
          return (
            <div key={index} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors',
                    isCompleted && 'border-primary bg-primary text-primary-foreground',
                    isActive && 'border-primary bg-background text-primary',
                    !isCompleted && !isActive && 'border-muted-foreground/30 bg-background text-muted-foreground',
                  )}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : <span>{index + 1}</span>}
                </div>
                <span
                  className={cn(
                    'text-xs font-medium whitespace-nowrap',
                    isActive && 'text-primary',
                    isCompleted && 'text-primary',
                    !isCompleted && !isActive && 'text-muted-foreground',
                  )}
                >
                  {step.title}
                </span>
              </div>
              {index < totalSteps - 1 && (
                <div
                  className={cn(
                    'mx-2 mb-5 h-0.5 flex-1 transition-colors',
                    index < currentStep ? 'bg-primary' : 'bg-muted-foreground/20',
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
