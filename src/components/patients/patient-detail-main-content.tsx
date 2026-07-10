'use client'

import * as React from 'react'
import { CreditCard, Stethoscope, Users } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { VerticalTabStrip } from '@/components/ui/vertical-tab-strip'
import type { VerticalTab } from '@/components/ui/vertical-tab-strip'
import { PatientSubTabNav } from '@/components/patients/patient-subtab-nav'
import { cn } from '@/lib/utils'

export type PatientMacroTab = 'info' | 'clinical' | 'financial'
export type InfoSubTab = 'details' | 'notes'
export type ClinicalSubTab = 'anamnesis' | 'clinical-history' | 'treatment-plans' | 'medical-instructions' | 'documents'

interface PatientDetailMainContentProps {
  activeTab: PatientMacroTab
  onActiveTabChange: (tab: PatientMacroTab) => void
  activeInfoSubTab: InfoSubTab
  onInfoSubTabChange: (tab: InfoSubTab) => void
  activeClinicalSubTab: ClinicalSubTab
  onClinicalSubTabChange: (tab: ClinicalSubTab) => void
  showDocuments: boolean
  showNotes: boolean
  infoContent: React.ReactNode
  notesContent: React.ReactNode
  anamnesisContent: React.ReactNode
  clinicalHistoryContent: React.ReactNode
  treatmentPlansContent: React.ReactNode
  medicalInstructionsContent: React.ReactNode
  documentsContent?: React.ReactNode
  ledgerContent: React.ReactNode
}

export function PatientDetailMainContent({
  activeTab,
  onActiveTabChange,
  activeInfoSubTab,
  onInfoSubTabChange,
  activeClinicalSubTab,
  onClinicalSubTabChange,
  showDocuments,
  showNotes,
  infoContent,
  notesContent,
  anamnesisContent,
  clinicalHistoryContent,
  treatmentPlansContent,
  medicalInstructionsContent,
  documentsContent,
  ledgerContent,
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
    { id: 'medical-instructions', label: t('tabs.medicalInstructions') },
    ...(showDocuments ? [{ id: 'documents', label: t('tabs.documents') }] : []),
  ], [showDocuments, t])

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <VerticalTabStrip
        tabs={macroTabs}
        activeTabId={activeTab}
        onTabClick={(tab) => onActiveTabChange(tab.id as PatientMacroTab)}
      />
      <div
        className={cn(
          'flex-1 overflow-y-auto px-0 pt-4 pb-8 sm:px-3 sm:py-3',
          // "details" hosts a full-height form whose save footer should reach
          // the real bottom of the panel — drop the bottom padding there.
          activeTab === 'info' && activeInfoSubTab === 'details' && 'pb-0 sm:pb-0',
        )}
      >
        {activeTab === 'info' && (
          // "details" hosts a full-height form with its own scroll + fixed save
          // footer, so it needs the full container height instead of flowing in
          // the outer scroll.
          <div className={activeInfoSubTab === 'details' ? 'flex h-full min-h-0 flex-col' : undefined}>
            <PatientSubTabNav
              tabs={infoTabs}
              activeTab={activeInfoSubTab}
              onChange={(id) => onInfoSubTabChange(id as InfoSubTab)}
            />
            {activeInfoSubTab === 'details' && <div className="min-h-0 flex-1">{infoContent}</div>}
            {activeInfoSubTab === 'notes' && notesContent}
          </div>
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
            {activeClinicalSubTab === 'medical-instructions' && medicalInstructionsContent}
            {activeClinicalSubTab === 'documents' && documentsContent}
          </>
        )}

        {activeTab === 'financial' && ledgerContent}
      </div>
    </div>
  )
}
