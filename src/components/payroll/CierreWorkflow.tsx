'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency, getMonthName } from '@/components/payroll/payroll-utils';
import type { PayrollDocument, PayrollDocumentTipo, PayrollPeriod, PayrollPeriodStatus } from '@/lib/types';
import { cn } from '@/lib/utils';
import api from '@/services/api';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, CheckCircle, FileText, Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';

const STATUS_COLORS: Record<PayrollPeriodStatus, string> = {
  draft:      'bg-muted text-muted-foreground',
  calculated: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  approved:   'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  paid:       'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  closed:     'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
};

type CierreStep = 'select' | 'validate' | 'confirm' | 'done';

interface CierreWorkflowProps {
  period?: PayrollPeriod;
  onClose?: () => void;
}

export function CierreWorkflow({ period: initialPeriod, onClose }: CierreWorkflowProps = {}) {
  const t = useTranslations('PayrollPage.cierre');
  const { toast } = useToast();
  const [cierreStep, setCierreStep] = useState<CierreStep>(initialPeriod ? 'validate' : 'select');
  const [selectedPeriod, setSelectedPeriod] = useState(initialPeriod?.id ?? '');
  const [justificativo, setJustificativo] = useState('');
  const [executing, setExecuting] = useState(false);
  const [approvedPeriods, setApprovedPeriods] = useState<PayrollPeriod[]>([]);
  const [loadingPeriods, setLoadingPeriods] = useState(!initialPeriod);
  const [docs, setDocs] = useState<Record<string, PayrollDocument>>({});

  // Key documents that should exist for a complete close.
  const KEY_DOCS: PayrollDocumentTipo[] = ['planilla_sueldos', 'receipts', 'bps_nomina', 'bank_file'];

  const fetchApprovedPeriods = useCallback(async () => {
    if (initialPeriod) return;
    try {
      setLoadingPeriods(true);
      const data = await api.get(API_ROUTES.PAYROLL.PERIODS, undefined);
      const all: PayrollPeriod[] = Array.isArray(data) ? data : ((data as { periods?: PayrollPeriod[] })?.periods ?? []);
      setApprovedPeriods(all.filter((p) => p.status === 'approved' || p.status === 'paid'));
    } catch {
      setApprovedPeriods([]);
    } finally {
      setLoadingPeriods(false);
    }
  }, [initialPeriod]);

  useEffect(() => { fetchApprovedPeriods(); }, [fetchApprovedPeriods]);

  const period = initialPeriod ?? approvedPeriods.find((p) => p.id === selectedPeriod);

  // Load the period's document statuses for real validation/checklist.
  useEffect(() => {
    if (!period?.id) { setDocs({}); return; }
    api.get(API_ROUTES.PAYROLL.DOCUMENTS_BY_PERIOD, { period_id: period.id })
      .then((res) => {
        const inner = (res as { data?: PayrollDocument[] })?.data ?? res;
        const rows = Array.isArray(inner) ? (inner as PayrollDocument[]) : [];
        setDocs(Object.fromEntries(rows.map((d) => [d.tipo, d])));
      })
      .catch(() => setDocs({}));
  }, [period?.id]);

  const docOk = (tipo: PayrollDocumentTipo) => docs[tipo]?.estado === 'generado';

  const validationChecks = [
    { id: 'entries',  label: t('checks.entries'),  ok: (period?.entries_count ?? 0) > 0 },
    { id: 'planilla', label: t('checks.planilla'), ok: docOk('planilla_sueldos') },
    { id: 'receipts', label: t('checks.receipts'), ok: docOk('receipts') },
    { id: 'bps',      label: t('checks.bps'),      ok: docOk('bps_nomina') },
    { id: 'bank',     label: t('checks.bank'),     ok: docOk('bank_file') },
  ];

  const allOk = validationChecks.every((c) => c.ok);

  async function handleExecuteCierre() {
    if (!period) return;
    try {
      setExecuting(true);
      await api.post(API_ROUTES.PAYROLL.PERIODS_CLOSE, {
        id: period.id,
        justificativo: justificativo.trim(),
      });
      // Ensure the key documents are tracked so they show up in Reportes (generated there).
      await Promise.all(KEY_DOCS.filter((tipo) => !docs[tipo]).map((tipo) =>
        api.post(API_ROUTES.PAYROLL.DOCUMENTS_UPSERT, {
          period_id: period.id, clinic_id: (period as { clinic_id?: number }).clinic_id, tipo, estado: 'pendiente',
        }).catch(() => null),
      ));
      setCierreStep('done');
    } catch {
      toast({ title: 'Error', description: 'No se pudo ejecutar el cierre.', variant: 'destructive' });
    } finally {
      setExecuting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-2xl">

      {/* Step: Select period */}
      {cierreStep === 'select' && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">{t('selectPeriodInstruction')}</p>
          {loadingPeriods ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {approvedPeriods.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">{t('noPeriods')}</p>
              ) : (
                approvedPeriods.map((p) => (
                  <Card
                    key={p.id}
                    className={cn('cursor-pointer border-2 transition-colors',
                      selectedPeriod === p.id ? 'border-primary' : 'border-transparent hover:border-border'
                    )}
                    onClick={() => setSelectedPeriod(p.id)}
                  >
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium capitalize">{getMonthName(p.period_month)} {p.period_year}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {p.entries_count} liquidaciones · Bruto: {formatCurrency(p.total_gross ?? 0)}
                        </p>
                      </div>
                      <Badge className={cn('text-xs', STATUS_COLORS[p.status])}>
                        {p.status}
                      </Badge>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}
          <Button disabled={!selectedPeriod} onClick={() => setCierreStep('validate')}>
            {t('next')}
          </Button>
        </div>
      )}

      {/* Step: Validate */}
      {cierreStep === 'validate' && period && (
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm font-medium capitalize">
                {getMonthName(period.period_month)} {period.period_year}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 flex flex-col gap-0">
              {validationChecks.map((check) => (
                <div key={check.id} className="flex items-center justify-between py-2.5 border-b last:border-0">
                  <span className="text-sm">{check.label}</span>
                  {check.ok
                    ? <CheckCircle className="h-4 w-4 text-green-500" />
                    : <AlertTriangle className="h-4 w-4 text-amber-500" />
                  }
                </div>
              ))}
            </CardContent>
          </Card>
          {!allOk && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/10 p-3">
              <p className="text-xs text-amber-700 dark:text-amber-400">{t('warningProceed')}</p>
            </div>
          )}
          <div className="flex gap-2">
            {!initialPeriod && <Button variant="outline" onClick={() => setCierreStep('select')}>{t('back')}</Button>}
            <Button onClick={() => setCierreStep('confirm')}>{t('proceedToClose')}</Button>
          </div>
        </div>
      )}

      {/* Step: Confirm */}
      {cierreStep === 'confirm' && period && (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Lock className="h-4 w-4 text-destructive" />
              <p className="text-sm font-medium text-destructive">{t('confirmWarning')}</p>
            </div>
            <p className="text-xs text-muted-foreground">{t('confirmWarningDetail')}</p>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">{t('documentsTitle')}:</p>
            {KEY_DOCS.map((tipo) => (
              <div key={tipo} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  {t(`docTypes.${tipo}` as Parameters<typeof t>[0])}
                </span>
                <Badge className={cn('text-[10px]', docOk(tipo)
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400')}>
                  {docOk(tipo) ? t('docGenerated') : t('docPending')}
                </Badge>
              </div>
            ))}
            <p className="text-xs text-muted-foreground mt-1">{t('documentsHint')}</p>
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">{t('justificativo')}</p>
            <Textarea
              placeholder={t('justificativoPlaceholder')}
              value={justificativo}
              onChange={(e) => setJustificativo(e.target.value)}
              rows={3}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setCierreStep('validate')}>{t('back')}</Button>
            <Button variant="destructive" disabled={!justificativo.trim() || executing} onClick={handleExecuteCierre}>
              <Lock className="h-4 w-4 mr-1.5" />
              {executing ? '...' : t('executeCierre')}
            </Button>
          </div>
        </div>
      )}

      {/* Step: Done */}
      {cierreStep === 'done' && (
        <div className="flex flex-col items-center gap-4 py-10 text-center">
          <div className="h-14 w-14 rounded-full bg-gray-100 dark:bg-gray-900/30 flex items-center justify-center">
            <Lock className="h-6 w-6 text-gray-600 dark:text-gray-400" />
          </div>
          <h2 className="font-semibold text-lg">{t('done.title')}</h2>
          <p className="text-sm text-muted-foreground max-w-sm">{t('done.subtitle')}</p>
          {initialPeriod ? (
            <Button variant="outline" onClick={onClose}>{t('done.close')}</Button>
          ) : (
            <Button variant="outline" onClick={() => { setCierreStep('select'); setSelectedPeriod(''); setJustificativo(''); }}>
              {t('done.new')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
