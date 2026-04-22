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
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { AlertInstance } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';

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

function buildInitialMessage(alert: AlertInstance | null, t: (key: string, values?: Record<string, string>) => string): string {
  if (!alert) return '';

  const recipientName = getRecipientName(alert) || t('unknownPatient');
  const lines: string[] = [
    t('template.greeting', { name: recipientName }),
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

  lines.push('', t('template.closing'));
  return lines.join('\n');
}

export function AlertWhatsAppComposerDialog({ open, onOpenChange, alert }: AlertWhatsAppComposerDialogProps) {
  const t = useTranslations('AlertWhatsAppComposerDialog');
  const { toast } = useToast();
  const [message, setMessage] = React.useState('');
  const [isOpening, setIsOpening] = React.useState(false);

  const phone = React.useMemo(() => getPatientPhone(alert), [alert]);
  const recipientName = React.useMemo(() => getRecipientName(alert), [alert]);
  const normalizedPhone = React.useMemo(() => phone.trim().replace(/^\+/, '').replace(/\D/g, ''), [phone]);

  React.useEffect(() => {
    if (!open) {
      setMessage('');
      setIsOpening(false);
      return;
    }

    setMessage(buildInitialMessage(alert, t));
  }, [open, alert, t]);

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
      <DialogContent className="sm:max-w-lg">
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
              onChange={(event) => setMessage(event.target.value)}
              placeholder={t('messagePlaceholder')}
              rows={7}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isOpening}>
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
