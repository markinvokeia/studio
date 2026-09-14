'use client';

import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ResizableSheet, SheetTitle, SheetDescription } from '@/components/ui/resizable-sheet';
import {
  PatientDetailSheetMainContent,
  type PatientSheetClinicalSubTab,
  type PatientSheetMacroTab,
} from '@/components/patients/patient-detail-sheet-main-content';
import { PatientInfoTab } from '@/components/patients/patient-info-tab';
import { PatientQuickActions } from '@/components/patients/patient-quick-actions';

import { InlineAppointmentDraftHost } from '@/components/appointments/inline-appointment-draft-host';
import { usePermissions } from '@/hooks/usePermissions';
import { CLINICAL_HISTORY_PERMISSIONS, MEDICAL_HISTORY_PERMISSIONS, PATIENTS_PERMISSIONS, PATIENT_FINANCIAL_VIEW_PERMISSIONS, TIMELINE_PERMISSIONS } from '@/constants/permissions';
import { AnamnesisViewer, ClinicHistoryViewer, DocumentsViewer } from '@/components/users/clinic-history-viewer';
import { PatientIndicationsTab } from '@/components/medical-instructions/patient-indications-tab';
import { UserTreatmentPlans } from '@/components/users/user-treatment-plans';
import { PatientFinanceSection } from '@/components/users/patient-finance-section';
import type { VisibleLedger } from '@/components/users/patient-ledger';
import { QuickTreatmentDialog } from '@/components/financial/quick-treatment-dialog';
import { PrepaidFormDialog } from '@/components/sales/payments/PrepaidFormDialog';
import { API_ROUTES } from '@/constants/routes';
import { api } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { useFinanceViewPreference } from '@/hooks/use-finance-view-preference';
import { usePrintDocument } from '@/hooks/usePrintDocument';
import { useToast } from '@/hooks/use-toast';
import { usePatientLedgerSheet } from '@/stores/patient-ledger-sheet-store';
import type { Appointment, User } from '@/lib/types';
import {
  AlertTriangle, Heart, Lock, Mail, Phone, Users,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

interface AllergySummaryItem {
  id?: number;
  alergeno: string;
  reaccion_descrita: string;
}

interface ConditionSummaryItem {
  id?: number;
  nombre: string;
}

type PatientDetailTab = 'info' | 'clinical' | 'financial';
type LegacyPatientDetailTab = 'clinical-history' | 'appointments' | 'messages' | 'notes' | 'quotes' | 'invoices' | 'payments';

interface PatientDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  userEmail?: string;
  userPhone?: string;
  mode?: 'default' | 'doctor';
  clinicalHistoryDefaultView?: 'anamnesis' | 'timeline' | 'documents';
  initialTab?: PatientDetailTab | LegacyPatientDetailTab;
  /** View-only mode: hides every add/edit/delete affordance across the clinical tabs. */
  readOnly?: boolean;
  /** Llamado cuando se guardan cambios en la pestaña "Información" (nombre, teléfono, responsable, etc.). */
  onPatientUpdated?: (user: User) => void;
}

function mapInitialTabToMacroTab(tab?: PatientDetailTab | LegacyPatientDetailTab): PatientSheetMacroTab {
  switch (tab) {
    case 'info':
      return 'info';
    case 'quotes':
    case 'invoices':
    case 'payments':
    case 'financial':
      return 'financial';
    case 'appointments':
    case 'messages':
    case 'notes':
      return 'clinical';
    case 'clinical-history':
    case 'clinical':
    default:
      return 'clinical';
  }
}

