'use client';

import * as React from 'react';
import { CakeIcon, CalendarClock, Loader2, Receipt, Send, X } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { format } from 'date-fns';
import { enUS, es } from 'date-fns/locale';

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
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/services/api';
import { API_ROUTES } from '@/constants/routes';
import { fetchFuturePatientAppointments, type FuturePatientAppointment } from '@/services/appointments';
import type { WhatsAppTemplateCode } from '@/lib/types';

interface WhatsAppTemplateSendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  patientName?: string;
  patientPhone?: string;
}

const TEMPLATE_ICONS: Record<WhatsAppTemplateCode, React.ElementType> = {
  birthday: CakeIcon,
  appointment_reminder: CalendarClock,
  invoice_due: Receipt,
};

export function WhatsAppTemplateSendDialog({
  open,
  onOpenChange,
  patientId,
  patientName,
  patientPhone,
}: WhatsAppTemplateSendDialogProps) {
  const t = useTranslations('WhatsAppTemplateSendDialog');
  const locale = useLocale();
  const dateLocale = locale === 'es' ? es : enUS;
  const { toast } = useToast();

  const [templateCode, setTemplateCode] = React.useState<WhatsAppTemplateCode | ''>('');
  const [appointments, setAppointments] = React.useState<FuturePatientAppointment[]>([]);
  const [appointmentsLoaded, setAppointmentsLoaded] = React.useState(false);
  const [isLoadingAppointments, setIsLoadingAppointments] = React.useState(false);
  const [appointmentId, setAppointmentId] = React.useState('');
  const [isSending, setIsSending] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setTemplateCode('');
      setAppointmentId('');
      setAppointments([]);
      setAppointmentsLoaded(false);
      setIsSending(false);
    }
  }, [open]);

  React.useEffect(() => {
    if (templateCode !== 'appointment_reminder' || appointmentsLoaded || !patientId) return;
    setIsLoadingAppointments(true);
    fetchFuturePatientAppointments(patientId)
      .then((rows) => {
        setAppointments(rows);
        setAppointmentsLoaded(true);
        if (rows.length === 1) setAppointmentId(rows[0].id);
      })
      .finally(() => setIsLoadingAppointments(false));
  }, [templateCode, appointmentsLoaded, patientId]);

  const canSend = !!patientPhone
    && !!templateCode
    && (templateCode !== 'appointment_reminder' || !!appointmentId)
    && !isSending;

  const handleSend = async () => {
    if (!canSend || !templateCode) return;
    setIsSending(true);
    try {
      await api.post(API_ROUTES.PATIENTS_SEND_WHATSAPP_TEMPLATE, {
        id: patientId,
        template_code: templateCode,
        appointment_id: templateCode === 'appointment_reminder' ? appointmentId : undefined,
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

  const templates: WhatsAppTemplateCode[] = ['birthday', 'appointment_reminder', 'invoice_due'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <Send className="h-4 w-4 text-primary" />
            {t('title')}
            {patientName ? <span className="text-muted-foreground font-normal">— {patientName}</span> : null}
          </DialogTitle>
          <DialogDescription className="pl-6">{t('description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-4">
          {!patientPhone && (
            <p className="text-xs text-destructive">{t('missingPhone')}</p>
          )}

          <div className="space-y-2">
            <Label>{t('templateLabel')}</Label>
            <RadioGroup value={templateCode} onValueChange={(v) => setTemplateCode(v as WhatsAppTemplateCode)}>
              {templates.map((code) => {
                const Icon = TEMPLATE_ICONS[code];
                return (
                  <label
                    key={code}
                    htmlFor={`wa-template-${code}`}
                    className={cn(
                      'flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors',
                      templateCode === code ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                    )}
                  >
                    <RadioGroupItem value={code} id={`wa-template-${code}`} />
                    <Icon className="h-4 w-4 text-muted-foreground flex-none" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-tight">{t(`templates.${code}.label`)}</p>
                      <p className="text-xs text-muted-foreground leading-tight">{t(`templates.${code}.description`)}</p>
                    </div>
                  </label>
                );
              })}
            </RadioGroup>
          </div>

          {templateCode === 'appointment_reminder' && (
            <div className="space-y-2">
              <Label>{t('appointmentLabel')}</Label>
              {isLoadingAppointments ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('loadingAppointments')}
                </div>
              ) : appointments.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">{t('noAppointments')}</p>
              ) : (
                <RadioGroup value={appointmentId} onValueChange={setAppointmentId} className="max-h-56 overflow-y-auto">
                  {appointments.map((appt) => (
                    <label
                      key={appt.id}
                      htmlFor={`wa-appt-${appt.id}`}
                      className={cn(
                        'flex items-center gap-3 rounded-lg border px-3 py-2 cursor-pointer transition-colors',
                        appointmentId === appt.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                      )}
                    >
                      <RadioGroupItem value={appt.id} id={`wa-appt-${appt.id}`} />
                      <div className="min-w-0 text-sm">
                        <p className="font-medium leading-tight capitalize">
                          {format(new Date(`${appt.date}T${appt.time}:00`), "EEEE d 'de' MMMM, HH:mm", { locale: dateLocale })}
                        </p>
                        <p className="text-xs text-muted-foreground leading-tight">
                          {appt.doctorName}{appt.room ? ` · ${appt.room}` : ''}
                        </p>
                      </div>
                    </label>
                  ))}
                </RadioGroup>
              )}
            </div>
          )}
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
