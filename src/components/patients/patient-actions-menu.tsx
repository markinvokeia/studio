'use client';

import * as React from 'react';
import { addMonths, format } from 'date-fns';
import { CalendarIcon, CheckCircle, ChevronDown, CreditCard, FileText, Loader2, Mail, MoreHorizontal, Plus, Receipt, SlidersHorizontal, Smile, Stethoscope, ToggleLeft, Upload, XCircle, Zap } from 'lucide-react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DatePickerInput } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { WhatsAppIcon } from '@/components/icons/whatsapp-icon';
import { EmailComposerDialog } from '@/components/email-composer-dialog';
import { WhatsAppComposerDialog } from '@/components/whatsapp-composer-dialog';
import { QuoteFormDialog } from '@/components/sales/quotes/QuoteFormDialog';
import { InvoiceFormDialog } from '@/components/tables/invoices-table';
import { PrepaidFormDialog } from '@/components/sales/payments/PrepaidFormDialog';
import { AppointmentFormDialog } from '@/components/appointments/AppointmentFormDialog';
import { UserCommunicationPreferences } from '@/components/users/user-communication-preferences';
import { fetchPatientById } from '@/components/patients/patient-info-tab';
import { fetchReassignCalendars, fetchReassignDoctors } from '@/lib/appointment-reassign';
import { useBillingWizard } from '@/stores/billing-wizard-store';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/services/api';
import { API_ROUTES } from '@/constants/routes';
import type { Calendar as CalendarType, PatientDischarge, User } from '@/lib/types';

interface PatientActionsMenuProps {
  userId: string;
  userName: string;
  userEmail?: string;
  userPhone?: string;
  /** Called when the patient is updated (status, etc.) so hosts can refresh. */
  onPatientChanged?: () => void;
  /** Clinical "create" actions — provided by hosts that own the clinical tab (e.g. the quick view). */
  onCreateClinicalSession?: () => void;
  onCreateOdontogram?: () => void;
  onCreateDocument?: () => void;
}

/**
 * Reusable "Create" + "More actions" menus for a patient, with their dialogs
 * self-hosted. Mirrors the actions offered on the Patients page so any place that
 * shows the patient quick view exposes the same options.
 */
