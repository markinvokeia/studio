'use client';

import * as React from 'react';
import { type ColumnDef, type PaginationState } from '@tanstack/react-table';
import { AlertTriangle, FlaskConical, LayoutList, Plus, Search, SlidersHorizontal, SquareKanban, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataCard } from '@/components/ui/data-card';
import { DataTable } from '@/components/ui/data-table';
import { DatePickerInput } from '@/components/ui/date-picker';
import { DoctorSelector } from '@/components/ui/doctor-selector';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserSelector } from '@/components/ui/user-selector';

import { Can } from '@/components/auth/Can';
import { TwoPanelLayout } from '@/components/layout/two-panel-layout';
import { LabOrdersBoard } from '@/components/lab-orders/lab-orders-board';
import { LabOrderDetailPanel } from '@/components/lab-orders/lab-order-detail-sheet';
import { LabOrderFormDialog } from '@/components/lab-orders/lab-order-form-dialog';
import { LabOrderDaysInStage, LabStageBadge, labOrderWork, useLabOrderErrorText } from '@/components/lab-orders/lab-order-shared';

import { useDebounce } from '@/hooks/use-debounce';
import { useLabOrdersLive } from '@/hooks/use-lab-orders-live';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import { cn, formatDisplayDate, formatUtcDateTime } from '@/lib/utils';
import { isAbortError } from '@/services/api';
import { searchLabOrders } from '@/services/lab-orders';
import { fetchLabStages } from '@/services/lab-stages';

import { LAB_ORDERS_PERMISSIONS } from '@/constants/permissions';
import type { LabOrder, LabOrderFilters, LabOrderSort, LabStage } from '@/lib/types';

/** Filtro de etapa: 'pending' (default) = todas las que no están en etapa final. */
type StageFilter = 'pending' | 'all' | `stage-${number}`;

type ViewMode = 'list' | 'board';

const VIEW_STORAGE = 'lab-orders-view';
const FINAL_DAYS_OPTIONS = [7, 30, 90] as const;

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
 * Órdenes de laboratorio. Dos vistas:
 *  - Lista: por defecto solo las pendientes (fuera de etapa final), con todos los filtros.
 *  - Tablero: una columna por etapa activa; arrastrar cambia la etapa.
 * Las atrasadas se marcan en rojo en las dos. Los cambios de otros usuarios llegan en vivo.
 */
