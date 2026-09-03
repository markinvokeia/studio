'use client';

import * as React from 'react';
import { ArrowRight, BellRing, CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, Clock, Headset, Pencil, UserCog } from 'lucide-react';
import { format, isValid, parseISO } from 'date-fns';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { normalizeAppointmentStatus, STATUS_BADGE_VARIANT } from '@/constants/appointment-status';
import type {
  AppointmentReassignedNotification,
  AppointmentRescheduledNotification,
  AppointmentStatus,
  AppointmentStatusChangeNotification,
  AppointmentUpdatedNotification,
  NewAppointmentNotification,
  ReminderPanelNotification,
  SessionCompletedNotification,
  UnifiedNotification,
  WhatsappHandoffRequestedNotification,
} from '@/lib/types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface GlobalNotificationAlertsProps {
  items: UnifiedNotification[];
  onDismissAll: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusVariant(status: AppointmentStatus) {
  return (STATUS_BADGE_VARIANT[status] ?? 'default') as
    | 'default'
    | 'success'
    | 'destructive'
    | 'info'
    | 'warning'
    | 'secondary'
    | 'outline';
}

function formatLocalTime(value?: string | null): string {
  if (!value) return '';
  const parsed = parseISO(value.replace(/Z$/, ''));
  return isValid(parsed) ? format(parsed, 'HH:mm') : '';
}

// ── Per-type bodies ───────────────────────────────────────────────────────────

function NewAppointmentBody({ item }: { item: NewAppointmentNotification }) {
  const t = useTranslations('DoctorWorkspace');
  const tN = useTranslations('Notifications');
  const { appointment: appt } = item;

  return (
    <div className="flex flex-col items-center gap-5 px-2 py-4">
      <div
        className="grid h-16 w-16 place-items-center rounded-full text-white shadow-lg"
        style={{ backgroundColor: '#8b5cf6', animation: 'global-alert-sway 1.4s ease-in-out infinite' }}
      >
        <BellRing className="h-8 w-8" />
      </div>
      <div className="space-y-1 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {t('appointmentAlerts.singleTitle')}
        </p>
        <p className="text-xl font-bold leading-tight text-foreground">
          {appt.patientName || tN('unknownPatient')}
        </p>
        <p className="text-sm text-muted-foreground">
          {appt.services?.length
            ? appt.services.map((s) => s.name).join(', ')
            : appt.service_name || appt.summary || t('appointmentAlerts.unknownService')}
        </p>
        {appt.time && (
          <p className="text-sm font-semibold text-sky-700">{appt.time}</p>
        )}
      </div>
    </div>
  );
}

function StatusChangeBody({ item }: { item: AppointmentStatusChangeNotification }) {
  const t = useTranslations('DoctorWorkspace');
  const tStatus = useTranslations('AppointmentStatus');
  const tN = useTranslations('Notifications');

  return (
    <div className="flex flex-col items-center gap-5 px-2 py-4">
      <div
        className="grid h-16 w-16 place-items-center rounded-full text-white shadow-lg"
        style={{ backgroundColor: '#6366f1', animation: 'global-alert-sway 1.4s ease-in-out infinite' }}
      >
        <BellRing className="h-8 w-8" />
      </div>
      <div className="space-y-1.5 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {t('statusChangeAlerts.singleTitle')}
        </p>
        <p className="text-xl font-bold leading-tight text-foreground">
          {item.appointment.patientName || tN('unknownPatient')}
        </p>
        <div className="flex items-center justify-center gap-2">
          <Badge variant={statusVariant(normalizeAppointmentStatus(item.previousStatus))} className="capitalize">
            {tStatus(normalizeAppointmentStatus(item.previousStatus))}
          </Badge>
          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <Badge variant={statusVariant(normalizeAppointmentStatus(item.appointment.status))} className="capitalize">
            {tStatus(normalizeAppointmentStatus(item.appointment.status))}
          </Badge>
        </div>
      </div>
    </div>
  );
}

function RescheduledBody({ item }: { item: AppointmentRescheduledNotification }) {
  const t = useTranslations('DoctorWorkspace');
  const tN = useTranslations('Notifications');
  const { appointment: appt } = item;

  return (
    <div className="flex flex-col items-center gap-5 px-2 py-4">
      <div
        className="grid h-16 w-16 place-items-center rounded-full text-white shadow-lg"
        style={{ backgroundColor: '#f59e0b', animation: 'global-alert-sway 1.4s ease-in-out infinite' }}
      >
        <CalendarClock className="h-8 w-8" />
      </div>
      <div className="space-y-1 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {t('rescheduleAlerts.singleTitle')}
        </p>
        <p className="text-xl font-bold leading-tight text-foreground">
          {appt.patientName || tN('unknownPatient')}
        </p>
        <p className="text-sm text-muted-foreground">
          {appt.services?.length
            ? appt.services.map((s) => s.name).join(', ')
            : appt.service_name || appt.summary || t('appointmentAlerts.unknownService')}
        </p>
        {appt.time && (
          <p className="text-sm font-semibold text-amber-700">{appt.time}</p>
        )}
      </div>
    </div>
  );
}

