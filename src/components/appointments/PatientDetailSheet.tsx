'use client';

import { Badge } from '@/components/ui/badge';
import { ResizableSheet, SheetTitle, SheetDescription } from '@/components/ui/resizable-sheet';
import {
  PatientDetailSheetMainContent,
  type PatientSheetClinicalSubTab,
  type PatientSheetMacroTab,
} from '@/components/patients/patient-detail-sheet-main-content';
import { PatientInfoTab } from '@/components/patients/patient-info-tab';
import { PatientQuickActions } from '@/components/patients/patient-quick-actions';
import { AnamnesisViewer, ClinicHistoryViewer, DocumentsViewer } from '@/components/users/clinic-history-viewer';
import { PatientInstructionsSection } from '@/components/medical-instructions/patient-instructions-section';
import { UserTreatmentPlans } from '@/components/users/user-treatment-plans';
import { PatientFinanceSection } from '@/components/users/patient-finance-section';
import { QuickTreatmentDialog } from '@/components/financial/quick-treatment-dialog';
import { PrepaidFormDialog } from '@/components/sales/payments/PrepaidFormDialog';
import { API_ROUTES } from '@/constants/routes';
import { api } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { useFinanceViewPreference } from '@/hooks/use-finance-view-preference';
import { usePrintDocument } from '@/hooks/usePrintDocument';
import { useToast } from '@/hooks/use-toast';
import { usePatientLedgerSheet } from '@/stores/patient-ledger-sheet-store';
import type { User } from '@/lib/types';
import {
  AlertTriangle, Mail, Phone, Users,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

interface AllergySummaryItem {
  id?: number;
  alergeno: string;
  reaccion_descrita: string;
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
}: PatientDetailSheetProps) {
  const t = useTranslations('UsersPage');
  const { user: currentUser } = useAuth();
  const [financeView] = useFinanceViewPreference(currentUser?.id);
  const { open: openAccountStatement } = usePatientLedgerSheet();
  const { printFinancialSummary, printLedger } = usePrintDocument();
  const { toast } = useToast();
  const [isPrintingFinancialSummary, setIsPrintingFinancialSummary] = React.useState(false);
  const isDoctorMode = mode === 'doctor';
  const [activeTab, setActiveTab] = React.useState<PatientSheetMacroTab>(
    isDoctorMode ? 'clinical' : mapInitialTabToMacroTab(initialTab)
  );
  const [activeClinicalSubTab, setActiveClinicalSubTab] = React.useState<PatientSheetClinicalSubTab>(clinicalHistoryDefaultView === 'anamnesis' ? 'anamnesis' : 'clinical-history');
  // Trigger counters for clinical "create" actions launched from the actions menu.
  const [createSessionTrigger, setCreateSessionTrigger] = React.useState(0);
  const [createOdontogramTrigger, setCreateOdontogramTrigger] = React.useState(0);
  const [createDocumentTrigger, setCreateDocumentTrigger] = React.useState(0);
  const [allergies, setAllergies] = React.useState<AllergySummaryItem[]>([]);

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

  // "Personalizado" prints the unified ledger as shown; "Normal" prints the backend's
  // financial-summary report — same split PatientLedgerSheet's own Print button uses.
  const handlePrintFinancialSummary = React.useCallback(async () => {
    if (isPrintingFinancialSummary) return;
    setIsPrintingFinancialSummary(true);
    try {
      if (financeView === 'unified') {
        await printLedger(userId, userName);
      } else {
        await printFinancialSummary(userId);
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: t('financialSummaryDialog.errorTitle'),
        description: error?.message === 'no_data' ? t('financialSummaryDialog.errorNoData') : t('financialSummaryDialog.errorGeneric'),
      });
    } finally {
      setIsPrintingFinancialSummary(false);
    }
  }, [userId, userName, isPrintingFinancialSummary, financeView, printLedger, printFinancialSummary, toast, t]);

  React.useEffect(() => {
    if (!isDoctorMode || !open || !userId) return;

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

    return () => {
      active = false;
    };
  }, [isDoctorMode, open, userId]);

  React.useEffect(() => {
    if (open) {
      setActiveTab(isDoctorMode ? 'clinical' : mapInitialTabToMacroTab(initialTab));
      setActiveClinicalSubTab(clinicalHistoryDefaultView === 'anamnesis' ? 'anamnesis' : 'clinical-history');
    }
  }, [clinicalHistoryDefaultView, initialTab, isDoctorMode, open, userId]);

  return (
    <ResizableSheet
      open={open}
      onOpenChange={onOpenChange}
      defaultWidth={900}
      minWidth={520}
      maxWidth={1300}
      storageKey="patient-detail-sheet-width"
    >
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex-none border-b border-border bg-card px-6 py-4 pr-14">
          <div className="flex items-center gap-3">
            <div className="relative flex-none">
              {isDoctorMode && allergies.length > 0 && (
                <span
                  className="absolute inset-0 rounded-full animate-ping"
                  style={{ backgroundColor: 'rgb(220 38 38)', opacity: 0.35 }}
                />
              )}
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full relative shrink-0"
                style={
                  isDoctorMode && allergies.length > 0
                    ? { backgroundColor: 'rgb(254 226 226)', color: 'rgb(220 38 38)' }
                    : { backgroundColor: 'rgb(var(--primary) / 0.08)', color: 'rgb(var(--primary))' }
                }
              >
                {isDoctorMode && allergies.length > 0
                  ? <AlertTriangle className="h-4 w-4" />
                  : <Users className="h-4 w-4" />
                }
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-base font-semibold truncate leading-tight">{userName}</SheetTitle>
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
              {isDoctorMode && allergies.length > 0 && (
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  {allergies.slice(0, 3).map((allergy, index) => (
                    <Badge key={allergy.id ?? `${allergy.alergeno}-${index}`} variant="destructive" className="gap-1 text-xs font-normal">
                      <AlertTriangle className="h-3 w-3" />
                      {allergy.alergeno}
                    </Badge>
                  ))}
                  {allergies.length > 3 && (
                    <span className="text-xs text-primary">
                      +{allergies.length - 3} más
                    </span>
                  )}
                </div>
              )}
              <SheetDescription className="sr-only">{t('detailsFor', { name: userName })}</SheetDescription>
            </div>
            {!isDoctorMode && (
              <div className="shrink-0">
                <PatientQuickActions
                  userId={userId}
                  userName={userName}
                  userEmail={userEmail}
                  userPhone={userPhone}
                  onCreateClinicalSession={() => { setActiveTab('clinical'); setActiveClinicalSubTab('clinical-history'); setCreateSessionTrigger((n) => n + 1); }}
                  onCreateOdontogram={() => { setActiveTab('clinical'); setActiveClinicalSubTab('clinical-history'); setCreateOdontogramTrigger((n) => n + 1); }}
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
          isDoctorMode={isDoctorMode}
          infoContent={!isDoctorMode ? <PatientInfoTab userId={userId} /> : undefined}
          anamnesisContent={<AnamnesisViewer userId={userId} />}
          clinicalHistoryContent={<ClinicHistoryViewer userId={userId} userName={userName} deepLinkView={clinicalHistoryDefaultView} isDoctorMode={isDoctorMode} createSessionTrigger={createSessionTrigger} createOdontogramTrigger={createOdontogramTrigger} />}
          treatmentPlansContent={<UserTreatmentPlans userId={userId} userName={userName} />}
          medicalInstructionsContent={<PatientInstructionsSection userId={userId} userName={userName} />}
          documentsContent={<DocumentsViewer userId={userId} createTrigger={createDocumentTrigger} />}
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
    </ResizableSheet>
  );
}
