'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { addDays, addMonths, format, parseISO } from 'date-fns';
import { AlertTriangle, ArrowLeft, CalendarCheck, CalendarClock, Check, Copy, Loader2, Lock, Mail, MessageCircle, PenLine, Printer, Receipt, Undo2 } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';

import { AppointmentFormDialog } from '@/components/appointments/AppointmentFormDialog';
import { EmailComposerDialog } from '@/components/email-composer-dialog';
import { InvoiceDetails, toPrintableInvoice, toPrintablePayment } from '@/components/users/aesthetic-record/session-billing-card';
import { WhatsAppComposerDialog } from '@/components/whatsapp-composer-dialog';
import { BUSINESS_CONFIG_PERMISSIONS, SALES_PERMISSIONS } from '@/constants/permissions';
import { useAsyncAction } from '@/hooks/use-async-action';
import { usePermissions } from '@/hooks/usePermissions';
import { usePrintDocument } from '@/hooks/usePrintDocument';
import { useToast } from '@/hooks/use-toast';
import { fetchReassignCalendars, fetchReassignDoctors } from '@/lib/appointment-reassign';
import { assessScreening, stabilityOf } from '@/lib/perio/assess';
import { computeStats, probeProgress } from '@/lib/perio/stats';
import { cn, formatDate, formatDisplayDate, formatUtcDateTime } from '@/lib/utils';
import { amendPerioExam, closePerioExam, linkPerioInvoice, type PerioExamInput } from '@/services/perio-record';
import { useBillingWizard } from '@/stores/billing-wizard-store';

import type { Calendar as CalendarType, PerioClosing, PerioExam, PerioExamStatus, PerioStats, User } from '@/lib/types';
import { PerioArch } from './perio-arch';
import { diagnosisPhrase } from './perio-diagnosis-step';
import { usePerioErrorMessage } from './perio-errors';
import { FooterSpacer, PerioStepFooter } from './perio-step-footer';

type CloseDraft = PerioExamInput & { doctorName?: string };

export interface PerioCloseStepProps {
  draft: CloseDraft;
  stored: PerioExam | null;
  status: PerioExamStatus;
  readOnly: boolean;
  /** Can register periodontograms: amendments on a closed one */
  canAmend: boolean;
  patientId: string;
  patientName?: string;
  /** The patient's initial exam, for the report ("antes") */
  initialTeeth: PerioExam['teeth'] | null;
  onNotes: (notes: string) => void;
  onClosing: (closing: PerioClosing) => void;
  ensureSaved: () => Promise<string>;
  /** The server answered with the exam (closed, invoice linked, amended) */
  onServer: (exam: PerioExam) => void;
  onRevealMissing: (field: 'pd' | 'gm') => void;
  onGoToDiagnosis: () => void;
  pendingDictation: number;
  onConfirmDictation: () => void;
}

