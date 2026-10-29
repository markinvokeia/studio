'use client';

import * as React from 'react';
import { type ColumnDef, type PaginationState } from '@tanstack/react-table';
import { FlaskConical, Plus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { DataCard } from '@/components/ui/data-card';
import { DataTable } from '@/components/ui/data-table';
import { DatePickerInput } from '@/components/ui/date-picker';
import { DoctorSelector } from '@/components/ui/doctor-selector';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { UserSelector } from '@/components/ui/user-selector';

import { Can } from '@/components/auth/Can';
import { LabOrderDetailSheet } from '@/components/lab-orders/lab-order-detail-sheet';
import { LabOrderFormDialog } from '@/components/lab-orders/lab-order-form-dialog';
import { LabOrderDaysInStage, LabStageBadge, useLabOrderErrorText } from '@/components/lab-orders/lab-order-shared';

import { useDebounce } from '@/hooks/use-debounce';
import { useToast } from '@/hooks/use-toast';
import { cn, formatDisplayDate, formatUtcDateTime } from '@/lib/utils';
import { isAbortError } from '@/services/api';
import { searchLabOrders } from '@/services/lab-orders';
import { fetchLabStages } from '@/services/lab-stages';

import { LAB_ORDERS_PERMISSIONS } from '@/constants/permissions';
import type { LabOrder, LabOrderFilters, LabOrderSort, LabStage } from '@/lib/types';

/** Filtro de etapa: 'pending' (default) = todas las que no están en etapa final. */
type StageFilter = 'pending' | 'all' | `stage-${number}`;

interface PickedEntity {
  id: string;
  name: string;
}

function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return isMobile;
}

/**
 * Órdenes de laboratorio → Lista. Por defecto solo las pendientes (fuera de etapa final),
 * más recientes primero. Las atrasadas se marcan en rojo.
 */
