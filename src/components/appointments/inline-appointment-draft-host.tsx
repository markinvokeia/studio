'use client';

import * as React from 'react';
import { addMinutes, format, parseISO } from 'date-fns';
import { useTranslations } from 'next-intl';

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

import { CalendarInlineDraftOverlay } from '@/components/calendar/inline-draft-overlay';
import { InlineAppointmentDraft } from '@/components/calendar/inline-appointment-draft';
import { GOOGLE_CALENDAR_COLORS } from '@/components/calendar/calendar-constants';

import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { toLocalISOString } from '@/lib/utils';
import api from '@/services/api';
import { fetchAppointmentCalendars, fetchAppointmentDoctors } from '@/services/appointments';

import type { Appointment, Calendar as CalendarType, Service, User as UserType } from '@/lib/types';

/** Duración por defecto de una cita nueva, en minutos. */
const DEFAULT_DURATION_MINUTES = 30;

interface DraftState {
  date: Date;
  durationMin: number;
  patient: UserType | null;
  services: Service[];
  doctor: UserType | null;
  calendar: CalendarType | null;
  notes: string;
  color?: string;
  /** Seteado cuando se está editando una cita existente (vs. creando una). */
  editing: Appointment | null;
}

interface InlineAppointmentDraftHostProps {
  /** Cita a editar, o `null` para crear una nueva. */
  appointment?: Appointment | null;
  /** Paciente de la cita. Queda fijo: esta vía siempre opera sobre un paciente. */
  patient: UserType;
  /** Agendas y doctores. Si no se pasan, el host los carga solo al abrirse: así una
   *  pantalla que no los tenga a mano (la hoja de detalle del paciente) puede montar
   *  la tarjeta sin replicar esas consultas. */
  calendars?: CalendarType[];
  doctors?: UserType[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Se llama después de guardar con éxito, para que el consumidor refresque. */
  onSaved?: () => void;
}

const colorHexById = new Map(GOOGLE_CALENDAR_COLORS.map((c) => [c.id, c.hex]));

/**
 * Monta la tarjeta inline de cita —la misma del calendario— fuera del calendario,
 * para crear o editar una cita desde el perfil del paciente.
 *
 * Trae su propio guardado en vez de reusar el del calendario: ese está atado al estado
 * de la grilla (bloqueo por horarios de la clínica, huecos, refresco de la vista) y acá
 * no hay nada de eso cargado. Lo que sí se comparte es la tarjeta, que es lo que el
 * usuario ve y lo que importa mantener idéntico.
 */
export function InlineAppointmentDraftHost({
  appointment,
  patient,
  calendars: calendarsProp,
  doctors: doctorsProp,
  open,
  onOpenChange,
  onSaved,
}: InlineAppointmentDraftHostProps) {
  const tToasts = useTranslations('AppointmentsPage.toasts');
  const tInline = useTranslations('AppointmentsPage.inlineCreate');
  const tColumns = useTranslations('AppointmentsColumns');
  // Mismo diálogo de descarte que usa el calendario para esta misma tarjeta.
  const tConfirmClose = useTranslations('ConfirmCloseDialog');
  const { toast } = useToast();

  const [draft, setDraft] = React.useState<DraftState | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isDiscardOpen, setIsDiscardOpen] = React.useState(false);

  // Cargados solo cuando el consumidor no los provee.
  const [loadedCalendars, setLoadedCalendars] = React.useState<CalendarType[]>([]);
  const [loadedDoctors, setLoadedDoctors] = React.useState<UserType[]>([]);
  const [dataReady, setDataReady] = React.useState(false);
  const needsData = !calendarsProp || !doctorsProp;
  React.useEffect(() => {
    if (!open || !needsData) return;
    let active = true;
    Promise.all([fetchAppointmentCalendars(), fetchAppointmentDoctors()]).then(([cals, docs]) => {
      if (!active) return;
      setLoadedCalendars(cals);
      setLoadedDoctors(docs);
      setDataReady(true);
    });
    return () => { active = false; };
  }, [open, needsData]);

