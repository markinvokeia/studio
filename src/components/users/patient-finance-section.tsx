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

type ClassicSubTab = 'quotes' | 'invoices' | 'payments';

interface PatientFinanceSectionProps {
  userId: string;
  viewMode: PatientFinanceView;
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
 * Switches between the unified account ledger and the legacy Quotes/Invoices/Payments
 * tabs, per the user's `finance_view` preference (see /preferences).
 */
export function PatientFinanceSection({
  userId,
  viewMode,
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
      <ClassicFinanceTabs
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

function ClassicFinanceTabs({
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
  const [subTab, setSubTab] = React.useState<ClassicSubTab>('quotes');
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
        onChange={(id) => setSubTab(id as ClassicSubTab)}
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
