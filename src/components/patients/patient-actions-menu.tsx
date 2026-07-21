'use client';

import * as React from 'react';
import { BellRing, CalendarIcon, CheckCircle, ChevronDown, ClipboardList, CreditCard, FileText, Mail, MoreHorizontal, Plus, Receipt, SlidersHorizontal, Smile, Stethoscope, ToggleLeft, Upload, XCircle, Zap } from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { WhatsAppIcon } from '@/components/icons/whatsapp-icon';

export interface PatientActionsMenuProps {
  /** Whether the patient is currently active (controls the activate/deactivate label). */
  isActive: boolean;
  /** Whether the patient currently has a discharge (controls discharge/readmit label). */
  hasDischarge: boolean;
  hasEmail: boolean;
  hasPhone: boolean;
  isBusy?: boolean;
  /** Whether to show the activate/deactivate action (permission-gated by the host). Default true. */
  showActivate?: boolean;

  // Clinical "create" actions — only shown when provided.
  onCreateClinicalSession?: () => void;
  onCreateOdontogram?: () => void;
  onCreateMedicalInstruction?: () => void;
  onCreateDocument?: () => void;

  // Financial
  onQuickBill: () => void;
  onCreateQuote: () => void;
  onCreateInvoice: () => void;
  onCreatePrepaid: () => void;

  // Agenda
  onCreateAppointment: () => void;

  // More actions
  onEmail: () => void;
  onWhatsApp: () => void;
  /** Send a YCloud WhatsApp template (birthday/appointment reminder/invoice due). Only shown when the caller has permission and provides a handler. */
  onSendWhatsAppTemplate?: () => void;
  onToggleDischarge: () => void;
  onToggleActivate: () => void;
  onPreferences: () => void;
}

/**
 * Presentational "Create" + "More actions" menus for a patient. The host wires
 * each action to its own dialogs/handlers, so the menu layout is a single source
 * shared by the Patients page and the patient quick view.
 */
export function PatientActionsMenu({
  isActive,
  hasDischarge,
  hasEmail,
  hasPhone,
  isBusy = false,
  showActivate = true,
  onCreateClinicalSession,
  onCreateOdontogram,
  onCreateMedicalInstruction,
  onCreateDocument,
  onQuickBill,
  onCreateQuote,
  onCreateInvoice,
  onCreatePrepaid,
  onCreateAppointment,
  onEmail,
  onWhatsApp,
  onSendWhatsAppTemplate,
  onToggleDischarge,
  onToggleActivate,
  onPreferences,
}: PatientActionsMenuProps) {
  const t = useTranslations();
  const hasClinicalCreate = !!(onCreateClinicalSession || onCreateOdontogram || onCreateMedicalInstruction || onCreateDocument);

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        {/* Create */}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <button type="button" className="flex items-center justify-center gap-1.5 h-8 px-2 sm:px-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-xs font-medium">
                  <Plus className="sm:hidden h-4 w-4 flex-none" />
                  <span className="hidden sm:inline">Crear</span>
                  <ChevronDown className="hidden sm:block h-3 w-3 flex-none" />
                </button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>Crear</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="w-48">
            {hasClinicalCreate && (
              <>
                <DropdownMenuLabel className="text-xs text-muted-foreground">Clínico</DropdownMenuLabel>
                {onCreateClinicalSession && (
                  <DropdownMenuItem onClick={onCreateClinicalSession}>
                    <Stethoscope className="h-4 w-4 mr-2 text-primary" />Sesión clínica
                  </DropdownMenuItem>
                )}
                {onCreateOdontogram && (
                  <DropdownMenuItem onClick={onCreateOdontogram}>
                    <Smile className="h-4 w-4 mr-2 text-purple-600" />Sesión de odontograma
                  </DropdownMenuItem>
                )}
                {onCreateMedicalInstruction && (
                  <DropdownMenuItem onClick={onCreateMedicalInstruction}>
                    <ClipboardList className="h-4 w-4 mr-2 text-primary" />Indicación médica
                  </DropdownMenuItem>
                )}
                {onCreateDocument && (
                  <DropdownMenuItem onClick={onCreateDocument}>
                    <Upload className="h-4 w-4 mr-2 text-primary" />Documento
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuLabel className="text-xs text-muted-foreground">Financiero</DropdownMenuLabel>
            <DropdownMenuItem onClick={onQuickBill}>
              <Zap className="h-4 w-4 mr-2 text-emerald-600" />Cobro rápido
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onCreateQuote}>
              <FileText className="h-4 w-4 mr-2 text-emerald-600" />Presupuesto
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onCreateInvoice}>
              <Receipt className="h-4 w-4 mr-2 text-emerald-600" />Factura
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onCreatePrepaid}>
              <CreditCard className="h-4 w-4 mr-2 text-emerald-600" />Prepago
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">Agenda</DropdownMenuLabel>
            <DropdownMenuItem onClick={onCreateAppointment}>
              <CalendarIcon className="h-4 w-4 mr-2 text-blue-600" />Cita
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* More actions */}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <button type="button" className="flex items-center justify-center gap-1.5 h-8 px-2 sm:px-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-xs font-medium">
                  <MoreHorizontal className="sm:hidden h-4 w-4 flex-none" />
                  <span className="hidden sm:inline">Más acciones</span>
                  <ChevronDown className="hidden sm:block h-3 w-3 flex-none" />
                </button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>Más acciones</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="w-52">
            {(hasEmail || hasPhone) && (
              <>
                <DropdownMenuLabel className="text-xs text-muted-foreground">Comunicación</DropdownMenuLabel>
                {hasEmail && (
                  <DropdownMenuItem onClick={onEmail}>
                    <Mail className="h-4 w-4 mr-2" />Enviar email
                  </DropdownMenuItem>
                )}
                {hasPhone && (
                  <DropdownMenuItem onClick={onWhatsApp}>
                    <WhatsAppIcon className="h-4 w-4 mr-2" />WhatsApp
                  </DropdownMenuItem>
                )}
                {hasPhone && onSendWhatsAppTemplate && (
                  <DropdownMenuItem onClick={onSendWhatsAppTemplate}>
                    <BellRing className="h-4 w-4 mr-2" />{t('PatientActionsMenu.sendReminder')}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuLabel className="text-xs text-muted-foreground">Estado</DropdownMenuLabel>
            <DropdownMenuItem onClick={onToggleDischarge} disabled={isBusy}>
              {hasDischarge ? <XCircle className="h-4 w-4 mr-2 text-green-600" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              {hasDischarge ? t('UsersPage.readmitButton') : t('UsersPage.dischargeButton')}
            </DropdownMenuItem>
            {showActivate && (
              <DropdownMenuItem onClick={onToggleActivate}>
                <ToggleLeft className={`h-4 w-4 mr-2 ${isActive ? 'text-destructive' : 'text-green-600'}`} />
                {isActive ? t('UserColumns.deactivate') : t('UserColumns.activate')}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">Configuración</DropdownMenuLabel>
            <DropdownMenuItem onClick={onPreferences}>
              <SlidersHorizontal className="h-4 w-4 mr-2" />{t('UsersPage.preferencesButton')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </TooltipProvider>
  );
}
