'use client';

import * as React from 'react';
import { MessageCircle, Send, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  useDialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useClinicInfo } from '@/hooks/useClinicInfo';
import { useCommunicationTemplates, substituteTokens } from '@/hooks/useCommunicationTemplates';
import { AlertInstance } from '@/lib/types';
import { WHATSAPP_TEMPLATE_DEFAULTS } from '@/lib/whatsapp-template-defaults';
import { formatDate, formatDateTime } from '@/lib/utils';

interface AlertWhatsAppComposerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alert: AlertInstance | null;
}

function getPatientPhone(alert: AlertInstance | null): string {
  const phone = alert?.details_json?.patient?.phone || alert?.details_json?.patient?.phone_number;
  return typeof phone === 'string' ? phone.trim() : '';
}

function getRecipientName(alert: AlertInstance | null): string {
  const name = alert?.details_json?.patient?.full_name || alert?.patient_name;
  return typeof name === 'string' && name.trim() !== '' ? name : '';
}

export function AlertWhatsAppComposerDialog({ open, onOpenChange, alert }: AlertWhatsAppComposerDialogProps) {
  const t = useTranslations('AlertWhatsAppComposerDialog');
  const { toast } = useToast();
  const handleClose = useDialogClose();
  const clinic = useClinicInfo();
  const commTemplates = useCommunicationTemplates();
  const [message, setMessage] = React.useState('');
  const [isOpening, setIsOpening] = React.useState(false);
  const userEdited = React.useRef(false);

  const phone         = React.useMemo(() => getPatientPhone(alert), [alert]);
  const recipientName = React.useMemo(() => getRecipientName(alert), [alert]);
  const normalizedPhone = React.useMemo(() => phone.trim().replace(/^\+/, '').replace(/\D/g, ''), [phone]);

  const isAppointment = alert?.reference_table === 'appointments';
  const appt = alert?.details_json?.appointment;

  React.useEffect(() => {
    if (!open) { setMessage(''); setIsOpening(false); userEdited.current = false; return; }
    if (userEdited.current) return;
    const vars: Record<string, string> = {
      patient_name: recipientName || t('unknownPatient'),
      clinic_name:  clinic?.name  || '',
      clinic_phone: clinic?.phone || '',
    };
    let tplCode: string;
    let defaultText: string;
    if (isAppointment) {
      vars.appointment_date = appt?.date || appt?.scheduled_date || formatDate(alert?.event_date);
      vars.appointment_time = appt?.time || appt?.start_time     || '';
      vars.doctor_name      = appt?.doctor_name || appt?.provider_name || '';
      vars.location         = appt?.location    || '';
      tplCode     = 'APPOINTMENT_REMINDER_WHATSAPP';
      defaultText = WHATSAPP_TEMPLATE_DEFAULTS.whatsapp_appointment_reminder;
    } else {
      vars.alert_title   = alert?.title   || '';
      vars.alert_summary = alert?.summary || '';
      vars.alert_date    = alert?.alert_date ? formatDateTime(alert.alert_date) : '';
      tplCode     = 'ALERT_FOLLOWUP_WHATSAPP';
      defaultText = WHATSAPP_TEMPLATE_DEFAULTS.whatsapp_alert_followup;
    }
    const tpl = commTemplates[tplCode];
    setMessage(substituteTokens(tpl?.body_text || defaultText, vars));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, alert, clinic, commTemplates, recipientName, isAppointment, t]);

  const handleOpenWhatsApp = async () => {
    if (!normalizedPhone || isOpening) return;

    setIsOpening(true);

    try {
      const url = `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank', 'noopener');
      onOpenChange(false);
    } catch {
      toast({
        variant: 'destructive',
        title: t('toast.openErrorTitle'),
        description: t('toast.openErrorDescription'),
      });
    } finally {
      setIsOpening(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" confirmOnClose isDirty={userEdited.current}>
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-primary" />
            {t('title')}
            {recipientName ? <span className="text-muted-foreground font-normal">— {recipientName}</span> : null}
          </DialogTitle>
          <DialogDescription className="pl-6">{t('description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="alert-whatsapp-phone">{t('phone')}</Label>
            <Input id="alert-whatsapp-phone" value={phone} readOnly className="bg-muted/50" />
            {!normalizedPhone ? <p className="text-xs text-destructive">{t('missingPhone')}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="alert-whatsapp-message">{t('message')}</Label>
            <Textarea
              id="alert-whatsapp-message"
              value={message}
              onChange={(event) => { setMessage(event.target.value); userEdited.current = true; }}
              placeholder={t('messagePlaceholder')}
              rows={7}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isOpening}>
            <X className="h-4 w-4 mr-1" />
            {t('cancel')}
          </Button>
          <Button onClick={handleOpenWhatsApp} disabled={!normalizedPhone || isOpening}>
            <Send className="h-4 w-4 mr-1" />
            {isOpening ? t('opening') : t('open')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
