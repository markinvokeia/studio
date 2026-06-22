'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useNarrowMode } from '@/components/layout/two-panel-layout';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { DateRangePresets } from '@/components/reports/date-range-presets';
import { PayrollListToolbar } from '@/components/payroll/PayrollListToolbar';
import { API_ROUTES } from '@/constants/routes';
import { api } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import type { PayrollWorkLog } from '@/lib/types';
import { formatCurrency, formatDate } from '@/components/payroll/payroll-utils';
import { cn } from '@/lib/utils';
import type { ColumnDef } from '@tanstack/react-table';
import { format, endOfMonth, startOfMonth } from 'date-fns';
import { Loader2, Plus, Settings2, Sparkles, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DateRange } from 'react-day-picker';

interface Props {
  /** Employee user_id (the worklog endpoints resolve it to the real employee_id). */
  userId: string;
  readonly?: boolean;
  onChanged?: () => void;
  /** Optional initial date range (e.g. a payroll period). Defaults to the current month. */
  initialRange?: DateRange;
}

const iso = (d?: Date) => d ? format(d, 'yyyy-MM-dd') : '';
const num = (v: number | null | undefined) => Number(v ?? 0);
const emptyForm = () => ({
  id: '', fecha: format(new Date(), 'yyyy-MM-dd'),
  horas_normales: '', horas_extra_habiles: '', horas_extra_feriados: '',
  sesiones: '', produccion_facturada: '', produccion_listada: '', notas: '',
});

