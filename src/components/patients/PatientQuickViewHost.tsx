'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import { PatientDetailSheet } from '@/components/appointments/PatientDetailSheet';
import { PatientInfoTab } from '@/components/patients/patient-info-tab';

import { usePatientView } from '@/stores/patient-view-store';
import { usePermissions } from '@/hooks/usePermissions';
import { PATIENTS_PERMISSIONS } from '@/constants/permissions';

/**
 * Global host that renders the patient detail sheet driven by usePatientView,
 * so any part of the app can open a patient with a single store call.
 * With `infoOnly` (calendar context menu → "Datos del paciente") it renders a
 * quick centered dialog with just the patient info form instead of the sheet.
 */
export function PatientQuickViewHost() {
  const { isOpen, userId, userName, userEmail, userPhone, initialTab, infoOnly, showCancelAction, close } = usePatientView();
  const t = useTranslations('AppointmentsPage');
  const { hasPermission } = usePermissions();
  const [isPatientFormDirty, setIsPatientFormDirty] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) setIsPatientFormDirty(false);
  }, [isOpen, userId]);

  if (!userId) return null;

  // The info-only dialog is nothing but the patient's personal data, so it is
  // governed by the same permission as the sheet's "Información" tab.
  if (infoOnly && !hasPermission(PATIENTS_PERMISSIONS.VIEW_DETAIL_INFO)) return null;

  if (infoOnly) {
    return (
      <Dialog open={isOpen} onOpenChange={(o) => { if (!o) close(); }}>
        <DialogContent
          maxWidth="xl"
          className="p-0"
          confirmOnClose={showCancelAction}
          isDirty={isPatientFormDirty}
        >
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle className="truncate">{userName}</DialogTitle>
            <DialogDescription>{t('contextMenu.patientData')}</DialogDescription>
          </DialogHeader>
          <DialogBody className="flex min-h-0 flex-col overflow-hidden p-0">
            <PatientInfoTab
              userId={userId}
              showCancelAction={showCancelAction}
              onDirtyChange={setIsPatientFormDirty}
            />
          </DialogBody>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <PatientDetailSheet
      open={isOpen}
      onOpenChange={(o) => { if (!o) close(); }}
      userId={userId}
      userName={userName}
      userEmail={userEmail}
      userPhone={userPhone}
      initialTab={initialTab ?? 'info'}
    />
  );
}
