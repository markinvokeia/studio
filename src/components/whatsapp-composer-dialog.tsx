'use client';

import * as React from 'react';
import { MessageCircle, Send, X } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useClinicInfo } from '@/hooks/useClinicInfo';
import { useCommunicationTemplates, substituteTokens } from '@/hooks/useCommunicationTemplates';
import { WHATSAPP_TEMPLATE_DEFAULTS } from '@/lib/whatsapp-template-defaults';

interface WhatsAppComposerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phone: string;
  recipientName?: string;
  treatmentContext?: { serviceName: string; missedStep: string; missedDate?: string };
}

export function WhatsAppComposerDialog({
  open,
  onOpenChange,
  phone,
  recipientName,
  treatmentContext,
}: WhatsAppComposerDialogProps) {
  const t = useTranslations('WhatsAppComposerDialog');
  const { toast } = useToast();

  const clinic = useClinicInfo();
  const commTemplates = useCommunicationTemplates();
  const [message, setMessage] = React.useState('');
  const [isOpening, setIsOpening] = React.useState(false);
  const normalizedPhone = React.useMemo(
    () => phone.trim().replace(/^\+/, '').replace(/\D/g, ''),
    [phone]
  );

  React.useEffect(() => {
    if (!open) { setMessage(''); setIsOpening(false); return; }
    const vars: Record<string, string> = {
      patient_name: recipientName || '',
      clinic_name: clinic?.name || '',
      clinic_phone: clinic?.phone || '',
      service_name: treatmentContext?.serviceName || '',
      missed_step: treatmentContext?.missedStep || '',
      missed_date: treatmentContext?.missedDate || '',
    };
    if (treatmentContext) {
      const tpl = commTemplates['TREATMENT_INTERRUPTED_WHATSAPP'];
      setMessage(substituteTokens(tpl?.body_text || WHATSAPP_TEMPLATE_DEFAULTS.whatsapp_treatment_interrupted, vars));
    } else {
      const tpl = commTemplates['PATIENT_GENERAL_WHATSAPP'];
      setMessage(substituteTokens(tpl?.body_text || WHATSAPP_TEMPLATE_DEFAULTS.whatsapp_patient_general, vars));
    }
  }, [open, clinic, commTemplates, recipientName, treatmentContext]);

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
      <DialogContent className="sm:max-w-lg" confirmOnClose isDirty={message.trim() !== ''}>
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
            <Label htmlFor="whatsapp-phone">{t('phone')}</Label>
            <Input id="whatsapp-phone" value={phone} readOnly className="bg-muted/50" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="whatsapp-message">{t('message')}</Label>
            <Textarea
              id="whatsapp-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={t('messagePlaceholder')}
              rows={6}
            />
          </div>
        </div>

        <DialogFooter>
          <DialogCancelButton variant="outline" disabled={isOpening}>
            <X className="h-4 w-4 mr-1" />
            {t('cancel')}
          </DialogCancelButton>
          <Button onClick={handleOpenWhatsApp} disabled={!normalizedPhone || isOpening}>
            <Send className="h-4 w-4 mr-1" />
            {isOpening ? t('opening') : t('open')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
