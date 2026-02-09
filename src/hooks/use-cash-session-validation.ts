'use client'

import { API_ROUTES } from '@/constants/routes'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/hooks/use-toast'
import api from '@/services/api'
import { useTranslations } from 'next-intl'

interface UseCashSessionValidationReturn {
  validateActiveSession: () => Promise<{ isValid: boolean; sessionId?: string; error?: string }>
  showCashSessionError: (error?: string) => void
}

export function useCashSessionValidation(): UseCashSessionValidationReturn {
  const { toast } = useToast()
  const { user } = useAuth()
  const t = useTranslations('cashSession')

  const validateActiveSession = async (): Promise<{ isValid: boolean; sessionId?: string; error?: string }> => {
    if (!user) {
      return { isValid: false, error: t('errors.userNotAuthenticated') }
    }

    try {
      const sessionData = await api.get(API_ROUTES.CASHIER.SESSIONS_ACTIVE, { user_id: user.id })

      // The endpoint now always returns 200, and the actual session status is inside
      if (sessionData.code === 200 && sessionData.data?.id) {
        return { isValid: true, sessionId: sessionData.data.id }
      } else if (sessionData.code === 404) {
        return { isValid: false, error: t('errors.noActiveSession') }
      } else {
        return { isValid: false, error: t('errors.sessionCheckFailed') }
      }
    } catch (error: any) {
      console.error('Failed to validate cash session:', error)
      return { isValid: false, error: t('errors.sessionValidationError') }
    }
  }

  const showCashSessionError = (error?: string) => {
    const errorMessage = error || t('errors.noActiveSession')

    toast({
      variant: 'destructive',
      title: t('errors.cashSessionRequired'),
      description: errorMessage,
      duration: 6000,
    })
  }

  return {
    validateActiveSession,
    showCashSessionError,
  }
}