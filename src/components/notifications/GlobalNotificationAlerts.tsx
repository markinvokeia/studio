'use client';

import * as React from 'react';
import { ArrowRight, BellRing, CheckCircle2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { normalizeAppointmentStatus, STATUS_BADGE_VARIANT } from '@/constants/appointment-status';
import type {
  AppointmentStatus,
  AppointmentStatusChangeNotification,
  NewAppointmentNotification,
  ReminderPanelNotification,
  SessionCompletedNotification,
} from '@/lib/types';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AlertBatch =
  | { type: 'new_appointment'; items: NewAppointmentNotification[] }
  | { type: 'appointment_status_change'; items: AppointmentStatusChangeNotification[] }
  | { type: 'session_completed'; items: SessionCompletedNotification[] }
  | { type: 'reminder'; items: ReminderPanelNotification[] };

interface GlobalNotificationAlertsProps {
  queue: AlertBatch[];
  onDismiss: () => void;
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

// ── Sub-renders ───────────────────────────────────────────────────────────────

function NewAppointmentBody({
  items,
  onDismiss,
}: {
  items: NewAppointmentNotification[];
  onDismiss: () => void;
}) {
  const t = useTranslations('DoctorWorkspace');
  const tN = useTranslations('Notifications');
  const first = items[0];
  const appt = first?.appointment;

  return (
    <div className="flex flex-col items-center gap-5 px-2 py-4">
      <div
        className="grid h-20 w-20 place-items-center rounded-full text-white shadow-lg"
        style={{ backgroundColor: '#8b5cf6', animation: 'global-alert-sway 1.4s ease-in-out infinite' }}
      >
        <BellRing className="h-9 w-9" />
      </div>

      <div className="space-y-1.5 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {items.length === 1
            ? t('appointmentAlerts.singleTitle')
            : t('appointmentAlerts.multipleTitle', { count: items.length })}
        </p>
        {appt && (
          <>
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
          </>
        )}
        {items.length > 1 && (
          <p className="text-sm text-muted-foreground">
            {t('appointmentAlerts.modalMultipleDescription', { count: items.length })}
          </p>
        )}
      </div>

      <Button className="mt-1 w-full" onClick={onDismiss}>
        {t('appointmentAlerts.dismiss')}
      </Button>
    </div>
  );
}

function StatusChangeBody({
  items,
  onDismiss,
}: {
  items: AppointmentStatusChangeNotification[];
  onDismiss: () => void;
}) {
  const t = useTranslations('DoctorWorkspace');
  const tStatus = useTranslations('AppointmentStatus');
  const tN = useTranslations('Notifications');
  const first = items[0];

  return (
    <div className="flex flex-col items-center gap-5 px-2 py-4">
      <div
        className="grid h-20 w-20 place-items-center rounded-full text-white shadow-lg"
        style={{ backgroundColor: '#6366f1', animation: 'global-alert-sway 1.4s ease-in-out infinite' }}
      >
        <BellRing className="h-9 w-9" />
      </div>

      <div className="space-y-1.5 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {items.length === 1
            ? t('statusChangeAlerts.singleTitle')
            : t('statusChangeAlerts.multipleTitle', { count: items.length })}
        </p>
        {first && (
          <>
            <p className="text-xl font-bold leading-tight text-foreground">
              {first.appointment.patientName || tN('unknownPatient')}
            </p>
            <div className="flex items-center justify-center gap-2">
              <Badge variant={statusVariant(normalizeAppointmentStatus(first.previousStatus))} className="capitalize">
                {tStatus(normalizeAppointmentStatus(first.previousStatus))}
              </Badge>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <Badge variant={statusVariant(normalizeAppointmentStatus(first.appointment.status))} className="capitalize">
                {tStatus(normalizeAppointmentStatus(first.appointment.status))}
              </Badge>
            </div>
          </>
        )}
        {items.length > 1 && (
          <p className="text-sm text-muted-foreground">
            {t('statusChangeAlerts.modalMultipleDescription', { count: items.length })}
          </p>
        )}
      </div>

      <Button className="mt-1 w-full" onClick={onDismiss}>
        {t('statusChangeAlerts.dismiss')}
      </Button>
    </div>
  );
}

