'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { useToast } from '@/hooks/use-toast';
import { api } from '@/services/api';
import { API_ROUTES } from '@/constants/routes';
import { canReschedule } from '@/constants/appointment-status';
import type { Appointment } from '@/lib/types';

interface UseAppointmentRescheduleOptions {
  /** Called after a successful reschedule with the original id and the new id. */
  onSuccess?: (originalId: string, newId: string) => void;
}

export interface ReschedulePayload {
  patient_id?: string;
  patient_name?: string;
  patient_email?: string;
  patient_phone?: string;
  doctor_id?: string;
  doctor_name?: string;
  doctor_email?: string;
  calendar_source_id?: string;
  summary: string;
  notes?: string;
  service_ids: string[];
  service_names?: string;
  start: string;
  end: string;
  changed_by?: string;
}

export function useAppointmentReschedule(options: UseAppointmentRescheduleOptions = {}) {
  const { toast } = useToast();
  const t = useTranslations('AppointmentReschedule');
  const [isRescheduling, setIsRescheduling] = React.useState(false);

  const reschedule = React.useCallback(
    async (original: Appointment, payload: ReschedulePayload) => {
      if (!canReschedule(original.status)) {
        toast({
          variant: 'destructive',
          title: t('error'),
          description: t('blockedTooltip', { status: original.status }),
        });
        return null;
      }

      setIsRescheduling(true);
      try {
        const body = {
          original_appointment_id: original.id,
          ...payload,
        };
        const response = await api.post(API_ROUTES.APPOINTMENTS_RESCHEDULE, body);
        const result = Array.isArray(response) ? response[0] : response;

        if (result?.error || (result?.code && result.code >= 400)) {
          throw new Error(result?.message || t('errorDesc'));
        }

        toast({ title: t('success'), description: t('successDesc') });
        const newId = result?.new_appointment_id ?? null;
        if (newId) options.onSuccess?.(original.id, String(newId));
        return newId ? String(newId) : null;
      } catch (error) {
        toast({
          variant: 'destructive',
          title: t('error'),
          description: error instanceof Error ? error.message : t('errorDesc'),
        });
        return null;
      } finally {
        setIsRescheduling(false);
      }
    },
    [options, toast, t],
  );

  return { reschedule, isRescheduling };
}
