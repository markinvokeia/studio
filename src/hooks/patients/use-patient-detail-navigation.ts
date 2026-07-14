'use client'

import * as React from 'react'

import type {
  ClinicalSubTab,
  InfoSubTab,
  PatientMacroTab,
} from '@/components/patients/patient-detail-main-content'

interface UsePatientDetailNavigationOptions {
  deepLinkView?: string
  selectedUserId?: string
}

export function usePatientDetailNavigation({ deepLinkView, selectedUserId }: UsePatientDetailNavigationOptions) {
  const [activeTab, setActiveTab] = React.useState<PatientMacroTab>('info')
  const [activeInfoSubTab, setActiveInfoSubTab] = React.useState<InfoSubTab>('details')
  const [activeClinicalSubTab, setActiveClinicalSubTab] = React.useState<ClinicalSubTab>('clinical-history')

  React.useEffect(() => {
    if (!selectedUserId) return
    setActiveTab('info')
    setActiveInfoSubTab('details')
    setActiveClinicalSubTab('clinical-history')
  }, [selectedUserId])

  React.useEffect(() => {
    if (deepLinkView === 'anamnesis') {
      setActiveTab('clinical')
      setActiveClinicalSubTab('anamnesis')
    } else if (deepLinkView === 'documents') {
      setActiveTab('clinical')
      setActiveClinicalSubTab('documents')
    } else if (deepLinkView === 'timeline') {
      setActiveTab('clinical')
      setActiveClinicalSubTab('clinical-history')
    } else if (deepLinkView === 'treatments') {
      setActiveTab('clinical')
      setActiveClinicalSubTab('treatment-plans')
    }
  }, [deepLinkView])

  const openInfo = React.useCallback(() => {
    setActiveTab('info')
  }, [])

  const openClinicalAnamnesis = React.useCallback(() => {
    setActiveTab('clinical')
    setActiveClinicalSubTab('anamnesis')
  }, [])

  const openClinicalHistory = React.useCallback(() => {
    setActiveTab('clinical')
    setActiveClinicalSubTab('clinical-history')
  }, [])

  const openClinicalTreatmentPlans = React.useCallback(() => {
    setActiveTab('clinical')
    setActiveClinicalSubTab('treatment-plans')
  }, [])

  const openClinicalDocuments = React.useCallback(() => {
    setActiveTab('clinical')
    setActiveClinicalSubTab('documents')
  }, [])

  const openClinicalMedicalInstructions = React.useCallback(() => {
    setActiveTab('clinical')
    setActiveClinicalSubTab('medical-instructions')
  }, [])

  const openFinancial = React.useCallback(() => {
    setActiveTab('financial')
  }, [])

  return {
    activeTab,
    setActiveTab,
    activeInfoSubTab,
    setActiveInfoSubTab,
    activeClinicalSubTab,
    setActiveClinicalSubTab,
    openInfo,
    openClinicalAnamnesis,
    openClinicalHistory,
    openClinicalTreatmentPlans,
    openClinicalDocuments,
    openClinicalMedicalInstructions,
    openFinancial,
  }
}
