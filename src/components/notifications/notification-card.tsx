'use client';

import * as React from 'react';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ArrowRight,
  Bell,
  CalendarPlus,
  Check,
  Clock,
  ExternalLink,
  FileText,
  ListChecks,
  Loader2,
  Stethoscope,
  X,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { normalizeAppointmentStatus, STATUS_BADGE_VARIANT } from '@/constants/appointment-status';
import { API_ROUTES } from '@/constants/routes';
import { useNotifications } from '@/context/notifications-context';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';
import type {
  AppointmentStatus,
  AppointmentStatusChangeNotification,
  NewAppointmentNotification,
  ReminderPanelNotification,
  SessionCompletedNotification,
  UnifiedNotification,
} from '@/lib/types';

// ── Shared helpers ────────────────────────────────────────────────────────────

function RelativeTime({ iso }: { iso: string }) {
  const [label, setLabel] = React.useState('');
  React.useEffect(() => {
    const update = () =>
      setLabel(formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: es }));
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [iso]);
  return <span className="text-[10px] text-muted-foreground">{label}</span>;
}

function CardWrapper({
  children,
  onDismiss,
  accent,
}: {
  children: React.ReactNode;
  onDismiss: () => void;
  accent: string;
}) {
  return (
    <div className={cn('relative rounded-xl border border-border bg-card p-4 shadow-sm', accent)}>
      <button
        type="button"
        onClick={onDismiss}
        className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground opacity-60 hover:opacity-100 hover:bg-accent transition-opacity"
        aria-label="Descartar"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: AppointmentStatus }) {
  const tStatus = useTranslations('AppointmentStatus');
  const variant = (STATUS_BADGE_VARIANT[status] ?? 'default') as
    | 'default'
    | 'secondary'
    | 'destructive'
    | 'outline'
    | 'success'
    | 'warning'
    | 'info';
  return (
    <Badge variant={variant} className="capitalize text-[10px]">
      {tStatus(normalizeAppointmentStatus(status))}
    </Badge>
  );
}

// ── Appointment status change card ────────────────────────────────────────────

function AppointmentStatusCard({ notification }: { notification: AppointmentStatusChangeNotification }) {
  const { dismissNotification, closePanel } = useNotifications();
  const t = useTranslations('Notifications');
  const locale = useLocale();
  const router = useRouter();
  const { appointment, previousStatus, createdAt } = notification;

  const serviceLabel =
    appointment.services?.length
      ? appointment.services.map((s) => s.name).join(', ')
      : appointment.service_name || appointment.summary || t('unknownService');

  const handleView = () => {
    closePanel();
    router.push(`/${locale}/workspace?appointmentId=${appointment.id}`);
  };

  return (
    <CardWrapper onDismiss={() => dismissNotification(notification.id)} accent="border-l-[3px] border-l-primary/50">
      <div className="flex items-start gap-3 pr-6">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Bell className="h-3.5 w-3.5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-foreground truncate">
              {appointment.patientName || t('unknownPatient')}
            </span>
            <RelativeTime iso={createdAt} />
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground truncate">{serviceLabel}</p>
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            <StatusBadge status={previousStatus} />
            <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
            <StatusBadge status={appointment.status} />
          </div>

          <Button
            variant="outline"
            size="sm"
            className="mt-3 h-7 w-full justify-start gap-2 text-[11px]"
            onClick={handleView}
          >
            <ExternalLink className="h-3.5 w-3.5 text-primary" />
            {t('actionViewWorkspace')}
          </Button>
        </div>
      </div>
    </CardWrapper>
  );
}

// ── Session completed card ────────────────────────────────────────────────────