export default function LabOrdersPage() {
  const t = useTranslations('LabOrdersPage');
  const { toast } = useToast();
  const errorText = useLabOrderErrorText();
  const isMobile = useIsMobile();
  const { hasPermission } = usePermissions();
  const canChangeStage = hasPermission(LAB_ORDERS_PERMISSIONS.CHANGE_STAGE);

  const [view, setView] = React.useState<ViewMode>('list');
  const [finalDays, setFinalDays] = React.useState<number>(30);
  const [stagesKey, setStagesKey] = React.useState(0);
  const [boardKey, setBoardKey] = React.useState(0);

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(VIEW_STORAGE);
      if (stored === 'board' || stored === 'list') setView(stored);
    } catch { /* sin storage */ }
  }, []);

  const changeView = (next: ViewMode) => {
    setView(next);
    try { localStorage.setItem(VIEW_STORAGE, next); } catch { /* sin storage */ }
  };

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
  const [isRightExpanded, setIsRightExpanded] = React.useState(false);

  const debouncedSearch = useDebounce(search, 300);

  // Desde una notificación: /lab-orders?order=<id> abre el detalle.
  const searchParams = useSearchParams();
  const orderParam = searchParams.get('order');
  React.useEffect(() => {
    const id = Number(orderParam);
    if (Number.isInteger(id) && id > 0) setSelectedId(id);
  }, [orderParam]);

  React.useEffect(() => {
    const controller = new AbortController();
    fetchLabStages({ signal: controller.signal })
      .then((data) => setStages(data.filter((s) => s.is_active)))
      .catch((error) => { if (!isAbortError(error)) toast({ variant: 'destructive', title: t('stagesLoadError'), description: errorText(error) }); });
    return () => controller.abort();
  }, [t, toast, errorText, stagesKey]);

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

  const reload = () => {
    setReloadKey((k) => k + 1);
    setBoardKey((k) => k + 1);
  };

  // Cambios de otros usuarios (y el eco de los propios): se recarga lo que se ve.
  useLabOrdersLive(({ stagesChanged }) => {
    if (stagesChanged) setStagesKey((k) => k + 1);
    reload();
  });

  // Filtros dentro del botón "Filtros" que están aplicados (el tablero ignora etapa, paciente y fechas).
  const activeFilterCount = [
    view === 'list' && stageFilter !== 'pending',
    laboratory,
    doctor,
    view === 'list' && patient,
    view === 'list' && dateFrom,
    view === 'list' && dateTo,
  ].filter(Boolean).length;
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
      id: 'work',
      header: t('columns.work'),
      cell: ({ row }) => (
        <div className="max-w-[18rem]">
          <p className="truncate">{labOrderWork(row.original)}</p>
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

  const isRightOpen = selectedId != null;
  const closeDetail = () => {
    setSelectedId(null);
    setIsRightExpanded(false);
  };

  const leftPanel = (
    <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
      <CardHeader className="flex-none p-4">
        <div className="flex flex-wrap items-start gap-3">
          <div className="header-icon-circle mt-0.5">
            <FlaskConical className="h-5 w-5" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col text-left">
            <CardTitle className="text-lg">{t('title')}</CardTitle>
            <CardDescription className="text-xs">{t('description')}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div data-help-id="lab-orders.section.view" role="group" aria-label={t('view.label')} className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5">
              {([['list', LayoutList], ['board', SquareKanban]] as const).map(([mode, Icon]) => (
                <Button
                  key={mode}
                  size="sm"
                  variant={view === mode ? 'secondary' : 'ghost'}
                  className="h-8 gap-1.5"
                  aria-pressed={view === mode}
                  onClick={() => changeView(mode)}
                >
                  <Icon className="h-4 w-4" />
                  <span className={cn('hidden', !isRightOpen && 'sm:inline')}>{t(`view.${mode}`)}</span>
                </Button>
              ))}
            </div>
            <Can permission={LAB_ORDERS_PERMISSIONS.CREATE}>
              <Button data-help-id="lab-orders.btn.new" size="sm" onClick={() => setCreateOpen(true)} className="h-9 gap-1.5">
                <Plus className="h-4 w-4" />
                <span className={cn(isRightOpen && 'sr-only')}>{t('new')}</span>
              </Button>
            </Can>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden p-4 pt-0 bg-card">
        {/* Barra compacta: búsqueda, "Solo atrasadas" y el resto de los filtros en un popover, para
            que la lista tenga lugar también con el panel de detalle abierto. */}
        <div data-help-id="lab-orders.section.filters" className="flex flex-none flex-wrap items-center gap-2 pb-3">
          <div className="relative min-w-[10rem] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('filters.searchPlaceholder')}
              aria-label={t('filters.search')}
              className="h-9 pl-8"
            />
          </div>
          <Button
            data-help-id="lab-orders.field.overdue-only"
            variant={overdueOnly ? 'destructive' : 'outline'}
            size="sm"
            className="h-9 gap-1.5"
            aria-pressed={overdueOnly}
            aria-label={t('filters.overdueOnly')}
            onClick={() => setOverdueOnly((v) => !v)}
          >
            <AlertTriangle className="h-4 w-4" />
            <span className={cn(isRightOpen && 'hidden')}>{t('filters.overdueOnly')}</span>
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button data-help-id="lab-orders.btn.filters" variant="outline" size="sm" className="h-9 gap-1.5" aria-label={t('filters.more')}>
                <SlidersHorizontal className="h-4 w-4" />
                <span className={cn(isRightOpen && 'hidden')}>{t('filters.more')}</span>
                {activeFilterCount > 0 && (
                  <span className="grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[min(30rem,calc(100vw-2rem))] p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {view === 'list' && (
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
                )}
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
                {view === 'list' && (
                  <>
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
                  </>
                )}
                {view === 'board' && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{t('board.finalWindowLabel')}</Label>
                    <Select value={String(finalDays)} onValueChange={(v) => setFinalDays(Number(v))}>
                      <SelectTrigger data-help-id="lab-orders.field.final-days" className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FINAL_DAYS_OPTIONS.map((days) => (
                          <SelectItem key={days} value={String(days)}>{t('board.lastDays', { days })}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              {hasExtraFilters && (
                <div className="mt-3 flex justify-end border-t pt-3">
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5">
                    <X className="h-3.5 w-3.5" />
                    {t('filters.clear')}
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>

        {view === 'board' ? (
          <LabOrdersBoard
            stages={stages}
            filters={{
              search: debouncedSearch.trim() || undefined,
              laboratory_id: laboratory?.id,
              doctor_id: doctor?.id,
              overdue_only: overdueOnly || undefined,
            }}
            finalDays={finalDays}
            reloadKey={boardKey}
            canChangeStage={canChangeStage}
            onOpen={(order) => setSelectedId(order.id)}
            onMoved={() => setReloadKey((k) => k + 1)}
            className="px-0"
          />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
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
              getRowClassName={(row) => cn(row.is_overdue && 'bg-destructive/5', row.id === selectedId && 'bg-primary/5')}
              isNarrow={isMobile || isRightOpen}
              renderCard={(row) => (
                <DataCard
                  title={row.patient_name}
                  subtitle={[row.laboratory_name, labOrderWork(row)].filter(Boolean).join(' · ')}
                  accentColor={row.stage_color}
                  isSelected={row.id === selectedId}
                  showArrow
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
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <TwoPanelLayout
        minLeftSize={20}
        isRightPanelOpen={isRightOpen}
        onBack={closeDetail}
        forceRightOnly={isRightExpanded}
        leftPanel={leftPanel}
        rightPanel={isRightOpen && (
          <LabOrderDetailPanel
            orderId={selectedId}
            stages={stages}
            onClose={closeDetail}
            onChanged={() => reload()}
            isExpanded={isRightExpanded}
            onToggleExpanded={() => setIsRightExpanded((v) => !v)}
          />
        )}
      />

      <LabOrderFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={(order) => {
          toast({ title: t('created', { id: order.id }) });
          reload();
          setSelectedId(order.id);
        }}
      />
    </div>
  );
}
