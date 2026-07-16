'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

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
}

/**
 * Quick "new patient" window: the same full patient form used by the patient
 * quick view, in create mode. Used by flows that need a richer form than an
 * inline mini-create (e.g. the calendar's inline appointment draft).
 */
export function PatientCreateDialog({ open, onOpenChange, initialName, onCreated, showCancelAction = false }: PatientCreateDialogProps) {
  const t = useTranslations('UsersPage.createDialog');
  const [isPatientFormDirty, setIsPatientFormDirty] = React.useState(false);

  React.useEffect(() => {
    if (open) setIsPatientFormDirty(false);
  }, [initialName, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        maxWidth="xl"
        className="p-0"
        confirmOnClose={showCancelAction}
        isDirty={isPatientFormDirty}
      >
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex min-h-0 flex-col overflow-hidden p-0">
          {/* Remount per open so every "new patient" starts from a clean form */}
          {open && (
            <PatientInfoTab
              initialName={initialName}
              showCancelAction={showCancelAction}
              onDirtyChange={setIsPatientFormDirty}
              onSaved={(created) => {
                onCreated(created);
                onOpenChange(false);
              }}
            />
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
