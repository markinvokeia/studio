'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import {
  PatientDependentsSection,
  saveDependentDrafts,
  type DependentDraft,
} from '@/components/patients/patient-dependents-section';
import { PatientFormDialogShell } from '@/components/patients/patient-form-dialog-shell';
import { PatientInfoTab } from '@/components/patients/patient-info-tab';

import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import { usePatientView } from '@/stores/patient-view-store';

import { PATIENTS_PERMISSIONS } from '@/constants/permissions';
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
  /**
   * Permite cargar los dependientes en el mismo formulario. Es para hosts que siguen con otra
   * cosa (la cita): si el host abre la ficha completa al guardar, ya los tiene ahí.
   */
  withDependents?: boolean;
}

/**
 * Quick "new patient" window: the same full patient form used by the patient
 * quick view, in create mode. Used by flows that need a richer form than an
 * inline mini-create (e.g. the calendar's inline appointment draft).
 */
export function PatientCreateDialog({ open, onOpenChange, initialName, onCreated, showCancelAction = false, onSelectExisting, withDependents = false }: PatientCreateDialogProps) {
  const t = useTranslations('UsersPage.createDialog');
  const tMatch = useTranslations('PatientMatch.completing');
  const tDrafts = useTranslations('UsersPage.dependents.draft');
  const tRoot = useTranslations();
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const notifyPatientUpdated = usePatientView((s) => s.notifyPatientUpdated);
  const showDependents = withDependents && hasPermission(PATIENTS_PERMISSIONS.UPDATE);

  const [isPatientFormDirty, setIsPatientFormDirty] = React.useState(false);
  // Nombre de la ficha existente que se está completando en lugar del alta.
  const [completingName, setCompletingName] = React.useState<string | null>(null);
  const [drafts, setDrafts] = React.useState<DependentDraft[]>([]);
  const [isSavingDrafts, setIsSavingDrafts] = React.useState(false);
  const savingDraftsRef = React.useRef(false);
  // Paciente ya guardado cuando falló algún dependiente: el formulario sigue abierto sobre él.
  const [savedPatient, setSavedPatient] = React.useState<User | null>(null);
  const [dependentsRefresh, setDependentsRefresh] = React.useState(0);
  // A quién se le devuelve el paciente si se cierra la ventana después de ese fallo.
  const deliverRef = React.useRef<(user: User) => void>(onCreated);

  React.useEffect(() => {
    if (open) {
      setIsPatientFormDirty(false);
      setCompletingName(null);
      setDrafts([]);
      setSavedPatient(null);
    }
  }, [initialName, open]);

  /** El paciente ya existe: guarda sus dependientes y recién entonces lo entrega al host. */
  const finish = async (patient: User, deliver: (user: User) => void) => {
    if (savingDraftsRef.current) return;
    const close = () => {
      deliver(patient);
      onOpenChange(false);
    };
    if (drafts.length === 0) {
      close();
      return;
    }
    // Sin id no hay a quién vincularlos, y un dependiente no puede tener dependientes.
    if (!patient.id || patient.is_dependent) {
      toast({
        variant: 'destructive',
        title: tDrafts('notSavedTitle'),
        description: tDrafts('notSavedDescription', { name: patient.name }),
      });
      close();
      return;
    }
    savingDraftsRef.current = true;
    setIsSavingDrafts(true);
    try {
      const failed = await saveDependentDrafts(patient, drafts, tRoot, notifyPatientUpdated);
      if (failed.length === 0) {
        toast({ title: tDrafts('savedTitle', { count: drafts.length }) });
        close();
        return;
      }
      toast({
        variant: 'destructive',
        title: tDrafts('partialTitle', { name: patient.name }),
        description: tDrafts('partialDescription', { count: failed.length }),
      });
      deliverRef.current = deliver;
      setDrafts(failed);
      setSavedPatient(patient);
      setDependentsRefresh((n) => n + 1);
    } finally {
      savingDraftsRef.current = false;
      setIsSavingDrafts(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && isSavingDrafts) return;
    // Ya está creado: aunque queden dependientes sin guardar, la cita tiene que recibirlo.
    if (!next && savedPatient) deliverRef.current(savedPatient);
    onOpenChange(next);
  };

  return (
    <PatientFormDialogShell
      open={open}
      onOpenChange={handleOpenChange}
      title={completingName ? tMatch('dialogTitle', { name: completingName }) : savedPatient ? savedPatient.name : t('title')}
      description={completingName ? tMatch('dialogDescription') : savedPatient ? tDrafts('retryDescription') : t('description')}
      confirmOnClose={showCancelAction || drafts.length > 0}
      isDirty={isPatientFormDirty || drafts.length > 0}
    >
      {/* Remount per open so every "new patient" starts from a clean form */}
      {open && (
        <PatientInfoTab
          variant="dialog"
          userId={savedPatient?.id}
          user={savedPatient ?? undefined}
          initialName={initialName}
          showCancelAction={showCancelAction}
          onDirtyChange={setIsPatientFormDirty}
          onCompletingChange={setCompletingName}
          lockDependentCheckbox={drafts.length > 0}
          renderDependents={showDependents ? ({ patient, guardianName }) => (
            <PatientDependentsSection
              patient={patient}
              guardianName={guardianName}
              drafts={drafts}
              onDraftsChange={setDrafts}
              refreshKey={dependentsRefresh}
              disabled={isSavingDrafts}
            />
          ) : undefined}
          onSaved={(created) => finish(created, onCreated)}
          onSelectExisting={onSelectExisting && ((existing) => finish(existing, onSelectExisting))}
        />
      )}
    </PatientFormDialogShell>
  );
}
