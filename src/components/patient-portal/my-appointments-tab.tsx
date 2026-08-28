'use client';

import { CalendarPlus, CalendarX2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

import { AppointmentCard } from '@/components/patient-portal/appointment-card';
import { PatientCancelAppointmentDialog } from '@/components/patient-portal/patient-cancel-appointment-dialog';

import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import type { Appointment, Calendar as CalendarType } from '@/lib/types';
import { api } from '@/services/api';
import { fetchUpcomingPatientAppointments } from '@/services/appointments';

interface MyAppointmentsTabProps {
  patientId: string;
  patientName: string;
  /** Abre el diálogo de reserva de una cita nueva. */
  onBook: () => void;
  /** Abre `AppointmentFormDialog` en modo reagendar para la cita indicada. */
  onReschedule: (appointment: Appointment) => void;
  /** Se incrementa desde el padre tras reservar o reagendar, para refrescar la lista. */
  refreshTrigger?: number;
}

/**
 * "Mis Citas" del portal: sólo las citas futuras. Las pasadas viven en el
 * Historial. Reutiliza `/users_appointments?user_id=` a través de
 * `fetchUpcomingPatientAppointments`.
 */
export function MyAppointmentsTab({
  patientId,
  patientName,
  onBook,
  onReschedule,
  refreshTrigger = 0,
}: MyAppointmentsTabProps) {
  const t = useTranslations('PatientPortal.appointments');
  const { toast } = useToast();

  const [appointments, setAppointments] = React.useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [cancelling, setCancelling] = React.useState<Appointment | null>(null);
  const calendarsRef = React.useRef<CalendarType[]>([]);

  const load = React.useCallback(async () => {
    if (!patientId) return;
    setIsLoading(true);
    try {
      if (calendarsRef.current.length === 0) {
        try {
          const data = await api.get(API_ROUTES.CALENDARS);
          const list = Array.isArray(data) ? data : (data?.calendars || data?.data || data?.result || []);
          calendarsRef.current = list.map((c: any) => ({ id: String(c.id), name: c.name }) as CalendarType);
        } catch {
          calendarsRef.current = [];
        }
      }
      setAppointments(await fetchUpcomingPatientAppointments(patientId, patientName, calendarsRef.current));
    } catch (error) {
      console.error('Failed to load patient appointments:', error);
      setAppointments([]);
      toast({ variant: 'destructive', title: t('loadError') });
    } finally {
      setIsLoading(false);
    }
  }, [patientId, patientName, t, toast]);

  React.useEffect(() => {
    load();
  }, [load, refreshTrigger]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-muted-foreground">
        {t('upcomingCount', { count: appointments.length })}
      </h2>

      {appointments.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <CalendarX2 className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('empty')}</p>
            <Button size="sm" onClick={onBook} className="gap-1.5">
              <CalendarPlus className="h-4 w-4" />
              {t('book')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {appointments.map((appointment, index) => (
            <AppointmentCard
              key={appointment.id}
              appointment={appointment}
              isNext={index === 0}
              onReschedule={onReschedule}
              onCancel={setCancelling}
            />
          ))}
        </div>
      )}

      <PatientCancelAppointmentDialog
        appointment={cancelling}
        onOpenChange={(open) => !open && setCancelling(null)}
        onCancelled={() => {
          setCancelling(null);
          load();
        }}
      />
    </div>
  );
}
