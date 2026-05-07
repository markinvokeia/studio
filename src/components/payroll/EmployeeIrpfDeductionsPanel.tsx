'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { API_ROUTES } from '@/constants/routes';
import { api } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import type { PayrollIrpfDeduction } from '@/lib/types';
import { formatCurrency, formatDate, toDateInput } from '@/components/payroll/payroll-utils';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';

const TIPOS = ['bhu_anv', 'caja_profesional', 'alimentos', 'alquiler', 'otro'] as const;
type Tipo = typeof TIPOS[number];

interface Props {
  /** Employee user_id (the by-employee/upsert endpoints resolve it to the real employee_id). */
  userId: string;
  readonly?: boolean;
  /** Called after a change persists, so the parent can react (e.g. hint a recalc). */
  onChanged?: () => void;
}

const emptyForm = () => ({
  id: '', tipo: 'otro' as Tipo, descripcion: '', monto_mensual: '',
  vigente_desde: new Date().toISOString().slice(0, 10), vigente_hasta: '',
});

export function EmployeeIrpfDeductionsPanel({ userId, readonly, onChanged }: Props) {
  const t = useTranslations('PayrollPage.legajo.deducciones');
  const { toast } = useToast();
  const [items, setItems] = useState<PayrollIrpfDeduction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) { setItems([]); setLoading(false); return; }
    setLoading(true);
    try {
      const res = await api.get(API_ROUTES.PAYROLL.RETENCIONES_BY_EMPLOYEE, { employee_id: userId });
      const inner = (res as { data?: unknown })?.data ?? res ?? [];
      setItems(Array.isArray(inner) ? (inner as PayrollIrpfDeduction[]) : []);
    } catch { setItems([]); }
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const total = items.reduce((s, d) => s + Number(d.monto_mensual || 0), 0);

  function openNew() { setForm(emptyForm()); setShowForm(true); }
  function openEdit(d: PayrollIrpfDeduction) {
    setForm({
      id: d.id, tipo: d.tipo as Tipo, descripcion: d.descripcion ?? '',
      monto_mensual: String(d.monto_mensual ?? ''),
      vigente_desde: toDateInput(d.vigente_desde), vigente_hasta: toDateInput(d.vigente_hasta),
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.descripcion || !form.monto_mensual) return;
    setSaving(true);
    try {
      await api.post(API_ROUTES.PAYROLL.RETENCIONES_UPSERT, {
        id: form.id || undefined,
        employee_id: userId,
        tipo: form.tipo,
        descripcion: form.descripcion,
        monto_mensual: Number(form.monto_mensual) || 0,
        vigente_desde: form.vigente_desde,
        vigente_hasta: form.vigente_hasta || undefined,
      });
      setShowForm(false);
      await load();
      onChanged?.();
    } catch {
      toast({ title: t('saveError'), variant: 'destructive' });
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      await api.post(API_ROUTES.PAYROLL.RETENCIONES_DELETE, { id });
      await load();
      onChanged?.();
    } catch {
      toast({ title: t('saveError'), variant: 'destructive' });
    } finally { setDeleting(null); }
  }

  const tipoLabel = (tp: string) =>
    t.has(`tipos.${tp}` as Parameters<typeof t>[0]) ? t(`tipos.${tp}` as Parameters<typeof t>[0]) : tp;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">
          {t('title')}
          {items.length > 0 && <span className="ml-1.5 text-[10px] text-muted-foreground/70">{t('totalMonthly')}: {formatCurrency(total)}</span>}
        </p>
        {!readonly && (
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={openNew}>
            <Plus className="h-3 w-3 mr-1" />
            {t('addNew')}
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground/70">…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground/70">{t('none')}</p>
      ) : (
        <div className="flex flex-col gap-1">
          {items.map((d) => (
            <div key={d.id} className="flex items-center justify-between rounded-md border px-3 py-1.5 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <Badge variant="outline" className="text-[10px] shrink-0">{tipoLabel(d.tipo)}</Badge>
                <span className="truncate">{d.descripcion}</span>
                <span className="text-muted-foreground/70 shrink-0 hidden sm:inline">
                  {formatDate(d.vigente_desde)}{d.vigente_hasta ? ` → ${formatDate(d.vigente_hasta)}` : ''}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono font-medium">{formatCurrency(d.monto_mensual)}</span>
                {!readonly && (
                  <>
                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground" onClick={() => openEdit(d)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
                      disabled={deleting === d.id} onClick={() => handleDelete(d.id)}>
                      {deleting === d.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && !readonly && (
        <div className="rounded-lg border bg-muted/30 p-3 flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">{t('tipo')}</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm((f) => ({ ...f, tipo: v as Tipo }))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map((tp) => <SelectItem key={tp} value={tp}>{tipoLabel(tp)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('monto')}</Label>
              <Input type="number" min={0} step="0.01" value={form.monto_mensual}
                onChange={(e) => setForm((f) => ({ ...f, monto_mensual: e.target.value }))} className="h-8 text-sm" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t('descripcion')}</Label>
            <Input value={form.descripcion} onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))} className="h-8 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">{t('desde')}</Label>
              <Input type="date" value={form.vigente_desde} onChange={(e) => setForm((f) => ({ ...f, vigente_desde: e.target.value }))} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('hasta')}</Label>
              <Input type="date" value={form.vigente_hasta} onChange={(e) => setForm((f) => ({ ...f, vigente_hasta: e.target.value }))} className="h-8 text-sm" />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" className="flex-1 h-8 text-xs" onClick={handleSave} disabled={saving || !form.descripcion || !form.monto_mensual}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t('save')}
            </Button>
            <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => setShowForm(false)}>{t('cancel')}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
