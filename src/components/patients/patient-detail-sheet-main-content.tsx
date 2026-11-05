'use client'

import * as React from 'react'
import { CreditCard, Stethoscope, Users } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { PatientSubTabNav } from '@/components/patients/patient-subtab-nav'
import { VerticalTabStrip } from '@/components/ui/vertical-tab-strip'
import type { VerticalTab } from '@/components/ui/vertical-tab-strip'

export type PatientSheetMacroTab = 'info' | 'clinical' | 'financial'
export type PatientSheetInfoSubTab = 'details' | 'dependents'
export type PatientSheetClinicalSubTab = 'anamnesis' | 'clinical-history' | 'treatment-plans' | 'medical-instructions' | 'documents'

interface PatientDetailSheetMainContentProps {
  activeTab: PatientSheetMacroTab
  onActiveTabChange: (tab: PatientSheetMacroTab) => void
  activeInfoSubTab: PatientSheetInfoSubTab
  onInfoSubTabChange: (tab: PatientSheetInfoSubTab) => void
  activeClinicalSubTab: PatientSheetClinicalSubTab
  onClinicalSubTabChange: (tab: PatientSheetClinicalSubTab) => void
  /** Whether the financial macro tab is available (permission-driven by the caller). */
  showFinancial: boolean
  /** Patient details (demographics + edit). When provided, an "info" tab is shown first. */
  infoContent?: React.ReactNode
  /** Label of the dependents sub-tab inside "info"; omit to hide it (and the sub-tab nav). */
  dependentsLabel?: string
  dependentsContent?: React.ReactNode
  anamnesisContent: React.ReactNode
  clinicalHistoryContent: React.ReactNode
  treatmentPlansContent: React.ReactNode
  medicalInstructionsContent: React.ReactNode
  documentsContent: React.ReactNode
  ledgerContent: React.ReactNode
}

export function PatientDetailSheetMainContent({
  activeTab,
  onActiveTabChange,
  activeInfoSubTab,
  onInfoSubTabChange,
  activeClinicalSubTab,
  onClinicalSubTabChange,
  showFinancial,
  infoContent,
  dependentsLabel,
  dependentsContent,
  anamnesisContent,
  clinicalHistoryContent,
  treatmentPlansContent,
  medicalInstructionsContent,
  documentsContent,
  ledgerContent,
}: PatientDetailSheetMainContentProps) {
  const t = useTranslations('UsersPage')

  const macroTabs = React.useMemo<VerticalTab[]>(() => {
    const infoTab: VerticalTab[] = infoContent ? [{ id: 'info', icon: Users, label: t('tabs.info') }] : []
    return [
      ...infoTab,
      { id: 'clinical', icon: Stethoscope, label: t('tabs.clinical') },
      ...(showFinancial ? [{ id: 'financial', icon: CreditCard, label: t('tabs.financial') }] : []),
    ]
  }, [showFinancial, infoContent, t])

  return (
    <div className="flex flex-col flex-1 overflow-hidden min-h-0">
      <VerticalTabStrip
        tabs={macroTabs}
        activeTabId={activeTab}
        onTabClick={(tab) => onActiveTabChange(tab.id as PatientSheetMacroTab)}
      />
      <div className="flex-1 overflow-auto min-h-0 p-3">
        {activeTab === 'info' && (dependentsLabel ? (
          <>
            <PatientSubTabNav
              tabs={[
                { id: 'details', label: t('tabs.details') },
                { id: 'dependents', label: dependentsLabel },
              ]}
              activeTab={activeInfoSubTab}
              onChange={(id) => onInfoSubTabChange(id as PatientSheetInfoSubTab)}
            />
            {activeInfoSubTab === 'details' && infoContent}
            {activeInfoSubTab === 'dependents' && dependentsContent}
          </>
        ) : infoContent)}

        {activeTab === 'clinical' && (
          <>
            <PatientSubTabNav
              tabs={[
                { id: 'anamnesis', label: t('tabs.anamnesis') },
                { id: 'clinical-history', label: t('tabs.history') },
                { id: 'treatment-plans', label: t('tabs.treatmentPlans') },
                { id: 'medical-instructions', label: t('tabs.medicalInstructions') },
                { id: 'documents', label: t('tabs.documents') },
              ]}
              activeTab={activeClinicalSubTab}
              onChange={(id) => onClinicalSubTabChange(id as PatientSheetClinicalSubTab)}
            />
            {activeClinicalSubTab === 'anamnesis' && anamnesisContent}
            {activeClinicalSubTab === 'clinical-history' && clinicalHistoryContent}
            {activeClinicalSubTab === 'treatment-plans' && treatmentPlansContent}
            {activeClinicalSubTab === 'medical-instructions' && medicalInstructionsContent}
            {activeClinicalSubTab === 'documents' && documentsContent}
          </>
        )}

        {activeTab === 'financial' && showFinancial && ledgerContent}
      </div>
    </div>
  )
}
