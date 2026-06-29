'use client'

import { API_ROUTES } from '@/constants/routes'
import { User } from '@/lib/types'
import { api } from '@/services/api'
import * as React from 'react'

export function useCheckFirstPassword(
  selectedUser: User | null,
  canSetInitialPassword: boolean,
): boolean {
  const [hasPasswordPermission, setHasPasswordPermission] = React.useState(false)

  React.useEffect(() => {
    const check = async () => {
      if (!selectedUser || !canSetInitialPassword) {
        setHasPasswordPermission(false)
        return
      }
      if (!localStorage.getItem('token')) {
        setHasPasswordPermission(false)
        return
      }
      try {
        const result = await api.get(API_ROUTES.SYSTEM.API_AUTH_CHECK_FIRST_PASSWORD, { user_id: selectedUser.id })
        setHasPasswordPermission(result?.success === true)
      } catch {
        setHasPasswordPermission(false)
      }
    }

    check()
  }, [selectedUser, canSetInitialPassword])

  return hasPasswordPermission
}
