'use client';

import * as React from 'react';
import { Mail, Send, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
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
import { formatDateTime } from '@/lib/utils';
import { api } from '@/services/api';

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

  const patientId = alert?.details_json?.patient?.id;
  if (typeof patientId === 'string' && patientId.trim() !== '') return patientId;
  if (typeof patientId === 'number') return String(patientId);

  const detailsPatientId = alert?.details_json?.patient_id;
  if (typeof detailsPatientId === 'string' && detailsPatientId.trim() !== '') return detailsPatientId;
  if (typeof detailsPatientId === 'number') return String(detailsPatientId);

  return '';
}

function buildInitialSubject(alert: AlertInstance | null, t: (key: string, values?: Record<string, string>) => string): string {
  if (!alert?.title) return t('subjectFallback');
  return t('subjectTemplate', { title: alert.title });
}

function buildInitialBody(alert: AlertInstance | null, t: (key: string, values?: Record<string, string>) => string): string {
  if (!alert) return '';

  const recipientName = getRecipientName(alert) || t('unknownPatient');
  const clinicName = alert.details_json?.clinic?.name;
  const lines: string[] = [
    t('template.greeting', { name: recipientName }),
    '',
    t('template.intro'),
    `${t('template.alertTitle')}: ${alert.title}`,
  ];

  if (alert.summary) {
    lines.push(`${t('template.summary')}: ${alert.summary}`);
  }

  if (alert.alert_date) {
    lines.push(`${t('template.alertDate')}: ${formatDateTime(alert.alert_date)}`);
  }

  if (alert.event_date) {
    lines.push(`${t('template.eventDate')}: ${formatDateTime(alert.event_date)}`);
  }

  if (typeof clinicName === 'string' && clinicName.trim() !== '') {
    lines.push(`${t('template.clinicName')}: ${clinicName}`);
  }

  lines.push('', t('template.closing'));

  return lines.join('\n');
}

export function AlertEmailComposerDialog({ open, onOpenChange, alert }: AlertEmailComposerDialogProps) {
  const t = useTranslations('AlertEmailComposerDialog');
  const { toast } = useToast();
  const [subject, setSubject] = React.useState('');
  const [body, setBody] = React.useState('');
  const [isSending, setIsSending] = React.useState(false);

  const recipientEmail = React.useMemo(() => getPatientEmail(alert), [alert]);
  const recipientName = React.useMemo(() => getRecipientName(alert), [alert]);
  const userId = React.useMemo(() => getAlertUserId(alert), [alert]);

  React.useEffect(() => {
    if (!open) {
      setSubject('');
      setBody('');
      setIsSending(false);
      return;
    }

    setSubject(buildInitialSubject(alert, t));
    setBody(buildInitialBody(alert, t));
  }, [open, alert, t]);

  const handleSend = async () => {
    if (!recipientEmail || !subject || !body || !userId || isSending) return;

    setIsSending(true);

    try {
      await api.post(API_ROUTES.USERS_SEND_EMAIL, {
        emails: [recipientEmail],
        subject,
        body: body.replace(/\n/g, '<br/>'),
        user_id: userId,
      });

      toast({
        title: t('toast.sendSuccessTitle'),
        description: t('toast.sendSuccessDescription'),
      });

      onOpenChange(false);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('toast.sendErrorTitle'),
        description: error instanceof Error ? error.message : t('toast.sendErrorDescription'),
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
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
              onChange={(event) => setSubject(event.target.value)}
              placeholder={t('subjectPlaceholder')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="alert-email-body">{t('body')}</Label>
            <Textarea
              id="alert-email-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={10}
              placeholder={t('bodyPlaceholder')}
            />
          </div>

          {!userId ? <p className="text-xs text-destructive">{t('missingUserId')}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
            <X className="h-4 w-4 mr-1" />
            {t('cancel')}
          </Button>
          <Button onClick={handleSend} disabled={!recipientEmail || !subject || !body || !userId || isSending}>
            <Send className="h-4 w-4 mr-1" />
            {isSending ? t('sending') : t('send')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
