'use client';

import * as React from 'react';
import { AlertTriangle, Pencil, UserPlus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataCard } from '@/components/ui/data-card';
import { PatientDependentLinkPicker } from '@/components/patients/patient-dependent-link-picker';
import { PatientDependentsTab } from '@/components/patients/patient-dependents-tab';
import { PatientFormDialogShell } from '@/components/patients/patient-form-dialog-shell';
import { savePatientGroups } from '@/components/patients/patient-groups-field';
import { PatientInfoTab, type DependentDraftFormData } from '@/components/patients/patient-info-tab';
import {
  contactMovedToGuardian,
  fetchPatientById,
  getDuplicateContactWarning,
  getUniqueConflict,
  getUpsertErrorPayload,
  resolveDependencyErrorCode,
  resolveUserUpsertError,
  setPatientResponsible,
  upsertUser,
} from '@/components/patients/patient-form-utils';
import { usePermissions } from '@/hooks/usePermissions';
import { getErrorMessage } from '@/lib/error-utils';
import { computeAge } from '@/lib/prescription-render';
import { isTimeoutError } from '@/services/api';
import { extractCreatedUserId } from '@/services/users';
import { PATIENTS_PERMISSIONS } from '@/constants/permissions';
import type { DuplicateContactOwners, User } from '@/lib/types';

/** Tutor de un borrador: todavía no existe y el id real se pone al guardar. */
const PENDING_GUARDIAN_ID = 'pending-guardian';

/** Dependiente cargado en el alta del tutor, que se guarda después de él. */
export type DependentDraft = { key: string; error?: string } & (
  | { kind: 'new'; data: DependentDraftFormData; confirmDuplicates?: boolean }
  | { kind: 'link'; patient: User }
);

type Translate = (key: string, values?: Record<string, string | number>) => string;

function ownerNames(owners: DuplicateContactOwners): string {
  const names = Object.values(owners).flat().map((owner) => owner?.name).filter(Boolean);
  return [...new Set(names)].join(', ');
}

/** Crea el dependiente a cargo del tutor. El contacto igual al del tutor no se repite: lo usa de él. */
async function createDependent(guardian: User, draft: Extract<DependentDraft, { kind: 'new' }>) {
  const { values, groupIds } = draft.data;
  const shared = contactMovedToGuardian({ phone: values.phone, email: values.email }, guardian);
  const response = await upsertUser(
    {
      ...values,
      id: undefined,
      phone: shared.phone ? '' : values.phone,
      email: shared.email ? '' : values.email,
      is_dependent: true,
      responsible_contact_id: guardian.id,
    },
    { confirmDuplicates: draft.confirmDuplicates },
  );
  const createdId = extractCreatedUserId(response);
  if (createdId && groupIds.length > 0) {
    try {
      await savePatientGroups(createdId, groupIds);
    } catch (groupsError) {
      console.error('Failed to assign groups to the new dependent:', groupsError);
    }
  }
}

/** El motivo que se muestra en la fila, y si al reintentar se confirma el teléfono repetido. */
function describeDraftError(error: unknown, t: Translate): Pick<DependentDraft, 'error'> & { confirmDuplicates?: boolean } {
  if (isTimeoutError(error)) return { error: t('UsersPage.dependents.draft.timeout') };
  const duplicateOwners = getDuplicateContactWarning(error);
  if (duplicateOwners) {
    return {
      error: t('UsersPage.dependents.draft.duplicateContact', { names: ownerNames(duplicateOwners) }),
      confirmDuplicates: true,
    };
  }
  const conflict = getUniqueConflict(getUpsertErrorPayload(error));
  if (conflict) {
    const names = ownerNames(conflict.owners);
    return {
      error: names
        ? t('UsersPage.dependents.draft.uniqueConflict', { names })
        : t('UsersPage.dependents.draft.uniqueConflictUnknown'),
    };
  }
  return {
    error: resolveUserUpsertError(error, t)
      ?? resolveDependencyErrorCode((error as { code?: string })?.code, t)
      ?? getErrorMessage(error),
  };
}

