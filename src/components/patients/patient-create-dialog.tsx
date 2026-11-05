'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { PatientFormDialogShell } from '@/components/patients/patient-form-dialog-shell';
import { PatientInfoTab } from '@/components/patients/patient-info-tab';

import type { User } from '@/lib/types';

interface PatientCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Prefill for the name field (e.g. the search query the user typed). */
  initialName?: string;
  /** Called with the newly created patient (id resolved) after a successful save. */
  onCreated: (user: User) => void;
  /** Show the guarded Cancel action used when opened from custom calendar mode. */
  showCancelAction?: boolean;
  /**
   * Alta desde una cita: si la cédula/teléfono ya son de otra ficha, recepción puede elegir
   * esa ficha y se devuelve acá (la ventana se cierra igual que al crear).
   */
  onSelectExisting?: (user: User) => void;
}

/**
 * Quick "new patient" window: the same full patient form used by the patient
 * quick view, in create mode. Used by flows that need a richer form than an
 * inline mini-create (e.g. the calendar's inline appointment draft).
 */
export function PatientCreateDialog({ open, onOpenChange, initialName, onCreated, showCancelAction = false, onSelectExisting }: PatientCreateDialogProps) {
  const t = useTranslations('UsersPage.createDialog');
  const tMatch = useTranslations('PatientMatch.completing');
  const [isPatientFormDirty, setIsPatientFormDirty] = React.useState(false);
  // Nombre de la ficha existente que se está completando en lugar del alta.
  const [completingName, setCompletingName] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setIsPatientFormDirty(false);
      setCompletingName(null);
    }
  }, [initialName, open]);

  return (
    <PatientFormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={completingName ? tMatch('dialogTitle', { name: completingName }) : t('title')}
      description={completingName ? tMatch('dialogDescription') : t('description')}
      confirmOnClose={showCancelAction}
      isDirty={isPatientFormDirty}
    >
      {/* Remount per open so every "new patient" starts from a clean form */}
      {open && (
        <PatientInfoTab
          variant="dialog"
          initialName={initialName}
          showCancelAction={showCancelAction}
          onDirtyChange={setIsPatientFormDirty}
          onCompletingChange={setCompletingName}
          onSaved={(created) => {
            onCreated(created);
            onOpenChange(false);
          }}
          onSelectExisting={onSelectExisting && ((existing) => {
            onSelectExisting(existing);
            onOpenChange(false);
          })}
        />
      )}
    </PatientFormDialogShell>
  );
}
