'use client';

import * as React from 'react';
import { AlertTriangle, Ban, UserCheck, UserSearch } from 'lucide-react';
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
import { AdoptDependentsPanel } from '@/components/patients/duplicate-contact-dialog';

import { getAdoptableOwners } from '@/components/patients/patient-form-utils';
import { useAsyncAction } from '@/hooks/use-async-action';
import { formatDisplayDate } from '@/lib/utils';
import type { DuplicateContactOwner, DuplicateContactOwners, PatientMatchField } from '@/lib/types';

/**
 * Por qué se abre:
 * - `lookup`: el formulario encontró fichas con la misma cédula/teléfono mientras se escribía.
 * - `warning`: `/users/upsert` respondió `duplicate_contact` (teléfono compartido permitido).
 * - `conflict`: `/users/upsert` respondió `unique_conflict` (no se puede crear).
 */
export type PatientMatchReason = 'lookup' | 'warning' | 'conflict';

export interface PatientMatchState {
  reason: PatientMatchReason;
  owners: DuplicateContactOwners;
  /** Campos en conflicto según el backend; los que no traen dueños se listan sin ficha. */
  conflictedFields?: string[];
}

/** La cédula identifica a la persona: va primero. El teléfono puede ser de un familiar. */
const FIELD_ORDER: PatientMatchField[] = ['identity_document', 'email', 'phone'];

export interface PatientMatchCandidate {
  owner: DuplicateContactOwner;
  fields: PatientMatchField[];
}

/** Une las fichas de todos los campos (una persona puede coincidir por cédula y por teléfono). */
export function groupCandidates(owners: DuplicateContactOwners): PatientMatchCandidate[] {
  const byId = new Map<string, PatientMatchCandidate>();
  for (const field of FIELD_ORDER) {
    for (const owner of owners[field] ?? []) {
      const id = String(owner.id);
      const existing = byId.get(id);
      if (existing) existing.fields.push(field);
      else byId.set(id, { owner: { ...owner, id }, fields: [field] });
    }
  }
  // Orden estable sin importar de dónde vengan (búsqueda o `/users/upsert`): primero la
  // coincidencia más fuerte, después la que coincide en más datos, después por nombre.
  const strength = (c: PatientMatchCandidate) => Math.min(...c.fields.map((f) => FIELD_ORDER.indexOf(f)));
  return [...byId.values()].sort(
    (a, b) => strength(a) - strength(b)
      || b.fields.length - a.fields.length
      || a.owner.name.localeCompare(b.owner.name),
  );
}

interface PatientMatchDialogProps {
  /** `null` mantiene el diálogo cerrado. */
  match: PatientMatchState | null;
  /** Usar la ficha existente (p. ej. para la cita). El diálogo queda bloqueado hasta que resuelve. */
  onSelect: (owner: DuplicateContactOwner) => Promise<void>;
  /** Volver al formulario sin cambiar nada. */
  onCancel: () => void;
  /** Solo con `warning`: crear igual, sabiendo que otra ficha comparte el teléfono. */
  onCreateAnyway?: () => void;
  /** Crear pasando a las fichas elegidas a depender del paciente nuevo. Sin esto no se ofrece. */
  onAdopt?: (ownerIds: string[]) => void;
}

/**
 * Coincidencias al crear un paciente desde una cita: muestra las fichas que ya tienen esa
 * cédula, correo o teléfono, con datos para distinguir a la persona de un familiar, y deja
 * elegir la correcta para seguir con la cita sin salir de la ventana.
 */
