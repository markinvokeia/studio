'use client';

import * as React from 'react';
import { differenceInMinutes, format, parseISO } from 'date-fns';
import {
  ArrowRight,
  Calendar as CalendarIcon,
  CalendarSync,
  Clock,
  Edit,
  FileText,
  HeartPulse,
  Info,
  Layers,
  Loader2,
  MapPin,
  StickyNote,
  Stethoscope,
  UserSquare,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ResizableSheet, SheetDescription, SheetTitle } from '@/components/ui/resizable-sheet';
import { STATUS_ACCENT_COLOR, canReschedule } from '@/constants/appointment-status';
import { formatDisplayDate, cn } from '@/lib/utils';
import type { Appointment, AppointmentStatus, Invoice, Order, PatientSession } from '@/lib/types';

import { DoctorDetailSheet } from '@/components/appointments/DoctorDetailSheet';
import { PatientDetailSheet } from '@/components/appointments/PatientDetailSheet';
import { QuoteDetailSheet } from '@/components/appointments/QuoteDetailSheet';
import { AppointmentStatusRail, type StatusChangeExtra } from '@/components/appointments/AppointmentStatusRail';
import { getStatusIcon } from '@/components/appointments/status-icons';

function initials(name?: string): string {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?';
}

function parseLocalDateTime(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== 'string') return null;

  const localValue = value.replace(/Z$/, '');
  const parsed = parseISO(localValue);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function timeFromDateTime(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : format(value, 'HH:mm');
  if (typeof value !== 'string') return null;

  const timePart = value.replace(/Z$/, '').split('T')[1];
  return timePart ? timePart.slice(0, 5) : null;
}

interface DetailRowProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  onClick?: () => void;
  tone?: 'default' | 'warning';
  className?: string;
}

function DetailRow({ icon: Icon, label, value, detail, onClick, tone = 'default', className }: DetailRowProps) {
  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 border-b border-border/70 py-3 text-left',
        onClick && 'transition-colors hover:bg-muted/20',
        className,
      )}
    >
      <span
        className={cn(
          'grid h-10 w-10 shrink-0 place-items-center rounded-xl',
          tone === 'warning' ? 'bg-amber-50 text-amber-700' : 'bg-muted/60 text-muted-foreground',
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium text-muted-foreground">{label}</span>
        <span className="block text-sm font-semibold leading-snug text-foreground">{value}</span>
        {detail && <span className="mt-0.5 block text-xs text-muted-foreground">{detail}</span>}
      </span>
    </Component>
  );
}

interface AppointmentPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: Appointment | null;
  linkedSession: PatientSession | null;
  isLoadingLinkedSession: boolean;
  quoteOrder: Order | null;
  quoteInvoices: Invoice[];
  isLoadingQuoteInfo: boolean;
  doctorColor?: string;
  onEdit?: (appointment: Appointment) => void;
  onCancel?: (appointment: Appointment) => void;
  onOpenClinicSession?: (appointment: Appointment) => void;
  onReschedule?: (appointment: Appointment) => void;
  onStatusChange: (
    appointment: Appointment,
    newStatus: AppointmentStatus,
    extra?: StatusChangeExtra,
  ) => void;
  onRequestCustomCancellation?: (appointment: Appointment) => void;
}

