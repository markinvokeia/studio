'use client';

import * as React from 'react';
import { addMonths, format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DatePickerInput } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import { EmailComposerDialog } from '@/components/email-composer-dialog';
import { WhatsAppComposerDialog } from '@/components/whatsapp-composer-dialog';
import { WhatsAppTemplateSendDialog } from '@/components/patients/whatsapp-template-send-dialog';
import { QuoteFormDialog } from '@/components/sales/quotes/QuoteFormDialog';
import { InvoiceFormDialog } from '@/components/tables/invoices-table';
import { PrepaidFormDialog } from '@/components/sales/payments/PrepaidFormDialog';
import { AppointmentFormDialog } from '@/components/appointments/AppointmentFormDialog';
import { UserCommunicationPreferences } from '@/components/users/user-communication-preferences';
import { PatientActionsMenu } from '@/components/patients/patient-actions-menu';
import { fetchPatientById } from '@/components/patients/patient-form-utils';
import { fetchReassignCalendars, fetchReassignDoctors } from '@/lib/appointment-reassign';
import { useBillingWizard } from '@/stores/billing-wizard-store';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { api } from '@/services/api';
import { API_ROUTES } from '@/constants/routes';
import { BUSINESS_CONFIG_PERMISSIONS, PATIENTS_PERMISSIONS, SALES_PERMISSIONS } from '@/constants/permissions';
import type { Calendar as CalendarType, PatientDischarge, User } from '@/lib/types';

interface PatientQuickActionsProps {
  userId: string;
  userName: string;
  userEmail?: string;
  userPhone?: string;
  onPatientChanged?: () => void;
  onCreateClinicalSession?: () => void;
  onCreateOdontogram?: () => void;
  onCreateMedicalInstruction?: () => void;
  onCreatePrescription?: () => void;
  onCreateDocument?: () => void;
}

/**
 * Self-contained patient actions for the quick view: renders the shared
 * PatientActionsMenu and hosts every dialog it triggers. Open from anywhere with
 * only the patient's identity.
 */