  const calendars = calendarsProp ?? loadedCalendars;
  const doctors = doctorsProp ?? loadedDoctors;

  // Se arma UNA vez por apertura. El ref es lo que evita que un cambio de identidad en
  // `calendars`/`doctors`/`patient` —o la llegada de los datos que carga el host— vuelva
  // a ejecutar esto y borre lo que el usuario venía editando.
  const initializedRef = React.useRef(false);
  React.useEffect(() => {
    if (!open) {
      initializedRef.current = false;
      setDataReady(false);
      setDraft(null);
      return;
    }
    if (initializedRef.current) return;
    // Sin agendas ni doctores todavía, esperar: si no, una cita existente arrancaría
    // sin agenda ni doctor resueltos.
    if (needsData && !dataReady) return;
    initializedRef.current = true;

    if (appointment) {
      const startStr = appointment.start?.dateTime;
      const start = startStr ? parseISO(startStr.replace(/Z$/, '')) : new Date();
      const endStr = appointment.end?.dateTime;
      const end = endStr ? parseISO(endStr.replace(/Z$/, '')) : addMinutes(start, DEFAULT_DURATION_MINUTES);
      const durationMin = Math.max(5, Math.round((end.getTime() - start.getTime()) / 60000)) || DEFAULT_DURATION_MINUTES;

      setDraft({
        date: start,
        durationMin,
        patient,
        services: appointment.services ?? [],
        doctor: doctors.find((d) => String(d.id) === String(appointment.doctorId)) ?? null,
        calendar: calendars.find((c) => String(c.id) === String(appointment.calendar_source_id)) ?? null,
        notes: appointment.notes ?? '',
        color: appointment.colorId ?? undefined,
        editing: appointment,
      });
      return;
    }

    const next = new Date();
    next.setMinutes(0, 0, 0);
    setDraft({
      date: addMinutes(next, 60),
      durationMin: DEFAULT_DURATION_MINUTES,
      patient,
      services: [],
      doctor: null,
      calendar: null,
      notes: '',
      editing: null,
    });
  }, [open, appointment, patient, calendars, doctors, needsData, dataReady]);

  const handleSave = React.useCallback(async () => {
    if (!draft) return;

    const { date: start, durationMin, patient: draftPatient, doctor, calendar, services, editing } = draft;
    if (!calendar) {
      toast({ variant: 'destructive', title: tToasts('missingInfoTitle'), description: tToasts('fillRequired') });
      return;
    }
    if (!draftPatient?.id) {
      toast({ variant: 'destructive', title: tToasts('missingInfoTitle'), description: tToasts('patientRequired') });
      return;
    }

    setIsSaving(true);
    try {
      const end = addMinutes(start, durationMin || DEFAULT_DURATION_MINUTES);
      const svcNames = services.map((s) => s.name).join(', ');
      // El summary de una cita importada de Google es el título del evento y no se
      // regenera; esta vía no lo edita, así que se reenvía tal cual.
      const summary = editing?.imported_from_google
        ? editing.summary
        : (svcNames ? `${draftPatient.name} - ${svcNames}` : draftPatient.name);

      const payload: Record<string, unknown> = {
        mode: editing ? 'update' : 'create',
        start: toLocalISOString(start),
        end: toLocalISOString(end),
        doctor_id: doctor?.id || '',
        doctor_name: doctor?.name || '',
        doctor_email: doctor?.email || '',
        patient_id: draftPatient.id,
        patient_name: draftPatient.name,
        patient_email: draftPatient.email || '',
        patient_phone: draftPatient.phone_number || '',
        summary,
        service_ids: services.map((s) => s.id),
        service_names: svcNames,
        notes: draft.notes || '',
        calendar_source_id: String(calendar.id),
        color: draft.color,
        quote_id: editing?.quote_id ?? null,
      };
      if (editing) {
        payload.appointment_id = editing.id;
        payload.google_event_id = editing.googleEventId;
        if (editing.calendar_source_id) payload.old_calendar_source_id = editing.calendar_source_id;
      }

      const response = await api.post(API_ROUTES.APPOINTMENTS_UPSERT, payload);
      const result = Array.isArray(response) ? response[0] : response;
      if (result?.error || (result?.code && result.code >= 400)) {
        throw new Error(result?.message || 'Failed to save appointment');
      }

      toast({ title: editing ? tToasts('appointmentUpdated') : tToasts('appointmentCreated') });
      onOpenChange(false);
      onSaved?.();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: tToasts('error'),
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsSaving(false);
    }
  }, [draft, toast, tToasts, onOpenChange, onSaved]);

