'use client'

import * as React from 'react'
import { CreditCard, Stethoscope, Users } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { VerticalTabStrip } from '@/components/ui/vertical-tab-strip'
import type { VerticalTab } from '@/components/ui/vertical-tab-strip'
import { PatientSubTabNav } from '@/components/patients/patient-subtab-nav'

export type PatientMacroTab = 'info' | 'clinical' | 'financial'
export type InfoSubTab = 'details' | 'notes'
export type ClinicalSubTab = 'anamnesis' | 'clinical-history' | 'treatment-plans' | 'documents' | 'services'
export type FinancialSubTab = 'quotes' | 'invoices' | 'payments'

interface PatientDetailMainContentProps {
  activeTab: PatientMacroTab
  onActiveTabChange: (tab: PatientMacroTab) => void
  activeInfoSubTab: InfoSubTab
  onInfoSubTabChange: (tab: InfoSubTab) => void
  activeClinicalSubTab: ClinicalSubTab
  onClinicalSubTabChange: (tab: ClinicalSubTab) => void
  activeFinancialSubTab: FinancialSubTab
  onFinancialSubTabChange: (tab: FinancialSubTab) => void
  showDocuments: boolean
  showServices: boolean
  showNotes: boolean
  infoContent: React.ReactNode
  notesContent: React.ReactNode
  anamnesisContent: React.ReactNode
  clinicalHistoryContent: React.ReactNode
  treatmentPlansContent: React.ReactNode
  documentsContent?: React.ReactNode
  servicesContent?: React.ReactNode
  financialSummaryContent: React.ReactNode
  quotesContent: React.ReactNode
  invoicesContent: React.ReactNode
  paymentsContent: React.ReactNode
}

export function PatientDetailMainContent({
  activeTab,
  onActiveTabChange,
  activeInfoSubTab,
  onInfoSubTabChange,
  activeClinicalSubTab,
  onClinicalSubTabChange,
  activeFinancialSubTab,
  onFinancialSubTabChange,
  showDocuments,
  showServices,
  showNotes,
  infoContent,
  notesContent,
  anamnesisContent,
  clinicalHistoryContent,
  treatmentPlansContent,
  documentsContent,
  servicesContent,
  financialSummaryContent,
  quotesContent,
  invoicesContent,
  paymentsContent,
}: PatientDetailMainContentProps) {
  const t = useTranslations('UsersPage')

  const macroTabs = React.useMemo<VerticalTab[]>(() => [
    { id: 'info', icon: Users, label: t('tabs.info') },
    { id: 'clinical', icon: Stethoscope, label: t('tabs.clinical'), shortLabel: 'Clínica' },
    { id: 'financial', icon: CreditCard, label: t('tabs.financial'), shortLabel: 'Finanzas' },
  ], [t])

  const infoTabs = React.useMemo(() => [
    { id: 'details', label: t('tabs.details') },
    ...(showNotes ? [{ id: 'notes', label: t('tabs.notes') }] : []),
  ], [showNotes, t])

  const clinicalTabs = React.useMemo(() => [
    { id: 'anamnesis', label: t('tabs.anamnesis') },
    { id: 'clinical-history', label: t('tabs.history') },
    { id: 'treatment-plans', label: t('tabs.treatmentPlans'), desktopLabel: 'Planes de Tratamiento' },
    ...(showDocuments ? [{ id: 'documents', label: t('tabs.documents') }] : []),
    ...(showServices ? [{ id: 'services', label: t('tabs.services') }] : []),
  ], [showDocuments, showServices, t])

  const financialTabs = React.useMemo(() => [
    { id: 'quotes', label: t('tabs.quotes') },
    { id: 'invoices', label: t('tabs.invoices') },
    { id: 'payments', label: t('tabs.payments') },
  ], [t])

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <VerticalTabStrip
        tabs={macroTabs}
        activeTabId={activeTab}
        onTabClick={(tab) => onActiveTabChange(tab.id as PatientMacroTab)}
      />
      <div className="flex-1 overflow-y-auto px-0 pt-4 pb-8 sm:px-3 sm:py-3">
        {activeTab === 'info' && (
          <>
            <PatientSubTabNav
              tabs={infoTabs}
              activeTab={activeInfoSubTab}
              onChange={(id) => onInfoSubTabChange(id as InfoSubTab)}
            />
            {activeInfoSubTab === 'details' && infoContent}
            {activeInfoSubTab === 'notes' && notesContent}
          </>
        )}

        {activeTab === 'clinical' && (
          <>
            <PatientSubTabNav
              tabs={clinicalTabs}
              activeTab={activeClinicalSubTab}
              onChange={(id) => onClinicalSubTabChange(id as ClinicalSubTab)}
            />
            {activeClinicalSubTab === 'anamnesis' && anamnesisContent}
            {activeClinicalSubTab === 'clinical-history' && clinicalHistoryContent}
            {activeClinicalSubTab === 'treatment-plans' && treatmentPlansContent}
            {activeClinicalSubTab === 'documents' && documentsContent}
            {activeClinicalSubTab === 'services' && servicesContent}
          </>
        )}

        {activeTab === 'financial' && (
          <div className="space-y-4">
            {financialSummaryContent}
            <PatientSubTabNav
              tabs={financialTabs}
              activeTab={activeFinancialSubTab}
              onChange={(id) => onFinancialSubTabChange(id as FinancialSubTab)}
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