export function WorkLogPanel({ userId, readonly, onChanged, initialRange }: Props) {
  const t = useTranslations('PayrollPage.legajo.jornadas');
  const { toast } = useToast();
  const { isNarrow } = useNarrowMode();
  const isViewportNarrow = useViewportNarrow();

  const [range, setRange] = useState<DateRange | undefined>(initialRange ?? { from: startOfMonth(new Date()), to: endOfMonth(new Date()) });
  const [items, setItems] = useState<PayrollWorkLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isCardMode, setIsCardMode] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [prepop, setPrepop] = useState(false);

  const fromIso = iso(range?.from);
  const toIso = iso(range?.to);

  const load = useCallback(async () => {
    if (!userId || !fromIso || !toIso) { setItems([]); setLoading(false); return; }
    setLoading(true);
    try {
      const res = await api.get(API_ROUTES.PAYROLL.WORKLOG_BY_EMPLOYEE, { employee_id: userId, date_from: fromIso, date_to: toIso });
      const inner = (res as { data?: unknown })?.data ?? res ?? [];
      setItems(Array.isArray(inner) ? (inner as PayrollWorkLog[]) : []);
    } catch { setItems([]); }
    finally { setLoading(false); }
  }, [userId, fromIso, toIso]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => items.filter((w) =>
    !search || `${formatDate(w.fecha)} ${w.notas ?? ''}`.toLowerCase().includes(search.toLowerCase())
  ), [items, search]);

  const totals = filtered.reduce((a, w) => ({
    dias: a.dias + 1,
    horas: a.horas + num(w.horas_normales),
    extraH: a.extraH + num(w.horas_extra_habiles),
    extraF: a.extraF + num(w.horas_extra_feriados),
    prod: a.prod + num(w.produccion_facturada),
  }), { dias: 0, horas: 0, extraH: 0, extraF: 0, prod: 0 });

  const showCardMode = isCardMode || isNarrow || isViewportNarrow;

  function openNew() { setForm(emptyForm()); setDialogOpen(true); }
  function openEdit(w: PayrollWorkLog) {
    setForm({
      id: w.id, fecha: (w.fecha ?? '').slice(0, 10),
      horas_normales: String(w.horas_normales ?? ''), horas_extra_habiles: String(w.horas_extra_habiles ?? ''),
      horas_extra_feriados: String(w.horas_extra_feriados ?? ''), sesiones: String(w.sesiones ?? ''),
      produccion_facturada: String(w.produccion_facturada ?? ''), produccion_listada: String(w.produccion_listada ?? ''),
      notas: w.notas ?? '',
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.fecha) return;
    setSaving(true);
    try {
      await api.post(API_ROUTES.PAYROLL.WORKLOG_UPSERT, {
        id: form.id || undefined, user_id: userId, fecha: form.fecha,
        horas_normales: Number(form.horas_normales) || 0, horas_extra_habiles: Number(form.horas_extra_habiles) || 0,
        horas_extra_feriados: Number(form.horas_extra_feriados) || 0, sesiones: Number(form.sesiones) || 0,
        produccion_facturada: Number(form.produccion_facturada) || 0, produccion_listada: Number(form.produccion_listada) || 0,
        notas: form.notas,
      });
      setDialogOpen(false); await load(); onChanged?.();
    } catch { toast({ title: t('saveError'), variant: 'destructive' }); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!form.id) return;
    setDeleting(true);
    try { await api.post(API_ROUTES.PAYROLL.WORKLOG_DELETE, { id: form.id }); setDialogOpen(false); await load(); onChanged?.(); }
    catch { toast({ title: t('saveError'), variant: 'destructive' }); }
    finally { setDeleting(false); }
  }

  async function handlePrepopulate() {
    if (!fromIso || !toIso) return;
    setPrepop(true);
    try {
      await api.post(API_ROUTES.PAYROLL.WORKLOG_PREPOPULATE, { user_id: userId, date_from: fromIso, date_to: toIso });
      await load(); onChanged?.();
    } catch { toast({ title: t('prepopulateError'), variant: 'destructive' }); }
    finally { setPrepop(false); }
  }

  const columns = useMemo<ColumnDef<PayrollWorkLog>[]>(() => [
    { id: 'fecha', header: t('date'), accessorKey: 'fecha', cell: ({ row }) => <span className="text-xs font-medium">{formatDate(row.original.fecha)}</span> },
    { id: 'horas', header: t('normalHours'), accessorKey: 'horas_normales', cell: ({ row }) => <span className="font-mono text-xs text-right block">{num(row.original.horas_normales)}h</span> },
    { id: 'extraH', header: t('extraHabil'), accessorKey: 'horas_extra_habiles', cell: ({ row }) => <span className="font-mono text-xs text-right block text-amber-600 dark:text-amber-400">{num(row.original.horas_extra_habiles) || '—'}</span> },
    { id: 'extraF', header: t('extraFeriado'), accessorKey: 'horas_extra_feriados', cell: ({ row }) => <span className="font-mono text-xs text-right block text-red-600 dark:text-red-400">{num(row.original.horas_extra_feriados) || '—'}</span> },
    { id: 'sesiones', header: t('sessions'), accessorKey: 'sesiones', cell: ({ row }) => <span className="text-xs text-right block text-muted-foreground">{num(row.original.sesiones) || '—'}</span> },
    { id: 'prod', header: t('billed'), accessorKey: 'produccion_facturada', cell: ({ row }) => <span className="font-mono text-xs text-right block">{num(row.original.produccion_facturada) ? formatCurrency(row.original.produccion_facturada) : '—'}</span> },
    { id: 'origen', header: t('origin'), accessorKey: 'origen', cell: ({ row }) => row.original.origen === 'auto' ? <Badge variant="outline" className="text-[9px]">{t('auto')}</Badge> : null },
  ], [t]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <DataTable
        columns={columns}
        data={filtered}
        isLoading={loading}
        isNarrow={showCardMode}
        compact
        enableSingleRowSelection
        onRowClick={(w) => !readonly && openEdit(w)}
        getRowClassName={() => readonly ? '' : 'cursor-pointer'}
        renderCard={(w, isSelected) => (
          <div className={cn(
            'rounded-xl border bg-card px-3 py-2.5 shadow-sm transition-all',
            !readonly && 'cursor-pointer hover:shadow-md',
            isSelected ? 'border-primary/60 bg-primary/5 ring-1 ring-primary/20' : 'border-border',
          )}>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-sm font-semibold">{formatDate(w.fecha)}</span>
              {w.origen === 'auto' && <Badge variant="outline" className="text-[9px] shrink-0">{t('auto')}</Badge>}
            </div>
            {/* Inline fields — wrap to next line as the card width allows */}
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
              {[
                [t('normalHours'), `${num(w.horas_normales)}h`],
                [t('extraHabil'), num(w.horas_extra_habiles) ? `${w.horas_extra_habiles}h` : '—'],
                [t('extraFeriado'), num(w.horas_extra_feriados) ? `${w.horas_extra_feriados}h` : '—'],
                [t('sessions'), num(w.sesiones) || '—'],
                [t('billed'), num(w.produccion_facturada) ? formatCurrency(w.produccion_facturada) : '—'],
              ].map(([label, value]) => (
                <span key={label} className="whitespace-nowrap">
                  <span className="text-muted-foreground">{label}:</span> <span className="font-medium">{value}</span>
                </span>
              ))}
            </div>
          </div>
        )}
        customToolbar={(table, paginationNode) => (
          <PayrollListToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder={t('searchPlaceholder')}
            viewMode={isCardMode ? 'card' : 'table'}
            onViewModeChange={(m) => setIsCardMode(m === 'card')}
            showViewToggle={!isViewportNarrow && !isNarrow}
            filterSlot={<DateRangePresets value={range} onChange={setRange} />}
            columnsSlot={!showCardMode && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-8 w-8 shrink-0"><Settings2 className="h-3.5 w-3.5" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {(table as any).getAllColumns().filter((col: any) => col.getCanHide()).map((col: any) => (
                    <DropdownMenuCheckboxItem key={col.id} checked={col.getIsVisible()} onCheckedChange={(val) => col.toggleVisibility(!!val)}>
                      {typeof col.columnDef.header === 'string' ? col.columnDef.header : col.id}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            actions={!readonly && (
              <>
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handlePrepopulate} disabled={prepop} title={t('prepopulate')}>
                  {prepop ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
                  <span className="payroll-toolbar__btn-label">{t('prepopulate')}</span>
                </Button>
                <Button size="sm" className="h-8 text-xs" onClick={openNew} title={t('addDay')}>
                  <Plus className="h-3 w-3 mr-1" />
                  <span className="payroll-toolbar__btn-label">{t('addDay')}</span>
                </Button>
              </>
            )}
            paginationNode={paginationNode}
          />
        )}
      />

      {/* Totals footer — always visible */}
      <div className="flex-none border-t bg-background px-3 py-2 grid grid-cols-3 sm:grid-cols-5 gap-2 text-center">
        {[['totalDays', String(totals.dias)], ['totalHours', `${totals.horas}h`], ['totalExtraHabil', `${totals.extraH}h`], ['totalExtraFeriado', `${totals.extraF}h`], ['totalProduction', formatCurrency(totals.prod)]].map(([k, v]) => (
          <div key={k}>
            <p className="text-[11px] text-muted-foreground">{t(k as Parameters<typeof t>[0])}</p>
            <p className="text-sm font-semibold">{v}</p>
          </div>
        ))}
      </div>

      {/* Add/edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) setDialogOpen(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{form.id ? t('editDay') : t('addDay')}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 px-6 py-4 overflow-y-auto">
            <div className="space-y-1 col-span-2"><Label className="text-xs">{t('date')}</Label>
              <Input type="date" value={form.fecha} onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))} className="h-9" /></div>
            <div className="space-y-1"><Label className="text-xs">{t('normalHours')}</Label>
              <Input type="number" step="0.01" min={0} value={form.horas_normales} onChange={(e) => setForm((f) => ({ ...f, horas_normales: e.target.value }))} className="h-9" /></div>
            <div className="space-y-1"><Label className="text-xs">{t('sessions')}</Label>
              <Input type="number" min={0} value={form.sesiones} onChange={(e) => setForm((f) => ({ ...f, sesiones: e.target.value }))} className="h-9" /></div>
            <div className="space-y-1"><Label className="text-xs">{t('extraHabil')}</Label>
              <Input type="number" step="0.01" min={0} value={form.horas_extra_habiles} onChange={(e) => setForm((f) => ({ ...f, horas_extra_habiles: e.target.value }))} className="h-9" /></div>
            <div className="space-y-1"><Label className="text-xs">{t('extraFeriado')}</Label>
              <Input type="number" step="0.01" min={0} value={form.horas_extra_feriados} onChange={(e) => setForm((f) => ({ ...f, horas_extra_feriados: e.target.value }))} className="h-9" /></div>
            <div className="space-y-1 col-span-2"><Label className="text-xs">{t('billed')}</Label>
              <Input type="number" step="0.01" min={0} value={form.produccion_facturada} onChange={(e) => setForm((f) => ({ ...f, produccion_facturada: e.target.value }))} className="h-9" /></div>
            <div className="space-y-1 col-span-2"><Label className="text-xs">{t('notes')}</Label>
              <Input value={form.notas} onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))} className="h-9" /></div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            {form.id && (
              <Button variant="outline" className="mr-auto text-destructive" onClick={handleDelete} disabled={deleting || saving}>
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1.5" />}{t('delete')}
              </Button>
            )}
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('cancel')}</Button>
            <Button onClick={handleSave} disabled={saving || !form.fecha}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
