import { API_ROUTES } from '@/constants/routes';
import type { Appointment, AppointmentStatus, CancellationReason } from '@/lib/types';
import { api } from '@/services/api';

interface UpdateAppointmentStatusParams {
  appointment: Pick<Appointment, 'id' | 'googleEventId' | 'calendar_source_id'>;
  newStatus: AppointmentStatus;
  cancellation_reason?: CancellationReason;
  cancellation_note?: string;
  note?: string;
}

export async function updateAppointmentStatusRequest({
  appointment,
  newStatus,
  cancellation_reason,
  cancellation_note,
  note,
}: UpdateAppointmentStatusParams) {
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
    throw new Error(result?.message || 'Failed to update appointment status');
  }

  return result;
}