function SessionCompletedCard({ notification }: { notification: SessionCompletedNotification }) {
  const { dismissNotification, closePanel } = useNotifications();
  const t = useTranslations('Notifications');
  const locale = useLocale();
  const router = useRouter();
  const { appointment, session, createdAt } = notification;

  const hasNextPlan = Boolean(session?.plan_proxima_cita?.trim());
  const hasTreatments = Array.isArray(session?.tratamientos) && session.tratamientos.length > 0;
  const hasNoQuote = !appointment.quote_id;
  const hasQuote = !!appointment.quote_id;

  const goToAppointments = (action: string) => {
    closePanel();
    const params = new URLSearchParams({ act: action, patientId: appointment.patientId, patientName: appointment.patientName || '' });
    if (action === 'schedule') {
      if (session?.fecha_proxima_cita) params.set('date', session.fecha_proxima_cita);
      if (appointment.doctorId) params.set('doctorId', appointment.doctorId);
      if (appointment.doctorName) params.set('doctorName', appointment.doctorName);
    }
    router.push(`/${locale}/appointments?${params.toString()}`);
  };

  return (
    <CardWrapper onDismiss={() => dismissNotification(notification.id)} accent="border-l-[3px] border-l-emerald-500/60">
      <div className="pr-6">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
            <Stethoscope className="h-3.5 w-3.5 text-emerald-600" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold text-foreground truncate">
                {appointment.patientName || t('unknownPatient')}
              </span>
              <RelativeTime iso={createdAt} />
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {t('sessionCompletedBy', { doctor: appointment.doctorName || t('unknownDoctor') })}
            </p>
          </div>
        </div>

        {/* Session info */}
        <div className="mt-3 space-y-1.5">
          {session?.procedimiento_realizado && (
            <div className="rounded-lg bg-muted/40 px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {t('procedure')}
              </p>
              <p className="mt-0.5 text-[11px] text-foreground line-clamp-2">
                {session.procedimiento_realizado}
              </p>
            </div>
          )}

          {hasNextPlan && (
            <div className="rounded-lg bg-blue-50/60 dark:bg-blue-950/20 px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600/80">
                {t('nextPlan')}
              </p>
              <p className="mt-0.5 text-[11px] text-foreground line-clamp-2">
                {session?.plan_proxima_cita}
              </p>
            </div>
          )}

          {notification.discharge && (
            <div className="rounded-lg bg-emerald-50/60 dark:bg-emerald-950/20 px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600/80">
                {t('discharged')}
              </p>
              <p className="mt-0.5 text-[11px] text-foreground">
                {t('dischargedUntil', {
                  date: (() => {
                    try {
                      return format(parseISO(notification.discharge.appointment_date), 'PP', { locale: es });
                    } catch {
                      return notification.discharge.appointment_date;
                    }
                  })(),
                })}
              </p>
            </div>
          )}

          {hasTreatments && (
            <p className="text-[11px] text-muted-foreground">
              {t('treatmentCount', { count: session!.tratamientos.length })}
            </p>
          )}
        </div>

        {/* Quick actions — shown only when relevant */}
        {(hasNoQuote || hasQuote || hasNextPlan) && (
          <div className="mt-3 flex flex-col gap-1.5">
            {hasNoQuote && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-full justify-start gap-2 text-[11px]"
                onClick={() => goToAppointments('quote')}
              >
                <ListChecks className="h-3.5 w-3.5 text-primary" />
                {t('actionCreateQuote')}
              </Button>
            )}

            {hasQuote && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-full justify-start gap-2 text-[11px]"
                onClick={() => goToAppointments('invoice')}
              >
                <FileText className="h-3.5 w-3.5 text-amber-500" />
                {t('actionGenerateInvoice')}
              </Button>
            )}

            {hasNextPlan && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-full justify-start gap-2 text-[11px]"
                onClick={() => goToAppointments('schedule')}
              >
                <CalendarPlus className="h-3.5 w-3.5 text-blue-500" />
                {t('actionScheduleNext')}
              </Button>
            )}
          </div>
        )}
      </div>
    </CardWrapper>
  );
}

// ── New appointment card ──────────────────────────────────────────────────────

