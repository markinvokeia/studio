'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ResizableSheet, SheetTitle, SheetDescription } from '@/components/ui/resizable-sheet';
import {
  PatientDetailSheetMainContent,
  type PatientSheetClinicalSubTab,
  type PatientSheetFinancialSubTab,
  type PatientSheetMacroTab,
  type PatientSheetManagementSubTab,
} from '@/components/patients/patient-detail-sheet-main-content';
import { Textarea } from '@/components/ui/textarea';
import { UserFinancialSummaryStats } from '@/components/users/user-financial-summary-stats';
import { AnamnesisViewer, ClinicHistoryViewer } from '@/components/users/clinic-history-viewer';
import { UserQuotes } from '@/components/users/user-quotes';
import { UserInvoices } from '@/components/users/user-invoices';
import { UserPayments } from '@/components/users/user-payments';
import { UserMessages } from '@/components/users/user-messages';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/services/api';
import { UserFinancial, User } from '@/lib/types';
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

type PatientDetailTab = 'clinical' | 'financial' | 'management';
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

function mapInitialTabToMacroTab(tab?: PatientDetailTab | LegacyPatientDetailTab): PatientDetailTab {
  switch (tab) {
    case 'quotes':
    case 'invoices':
    case 'payments':
    case 'financial':
      return 'financial';
    case 'appointments':
    case 'messages':
    case 'notes':
    case 'management':
      return 'management';
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
  const isDoctorMode = mode === 'doctor';
  const { toast } = useToast();
  const [financialData, setFinancialData] = React.useState<UserFinancial | null>(null);
  const [isStatsOpen, setIsStatsOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<PatientSheetMacroTab>(mapInitialTabToMacroTab(initialTab));
  const [activeClinicalSubTab, setActiveClinicalSubTab] = React.useState<PatientSheetClinicalSubTab>(clinicalHistoryDefaultView === 'anamnesis' ? 'anamnesis' : 'clinical-history');
  const [activeFinancialSubTab, setActiveFinancialSubTab] = React.useState<PatientSheetFinancialSubTab>(
    initialTab === 'invoices' ? 'invoices' : initialTab === 'payments' ? 'payments' : 'quotes'
  );
  const [activeManagementSubTab, setActiveManagementSubTab] = React.useState<PatientSheetManagementSubTab>(initialTab === 'notes' ? 'notes' : 'messages');
  const [allergies, setAllergies] = React.useState<AllergySummaryItem[]>([]);
  const [patientRecord, setPatientRecord] = React.useState<User | null>(null);
  const [notesDraft, setNotesDraft] = React.useState('');
  const [isEditingNotes, setIsEditingNotes] = React.useState(false);
  const [isSavingNotes, setIsSavingNotes] = React.useState(false);

  React.useEffect(() => {
    if (isDoctorMode) {
      setFinancialData(null);
      return;
    }
    if (!open || !userId) return;
    let active = true;
    api.get(API_ROUTES.USER_FINANCIAL, { user_id: userId })
      .then((data: any) => {
        if (!active) return;
        if (Array.isArray(data) && data.length > 0) setFinancialData(data[0] as UserFinancial);
        else setFinancialData(null);
      })
      .catch(() => { if (active) setFinancialData(null); });
    return () => { active = false; };
  }, [isDoctorMode, open, userId]);

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
    if (!isDoctorMode || !open || !userId) return;

    let active = true;

    api.get(API_ROUTES.USERS, { id: userId, filter_type: 'PACIENTE' })
      .then((data: any) => {
        if (!active) return;

        let rawUser: any = null;
        if (Array.isArray(data) && data.length > 0) {
          rawUser = data[0].json?.data?.[0] || data[0].data?.[0] || data[0] || null;
        } else if (data?.data) {
          rawUser = Array.isArray(data.data) ? data.data[0] : data.data;
        } else if (data?.json?.data) {
          rawUser = Array.isArray(data.json.data) ? data.json.data[0] : data.json.data;
        }

        if (!rawUser) {
          setPatientRecord(null);
          setNotesDraft('');
          return;
        }

        const mappedUser: User = {
          id: String(rawUser.id || userId),
          name: rawUser.name || userName,
          email: rawUser.email || '',
          phone_number: rawUser.phone_number || '',
          is_active: rawUser.is_active !== undefined ? rawUser.is_active : true,
          avatar: rawUser.avatar || '',
          identity_document: rawUser.identity_document || '',
          birth_date: rawUser.birth_date || '',
          notes: rawUser.notes || '',
          mutual_society_id: rawUser.mutual_society_id,
          is_dependent: rawUser.is_dependent ?? false,
          responsible_contact_id: rawUser.responsible_contact_id || undefined,
        };

        setPatientRecord(mappedUser);
        setNotesDraft(mappedUser.notes || '');
      })
      .catch(() => {
        if (!active) return;
        setPatientRecord(null);
        setNotesDraft('');
      });

    return () => {
      active = false;
    };
  }, [isDoctorMode, open, userId, userName]);

  React.useEffect(() => {
    setIsEditingNotes(false);
  }, [userId, open]);

  React.useEffect(() => {
    if (open) {
      setActiveTab(mapInitialTabToMacroTab(initialTab));
      setActiveClinicalSubTab(clinicalHistoryDefaultView === 'anamnesis' ? 'anamnesis' : 'clinical-history');
      setActiveFinancialSubTab(initialTab === 'invoices' ? 'invoices' : initialTab === 'payments' ? 'payments' : 'quotes');
      setActiveManagementSubTab(initialTab === 'notes' ? 'notes' : 'messages');
    }
  }, [clinicalHistoryDefaultView, initialTab, open, userId]);

  // Minimal User object for components that require it
  const user: User = React.useMemo(() => ({
    id: userId,
    name: userName,
    email: userEmail || '',
    phone_number: userPhone || '',
    is_active: true,
    avatar: '',
  }), [userId, userName, userEmail, userPhone]);

  const handleSaveNotes = React.useCallback(async () => {
    if (!patientRecord) return;

    setIsSavingNotes(true);
    try {
      await api.post(API_ROUTES.USERS_UPSERT, {
        id: patientRecord.id,
        name: patientRecord.name,
        email: patientRecord.email,
        phone: patientRecord.phone_number,
        identity_document: patientRecord.identity_document || '',
        birth_date: patientRecord.birth_date || '',
        notes: notesDraft,
        is_active: patientRecord.is_active,
        mutual_society_id: patientRecord.mutual_society_id && patientRecord.mutual_society_id !== 'none'
          ? patientRecord.mutual_society_id
          : null,
        is_dependent: patientRecord.is_dependent ?? false,
        responsible_contact_id: patientRecord.responsible_contact_id || null,
        filter_type: 'PACIENTE',
        is_sales: true,
      });

      setPatientRecord(prev => prev ? { ...prev, notes: notesDraft } : prev);
      setIsEditingNotes(false);
      toast({
        title: t('notes.saveSuccess'),
        description: t('notes.saveSuccessDescription'),
      });
    } catch {
      toast({
        variant: 'destructive',
        title: t('notes.saveError'),
        description: t('notes.saveErrorDescription'),
      });
    } finally {
      setIsSavingNotes(false);
    }
  }, [notesDraft, patientRecord, t, toast]);

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
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/8 shrink-0">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
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
          </div>
          {!isDoctorMode && (
            <div className="mt-3">
              <UserFinancialSummaryStats
                financialData={financialData}
                isOpen={isStatsOpen}
                onToggle={() => setIsStatsOpen(v => !v)}
                onPrint={() => {}}
              />
            </div>
          )}
        </div>

        <PatientDetailSheetMainContent
          activeTab={activeTab}
          onActiveTabChange={setActiveTab}
          activeClinicalSubTab={activeClinicalSubTab}
          onClinicalSubTabChange={setActiveClinicalSubTab}
          activeFinancialSubTab={activeFinancialSubTab}
          onFinancialSubTabChange={setActiveFinancialSubTab}
          activeManagementSubTab={activeManagementSubTab}
          onManagementSubTabChange={setActiveManagementSubTab}
          isDoctorMode={isDoctorMode}
          anamnesisContent={<AnamnesisViewer userId={userId} />}
          clinicalHistoryContent={<ClinicHistoryViewer userId={userId} userName={userName} deepLinkView={clinicalHistoryDefaultView} />}
          quotesContent={<UserQuotes userId={userId} />}
          invoicesContent={<UserInvoices userId={userId} />}
          paymentsContent={<UserPayments userId={userId} />}
          messagesContent={<UserMessages userId={userId} />}
          notesContent={
            <Card className="h-full flex flex-col shadow-none border-0">
              <CardHeader className="flex flex-row items-center justify-between flex-none p-4 pb-2">
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-lg text-foreground font-bold">{t('notes.title')}</CardTitle>
                  <CardDescription className="text-sm text-muted-foreground">
                    {t('notes.description')}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 ml-2">
                  {!isEditingNotes && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditingNotes(true)}
                      disabled={!patientRecord}
                    >
                      {t('notes.edit')}
                    </Button>
                  )}
                  {isEditingNotes && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setNotesDraft(patientRecord?.notes || '')
                          setIsEditingNotes(false)
                        }}
                        disabled={isSavingNotes}
                      >
                        {t('notes.cancel')}
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSaveNotes}
                        disabled={isSavingNotes || !patientRecord}
                      >
                        {isSavingNotes ? t('notes.saving') : t('notes.save')}
                      </Button>
                    </>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-auto p-4 pt-2 bg-card">
                {isEditingNotes ? (
                  <div className="h-full flex flex-col">
                    <Textarea
                      value={notesDraft}
                      onChange={(event) => setNotesDraft(event.target.value)}
                      placeholder={t('notes.placeholder')}
                      className="flex-1 min-h-[200px] resize-none"
                    />
                  </div>
                ) : (
                  <div className="h-full">
                    {patientRecord?.notes ? (
                      <div className="whitespace-pre-wrap text-sm leading-relaxed">
                        {patientRecord.notes}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        <p className="text-center mb-4">
                          {t('notes.noNotes')}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsEditingNotes(true)}
                          disabled={!patientRecord}
                        >
                          {t('notes.addFirstNote')}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          }
        />
      </div>
    </ResizableSheet>
  );
}
