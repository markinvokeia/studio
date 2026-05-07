'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CalculationType, ContractType, DoctorContract, PercentageBasis } from '@/lib/types';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

interface Props {
  open: boolean;
  contract: DoctorContract | null;
  onClose: () => void;
  onSave: (contract: DoctorContract) => void;
}

const CONTRACT_TYPES: ContractType[] = ['empleado', 'arrendamiento', 'honorarios', 'empresa_unipersonal', 'mixto'];
const CALCULATION_TYPES: CalculationType[] = ['fijo', 'por_hora', 'porcentaje', 'fijo_porcentaje', 'por_prestacion'];
const PERCENTAGE_BASIS: PercentageBasis[] = ['sobre_cobrado', 'sobre_realizado'];

const EMPTY_CONTRACT: Omit<DoctorContract, 'id'> = {
  doctor_id: '',
  doctor_name: '',
  contract_type: 'arrendamiento',
  calculation_type: 'porcentaje',
  percentage_rate: 60,
  percentage_basis: 'sobre_cobrado',
  currency: 'UYU',
  has_children: false,
  valid_from: new Date().toISOString().slice(0, 10),
  is_active: true,
};

export function ContractFormDialog({ open, contract, onClose, onSave }: Props) {
  const t = useTranslations('PayrollPage.contracts');
  const [form, setForm] = useState<Omit<DoctorContract, 'id'>>(EMPTY_CONTRACT);

  useEffect(() => {
    if (contract) {
      setForm(contract);
    } else {
      setForm(EMPTY_CONTRACT);
    }
  }, [contract, open]);

  function set<K extends keyof DoctorContract>(key: K, value: DoctorContract[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const needsBase = ['fijo', 'fijo_porcentaje'].includes(form.calculation_type);
  const needsHourly = form.calculation_type === 'por_hora';
  const needsPercentage = ['porcentaje', 'fijo_porcentaje'].includes(form.calculation_type);
  const needsPerSession = form.calculation_type === 'por_prestacion';

  function handleSubmit() {
    onSave({ ...form, id: contract?.id ?? '' } as DoctorContract);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('formTitle')}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Doctor name */}
          <div className="space-y-1.5">
            <Label>{t('doctor')}</Label>
            <Input
              value={form.doctor_name ?? ''}
              onChange={(e) => set('doctor_name', e.target.value)}
              placeholder={t('selectDoctor')}
            />
          </div>

          {/* Contract type */}
          <div className="space-y-1.5">
            <Label>{t('contractTypeLabel')}</Label>
            <Select value={form.contract_type} onValueChange={(v) => set('contract_type', v as ContractType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CONTRACT_TYPES.map((ct) => (
                  <SelectItem key={ct} value={ct}>{t(`contractTypes.${ct}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Calculation type */}
          <div className="space-y-1.5">
            <Label>{t('calculationTypeLabel')}</Label>
            <Select value={form.calculation_type} onValueChange={(v) => set('calculation_type', v as CalculationType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CALCULATION_TYPES.map((ct) => (
                  <SelectItem key={ct} value={ct}>{t(`calculationTypes.${ct}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Conditional fields */}
          {needsBase && (
            <div className="space-y-1.5">
              <Label>{t('baseSalary')} ({form.currency})</Label>
              <Input
                type="number"
                value={form.base_salary ?? ''}
                onChange={(e) => set('base_salary', Number(e.target.value))}
                min={0}
              />
            </div>
          )}

          {needsHourly && (
            <div className="space-y-1.5">
              <Label>{t('hourlyRate')} ({form.currency})</Label>
              <Input
                type="number"
                value={form.hourly_rate ?? ''}
                onChange={(e) => set('hourly_rate', Number(e.target.value))}
                min={0}
              />
            </div>
          )}

          {needsPercentage && (
            <>
              <div className="space-y-1.5">
                <Label>{t('percentageRate')}</Label>
                <Input
                  type="number"
                  value={form.percentage_rate ?? ''}
                  onChange={(e) => set('percentage_rate', Number(e.target.value))}
                  min={0}
                  max={100}
                  step={0.5}
                />
              </div>
              {form.calculation_type === 'fijo_porcentaje' && (
                <div className="space-y-1.5">
                  <Label>{t('percentageThreshold')} ({form.currency})</Label>
                  <Input
                    type="number"
                    value={form.percentage_threshold ?? ''}
                    onChange={(e) => set('percentage_threshold', Number(e.target.value))}
                    min={0}
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label>{t('percentageBasis')}</Label>
                <Select
                  value={form.percentage_basis ?? 'sobre_cobrado'}
                  onValueChange={(v) => set('percentage_basis', v as PercentageBasis)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PERCENTAGE_BASIS.map((pb) => (
                      <SelectItem key={pb} value={pb}>{t(`percentageBasisOptions.${pb}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {needsPerSession && (
            <div className="space-y-1.5">
              <Label>{t('perSessionRate')} ({form.currency})</Label>
              <Input
                type="number"
                value={form.per_session_rate ?? ''}
                onChange={(e) => set('per_session_rate', Number(e.target.value))}
                min={0}
              />
            </div>
          )}

          {/* Currency */}
          <div className="space-y-1.5">
            <Label>{t('currency')}</Label>
            <Select value={form.currency} onValueChange={(v) => set('currency', v as 'UYU' | 'USD')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="UYU">UYU — Peso Uruguayo</SelectItem>
                <SelectItem value="USD">USD — Dólar</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* FONASA hijos — only for empleado */}
          {form.contract_type === 'empleado' && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.has_children}
                onChange={(e) => set('has_children', e.target.checked)}
                className="h-4 w-4 rounded"
              />
              <span className="text-sm">{t('hasChildren')}</span>
            </label>
          )}

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t('validFromLabel')}</Label>
              <Input
                type="date"
                value={form.valid_from}
                onChange={(e) => set('valid_from', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('validUntilLabel')}</Label>
              <Input
                type="date"
                value={form.valid_until ?? ''}
                onChange={(e) => set('valid_until', e.target.value || undefined)}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>{t('notes')}</Label>
            <textarea
              value={form.notes ?? ''}
              onChange={(e) => set('notes', e.target.value)}
              rows={2}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('cancel')}</Button>
          <Button onClick={handleSubmit}>{t('save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
