'use client';

import * as React from 'react';
import { Loader2, MessageCircle, Send, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
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
import { useToast } from '@/hooks/use-toast';
import { api } from '@/services/api';
import { API_ROUTES } from '@/constants/routes';
import { AlertInstance } from '@/lib/types';

interface AlertWhatsAppComposerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alert: AlertInstance | null;
  /** CommunicationTemplate.code (type='WHATSAPP') resolved from the alert's rule — null if the rule has no template configured */
  templateCode: string | null;
  templateName?: string;
  /** Current user id — required by the backend when alert_instance_id is sent (alert_actions.performed_by is NOT NULL) */
  performedBy?: string;
}

function getAlertUserId(alert: AlertInstance | null): string {
  if (alert?.patient_id) return alert.patient_id;
  const id = alert?.details_json?.patient?.id ?? alert?.details_json?.patient_id;
  return typeof id === 'string' ? id : '';
}

function getPatientPhone(alert: AlertInstance | null): string {
  const phone = alert?.details_json?.patient?.phone || alert?.details_json?.patient?.phone_number;
  return typeof phone === 'string' ? phone.trim() : '';
}

function getRecipientName(alert: AlertInstance | null): string {
  const name = alert?.details_json?.patient?.full_name || alert?.patient_name;
  return typeof name === 'string' && name.trim() !== '' ? name : '';
}

export function AlertWhatsAppComposerDialog({ open, onOpenChange, alert, templateCode, templateName, performedBy }: AlertWhatsAppComposerDialogProps) {
  const t = useTranslations('AlertWhatsAppComposerDialog');
  const { toast } = useToast();

  const [isSending, setIsSending] = React.useState(false);

  React.useEffect(() => {
    if (!open) setIsSending(false);
  }, [open]);

  const patientId = React.useMemo(() => getAlertUserId(alert), [alert]);
  const phone = React.useMemo(() => getPatientPhone(alert), [alert]);
  const recipientName = React.useMemo(() => getRecipientName(alert), [alert]);

  const canSend = !!alert && !!patientId && !!phone && !!templateCode && !!performedBy && !isSending;

  const handleSend = async () => {
    if (!canSend || !alert || !templateCode) return;
    setIsSending(true);
    try {
      await api.post(API_ROUTES.PATIENTS_SEND_WHATSAPP_TEMPLATE, {
        id: patientId,
        template_code: templateCode,
        reference_table: alert.reference_table || undefined,
        reference_id: alert.reference_id || undefined,
        alert_instance_id: alert.id,
        performed_by: performedBy,
      });
      toast({ title: t('toast.sendSuccessTitle'), description: t('toast.sendSuccessDescription') });
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
      <DialogContent className="sm:max-w-md">
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
            {!phone ? <p className="text-xs text-destructive">{t('missingPhone')}</p> : null}
          </div>

          <div className="space-y-2">
            <Label>{t('templateLabel')}</Label>
            <Input value={templateName || templateCode || ''} readOnly className="bg-muted/50" />
            {!templateCode ? <p className="text-xs text-destructive">{t('missingTemplate')}</p> : null}
          </div>

          {!performedBy && templateCode ? (
            <p className="text-xs text-destructive">{t('missingPerformedBy')}</p>
          ) : null}
        </div>

        <DialogFooter>
          <DialogCancelButton variant="outline" disabled={isSending}>
            <X className="h-4 w-4 mr-1" />
            {t('cancel')}
          </DialogCancelButton>
          <Button onClick={handleSend} disabled={!canSend}>
            {isSending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
            {isSending ? t('sending') : t('send')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