  // Cerrar con cambios pide confirmación, igual que en el calendario.
  const requestClose = React.useCallback(() => {
    if (!draft) {
      onOpenChange(false);
      return;
    }
    const touched = draft.services.length > 0 || draft.notes.trim() !== '' || !!draft.doctor || !!draft.calendar;
    if (touched && !draft.editing) {
      setIsDiscardOpen(true);
      return;
    }
    onOpenChange(false);
  }, [draft, onOpenChange]);

  if (!open || !draft) return null;

  const selectedColorHex = draft.color ? colorHexById.get(draft.color) : undefined;
  // Misma precedencia que en el calendario: color propio > servicio > doctor > agenda.
  const accentColor = selectedColorHex
    || draft.services[draft.services.length - 1]?.color
    || (draft.doctor as { color?: string } | null)?.color
    || (draft.calendar?.color ? colorHexById.get(draft.calendar.color) : undefined)
    || undefined;

  const isEditing = !!draft.editing;

  return (
    <>
      <CalendarInlineDraftOverlay>
        <InlineAppointmentDraft
          variant="custom"
          date={draft.date}
          endTime={format(addMinutes(draft.date, draft.durationMin || DEFAULT_DURATION_MINUTES), 'HH:mm')}
          durationMin={draft.durationMin}
          onDurationChange={(min) => setDraft((d) => (d ? { ...d, durationMin: min } : d))}
          onDateChange={(date) => setDraft((d) => (d ? { ...d, date } : d))}
          onStartTimeChange={(hours, minutes) => setDraft((d) => {
            if (!d) return d;
            const next = new Date(d.date);
            next.setHours(hours, minutes, 0, 0);
            return { ...d, date: next };
          })}
          color={draft.color}
          colorOptions={GOOGLE_CALENDAR_COLORS.map((color) => ({ id: color.id, hex: color.hex, label: color.id }))}
          onColorChange={(color) => setDraft((d) => (d ? { ...d, color } : d))}
          calendar={draft.calendar}
          onCalendarChange={(c) => setDraft((d) => (d ? { ...d, calendar: c } : d))}
          calendarOptions={calendars}
          doctor={draft.doctor}
          onDoctorChange={(doc) => setDraft((d) => (d ? { ...d, doctor: doc } : d))}
          doctorOptions={doctors}
          patient={draft.patient}
          // El paciente viene fijo del perfil: no se puede cambiar por esta vía.
          onPatientChange={() => { /* fijo */ }}
          services={draft.services}
          onServicesChange={(s) => setDraft((d) => {
            if (!d) return d;
            const total = s.reduce((acc, svc) => acc + ((svc as { duration_minutes?: number }).duration_minutes || 0), 0);
            return { ...d, services: s, durationMin: total > 0 ? total : d.durationMin };
          })}
          notes={draft.notes}
          onNotesChange={(n) => setDraft((d) => (d ? { ...d, notes: n } : d))}
          isSaving={isSaving}
          onSave={handleSave}
          onCancel={requestClose}
          accentColor={accentColor}
          title={isEditing ? tColumns('edit') : undefined}
          saveLabel={isEditing ? tInline('update') : undefined}
        />
      </CalendarInlineDraftOverlay>

      <AlertDialog open={isDiscardOpen} onOpenChange={setIsDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tConfirmClose('title')}</AlertDialogTitle>
            <AlertDialogDescription>{tConfirmClose('description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tConfirmClose('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { setIsDiscardOpen(false); onOpenChange(false); }}
            >
              {tConfirmClose('confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
