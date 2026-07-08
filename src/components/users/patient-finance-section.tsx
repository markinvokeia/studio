'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { PatientSubTabNav } from '@/components/patients/patient-subtab-nav';
import { PatientLedger } from '@/components/users/patient-ledger';
import { UserFinancialSummaryStats } from '@/components/users/user-financial-summary-stats';
import { UserInvoices } from '@/components/users/user-invoices';
import { UserPayments } from '@/components/users/user-payments';
import { UserQuotes } from '@/components/users/user-quotes';
import { API_ROUTES } from '@/constants/routes';
import { api } from '@/services/api';
import type { PatientFinanceView, Quote, UserFinancial } from '@/lib/types';

type FinanceTabsSubTab = 'quotes' | 'invoices' | 'payments';

interface PatientFinanceSectionProps {
  userId: string;
  viewMode: PatientFinanceView;
  /** Needed by the unified ledger's "Finalizado" credit-allocation payment (its
   *  `client_user` payload) — the tabs layout doesn't use either. */
  patientName?: string;
  patientEmail?: string;
  isSales?: boolean;
  refreshQuotesTrigger?: number;
  refreshInvoicesTrigger?: number;
  refreshPaymentsTrigger?: number;
  onCreateQuote?: () => void;
  onCreateTreatment?: () => void;
  onCreatePayment?: () => void;
  onPrintSummary?: () => void;
  onViewStatement?: () => void;
  /** Called after a quote/invoice change so the parent can refresh anything it derives (e.g. the patient list). */
  onDataChange?: () => void;
}

/**
 * Switches between the two patient finance layouts per the user's `finance_view`
 * preference (see /preferences): 'unified' — labeled "Clásico" to users — renders the
 * single-timeline `PatientLedger`; 'tabs' — labeled "Nuevo" — renders `FinanceTabsView`,
 * the separate Quotes/Invoices/Payments tabs. Mind the inversion: `finance_view` values
 * don't match their user-facing labels 1:1, so don't infer one from the other's name.
 */
export function PatientFinanceSection({
  userId,
  viewMode,
  patientName,
  patientEmail,
  isSales = true,
  refreshQuotesTrigger = 0,
  refreshInvoicesTrigger = 0,
  refreshPaymentsTrigger = 0,
  onCreateQuote,
  onCreateTreatment,
  onCreatePayment,
  onPrintSummary,
  onViewStatement,
  onDataChange,
}: PatientFinanceSectionProps) {
  if (viewMode === 'tabs') {
    return (
      <FinanceTabsView
        userId={userId}
        isSales={isSales}
        refreshQuotesTrigger={refreshQuotesTrigger}
        refreshInvoicesTrigger={refreshInvoicesTrigger}
        refreshPaymentsTrigger={refreshPaymentsTrigger}
        onPrintSummary={onPrintSummary}
        onViewStatement={onViewStatement}
        onDataChange={onDataChange}
      />
    );
  }

  return (
    <PatientLedger
      userId={userId}
      patientName={patientName}
      patientEmail={patientEmail}
      refreshTrigger={refreshQuotesTrigger + refreshInvoicesTrigger + refreshPaymentsTrigger}
      onCreateQuote={onCreateQuote}
      onCreateTreatment={onCreateTreatment}
      onCreatePayment={onCreatePayment}
      onPrintSummary={onPrintSummary}
      // No onViewStatement here — this IS the unified statement already, so the
      // "view statement" shortcut would just open a duplicate of itself. Only the
      // classic tabs view (which doesn't have a consolidated timeline) needs it.
    />
  );
}

function FinanceTabsView({
  userId,
  isSales,
  refreshQuotesTrigger,
  refreshInvoicesTrigger,
  refreshPaymentsTrigger,
  onPrintSummary,
  onViewStatement,
  onDataChange,
}: Omit<PatientFinanceSectionProps, 'viewMode' | 'onCreateQuote' | 'onCreateTreatment' | 'onCreatePayment'>) {
  const t = useTranslations('UsersPage');
  const [subTab, setSubTab] = React.useState<FinanceTabsSubTab>('quotes');
  const [selectedQuote, setSelectedQuote] = React.useState<Quote | null>(null);
  const [financialData, setFinancialData] = React.useState<UserFinancial | null>(null);
  const [isStatsOpen, setIsStatsOpen] = React.useState(true);

  React.useEffect(() => {
    if (!userId) return;
    let active = true;
    api.get(API_ROUTES.USER_FINANCIAL, { user_id: userId })
      .then((data: any) => {
        if (!active) return;
        setFinancialData(Array.isArray(data) && data.length > 0 ? (data[0] as UserFinancial) : null);
      })
      .catch(() => { if (active) setFinancialData(null); });
    return () => { active = false; };
  }, [userId, refreshQuotesTrigger, refreshInvoicesTrigger, refreshPaymentsTrigger]);

  const handleDataChange = React.useCallback(() => {
    onDataChange?.();
  }, [onDataChange]);

  return (
    <div className="space-y-4">
      <UserFinancialSummaryStats
        financialData={financialData}
        isOpen={isStatsOpen}
        onToggle={() => setIsStatsOpen((v) => !v)}
        onPrint={onPrintSummary ?? (() => {})}
        onViewStatement={onViewStatement}
      />
      <PatientSubTabNav
        tabs={[
          { id: 'quotes', label: t('tabs.quotes') },
          { id: 'invoices', label: t('tabs.invoices') },
          { id: 'payments', label: t('tabs.payments') },
        ]}
        activeTab={subTab}
        onChange={(id) => setSubTab(id as FinanceTabsSubTab)}
      />
      {subTab === 'quotes' && (
        <UserQuotes
          userId={userId}
          mode={isSales ? 'sales' : 'purchases'}
          onQuoteSelect={setSelectedQuote}
          refreshTrigger={refreshQuotesTrigger}
          onDataChange={handleDataChange}
        />
      )}
      {subTab === 'invoices' && (
        <UserInvoices
          userId={userId}
          mode={isSales ? 'sales' : 'purchases'}
          refreshTrigger={refreshInvoicesTrigger}
          onDataChange={handleDataChange}
        />
      )}
      {subTab === 'payments' && (
        <UserPayments
          userId={userId}
          mode={isSales ? 'sales' : 'purchases'}
          selectedQuote={selectedQuote}
          refreshTrigger={refreshPaymentsTrigger}
        />
      )}
    </div>
  );
}
