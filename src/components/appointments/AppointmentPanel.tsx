'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ResizableSheet, SheetTitle, SheetDescription } from '@/components/ui/resizable-sheet';
import { Separator } from '@/components/ui/separator';
import { VerticalTabStrip } from '@/components/ui/vertical-tab-strip';
import type { VerticalTab } from '@/components/ui/vertical-tab-strip';
import { PatientDetailSheet } from '@/components/appointments/PatientDetailSheet';
import { DoctorDetailSheet } from '@/components/appointments/DoctorDetailSheet';
import { QuoteDetailSheet } from '@/components/appointments/QuoteDetailSheet';
import { InvoiceDetailSheet } from '@/components/appointments/InvoiceDetailSheet';
import { Appointment, Invoice, Order, PatientSession } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import {
  CalendarClock, Users, UserSquare, FileText, Receipt, Stethoscope, CreditCard,
  Edit, Trash2, Loader2,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

interface AppointmentPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: Appointment | null;
  linkedSession: PatientSession | null;
  isLoadingLinkedSession: boolean;
  quoteOrder: Order | null;
  quoteInvoices: Invoice[];
  isLoadingQuoteInfo: boolean;
  /** Doctor color for the doctor avatar */
  doctorColor?: string;
  onEdit: (appointment: Appointment) => void;
  onCancel: (appointment: Appointment) => void;
  onOpenClinicSession: (appointment: Appointment) => void;
}