function ReassignedBody({ item }: { item: AppointmentReassignedNotification }) {
  const t = useTranslations('DoctorWorkspace');
  const tN = useTranslations('Notifications');
  const { appointment: appt } = item;

  return (
    <div className="flex flex-col items-center gap-5 px-2 py-4">
      <div
        className="grid h-16 w-16 place-items-center rounded-full text-white shadow-lg"
        style={{ backgroundColor: '#14b8a6', animation: 'global-alert-sway 1.4s ease-in-out infinite' }}
      >
        <UserCog className="h-8 w-8" />
      </div>
      <div className="space-y-1 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {t('reassignAlerts.singleTitle')}
        </p>
        <p className="text-xl font-bold leading-tight text-foreground">
          {appt.patientName || tN('unknownPatient')}
        </p>
        <p className="text-sm text-muted-foreground">
          {appt.services?.length
            ? appt.services.map((s) => s.name).join(', ')
            : appt.service_name || appt.summary || t('appointmentAlerts.unknownService')}
        </p>
        {appt.time && (
          <p className="text-sm font-semibold text-teal-700">{appt.time}</p>
        )}
      </div>
    </div>
  );
}

function UpdatedBody({ item }: { item: AppointmentUpdatedNotification }) {
  const t = useTranslations('DoctorWorkspace');
  const tN = useTranslations('Notifications');
  const { appointment: appt } = item;

  return (
    <div className="flex flex-col items-center gap-5 px-2 py-4">
      <div
        className="grid h-16 w-16 place-items-center rounded-full text-white shadow-lg"
        style={{ backgroundColor: '#8b5cf6', animation: 'global-alert-sway 1.4s ease-in-out infinite' }}
      >
        <Pencil className="h-8 w-8" />
      </div>
      <div className="space-y-1 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {t('editAlerts.singleTitle')}
        </p>
        <p className="text-xl font-bold leading-tight text-foreground">
          {appt.patientName || tN('unknownPatient')}
        </p>
        <p className="text-sm text-muted-foreground">
          {appt.services?.length
            ? appt.services.map((s) => s.name).join(', ')
            : appt.service_name || appt.summary || t('appointmentAlerts.unknownService')}
        </p>
        {appt.time && (
          <p className="text-sm font-semibold text-violet-700">{appt.time}</p>
        )}
      </div>
    </div>
  );
}

function SessionCompletedBody({ item }: { item: SessionCompletedNotification }) {
  const t = useTranslations('Notifications');

  return (
    <div className="flex flex-col items-center gap-5 px-2 py-4">
      <div
        className="grid h-16 w-16 place-items-center rounded-full text-white shadow-lg"
        style={{ backgroundColor: '#10b981', animation: 'global-alert-sway 1.4s ease-in-out infinite' }}
      >
        <CheckCircle2 className="h-8 w-8" />
      </div>
      <div className="space-y-1 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {t('sessionCompletedAlertTitle')}
        </p>
        <p className="text-xl font-bold leading-tight text-foreground">
          {item.appointment.patientName || t('unknownPatient')}
        </p>
        {item.appointment.doctorName && (
          <p className="text-sm text-muted-foreground">
            {t('sessionCompletedBy', { doctor: item.appointment.doctorName })}
          </p>
        )}
        {item.session?.procedimiento_realizado && (
          <p className="text-sm text-muted-foreground leading-relaxed">
            {item.session.procedimiento_realizado}
          </p>
        )}
      </div>
    </div>
  );
}

function ReminderBody({ item }: { item: ReminderPanelNotification }) {
  const t = useTranslations('Reminders');
  const { reminder } = item;
  const time = formatLocalTime(reminder?.start_datetime);

  return (
    <div className="flex flex-col items-center gap-5 px-2 py-4">
      <div
        className="grid h-16 w-16 place-items-center rounded-full text-white shadow-lg"
        style={{
          backgroundColor: reminder?.color || '#8b5cf6',
          animation: 'global-alert-sway 1.4s ease-in-out infinite',
        }}
      >
        <BellRing className="h-8 w-8" />
      </div>
      <div className="space-y-1 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {t('dueTitle')}
        </p>
        <h2 className="text-xl font-bold leading-tight text-foreground">{reminder.title}</h2>
        {reminder.description && (
          <p className="text-sm text-muted-foreground leading-relaxed">{reminder.description}</p>
        )}
      </div>
      {time && (
        <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/50 px-3 py-1 text-sm text-muted-foreground">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          {time}
        </div>
      )}
    </div>
  );
}

