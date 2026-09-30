'use client';

import * as React from 'react';
import { AlertTriangle, Ban } from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { formatDisplayDate } from '@/lib/utils';
import type { DuplicateContactOwner, DuplicateContactOwners, UniqueConflict } from '@/lib/types';

type OwnerField = 'phone' | 'email';

/** Lista de fichas que ya usan un teléfono/correo, con datos para distinguir personas. */
function OwnersSection({ field, owners }: { field: OwnerField; owners: DuplicateContactOwner[] }) {
  const t = useTranslations('DuplicateContact');

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-medium">{t('usedBy', { field: t(`fields.${field}`) })}</h3>
      <ul className="space-y-2">
        {owners.map((owner) => (
          <li key={owner.id} className="rounded-lg border bg-muted/40 px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">{owner.name}</span>
              {!owner.is_active && <Badge variant="secondary">{t('inactive')}</Badge>}
            </div>
            {(owner.document || owner.birth_date) && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {[
                  owner.document && t('document', { value: owner.document }),
                  owner.birth_date && t('birthDate', { value: formatDisplayDate(owner.birth_date) }),
                ].filter(Boolean).join(' · ')}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

interface DuplicateContactDialogProps {
  /** Dueños del contacto repetido; `null` mantiene el diálogo cerrado. */
  owners: DuplicateContactOwners | null;
  /** Volver al formulario sin guardar. */
  onCancel: () => void;
  /** Guardar igualmente, sabiendo que otro paciente comparte el contacto. */
  onConfirm: () => void;
}

/**
 * Advertencia al guardar un paciente cuyo teléfono ya usa otra ficha
 * (`clinic_preferences.allow_duplicate_phone` activo). Dice QUIÉN lo tiene, con
 * documento y fecha de nacimiento para que recepción distinga a un familiar de un
 * paciente ya registrado, y deja elegir entre corregir o guardar de todos modos.
 */
export function DuplicateContactDialog({ owners, onCancel, onConfirm }: DuplicateContactDialogProps) {
  const t = useTranslations('DuplicateContact');
  const phoneOwners = owners?.phone;

  return (
    <AlertDialog open={owners !== null} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
            {t('title')}
          </AlertDialogTitle>
          <AlertDialogDescription>{t('description')}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="max-h-[50vh] space-y-4 overflow-y-auto px-6 py-3">
          {phoneOwners?.length ? <OwnersSection field="phone" owners={phoneOwners} /> : null}
          <p className="text-xs leading-relaxed text-muted-foreground">{t('hint')}</p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
          <Button type="button" onClick={onConfirm}>{t('confirm')}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface UniqueConflictDialogProps {
  /** Campo(s) repetido(s) y quién los tiene; `null` mantiene el diálogo cerrado. */
  conflict: UniqueConflict | null;
  onClose: () => void;
}

/**
 * Bloqueo al guardar un dato que no puede repetirse (correo, documento, o teléfono con la
 * opción apagada). Es un modal a propósito: un error inline pasa desapercibido cuando el
 * formulario está scrolleado hacia abajo. Nombra a quien ya tiene el dato.
 */
export function UniqueConflictDialog({ conflict, onClose }: UniqueConflictDialogProps) {
  const t = useTranslations('DuplicateContact');

  return (
    <AlertDialog open={conflict !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Ban className="h-5 w-5 shrink-0 text-destructive" />
            {t('conflictTitle')}
          </AlertDialogTitle>
          <AlertDialogDescription>{t('conflictDescription')}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="max-h-[50vh] space-y-4 overflow-y-auto px-6 py-3">
          {conflict?.conflictedFields.map((field) => {
            const owners = field === 'phone' || field === 'email' ? conflict.owners[field] : undefined;
            if (owners?.length) {
              return <OwnersSection key={field} field={field as OwnerField} owners={owners} />;
            }
            const label = t.has(`fields.${field}`) ? t(`fields.${field}`) : field;
            return <p key={field} className="text-sm">{t('conflictNoOwner', { field: label })}</p>;
          })}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>{t('understood')}</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