export function PatientDetailSheet({
  open,
  onOpenChange,
  userId,
  userName,
  userEmail,
  userPhone,
  mode = 'default',
  clinicalHistoryDefaultView,
  initialTab = 'clinical',
  readOnly = false,
  onPatientUpdated,
}: PatientDetailSheetProps) {
  const t = useTranslations('UsersPage');
  const { user: currentUser } = useAuth();
  const [financeView] = useFinanceViewPreference(currentUser?.id);
  const { open: openAccountStatement } = usePatientLedgerSheet();
  const { printLedger } = usePrintDocument();
  const { toast } = useToast();
  const [isPrintingFinancialSummary, setIsPrintingFinancialSummary] = React.useState(false);
  const isDoctorMode = mode === 'doctor';
  const { hasPermission, hasAnyPermission } = usePermissions();

  // This sheet is also reachable from the global quick view (header patient
  // search), which only requires PATIENTS_VIEW_LIST. Gate the non-clinical tabs
  // and clinical writes by permission so a clinical-only role (médico) sees the
  // same thing here as in the Patients module. `mode="doctor"` keeps forcing the
  // clinical-only layout regardless.
  const canViewInfoTab = hasPermission(PATIENTS_PERMISSIONS.VIEW_DETAIL_INFO);
  const canViewFinancialTab = hasAnyPermission([...PATIENT_FINANCIAL_VIEW_PERMISSIONS]);
  const canWriteClinical = hasAnyPermission([
    TIMELINE_PERMISSIONS.CREATE,
    TIMELINE_PERMISSIONS.UPDATE,
    CLINICAL_HISTORY_PERMISSIONS.ANAMNESIS_ADD_PERSONAL,
    CLINICAL_HISTORY_PERMISSIONS.DOCS_UPLOAD,
    CLINICAL_HISTORY_PERMISSIONS.ODONTOGRAM_REGISTER_SESSION,
  ]);

  const showInfoTab = !isDoctorMode && canViewInfoTab;
  const showFinancialTab = !isDoctorMode && canViewFinancialTab;
  // In doctor mode the workspace owns write access (it gates by appointment
  // date), so the permission check only applies to the default/quick-view mode.
  const isReadOnly = readOnly || (!isDoctorMode && !canWriteClinical);

  // Editar una cita desde la línea de tiempo. Permiso propio, independiente de
  // `isReadOnly`: eso gobierna la escritura clínica, que es otra cosa — la recepcionista
  // no tiene permisos clínicos y necesita poder reagendar igual. El modo doctor queda
  // afuera porque su rama de la línea de tiempo no ofrece la acción.
  const canManageAppointments = hasPermission(PATIENTS_PERMISSIONS.MANAGE_APPOINTMENTS);
  const [editingAppointment, setEditingAppointment] = React.useState<Appointment | null>(null);
  const [apptRefreshTrigger, setApptRefreshTrigger] = React.useState(0);

  const resolveInitialTab = React.useCallback((): PatientSheetMacroTab => {
    if (isDoctorMode) return 'clinical';
    const resolved = mapInitialTabToMacroTab(initialTab);
    if (resolved === 'info' && !showInfoTab) return 'clinical';
    if (resolved === 'financial' && !showFinancialTab) return 'clinical';
    return resolved;
  }, [initialTab, isDoctorMode, showInfoTab, showFinancialTab]);

  const [activeTab, setActiveTab] = React.useState<PatientSheetMacroTab>(resolveInitialTab);
  const [activeClinicalSubTab, setActiveClinicalSubTab] = React.useState<PatientSheetClinicalSubTab>(clinicalHistoryDefaultView === 'anamnesis' ? 'anamnesis' : 'clinical-history');
  // Trigger counters for clinical "create" actions launched from the actions menu.
  const [createSessionTrigger, setCreateSessionTrigger] = React.useState(0);
  const [createOdontogramTrigger, setCreateOdontogramTrigger] = React.useState(0);
  const [createDocumentTrigger, setCreateDocumentTrigger] = React.useState(0);
  const [createMedicalInstructionTrigger, setCreateMedicalInstructionTrigger] = React.useState(0);
  const [createPrescriptionTrigger, setCreatePrescriptionTrigger] = React.useState(0);
  const [allergies, setAllergies] = React.useState<AllergySummaryItem[]>([]);
  const [conditions, setConditions] = React.useState<ConditionSummaryItem[]>([]);

  // Finance quick actions — same lightweight dialogs the "Personalizado" ledger uses on the
  // patients list page; this sheet is the other place that view is reused from (e.g.
  // opened from the appointments page), so it needs the same "…" toolbar wired up.
  const [quickTreatmentDialogMode, setQuickTreatmentDialogMode] = React.useState<'quote' | 'invoice' | null>(null);
  const [isPrepaidDialogOpen, setIsPrepaidDialogOpen] = React.useState(false);
  const [refreshQuotesTrigger, setRefreshQuotesTrigger] = React.useState(0);
  const [refreshInvoicesTrigger, setRefreshInvoicesTrigger] = React.useState(0);
  const [refreshPaymentsTrigger, setRefreshPaymentsTrigger] = React.useState(0);
  const patientForDialogs: User = {
    id: userId,
    name: userName,
    email: userEmail || '',
    phone_number: userPhone || '',
    is_active: true,
    avatar: '',
  };

  // The account statement always prints as the unified ledger, whatever the user's
  // finance_view preference is, so it looks the same from every entry point in the app.
  // `visible` carries the ledger's active period filter when the print comes from the
  // unified layout; the tabs layout has no ledger and prints the whole statement.
  const handlePrintFinancialSummary = React.useCallback(async (visible?: VisibleLedger) => {
    if (isPrintingFinancialSummary) return;
    setIsPrintingFinancialSummary(true);
    try {
      await printLedger(userId, userName, visible);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: t('financialSummaryDialog.errorTitle'),
        description: error?.message === 'no_data' ? t('financialSummaryDialog.errorNoData') : t('financialSummaryDialog.errorGeneric'),
      });
    } finally {
      setIsPrintingFinancialSummary(false);
    }
  }, [userId, userName, isPrintingFinancialSummary, printLedger, toast, t]);

  React.useEffect(() => {
    if (!open || !userId) return;

    let active = true;

    api.get(API_ROUTES.CLINIC_HISTORY.ALLERGIES, { user_id: userId })
      .then((data: any) => {
        if (!active) return;
        const raw = Array.isArray(data) ? data : (data.antecedentes_alergias || data.data || []);
        setAllergies(raw.map((item: any) => ({
          id: Number(item.id) || undefined,
          alergeno: item.alergeno || 'N/A',
          reaccion_descrita: item.reaccion_descrita || '',
        })));
      })
      .catch(() => {
        if (active) setAllergies([]);
      });

    api.get(API_ROUTES.CLINIC_HISTORY.PERSONAL_HISTORY, { user_id: userId })
      .then((data: any) => {
        if (!active) return;
        const raw = Array.isArray(data) ? data : (data.antecedentes_personales || data.data || []);
        setConditions(raw.map((item: any) => ({
          id: Number(item.id ?? item.antecedente_id ?? item.antecedente_personal_id) || undefined,
          nombre: item.padecimiento_nombre || item.nombre || 'N/A',
        })));
      })
      .catch(() => {
        if (active) setConditions([]);
      });

    return () => {
      active = false;
    };
  }, [open, userId]);

  React.useEffect(() => {
    if (open) {
      setActiveTab(resolveInitialTab());
      setActiveClinicalSubTab(clinicalHistoryDefaultView === 'anamnesis' ? 'anamnesis' : 'clinical-history');
    }
  }, [clinicalHistoryDefaultView, resolveInitialTab, open, userId]);

  // The Finance tab's account statement needs the full width to render without horizontal
  // scroll — maximize the sheet whenever that tab becomes active (bumping the signal each
  // time so re-entering the tab re-maximizes; the user can still restore via the toggle).
  const [financeFullscreenSignal, setFinanceFullscreenSignal] = React.useState(0);
  React.useEffect(() => {
    if (open && activeTab === 'financial') setFinanceFullscreenSignal((n) => n + 1);
  }, [open, activeTab]);

  return (
    <ResizableSheet
      open={open}
      onOpenChange={onOpenChange}
      defaultWidth={900}
      minWidth={520}
      maxWidth={1300}
      storageKey="patient-detail-sheet-width"
      fullscreenSignal={financeFullscreenSignal}
    >
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex-none border-b border-border bg-card px-6 py-4 pr-14">
          <div className="flex items-center gap-3">
            {(() => {
              const hasAlerts = allergies.length > 0 || conditions.length > 0;
              const alertIcon = (
                <div className="relative flex-none">
                  {hasAlerts && (
                    <span
                      className="absolute inset-0 rounded-full animate-ping"
                      style={
                        allergies.length > 0
                          ? { backgroundColor: 'rgb(220 38 38)', opacity: 0.35 }
                          : { backgroundColor: 'rgb(217 119 6)', opacity: 0.35 }
                      }
                    />
                  )}
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-full relative shrink-0"
                    style={
                      allergies.length > 0
                        ? { backgroundColor: 'rgb(254 226 226)', color: 'rgb(220 38 38)' }
                        : conditions.length > 0
                          ? { backgroundColor: 'rgb(254 243 199)', color: 'rgb(217 119 6)' }
                          : { backgroundColor: 'rgb(var(--primary) / 0.08)', color: 'rgb(var(--primary))' }
                    }
                  >
                    {hasAlerts ? <AlertTriangle className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                  </div>
                </div>
              );

              return (
                <TooltipProvider>
                  {hasAlerts ? (
                    <Popover>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <PopoverTrigger asChild>
                            <button type="button" className="flex-none cursor-pointer">
                              {alertIcon}
                            </button>
                          </PopoverTrigger>
                        </TooltipTrigger>
                        <TooltipContent>
                          {[
                            allergies.length > 0 ? `${allergies.length} alergia(s)` : '',
                            conditions.length > 0 ? `${conditions.length} padecimiento(s)` : '',
                          ].filter(Boolean).join(' · ')}
                        </TooltipContent>
                      </Tooltip>
                      <PopoverContent align="start" className="w-64 p-3 space-y-3">
                        {allergies.length > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-xs font-semibold text-destructive uppercase tracking-wide flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Alergias
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {allergies.map((a, i) => (
                                <Badge key={a.id ?? i} variant="destructive" className="gap-1 text-xs font-normal">
                                  {a.alergeno}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {conditions.length > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide flex items-center gap-1">
                              <Heart className="h-3 w-3" />
                              Padecimientos
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {conditions.map((c, i) => (
                                <Badge key={c.id ?? i} variant="secondary" className="gap-1 text-xs font-normal bg-amber-100 text-amber-800 hover:bg-amber-100">
                                  {c.nombre}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        <button
                          className="text-xs text-primary hover:underline w-full text-left pt-1 border-t border-border"
                          onClick={() => { setActiveTab('clinical'); setActiveClinicalSubTab('anamnesis'); }}
                        >
                          Ver Anamnesis completa →
                        </button>
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex-none cursor-default">{alertIcon}</div>
                      </TooltipTrigger>
                      <TooltipContent>Sin alertas</TooltipContent>
                    </Tooltip>
                  )}
                </TooltipProvider>
              );
            })()}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 min-w-0">
                <SheetTitle className="text-base font-semibold truncate leading-tight">{userName}</SheetTitle>
                {isReadOnly && (
                  <Badge variant="secondary" className="gap-1 shrink-0 text-[10px] font-normal">
                    <Lock className="h-3 w-3" />
                    {t('readOnlyBadge')}
                  </Badge>
                )}
              </div>
              {!isDoctorMode && (
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  {userEmail && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Mail className="h-3 w-3" />
                      {userEmail}
                    </span>
                  )}
                  {userPhone && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      {userPhone}
                    </span>
                  )}
                </div>
              )}
              <SheetDescription className="sr-only">{t('detailsFor', { name: userName })}</SheetDescription>
            </div>
            {!isDoctorMode && canWriteClinical && (
              <div className="shrink-0">
                <PatientQuickActions
                  userId={userId}
                  userName={userName}
                  userEmail={userEmail}
                  userPhone={userPhone}
                  onCreateClinicalSession={() => { setActiveTab('clinical'); setActiveClinicalSubTab('clinical-history'); setCreateSessionTrigger((n) => n + 1); }}
                  onCreateOdontogram={() => { setActiveTab('clinical'); setActiveClinicalSubTab('clinical-history'); setCreateOdontogramTrigger((n) => n + 1); }}
                  onCreateMedicalInstruction={() => { setActiveTab('clinical'); setActiveClinicalSubTab('medical-instructions'); setCreateMedicalInstructionTrigger((n) => n + 1); }}
                  onCreatePrescription={() => { setActiveTab('clinical'); setActiveClinicalSubTab('medical-instructions'); setCreatePrescriptionTrigger((n) => n + 1); }}
                  onCreateDocument={() => { setActiveTab('clinical'); setActiveClinicalSubTab('documents'); setCreateDocumentTrigger((n) => n + 1); }}
                />
              </div>
            )}
          </div>
        </div>

        <PatientDetailSheetMainContent
          activeTab={activeTab}
          onActiveTabChange={setActiveTab}
          activeClinicalSubTab={activeClinicalSubTab}
          onClinicalSubTabChange={setActiveClinicalSubTab}
          showFinancial={showFinancialTab}
          infoContent={showInfoTab ? <PatientInfoTab userId={userId} onSaved={onPatientUpdated} /> : undefined}
          anamnesisContent={<AnamnesisViewer userId={userId} readOnly={isReadOnly} />}
          clinicalHistoryContent={<ClinicHistoryViewer userId={userId} userName={userName} deepLinkView={clinicalHistoryDefaultView} isDoctorMode={isDoctorMode} createSessionTrigger={createSessionTrigger} createOdontogramTrigger={createOdontogramTrigger} refreshAppointmentsTrigger={apptRefreshTrigger} onEditAppointment={canManageAppointments ? setEditingAppointment : undefined} readOnly={isReadOnly} />}
          treatmentPlansContent={<UserTreatmentPlans userId={userId} userName={userName} readOnly={isReadOnly} />}
          medicalInstructionsContent={<PatientIndicationsTab userId={userId} userName={userName} createTrigger={createMedicalInstructionTrigger} createPrescriptionTrigger={createPrescriptionTrigger} readOnly={isReadOnly} lockDoctor={isDoctorMode} />}
          documentsContent={<DocumentsViewer userId={userId} createTrigger={createDocumentTrigger} readOnly={isReadOnly} />}
          ledgerContent={
            <PatientFinanceSection
              userId={userId}
              patientName={userName}
              patientEmail={userEmail}
              viewMode={financeView}
              refreshQuotesTrigger={refreshQuotesTrigger}
              refreshInvoicesTrigger={refreshInvoicesTrigger}
              refreshPaymentsTrigger={refreshPaymentsTrigger}
              onCreateQuote={() => setQuickTreatmentDialogMode('quote')}
              onCreateTreatment={() => setQuickTreatmentDialogMode('invoice')}
              onCreatePayment={() => setIsPrepaidDialogOpen(true)}
              onPrintSummary={handlePrintFinancialSummary}
              onViewStatement={() => openAccountStatement(userId, userName)}
            />
          }
        />
      </div>

      {quickTreatmentDialogMode && (
        <QuickTreatmentDialog
          open={!!quickTreatmentDialogMode}
          onOpenChange={(o) => { if (!o) setQuickTreatmentDialogMode(null); }}
          mode={quickTreatmentDialogMode}
          patient={patientForDialogs}
          onSaveSuccess={() => {
            setActiveTab('financial');
            if (quickTreatmentDialogMode === 'quote') {
              setRefreshQuotesTrigger((n) => n + 1);
            } else {
              setRefreshInvoicesTrigger((n) => n + 1);
            }
          }}
        />
      )}

      <PrepaidFormDialog
        open={isPrepaidDialogOpen}
        onOpenChange={setIsPrepaidDialogOpen}
        initialUser={patientForDialogs}
        onSaveSuccess={() => {
          setIsPrepaidDialogOpen(false);
          setActiveTab('financial');
          setRefreshPaymentsTrigger((n) => n + 1);
        }}
      />

      {editingAppointment && (
        <InlineAppointmentDraftHost
          open
          appointment={editingAppointment}
          patient={patientForDialogs}
          onOpenChange={(open) => { if (!open) setEditingAppointment(null); }}
          onSaved={() => {
            setEditingAppointment(null);
            setApptRefreshTrigger((n) => n + 1);
          }}
        />
      )}
    </ResizableSheet>
  );
}