export default function LabOrdersPage() {
  const t = useTranslations('LabOrdersPage');
  const { toast } = useToast();
  const errorText = useLabOrderErrorText();
  const isMobile = useIsMobile();

  const [stages, setStages] = React.useState<LabStage[]>([]);
  const [orders, setOrders] = React.useState<LabOrder[]>([]);
  const [total, setTotal] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);

  const [search, setSearch] = React.useState('');
  const [stageFilter, setStageFilter] = React.useState<StageFilter>('pending');
  const [laboratory, setLaboratory] = React.useState<PickedEntity | null>(null);
  const [doctor, setDoctor] = React.useState<PickedEntity | null>(null);
  const [patient, setPatient] = React.useState<PickedEntity | null>(null);
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');
  const [overdueOnly, setOverdueOnly] = React.useState(false);
  const [sort, setSort] = React.useState<LabOrderSort>('created_desc');
  const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: 25 });

  const [createOpen, setCreateOpen] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<number | null>(null);

  const debouncedSearch = useDebounce(search, 300);

  React.useEffect(() => {
    const controller = new AbortController();
    fetchLabStages({ signal: controller.signal })
      .then((data) => setStages(data.filter((s) => s.is_active)))
      .catch((error) => { if (!isAbortError(error)) toast({ variant: 'destructive', title: t('stagesLoadError'), description: errorText(error) }); });
    return () => controller.abort();
  }, [t, toast, errorText]);

  const filters = React.useMemo<LabOrderFilters>(() => ({
    search: debouncedSearch.trim() || undefined,
    stage_ids: stageFilter.startsWith('stage-') ? [Number(stageFilter.slice(6))] : undefined,
    pending_only: stageFilter === 'pending',
    laboratory_id: laboratory?.id,
    doctor_id: doctor?.id,
    patient_id: patient?.id,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    overdue_only: overdueOnly || undefined,
    sort,
  }), [debouncedSearch, stageFilter, laboratory, doctor, patient, dateFrom, dateTo, overdueOnly, sort]);

  // Un filtro nuevo vuelve a la primera página.
  React.useEffect(() => {
    setPagination((p) => (p.pageIndex === 0 ? p : { ...p, pageIndex: 0 }));
  }, [filters]);

  React.useEffect(() => {
    const controller = new AbortController();
    setIsRefreshing(true);
    setLoadError(null);
    searchLabOrders(
      { ...filters, limit: pagination.pageSize, offset: pagination.pageIndex * pagination.pageSize },
      { signal: controller.signal },
    )
      .then((result) => {
        if (controller.signal.aborted) return;
        setOrders(result.items);
        setTotal(result.total);
      })
      .catch((error) => { if (!isAbortError(error)) setLoadError(errorText(error)); })
      .finally(() => {
        if (controller.signal.aborted) return;
        setIsLoading(false);
        setIsRefreshing(false);
      });
    return () => controller.abort();
  }, [filters, pagination, reloadKey, errorText]);

  const reload = () => setReloadKey((k) => k + 1);

  const hasExtraFilters = Boolean(laboratory || doctor || patient || dateFrom || dateTo || overdueOnly || search || stageFilter !== 'pending');
  const clearFilters = () => {
    setSearch(''); setStageFilter('pending'); setLaboratory(null); setDoctor(null); setPatient(null);
    setDateFrom(''); setDateTo(''); setOverdueOnly(false);
  };

  const columns = React.useMemo<ColumnDef<LabOrder>[]>(() => [
    {
      accessorKey: 'id',
      header: t('columns.id'),
      cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">#{row.original.id}</span>,
      size: 64,
    },
    {
      accessorKey: 'patient_name',
      header: t('columns.patient'),
      cell: ({ row }) => <span className="font-medium">{row.original.patient_name}</span>,
    },
    {
      accessorKey: 'laboratory_name',
      header: t('columns.laboratory'),
      cell: ({ row }) => row.original.laboratory_name || <span className="text-muted-foreground">—</span>,
    },
    {
      accessorKey: 'work_description',
      header: t('columns.work'),
      cell: ({ row }) => (
        <div className="max-w-[18rem]">
          <p className="truncate">{row.original.work_description}</p>
          {row.original.teeth.length > 0 && (
            <p className="truncate text-xs text-muted-foreground">{t('teethShort', { teeth: row.original.teeth.join(', ') })}</p>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'doctor_name',
      header: t('columns.doctor'),
      cell: ({ row }) => row.original.doctor_name || <span className="text-muted-foreground">—</span>,
    },
    {
      accessorKey: 'stage_name',
      header: t('columns.stage'),
      cell: ({ row }) => <LabStageBadge name={row.original.stage_name} color={row.original.stage_color} />,
    },
    {
      accessorKey: 'days_in_stage',
      header: t('columns.daysInStage'),
      cell: ({ row }) => <LabOrderDaysInStage order={row.original} />,
    },
    {
      accessorKey: 'due_date',
      header: t('columns.dueDate'),
      cell: ({ row }) => (row.original.due_date ? formatDisplayDate(row.original.due_date) : <span className="text-muted-foreground">—</span>),
    },
    {
      accessorKey: 'created_at',
      header: t('columns.createdAt'),
      cell: ({ row }) => <span className="whitespace-nowrap text-xs">{formatUtcDateTime(row.original.created_at)}</span>,
    },
  ], [t]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        icon={<FlaskConical className="h-5 w-5" />}
        title={t('title')}
        description={t('description')}
        actions={
          <Can permission={LAB_ORDERS_PERMISSIONS.CREATE}>
            <Button data-help-id="lab-orders.btn.new" onClick={() => setCreateOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              {t('new')}
            </Button>
          </Can>
        }
      />

      <section data-help-id="lab-orders.section.filters" className="grid gap-3 px-1 pb-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t('filters.search')}</Label>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('filters.searchPlaceholder')} className="h-9" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t('filters.stage')}</Label>
          <Select value={stageFilter} onValueChange={(v) => setStageFilter(v as StageFilter)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">{t('filters.pending')}</SelectItem>
              <SelectItem value="all">{t('filters.allStages')}</SelectItem>
              {stages.length > 0 && <SelectSeparator />}
              {stages.map((stage) => (
                <SelectItem key={stage.id} value={`stage-${stage.id}`}>
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                    {stage.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t('filters.laboratory')}</Label>
          <UserSelector
            filterType="PROVEEDOR"
            isSales={false}
            value={laboratory?.id ?? ''}
            selectedUserName={laboratory?.name}
            onValueChange={(id, user) => setLaboratory(id ? { id, name: user?.name ?? '' } : null)}
            placeholder={t('form.searchLaboratory')}
            triggerText={t('filters.any')}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t('filters.doctor')}</Label>
          <DoctorSelector
            value={doctor?.id ?? ''}
            selectedDoctorName={doctor?.name}
            onValueChange={(id, option) => setDoctor(id ? { id, name: option?.name ?? '' } : null)}
            placeholder={t('form.searchDoctor')}
            triggerText={t('filters.any')}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t('filters.patient')}</Label>
          <UserSelector
            filterType="PACIENTE"
            value={patient?.id ?? ''}
            selectedUserName={patient?.name}
            onValueChange={(id, user) => setPatient(id ? { id, name: user?.name ?? '' } : null)}
            placeholder={t('form.searchPatient')}
            triggerText={t('filters.any')}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t('filters.createdFrom')}</Label>
          <DatePickerInput value={dateFrom} onChange={setDateFrom} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t('filters.createdTo')}</Label>
          <DatePickerInput value={dateTo} onChange={setDateTo} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t('filters.sort')}</Label>
          <Select value={sort} onValueChange={(v) => setSort(v as LabOrderSort)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(['created_desc', 'created_asc', 'days_desc', 'days_asc'] as LabOrderSort[]).map((value) => (
                <SelectItem key={value} value={value}>{t(`sort.${value}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-4 sm:col-span-2 lg:col-span-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Switch data-help-id="lab-orders.field.overdue-only" checked={overdueOnly} onCheckedChange={setOverdueOnly} />
            {t('filters.overdueOnly')}
          </label>
          {hasExtraFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5">
              <X className="h-3.5 w-3.5" />
              {t('filters.clear')}
            </Button>
          )}
        </div>
      </section>

      <div className="min-h-0 flex-1 overflow-hidden px-1">
        <DataTable
          columns={columns}
          data={orders}
          isLoading={isLoading}
          isRefreshing={isRefreshing}
          onRefresh={reload}
          loadError={loadError}
          manualPagination
          pagination={pagination}
          onPaginationChange={setPagination}
          pageCount={Math.max(1, Math.ceil(total / pagination.pageSize))}
          rowCount={total}
          getRowId={(row) => String(row.id)}
          onRowClick={(row) => setSelectedId(row.id)}
          getRowClassName={(row) => cn(row.is_overdue && 'bg-destructive/5')}
          isNarrow={isMobile}
          renderCard={(row) => (
            <DataCard
              title={row.patient_name}
              subtitle={[row.laboratory_name, row.work_description].filter(Boolean).join(' · ')}
              accentColor={row.stage_color}
              showArrow
              onClick={() => setSelectedId(row.id)}
              actions={(
                <div className="flex w-full items-center justify-between gap-2">
                  <LabStageBadge name={row.stage_name} color={row.stage_color} />
                  <LabOrderDaysInStage order={row} />
                </div>
              )}
            />
          )}
        />
      </div>

      <LabOrderFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={(order) => {
          toast({ title: t('created', { id: order.id }) });
          reload();
          setSelectedId(order.id);
        }}
      />

      <LabOrderDetailSheet
        orderId={selectedId}
        stages={stages}
        onClose={() => setSelectedId(null)}
        onChanged={() => reload()}
      />
    </div>
  );
}