export function PatientActionsMenu({ userId, userName, userEmail, userPhone, onPatientChanged, onCreateClinicalSession, onCreateOdontogram, onCreateDocument }: PatientActionsMenuProps) {
  const hasClinicalCreate = !!(onCreateClinicalSession || onCreateOdontogram || onCreateDocument);
  const t = useTranslations();
  const { toast } = useToast();
  const { open: openBillingWizard } = useBillingWizard();

  const [patient, setPatient] = React.useState<User | null>(null);
  const [currentDischarge, setCurrentDischarge] = React.useState<PatientDischarge | null>(null);

  const [isQuoteOpen, setIsQuoteOpen] = React.useState(false);
  const [isInvoiceOpen, setIsInvoiceOpen] = React.useState(false);
  const [isPrepaidOpen, setIsPrepaidOpen] = React.useState(false);
  const [isAppointmentOpen, setIsAppointmentOpen] = React.useState(false);
  const [isEmailOpen, setIsEmailOpen] = React.useState(false);
  const [isWhatsAppOpen, setIsWhatsAppOpen] = React.useState(false);
  const [isPreferencesOpen, setIsPreferencesOpen] = React.useState(false);

  // Discharge dialog
  const [isDischargeOpen, setIsDischargeOpen] = React.useState(false);
  const [dischargeDate, setDischargeDate] = React.useState('');
  const [dischargePreset, setDischargePreset] = React.useState<number | null>(null);
  const [isSubmittingDischarge, setIsSubmittingDischarge] = React.useState(false);

  // Lazily-loaded appointment options
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
    <TooltipProvider>
      <div className="flex items-center gap-1">
        {/* Create */}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <button type="button" className="flex items-center justify-center gap-1.5 h-8 px-2 sm:px-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-xs font-medium">
                  <Plus className="sm:hidden h-4 w-4 flex-none" />
                  <span className="hidden sm:inline">Crear</span>
                  <ChevronDown className="hidden sm:block h-3 w-3 flex-none" />
                </button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>Crear</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="w-48">
            {hasClinicalCreate && (
              <>
                <DropdownMenuLabel className="text-xs text-muted-foreground">Clínico</DropdownMenuLabel>
                {onCreateClinicalSession && (
                  <DropdownMenuItem onClick={onCreateClinicalSession}>
                    <Stethoscope className="h-4 w-4 mr-2 text-primary" />Sesión clínica
                  </DropdownMenuItem>
                )}
                {onCreateOdontogram && (
                  <DropdownMenuItem onClick={onCreateOdontogram}>
                    <Smile className="h-4 w-4 mr-2 text-purple-600" />Sesión de odontograma
                  </DropdownMenuItem>
                )}
                {onCreateDocument && (
                  <DropdownMenuItem onClick={onCreateDocument}>
                    <Upload className="h-4 w-4 mr-2 text-primary" />Documento
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuLabel className="text-xs text-muted-foreground">Financiero</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => openBillingWizard({ patientId: userId, patientName: userName })}>
              <Zap className="h-4 w-4 mr-2 text-emerald-600" />Cobro rápido
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setIsQuoteOpen(true)}>
              <FileText className="h-4 w-4 mr-2 text-emerald-600" />Presupuesto
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setIsInvoiceOpen(true)}>
              <Receipt className="h-4 w-4 mr-2 text-emerald-600" />Factura
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setIsPrepaidOpen(true)}>
              <CreditCard className="h-4 w-4 mr-2 text-emerald-600" />Prepago
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">Agenda</DropdownMenuLabel>
            <DropdownMenuItem onClick={openAppointment}>
              <CalendarIcon className="h-4 w-4 mr-2 text-blue-600" />Cita
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* More actions */}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <button type="button" className="flex items-center justify-center gap-1.5 h-8 px-2 sm:px-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-xs font-medium">
                  <MoreHorizontal className="sm:hidden h-4 w-4 flex-none" />
                  <span className="hidden sm:inline">Más acciones</span>
                  <ChevronDown className="hidden sm:block h-3 w-3 flex-none" />
                </button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>Más acciones</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="w-52">
            {(userEmail || userPhone) && (
              <>
                <DropdownMenuLabel className="text-xs text-muted-foreground">Comunicación</DropdownMenuLabel>
                {userEmail && (
                  <DropdownMenuItem onClick={() => setIsEmailOpen(true)}>
                    <Mail className="h-4 w-4 mr-2" />Enviar email
                  </DropdownMenuItem>
                )}
                {userPhone && (
                  <DropdownMenuItem onClick={() => setIsWhatsAppOpen(true)}>
                    <WhatsAppIcon className="h-4 w-4 mr-2" />WhatsApp
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuLabel className="text-xs text-muted-foreground">Estado</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={currentDischarge ? handleCancelDischarge : () => setIsDischargeOpen(true)}
              disabled={isSubmittingDischarge}
            >
              {currentDischarge ? <XCircle className="h-4 w-4 mr-2 text-green-600" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              {currentDischarge ? t('UsersPage.readmitButton') : t('UsersPage.dischargeButton')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleToggleActivate}>
              <ToggleLeft className={`h-4 w-4 mr-2 ${basePatient.is_active ? 'text-destructive' : 'text-green-600'}`} />
              {basePatient.is_active ? t('UserColumns.deactivate') : t('UserColumns.activate')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">Configuración</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setIsPreferencesOpen(true)}>
              <SlidersHorizontal className="h-4 w-4 mr-2" />{t('UsersPage.preferencesButton')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Dialogs */}
      <QuoteFormDialog
        open={isQuoteOpen}
        onOpenChange={setIsQuoteOpen}
        initialData={{ user: basePatient }}
        onSaveSuccess={() => setIsQuoteOpen(false)}
      />
      <InvoiceFormDialog
        isOpen={isInvoiceOpen}
        onOpenChange={setIsInvoiceOpen}
        onInvoiceCreated={() => setIsInvoiceOpen(false)}
        isSales
        initialUser={basePatient}
      />
      <PrepaidFormDialog
        open={isPrepaidOpen}
        onOpenChange={setIsPrepaidOpen}
        initialUser={basePatient}
        onSaveSuccess={() => { setIsPrepaidOpen(false); onPatientChanged?.(); }}
      />
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

      {/* Preferences */}
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

      {/* Discharge */}
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
    </TooltipProvider>
  );
}
