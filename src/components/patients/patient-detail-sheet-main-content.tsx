'use client'

import * as React from 'react'
import { CreditCard, MessageSquare, StickyNote, Stethoscope } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { PatientSubTabNav } from '@/components/patients/patient-subtab-nav'
import { VerticalTabStrip } from '@/components/ui/vertical-tab-strip'
import type { VerticalTab } from '@/components/ui/vertical-tab-strip'

export type PatientSheetMacroTab = 'clinical' | 'financial' | 'management'
export type PatientSheetClinicalSubTab = 'anamnesis' | 'clinical-history'
export type PatientSheetFinancialSubTab = 'quotes' | 'invoices' | 'payments'
export type PatientSheetManagementSubTab = 'messages' | 'notes'

interface PatientDetailSheetMainContentProps {
  activeTab: PatientSheetMacroTab
  onActiveTabChange: (tab: PatientSheetMacroTab) => void
  activeClinicalSubTab: PatientSheetClinicalSubTab
  onClinicalSubTabChange: (tab: PatientSheetClinicalSubTab) => void
  activeFinancialSubTab: PatientSheetFinancialSubTab
  onFinancialSubTabChange: (tab: PatientSheetFinancialSubTab) => void
  activeManagementSubTab: PatientSheetManagementSubTab
  onManagementSubTabChange: (tab: PatientSheetManagementSubTab) => void
  isDoctorMode: boolean
  anamnesisContent: React.ReactNode
  clinicalHistoryContent: React.ReactNode
  quotesContent: React.ReactNode
  invoicesContent: React.ReactNode
  paymentsContent: React.ReactNode
  messagesContent: React.ReactNode
  notesContent: React.ReactNode
}

export function PatientDetailSheetMainContent({
  activeTab,
  onActiveTabChange,
  activeClinicalSubTab,
  onClinicalSubTabChange,
  activeFinancialSubTab,
  onFinancialSubTabChange,
  activeManagementSubTab,
  onManagementSubTabChange,
  isDoctorMode,
  anamnesisContent,
  clinicalHistoryContent,
  quotesContent,
  invoicesContent,
  paymentsContent,
  messagesContent,
  notesContent,
}: PatientDetailSheetMainContentProps) {
  const t = useTranslations('UsersPage')

  const macroTabs = React.useMemo<VerticalTab[]>(() => (
    isDoctorMode
      ? [
          { id: 'clinical', icon: Stethoscope, label: t('tabs.clinical') },
          { id: 'management', icon: StickyNote, label: t('tabs.management') },
        ]
      : [
          { id: 'clinical', icon: Stethoscope, label: t('tabs.clinical') },
          { id: 'financial', icon: CreditCard, label: t('tabs.financial') },
          { id: 'management', icon: StickyNote, label: t('tabs.management') },
        ]
  ), [isDoctorMode, t])

  return (
    <div className="flex flex-col flex-1 overflow-hidden min-h-0">
      <VerticalTabStrip
        tabs={macroTabs}
        activeTabId={activeTab}
        onTabClick={(tab) => onActiveTabChange(tab.id as PatientSheetMacroTab)}
      />
      <div className="flex-1 overflow-auto min-h-0 p-3">
        {activeTab === 'clinical' && (
          <>
            <PatientSubTabNav
              tabs={[
                { id: 'anamnesis', label: t('tabs.anamnesis') },
                { id: 'clinical-history', label: t('tabs.history') },
              ]}
              activeTab={activeClinicalSubTab}
              onChange={(id) => onClinicalSubTabChange(id as PatientSheetClinicalSubTab)}
            />
            {activeClinicalSubTab === 'anamnesis' && anamnesisContent}
            {activeClinicalSubTab === 'clinical-history' && clinicalHistoryContent}
          </>
        )}

        {activeTab === 'financial' && !isDoctorMode && (
          <>
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
          </>
        )}

        {activeTab === 'management' && (
          <>
            <PatientSubTabNav
              tabs={[
                { id: 'messages', label: t('tabs.messages') },
                { id: 'notes', label: t('tabs.notes') },
              ]}
              activeTab={activeManagementSubTab}
              onChange={(id) => onManagementSubTabChange(id as PatientSheetManagementSubTab)}
            />
            {activeManagementSubTab === 'messages' && messagesContent}
            {activeManagementSubTab === 'notes' && notesContent}
          </>
        )}
      </div>
    </div>
  )
}
