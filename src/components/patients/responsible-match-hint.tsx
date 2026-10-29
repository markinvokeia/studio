'use client';

import * as React from 'react';
import { Users } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';
import type { User } from '@/lib/types';

interface ResponsibleMatchHintProps {
  user: Pick<User, 'is_dependent' | 'responsible_contact_name' | 'responsible_phone_number' | 'matched_by_responsible'>;
  /** Mostrar solo cuando el resultado apareció por los datos del tutor (listados largos). */
  onlyWhenMatched?: boolean;
  className?: string;
}

/**
 * "A cargo de {tutor} · {teléfono}" bajo un resultado de búsqueda de pacientes. La
 * búsqueda de `/users` también encuentra a un dependiente por el teléfono de su tutor;
 * sin esta línea aparecería un paciente con un número que no es el suyo. Se resalta
 * cuando el resultado vino justamente por el tutor.
 */
export function ResponsibleMatchHint({ user, onlyWhenMatched = false, className }: ResponsibleMatchHintProps) {
  const t = useTranslations('UsersPage');
  if (!user.is_dependent || !user.responsible_contact_name) return null;
  if (onlyWhenMatched && !user.matched_by_responsible) return null;

  const label = user.responsible_phone_number
    ? t('responsibleMatchWithPhone', { name: user.responsible_contact_name, phone: user.responsible_phone_number })
    : t('responsibleMatch', { name: user.responsible_contact_name });

  return (
    <span
      className={cn(
        'flex min-w-0 items-center gap-1 text-xs',
        user.matched_by_responsible ? 'text-primary' : 'text-muted-foreground',
        className,
      )}
    >
      <Users className="h-3 w-3 shrink-0" />
      <span className="truncate">{label}</span>
    </span>
  );
}
