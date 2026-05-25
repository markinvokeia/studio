'use client'

import * as React from 'react'

import type {
  ClinicalSubTab,
  FinancialSubTab,
  ManagementSubTab,
  PatientMacroTab,
} from '@/components/patients/patient-detail-main-content'

interface UsePatientDetailNavigationOptions {
  deepLinkView?: string
  selectedUserId?: string
}

export function usePatientDetailNavigation({ deepLinkView, selectedUserId }: UsePatientDetailNavigationOptions) {
  const [activeTab, setActiveTab] = React.useState<PatientMacroTab>('clinical')
  const [activeClinicalSubTab, setActiveClinicalSubTab] = React.useState<ClinicalSubTab>('summary')
  const [activeFinancialSubTab, setActiveFinancialSubTab] = React.useState<FinancialSubTab>('summary')
  const [activeManagementSubTab, setActiveManagementSubTab] = React.useState<ManagementSubTab>('messages')

  React.useEffect(() => {
    if (!selectedUserId) return
    setActiveTab('clinical')
    setActiveClinicalSubTab('summary')
    setActiveFinancialSubTab('summary')
    setActiveManagementSubTab('messages')
  }, [selectedUserId])

  React.useEffect(() => {
    if (activeTab !== 'clinical') return
    if (deepLinkView === 'anamnesis') setActiveClinicalSubTab('anamnesis')
    else if (deepLinkView === 'documents') setActiveClinicalSubTab('documents')
    else if (deepLinkView === 'timeline') setActiveClinicalSubTab('clinical-history')
  }, [activeTab, deepLinkView])

  const openClinicalSummary = React.useCallback(() => {
    setActiveTab('clinical')
    setActiveClinicalSubTab('summary')
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

  const openFinancialSummary = React.useCallback(() => {
    setActiveTab('financial')
    setActiveFinancialSubTab('summary')
  }, [])

  const openFinancialQuotes = React.useCallback(() => {
    setActiveTab('financial')
    setActiveFinancialSubTab('quotes')
  }, [])

  const openFinancialInvoices = React.useCallback(() => {
    setActiveTab('financial')
    setActiveFinancialSubTab('invoices')
  }, [])

  const openFinancialPayments = React.useCallback(() => {
    setActiveTab('financial')
    setActiveFinancialSubTab('payments')
  }, [])

  return {
    activeTab,
    setActiveTab,
    activeClinicalSubTab,
    setActiveClinicalSubTab,
    activeFinancialSubTab,
    setActiveFinancialSubTab,
    activeManagementSubTab,
    setActiveManagementSubTab,
    openClinicalSummary,
    openClinicalAnamnesis,
    openClinicalHistory,
    openClinicalTreatmentPlans,
    openClinicalDocuments,
    openFinancialSummary,
    openFinancialQuotes,
    openFinancialInvoices,
    openFinancialPayments,
  }
}