export function PatientMatchDialog({ match, onSelect, onCancel, onCreateAnyway, onAdopt }: PatientMatchDialogProps) {
  const t = useTranslations('PatientMatch');
  const tContact = useTranslations('DuplicateContact');
  const [selectingId, setSelectingId] = React.useState<string | null>(null);

  const select = useAsyncAction(async (owner: DuplicateContactOwner) => {
    setSelectingId(owner.id);
    try {
      await onSelect(owner);
    } finally {
      setSelectingId(null);
    }
  });

  const candidates = React.useMemo(() => (match ? groupCandidates(match.owners) : []), [match]);
  // Campos bloqueados sin dueños conocidos (backend sin `identity_document_owners`).
  const fieldsWithoutOwners = (match?.conflictedFields ?? []).filter(
    (field) => !match?.owners[field as PatientMatchField]?.length,
  );
  const reason = match?.reason ?? 'lookup';
  // Solo tras intentar guardar: el aviso mientras se escribe aún no tiene `adoptable`.
  const adoptable = match && onAdopt && reason !== 'lookup'
    ? getAdoptableOwners(match.owners, reason === 'conflict' ? match.conflictedFields : undefined)
    : [];
  const Icon = reason === 'conflict' ? Ban : reason === 'warning' ? AlertTriangle : UserSearch;

  return (
    <AlertDialog
      open={match !== null}
      onOpenChange={(open) => {
        if (!open && !select.isPending) onCancel();
      }}
    >
      <AlertDialogContent className="max-w-lg" data-help-id="appointments.section.patient-matches">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Icon className={reason === 'conflict' ? 'h-5 w-5 shrink-0 text-destructive' : 'h-5 w-5 shrink-0 text-amber-500'} />
            {t(`${reason}.title`)}
          </AlertDialogTitle>
          <AlertDialogDescription>{t(`${reason}.description`)}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="max-h-[55vh] space-y-2 overflow-y-auto px-6 py-3">
          {candidates.map(({ owner, fields }) => {
            const selectable = owner.is_patient !== false;
            const details = [
              owner.document && tContact('document', { value: owner.document }),
              owner.birth_date && tContact('birthDate', { value: formatDisplayDate(owner.birth_date) }),
              owner.phone_number && t('phone', { value: owner.phone_number }),
            ].filter(Boolean);
            return (
              <div key={owner.id} className="flex items-start gap-3 rounded-lg border bg-muted/40 px-3 py-2.5">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-semibold">{owner.name}</span>
                    {!owner.is_active && <Badge variant="secondary">{tContact('inactive')}</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {fields.map((field) => (
                      <Badge
                        key={field}
                        variant="outline"
                        className={field === 'identity_document' ? 'border-amber-500/50 text-amber-700 dark:text-amber-400' : undefined}
                      >
                        {t(`matchedBy.${field}`)}
                      </Badge>
                    ))}
                  </div>
                  {details.length > 0 && <p className="text-xs text-muted-foreground">{details.join(' · ')}</p>}
                  {owner.is_dependent && owner.responsible_name && (
                    <p className="text-xs text-muted-foreground">{t('dependentOf', { name: owner.responsible_name })}</p>
                  )}
                </div>
                {selectable ? (
                  <Button
                    type="button"
                    size="sm"
                    variant={fields.includes('identity_document') ? 'default' : 'outline'}
                    className="shrink-0"
                    loading={selectingId === owner.id}
                    disabled={select.isPending}
                    onClick={() => void select.run(owner)}
                    data-help-id="appointments.btn.use-existing-patient"
                  >
                    <UserCheck className="mr-1.5 h-4 w-4" />
                    {t('useExisting')}
                  </Button>
                ) : (
                  <span className="shrink-0 pt-1 text-xs text-muted-foreground">{t('notPatient')}</span>
                )}
              </div>
            );
          })}
          {fieldsWithoutOwners.map((field) => {
            const label = tContact.has(`fields.${field}`) ? tContact(`fields.${field}`) : field;
            return <p key={field} className="text-sm">{tContact('conflictNoOwner', { field: label })}</p>;
          })}
          {onAdopt && (
            <AdoptDependentsPanel
              owners={adoptable}
              allRequired={reason === 'conflict'}
              disabled={select.isPending}
              onAdopt={onAdopt}
            />
          )}
          <p className="pt-1 text-xs leading-relaxed text-muted-foreground">{t(`${reason}.hint`)}</p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={select.isPending}>{t(`${reason}.cancel`)}</AlertDialogCancel>
          {reason === 'warning' && onCreateAnyway && (
            <Button type="button" variant="outline" disabled={select.isPending} onClick={onCreateAnyway}>
              {t('createAnyway')}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