export function AppointmentPanel({
  open,
  onOpenChange,
  appointment,
  linkedSession,
  isLoadingLinkedSession,
  quoteOrder,
  quoteInvoices,
  isLoadingQuoteInfo,
  doctorColor,
  onEdit,
  onCancel,
  onOpenClinicSession,
}: AppointmentPanelProps) {
  const t = useTranslations('AppointmentsPage');
  const tColumns = useTranslations('AppointmentsColumns');
  const tStatus = useTranslations('AppointmentStatus');

  const [activeTab, setActiveTab] = React.useState('info');
  const [isPatientSheetOpen, setIsPatientSheetOpen] = React.useState(false);
  const [isDoctorSheetOpen, setIsDoctorSheetOpen] = React.useState(false);
  const [isQuoteSheetOpen, setIsQuoteSheetOpen] = React.useState(false);
  const [selectedInvoice, setSelectedInvoice] = React.useState<Invoice | null>(null);

  // Reset to info tab when a different appointment is opened
  React.useEffect(() => {
    if (open) setActiveTab('info');
  }, [open, appointment?.id]);

  const baseTabs: VerticalTab[] = [
    { id: 'info', icon: CalendarClock, label: t('panelTabs.info') },
    { id: 'patient', icon: Users, label: tColumns('patient') },
    { id: 'doctor', icon: UserSquare, label: tColumns('doctor') },
    { id: 'session', icon: Stethoscope, label: t('linkedSession') },
  ];

  const conditionalTabs: VerticalTab[] = [];
  if (appointment?.quote_id) {
    conditionalTabs.push({ id: 'quote', icon: FileText, label: t('panelTabs.quote') });
  }
  if (quoteInvoices.length > 0) {
    conditionalTabs.push({ id: 'invoices', icon: Receipt, label: t('panelTabs.invoices') });
    conditionalTabs.push({ id: 'payments', icon: CreditCard, label: t('panelTabs.payments') });
  }

  const tabs = [...baseTabs, ...conditionalTabs];

  if (!appointment) return null;

  const serviceName = appointment.services && appointment.services.length > 0
    ? appointment.services.map(s => s.name).join(', ')
    : appointment.service_name || '';

  return (
    <>
      <ResizableSheet
        open={open}
        onOpenChange={onOpenChange}
        defaultWidth={780}
        minWidth={480}
        maxWidth={1200}
        storageKey="appointment-panel-width"
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="flex-none border-b border-border bg-card px-5 py-3 pr-14">
            <SheetTitle className="text-sm font-semibold leading-tight truncate">
              {appointment.patientName}
            </SheetTitle>
            {serviceName && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{serviceName}</p>
            )}
            <SheetDescription className="sr-only">{t('panelTabs.info')}</SheetDescription>
          </div>

          {/* Body */}
          <div className="flex flex-col flex-1 overflow-hidden min-h-0">
            <VerticalTabStrip
              tabs={tabs}
              activeTabId={activeTab}
              onTabClick={(tab) => setActiveTab(tab.id)}
            />

            <div className="flex-1 overflow-auto p-4 space-y-3">
              {/* ── Info ───────────────────────────────────────────────── */}
              {activeTab === 'info' && (
                <div className="space-y-3">
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground font-medium">{tColumns('date')}</dt>
                      <dd className="font-medium">{format(parseISO(appointment.date), 'dd/MM/yyyy')}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground font-medium">{tColumns('time')}</dt>
                      <dd className="font-medium">{appointment.time} {appointment.end?.dateTime ? `→ ${format(parseISO(appointment.end.dateTime.replace(/Z$/, '')), 'HH:mm')}` : ''}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground font-medium">{tColumns('status')}</dt>
                      <dd><Badge className="capitalize text-xs">{tStatus(appointment.status.toLowerCase())}</Badge></dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground font-medium">{tColumns('calendar')}</dt>
                      <dd className="font-medium truncate">{appointment.calendar_name}</dd>
                    </div>
                    {appointment.services && appointment.services.length > 0 && (
                      <div className="col-span-2">
                        <dt className="text-xs text-muted-foreground font-medium">{t('contextMenu.services')}</dt>
                        <dd className="font-medium">{appointment.services.map(s => s.name).join(', ')}</dd>
                      </div>
                    )}
                    {appointment.notes && (
                      <div className="col-span-2">
                        <dt className="text-xs text-muted-foreground font-medium">{t('contextMenu.notes')}</dt>
                        <dd className="text-sm whitespace-pre-wrap">{appointment.notes}</dd>
                      </div>
                    )}
                  </dl>

                  <Separator />

                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => { onEdit(appointment); onOpenChange(false); }}
                    >
                      <Edit className="h-3.5 w-3.5" />
                      {tColumns('edit')}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="gap-1.5"
                      onClick={() => { onCancel(appointment); onOpenChange(false); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {t('AppointmentsColumns.cancel')}
                    </Button>
                  </div>
                </div>
              )}

              {/* ── Patient ────────────────────────────────────────────── */}
              {activeTab === 'patient' && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">{tColumns('patient')}: <span className="font-medium text-foreground">{appointment.patientName}</span></p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setIsPatientSheetOpen(true)}
                  >
                    <Users className="h-3.5 w-3.5" />
                    {t('panelTabs.openPatient')}
                  </Button>
                </div>
              )}

              {/* ── Doctor ─────────────────────────────────────────────── */}
              {activeTab === 'doctor' && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">{tColumns('doctor')}: <span className="font-medium text-foreground">{appointment.doctorName}</span></p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setIsDoctorSheetOpen(true)}
                  >
                    <UserSquare className="h-3.5 w-3.5" />
                    {t('panelTabs.openDoctor')}
                  </Button>
                </div>
              )}

              {/* ── Quote ──────────────────────────────────────────────── */}
              {activeTab === 'quote' && appointment.quote_id && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">{tColumns('quoteDocNo')}: <span className="font-mono font-medium text-foreground">{appointment.quote_doc_no}</span></p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setIsQuoteSheetOpen(true)}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    {t('panelTabs.openQuote')}
                  </Button>
                </div>
              )}

              {/* ── Invoices ───────────────────────────────────────────── */}
              {activeTab === 'invoices' && (
                <div className="space-y-2">
                  {isLoadingQuoteInfo ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : quoteInvoices.length > 0 ? (
                    quoteInvoices.map(inv => (
                      <button
                        key={inv.id}
                        type="button"
                        onClick={() => setSelectedInvoice(inv)}
                        className="flex items-center gap-1.5 font-mono text-xs rounded-lg bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 transition-colors"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        {inv.doc_no || inv.invoice_ref}
                      </button>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground italic">{t('notInvoiced')}</p>
                  )}
                </div>
              )}

              {/* ── Payments ───────────────────────────────────────────── */}
              {activeTab === 'payments' && (
                <div className="space-y-2">
                  {quoteInvoices.map(inv => (
                    <div key={inv.id} className="flex items-center justify-between p-2 rounded-lg border border-border text-sm">
                      <span className="font-mono text-xs">{inv.doc_no || inv.invoice_ref}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedInvoice(inv)}
                        className="text-xs text-primary underline-offset-2 hover:underline"
                      >
                        {t('panelTabs.viewPayments')}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Clinic Session ─────────────────────────────────────── */}
              {activeTab === 'session' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{t('linkedSession')}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1.5"
                      onClick={() => onOpenClinicSession(appointment)}
                    >
                      <Stethoscope className="h-3.5 w-3.5" />
                      {linkedSession ? t('editSession') : t('createSession')}
                    </Button>
                  </div>
                  {isLoadingLinkedSession ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : linkedSession ? (
                    <div className="rounded-xl border border-border p-3 space-y-1.5 text-sm bg-muted/20">
                      <div className="flex gap-2">
                        <span className="font-medium text-xs text-muted-foreground">{t('createDialog.date')}:</span>
                        <span>{linkedSession.fecha_sesion ? format(parseISO(linkedSession.fecha_sesion), 'dd/MM/yyyy') : '—'}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="font-medium text-xs text-muted-foreground">{tColumns('doctor')}:</span>
                        <span>{linkedSession.doctor_name || '—'}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="font-medium text-xs text-muted-foreground">{t('procedure')}:</span>
                        <span className="truncate">{linkedSession.procedimiento_realizado || '—'}</span>
                      </div>
                      {linkedSession.notas_clinicas && (
                        <div className="flex gap-2">
                          <span className="font-medium text-xs text-muted-foreground">{t('contextMenu.notes')}:</span>
                          <span className="text-muted-foreground line-clamp-3">{linkedSession.notas_clinicas}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">{t('noLinkedSession')}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </ResizableSheet>

      {/* Sub-sheets — managed internally */}
      {appointment.patientId && (
        <PatientDetailSheet
          open={isPatientSheetOpen}
          onOpenChange={setIsPatientSheetOpen}
          userId={appointment.patientId}
          userName={appointment.patientName}
          userEmail={appointment.patientEmail}
          userPhone={appointment.patientPhone}
        />
      )}
      {appointment.doctorId && (
        <DoctorDetailSheet
          open={isDoctorSheetOpen}
          onOpenChange={setIsDoctorSheetOpen}
          doctorId={appointment.doctorId}
          doctorName={appointment.doctorName ?? ''}
          doctorColor={doctorColor}
        />
      )}
      {appointment.quote_id && (
        <QuoteDetailSheet
          open={isQuoteSheetOpen}
          onOpenChange={setIsQuoteSheetOpen}
          quoteId={appointment.quote_id}
          quoteDocNo={appointment.quote_doc_no}
          patientName={appointment.patientName}
        />
      )}
      {selectedInvoice && (
        <InvoiceDetailSheet
          open={!!selectedInvoice}
          onOpenChange={(open) => { if (!open) setSelectedInvoice(null); }}
          invoice={selectedInvoice}
        />
      )}
    </>
  );
}
