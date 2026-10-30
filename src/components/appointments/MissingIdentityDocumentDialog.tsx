'use client';

import { IdCard } from 'lucide-react';
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

import { useMissingIdentityDocumentStore } from '@/stores/missing-identity-document-store';
import { usePatientView } from '@/stores/patient-view-store';
import { usePermissions } from '@/hooks/usePermissions';
import { PATIENTS_PERMISSIONS } from '@/constants/permissions';

/**
 * Único aviso de bloqueo por documento faltante. Lo abre
 * `showMissingIdentityDocumentBlock`; se monta una vez en el layout. El cambio
 * de estado ya fue rechazado: "Entendido" abre los datos del paciente (el mismo
 * diálogo simplificado del lápiz de la cita) para que carguen el documento; al
 * guardarlo con documento se reintenta solo el cambio de estado (`notice.retry`).
 * "Cerrar" solo descarta el aviso.
 */
export function MissingIdentityDocumentDialog() {
  const t = useTranslations('MissingIdentityDocumentDialog');
  const tStatus = useTranslations('AppointmentStatus');
  const notice = useMissingIdentityDocumentStore((s) => s.notice);
  const close = useMissingIdentityDocumentStore((s) => s.close);
  const openPatientView = usePatientView((s) => s.open);
  const { hasAllPermissions } = usePermissions();

  // Mismos permisos que el lápiz de la cita: ver la info del paciente y editarla.
  const canEditPatient = hasAllPermissions([PATIENTS_PERMISSIONS.VIEW_DETAIL_INFO, PATIENTS_PERMISSIONS.UPDATE]);
  const patient = canEditPatient ? notice?.patient : undefined;

  const handleAcknowledge = () => {
    close();
    if (!patient) return;
    const retry = notice?.retry;
    openPatientView({
      // Guardar sin documento (p. ej. solo otros datos) no reintenta: volvería a bloquearse.
      onSaved: retry
        ? (updated) => {
            if (updated.identity_document?.trim()) void retry();
          }
        : undefined,
      userId: patient.id,
      userName: patient.name,
      userEmail: patient.email,
      userPhone: patient.phone,
      initialTab: 'info',
      infoOnly: true,
      showCancelAction: true,
    });
  };

  return (
    <AlertDialog open={notice !== null} onOpenChange={(open) => !open && close()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <IdCard className="h-5 w-5 shrink-0 text-destructive" />
            {t('title')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {notice &&
              (notice.patientName
                ? t('description', { patient: notice.patientName, status: tStatus(notice.status) })
                : t('descriptionNoName', { status: tStatus(notice.status) }))}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {patient && <AlertDialogCancel>{t('dismiss')}</AlertDialogCancel>}
          <AlertDialogAction onClick={handleAcknowledge}>{t('close')}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
