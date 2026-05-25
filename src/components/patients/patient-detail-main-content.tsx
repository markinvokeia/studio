'use client'

import * as React from 'react'
import { CreditCard, SlidersHorizontal, Stethoscope } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { VerticalTabStrip } from '@/components/ui/vertical-tab-strip'
import type { VerticalTab } from '@/components/ui/vertical-tab-strip'
import { PatientSubTabNav } from '@/components/patients/patient-subtab-nav'

export type PatientMacroTab = 'clinical' | 'financial' | 'management'
export type ClinicalSubTab = 'summary' | 'anamnesis' | 'clinical-history' | 'treatment-plans' | 'documents' | 'services'
export type FinancialSubTab = 'summary' | 'quotes' | 'invoices' | 'payments'
export type ManagementSubTab = 'messages' | 'notes' | 'logs'

interface PatientDetailMainContentProps {
  activeTab: PatientMacroTab
  onActiveTabChange: (tab: PatientMacroTab) => void
  activeClinicalSubTab: ClinicalSubTab
  onClinicalSubTabChange: (tab: ClinicalSubTab) => void
  activeFinancialSubTab: FinancialSubTab
  onFinancialSubTabChange: (tab: FinancialSubTab) => void
  activeManagementSubTab: ManagementSubTab
  onManagementSubTabChange: (tab: ManagementSubTab) => void
  showDocuments: boolean
  showServices: boolean
  summaryContent: React.ReactNode
  anamnesisContent: React.ReactNode
  clinicalHistoryContent: React.ReactNode
  treatmentPlansContent: React.ReactNode
  documentsContent?: React.ReactNode
  servicesContent?: React.ReactNode
  financialSummaryContent: React.ReactNode
  quotesContent: React.ReactNode
  invoicesContent: React.ReactNode
  paymentsContent: React.ReactNode
  messagesContent: React.ReactNode
  notesContent: React.ReactNode
  logsContent: React.ReactNode
}

export function PatientDetailMainContent({
  activeTab,
  onActiveTabChange,
  activeClinicalSubTab,
  onClinicalSubTabChange,
  activeFinancialSubTab,
  onFinancialSubTabChange,
  activeManagementSubTab,
  onManagementSubTabChange,
  showDocuments,
  showServices,
  summaryContent,
  anamnesisContent,
  clinicalHistoryContent,
  treatmentPlansContent,
  documentsContent,
  servicesContent,
  financialSummaryContent,
  quotesContent,
  invoicesContent,
  paymentsContent,
  messagesContent,
  notesContent,
  logsContent,
}: PatientDetailMainContentProps) {
  const t = useTranslations('UsersPage')

  const macroTabs = React.useMemo<VerticalTab[]>(() => [
    { id: 'clinical', icon: Stethoscope, label: t('tabs.clinical') },
    { id: 'financial', icon: CreditCard, label: t('tabs.financial') },
    { id: 'management', icon: SlidersHorizontal, label: t('tabs.management') },
  ], [t])

  const clinicalTabs = React.useMemo(() => [
    { id: 'summary', label: t('tabs.summary') },
    { id: 'anamnesis', label: t('tabs.anamnesis') },
    { id: 'clinical-history', label: t('tabs.history') },
    { id: 'treatment-plans', label: t('tabs.treatmentPlans') },
    ...(showDocuments ? [{ id: 'documents', label: t('tabs.documents') }] : []),
    ...(showServices ? [{ id: 'services', label: t('tabs.services') }] : []),
  ], [showDocuments, showServices, t])

  const financialTabs = React.useMemo(() => [
    { id: 'summary', label: t('tabs.summary') },
    { id: 'quotes', label: t('tabs.quotes') },
    { id: 'invoices', label: t('tabs.invoices') },
    { id: 'payments', label: t('tabs.payments') },
  ], [t])

  const managementTabs = React.useMemo(() => [
    { id: 'messages', label: t('tabs.messages') },
    { id: 'notes', label: t('tabs.notes') },
    { id: 'logs', label: t('tabs.logs') },
  ], [t])

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <VerticalTabStrip
        tabs={macroTabs}
        activeTabId={activeTab}
        onTabClick={(tab) => onActiveTabChange(tab.id as PatientMacroTab)}
      />
      <div className="flex-1 overflow-y-auto px-0 pt-4 pb-8 sm:px-3 sm:py-3">
        {activeTab === 'clinical' && (
          <>
            <PatientSubTabNav
              tabs={clinicalTabs}
              activeTab={activeClinicalSubTab}
              onChange={(id) => onClinicalSubTabChange(id as ClinicalSubTab)}
            />
            {activeClinicalSubTab === 'summary' && summaryContent}
            {activeClinicalSubTab === 'anamnesis' && anamnesisContent}
            {activeClinicalSubTab === 'clinical-history' && clinicalHistoryContent}
            {activeClinicalSubTab === 'treatment-plans' && treatmentPlansContent}
            {activeClinicalSubTab === 'documents' && documentsContent}
            {activeClinicalSubTab === 'services' && servicesContent}
          </>
        )}

        {activeTab === 'financial' && (
          <>
            <PatientSubTabNav
              tabs={financialTabs}
              activeTab={activeFinancialSubTab}
              onChange={(id) => onFinancialSubTabChange(id as FinancialSubTab)}
            />
            {activeFinancialSubTab === 'summary' && financialSummaryContent}
            {activeFinancialSubTab === 'quotes' && quotesContent}
            {activeFinancialSubTab === 'invoices' && invoicesContent}
            {activeFinancialSubTab === 'payments' && paymentsContent}
          </>
        )}

        {activeTab === 'management' && (
          <>
            <PatientSubTabNav
              tabs={managementTabs}
              activeTab={activeManagementSubTab}
              onChange={(id) => onManagementSubTabChange(id as ManagementSubTab)}
            />
            {activeManagementSubTab === 'messages' && messagesContent}
            {activeManagementSubTab === 'notes' && notesContent}
            {activeManagementSubTab === 'logs' && logsContent}
          </>
        )}
      </div>
    </div>
  )
}
