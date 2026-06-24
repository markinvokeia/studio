'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { EmailComposerDialog } from '@/components/email-composer-dialog';
import { EMAIL_TEMPLATE_DEFAULTS } from '@/lib/email-template-defaults';
import { formatDate, formatDateTime } from '@/lib/utils';
import { AlertInstance } from '@/lib/types';

interface AlertEmailComposerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alert: AlertInstance | null;
}

function getPatientEmail(alert: AlertInstance | null): string {
  const email = alert?.details_json?.patient?.email;
  return typeof email === 'string' ? email.trim() : '';
}

function getRecipientName(alert: AlertInstance | null): string {
  const name = alert?.details_json?.patient?.full_name || alert?.patient_name;
  return typeof name === 'string' && name.trim() !== '' ? name : '';
}

function getAlertUserId(alert: AlertInstance | null): string {
  if (alert?.patient_id) return alert.patient_id;
  const id = alert?.details_json?.patient?.id ?? alert?.details_json?.patient_id;
  if (typeof id === 'string' && id.trim() !== '') return id;
  if (typeof id === 'number') return String(id);
  return '';
}

export function AlertEmailComposerDialog({ open, onOpenChange, alert }: AlertEmailComposerDialogProps) {
  const t = useTranslations('AlertEmailComposerDialog');

  const isAppointment = alert?.reference_table === 'appointments';
  const appt = alert?.details_json?.appointment;

  const templateCode = isAppointment ? 'APPOINTMENT_REMINDER_EMAIL' : 'ALERT_FOLLOWUP_EMAIL';
  const defaultSubject = isAppointment
    ? EMAIL_TEMPLATE_DEFAULTS.email_appointment_reminder.subject
    : EMAIL_TEMPLATE_DEFAULTS.email_alert_followup.subject;
  const defaultBody = isAppointment
    ? EMAIL_TEMPLATE_DEFAULTS.email_appointment_reminder.body
    : EMAIL_TEMPLATE_DEFAULTS.email_alert_followup.body;

  const templateVars = React.useMemo<Record<string, string>>(() => {
    const base: Record<string, string> = { patient_name: getRecipientName(alert) || t('unknownPatient') };
    if (isAppointment) {
      base.appointment_date = appt?.date || appt?.scheduled_date || formatDate(alert?.event_date);
      base.appointment_time = appt?.time || appt?.start_time     || '';
      base.doctor_name      = appt?.doctor_name || appt?.provider_name || '';
      base.location         = appt?.location    || '';
    } else {
      base.alert_title   = alert?.title    || '';
      base.alert_summary = alert?.summary  || '';
      base.alert_date    = alert?.alert_date ? formatDateTime(alert.alert_date) : '';
    }
    return base;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alert, isAppointment, appt, t]);

  return (
    <EmailComposerDialog
      open={open}
      onOpenChange={onOpenChange}
      to={getPatientEmail(alert)}
      userId={getAlertUserId(alert)}
      recipientName={getRecipientName(alert)}
      templateCode={templateCode}
      templateVars={templateVars}
      defaultSubject={defaultSubject}
      defaultBody={defaultBody}
      description={t('description')}
      missingToMessage={t('missingEmail')}
      missingUserIdMessage={t('missingUserId')}
    />
  );
}
