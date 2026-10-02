'use client';

import * as React from 'react';

import { isAbortError } from '@/services/api';
import { checkSlotAvailability, type CheckSlotAvailabilityParams } from '@/services/appointments';

export type SlotAvailabilityStatus = 'idle' | 'checking' | 'available' | 'unavailable';

/** Espera tras el último cambio antes de consultar: el usuario suele ajustar hora y duración seguido. */
const DEBOUNCE_MS = 400;
const TIMEOUT_MS = 20_000;

/**
 * Verifica contra el backend que un horario esté libre (consultorio y doctor)
 * mientras el usuario lo edita. Sólo informa: no bloquea el guardado, igual que
 * el formulario completo de cita al crear.
 *
 * Pasar `null` (datos incompletos o verificación deshabilitada) deja el estado en
 * `idle`. Cada cambio cancela la consulta anterior, así una respuesta vieja nunca
 * pisa a la del horario actual. Un error de red también vuelve a `idle`: no se
 * puede afirmar que el horario esté ocupado.
 */
export function useSlotAvailability(params: CheckSlotAvailabilityParams | null): SlotAvailabilityStatus {
  const [status, setStatus] = React.useState<SlotAvailabilityStatus>('idle');

  // Los Date cambian de identidad en cada render: el efecto depende de valores primitivos.
  const enabled = params !== null;
  const startMs = params?.start.getTime() ?? 0;
  const endMs = params?.end.getTime() ?? 0;
  const doctorId = params?.doctorId;
  const calendarId = params?.calendarId;
  const patientId = params?.patientId;
  const appointmentId = params?.appointmentId;

  React.useEffect(() => {
    if (!enabled) {
      setStatus('idle');
      return;
    }
    const current: CheckSlotAvailabilityParams = {
      start: new Date(startMs),
      end: new Date(endMs),
      doctorId,
      calendarId,
      patientId,
      appointmentId,
    };
    const controller = new AbortController();
    setStatus('checking');

    const timer = setTimeout(() => {
      checkSlotAvailability(current, { signal: controller.signal, timeoutMs: TIMEOUT_MS })
        .then((result) => {
          if (!controller.signal.aborted) setStatus(result.isAvailable ? 'available' : 'unavailable');
        })
        .catch((error) => {
          if (isAbortError(error) || controller.signal.aborted) return;
          console.error('Failed to check slot availability:', error);
          setStatus('idle');
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [enabled, startMs, endMs, doctorId, calendarId, patientId, appointmentId]);

  return status;
}
