'use client';

import * as React from 'react';
import { AlertTriangle, MessageCircle, Send, X } from 'lucide-react';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { useClinicInfo } from '@/hooks/useClinicInfo';
import { useCommunicationTemplates, substituteTokens } from '@/hooks/useCommunicationTemplates';
import { AlertInstance } from '@/lib/types';
import { WHATSAPP_TEMPLATE_DEFAULTS } from '@/lib/whatsapp-template-defaults';
import { sendWhatsAppTemplate, toE164 } from '@/lib/whatsapp-send';
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

function parseVariablesSchema(schema: any): string[] {
  const value = typeof schema === 'string' ? (() => { try { return JSON.parse(schema); } catch { return null; } })() : schema;
  return Array.isArray(value) ? value.filter((v) => typeof v === 'string') : [];
}

export function AlertWhatsAppComposerDialog({ open, onOpenChange, alert }: AlertWhatsAppComposerDialogProps) {
  const t = useTranslations('AlertWhatsAppComposerDialog');
  const { toast } = useToast();
  const { user } = useAuth();

  const clinic = useClinicInfo();
  const commTemplates = useCommunicationTemplates();
  const [manualVars, setManualVars] = React.useState<Record<string, string>>({});
  const [isSending, setIsSending] = React.useState(false);

  const phone = React.useMemo(() => getPatientPhone(alert), [alert]);
  const recipientName = React.useMemo(() => getRecipientName(alert), [alert]);
  const e164Phone = React.useMemo(() => toE164(phone), [phone]);

  const isAppointment = alert?.reference_table === 'appointments';
  const appt = alert?.details_json?.appointment;
  const templateCode = isAppointment ? 'APPOINTMENT_REMINDER_WHATSAPP' : 'ALERT_FOLLOWUP_WHATSAPP';
  const template = commTemplates[templateCode];
  const variablesSchema = React.useMemo(() => parseVariablesSchema(template?.variables_schema), [template]);
  const isApproved = template?.meta_status === 'APPROVED';

  const autoVars = React.useMemo<Record<string, string>>(() => {
    const vars: Record<string, string> = {
      patient_name: recipientName || t('unknownPatient'),
      clinic_name: clinic?.name || '',
      clinic_phone: clinic?.phone || '',
    };
    if (isAppointment) {
      vars.appointment_date = appt?.date || appt?.scheduled_date || formatDate(alert?.event_date);
      vars.appointment_time = appt?.time || appt?.start_time || '';
      vars.doctor_name = appt?.doctor_name || appt?.provider_name || '';
      vars.location = appt?.location || '';
    } else {
      vars.alert_title = alert?.title || '';
      vars.alert_summary = alert?.summary || '';
      vars.alert_date = alert?.alert_date ? formatDateTime(alert.alert_date) : '';
    }
    return vars;
  }, [alert, clinic, recipientName, isAppointment, appt, t]);

  React.useEffect(() => {
    if (!open) { setManualVars({}); setIsSending(false); }
  }, [open]);

  const manualKeys = variablesSchema.filter((key) => !autoVars[key]?.trim());
  const resolvedVars = { ...autoVars, ...manualVars };

  const fallbackBody = isAppointment
    ? WHATSAPP_TEMPLATE_DEFAULTS.whatsapp_appointment_reminder
    : WHATSAPP_TEMPLATE_DEFAULTS.whatsapp_alert_followup;
  const previewText = substituteTokens(template?.body_text || fallbackBody, resolvedVars);

  const canSend = !!e164Phone && !!template && isApproved && !!user?.id && manualKeys.every((key) => resolvedVars[key]?.trim());

  const handleSend = async () => {
    if (!canSend || !e164Phone || !template?.meta_template_name || !template?.meta_language || !user?.id || isSending) return;

    setIsSending(true);
    try {
      const parameters = variablesSchema.map((key) => resolvedVars[key] || '');
      const result = await sendWhatsAppTemplate({
        phone: e164Phone,
        meta_template_name: template.meta_template_name,
        meta_language: template.meta_language,
        parameters,
        alert_instance_id: alert?.id ? Number(alert.id) : undefined,
        performed_by: user.id,
      });

      if (result.success) {
        toast({ title: t('toast.sendSuccessTitle'), description: t('toast.sendSuccessDescription') });
        onOpenChange(false);
      } else {
        toast({ variant: 'destructive', title: t('toast.sendErrorTitle'), description: result.message });
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" confirmOnClose isDirty={Object.values(manualVars).some((v) => v.trim() !== '')}>
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
            {!phone ? (
              <p className="text-xs text-destructive">{t('missingPhone')}</p>
            ) : !e164Phone ? (
              <p className="text-xs text-destructive">{t('invalidPhoneError')}</p>
            ) : null}
          </div>

          {!template ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{t('noTemplateTitle')}</AlertTitle>
              <AlertDescription>{t('noTemplateDescription')}</AlertDescription>
            </Alert>
          ) : !isApproved ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{t('notApprovedTitle')}</AlertTitle>
              <AlertDescription>{t('notApprovedDescription')}</AlertDescription>
            </Alert>
          ) : null}

          {manualKeys.length > 0 && (
            <div className="space-y-2">
              <Label>{t('variablesTitle')}</Label>
              {manualKeys.map((key) => (
                <Input
                  key={key}
                  value={manualVars[key] || ''}
                  onChange={(event) => setManualVars((prev) => ({ ...prev, [key]: event.target.value }))}
                  placeholder={key}
                />
              ))}
            </div>
          )}

          <div className="space-y-2">
            <Label>{t('preview')}</Label>
            <div className="rounded-md border bg-muted p-3 text-sm whitespace-pre-wrap min-h-[100px]">
              {previewText}
            </div>
          </div>
        </div>

        <DialogFooter>
          <DialogCancelButton variant="outline" disabled={isSending}>
            <X className="h-4 w-4 mr-1" />
            {t('cancel')}
          </DialogCancelButton>
          <Button onClick={handleSend} disabled={!canSend || isSending}>
            <Send className="h-4 w-4 mr-1" />
            {isSending ? t('sending') : t('send')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
