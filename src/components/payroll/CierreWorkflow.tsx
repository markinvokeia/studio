'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { MOCK_PERIODS } from '@/components/payroll/mock-data';
import { formatCurrency, getMonthName } from '@/components/payroll/payroll-utils';
import type { PayrollPeriod, PayrollPeriodStatus } from '@/lib/types';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle, FileText, Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

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
  const [cierreStep, setCierreStep] = useState<CierreStep>(initialPeriod ? 'validate' : 'select');
  const [selectedPeriod, setSelectedPeriod] = useState(initialPeriod?.id ?? '');
  const [justificativo, setJustificativo] = useState('');

  const approvedPeriods = MOCK_PERIODS.filter((p) => p.status === 'approved' || p.status === 'paid');
  const period = initialPeriod ?? MOCK_PERIODS.find((p) => p.id === selectedPeriod);

  const validationChecks = [
    { id: 'entries', label: t('checks.entries'), ok: true },
    { id: 'honorarios', label: t('checks.honorarios'), ok: true },
    { id: 'novedades', label: t('checks.novedades'), ok: true },
    { id: 'receipts', label: t('checks.receipts'), ok: false },
    { id: 'bps', label: t('checks.bps'), ok: false },
  ];

  const allOk = validationChecks.every((c) => c.ok);

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-2xl">

      {/* Step: Select period */}
      {cierreStep === 'select' && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">{t('selectPeriodInstruction')}</p>
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
            <Button variant="outline" onClick={() => setCierreStep('select')}>{t('back')}</Button>
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
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium">{t('actionsOnClose')}:</p>
            {[t('action.generateReceipts'), t('action.generateBPS'), t('action.generateBank'), t('action.lockPeriod')].map((a, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-3.5 w-3.5 shrink-0" />
                {a}
              </div>
            ))}
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
            <Button variant="destructive" disabled={!justificativo.trim()} onClick={() => setCierreStep('done')}>
              <Lock className="h-4 w-4 mr-1.5" />
              {t('executeCierre')}
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