export function AppointmentPanel({
  open,
  onOpenChange,
  appointment,
  linkedSession,
  isLoadingLinkedSession,
  quoteOrder,
  quoteInvoices,
  isLoadingQuoteInfo,
  doctorColor,
  onEdit,
  onOpenClinicSession,
  onReschedule,
  onStatusChange,
  onRequestCustomCancellation,
}: AppointmentPanelProps) {
  const t = useTranslations('AppointmentsPage');
  const tColumns = useTranslations('AppointmentsColumns');
  const tStatus = useTranslations('AppointmentStatus');
  const tReschedule = useTranslations('AppointmentReschedule');
  const tPanel = useTranslations('AppointmentPanel');

  const [isPatientSheetOpen, setIsPatientSheetOpen] = React.useState(false);
  const [isDoctorSheetOpen, setIsDoctorSheetOpen] = React.useState(false);
  const [isQuoteSheetOpen, setIsQuoteSheetOpen] = React.useState(false);

  if (!appointment) return null;

  const serviceName = appointment.services && appointment.services.length > 0
    ? appointment.services.map((service) => service.name).join(', ')
    : appointment.service_name || appointment.summary || '';
  const startDt = parseLocalDateTime(appointment.start?.dateTime);
  const endDt = parseLocalDateTime(appointment.end?.dateTime);
  const endTime = timeFromDateTime(appointment.end?.dateTime);
  const durationMin = startDt && endDt ? differenceInMinutes(endDt, startDt) : null;
  const StatusIcon = getStatusIcon(appointment.status, appointment.cancellation_reason);
  const statusColor = STATUS_ACCENT_COLOR[appointment.status];
  const appointmentCode = `#${appointment.id.slice(0, 8).toUpperCase()}`;
  const patientMeta = [appointment.patientPhone].filter(Boolean).join(' · ');
  const hasServices = appointment.services && appointment.services.length > 0;
  const invoiceCount = quoteInvoices.length;

  return (
    <>
      <ResizableSheet
        open={open}
        onOpenChange={onOpenChange}
        defaultWidth={920}
        minWidth={520}
        maxWidth={1280}
        storageKey="appointment-panel-width"
      >
        <div className="flex h-full flex-col overflow-hidden bg-card font-body">
          <div className="flex-none border-b border-border bg-card px-5 py-4 pr-24">
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => appointment.patientId && setIsPatientSheetOpen(true)}
                className="shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label={tPanel('openPatient')}
                disabled={!appointment.patientId}
              >
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-primary/25 text-base font-semibold text-primary">
                    {initials(appointment.patientName)}
                  </AvatarFallback>
                </Avatar>
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <SheetTitle asChild>
                    <button
                      type="button"
                      onClick={() => appointment.patientId && setIsPatientSheetOpen(true)}
                      disabled={!appointment.patientId}
                      className={cn(
                        'truncate text-left text-lg font-semibold text-foreground',
                        appointment.patientId && 'hover:underline underline-offset-4',
                      )}
                    >
                      {appointment.patientName}
                    </button>
                  </SheetTitle>
                  <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-sm font-semibold text-muted-foreground">
                    {appointmentCode}
                  </span>
                </div>
                {patientMeta && (
                  <p className="mt-1 truncate text-sm font-medium text-muted-foreground">{patientMeta}</p>
                )}
                {serviceName && (
                  <SheetDescription className="mt-1 truncate text-sm text-muted-foreground">
                    {serviceName}
                  </SheetDescription>
                )}
              </div>

              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                <StatusIcon className="h-3.5 w-3.5" style={{ color: statusColor }} />
                {tStatus(appointment.status)}
              </span>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 overflow-hidden">
            <div className="min-w-0 flex-1 overflow-auto px-5 py-4">
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-base font-semibold">{t('panelTabs.info')}</h3>
                </div>

                <div className="grid gap-x-8 md:grid-cols-2">
                  <DetailRow
                    icon={CalendarIcon}
                    label={tColumns('date')}
                    value={formatDisplayDate(appointment.date)}
                  />
                  <DetailRow
                    icon={Clock}
                    label={tColumns('time')}
                    value={`${appointment.time}${endTime ? ` -> ${endTime}` : ''}`}
                    detail={durationMin != null && durationMin > 0
                      ? tPanel('durationMinutes', { minutes: durationMin })
                      : undefined}
                  />
                  <DetailRow
                    icon={MapPin}
                    label={tColumns('calendar')}
                    value={appointment.calendar_name || '-'}
                  />
                  <DetailRow
                    icon={UserSquare}
                    label={tColumns('doctor')}
                    value={appointment.doctorName || '-'}
                    detail={doctorColor ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: doctorColor }} />
                        {tPanel('openDoctor')}
                      </span>
                    ) : undefined}
                    onClick={appointment.doctorId ? () => setIsDoctorSheetOpen(true) : undefined}
                  />
                </div>

                {hasServices && (
                  <DetailRow
                    icon={Layers}
                    label={tPanel('servicesCount', { count: appointment.services?.length ?? 0 })}
                    value={
                      <span className="flex flex-col">
                        {appointment.services?.map((service) => (
                          <span key={service.id} className="flex items-center gap-2 border-b border-dashed border-border/70 py-2 last:border-b-0">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: service.color || STATUS_ACCENT_COLOR.confirmed }}
                            />
                            <span className="min-w-0 flex-1 truncate">{service.name}</span>
                            {service.duration_minutes ? (
                              <span className="shrink-0 text-xs font-medium text-muted-foreground">
                                {tPanel('durationMinutes', { minutes: service.duration_minutes })}
                              </span>
                            ) : null}
                          </span>
                        ))}
                      </span>
                    }
                    className="md:col-span-2"
                  />
                )}

                {appointment.notes && (
                  <DetailRow
                    icon={StickyNote}
                    label={t('contextMenu.notes')}
                    value={<span className="whitespace-pre-wrap font-medium">{appointment.notes}</span>}
                    tone="warning"
                    className="md:col-span-2"
                  />
                )}
              </section>

              {(linkedSession || isLoadingLinkedSession || appointment.treatment_seq_step_id != null) && (
                <section className="mt-6 border-t border-border pt-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <HeartPulse className="h-4 w-4 text-muted-foreground" />
                      <h3 className="text-base font-semibold">{t('linkedSession')}</h3>
                    </div>
                    {onOpenClinicSession && (
                      <Button
                        variant="link"
                        className="h-auto px-0 text-primary"
                        onClick={() => onOpenClinicSession(appointment)}
                      >
                        {linkedSession ? t('editSession') : t('createSession')}
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  {isLoadingLinkedSession ? (
                    <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t('linkedSession')}
                    </div>
                  ) : linkedSession ? (
                    <div className="grid gap-4 rounded-xl border border-border bg-primary/5 p-4 md:grid-cols-[auto_1fr_auto] md:items-center">
                      <div className="space-y-1">
                        <p className="font-mono text-sm font-semibold text-muted-foreground">
                          #S-{String(linkedSession.sesion_id).padStart(4, '0')}
                        </p>
                        <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                          <span className="h-2 w-2 rounded-full bg-primary" />
                          {formatDisplayDate(linkedSession.fecha_sesion)}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {linkedSession.procedimiento_realizado || t('procedure')}
                        </p>
                        <p className="mt-1 truncate text-sm text-muted-foreground">
                          {[linkedSession.doctor_name || linkedSession.nombre_doctor, linkedSession.notas_clinicas]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      </div>
                      {onOpenClinicSession && (
                        <Button
                          variant="outline"
                          className="justify-self-start gap-2 border-primary/25 text-primary hover:bg-primary/10 md:justify-self-end"
                          onClick={() => onOpenClinicSession(appointment)}
                        >
                          <Stethoscope className="h-4 w-4" />
                          {t('editSession')}
                        </Button>
                      )}
                    </div>
                  ) : onOpenClinicSession ? (
                    <button
                      type="button"
                      onClick={() => onOpenClinicSession(appointment)}
                      className="flex w-full items-center gap-3 rounded-xl border border-dashed border-border p-4 text-left transition-colors hover:bg-muted/35"
                    >
                      <Stethoscope className="h-5 w-5 text-muted-foreground" />
                      <span className="flex-1">
                        <span className="block font-semibold">{t('noLinkedSession')}</span>
                        <span className="text-xs text-muted-foreground">{t('createSession')}</span>
                      </span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ) : (
                    <div className="flex w-full items-center gap-3 rounded-xl border border-dashed border-border p-4 text-left">
                      <Stethoscope className="h-5 w-5 text-muted-foreground" />
                      <span className="flex-1">
                        <span className="block font-semibold">{t('noLinkedSession')}</span>
                        <span className="text-xs text-muted-foreground">{t('createSession')}</span>
                      </span>
                    </div>
                  )}
                </section>
              )}

              {(appointment.quote_id || quoteOrder || invoiceCount > 0 || isLoadingQuoteInfo) && (
                <section className="mt-6 border-t border-border pt-4">
                  <div className="mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-base font-semibold">{tColumns('quoteDocNo')}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => appointment.quote_id && setIsQuoteSheetOpen(true)}
                    disabled={!appointment.quote_id}
                    className="flex w-full items-center gap-3 rounded-xl border border-border p-4 text-left transition-colors hover:bg-muted/35 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="flex-1">
                      <span className="block font-mono text-xs font-semibold">
                        {appointment.quote_doc_no || appointment.quote_id || t('noLinkedOrder')}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {isLoadingQuoteInfo
                          ? t('linkedInvoice')
                          : invoiceCount > 0
                            ? `${t('linkedInvoice')} · ${invoiceCount}`
                            : t('notInvoiced')}
                      </span>
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                </section>
              )}
            </div>

            <AppointmentStatusRail
              variant="side"
              appointment={appointment}
              onChange={(status, extra) => onStatusChange(appointment, status, extra)}
              onRequestCustomCancellation={
                onRequestCustomCancellation
                  ? () => onRequestCustomCancellation(appointment)
                  : undefined
              }
            />
          </div>

          {(onReschedule || onEdit) && (
            <div className="flex-none border-t border-border bg-muted/30 px-5 py-4">
              <div className="flex items-center justify-end gap-3">
                {onReschedule && (
                  <Button
                    size="lg"
                    variant="outline"
                    className="gap-2"
                    disabled={!canReschedule(appointment.status)}
                    title={!canReschedule(appointment.status)
                      ? tReschedule('blockedTooltip', { status: tStatus(appointment.status) })
                      : undefined}
                    onClick={() => { onReschedule(appointment); onOpenChange(false); }}
                  >
                    <CalendarSync className="h-4 w-4" />
                    {tReschedule('action')}
                  </Button>
                )}
                {onEdit && (
                  <Button
                    size="lg"
                    className="gap-2"
                    onClick={() => { onEdit(appointment); onOpenChange(false); }}
                  >
                    <Edit className="h-4 w-4" />
                    {tColumns('edit')}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </ResizableSheet>

      {appointment.patientId && (
        <PatientDetailSheet
          open={isPatientSheetOpen}
          onOpenChange={setIsPatientSheetOpen}
          userId={appointment.patientId}
          userName={appointment.patientName}
          userEmail={appointment.patientEmail}
          userPhone={appointment.patientPhone}
        />
      )}
      {appointment.doctorId && (
        <DoctorDetailSheet
          open={isDoctorSheetOpen}
          onOpenChange={setIsDoctorSheetOpen}
          doctorId={appointment.doctorId}
          doctorName={appointment.doctorName ?? ''}
          doctorColor={doctorColor}
        />
      )}
      {appointment.quote_id && (
        <QuoteDetailSheet
          open={isQuoteSheetOpen}
          onOpenChange={setIsQuoteSheetOpen}
          quoteId={appointment.quote_id}
          quoteDocNo={appointment.quote_doc_no}
          patientName={appointment.patientName}
        />
      )}
    </>
  );
}
