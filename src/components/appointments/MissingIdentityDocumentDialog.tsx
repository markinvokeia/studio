'use client';

import { IdCard } from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import { useMissingIdentityDocumentStore } from '@/stores/missing-identity-document-store';

/**
 * Único aviso de bloqueo por documento faltante. Lo abre
 * `showMissingIdentityDocumentBlock`; se monta una vez en el layout. El cambio
 * de estado ya fue rechazado: no hay forma de continuar desde acá.
 */
export function MissingIdentityDocumentDialog() {
  const t = useTranslations('MissingIdentityDocumentDialog');
  const tStatus = useTranslations('AppointmentStatus');
  const notice = useMissingIdentityDocumentStore((s) => s.notice);
  const close = useMissingIdentityDocumentStore((s) => s.close);

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
          <AlertDialogAction onClick={close}>{t('close')}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
