'use client';

import * as React from 'react';

import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface PatientFormDialogShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /** Ask for confirmation before closing with unsaved changes. */
  confirmOnClose?: boolean;
  /** Whether the hosted form actually has unsaved changes. */
  isDirty?: boolean;
  children: React.ReactNode;
}

/**
 * Ventana modal que hospeda un `PatientInfoTab`: cabecera, cuerpo sin padding
 * (el formulario pone el suyo con `variant="dialog"`) y guarda de cierre.
 *
 * Vive en su propio archivo, sin importar el formulario, justamente para que el
 * formulario pueda usarla: el picker de tutor abre otro formulario de paciente
 * desde adentro, y si la cáscara estuviera en `patient-create-dialog.tsx` ese
 * import sería circular.
 */
export function PatientFormDialogShell({
  open,
  onOpenChange,
  title,
  description,
  confirmOnClose = false,
  isDirty,
  children,
}: PatientFormDialogShellProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        maxWidth="xl"
        className="p-0"
        confirmOnClose={confirmOnClose}
        isDirty={isDirty}
      >
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex min-h-0 flex-col overflow-hidden p-0">
          {children}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
