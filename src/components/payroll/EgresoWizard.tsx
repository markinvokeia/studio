'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MOCK_EMPLOYEES, MOCK_EMPLOYMENTS } from '@/components/payroll/mock-data';
import { formatCurrency } from '@/components/payroll/payroll-utils';
import type { PayrollEmployee, PayrollEmployment } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

type Step = 1 | 2 | 3;
type EgresoMotivo = 'renuncia' | 'despido_sin_causa' | 'vencimiento_contrato' | 'mutuo_acuerdo';

interface EgresoWizardProps {
  initialEmployee?: PayrollEmployee;
  initialEmployments?: PayrollEmployment[];
  onClose?: () => void;
}

interface EgresoResult {
  salarioPendiente: number;
  aguinaldoProporcional: number;
  licenciaNoGozada: number;
  salarioVacacional: number;
  indemnizacion: number;
  total: number;
}

export function EgresoWizard({ initialEmployee, initialEmployments, onClose }: EgresoWizardProps = {}) {
  const t = useTranslations('PayrollPage.egreso');
  const [step, setStep] = useState<Step>(1);
  const [selectedEmployee, setSelectedEmployee] = useState(initialEmployee?.id ?? '');
  const [selectedEmployment, setSelectedEmployment] = useState(
    () => (initialEmployments ?? []).filter((e) => e.is_active)[0]?.id ?? ''
  );
  const [fechaEgreso, setFechaEgreso] = useState('');
  const [motivo, setMotivo] = useState<EgresoMotivo>('renuncia');
  const [result, setResult] = useState<EgresoResult | null>(null);

  const employee = initialEmployee ?? MOCK_EMPLOYEES.find((e) => e.id === selectedEmployee);
  const allEmployments = initialEmployments ?? MOCK_EMPLOYMENTS;
  const employments = initialEmployee
    ? allEmployments.filter((e) => e.is_active)
    : MOCK_EMPLOYMENTS.filter((e) => e.employee_id === selectedEmployee && e.is_active);
  const employment = allEmployments.find((e) => e.id === selectedEmployment);

  function handleCalculate() {
    if (!employment || !fechaEgreso) return;
    const gross = employment.sueldo_base;
    const today = new Date(fechaEgreso);
    const start = new Date(employment.fecha_inicio);
    const yearsWorked = (today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365);
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const daysWorked = today.getDate();

    const salarioPendiente = Math.round((gross / daysInMonth) * daysWorked * 100) / 100;
    const monthsInSemester = ((today.getMonth() % 6) + 1);
    const aguinaldoProporcional = Math.round((gross * monthsInSemester / 12) * 100) / 100;
    const diasLicencia = Math.round(Math.min(yearsWorked, 1) * 20 * 100) / 100;
    const jornalLiquido = Math.round((gross * 0.82 / 30) * 100) / 100;
    const licenciaNoGozada = Math.round(jornalLiquido * diasLicencia * 100) / 100;
    const salarioVacacional = Math.round(jornalLiquido * diasLicencia * 100) / 100;
    const monthsWorked = Math.floor(yearsWorked * 12);
    const indemnizacion = motivo === 'despido_sin_causa'
      ? Math.round(Math.min(Math.ceil(yearsWorked), 6) * gross * 100) / 100
      : 0;
    const total = salarioPendiente + aguinaldoProporcional + licenciaNoGozada + salarioVacacional + indemnizacion;

    setResult({ salarioPendiente, aguinaldoProporcional, licenciaNoGozada, salarioVacacional, indemnizacion, total });
    setStep(2);
    void monthsWorked; // suppress unused warning
  }

  const steps = [
    { n: 1, label: t('step1') },
    { n: 2, label: t('step2') },
    { n: 3, label: t('step3') },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-2xl">

      {/* Steps indicator */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s.n} className="flex items-center gap-2">
            <div className={cn(
              'h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold',
              step >= s.n ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            )}>
              {s.n}
            </div>
            <span className={cn('text-sm hidden sm:inline', step === s.n ? 'font-medium' : 'text-muted-foreground')}>
              {s.label}
            </span>
            {i < steps.length - 1 && <div className="h-px w-6 bg-border" />}
          </div>
        ))}
      </div>

      {/* Step 1: Select employee */}
      {step === 1 && (
        <div className="flex flex-col gap-4">
          <Card>
            <CardContent className="p-4 flex flex-col gap-4">
              {/* Employee selector — only shown when not called with a pre-selected employee */}
              {!initialEmployee && (
                <div className="space-y-1.5">
                  <Label className="text-sm">{t('selectEmployee')}</Label>
                  <Select value={selectedEmployee} onValueChange={(v) => { setSelectedEmployee(v); setSelectedEmployment(''); }}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('selectEmployeePlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {MOCK_EMPLOYEES.filter((e) => e.activo).map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.apellidos}, {e.nombres} — {e.cedula}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* When pre-selected, show employee summary */}
              {initialEmployee && (
                <div className="rounded-md border bg-muted/30 px-3 py-2.5 text-sm">
                  <p className="font-medium">{initialEmployee.apellidos}, {initialEmployee.nombres}</p>
                  {initialEmployee.cedula && (
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">{initialEmployee.cedula}</p>
                  )}
                </div>
              )}

              {/* Employment selector — standalone: show when employee selected; embedded: show when >1 active employment */}
              {(
                (!initialEmployee && selectedEmployee && employments.length > 0) ||
                (initialEmployee && employments.length > 1)
              ) && (
                <div className="space-y-1.5">
                  <Label className="text-sm">{t('selectEmployment')}</Label>
                  <Select value={selectedEmployment} onValueChange={setSelectedEmployment}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('selectEmploymentPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {employments.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.category_name} — {formatCurrency(e.sueldo_base)}/mes
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-sm">{t('fechaEgreso')}</Label>
                <Input type="date" value={fechaEgreso} onChange={(e) => setFechaEgreso(e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">{t('motivo')}</Label>
                <Select value={motivo} onValueChange={(v) => setMotivo(v as EgresoMotivo)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(['renuncia', 'despido_sin_causa', 'vencimiento_contrato', 'mutuo_acuerdo'] as const).map((m) => (
                      <SelectItem key={m} value={m}>{t(`motivos.${m}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
          <Button
            disabled={!selectedEmployee || !selectedEmployment || !fechaEgreso}
            onClick={handleCalculate}
          >
            {t('calculate')}
          </Button>
        </div>
      )}

      {/* Step 2: Review results */}
      {step === 2 && result && (
        <div className="flex flex-col gap-4">
          <Card>
            <CardContent className="p-4 flex flex-col gap-0">
              {[
                { label: t('result.salarioPendiente'), value: result.salarioPendiente },
                { label: t('result.aguinaldoProporcional'), value: result.aguinaldoProporcional },
                { label: t('result.licenciaNoGozada'), value: result.licenciaNoGozada },
                { label: t('result.salarioVacacional'), value: result.salarioVacacional },
                ...(result.indemnizacion > 0 ? [{ label: t('result.indemnizacion'), value: result.indemnizacion }] : []),
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between py-2 border-b last:border-0">
                  <span className="text-sm text-muted-foreground">{row.label}</span>
                  <span className="text-sm font-mono font-medium">{formatCurrency(row.value)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-3 mt-1">
                <span className="font-semibold">{t('result.total')}</span>
                <span className="font-bold text-lg text-green-600 dark:text-green-400">{formatCurrency(result.total)}</span>
              </div>
            </CardContent>
          </Card>
          {motivo === 'despido_sin_causa' && (
            <Badge className="w-fit bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
              {t('result.indemnizacionNote')}
            </Badge>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(1)}>{t('back')}</Button>
            <Button onClick={() => setStep(3)}>{t('confirmAndGenerate')}</Button>
          </div>
        </div>
      )}

      {/* Step 3: Confirmed */}
      {step === 3 && (
        <div className="flex flex-col items-center gap-4 py-10 text-center">
          <div className="h-14 w-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <span className="text-2xl">✓</span>
          </div>
          <h2 className="font-semibold text-lg">{t('confirmed.title')}</h2>
          <p className="text-sm text-muted-foreground max-w-sm">{t('confirmed.subtitle')}</p>
          <div className="flex gap-2">
            {initialEmployee ? (
              <Button variant="outline" onClick={onClose}>{t('confirmed.close')}</Button>
            ) : (
              <Button variant="outline" onClick={() => { setStep(1); setResult(null); setSelectedEmployee(''); setSelectedEmployment(''); setFechaEgreso(''); }}>
                {t('confirmed.new')}
              </Button>
            )}
            <Button>{t('confirmed.downloadPdf')}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
