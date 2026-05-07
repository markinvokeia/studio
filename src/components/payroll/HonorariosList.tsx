'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataCard } from '@/components/ui/data-card';
import { DataTable } from '@/components/ui/data-table';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ReportExportActions } from '@/components/reports/report-export-actions';
import { useNarrowMode } from '@/components/layout/two-panel-layout';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { PayrollListToolbar } from '@/components/payroll/PayrollListToolbar';
import { formatCurrency, getMonthName } from '@/components/payroll/payroll-utils';
import type { HonorariosEstado, PayrollHonorario, PayrollPeriod } from '@/lib/types';
import { cn } from '@/lib/utils';
import api from '@/services/api';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus, Settings2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';

const STATUS_COLORS: Record<HonorariosEstado, string> = {
  pendiente:  'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  validada:   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  autorizada: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  pagada:     'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  rechazada:  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

interface HonorariosListProps {
  selectedId?: string;
  onSelect?: (honorario: PayrollHonorario) => void;
}

export function HonorariosList({ selectedId, onSelect }: HonorariosListProps) {
  const t = useTranslations('PayrollPage.honorarios');
  const { toast } = useToast();
  const { isNarrow } = useNarrowMode();
  const isViewportNarrow = useViewportNarrow();

  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [honorarios, setHonorarios] = useState<PayrollHonorario[]>([]);
  const [search, setSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState<HonorariosEstado | 'all'>('all');
  const [loadingPeriods, setLoadingPeriods] = useState(true);
  const [loadingHonorarios, setLoadingHonorarios] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [isCardMode, setIsCardMode] = useState(false);

  useEffect(() => {
    api.get(API_ROUTES.PAYROLL.PERIODS, undefined).then((data) => {
      const all: PayrollPeriod[] = Array.isArray(data) ? data : ((data as { periods?: PayrollPeriod[] })?.periods ?? []);
      setPeriods(all);
      const current = all.find((p) => p.status !== 'closed') ?? all[0];
      if (current) setSelectedPeriod(current.id);
    }).catch(() => setPeriods([])).finally(() => setLoadingPeriods(false));
  }, []);

  const fetchHonorarios = useCallback(async (periodId: string) => {
    if (!periodId) return;
    try {
      setLoadingHonorarios(true);
      const data = await api.get(API_ROUTES.PAYROLL.HONORARIOS, { period_id: periodId });
      setHonorarios(Array.isArray(data) ? data : ((data as { honorarios?: PayrollHonorario[] })?.honorarios ?? []));
    } catch {
      setHonorarios([]);
    } finally {
      setLoadingHonorarios(false);
    }
  }, []);

  useEffect(() => { if (selectedPeriod) fetchHonorarios(selectedPeriod); }, [selectedPeriod, fetchHonorarios]);

  async function handleGenerate() {
    if (!selectedPeriod) return;
    try {
      setGenerating(true);
      await api.post(API_ROUTES.PAYROLL.HONORARIOS_GENERATE, { period_id: selectedPeriod });
      fetchHonorarios(selectedPeriod);
      toast({ title: 'Órdenes de pago generadas.' });
    } catch {
      toast({ title: 'Error', description: 'No se pudo generar las órdenes.', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  }

  const filtered = useMemo(() => honorarios.filter((h) => {
    const matchSearch = !search || (h.doctor_name ?? '').toLowerCase().includes(search.toLowerCase());
    const matchEstado = estadoFilter === 'all' || h.estado === estadoFilter;
    return matchSearch && matchEstado;
  }), [honorarios, search, estadoFilter]);

  const totalBruto = filtered.reduce((s, h) => s + h.bruto, 0);
  const totalLiquido = filtered.reduce((s, h) => s + h.liquido, 0);

  const showCardMode = isCardMode || isNarrow || isViewportNarrow || !!selectedId;

  const ESTADOS: Array<HonorariosEstado | 'all'> = ['all', 'pendiente', 'validada', 'autorizada', 'pagada', 'rechazada'];

  function handleExportCSV() {
    if (filtered.length === 0) return;
    const period = periods.find((p) => p.id === selectedPeriod);
    const header = 'Doctor,RUT,Modalidad,Producción,Porcentaje,Bruto,IVA,Retenciones,Líquido,Estado,Fecha Pago';
    const rows = filtered.map((h) =>
      [h.doctor_name, h.doctor_rut ?? '', h.modalidad, h.produccion_base, h.porcentaje, h.bruto, h.iva, h.retenciones, h.liquido, h.estado, h.fecha_pago ?? ''].join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `honorarios-${period?.period_year ?? ''}-${period?.period_month ?? ''}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const columns = useMemo<ColumnDef<PayrollHonorario>[]>(() => [
    {
      id: 'doctor',
      header: t('doctor'),
      accessorKey: 'doctor_name',
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.doctor_name}</p>
          {row.original.doctor_rut && (
            <p className="text-xs text-muted-foreground font-mono">RUT {row.original.doctor_rut}</p>
          )}
        </div>
      ),
    },
    {
      id: 'modalidad',
      header: t('modalidad'),
      accessorKey: 'modalidad',
      cell: ({ row }) => (
        <span className="text-muted-foreground">{t(`modalidades.${row.original.modalidad}`)}</span>
      ),
    },
    {
      id: 'produccion',
      header: t('produccion'),
      accessorKey: 'produccion_base',
      cell: ({ row }) => (
        <span className="text-right block text-muted-foreground font-mono">
          {formatCurrency(row.original.produccion_base)}
        </span>
      ),
    },
    {
      id: 'bruto',
      header: t('bruto'),
      accessorKey: 'bruto',
      cell: ({ row }) => (
        <span className="text-right block font-medium font-mono">{formatCurrency(row.original.bruto)}</span>
      ),
    },
    {
      id: 'liquido',
      header: t('liquido'),
      accessorKey: 'liquido',
      cell: ({ row }) => (
        <span className="text-right block font-medium text-green-600 dark:text-green-400 font-mono">
          {formatCurrency(row.original.liquido)}
        </span>
      ),
    },
    {
      id: 'status',
      header: t('status'),
      accessorKey: 'estado',
      cell: ({ row }) => (
        <Badge className={cn('text-xs', STATUS_COLORS[row.original.estado])}>
          {t(`estados.${row.original.estado}`)}
        </Badge>
      ),
    },
  ], [t]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Summary bar */}
      {filtered.length > 0 && !loadingHonorarios && (
        <div className="flex gap-4 px-3 py-1.5 border-b bg-muted/20 text-xs shrink-0 flex-wrap">
          <span className="text-muted-foreground">{t('totalBruto')}: <strong>{formatCurrency(totalBruto)}</strong></span>
          <span className="text-muted-foreground">{t('totalLiquido')}: <strong className="text-green-600 dark:text-green-400">{formatCurrency(totalLiquido)}</strong></span>
          {(['pendiente', 'validada', 'autorizada', 'pagada', 'rechazada'] as const).map((estado) => {
            const count = filtered.filter((h) => h.estado === estado).length;
            if (!count) return null;
            return (
              <span key={estado} className="text-muted-foreground">
                {t(`estados.${estado}`)}: <strong>{count}</strong>
              </span>
            );
          })}
        </div>
      )}

      <DataTable
        columns={columns}
        data={filtered}
        isLoading={loadingHonorarios}
        isNarrow={showCardMode}
        compact
        enableSingleRowSelection
        onRowSelectionChange={(rows) => { if (rows[0]) onSelect?.(rows[0]); }}
        onRowClick={(hon) => onSelect?.(hon)}
        getRowClassName={(hon) =>
          cn('cursor-pointer transition-colors', hon.id === selectedId ? 'bg-primary/5' : '')
        }
        renderCard={(hon, isSelected) => (
          <DataCard
            isSelected={isSelected || hon.id === selectedId}
            title={hon.doctor_name ?? '—'}
            subtitle={`${t(`modalidades.${hon.modalidad}`)} · ${t('liquido')}: ${formatCurrency(hon.liquido)}`}
            avatar={(hon.doctor_name ?? '??').slice(0, 2).toUpperCase()}
            showArrow
            onClick={() => onSelect?.(hon)}
            badge={
              <Badge className={cn('text-[9px]', STATUS_COLORS[hon.estado])}>
                {t(`estados.${hon.estado}`)}
              </Badge>
            }
            actions={
              <span className="text-xs font-mono text-muted-foreground">{formatCurrency(hon.bruto)}</span>
            }
          />
        )}
        customToolbar={(table, paginationNode) => (
          <PayrollListToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder={t('searchPlaceholder')}
            viewMode={isCardMode ? 'card' : 'table'}
            onViewModeChange={(m) => setIsCardMode(m === 'card')}
            showViewToggle={!isViewportNarrow && !isNarrow}
            filterSlot={
              <>
                {loadingPeriods ? (
                  <Skeleton className="h-8 w-36 shrink-0" />
                ) : (
                  <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                    <SelectTrigger className="h-8 text-sm w-36 shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {periods.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {getMonthName(p.period_month)} {p.period_year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Select value={estadoFilter} onValueChange={(v) => setEstadoFilter(v as HonorariosEstado | 'all')}>
                  <SelectTrigger className="h-8 text-sm w-32 shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ESTADOS.map((estado) => (
                      <SelectItem key={estado} value={estado}>
                        {estado === 'all' ? t('filterAll') : t(`estados.${estado}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            }
            columnsSlot={!showCardMode && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-8 w-8 shrink-0">
                    <Settings2 className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {(table as any).getAllColumns()
                    .filter((col: any) => col.getCanHide())
                    .map((col: any) => (
                      <DropdownMenuCheckboxItem
                        key={col.id}
                        checked={col.getIsVisible()}
                        onCheckedChange={(val) => col.toggleVisibility(!!val)}
                      >
                        {typeof col.columnDef.header === 'string' ? col.columnDef.header : col.id}
                      </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            actions={
              <>
                <Button size="sm" className="h-8 text-xs" disabled={generating || !selectedPeriod} onClick={handleGenerate} title={t('generate')}>
                  <Plus className="h-3 w-3 sm:mr-1" />
                  <span className="hidden sm:inline">{generating ? '...' : t('generate')}</span>
                </Button>
                <ReportExportActions
                  disabled={filtered.length === 0}
                  onExportCSV={handleExportCSV}
                  onPrint={() => window.print()}
                />
              </>
            }
            paginationNode={paginationNode}
          />
        )}
      />
    </div>
  );
}