function NewAppointmentCard({ notification }: { notification: NewAppointmentNotification }) {
  const { dismissNotification, closePanel } = useNotifications();
  const t = useTranslations('Notifications');
  const locale = useLocale();
  const router = useRouter();
  const { appointment, createdAt } = notification;

  const serviceLabel =
    appointment.services?.length
      ? appointment.services.map((s) => s.name).join(', ')
      : appointment.service_name || appointment.summary || t('unknownService');

  const handleView = () => {
    closePanel();
    router.push(`/${locale}/workspace?appointmentId=${appointment.id}`);
  };

  return (
    <CardWrapper onDismiss={() => dismissNotification(notification.id)} accent="border-l-[3px] border-l-sky-500/60">
      <div className="flex items-start gap-3 pr-6">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-500/10">
          <CalendarPlus className="h-3.5 w-3.5 text-sky-600" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-foreground truncate">
              {appointment.patientName || t('unknownPatient')}
            </span>
            <RelativeTime iso={createdAt} />
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground truncate">{serviceLabel}</p>
          {appointment.time && (
            <p className="mt-1 text-[11px] font-medium text-sky-700">
              {t('newAppointmentTime', { time: appointment.time })}
            </p>
          )}

          <Button
            variant="outline"
            size="sm"
            className="mt-3 h-7 w-full justify-start gap-2 text-[11px]"
            onClick={handleView}
          >
            <ExternalLink className="h-3.5 w-3.5 text-sky-600" />
            {t('actionViewWorkspace')}
          </Button>
        </div>
      </div>
    </CardWrapper>
  );
}

// ── Reminder card ─────────────────────────────────────────────────────────────

function ReminderCard({ notification }: { notification: ReminderPanelNotification }) {
  const { dismissNotification } = useNotifications();
  const t = useTranslations('Notifications');
  const { reminder, createdAt } = notification;
  const [isDone, setIsDone] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);

  const priorityAccent =
    reminder.priority === 'HIGH'
      ? 'border-l-[3px] border-l-red-500/60'
      : reminder.priority === 'MEDIUM'
        ? 'border-l-[3px] border-l-amber-500/60'
        : 'border-l-[3px] border-l-slate-400/60';

  const iconColor =
    reminder.priority === 'HIGH'
      ? 'text-red-500'
      : reminder.priority === 'MEDIUM'
        ? 'text-amber-500'
        : 'text-slate-500';

  const handleMarkDone = async () => {
    setIsLoading(true);
    try {
      const now = new Date().toISOString();
      await api.post(API_ROUTES.REMINDERS_UPSERT, {
        ...reminder,
        status: 'done',
        raise_alert: reminder.raise_alert ?? true,
        updated_at: now,
        completed_at: now,
      });
      setIsDone(true);
      // Small delay so the user sees the ✓ before the card disappears
      setTimeout(() => dismissNotification(notification.id), 600);
    } catch {
      // Silent — dismiss anyway so the panel stays clean
      dismissNotification(notification.id);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <CardWrapper onDismiss={() => dismissNotification(notification.id)} accent={priorityAccent}>
      <div className="flex items-start gap-3 pr-6">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted/60">
          <Clock className={cn('h-3.5 w-3.5', iconColor)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-foreground truncate">{reminder.title}</span>
            <RelativeTime iso={createdAt} />
          </div>
          {reminder.description && (
            <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">
              {reminder.description}
            </p>
          )}
          <div className="mt-2 flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] capitalize">
              {t(`priority_${reminder.priority.toLowerCase()}`)}
            </Badge>
          </div>

          <Button
            variant={isDone ? 'default' : 'outline'}
            size="sm"
            className={cn(
              'mt-3 h-7 w-full justify-start gap-2 text-[11px] transition-colors',
              isDone && 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-500',
            )}
            onClick={handleMarkDone}
            disabled={isLoading || isDone}
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className={cn('h-3.5 w-3.5', isDone ? 'text-white' : 'text-emerald-600')} />
            )}
            {isDone ? t('reminderDone') : t('actionMarkDone')}
          </Button>
        </div>
      </div>
    </CardWrapper>
  );
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

export function NotificationCard({ notification }: { notification: UnifiedNotification }) {
  switch (notification.type) {
    case 'new_appointment':
      return <NewAppointmentCard notification={notification} />;
    case 'appointment_status_change':
      return <AppointmentStatusCard notification={notification} />;
    case 'session_completed':
      return <SessionCompletedCard notification={notification} />;
    case 'reminder':
      return <ReminderCard notification={notification} />;
  }
}
