'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { useToast } from '@/hooks/use-toast';
import { canTransition } from '@/constants/appointment-status';
import type { Appointment, AppointmentStatus, CancellationReason } from '@/lib/types';
import { updateAppointmentStatusRequest } from '@/services/appointments';

interface UseAppointmentStatusOptions {
  onSuccess?: (appointment: Appointment, newStatus: AppointmentStatus) => void;
}

interface UpdateStatusArgs {
  appointment: Appointment;
  newStatus: AppointmentStatus;
  cancellation_reason?: CancellationReason;
  cancellation_note?: string;
  note?: string;
}

export function useAppointmentStatus(options: UseAppointmentStatusOptions = {}) {
  const { toast } = useToast();
  const tStatus = useTranslations('AppointmentStatus');
  const tMenu = useTranslations('AppointmentStatusMenu');
  const [isUpdating, setIsUpdating] = React.useState(false);

  const updateStatus = React.useCallback(
    async ({ appointment, newStatus, cancellation_reason, cancellation_note, note }: UpdateStatusArgs) => {
      if (!canTransition(appointment.status, newStatus)) return false;

      // Defensive guards: when cancelling, reason is required;
      // when reason='other', a non-empty note is required.
      if (newStatus === 'cancelled' && !cancellation_reason) return false;
      if (cancellation_reason === 'other' && !cancellation_note?.trim()) return false;

      setIsUpdating(true);
      try {
        await updateAppointmentStatusRequest({
          appointment,
          newStatus,
          cancellation_reason,
          cancellation_note,
          note,
        });

        toast({
          title: tMenu('updated'),
          description: tMenu('updatedDesc', { status: tStatus(newStatus) }),
        });
        options.onSuccess?.(appointment, newStatus);
        return true;
      } catch (error) {
        toast({
          variant: 'destructive',
          title: tMenu('error'),
          description: error instanceof Error ? error.message : tMenu('errorDesc'),
        });
        return false;
      } finally {
        setIsUpdating(false);
      }
    },
    [options, toast, tMenu, tStatus],
  );

  return { updateStatus, isUpdating };
}
