'use client'

import * as React from 'react'
import { AlertTriangle, Cake, CheckCircle, CreditCard, Heart, Mail, Users } from 'lucide-react'
import { differenceInYears, parseISO } from 'date-fns'
import { useTranslations } from 'next-intl'

import { Badge } from '@/components/ui/badge'
import { CardHeader, CardTitle } from '@/components/ui/card'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
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
  const hasAlerts = allergies.length > 0 || conditions.length > 0

  const alertIcon = (
    <div className="relative flex-none">
      {hasAlerts && (
        <span
          className="absolute inset-0 rounded-full animate-ping"
          style={
            allergies.length > 0
              ? { backgroundColor: 'rgb(220 38 38)', opacity: 0.35 }
              : { backgroundColor: 'rgb(217 119 6)', opacity: 0.35 }
          }
        />
      )}
      <div
        className="header-icon-circle relative"
        style={
          allergies.length > 0
            ? { backgroundColor: 'rgb(254 226 226)', color: 'rgb(220 38 38)' }
            : conditions.length > 0
              ? { backgroundColor: 'rgb(254 243 199)', color: 'rgb(217 119 6)' }
              : undefined
        }
      >
        {hasAlerts ? <AlertTriangle className="h-5 w-5" /> : <Users className="h-5 w-5" />}
      </div>
    </div>
  )

  return (
    <CardHeader className="flex-none p-4 pb-2 space-y-0">
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1 flex items-center gap-2">
          <TooltipProvider>
            {hasAlerts ? (
              <Popover>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <button type="button" className="flex-none cursor-pointer">
                        {alertIcon}
                      </button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent>
                    {[
                      allergies.length > 0 ? `${allergies.length} alergia(s)` : '',
                      conditions.length > 0 ? `${conditions.length} padecimiento(s)` : '',
                    ].filter(Boolean).join(' · ')}
                  </TooltipContent>
                </Tooltip>
                <PopoverContent align="start" className="w-64 p-3 space-y-3">
                  {allergies.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold text-destructive uppercase tracking-wide flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Alergias
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {allergies.map((a, i) => (
                          <Badge key={i} variant="destructive" className="gap-1 text-xs font-normal">
                            {a.alergeno}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {conditions.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide flex items-center gap-1">
                        <Heart className="h-3 w-3" />
                        Padecimientos
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {conditions.map((c, i) => (
                          <Badge key={i} variant="secondary" className="gap-1 text-xs font-normal bg-amber-100 text-amber-800 hover:bg-amber-100">
                            {c.nombre}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  <button
                    className="text-xs text-primary hover:underline w-full text-left pt-1 border-t border-border"
                    onClick={onOpenAnamnesis}
                  >
                    Ver Anamnesis completa →
                  </button>
                </PopoverContent>
              </Popover>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex-none cursor-default">{alertIcon}</div>
                </TooltipTrigger>
                <TooltipContent>Sin alertas</TooltipContent>
              </Tooltip>
            )}
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
        {effectivePatientEmail ? (
          <span className="flex items-center gap-1">
            <Mail className="h-3 w-3" />
            {effectivePatientEmail}
          </span>
        ) : null}
        {effectivePatientPhone ? (
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
    </CardHeader>
  )
}
