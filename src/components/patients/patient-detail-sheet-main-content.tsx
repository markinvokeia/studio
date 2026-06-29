'use client'

import * as React from 'react'
import { CreditCard, Stethoscope, Users } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { PatientSubTabNav } from '@/components/patients/patient-subtab-nav'
import { VerticalTabStrip } from '@/components/ui/vertical-tab-strip'
import type { VerticalTab } from '@/components/ui/vertical-tab-strip'

export type PatientSheetMacroTab = 'info' | 'clinical' | 'financial'
export type PatientSheetClinicalSubTab = 'anamnesis' | 'clinical-history' | 'treatment-plans' | 'documents'
export type PatientSheetFinancialSubTab = 'quotes' | 'invoices' | 'payments'

interface PatientDetailSheetMainContentProps {
  activeTab: PatientSheetMacroTab
  onActiveTabChange: (tab: PatientSheetMacroTab) => void
  activeClinicalSubTab: PatientSheetClinicalSubTab
  onClinicalSubTabChange: (tab: PatientSheetClinicalSubTab) => void
  activeFinancialSubTab: PatientSheetFinancialSubTab
  onFinancialSubTabChange: (tab: PatientSheetFinancialSubTab) => void
  isDoctorMode: boolean
  /** Patient details (demographics + edit). When provided, an "info" tab is shown first. */
  infoContent?: React.ReactNode
  anamnesisContent: React.ReactNode
  clinicalHistoryContent: React.ReactNode
  treatmentPlansContent: React.ReactNode
  documentsContent: React.ReactNode
  financialSummaryContent?: React.ReactNode
  quotesContent: React.ReactNode
  invoicesContent: React.ReactNode
  paymentsContent: React.ReactNode
}

export function PatientDetailSheetMainContent({
  activeTab,
  onActiveTabChange,
  activeClinicalSubTab,
  onClinicalSubTabChange,
  activeFinancialSubTab,
  onFinancialSubTabChange,
  isDoctorMode,
  infoContent,
  anamnesisContent,
  clinicalHistoryContent,
  treatmentPlansContent,
  documentsContent,
  financialSummaryContent,
  quotesContent,
  invoicesContent,
  paymentsContent,
}: PatientDetailSheetMainContentProps) {
  const t = useTranslations('UsersPage')

  const macroTabs = React.useMemo<VerticalTab[]>(() => {
    const infoTab: VerticalTab[] = infoContent ? [{ id: 'info', icon: Users, label: t('tabs.info') }] : []
    return isDoctorMode
      ? [...infoTab, { id: 'clinical', icon: Stethoscope, label: t('tabs.clinical') }]
      : [
          ...infoTab,
          { id: 'clinical', icon: Stethoscope, label: t('tabs.clinical') },
          { id: 'financial', icon: CreditCard, label: t('tabs.financial') },
        ]
  }, [isDoctorMode, infoContent, t])

  return (
    <div className="flex flex-col flex-1 overflow-hidden min-h-0">
      <VerticalTabStrip
        tabs={macroTabs}
        activeTabId={activeTab}
        onTabClick={(tab) => onActiveTabChange(tab.id as PatientSheetMacroTab)}
      />
      <div className="flex-1 overflow-auto min-h-0 p-3">
        {activeTab === 'info' && infoContent}

        {activeTab === 'clinical' && (
          <>
            <PatientSubTabNav
              tabs={[
                { id: 'anamnesis', label: t('tabs.anamnesis') },
                { id: 'clinical-history', label: t('tabs.history') },
                { id: 'treatment-plans', label: t('tabs.treatmentPlans') },
                { id: 'documents', label: t('tabs.documents') },
              ]}
              activeTab={activeClinicalSubTab}
              onChange={(id) => onClinicalSubTabChange(id as PatientSheetClinicalSubTab)}
            />
            {activeClinicalSubTab === 'anamnesis' && anamnesisContent}
            {activeClinicalSubTab === 'clinical-history' && clinicalHistoryContent}
            {activeClinicalSubTab === 'treatment-plans' && treatmentPlansContent}
            {activeClinicalSubTab === 'documents' && documentsContent}
          </>
        )}

        {activeTab === 'financial' && !isDoctorMode && (
          <div className="space-y-4">
            {financialSummaryContent}
            <PatientSubTabNav
              tabs={[
                { id: 'quotes', label: t('tabs.quotes') },
                { id: 'invoices', label: t('tabs.invoices') },
                { id: 'payments', label: t('tabs.payments') },
              ]}
              activeTab={activeFinancialSubTab}
              onChange={(id) => onFinancialSubTabChange(id as PatientSheetFinancialSubTab)}
            />
            {activeFinancialSubTab === 'quotes' && quotesContent}
            {activeFinancialSubTab === 'invoices' && invoicesContent}
            {activeFinancialSubTab === 'payments' && paymentsContent}
          </div>
        )}
      </div>
    </div>
  )
}
