'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import type { FieldErrors, FieldValues } from 'react-hook-form';

import { toast } from '@/hooks/use-toast';

/** Primer mensaje de error en el árbol de `FieldErrors` (incluye arrays de ítems y errores `root`). */
function firstErrorMessage(errors: unknown, depth = 0): string | undefined {
  if (!errors || typeof errors !== 'object' || depth > 6) return undefined;
  const node = errors as Record<string, unknown>;
  if (typeof node.message === 'string' && node.message.trim()) return node.message;
  for (const [key, value] of Object.entries(node)) {
    if (key === 'ref' || key === 'types') continue;
    const found = firstErrorMessage(value, depth + 1);
    if (found) return found;
  }
  return undefined;
}

/**
 * Segundo argumento de `form.handleSubmit(onSubmit, onInvalid)`. Sin él, cuando la
 * validación rechaza un campo que no está a la vista (otra pestaña, fuera del scroll,
 * un array de ítems vacío o un campo sin <FormMessage>) el clic en Guardar no hace
 * nada. Avisa con un toast con el primer error y lleva el scroll al primer campo
 * marcado con aria-invalid.
 */
export function useInvalidSubmitToast() {
  const t = useTranslations('FormValidation');

  return React.useCallback(
    <T extends FieldValues>(errors: FieldErrors<T>) => {
      const detail = firstErrorMessage(errors);
      toast({ variant: 'destructive', title: t('title'), description: detail ?? t('description') });
      if (typeof window === 'undefined') return;
      window.requestAnimationFrame(() => {
        document.querySelector<HTMLElement>('[aria-invalid="true"]')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      });
    },
    [t]
  );
}
