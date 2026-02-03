'use client'

import * as React from 'react'
import { api } from '@/services/api'
import { API_ROUTES } from '@/constants/routes'

interface AlertNotificationsState {
  pendingCount: number
  highestPriority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  isLoading: boolean
  error: string | null
}

interface AlertNotificationsContextType extends AlertNotificationsState {
  refreshAlerts: () => Promise<void>
  lastUpdated: Date | null
}

const AlertNotificationsContext = React.createContext<AlertNotificationsContextType | undefined>(undefined)

export function useAlertNotifications() {
  const context = React.useContext(AlertNotificationsContext)
  if (context === undefined) {
    throw new Error('useAlertNotifications must be used within an AlertNotificationsProvider')
  }
  return context
}

interface AlertNotificationsProviderProps {
  children: React.ReactNode
}

export function AlertNotificationsProvider({ children }: AlertNotificationsProviderProps) {
  const [state, setState] = React.useState<AlertNotificationsState>({
    pendingCount: 0,
    highestPriority: 'LOW',
    isLoading: false,
    error: null
  })
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null)

  const fetchAlerts = React.useCallback(async () => {
    // Check if user is authenticated before making API calls
    const token = localStorage.getItem('token')
    if (!token) {
      // No authentication token, don't fetch alerts
      return
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }))
    
    try {
const response = await api.get(API_ROUTES.SYSTEM.ALERT_INSTANCES, { status: 'PENDING' })

      // Handle empty responses - API returns an array with one empty object
      if (response.length === 1 && Object.keys(response[0]).length === 0) {
        setState({
          pendingCount: 0,
          highestPriority: 'LOW',
          isLoading: false,
          error: null
        })
        setLastUpdated(new Date())
        return
      }

      // Response is directly an array of alerts
      const alerts: any[] = response
      const pendingCount = alerts.length
      
      let highestPriority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW'
      if (pendingCount > 0) {
        const priorities = alerts.map((alert: any) => alert.priority).filter(Boolean)
        if (priorities.includes('CRITICAL')) {
          highestPriority = 'CRITICAL'
        } else if (priorities.includes('HIGH')) {
          highestPriority = 'HIGH'
        } else if (priorities.includes('MEDIUM')) {
          highestPriority = 'MEDIUM'
        }
      }

      setState({
        pendingCount,
        highestPriority,
        isLoading: false,
        error: null
      })
      setLastUpdated(new Date())
    } catch (error) {
      console.error('Error fetching alert notifications:', error)
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to fetch alerts'
      }))
    }
  }, [])

  const refreshAlerts = React.useCallback(async () => {
    await fetchAlerts()
  }, [fetchAlerts])

  React.useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    const setupAlerts = () => {
      const token = localStorage.getItem('token')
      if (!token) {
        if (interval) {
          clearInterval(interval)
          interval = null
        }
        // Reset state when logged out
        setState({
          pendingCount: 0,
          highestPriority: 'LOW',
          isLoading: false,
          error: null
        })
        setLastUpdated(null)
        return
      }

      fetchAlerts()
      interval = setInterval(fetchAlerts, 60000)
    }

    // Initial setup
    setupAlerts()

    // Listen for storage changes (for login/logout from other tabs)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'token' || e.key === 'user') {
        setupAlerts()
      }
    }

    window.addEventListener('storage', handleStorageChange)

    return () => {
      if (interval) {
        clearInterval(interval)
      }
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [fetchAlerts])

  const contextValue: AlertNotificationsContextType = {
    ...state,
    refreshAlerts,
    lastUpdated
  }

  return (
    <AlertNotificationsContext.Provider value={contextValue}>
      {children}
    </AlertNotificationsContext.Provider>
  )
}