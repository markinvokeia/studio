'use client';

import { Loader2 } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { usePatientPortal } from '@/hooks/usePatientPortal';
import { useToast } from '@/hooks/use-toast';
import type { Appointment } from '@/lib/types';
import { updateAppointmentStatusRequest } from '@/services/appointments';
import { notifyAppointmentChange } from '@/services/patient-booking';

interface PatientCancelAppointmentDialogProps {
  /** `null` mantiene el diálogo cerrado. */
  appointment: Appointment | null;
  onOpenChange: (open: boolean) => void;
  onCancelled: () => void;
}

/**
 * Cancelación de una cita desde el portal del paciente.
 *
 * El motivo se fija en `'in_time'` (cancelación con aviso) porque el paciente no
 * debería clasificar su propia cancelación con las categorías internas de la
 * clínica (`by_doctor`, `no_notice`, …); el comentario libre viaja como
 * `cancellation_note`. Reutiliza `updateAppointmentStatusRequest`, el mismo
 * camino que usa el staff desde la agenda.
 */
export function PatientCancelAppointmentDialog({
  appointment,
  onOpenChange,
  onCancelled,
}: PatientCancelAppointmentDialogProps) {
  const t = useTranslations('PatientPortal.appointments.cancelDialog');
  const { toast } = useToast();
  // `appointment.patientEmail` puede venir vacío del backend; en el portal el
  // paciente está logueado, así que su email del token es la fuente confiable.
  const { patientEmail } = usePatientPortal();
  const [note, setNote] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (appointment) setNote('');
  }, [appointment]);

  const handleConfirm = async () => {
    if (!appointment) return;
    setIsSubmitting(true);
    try {
      await updateAppointmentStatusRequest({
        appointment,
        newStatus: 'cancelled',
        cancellation_reason: 'in_time',
        cancellation_note: note.trim() || undefined,
      });

      // La clínica tiene que enterarse de que ese horario se liberó.
      await notifyAppointmentChange({
        event: 'cancelled',
        appointmentId: appointment.id,
        patient: {
          id: appointment.patientId,
          name: appointment.patientName,
          email: appointment.patientEmail || patientEmail,
        },
        date: appointment.date,
        time: appointment.time,
        doctorName: appointment.doctorName,
        sedeName: appointment.calendar_name,
        reason: note.trim(),
      });

      toast({ title: t('successTitle'), description: t('successDescription') });
      onCancelled();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('errorTitle'),
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AlertDialog open={!!appointment} onOpenChange={onOpenChange}>
      <AlertDialogContent className="gap-4 p-6">
        <AlertDialogHeader className="space-y-2">
          <AlertDialogTitle>{t('title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {appointment ? t('description', { date: appointment.date, time: appointment.time }) : ''}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-1">
          <Label htmlFor="cancel-note">{t('noteLabel')}</Label>
          <Textarea
            id="cancel-note"
            rows={3}
            className="resize-none"
            placeholder={t('notePlaceholder')}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel disabled={isSubmitting}>{t('back')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            disabled={isSubmitting}
          >
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t('confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