function SessionCompletedBody({
  items,
  onDismiss,
}: {
  items: SessionCompletedNotification[];
  onDismiss: () => void;
}) {
  const t = useTranslations('Notifications');
  const first = items[0];

  return (
    <div className="flex flex-col items-center gap-5 px-2 py-4">
      <div
        className="grid h-20 w-20 place-items-center rounded-full text-white shadow-lg"
        style={{ backgroundColor: '#10b981', animation: 'global-alert-sway 1.4s ease-in-out infinite' }}
      >
        <CheckCircle2 className="h-9 w-9" />
      </div>

      <div className="space-y-1.5 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {items.length === 1
            ? t('sessionCompletedAlertTitle')
            : t('sessionCompletedAlertTitleMultiple', { count: items.length })}
        </p>
        {first && (
          <>
            <p className="text-xl font-bold leading-tight text-foreground">
              {first.appointment.patientName || t('unknownPatient')}
            </p>
            {first.appointment.doctorName && (
              <p className="text-sm text-muted-foreground">
                {t('sessionCompletedBy', { doctor: first.appointment.doctorName })}
              </p>
            )}
            {first.session?.procedimiento_realizado && (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {first.session.procedimiento_realizado}
              </p>
            )}
          </>
        )}
        {items.length > 1 && (
          <p className="text-sm text-muted-foreground">
            {t('sessionCompletedAlertDescriptionMultiple', { count: items.length })}
          </p>
        )}
      </div>

      <Button className="mt-1 w-full" onClick={onDismiss}>
        {t('sessionCompletedAlertDismiss')}
      </Button>
    </div>
  );
}

function ReminderBody({
  items,
  onDismiss,
}: {
  items: ReminderPanelNotification[];
  onDismiss: () => void;
}) {
  const t = useTranslations('Notifications');
  const first = items[0];
  const reminder = first?.reminder;

  const accentColor =
    reminder?.priority === 'HIGH'
      ? '#ef4444'
      : reminder?.priority === 'MEDIUM'
        ? '#f59e0b'
        : '#6b7280';

  return (
    <div className="flex flex-col items-center gap-5 px-2 py-4">
      <div
        className="grid h-20 w-20 place-items-center rounded-full text-white shadow-lg"
        style={{ backgroundColor: accentColor, animation: 'global-alert-sway 1.4s ease-in-out infinite' }}
      >
        <BellRing className="h-9 w-9" />
      </div>

      <div className="space-y-1.5 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {t('reminderAlertTitle')}
        </p>
        {reminder && (
          <>
            <p className="text-xl font-bold leading-tight text-foreground">{reminder.title}</p>
            {reminder.description && (
              <p className="text-sm text-muted-foreground leading-relaxed">{reminder.description}</p>
            )}
          </>
        )}
      </div>

      <Button className="mt-1 w-full" onClick={onDismiss}>
        {t('sessionCompletedAlertDismiss')}
      </Button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function GlobalNotificationAlerts({ queue, onDismiss }: GlobalNotificationAlertsProps) {
  const current = queue[0] ?? null;
  const tDW = useTranslations('DoctorWorkspace');
  const tN = useTranslations('Notifications');

  function accessibleTitle() {
    if (!current) return '';
    if (current.type === 'new_appointment') return tDW('appointmentAlerts.singleTitle');
    if (current.type === 'appointment_status_change') return tDW('statusChangeAlerts.singleTitle');
    if (current.type === 'reminder') return tN('reminderAlertTitle');
    return tN('sessionCompletedAlertTitle');
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

      <Dialog open={!!current} onOpenChange={(open) => { if (!open) onDismiss(); }}>
        <DialogContent maxWidth="sm" className="text-center">
          <DialogTitle className="sr-only">{accessibleTitle()}</DialogTitle>
          {current?.type === 'new_appointment' && (
            <NewAppointmentBody items={current.items} onDismiss={onDismiss} />
          )}
          {current?.type === 'appointment_status_change' && (
            <StatusChangeBody items={current.items} onDismiss={onDismiss} />
          )}
          {current?.type === 'session_completed' && (
            <SessionCompletedBody items={current.items} onDismiss={onDismiss} />
          )}
          {current?.type === 'reminder' && (
            <ReminderBody items={current.items} onDismiss={onDismiss} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
