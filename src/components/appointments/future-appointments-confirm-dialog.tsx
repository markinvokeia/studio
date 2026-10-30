'use client';

import { AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useTranslations } from 'next-intl';
import * as React from 'react';

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

import type { FuturePatientAppointment } from '@/services/appointments';

interface FutureAppointmentsConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientName: string;
  appointments: FuturePatientAppointment[];
  onConfirm: () => void;
  onCancel?: () => void;
}

export function FutureAppointmentsConfirmDialog({
  open,
  onOpenChange,
  patientName,
  appointments,
  onConfirm,
  onCancel,
}: FutureAppointmentsConfirmDialogProps) {
  const t = useTranslations('FutureAppointmentsConfirmDialog');

  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  const handleCancel = () => {
    onCancel?.();
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/20">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <AlertDialogTitle>{t('title')}</AlertDialogTitle>
          </div>
        </AlertDialogHeader>

        <AlertDialogDescription>
          {t('description', { patient: patientName })}
        </AlertDialogDescription>

        <div className="-mt-4 space-y-3 px-6 pb-6">
          <div className="max-h-40 overflow-y-auto rounded-md border bg-muted p-3">
            <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
              {appointments.map((appt) => (
                <li key={appt.id || appt.start.toISOString()}>
                  {t('appointmentLine', {
                    date: format(appt.start, 'dd/MM/yy'),
                    time: appt.time,
                    room: appt.room || '—',
                  })}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-sm font-medium">{t('question')}</p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>{t('cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>{t('confirm')}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