export function PerioCloseStep(p: PerioCloseStepProps) {
  const t = useTranslations('PerioRecord');
  const { toast } = useToast();
  const describeError = usePerioErrorMessage();
  const { draft, status } = p;
  const stats = React.useMemo(() => computeStats(draft.teeth), [draft.teeth]);
  const isScreening = draft.examType === 'screening';
  const progress = probeProgress(draft.teeth, { implantsOnly: draft.examType === 'implants' });
  const sextants = assessScreening(draft.screening).coded;
  const closing: PerioClosing = draft.closing ?? {};
  const closed = status === 'closed';
  const editable = !p.readOnly && !closed;
  const [confirming, setConfirming] = React.useState(false);

  const close = useAsyncAction(async () => closePerioExam(await p.ensureSaved()), {
    onSuccess: (exam) => {
      p.onServer(exam);
      setConfirming(false);
      toast({ title: t('close.toast.closed') });
    },
    errorTitle: t('close.toast.errorTitle'),
    describeError,
  });

  const billingDone = !!p.stored?.invoice || !!closing.noCharge;
  const nextDone = !!closing.nextVisit;
  const items: [string, boolean, (() => void) | null][] = [
    ...(isScreening ? [[t('close.checklist.screening'), sextants === 6, null] as [string, boolean, null]] : [
      [t('close.checklist.depths'), progress.total > 0 && progress.pd === progress.total, () => p.onRevealMissing('pd')] as [string, boolean, () => void],
      [t('close.checklist.margin'), progress.total > 0 && progress.gm === progress.total, () => p.onRevealMissing('gm')] as [string, boolean, () => void],
    ]),
    [t('close.checklist.diagnosis'), !!draft.diagnosis?.confirmedAt, p.onGoToDiagnosis],
    [t('close.checklist.billing'), billingDone, null],
    [t('close.checklist.nextVisit'), nextDone, null],
    [t('close.checklist.dictation'), p.pendingDictation === 0, null],
  ];
  const canSign = status === 'diagnosed' && p.pendingDictation === 0 && billingDone && nextDone;
  const blocker = status === 'probing' ? t('close.notReady') : status === 'probed' ? t('close.notDiagnosed') : !billingDone ? t('close.billingPending') : !nextDone ? t('close.nextVisitPending') : p.pendingDictation ? t('close.dictationPending') : undefined;

  const kpi = (label: string, value: React.ReactNode, tone?: 'bad' | 'warn' | 'ok') => (
    <div className="flex flex-col gap-0.5 rounded-xl bg-muted/60 px-3 py-2">
      <b className={cn('text-base font-bold tabular-nums', tone === 'bad' && 'text-red-600 dark:text-red-400', tone === 'warn' && 'text-amber-600 dark:text-amber-400', tone === 'ok' && 'text-emerald-600 dark:text-emerald-400')}>{value}</b>
      <small className="text-[11px] text-muted-foreground">{label}</small>
    </div>
  );
  const mm = (v: number | null) => (v == null ? '–' : `${v.toFixed(1)} mm`);

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 p-4">
      <div>
        <h2 className="text-xl font-semibold">{t('close.title')}</h2>
        <p className="mt-1 max-w-[80ch] text-sm text-muted-foreground">{t('close.lead')}</p>
        {draft.diagnosis?.confirmedAt && (
          <p className="mt-2 text-[13px]">
            <span className="text-muted-foreground">{t('close.diagnosis')}:</span> <b className="font-semibold">{diagnosisPhrase(draft.diagnosis, t)}</b>
            {` · ${t(`diagnosis.risk.levels.${draft.diagnosis.risk}`)} · ${t('diagnosis.risk.months', { count: draft.diagnosis.maintenanceMonths })}`}
          </p>
        )}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <ReportCard {...p} stats={stats} closing={closing} editable={editable} />
        <BillingCard {...p} closing={closing} editable={editable} />
        {/* Notes next to the next visit: everything to close is in view without scrolling */}
        <div className="flex flex-col gap-4">
          <NextVisitCard {...p} closing={closing} editable={editable} />
          <section className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
            <h3 className="text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground">{t('close.notes')}</h3>
            <Textarea rows={4} value={draft.notes} readOnly={!editable} onChange={(e) => p.onNotes(e.target.value)} placeholder={t('close.notesPlaceholder')} />
          </section>
        </div>
      </div>

      {!isScreening && <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
        <h3 className="text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground">{t('close.indices')}</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {kpi(t('close.kpi.sites'), stats.sites)}
          {kpi(t('close.kpi.bop'), `${stats.bopPct}%`, stats.bopPct >= 10 ? 'warn' : 'ok')}
          {kpi(t('close.kpi.plaque'), `${stats.plaquePct}%`, stats.plaquePct > 20 ? 'warn' : 'ok')}
          {kpi(t('close.kpi.meanPd'), mm(stats.meanPd))}
          {kpi(t('close.kpi.meanCal'), mm(stats.meanCal))}
          {kpi(t('close.kpi.n4'), stats.n4, stats.n4 ? 'warn' : 'ok')}
          {kpi(t('close.kpi.n5'), stats.n5, stats.n5 ? 'bad' : 'ok')}
          {kpi(t('close.kpi.n6'), stats.n6, stats.n6 ? 'bad' : 'ok')}
          {kpi(t('close.kpi.b4'), stats.b4, stats.b4 ? 'bad' : 'ok')}
          {kpi(t('close.kpi.teeth5'), stats.teeth5, stats.teeth5 ? 'bad' : 'ok')}
        </div>
      </section>}


      {closed && p.stored && <Amendments exam={p.stored} canAmend={p.canAmend} onServer={p.onServer} />}

      <PerioStepFooter>
        <div className="flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-[12.5px]">
          {items.map(([label, ok, reveal]) => (ok || !reveal ? (
            <span key={label} className={cn('inline-flex items-center gap-1', ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400')}>
              {ok ? <Check className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}{label}
              {!ok && label === t('close.checklist.dictation') && editable && (
                <Button type="button" variant="link" size="sm" className="h-auto p-0 pl-1 text-[12.5px]" onClick={p.onConfirmDictation}>{t('close.confirmDictation')}</Button>
              )}
            </span>
          ) : (
            <button key={label} type="button" onClick={reveal} title={t('flow.missing.show')} className="inline-flex items-center gap-1 text-amber-700 underline decoration-dotted underline-offset-2 hover:text-amber-800 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5" />{label}
            </button>
          )))}
        </div>
        <FooterSpacer />
        <Button type="button" variant="outline" onClick={p.onGoToDiagnosis}><ArrowLeft className="mr-1.5 h-4 w-4" />{t('close.backToDiagnosis')}</Button>
        {!closed && (
          <Button type="button" disabled={p.readOnly || !canSign} onClick={() => setConfirming(true)} title={blocker}>
            <Lock className="mr-1.5 h-4 w-4" />{t('close.sign')}
          </Button>
        )}
      </PerioStepFooter>

      <AlertDialog open={confirming} onOpenChange={(next) => { if (!close.isPending) setConfirming(next); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('close.confirm.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('close.confirm.description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={close.isPending}>{t('close.confirm.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); close.run(); }} disabled={close.isPending}>
              {close.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('close.confirm.action')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type CardProps = PerioCloseStepProps & { closing: PerioClosing; editable: boolean };

function Card({ title, icon, done, children }: { title: string; icon: React.ReactNode; done?: boolean; children: React.ReactNode }) {
  return (
    <section className={cn('flex flex-col gap-3 rounded-2xl border bg-card p-4', done && 'border-emerald-500/40')}>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <h3 className="text-[15px] font-semibold">{title}</h3>
        {done && <Check className="ml-auto h-4 w-4 text-emerald-600" />}
      </div>
      {children}
    </section>
  );
}

// ──── Report for the patient: score, bleeding and pockets against the initial exam, one concrete tip ────

function ReportCard(p: CardProps & { stats: PerioStats }) {
  const t = useTranslations('PerioRecord.close.report');
  const tRoot = useTranslations('PerioRecord');
  const [whatsApp, setWhatsApp] = React.useState(false);
  const [email, setEmail] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const chartsRef = React.useRef<HTMLDivElement>(null);
  const before = React.useMemo(() => (p.initialTeeth ? computeStats(p.initialTeeth) : null), [p.initialTeeth]);
  const reinstrument = (p.draft.diagnosis?.plan ?? []).filter((i) => i.include && i.kind === 'reinstrumentation' && i.tooth).map((i) => i.tooth);
  const months = p.draft.diagnosis?.maintenanceMonths ?? 6;
  const tip = reinstrument.length ? t('tipTeeth', { teeth: reinstrument.join(', ') }) : p.stats.plaquePct > 20 ? t('tipPlaque') : t('tipKeep', { months });
  const firstName = (p.patientName ?? '').split(/\s+/)[0] ?? '';
  const stability = p.draft.diagnosis?.confirmedAt ? p.draft.diagnosis.stability : stabilityOf(p.stats);

  const psr = p.draft.examType === 'screening' ? assessScreening(p.draft.screening).max : null;
  // Plain words for the patient: how the gums are, bleeding and pockets against the first exam, one tip
  const lines = psr != null ? [
    t('hello', { name: firstName }),
    t('psr', { code: psr }),
    t(`psrTip.${Math.min(psr, 4)}`),
  ] : [
    t('hello', { name: firstName }),
    t(`state.${stability}`),
    before ? t('bopVs', { now: p.stats.bopPct, before: before.bopPct }) : t('bop', { now: p.stats.bopPct }),
    before ? t('pocketsVs', { now: p.stats.n5, before: before.n5 }) : t('pockets', { now: p.stats.n5 }),
    tip,
  ];
  const message = lines.join('\n');
  const markSent = () => { if (p.editable) p.onClosing({ ...p.closing, reportSentAt: new Date().toISOString() }); };

  const print = () => {
    const charts = psr == null ? chartsRef.current?.innerHTML ?? '' : '';
    printReport(tRoot('sheet.title'), p.patientName ?? '', formatDisplayDate(p.draft.date), lines, charts);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

  return (
    <Card title={t('title')} icon={<MessageCircle className="h-4 w-4" />} done={!!p.closing.reportSentAt}>
      {/* Like the output box of a chat assistant: the text, with copy in its corner */}
      <div className="relative rounded-2xl rounded-tl-sm bg-muted/70 p-3 pr-10 text-[13px] leading-relaxed">
        <button type="button" onClick={copy} className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground" aria-label={copied ? t('copied') : t('copy')} title={copied ? t('copied') : t('copy')}>
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
        {lines.map((line, i) => <p key={i} className={cn(i > 0 && 'mt-1', i === 1 && 'font-semibold')}>{line}</p>)}
      </div>
      {p.closing.reportSentAt && <p className="text-[12px] text-emerald-700 dark:text-emerald-400">{t('sentAt', { date: formatUtcDateTime(p.closing.reportSentAt) })}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => setWhatsApp(true)} disabled={!p.stored?.patientPhone} title={!p.stored?.patientPhone ? t('noPhone') : undefined}>
          <MessageCircle className="mr-1.5 h-4 w-4" />{t('whatsapp')}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={print}><Printer className="mr-1.5 h-4 w-4" />{t('print')}</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setEmail(true)} disabled={!p.stored?.patientEmail} title={!p.stored?.patientEmail ? t('noEmail') : undefined}>
          <Mail className="mr-1.5 h-4 w-4" />{t('email')}
        </Button>
      </div>
      {/* What the printout takes: the two arches as drawn on screen */}
      <div ref={chartsRef} className="hidden" aria-hidden>
        <PerioArch arch="U" teeth={p.draft.teeth} />
        <PerioArch arch="L" teeth={p.draft.teeth} />
      </div>
      {p.stored?.patientPhone && (
        <WhatsAppComposerDialog open={whatsApp} onOpenChange={setWhatsApp} phone={p.stored.patientPhone} recipientName={p.patientName} initialMessage={message} onSent={markSent} />
      )}
      {p.stored?.patientEmail && (
        <EmailComposerDialog
          open={email}
          onOpenChange={setEmail}
          to={p.stored.patientEmail}
          userId={p.patientId}
          recipientName={p.patientName}
          templateCode="PERIO_REPORT_EMAIL"
          defaultSubject={t('emailSubject')}
          defaultBody={lines.map((l) => `<p>${esc(l)}</p>`).join('')}
          onSent={markSent}
        />
      )}
    </Card>
  );
}

/** CSS custom properties of the light theme, read from the page's own stylesheets (the printout is always light) */
function lightThemeVariables(): string {
  const out: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try { rules = sheet.cssRules; } catch { continue; }
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSStyleRule && rule.selectorText === ':root') {
        for (const name of Array.from(rule.style)) if (name.startsWith('--')) out.push(`${name}:${rule.style.getPropertyValue(name)}`);
      }
    }
  }
  return `:root{${out.join(';')}}`;
}

function printReport(title: string, patient: string, date: string, lines: string[], chartsHtml: string) {
  const win = window.open('', '_blank');
  if (!win) return;
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)} · ${esc(patient)}</title>
<style>${lightThemeVariables()}
body{font-family:system-ui,sans-serif;max-width:1100px;margin:24px auto;padding:0 24px;color:#111}
h1{font-size:19px;margin:0}p.sub{margin:2px 0 14px;color:#555;font-size:13px}.report{font-size:14px;line-height:1.55;margin-bottom:12px}
svg{display:block;width:100%;height:auto;margin-bottom:8px}.pointer-events-none{pointer-events:none}@page{size:A4 landscape;margin:12mm}</style>
</head><body><h1>${esc(title)}</h1><p class="sub">${esc(patient)} · ${esc(date)}</p>
<div class="report">${lines.map((l) => `<div>${esc(l)}</div>`).join('')}</div>${chartsHtml}
<script>window.onload=function(){window.print();}</script></body></html>`);
  win.document.close();
}

// ──── Billing: one invoice per exam, made with the billing wizard; or "nothing to charge today" ────

function BillingCard(p: CardProps) {
  const t = useTranslations('PerioRecord.close.billing');
  const tPlan = useTranslations('PerioRecord.diagnosis.plan');
  const { toast } = useToast();
  const describeError = usePerioErrorMessage();
  const { hasPermission, hasAnyPermission } = usePermissions();
  const { open: openBillingWizard } = useBillingWizard();
  const { printInvoice, printPayment } = usePrintDocument();
  const invoice = p.stored?.invoice ?? null;
  const voided = p.stored?.status === 'void';
  const canCreate = hasAnyPermission([SALES_PERMISSIONS.INVOICES_CREATE, SALES_PERMISSIONS.PAYMENTS_CREATE]);
  const canPay = hasPermission(SALES_PERMISSIONS.PAYMENTS_CREATE);
  const canSeeInvoice = hasAnyPermission([SALES_PERMISSIONS.INVOICES_VIEW_LIST, SALES_PERMISSIONS.INVOICES_VIEW_DETAIL, SALES_PERMISSIONS.INVOICES_CREATE, SALES_PERMISSIONS.PAYMENTS_CREATE]);
  const today = (p.draft.diagnosis?.plan ?? []).filter((i) => i.include && i.today);

  // The invoice being charged, known before the exam is: the wizard's callback outlives this render
  const pendingRef = React.useRef<{ examId: string; invoiceId: string } | null>(null);
  const [unlinked, setUnlinked] = React.useState(false);
  const link = useAsyncAction(async () => {
    const target = pendingRef.current;
    return target ? linkPerioInvoice(target.examId, target.invoiceId) : null;
  }, {
    onSuccess: (exam) => { if (exam) { p.onServer(exam); setUnlinked(false); } },
    onError: (error) => { setUnlinked(true); toast({ variant: 'destructive', title: t('linkError'), description: describeError(error) }); },
    showErrorToast: false,
  });

  const start = useAsyncAction(async () => {
    const examId = p.stored && (p.readOnly || p.status === 'closed') ? p.stored.id : await p.ensureSaved();
    openBillingWizard(
      {
        patientId: p.patientId,
        patientName: p.patientName,
        isSales: true,
        onInvoiceCreated: async (invoiceId) => {
          pendingRef.current = { examId, invoiceId };
          await link.run();
        },
      },
      () => { void link.run(); },
    );
  }, { errorTitle: t('startError'), describeError });

  const pay = () => {
    if (!invoice || !p.stored) return;
    pendingRef.current = { examId: p.stored.id, invoiceId: invoice.id };
    openBillingWizard({ invoiceId: invoice.id, patientId: p.patientId, patientName: p.patientName, isSales: true }, () => { void link.run(); });
  };

  return (
    <Card title={t('title')} icon={<Receipt className="h-4 w-4" />} done={!!invoice || !!p.closing.noCharge}>
      {unlinked && (
        <p className="flex flex-wrap items-center gap-2 rounded-lg bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
          {t('unlinked')}
          <Button type="button" size="sm" variant="outline" className="h-6 px-2 text-xs" loading={link.isPending} onClick={() => link.run()}>{t('retry')}</Button>
        </p>
      )}
      {invoice ? (
        canSeeInvoice
          ? <InvoiceDetails invoice={invoice} items={[]} canPay={canPay && !voided} onPay={pay} onPrintInvoice={() => printInvoice(toPrintableInvoice(invoice, p.patientId, p.patientName), true)} onPrintPayment={(x) => printPayment(toPrintablePayment(x, p.patientName, invoice.currency), true)} />
          : <p className="text-sm text-muted-foreground">{t('noAccess')}</p>
      ) : (
        <>
          {today.length ? (
            <div className="flex flex-col gap-1">
              <span className="text-[11.5px] font-medium text-muted-foreground">{t('today')}</span>
              {today.map((i) => <span key={i.id} className="text-[13px]">· {tPlan(`kinds.${i.kind}`, { tooth: i.tooth ?? '', teeth: i.detail ?? '' })}</span>)}
            </div>
          ) : <p className="text-[13px] text-muted-foreground">{t('nothingToday')}</p>}
          <p className="text-[11.5px] text-muted-foreground">{t('pickServices')}</p>
          {canCreate && !voided && !unlinked && (
            <Button type="button" size="sm" className="self-start" disabled={!!p.closing.noCharge} loading={start.isPending} onClick={() => start.run()}>
              <Receipt className="mr-1.5 h-4 w-4" />{t('charge')}
            </Button>
          )}
          <label className={cn('flex items-center gap-2 text-[13px]', !p.editable && 'opacity-60')}>
            <Checkbox checked={!!p.closing.noCharge} disabled={!p.editable} onCheckedChange={(v) => p.onClosing({ ...p.closing, noCharge: v === true })} />
            {t('noCharge')}
          </label>
        </>
      )}
    </Card>
  );
}

// ──── Next visit: the kinds the plan calls for, at the suggested interval; booked or "later" ────

function NextVisitCard(p: CardProps) {
  const t = useTranslations('PerioRecord.close.next');
  const { hasPermission } = usePermissions();
  const canBook = hasPermission(BUSINESS_CONFIG_PERMISSIONS.APPOINTMENT_CREATE);
  const plan = p.draft.diagnosis?.plan ?? [];
  const months = p.draft.diagnosis?.maintenanceMonths ?? 6;
  const reinstrument = plan.filter((i) => i.include && i.kind === 'reinstrumentation' && !i.today && i.tooth).map((i) => i.tooth);
  const base = parseISO(p.draft.date);
  const options: { kind: 'maintenance' | 'reinstrumentation'; date: string; label: string; when: string }[] = [
    ...(reinstrument.length ? [{ kind: 'reinstrumentation' as const, date: formatDate(addDays(base, 14)), label: t('reinstrumentation', { teeth: reinstrument.join(', ') }), when: t('inWeeks') }] : []),
    { kind: 'maintenance', date: formatDate(addMonths(base, months)), label: t('maintenance'), when: t('inMonths', { count: months }) },
  ];
  const [picked, setPicked] = React.useState(0);
  const option = options[Math.min(picked, options.length - 1)];
  const visit = p.closing.nextVisit;

  const [booking, setBooking] = React.useState(false);
  const [calendars, setCalendars] = React.useState<CalendarType[]>([]);
  const [doctors, setDoctors] = React.useState<User[]>([]);
  const openBooking = useAsyncAction(async () => {
    if (!calendars.length) {
      const [c, d] = await Promise.all([fetchReassignCalendars(), fetchReassignDoctors()]);
      setCalendars(c);
      setDoctors(d);
    }
    setBooking(true);
  }, { errorTitle: t('loadError') });
  const patient: User = { id: p.patientId, name: p.patientName ?? '', email: '', phone_number: p.stored?.patientPhone ?? '', is_active: true, avatar: '' };

  return (
    <Card title={t('title')} icon={<CalendarClock className="h-4 w-4" />} done={!!visit}>
      {visit ? (
        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-1.5 text-[13px]">
            <CalendarCheck className="h-4 w-4 text-emerald-600" />
            {visit.mode === 'booked'
              ? visit.time ? t('bookedAt', { date: visit.date ? formatDisplayDate(visit.date) : '', time: visit.time }) : t('booked', { date: visit.date ? formatDisplayDate(visit.date) : '' })
              : t('later', { date: visit.date ? formatDisplayDate(visit.date) : '' })}
          </p>
          {visit.kind && visit.kind !== 'other' && <small className="text-[12px] text-muted-foreground">{visit.kind === 'maintenance' ? t('maintenance') : t('reinstrumentationShort')}</small>}
          {p.editable && <Button type="button" size="sm" variant="ghost" className="self-start" onClick={() => p.onClosing({ ...p.closing, nextVisit: undefined })}><Undo2 className="mr-1.5 h-3.5 w-3.5" />{t('change')}</Button>}
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1.5" role="radiogroup" aria-label={t('title')}>
            {options.map((o, i) => (
              <button key={o.kind} type="button" role="radio" aria-checked={option === o} disabled={!p.editable} onClick={() => setPicked(i)} className={cn('flex flex-col rounded-xl border px-3 py-2 text-left text-[13px] transition-colors hover:bg-muted', option === o && 'border-primary bg-primary/5')}>
                <b className="font-semibold">{o.label}</b>
                <small className="text-[12px] text-muted-foreground">{o.when} · {formatDisplayDate(o.date)}</small>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {canBook && p.editable && <Button type="button" size="sm" loading={openBooking.isPending} onClick={() => openBooking.run()}><CalendarCheck className="mr-1.5 h-4 w-4" />{t('book')}</Button>}
            <Button type="button" size="sm" variant="outline" disabled={!p.editable} onClick={() => p.onClosing({ ...p.closing, nextVisit: { mode: 'later', date: option.date, kind: option.kind } })}>{t('bookLater')}</Button>
          </div>
        </>
      )}
      {booking && (
        <AppointmentFormDialog
          open={booking}
          onOpenChange={setBooking}
          initialData={{ user: patient, date: option.date, summary: option.label }}
          readOnlyFields={{ user: true }}
          calendars={calendars}
          doctors={doctors}
          onSaveSuccess={(saved: { id?: string | number } | null, when: Date) => {
            setBooking(false);
            p.onClosing({ ...p.closing, nextVisit: { mode: 'booked', date: formatDate(when), time: format(when, 'HH:mm'), kind: option.kind, appointmentId: saved?.id != null ? String(saved.id) : undefined } });
          }}
        />
      )}
    </Card>
  );
}

// ──── Amendments of a closed exam ────

function Amendments({ exam, canAmend, onServer }: { exam: PerioExam; canAmend: boolean; onServer: (exam: PerioExam) => void }) {
  const t = useTranslations('PerioRecord.close.amend');
  const describeError = usePerioErrorMessage();
  const [open, setOpen] = React.useState(false);
  const [body, setBody] = React.useState('');
  const save = useAsyncAction(() => amendPerioExam(exam.id, body), {
    onSuccess: (next) => { onServer(next); setOpen(false); setBody(''); },
    errorTitle: t('error'),
    describeError,
  });
  return (
    <section className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <h3 className="text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground">{t('title')}</h3>
        {canAmend && <Button type="button" size="sm" variant="outline" className="ml-auto" onClick={() => setOpen(true)}><PenLine className="mr-1.5 h-4 w-4" />{t('add')}</Button>}
      </div>
      {exam.amendments.length ? exam.amendments.map((a) => (
        <div key={a.id} className="rounded-xl bg-muted/60 px-3 py-2 text-[13px]">
          <p className="whitespace-pre-wrap">{a.body}</p>
          <small className="text-[11px] text-muted-foreground">{formatUtcDateTime(a.createdAt)}{a.createdByName ? ` · ${a.createdByName}` : ''}</small>
        </div>
      )) : <p className="text-[12.5px] text-muted-foreground">{t('none')}</p>}

      <AlertDialog open={open} onOpenChange={(next) => { if (!save.isPending) setOpen(next); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('dialogTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('dialogDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder={t('placeholder')} disabled={save.isPending} />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={save.isPending}>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); save.run(); }} disabled={save.isPending || !body.trim()}>
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t('save')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