/**
 * Guarda los borradores en serie, una vez que el tutor existe. Devuelve los que fallaron, cada
 * uno con su motivo; un error no frena a los demás. Tras un timeout no se reintenta solo: el
 * backend puede haberlo guardado igual.
 */
export async function saveDependentDrafts(
  guardian: User,
  drafts: DependentDraft[],
  t: Translate,
  notifyPatientUpdated: (patient: User) => void,
): Promise<DependentDraft[]> {
  const failed: DependentDraft[] = [];
  for (const draft of drafts) {
    try {
      if (draft.kind === 'link') {
        await setPatientResponsible(draft.patient.id, guardian.id);
        fetchPatientById(draft.patient.id).then((u) => { if (u) notifyPatientUpdated(u); }).catch(() => {});
      } else {
        await createDependent(guardian, draft);
      }
    } catch (error) {
      const description = describeDraftError(error, t);
      failed.push(draft.kind === 'new' ? { ...draft, ...description } : { ...draft, error: description.error });
    }
  }
  return failed;
}

interface PatientDependentsSectionProps {
  /** Paciente ya guardado: su lista real, donde cada cambio se guarda en el momento. */
  patient: User | null;
  /** Nombre escrito en el formulario, para el borrador de un tutor sin guardar. */
  guardianName?: string;
  /** Dependientes por guardar. Sin esto, la sección solo administra la lista real. */
  drafts?: DependentDraft[];
  onDraftsChange?: (drafts: DependentDraft[]) => void;
  /** Cambia para volver a leer la lista real, después de guardar borradores. */
  refreshKey?: number;
  disabled?: boolean;
}

/**
 * "Pacientes a cargo" dentro de la ventana simplificada de paciente. Sobre un paciente guardado
 * es la pestaña de la ficha; en un alta acumula borradores que se guardan con el botón Guardar
 * del formulario, y si alguno falla queda acá con su motivo para corregirlo o reintentar.
 */
