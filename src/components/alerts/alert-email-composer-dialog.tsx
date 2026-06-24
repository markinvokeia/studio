'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { EmailComposerDialog } from '@/components/email-composer-dialog';
import { EMAIL_TEMPLATE_DEFAULTS } from '@/lib/email-template-defaults';
import { formatDate, formatDateTime } from '@/lib/utils';
import {
  Dialog,
  DialogCancelButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
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
  const { toast } = useToast();
  const [subject, setSubject] = React.useState('');
  const [body, setBody] = React.useState('');
  const [isSending, setIsSending] = React.useState(false);
  const [hasEdited, setHasEdited] = React.useState(false);

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
      base.appointment_time = appt?.time || appt?.start_time || '';
      base.doctor_name = appt?.doctor_name || appt?.provider_name || '';
      base.location = appt?.location || '';
    } else {
      base.alert_title = alert?.title || '';
      base.alert_summary = alert?.summary || '';
      base.alert_date = alert?.alert_date ? formatDateTime(alert.alert_date) : '';
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl" confirmOnClose isDirty={hasEdited}>
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            {t('title')}
            {recipientName ? <span className="text-muted-foreground font-normal">— {recipientName}</span> : null}
          </DialogTitle>
          <DialogDescription className="pl-6">{t('description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="alert-email-to">{t('to')}</Label>
            <Input id="alert-email-to" value={recipientEmail} readOnly className="bg-muted/50" />
            {!recipientEmail ? <p className="text-xs text-destructive">{t('missingEmail')}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="alert-email-subject">{t('subject')}</Label>
            <Input
              id="alert-email-subject"
              value={subject}
              onChange={(event) => { setSubject(event.target.value); setHasEdited(true); }}
              placeholder={t('subjectPlaceholder')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="alert-email-body">{t('body')}</Label>
            <Textarea
              id="alert-email-body"
              value={body}
              onChange={(event) => { setBody(event.target.value); setHasEdited(true); }}
              rows={10}
              placeholder={t('bodyPlaceholder')}
            />
          </div>

          {!userId ? <p className="text-xs text-destructive">{t('missingUserId')}</p> : null}
        </div>

        <DialogFooter>
          <DialogCancelButton variant="outline" disabled={isSending}>
            <X className="h-4 w-4 mr-1" />
            {t('cancel')}
          </DialogCancelButton>
          <Button onClick={handleSend} disabled={!recipientEmail || !subject || !body || !userId || isSending}>
            <Send className="h-4 w-4 mr-1" />
            {isSending ? t('sending') : t('send')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
