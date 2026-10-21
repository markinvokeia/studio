'use client';

import * as React from 'react';
import { addMinutes, format, isValid, parseISO, set } from 'date-fns';
import {
  BookOpenText,
  Building2,
  Calendar as CalendarIcon,
  Check,
  ClipboardCheck,
  Clock,
  Edit,
  FileText,
  History,
  Images,
  Palette,
  Trash2,
  UserCog,
  UserRound,
  Users,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import { DatePicker } from '@/components/ui/date-picker';

import { AppointmentStatusContextItems, type StatusChangeExtra } from '@/components/appointments/AppointmentStatusMenu';

import { ALLOWED_STATUS_TRANSITIONS, canReschedule, normalizeAppointmentStatus } from '@/constants/appointment-status';
import type { Appointment, AppointmentStatus } from '@/lib/types';

import { AppointmentSummary } from './appointment-quick-view';
import { DURATION_PRESET_MINUTES, GOOGLE_CALENDAR_COLORS } from './calendar-constants';
import {
  ActionRow,
  ActionSeparator,
  MobileActionSheet,
  SheetStatusItem,
  SheetStatusSub,
  SheetStatusSubContent,
  SheetStatusSubTrigger,
} from './mobile-action-sheet';

type SheetPage = 'main' | 'status' | 'patient' | 'color' | 'doctor' | 'calendar' | 'date' | 'duration';

interface PickerOption {
  id: string | number;
  name: string;
  color?: string | null;
}

export interface AppointmentMobileSheetPatientActions {
  /** Omitido sin permiso para ver las finanzas del paciente. */
  onAccounts?: (appointment: Appointment) => void;
  onClinicHistory: (appointment: Appointment) => void;
  onDocuments: (appointment: Appointment) => void;
  onAppointments: (appointment: Appointment) => void;
  onData: (appointment: Appointment) => void;
}

interface AppointmentMobileSheetProps {
  /** Cita a mostrar; `null` cierra el sheet. Conviene pasar la versión viva de la
   *  lista, así un cambio de estado o de doctor se ve sin reabrir. */
  appointment: Appointment | null;
  onClose: () => void;
  locale?: string;
  doctors: PickerOption[];
  calendars: PickerOption[];
  canUpdateAppointments: boolean;
  /** Bloquea las transiciones de estado mientras hay un cambio en vuelo. */
  isUpdatingStatus?: boolean;
  /** Hay una reasignación / cambio de color / horario de esta cita en vuelo. */
  isRowActionPending?: boolean;
  patientActions: AppointmentMobileSheetPatientActions;
  onEdit: (appointment: Appointment) => void;
  onDelete: (appointment: Appointment) => void;
  /** Omitido sin permiso para ver el log de auditoría. */
  onViewHistory?: (appointment: Appointment) => void;
  onStatusChange: (appointment: Appointment, status: AppointmentStatus, extra?: StatusChangeExtra) => void;
  onRequestCustomCancellation: (appointment: Appointment) => void;
  onColorChange: (appointment: Appointment, colorId: string) => void;
  onReassignDoctor: (appointment: Appointment, doctorId: string) => void;
  onReassignCalendar: (appointment: Appointment, calendarId: string) => void;
  onRetime: (appointment: Appointment, start: Date, end: Date) => void;
}

/** `Date` local de un `dateTime` de la API, sin la `Z` (ver la skill `date-formatting`). */
function localDateOf(value: string | undefined): Date | null {
  if (!value) return null;
  const date = parseISO(value.replace(/Z$/, ''));
  return isValid(date) ? date : null;
}

/**
 * Sheet inferior con la ficha y todas las acciones de una cita, para móvil.
 *
 * En móvil la card no tiene menú contextual: su long-press competía con el de
 * arrastrar. Lo que ese menú ofrecía vive acá, detrás del toque simple. Cada
 * submenú del menú de escritorio es una página del sheet con flecha para volver,
 * porque un submenú flotante a un costado no entra en el ancho de un teléfono.
 */
export function AppointmentMobileSheet({
  appointment,
  onClose,
  locale = 'es',
  doctors,
  calendars,
  canUpdateAppointments,
  isUpdatingStatus = false,
  isRowActionPending = false,
  patientActions,
  onEdit,
  onDelete,
  onViewHistory,
  onStatusChange,
  onRequestCustomCancellation,
  onColorChange,
  onReassignDoctor,
  onReassignCalendar,
  onRetime,
}: AppointmentMobileSheetProps) {
  const t = useTranslations('AppointmentsPage');
  const tSheet = useTranslations('CalendarMobileSheet');
  const tPanel = useTranslations('AppointmentPanel');
  const tStatus = useTranslations('AppointmentStatus');
  const tStatusMenu = useTranslations('AppointmentStatusMenu');
  const tDrag = useTranslations('Calendar.drag');

  // Se conserva la última cita mostrada para que el contenido no desaparezca
  // mientras corre la animación de cierre.
  const [shown, setShown] = React.useState<Appointment | null>(appointment);
  const [page, setPage] = React.useState<SheetPage>('main');
  if (appointment && appointment !== shown) {
    if (appointment.id !== shown?.id) setPage('main');
    setShown(appointment);
  }

  if (!shown) return null;
  const current = shown;

  const hasPatient = !!current.patientId;
  const start = localDateOf(current.start?.dateTime);
  const end = localDateOf(current.end?.dateTime);
  const durationMin = start && end ? Math.max(0, (end.getTime() - start.getTime()) / 60000) : 0;
  const canRetime = canUpdateAppointments
    && canReschedule(normalizeAppointmentStatus(current.status))
    && !!start && !!end;
  const hasStatusTransitions = (ALLOWED_STATUS_TRANSITIONS[current.status] ?? []).length > 0;

  // Las acciones que abren otro panel cierran antes este sheet: dos diálogos
  // modales apilados se pelean el bloqueo de foco y de scroll del body.
  const closeThen = (fn: (appointment: Appointment) => void) => () => { onClose(); fn(current); };
  const backToMain = () => setPage('main');

  const pageTitles: Record<SheetPage, string | undefined> = {
    main: undefined,
    status: tStatusMenu('changeStatus'),
    patient: hasPatient ? current.patientName : undefined,
    color: tPanel('changeColor'),
    doctor: current.doctorId ? tPanel('changeDoctor') : tPanel('assignDoctor'),
    calendar: current.calendar_source_id ? tPanel('changeCalendar') : tPanel('assignCalendar'),
    date: tDrag('moveTo'),
    duration: tDrag('duration'),
  };

  const optionList = (
    options: PickerOption[],
    selectedId: string | number | null | undefined,
    emptyText: string,
    onPick: (id: string) => void,
  ) => (
    options.length === 0 ? (
      <p className="px-3 py-4 text-center text-sm text-muted-foreground">{emptyText}</p>
    ) : (
      options.map((option) => {
        const isSelected = String(option.id) === String(selectedId ?? '');
        return (
          <ActionRow
            key={option.id}
            disabled={isRowActionPending}
            label={option.name}
            onClick={() => {
              if (!isSelected) onPick(String(option.id));
              backToMain();
            }}
            leading={(
              <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                {option.color && <span className="h-3 w-3 rounded-full" style={{ backgroundColor: option.color }} />}
              </span>
            )}
            trailing={isSelected ? <Check className="h-4 w-4 shrink-0 text-primary" /> : undefined}
          />
        );
      })
    )
  );

  let content: React.ReactNode;
  switch (page) {
    case 'status':
      content = (
        <>
          <AppointmentStatusContextItems
            appointment={current}
            onChange={(status, extra) => { onStatusChange(current, status, extra); backToMain(); }}
            onRequestCustomCancellation={closeThen(onRequestCustomCancellation)}
            isUpdating={isUpdatingStatus}
            ItemComponent={SheetStatusItem}
            SubComponent={SheetStatusSub}
            SubTriggerComponent={SheetStatusSubTrigger}
            SubContentComponent={SheetStatusSubContent}
            SeparatorComponent={ActionSeparator}
          />
          {!hasStatusTransitions && (
            <p className="px-3 py-2 text-xs italic text-muted-foreground">{tStatusMenu('noTransitions')}</p>
          )}
        </>
      );
      break;
    case 'patient':
      content = (
        <>
          {patientActions.onAccounts && (
            <ActionRow icon={FileText} label={t('contextMenu.accounts')} onClick={closeThen(patientActions.onAccounts)} />
          )}
          <ActionRow icon={BookOpenText} label={t('contextMenu.clinicHistory')} onClick={closeThen(patientActions.onClinicHistory)} />
          <ActionRow icon={Images} label={t('contextMenu.imagesAndFiles')} onClick={closeThen(patientActions.onDocuments)} />
          <ActionSeparator />
          <ActionRow icon={History} label={t('contextMenu.appointmentsHistory')} onClick={closeThen(patientActions.onAppointments)} />
          <ActionSeparator />
          <ActionRow icon={Users} label={t('contextMenu.patientData')} onClick={closeThen(patientActions.onData)} />
        </>
      );
      break;
    case 'color':
      content = (
        <div className="grid grid-cols-6 gap-3 p-3">
          {GOOGLE_CALENDAR_COLORS.map((color) => (
            <button
              key={color.id}
              type="button"
              disabled={isRowActionPending}
              aria-label={color.hex}
              className="aspect-square w-full rounded-full disabled:opacity-50"
              style={{ backgroundColor: color.hex }}
              onClick={() => { onColorChange(current, color.id); backToMain(); }}
            />
          ))}
        </div>
      );
      break;
    case 'doctor':
      content = optionList(doctors, current.doctorId, tPanel('noDoctorFound'), (id) => onReassignDoctor(current, id));
      break;
    case 'calendar':
      content = optionList(calendars, current.calendar_source_id, tPanel('noCalendarFound'), (id) => onReassignCalendar(current, id));
      break;
    case 'date':
      content = start && (
        <div className="flex justify-center">
          <DatePicker
            mode="single"
            selected={start}
            onSelect={(date) => {
              if (!date) return;
              const nextStart = set(start, { year: date.getFullYear(), month: date.getMonth(), date: date.getDate() });
              if (nextStart.getTime() !== start.getTime()) onRetime(current, nextStart, addMinutes(nextStart, durationMin));
              backToMain();
            }}
          />
        </div>
      );
      break;
    case 'duration':
      content = start && DURATION_PRESET_MINUTES.map((minutes) => {
        const isSelected = Math.round(durationMin) === minutes;
        return (
          <ActionRow
            key={minutes}
            disabled={isRowActionPending}
            label={tDrag('minutes', { minutes })}
            trailing={isSelected ? <Check className="h-4 w-4 shrink-0 text-primary" /> : undefined}
            onClick={() => {
              if (!isSelected) onRetime(current, start, addMinutes(start, minutes));
              backToMain();
            }}
          />
        );
      });
      break;
    default:
      content = (
        <>
          <AppointmentSummary appointment={current} locale={locale} className="px-3 pb-3 pt-1" />
          <ActionSeparator />
          <ActionRow icon={Edit} label={t('contextMenu.editAppointment')} onClick={closeThen(onEdit)} />
          <ActionRow
            icon={ClipboardCheck}
            label={tStatusMenu('changeStatus')}
            hint={tStatus(current.status)}
            chevron
            onClick={() => setPage('status')}
          />
          <ActionRow
            icon={UserRound}
            label={hasPatient ? current.patientName : t('createDialog.none')}
            hint={hasPatient ? tSheet('patientHint') : undefined}
            chevron
            // Citas importadas de Google (u otras sin paciente) no tienen a quién
            // mostrarle cuentas, historial ni datos.
            disabled={!hasPatient}
            onClick={() => setPage('patient')}
          />
          <ActionSeparator />
          <ActionRow icon={Palette} label={tPanel('changeColor')} chevron onClick={() => setPage('color')} disabled={isRowActionPending} />
          <ActionRow
            icon={UserCog}
            label={current.doctorId ? tPanel('changeDoctor') : tPanel('assignDoctor')}
            hint={current.doctorId ? current.doctorName : undefined}
            chevron
            disabled={isRowActionPending}
            onClick={() => setPage('doctor')}
          />
          <ActionRow
            icon={Building2}
            label={current.calendar_source_id ? tPanel('changeCalendar') : tPanel('assignCalendar')}
            hint={current.calendar_source_id ? current.calendar_name : undefined}
            chevron
            disabled={isRowActionPending}
            onClick={() => setPage('calendar')}
          />
          {canRetime && start && (
            <>
              <ActionRow
                icon={CalendarIcon}
                label={tDrag('moveTo')}
                hint={format(start, 'dd/MM/yyyy HH:mm')}
                chevron
                disabled={isRowActionPending}
                onClick={() => setPage('date')}
              />
              <ActionRow
                icon={Clock}
                label={tDrag('duration')}
                hint={tDrag('minutes', { minutes: Math.round(durationMin) })}
                chevron
                disabled={isRowActionPending}
                onClick={() => setPage('duration')}
              />
            </>
          )}
          {onViewHistory && (
            <ActionRow icon={History} label={tPanel('history.title')} onClick={closeThen(onViewHistory)} />
          )}
          <ActionSeparator />
          <ActionRow icon={Trash2} label={t('contextMenu.deleteAppointment')} destructive onClick={closeThen(onDelete)} />
        </>
      );
  }

  return (
    <MobileActionSheet
      open={!!appointment}
      onClose={onClose}
      title={tSheet('appointmentTitle')}
      pageTitle={pageTitles[page]}
      onBack={page === 'main' ? undefined : backToMain}
      backLabel={tSheet('back')}
      closeLabel={tSheet('close')}
      data-testid="appointment-mobile-sheet"
    >
      {content}
    </MobileActionSheet>
  );
}