export function PatientDependentsSection({
  patient,
  guardianName = '',
  drafts = [],
  onDraftsChange,
  refreshKey = 0,
  disabled = false,
}: PatientDependentsSectionProps) {
  const t = useTranslations('UsersPage.dependents');
  const { hasPermission } = usePermissions();
  const canManage = hasPermission(PATIENTS_PERMISSIONS.UPDATE);
  const canCreate = canManage && hasPermission(PATIENTS_PERMISSIONS.CREATE);
  const responsibleName = patient?.name || guardianName || t('draft.thisPatient');

  const [isLinkOpen, setLinkOpen] = React.useState(false);
  const [reassigning, setReassigning] = React.useState<User | null>(null);
  // Ventana del borrador: `draft` nulo es uno nuevo.
  const [editor, setEditor] = React.useState<{ draft: Extract<DependentDraft, { kind: 'new' }> | null } | null>(null);
  const [isEditorDirty, setEditorDirty] = React.useState(false);

  const linkedIds = React.useMemo(
    () => new Set(drafts.flatMap((d) => (d.kind === 'link' ? [d.patient.id] : []))),
    [drafts],
  );

  const addLinkDraft = (candidate: User) => {
    onDraftsChange?.([...drafts, { key: crypto.randomUUID(), kind: 'link', patient: candidate }]);
  };

  /** Paciente elegido para vincular: si ya está a cargo de otro tutor, primero se confirma. */
  const handlePick = (candidate: User) => {
    if (linkedIds.has(candidate.id)) return;
    setLinkOpen(false);
    setEditor(null);
    if (candidate.is_dependent) setReassigning(candidate);
    else addLinkDraft(candidate);
  };

  const handleDraftSubmit = (data: DependentDraftFormData) => {
    const editing = editor?.draft;
    onDraftsChange?.(editing
      // Corregido a mano: el motivo anterior y la confirmación de duplicado ya no valen.
      ? drafts.map((d) => (d.key === editing.key ? { key: d.key, kind: 'new', data } : d))
      : [...drafts, { key: crypto.randomUUID(), kind: 'new', data }]);
    setEditor(null);
  };

  const renderDraft = (draft: DependentDraft) => {
    const age = draft.kind === 'new' ? computeAge(draft.data.values.birth_date) : computeAge(draft.patient.birth_date);
    const name = draft.kind === 'new' ? draft.data.values.name : draft.patient.name;
    const document = draft.kind === 'new' ? draft.data.values.identity_document : draft.patient.identity_document;
    return (
      <div key={draft.key} className="space-y-1">
        <DataCard
          title={name}
          subtitle={[age ? t('age', { age }) : null, document].filter(Boolean).join(' · ')}
          badge={(
            <Badge variant="outline" className="text-[10px] font-normal">
              {draft.kind === 'new' ? t('draft.pendingBadge') : t('draft.linkBadge')}
            </Badge>
          )}
          actions={(
            <div className="flex items-center gap-1">
              {draft.kind === 'new' && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={disabled}
                  onClick={() => setEditor({ draft })}
                  aria-label={t('draft.edit', { name })}
                  title={t('draft.edit', { name })}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                disabled={disabled}
                onClick={() => onDraftsChange?.(drafts.filter((d) => d.key !== draft.key))}
                aria-label={t('draft.remove', { name })}
                title={t('draft.remove', { name })}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        />
        {draft.error && (
          <p className="flex items-start gap-1.5 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{draft.error}</span>
          </p>
        )}
      </div>
    );
  };

  const draftRows = drafts.length > 0 ? <div className="space-y-2">{drafts.map(renderDraft)}</div> : null;

  return (
    <section className="space-y-3 rounded-lg border p-3" data-help-id="appointments.section.patient-dependents">
      {patient ? (
        <>
          {draftRows}
          <PatientDependentsTab key={`${patient.id}:${refreshKey}`} patient={patient} compact />
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">{t('title')}</h3>
              <Badge variant="secondary" className="text-[10px]">{drafts.length}</Badge>
            </div>
            {canManage && (
              <div className="flex items-center gap-2">
                <PatientDependentLinkPicker
                  open={isLinkOpen}
                  onOpenChange={setLinkOpen}
                  guardianId=""
                  linkedIds={linkedIds}
                  onPick={handlePick}
                />
                {canCreate && (
                  <Button
                    type="button"
                    size="sm"
                    className="gap-1.5"
                    disabled={disabled}
                    onClick={() => setEditor({ draft: null })}
                    data-help-id="appointments.btn.add-dependent"
                  >
                    <UserPlus className="h-4 w-4" />
                    {t('addNew')}
                  </Button>
                )}
              </div>
            )}
          </div>
          {draftRows ?? <p className="text-xs text-muted-foreground">{t('draft.emptyHint')}</p>}
        </>
      )}

      <AlertDialog open={!!reassigning} onOpenChange={(open) => { if (!open) setReassigning(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('reassignTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {reassigning?.responsible_contact_name
                ? t('reassignDescriptionNamed', { name: reassigning.name, current: reassigning.responsible_contact_name, responsible: responsibleName })
                : t('reassignDescription', { name: reassigning?.name ?? '', responsible: responsibleName })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (reassigning) addLinkDraft(reassigning);
                setReassigning(null);
              }}
            >
              {t('reassignConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PatientFormDialogShell
        open={!!editor}
        onOpenChange={(open) => { if (!open) setEditor(null); }}
        title={t('createTitle')}
        description={t('draft.dialogDescription', { name: responsibleName })}
        confirmOnClose
        isDirty={isEditorDirty}
      >
        {editor && (
          <PatientInfoTab
            variant="dialog"
            showCancelAction
            initialResponsible={{ id: PENDING_GUARDIAN_ID, name: responsibleName }}
            draftDependent={{ initial: editor.draft?.data, onSubmit: handleDraftSubmit }}
            onSelectExisting={handlePick}
            onDirtyChange={setEditorDirty}
          />
        )}
      </PatientFormDialogShell>
    </section>
  );
}
