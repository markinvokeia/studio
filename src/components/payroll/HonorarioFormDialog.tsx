'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { formatCurrency, getMonthName } from '@/components/payroll/payroll-utils';
import type { PayrollHonorario, PayrollPeriod } from '@/lib/types';
import api from '@/services/api';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

interface ProfessionalOption { id: string; name: string }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  periods: PayrollPeriod[];
  defaultPeriodId?: string;
  /** When set, the dialog edits this honorario's amounts (period/professional locked). */
  honorario?: PayrollHonorario | null;
  onSaved: (saved?: PayrollHonorario) => void;
}

const MODALIDADES: PayrollHonorario['modalidad'][] = ['honorarios', 'empresa_unipersonal', 'sociedad'];

const blank = {
  payroll_period_id: '', user_id: '', doctor_rut: '', modalidad: 'honorarios' as PayrollHonorario['modalidad'],
  produccion_base: '', porcentaje: '', bruto: '', iva: '', retenciones: '', descuentos: '', notas: '',
};

export function HonorarioFormDialog({ open, onOpenChange, periods, defaultPeriodId, honorario, onSaved }: Props) {
  const t = useTranslations('PayrollPage.honorarios');
  const tf = useTranslations('PayrollPage.honorarios.form');
  const { toast } = useToast();
  const isEdit = !!honorario;

  const [form, setForm] = useState(blank);
  const [professionals, setProfessionals] = useState<ProfessionalOption[]>([]);
  const [saving, setSaving] = useState(false);

  // Reset / prefill whenever the dialog opens.
  useEffect(() => {
    if (!open) return;
    if (honorario) {
      setForm({
        payroll_period_id: honorario.payroll_period_id,
        user_id: honorario.user_id,
        doctor_rut: honorario.doctor_rut ?? '',
        modalidad: honorario.modalidad,
        produccion_base: String(honorario.produccion_base ?? ''),
        porcentaje: String(honorario.porcentaje ?? ''),
        bruto: String(honorario.bruto ?? ''),
        iva: String(honorario.iva ?? ''),
        retenciones: String(honorario.retenciones ?? ''),
        descuentos: String(honorario.descuentos ?? ''),
        notas: honorario.notes ?? '',
      });
    } else {
      setForm({ ...blank, payroll_period_id: defaultPeriodId ?? '' });
    }
  }, [open, honorario, defaultPeriodId]);

  // Load the professional list only in create mode.
  useEffect(() => {
    if (!open || isEdit) return;
    api.get(API_ROUTES.PAYROLL.USERS).then((raw) => {
      const arr = Array.isArray(raw) ? raw : ((raw as { data?: unknown[]; users?: unknown[] })?.data ?? (raw as { users?: unknown[] })?.users ?? []);
      setProfessionals((arr as Array<{ id: string; name: string }>).map((u) => ({ id: String(u.id), name: u.name })));
    }).catch(() => setProfessionals([]));
  }, [open, isEdit]);

  const n = (v: string) => Number(v) || 0;
  const liquido = n(form.bruto) + n(form.iva) - n(form.retenciones) - n(form.descuentos);

  async function handleSave() {
    if (!form.payroll_period_id || !form.user_id) {
      toast({ title: tf('requiredFields'), variant: 'destructive' });
      return;
    }
    const period = periods.find((p) => p.id === form.payroll_period_id);
    try {
      setSaving(true);
      const res = await api.post(API_ROUTES.PAYROLL.HONORARIOS_UPSERT, {
        id: honorario?.id,
        payroll_period_id: form.payroll_period_id,
        user_id: form.user_id,
        doctor_rut: form.doctor_rut || undefined,
        modalidad: form.modalidad,
        clinic_id: honorario?.clinic_id ?? (period as { clinic_id?: number } | undefined)?.clinic_id,
        produccion_base: n(form.produccion_base),
        porcentaje: n(form.porcentaje),
        bruto: n(form.bruto),
        iva: n(form.iva),
        retenciones: n(form.retenciones),
        descuentos: n(form.descuentos),
        notes: form.notas || undefined,
      });
      const saved = (Array.isArray(res) ? res[0] : ((res as { data?: unknown[] })?.data?.[0] ?? res)) as PayrollHonorario | undefined;
      toast({ title: tf('saved') });
      onSaved(saved && saved.id ? { ...honorario, ...saved } as PayrollHonorario : undefined);
      onOpenChange(false);
    } catch {
      toast({ title: tf('errorSave'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? tf('editTitle') : tf('addTitle')}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 px-6 py-4 overflow-y-auto">
          {/* Período (solo en alta — en edición queda fijo) */}
          {!isEdit && (
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">{tf('period')}</Label>
              <Select value={form.payroll_period_id} onValueChange={(v) => setForm((f) => ({ ...f, payroll_period_id: v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder={tf('selectPeriod')} /></SelectTrigger>
                <SelectContent>
                  {periods.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{getMonthName(p.period_month)} {p.period_year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Profesional */}
          <div className="space-y-1 col-span-2">
            <Label className="text-xs">{tf('professional')}</Label>
            {isEdit ? (
              <Input value={honorario?.doctor_name ?? ''} disabled className="h-9" />
            ) : (
              <Select value={form.user_id} onValueChange={(v) => setForm((f) => ({ ...f, user_id: v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder={tf('selectProfessional')} /></SelectTrigger>
                <SelectContent>
                  {professionals.map((u) => (<SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Modalidad + RUT */}
          <div className="space-y-1">
            <Label className="text-xs">{tf('modalidad')}</Label>
            <Select value={form.modalidad} onValueChange={(v) => setForm((f) => ({ ...f, modalidad: v as PayrollHonorario['modalidad'] }))}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MODALIDADES.map((m) => (<SelectItem key={m} value={m}>{t(`modalidades.${m}`)}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{tf('rut')}</Label>
            <Input value={form.doctor_rut} onChange={set('doctor_rut')} className="h-9" />
          </div>

          {/* Amounts */}
          <div className="space-y-1">
            <Label className="text-xs">{tf('produccionBase')}</Label>
            <Input type="number" step="0.01" min={0} value={form.produccion_base} onChange={set('produccion_base')} className="h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{tf('porcentaje')}</Label>
            <Input type="number" step="0.01" min={0} value={form.porcentaje} onChange={set('porcentaje')} className="h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{tf('bruto')}</Label>
            <Input type="number" step="0.01" min={0} value={form.bruto} onChange={set('bruto')} className="h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{tf('iva')}</Label>
            <Input type="number" step="0.01" min={0} value={form.iva} onChange={set('iva')} className="h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{tf('retenciones')}</Label>
            <Input type="number" step="0.01" min={0} value={form.retenciones} onChange={set('retenciones')} className="h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{tf('descuentos')}</Label>
            <Input type="number" step="0.01" min={0} value={form.descuentos} onChange={set('descuentos')} className="h-9" />
          </div>

          <div className="space-y-1 col-span-2">
            <Label className="text-xs">{tf('notas')}</Label>
            <Input value={form.notas} onChange={set('notas')} className="h-9" />
          </div>

          {/* Líquido preview */}
          <div className="col-span-2 flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
            <span className="text-xs text-muted-foreground">{tf('liquidoPreview')}</span>
            <span className="text-sm font-semibold text-green-600 dark:text-green-400 tabular-nums">{formatCurrency(liquido)}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{tf('cancel')}</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}{tf('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
