'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { canTransition } from '@/constants/appointment-status';
import type { Appointment, AppointmentStatus, CancellationReason } from '@/lib/types';
import { updateAppointmentStatusWithDocumentCheck } from '@/services/appointments';

const LOCALLY_UPDATED_PREFIX = 'doctor-workspace:locally-updated';
const LOCALLY_CREATED_PREFIX = 'doctor-workspace:locally-created';
const LOCALLY_UPDATED_TTL_MS = 120_000;

export function markLocallyCreated(userId: string, appointmentId: string) {
  if (typeof window === 'undefined') return;
  try {
    const key = `${LOCALLY_CREATED_PREFIX}:${userId}`;
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
  // Bloqueo síncrono: el estado no se aplica hasta el siguiente render, así que un
  // doble clic (o Enter + clic) sobre otro estado dispararía dos POST.
  const inFlightRef = React.useRef(false);
  // Última versión de `updateStatus`, para que el reintento tras cargar el
  // documento use los `onSuccess`/traducciones vigentes y no los del clic original.
  const updateStatusRef = React.useRef<(args: UpdateStatusArgs) => Promise<boolean>>(async () => false);

  const updateStatus = React.useCallback(
    async (args: UpdateStatusArgs): Promise<boolean> => {
      const { appointment, newStatus, cancellation_reason, cancellation_note, note } = args;
      if (inFlightRef.current) return false;
      if (!canTransition(appointment.status, newStatus)) return false;

      // Defensive guards: when cancelling, reason is required;
      // when reason='other', a non-empty note is required.
      if (newStatus === 'cancelled' && !cancellation_reason) return false;
      if (cancellation_reason === 'other' && !cancellation_note?.trim()) return false;

      inFlightRef.current = true;
      setIsUpdating(true);
      try {
        const applied = await updateAppointmentStatusWithDocumentCheck(
          {
            appointment,
            newStatus,
            cancellation_reason,
            cancellation_note,
            note,
          },
          // Si desde el aviso se carga el documento, se repite el mismo cambio.
          { onRetry: () => { void updateStatusRef.current(args); } },
        );
        // Bloqueado por documento faltante: el aviso ya se mostró y nada cambió.
        if (!applied) return false;

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
        inFlightRef.current = false;
        setIsUpdating(false);
      }
    },
    [options, toast, tMenu, tStatus],
  );
  React.useEffect(() => {
    updateStatusRef.current = updateStatus;
  }, [updateStatus]);

  return { updateStatus, isUpdating };
}

/**
 * Pasa la cita a "completada" al guardar su sesión clínica, con el bloqueo por
 * documento faltante. Devuelve si se aplicó ahora; si se bloqueó y desde el
 * aviso cargan el documento, se reintenta solo y, al aplicarse, se llama a
 * `onCompleted` (la sesión ya está guardada, solo falta reflejar el estado).
 * Los errores del primer intento se propagan; los del reintento se avisan acá.
 */
export function useCompleteAppointmentWithDocumentCheck() {
  const { toast } = useToast();
  const tStatus = useTranslations('AppointmentStatus');
  const tMenu = useTranslations('AppointmentStatusMenu');

  return React.useCallback(
    (appointment: Appointment, onCompleted: () => void): Promise<boolean> => {
      const attempt = (): Promise<boolean> =>
        updateAppointmentStatusWithDocumentCheck(
          { appointment, newStatus: 'completed' },
          {
            onRetry: async () => {
              try {
                // Si vuelve a bloquearse, el aviso se muestra de nuevo con este mismo reintento.
                if (!(await attempt())) return;
                onCompleted();
                toast({
                  title: tMenu('updated'),
                  description: tMenu('updatedDesc', { status: tStatus('completed') }),
                });
              } catch (error) {
                toast({
                  variant: 'destructive',
                  title: tMenu('error'),
                  description: error instanceof Error ? error.message : tMenu('errorDesc'),
                });
              }
            },
          },
        );
      return attempt();
    },
    [toast, tMenu, tStatus],
  );
}