function HandoffBody({ item }: { item: WhatsappHandoffRequestedNotification }) {
  const t = useTranslations('Notifications');

  return (
    <div className="flex flex-col items-center gap-5 px-2 py-4">
      <div
        className="grid h-16 w-16 place-items-center rounded-full text-white shadow-lg"
        style={{ backgroundColor: '#16a34a', animation: 'global-alert-sway 1.4s ease-in-out infinite' }}
      >
        <Headset className="h-8 w-8" />
      </div>
      <div className="space-y-1 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {t('handoffRequestedTitle')}
        </p>
        <p className="text-xl font-bold leading-tight text-foreground">
          {item.patientName || item.phone || t('unknownPatient')}
        </p>
        {item.phone && <p className="text-sm text-muted-foreground">{item.phone}</p>}
        {item.lastMessage && (
          <p className="text-sm text-muted-foreground leading-relaxed">{item.lastMessage}</p>
        )}
      </div>
    </div>
  );
}

function NotificationBody({ item }: { item: UnifiedNotification }) {
  if (item.type === 'new_appointment') return <NewAppointmentBody item={item} />;
  if (item.type === 'appointment_status_change') return <StatusChangeBody item={item} />;
  if (item.type === 'appointment_rescheduled') return <RescheduledBody item={item} />;
  if (item.type === 'appointment_reassigned') return <ReassignedBody item={item} />;
  if (item.type === 'appointment_updated') return <UpdatedBody item={item} />;
  if (item.type === 'session_completed') return <SessionCompletedBody item={item} />;
  if (item.type === 'whatsapp_handoff_requested') return <HandoffBody item={item} />;
  return <ReminderBody item={item as ReminderPanelNotification} />;
}

// ── Main component ────────────────────────────────────────────────────────────

export function GlobalNotificationAlerts({ items, onDismissAll }: GlobalNotificationAlertsProps) {
  const tN = useTranslations('Notifications');
  const [index, setIndex] = React.useState(0);
  const prevLengthRef = React.useRef(0);

  // Reset to page 0 only when the modal opens from a closed state (0 → N).
  // If a new notification arrives while the user is navigating, keep their position.
  React.useEffect(() => {
    const wasEmpty = prevLengthRef.current === 0;
    prevLengthRef.current = items.length;
    if (wasEmpty && items.length > 0) setIndex(0);
  }, [items.length]);

  const isOpen = items.length > 0;
  const total = items.length;
  const current = items[index] ?? null;
  const isFirst = index === 0;
  const isLast = index === total - 1;

  function accessibleTitle() {
    if (!current) return '';
    if (current.type === 'new_appointment') return tN('newAppointmentTitle');
    if (current.type === 'appointment_status_change') return tN('statusChangedTitle');
    if (current.type === 'appointment_rescheduled') return tN('appointmentRescheduledTitle');
    if (current.type === 'appointment_reassigned') return tN('appointmentReassignedTitle');
    if (current.type === 'appointment_updated') return tN('appointmentUpdatedTitle');
    if (current.type === 'session_completed') return tN('sessionCompletedAlertTitle');
    if (current.type === 'whatsapp_handoff_requested') return tN('handoffRequestedTitle');
    return tN('reminderDueTitle');
  }

  return (
    <>
      <style>{`
        @keyframes global-alert-sway {
          0%, 70%, 100% { transform: rotate(0deg); }
          10%            { transform: rotate(-22deg); }
          25%            { transform: rotate(22deg); }
          40%            { transform: rotate(-16deg); }
          55%            { transform: rotate(16deg); }
        }
      `}</style>

      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onDismissAll(); }}>
        <DialogContent maxWidth="sm" className="text-center">
          <DialogTitle className="sr-only">{accessibleTitle()}</DialogTitle>

          <div className="px-6 pb-6">
            {/* Pagination indicator */}
            {total > 1 && (
              <div className="flex items-center justify-center gap-3 pb-1">
                <button
                  type="button"
                  onClick={() => setIndex((i) => Math.max(0, i - 1))}
                  disabled={isFirst}
                  className="rounded-full p-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                  aria-label={tN('previousNotification')}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <span className="text-xs font-medium tabular-nums text-muted-foreground">
                  {index + 1} / {total}
                </span>

                <button
                  type="button"
                  onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
                  disabled={isLast}
                  className="rounded-full p-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                  aria-label={tN('nextNotification')}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Notification body */}
            {current && <NotificationBody item={current} />}

            {/* Actions */}
            <div className="mt-2 flex flex-col gap-2">
              {total > 1 && !isLast && (
                <Button variant="outline" onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}>
                  {tN('nextNotification')}
                </Button>
              )}
              <Button onClick={onDismissAll}>
                {total === 1 ? tN('dismiss') : tN('dismissAll')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