export function PatientQuickActions({ userId, userName, userEmail, userPhone, onPatientChanged, onCreateClinicalSession, onCreateOdontogram, onCreateMedicalInstruction, onCreatePrescription, onCreateDocument }: PatientQuickActionsProps) {
  const t = useTranslations();
  const { toast } = useToast();
  const { open: openBillingWizard } = useBillingWizard();
  const { hasPermission, hasAnyPermission } = usePermissions();
  const canSendWhatsAppTemplate = hasPermission(PATIENTS_PERMISSIONS.SEND_WHATSAPP_TEMPLATE);

  // These actions were previously unconditional. Gate them so a clinical-only
  // role (médico) never gets billing/agenda/status actions from the quick view.
  const canQuickBill = hasAnyPermission([SALES_PERMISSIONS.INVOICES_CREATE, SALES_PERMISSIONS.PAYMENTS_CREATE]);
  const canCreateQuote = hasPermission(SALES_PERMISSIONS.QUOTES_CREATE);
  const canCreateInvoice = hasPermission(SALES_PERMISSIONS.INVOICES_CREATE);
  const canCreatePrepaid = hasPermission(SALES_PERMISSIONS.PREPAYMENTS_CREATE);
  const canCreateAppointment = hasPermission(BUSINESS_CONFIG_PERMISSIONS.APPOINTMENT_CREATE);
  const canUpdatePatient = hasPermission(PATIENTS_PERMISSIONS.UPDATE);
  const canViewInfo = hasPermission(PATIENTS_PERMISSIONS.VIEW_DETAIL_INFO);

  const [patient, setPatient] = React.useState<User | null>(null);
  const [currentDischarge, setCurrentDischarge] = React.useState<PatientDischarge | null>(null);

  const [isQuoteOpen, setIsQuoteOpen] = React.useState(false);
  const [isInvoiceOpen, setIsInvoiceOpen] = React.useState(false);
  const [isPrepaidOpen, setIsPrepaidOpen] = React.useState(false);
  const [isAppointmentOpen, setIsAppointmentOpen] = React.useState(false);
  const [isEmailOpen, setIsEmailOpen] = React.useState(false);
  const [isWhatsAppOpen, setIsWhatsAppOpen] = React.useState(false);
  const [isWhatsAppTemplateOpen, setIsWhatsAppTemplateOpen] = React.useState(false);
  const [isPreferencesOpen, setIsPreferencesOpen] = React.useState(false);

  const [isDischargeOpen, setIsDischargeOpen] = React.useState(false);
  const [dischargeDate, setDischargeDate] = React.useState('');
  const [dischargePreset, setDischargePreset] = React.useState<number | null>(null);
  const [isSubmittingDischarge, setIsSubmittingDischarge] = React.useState(false);

  const [apptCalendars, setApptCalendars] = React.useState<CalendarType[]>([]);
  const [apptDoctors, setApptDoctors] = React.useState<User[]>([]);
  const [apptLoaded, setApptLoaded] = React.useState(false);

  const basePatient: User = patient ?? {
    id: userId, name: userName, email: userEmail || '', phone_number: userPhone || '', is_active: true, avatar: '',
  };

  const fetchDischarge = React.useCallback(async () => {
    try {
      const data = await api.get(API_ROUTES.PATIENT_DISCHARGE, { id: userId });
      setCurrentDischarge(data?.appointment_date
        ? { id: data.id, user_id: userId, appointment_date: data.appointment_date, created_at: data.created_at }
        : null);
    } catch {
      setCurrentDischarge(null);
    }
  }, [userId]);

  React.useEffect(() => {
    let active = true;
    fetchPatientById(userId).then((u) => { if (active && u) setPatient(u); });
    fetchDischarge();
    return () => { active = false; };
  }, [userId, fetchDischarge]);

  const openAppointment = async () => {
    if (!apptLoaded) {
      const [calendars, doctors] = await Promise.all([fetchReassignCalendars(), fetchReassignDoctors()]);
      setApptCalendars(calendars);
      setApptDoctors(doctors);
      setApptLoaded(true);
    }
    setIsAppointmentOpen(true);
  };

  const handleToggleActivate = async () => {
    try {
      const nextActive = !basePatient.is_active;
      await api.put(API_ROUTES.USERS_ACTIVATE, { user_id: userId, is_active: nextActive });
      toast({ title: t(nextActive ? 'UserColumns.activateSuccess' : 'UserColumns.deactivateSuccess') });
      setPatient((prev) => (prev ? { ...prev, is_active: nextActive } : prev));
      onPatientChanged?.();
    } catch {
      toast({ variant: 'destructive', title: t('UserColumns.toggleStatusError') });
    }
  };

  const handleSaveDischarge = async () => {
    if (!dischargeDate) return;
    setIsSubmittingDischarge(true);
    try {
      await api.post(API_ROUTES.PATIENT_DISCHARGE, { id: userId, appointment_date: dischargeDate });
      toast({ title: t('ClinicHistoryPage.discharge.toast.success') });
      setIsDischargeOpen(false);
      setDischargeDate('');
      setDischargePreset(null);
      fetchDischarge();
      onPatientChanged?.();
    } catch (error: any) {
      toast({ variant: 'destructive', title: t('ClinicHistoryPage.discharge.toast.error'), description: error?.message || '' });
    } finally {
      setIsSubmittingDischarge(false);
    }
  };

  const handleCancelDischarge = async () => {
    setIsSubmittingDischarge(true);
    try {
      await api.post(API_ROUTES.PATIENT_DISCHARGE_CANCEL, { id: userId });
      toast({ title: t('ClinicHistoryPage.discharge.toast.cancelSuccess') });
      setCurrentDischarge(null);
      onPatientChanged?.();
    } catch (error: any) {
      toast({ variant: 'destructive', title: t('ClinicHistoryPage.discharge.toast.cancelError'), description: error?.message || '' });
    } finally {
      setIsSubmittingDischarge(false);
    }
  };

  return (
    <>
      <PatientActionsMenu
        isActive={basePatient.is_active}
        hasDischarge={!!currentDischarge}
        hasEmail={!!userEmail}
        hasPhone={!!userPhone}
        isBusy={isSubmittingDischarge}
        onCreateClinicalSession={onCreateClinicalSession}
        onCreateOdontogram={onCreateOdontogram}
        onCreateMedicalInstruction={onCreateMedicalInstruction}
        onCreatePrescription={onCreatePrescription}
        onCreateDocument={onCreateDocument}
        onQuickBill={canQuickBill ? () => openBillingWizard({ patientId: userId, patientName: userName }) : undefined}
        onCreateQuote={canCreateQuote ? () => setIsQuoteOpen(true) : undefined}
        onCreateInvoice={canCreateInvoice ? () => setIsInvoiceOpen(true) : undefined}
        onCreatePrepaid={canCreatePrepaid ? () => setIsPrepaidOpen(true) : undefined}
        onCreateAppointment={canCreateAppointment ? openAppointment : undefined}
        onEmail={() => setIsEmailOpen(true)}
        onWhatsApp={() => setIsWhatsAppOpen(true)}
        onSendWhatsAppTemplate={canSendWhatsAppTemplate ? () => setIsWhatsAppTemplateOpen(true) : undefined}
        onToggleDischarge={canUpdatePatient ? (currentDischarge ? handleCancelDischarge : () => setIsDischargeOpen(true)) : undefined}
        onToggleActivate={handleToggleActivate}
        onPreferences={canViewInfo && canUpdatePatient ? () => setIsPreferencesOpen(true) : undefined}
      />

      {/* Dialogs */}
      <QuoteFormDialog open={isQuoteOpen} onOpenChange={setIsQuoteOpen} initialData={{ user: basePatient }} onSaveSuccess={() => { setIsQuoteOpen(false); onPatientChanged?.(); }} />
      <InvoiceFormDialog isOpen={isInvoiceOpen} onOpenChange={setIsInvoiceOpen} onInvoiceCreated={() => { setIsInvoiceOpen(false); onPatientChanged?.(); }} isSales initialUser={basePatient} />
      <PrepaidFormDialog open={isPrepaidOpen} onOpenChange={setIsPrepaidOpen} initialUser={basePatient} onSaveSuccess={() => { setIsPrepaidOpen(false); onPatientChanged?.(); }} />
      <AppointmentFormDialog
        open={isAppointmentOpen}
        onOpenChange={setIsAppointmentOpen}
        initialData={{ user: basePatient }}
        readOnlyFields={{ user: true }}
        calendars={apptCalendars}
        doctors={apptDoctors}
        onSaveSuccess={() => { setIsAppointmentOpen(false); onPatientChanged?.(); }}
      />
      {userEmail && (
        <EmailComposerDialog open={isEmailOpen} onOpenChange={setIsEmailOpen} to={userEmail} userId={userId} recipientName={userName} />
      )}
      {userPhone && (
        <WhatsAppComposerDialog open={isWhatsAppOpen} onOpenChange={setIsWhatsAppOpen} phone={userPhone} recipientName={userName} />
      )}
      {userPhone && (
        <WhatsAppTemplateSendDialog
          open={isWhatsAppTemplateOpen}
          onOpenChange={setIsWhatsAppTemplateOpen}
          patientId={userId}
          patientName={userName}
          patientPhone={userPhone}
        />
      )}

      <Dialog open={isPreferencesOpen} onOpenChange={setIsPreferencesOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{t('UserCommunicationPreferences.title')}</DialogTitle>
            <DialogDescription>{t('UserCommunicationPreferences.description')}</DialogDescription>
          </DialogHeader>
          <DialogBody className="px-6 py-4">
            <UserCommunicationPreferences user={basePatient} autoSave compact />
          </DialogBody>
        </DialogContent>
      </Dialog>

      <Dialog open={isDischargeOpen} onOpenChange={setIsDischargeOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t('ClinicHistoryPage.discharge.dialogTitle')}</DialogTitle>
            <DialogDescription>{t('ClinicHistoryPage.discharge.dialogDescription')}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-6 px-6 py-4">
            <div className="space-y-3">
              <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                {t('ClinicHistoryPage.discharge.optionsLabel')}
              </Label>
              <div className="flex flex-wrap gap-2">
                {([1, 3, 6, 12] as const).map((months) => (
                  <Button
                    key={months}
                    variant={dischargePreset === months ? 'default' : 'secondary'}
                    size="sm"
                    className="rounded-full"
                    onClick={() => { setDischargeDate(format(addMonths(new Date(), months), 'yyyy-MM-dd')); setDischargePreset(months); }}
                  >
                    {months === 1 ? t('ClinicHistoryPage.discharge.option1Month')
                      : months === 3 ? t('ClinicHistoryPage.discharge.option3Months')
                      : months === 6 ? t('ClinicHistoryPage.discharge.option6Months')
                      : t('ClinicHistoryPage.discharge.option1Year')}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-3 pt-2">
              <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                {t('ClinicHistoryPage.discharge.dateLabel')}
              </Label>
              <DatePickerInput
                value={dischargeDate}
                onChange={(value) => { setDischargeDate(value); setDischargePreset(null); }}
                placeholder={t('ClinicHistoryPage.discharge.datePlaceholder')}
                disabledDays={(date: Date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button className="px-8" onClick={handleSaveDischarge} disabled={!dischargeDate || isSubmittingDischarge}>
              {isSubmittingDischarge ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {t('ClinicHistoryPage.discharge.saveButton')}
            </Button>
            <Button variant="outline" onClick={() => { setIsDischargeOpen(false); setDischargeDate(''); setDischargePreset(null); }}>
              {t('ClinicHistoryPage.discharge.cancelButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
