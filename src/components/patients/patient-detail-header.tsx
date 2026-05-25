'use client'

import * as React from 'react'
import { AlertTriangle, Cake, CheckCircle, CreditCard, Heart, Mail, Users } from 'lucide-react'
import { differenceInYears, parseISO } from 'date-fns'
import { useTranslations } from 'next-intl'

import { Badge } from '@/components/ui/badge'
import { CardHeader, CardTitle } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { formatDisplayDate } from '@/lib/utils'
import type { PatientDischarge, User } from '@/lib/types'
import { WhatsAppIcon } from '@/components/icons/whatsapp-icon'

interface PatientAlertItem {
  id?: number
  alergeno?: string
  nombre?: string
}

interface DependantContactInfo {
  id: string
  name: string
  address?: string | null
  email?: string | null
  phone_number?: string | null
}

interface PatientDetailHeaderProps {
  user: User
  allergies: PatientAlertItem[]
  conditions: PatientAlertItem[]
  dependantContactInfo: DependantContactInfo | null
  effectivePatientEmail?: string | null
  effectivePatientPhone?: string | null
  currentDischarge: PatientDischarge | null
  actions: React.ReactNode
  onOpenAnamnesis: () => void
}

export function PatientDetailHeader({
  user,
  allergies,
  conditions,
  dependantContactInfo,
  effectivePatientEmail,
  effectivePatientPhone,
  currentDischarge,
  actions,
  onOpenAnamnesis,
}: PatientDetailHeaderProps) {
  const t = useTranslations()

  return (
    <CardHeader className="flex-none p-4 pb-2 space-y-0">
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1 flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="header-icon-circle flex-none cursor-default"
                  style={
                    allergies.length > 0
                      ? { backgroundColor: 'rgb(254 226 226)', color: 'rgb(220 38 38)' }
                      : conditions.length > 0
                        ? { backgroundColor: 'rgb(254 243 199)', color: 'rgb(217 119 6)' }
                        : undefined
                  }
                >
                  {(allergies.length > 0 || conditions.length > 0)
                    ? <AlertTriangle className="h-5 w-5" />
                    : <Users className="h-5 w-5" />}
                </div>
              </TooltipTrigger>
              {(allergies.length > 0 || conditions.length > 0) && (
                <TooltipContent>
                  {[
                    allergies.length > 0 ? `${allergies.length} alergia(s)` : '',
                    conditions.length > 0 ? `${conditions.length} padecimiento(s)` : '',
                  ].filter(Boolean).join(' · ')}
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
          <CardTitle className="text-lg lg:text-xl truncate text-foreground font-bold">
            {user.name}
          </CardTitle>
        </div>
        <div className="flex items-center gap-0.5 ml-2 flex-none">{actions}</div>
      </div>

      <div className="flex items-center gap-x-3 gap-y-1 mt-1 ml-10 flex-wrap text-xs text-muted-foreground">
        {user.birth_date && (
          <span className="flex items-center gap-1">
            <Cake className="h-3 w-3" />
            {differenceInYears(new Date(), parseISO(user.birth_date))} años
          </span>
        )}
        {user.identity_document && (
          <span className="flex items-center gap-1">
            <CreditCard className="h-3 w-3" />
            {user.identity_document}
          </span>
        )}
        {user.is_dependent && (
          <Badge variant="secondary" className="gap-1 text-xs font-normal">
            <Users className="h-3 w-3" />
            {user.responsible_contact_name || dependantContactInfo?.name
              ? t('UsersPage.dependentOf', { name: user.responsible_contact_name || dependantContactInfo?.name })
              : t('UsersPage.dependentPatient')}
          </Badge>
        )}
        {user.is_dependent && effectivePatientEmail ? (
          <span className="flex items-center gap-1">
            <Mail className="h-3 w-3" />
            {effectivePatientEmail}
          </span>
        ) : null}
        {user.is_dependent && effectivePatientPhone ? (
          <span className="flex items-center gap-1">
            <WhatsAppIcon className="h-3 w-3" />
            {effectivePatientPhone}
          </span>
        ) : null}
        {currentDischarge && (
          <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100 gap-1 text-xs font-normal">
            <CheckCircle className="h-3 w-3" />
            {t('ClinicHistoryPage.discharge.dischargedBadge', { date: formatDisplayDate(currentDischarge.appointment_date) })}
          </Badge>
        )}
      </div>

      {(allergies.length > 0 || conditions.length > 0) && (
        <div className="flex items-center gap-1.5 mt-1 ml-10 flex-wrap">
          {[
            ...allergies.map(a => ({ label: a.alergeno || '', type: 'allergy' as const })),
            ...conditions.map(c => ({ label: c.nombre || '', type: 'condition' as const })),
          ].slice(0, 3).map((item, i) => (
            item.type === 'allergy' ? (
              <Badge key={`a-${i}`} variant="destructive" className="gap-1 text-xs font-normal">
                <AlertTriangle className="h-3 w-3" />
                {item.label}
              </Badge>
            ) : (
              <Badge key={`c-${i}`} variant="secondary" className="gap-1 text-xs font-normal bg-amber-100 text-amber-800 hover:bg-amber-100">
                <Heart className="h-3 w-3" />
                {item.label}
              </Badge>
            )
          ))}
          {(allergies.length + conditions.length) > 3 && (
            <button
              className="text-xs text-primary hover:underline"
              onClick={onOpenAnamnesis}
            >
              +{allergies.length + conditions.length - 3} más → Anamnesis
            </button>
          )}
        </div>
      )}
    </CardHeader>
  )
}
