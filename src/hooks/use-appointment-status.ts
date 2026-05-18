'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { canTransition } from '@/constants/appointment-status';
import type { Appointment, AppointmentStatus, CancellationReason } from '@/lib/types';
import { updateAppointmentStatusRequest } from '@/services/appointments';

const LOCALLY_UPDATED_PREFIX = 'doctor-workspace:locally-updated';
const LOCALLY_UPDATED_TTL_MS = 120_000;

function markLocallyUpdated(userId: string, appointmentId: string) {
  if (typeof window === 'undefined') return;
  try {
    const key = `${LOCALLY_UPDATED_PREFIX}:${userId}`;
    const raw = window.localStorage.getItem(key);
    let ids: string[] = [];
    let expiresAt = Date.now() + LOCALLY_UPDATED_TTL_MS;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.ids) && typeof parsed.expiresAt === 'number' && Date.now() <= parsed.expiresAt) {
        ids = parsed.ids;
        expiresAt = parsed.expiresAt;
      }
    }
    if (!ids.includes(appointmentId)) ids.push(appointmentId);
    window.localStorage.setItem(key, JSON.stringify({ ids, expiresAt }));
  } catch {}
}

interface UseAppointmentStatusOptions {
  onSuccess?: (
    appointment: Appointment,
    newStatus: AppointmentStatus,
    extra?: {
      cancellation_reason?: CancellationReason | null;
      cancellation_note?: string | null;
    },
  ) => void;
}

interface UpdateStatusArgs {
  appointment: Appointment;
  newStatus: AppointmentStatus;
  cancellation_reason?: CancellationReason;
  cancellation_note?: string;
  note?: string;
}

export function useAppointmentStatus(options: UseAppointmentStatusOptions = {}) {
  const { user } = useAuth();
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

        if (user?.id) markLocallyUpdated(String(user.id), appointment.id);
        toast({
          title: tMenu('updated'),
          description: tMenu('updatedDesc', { status: tStatus(newStatus) }),
        });
        options.onSuccess?.(appointment, newStatus, {
          cancellation_reason: newStatus === 'cancelled' ? cancellation_reason ?? null : null,
          cancellation_note: newStatus === 'cancelled' ? cancellation_note?.trim() || null : null,
        });
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
