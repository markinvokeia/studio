'use client';

import * as React from 'react';
import { BellRing, CalendarIcon, CheckCircle, ChevronDown, ClipboardList, CreditCard, FileText, Mail, MoreHorizontal, Pill, Plus, Receipt, SlidersHorizontal, Smile, Stethoscope, ToggleLeft, Upload, XCircle, Zap } from 'lucide-react';
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
import { useHelpScope } from '@/components/help/help-scope';
import { WhatsAppIcon } from '@/components/icons/whatsapp-icon';
import { composeHelpId } from '@/lib/help/help-id';

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
  onCreatePrescription?: () => void;
  onCreateDocument?: () => void;

  // Financial — only shown when provided (permission-gated by the host).
  onQuickBill?: () => void;
  onCreateQuote?: () => void;
  onCreateInvoice?: () => void;
  onCreatePrepaid?: () => void;

  // Agenda — only shown when provided.
  onCreateAppointment?: () => void;

  // More actions
  onEmail: () => void;
  onWhatsApp: () => void;
  /** Send a YCloud WhatsApp template (birthday/appointment reminder/invoice due). Only shown when the caller has permission and provides a handler. */
  onSendWhatsAppTemplate?: () => void;
  /** Only shown when provided (permission-gated by the host). */
  onToggleDischarge?: () => void;
  onToggleActivate: () => void;
  /** Only shown when provided (permission-gated by the host). */
  onPreferences?: () => void;
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
  onCreatePrescription,
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
  // Help ids con el scope de la pantalla (patients.btn.create-menu…).
  const helpScope = useHelpScope();
  const hid = (name: string) => composeHelpId(helpScope, 'btn', name);
  const hasClinicalCreate = !!(onCreateClinicalSession || onCreateOdontogram || onCreateMedicalInstruction || onCreatePrescription || onCreateDocument);
  const hasFinancialCreate = !!(onQuickBill || onCreateQuote || onCreateInvoice || onCreatePrepaid);
  const hasAgendaCreate = !!onCreateAppointment;
  const hasCreateMenu = hasClinicalCreate || hasFinancialCreate || hasAgendaCreate;
  const hasStatusActions = !!onToggleDischarge || showActivate;
  const hasMoreMenu = hasEmail || hasPhone || hasStatusActions || !!onPreferences;

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        {/* Create */}
        {hasCreateMenu && (
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button type="button" data-help-id={hid('create-menu')} className="flex items-center justify-center gap-1.5 h-8 px-2 sm:px-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-xs font-medium">
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
                    <DropdownMenuItem data-help-id={hid('new-session')} onClick={onCreateClinicalSession}>
                      <Stethoscope className="h-4 w-4 mr-2 text-primary" />Sesión clínica
                    </DropdownMenuItem>
                  )}
                  {onCreateOdontogram && (
                    <DropdownMenuItem data-help-id={hid('new-odontogram')} onClick={onCreateOdontogram}>
                      <Smile className="h-4 w-4 mr-2 text-purple-600" />Sesión de odontograma
                    </DropdownMenuItem>
                  )}
                  {onCreateMedicalInstruction && (
                    <DropdownMenuItem data-help-id={hid('new-indication')} onClick={onCreateMedicalInstruction}>
                      <ClipboardList className="h-4 w-4 mr-2 text-primary" />Indicación médica
                    </DropdownMenuItem>
                  )}
                  {onCreatePrescription && (
                    <DropdownMenuItem data-help-id={hid('new-prescription')} onClick={onCreatePrescription}>
                      <Pill className="h-4 w-4 mr-2 text-primary" />Receta médica
                    </DropdownMenuItem>
                  )}
                  {onCreateDocument && (
                    <DropdownMenuItem data-help-id={hid('new-document')} onClick={onCreateDocument}>
                      <Upload className="h-4 w-4 mr-2 text-primary" />Documento
                    </DropdownMenuItem>
                  )}
                  {(hasFinancialCreate || hasAgendaCreate) && <DropdownMenuSeparator />}
                </>
              )}
              {hasFinancialCreate && (
                <>
                  <DropdownMenuLabel className="text-xs text-muted-foreground">Financiero</DropdownMenuLabel>
                  {onQuickBill && (
                    <DropdownMenuItem data-help-id={hid('quick-bill')} onClick={onQuickBill}>
                      <Zap className="h-4 w-4 mr-2 text-emerald-600" />Cobro rápido
                    </DropdownMenuItem>
                  )}
                  {onQuickBill && (onCreateQuote || onCreateInvoice || onCreatePrepaid) && <DropdownMenuSeparator />}
                  {onCreateQuote && (
                    <DropdownMenuItem data-help-id={hid('new-quote')} onClick={onCreateQuote}>
                      <FileText className="h-4 w-4 mr-2 text-emerald-600" />Presupuesto
                    </DropdownMenuItem>
                  )}
                  {onCreateInvoice && (
                    <DropdownMenuItem data-help-id={hid('new-invoice')} onClick={onCreateInvoice}>
                      <Receipt className="h-4 w-4 mr-2 text-emerald-600" />Factura
                    </DropdownMenuItem>
                  )}
                  {onCreatePrepaid && (
                    <DropdownMenuItem data-help-id={hid('new-prepaid')} onClick={onCreatePrepaid}>
                      <CreditCard className="h-4 w-4 mr-2 text-emerald-600" />Prepago
                    </DropdownMenuItem>
                  )}
                  {hasAgendaCreate && <DropdownMenuSeparator />}
                </>
              )}
              {onCreateAppointment && (
                <>
                  <DropdownMenuLabel className="text-xs text-muted-foreground">Agenda</DropdownMenuLabel>
                  <DropdownMenuItem data-help-id={hid('new-appointment')} onClick={onCreateAppointment}>
                    <CalendarIcon className="h-4 w-4 mr-2 text-blue-600" />Cita
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* More actions */}
        {hasMoreMenu && (
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button type="button" data-help-id={hid('more-menu')} className="flex items-center justify-center gap-1.5 h-8 px-2 sm:px-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-xs font-medium">
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
                    <DropdownMenuItem data-help-id={hid('email')} onClick={onEmail}>
                      <Mail className="h-4 w-4 mr-2" />Enviar email
                    </DropdownMenuItem>
                  )}
                  {hasPhone && (
                    <DropdownMenuItem data-help-id={hid('whatsapp')} onClick={onWhatsApp}>
                      <WhatsAppIcon className="h-4 w-4 mr-2" />WhatsApp
                    </DropdownMenuItem>
                  )}
                  {hasPhone && onSendWhatsAppTemplate && (
                    <DropdownMenuItem data-help-id={hid('whatsapp-reminder')} onClick={onSendWhatsAppTemplate}>
                      <BellRing className="h-4 w-4 mr-2" />{t('PatientActionsMenu.sendReminder')}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                </>
              )}
              {hasStatusActions && (
                <>
                  <DropdownMenuLabel className="text-xs text-muted-foreground">Estado</DropdownMenuLabel>
                  {onToggleDischarge && (
                    <DropdownMenuItem data-help-id={hid('discharge')} onClick={onToggleDischarge} disabled={isBusy}>
                      {hasDischarge ? <XCircle className="h-4 w-4 mr-2 text-green-600" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                      {hasDischarge ? t('UsersPage.readmitButton') : t('UsersPage.dischargeButton')}
                    </DropdownMenuItem>
                  )}
                  {showActivate && (
                    <DropdownMenuItem data-help-id={hid('toggle-active')} onClick={onToggleActivate}>
                      <ToggleLeft className={`h-4 w-4 mr-2 ${isActive ? 'text-destructive' : 'text-green-600'}`} />
                      {isActive ? t('UserColumns.deactivate') : t('UserColumns.activate')}
                    </DropdownMenuItem>
                  )}
                  {onPreferences && <DropdownMenuSeparator />}
                </>
              )}
              {onPreferences && (
                <>
                  <DropdownMenuLabel className="text-xs text-muted-foreground">Configuración</DropdownMenuLabel>
                  <DropdownMenuItem data-help-id={hid('preferences')} onClick={onPreferences}>
                    <SlidersHorizontal className="h-4 w-4 mr-2" />{t('UsersPage.preferencesButton')}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </TooltipProvider>
  );
}
