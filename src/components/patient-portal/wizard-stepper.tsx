'use client';

import { Check } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

export interface WizardStep {
  id: string;
  label: string;
}

interface WizardStepperProps {
  steps: WizardStep[];
  /** Índice del paso actual (0-based). */
  currentIndex: number;
}

/**
 * Indicador de progreso del wizard de acceso. Pensado primero para móvil: en
 * pantallas chicas se ven los círculos numerados con la etiqueta sólo del paso
 * activo; a partir de `sm` se muestran todas las etiquetas.
 */
export function WizardStepper({ steps, currentIndex }: WizardStepperProps) {
  return (
    <ol className="flex items-start" role="list">
      {steps.map((step, index) => {
        const isDone = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isLast = index === steps.length - 1;

        return (
          <li key={step.id} className={cn('flex items-start', !isLast && 'flex-1')}>
            <div className="flex min-w-0 flex-col items-center gap-1.5">
              <div
                aria-current={isCurrent ? 'step' : undefined}
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors',
                  isDone && 'border-primary bg-primary text-primary-foreground',
                  isCurrent && 'border-primary bg-primary/10 text-primary',
                  !isDone && !isCurrent && 'border-muted-foreground/30 text-muted-foreground'
                )}
              >
                {isDone ? <Check className="h-4 w-4" aria-hidden /> : index + 1}
              </div>
              <span
                className={cn(
                  'max-w-[7rem] text-center text-xs leading-tight',
                  isCurrent ? 'font-medium text-foreground' : 'text-muted-foreground',
                  // En móvil sólo se etiqueta el paso activo, para no apretar el layout.
                  !isCurrent && 'hidden sm:block'
                )}
              >
                {step.label}
              </span>
            </div>

            {!isLast && (
              <div
                aria-hidden
                className={cn(
                  'mt-[18px] h-0.5 min-w-4 flex-1 rounded-full transition-colors',
                  isDone ? 'bg-primary' : 'bg-muted-foreground/20'
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
