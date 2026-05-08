'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { useToast } from '@/hooks/use-toast';
import { api } from '@/services/api';
import { API_ROUTES } from '@/constants/routes';
import { canTransition } from '@/constants/appointment-status';
import type { Appointment, AppointmentStatus, CancellationReason } from '@/lib/types';

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
        const payload = {
          appointment_id: appointment.id,
          google_event_id: appointment.googleEventId,
          calendar_source_id: appointment.calendar_source_id,
          status: newStatus,
          cancellation_reason: newStatus === 'cancelled' ? cancellation_reason : null,
          cancellation_note: cancellation_reason === 'other' ? cancellation_note?.trim() : null,
          note,
        };
        const response = await api.post(API_ROUTES.APPOINTMENTS_UPDATE_STATUS, payload);
        const result = Array.isArray(response) ? response[0] : response;

        if (result?.error || (result?.code && result.code >= 400)) {
          throw new Error(result?.message || tMenu('errorDesc'));
        }

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
