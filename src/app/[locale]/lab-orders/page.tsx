'use client';

import * as React from 'react';
import { type ColumnDef, type PaginationState } from '@tanstack/react-table';
import { format, startOfToday } from 'date-fns';
import { AlertTriangle, ArrowUpDown, CalendarClock, FlaskConical, LayoutList, Plus, RefreshCw, Search, SlidersHorizontal, SquareKanban, X, Zap } from 'lucide-react';
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
import { LabOrdersBoard, type LabOrdersBoardFilters } from '@/components/lab-orders/lab-orders-board';
import { LabOrderDetailPanel } from '@/components/lab-orders/lab-order-detail-sheet';
import { LabOrderFormDialog } from '@/components/lab-orders/lab-order-form-dialog';
import { LabSelector } from '@/components/lab-orders/lab-selector';
import { useVoiceScreen } from '@/hooks/use-voice-screen';
import { useVoiceBridge } from '@/lib/voice/screen-bridge';
import type { LabOrdersPageVoiceBridge } from '@/lib/types';
import {
  LabCreateDialog, LabOrdersSetupCard, LabOrdersSetupMenu, LabServicesDialog, useLabSetupStatus, type LabSetupDialog,
} from '@/components/lab-orders/lab-orders-setup';
import {
  LabOrderAttachmentsCount, LabOrderNoLabBadge, LabOrderNumber, LabOrderStatusNote, LabOrderUrgentBadge, LabStageBadge, isUrgentPending,
  labOrderWork, useLabOrderErrorText,
} from '@/components/lab-orders/lab-order-shared';

import { useDebounce } from '@/hooks/use-debounce';
import { useLabOrdersLive } from '@/hooks/use-lab-orders-live';
import { useLabOrderChanged, useLabOrdersViewRequest } from '@/lib/lab-orders-events';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import { cn, formatDisplayDate } from '@/lib/utils';
import { isAbortError } from '@/services/api';
import { LAB_ORDERS_VOICE_DOMAIN } from '@/lib/voice/commands/lab-orders';
import { searchLabOrders } from '@/services/lab-orders';
import { fetchLabStages } from '@/services/lab-stages';

import { LAB_ORDERS_PERMISSIONS } from '@/constants/permissions';
import type { LabOrder, LabOrderFilters, LabOrderSort, LabStage } from '@/lib/types';

/** Módulos de voz de esta pantalla (los comandos y el contexto para la IA). */
const LAB_ORDERS_VOICE_DOMAINS = [LAB_ORDERS_VOICE_DOMAIN];

/** Filtro de etapa: 'pending' (default) = las que no están en etapa final; 'all' incluye las finalizadas. */
type StageFilter = 'pending' | 'all' | `stage-${number}`;

/** Lo que se ve al entrar y al limpiar: lo que todavía hay que seguir. */
const DEFAULT_STAGE_FILTER: StageFilter = 'pending';

/** Cuántas pendientes hay en cada filtro rápido (sin los demás filtros): se ven en el botón. */
interface QuickCounts {
  overdue: number;
  urgent: number;
  dueToday: number;
}

const todayKey = () => format(startOfToday(), 'yyyy-MM-dd');

type ViewMode = 'list' | 'board';

const VIEW_STORAGE = 'lab-orders-view';
const SORT_STORAGE = 'lab-orders-sort';
const SORT_OPTIONS: LabOrderSort[] = ['created_desc', 'created_asc', 'days_desc', 'days_asc'];

interface PickedEntity {
  id: string;
  name: string;
}

interface FilterChip {
  key: string;
  label: string;
  /** El tablero no lo aplica (la etapa: ahí cada etapa es una columna). */
  listOnly: boolean;
  onRemove: () => void;
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
 *  - Tablero: una columna por etapa activa, cargada por partes al hacer scroll; arrastrar cambia la etapa.
 * El orden (fuera de los filtros) vale para las dos: en el tablero decide qué tarjetas se ven primero.
 * Las atrasadas se marcan en rojo en las dos. Los cambios de otros usuarios llegan en vivo.
 */
export default function LabOrdersPage() {
  const t = useTranslations('LabOrdersPage');
  // La voz (botón del riel derecho) trabaja con el contexto de órdenes de laboratorio en esta pantalla.
  useVoiceScreen(LAB_ORDERS_VOICE_DOMAINS);
  const { toast } = useToast();
  const errorText = useLabOrderErrorText();
  const isMobile = useIsMobile();
  const { hasPermission } = usePermissions();
  const canChangeStage = hasPermission(LAB_ORDERS_PERMISSIONS.CHANGE_STAGE);

  const [view, setView] = React.useState<ViewMode>('list');
  const [sort, setSort] = React.useState<LabOrderSort>('created_desc');
  const [stagesKey, setStagesKey] = React.useState(0);
  const [boardKey, setBoardKey] = React.useState(0);

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(VIEW_STORAGE);
      if (stored === 'board' || stored === 'list') setView(stored);
      const storedSort = localStorage.getItem(SORT_STORAGE) as LabOrderSort | null;
      if (storedSort && SORT_OPTIONS.includes(storedSort)) setSort(storedSort);
    } catch { /* sin storage */ }
  }, []);

  const changeView = (next: ViewMode) => {
    setView(next);
    try { localStorage.setItem(VIEW_STORAGE, next); } catch { /* sin storage */ }
  };

  const changeSort = (next: LabOrderSort) => {
    setSort(next);
    try { localStorage.setItem(SORT_STORAGE, next); } catch { /* sin storage */ }
  };

  const [stages, setStages] = React.useState<LabStage[]>([]);
  const [orders, setOrders] = React.useState<LabOrder[]>([]);
  const [total, setTotal] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);

  const [search, setSearch] = React.useState('');
  const [stageFilter, setStageFilter] = React.useState<StageFilter>(DEFAULT_STAGE_FILTER);
  const [laboratory, setLaboratory] = React.useState<PickedEntity | null>(null);
  const [doctor, setDoctor] = React.useState<PickedEntity | null>(null);
  const [patient, setPatient] = React.useState<PickedEntity | null>(null);
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');
  const [overdueOnly, setOverdueOnly] = React.useState(false);
  const [urgentOnly, setUrgentOnly] = React.useState(false);
  const [dueTodayOnly, setDueTodayOnly] = React.useState(false);
  const [quickCounts, setQuickCounts] = React.useState<QuickCounts | null>(null);
  const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: 25 });

  const [createOpen, setCreateOpen] = React.useState(false);
  // Puesta en marcha: laboratorios y trabajos de laboratorio se resuelven sin salir del módulo.
  const [setupKey, setSetupKey] = React.useState(0);
  const [setupDialog, setSetupDialog] = React.useState<LabSetupDialog | null>(null);
  const setupStatus = useLabSetupStatus(setupKey);
  const setupIncomplete = !!setupStatus && (!setupStatus.hasLabs || !setupStatus.hasLabServices);
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

  // Desde la ficha del paciente: /lab-orders?patient=<id> abre la lista con todas sus órdenes.
  // El nombre del filtro se completa con el de sus órdenes (en la URL va solo el id).
  const patientParam = searchParams.get('patient');
  React.useEffect(() => {
    if (!patientParam) return;
    setPatient({ id: patientParam, name: '' });
    setStageFilter('all');
    setView('list');
  }, [patientParam]);

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
    urgent_only: urgentOnly || undefined,
    ...(dueTodayOnly ? { due_from: todayKey(), due_to: todayKey() } : {}),
    sort,
  }), [debouncedSearch, stageFilter, laboratory, doctor, patient, dateFrom, dateTo, overdueOnly, urgentOnly, dueTodayOnly, sort]);

  // El tablero aplica todo menos la etapa (cada etapa es una columna); el orden va aparte.
  const boardFilters = React.useMemo<LabOrdersBoardFilters>(() => {
    const { stage_ids: _stageIds, pending_only: _pendingOnly, sort: _sort, ...rest } = filters;
    return rest;
  }, [filters]);

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

  // Contadores de los filtros rápidos: pendientes atrasadas, urgentes y con entrega hoy.
  React.useEffect(() => {
    const controller = new AbortController();
    const count = (extra: LabOrderFilters) => searchLabOrders(
      { pending_only: true, ...extra, limit: 1, offset: 0 },
      { signal: controller.signal },
    ).then((result) => result.total);
    Promise.all([
      count({ overdue_only: true }),
      count({ urgent_only: true }),
      count({ due_from: todayKey(), due_to: todayKey() }),
    ])
      .then(([overdue, urgent, dueToday]) => { if (!controller.signal.aborted) setQuickCounts({ overdue, urgent, dueToday }); })
      .catch(() => { /* sin contadores: los botones se ven igual */ });
    return () => controller.abort();
  }, [reloadKey]);

  const reload = () => {
    setReloadKey((k) => k + 1);
    setBoardKey((k) => k + 1);
  };

  React.useEffect(() => {
    if (!patient || patient.name) return;
    const match = orders.find((o) => o.patient_id === patient.id);
    if (match) setPatient({ id: patient.id, name: match.patient_name });
  }, [orders, patient]);

  // Cambios de otros usuarios (y el eco de los propios): se recarga lo que se ve.
  useLabOrdersLive(({ stagesChanged }) => {
    if (stagesChanged) setStagesKey((k) => k + 1);
    reload();
  });

  // Movida por un comando de voz: la lista se recarga y la fila queda resaltada un momento (el
  // tablero mueve la tarjeta por su cuenta).
  const [flashId, setFlashId] = React.useState<number | null>(null);
  useLabOrderChanged((order) => {
    setReloadKey((k) => k + 1);
    setFlashId(order.id);
  });
  React.useEffect(() => {
    if (flashId == null) return;
    const timer = setTimeout(() => setFlashId(null), 4000);
    return () => clearTimeout(timer);
  }, [flashId]);

  // Filtros dentro del botón "Filtros" que están aplicados (el tablero ignora la etapa).
  const activeFilterCount = [
    view === 'list' && stageFilter !== DEFAULT_STAGE_FILTER,
    laboratory,
    doctor,
    patient,
    dateFrom,
    dateTo,
  ].filter(Boolean).length;
  const hasExtraFilters = Boolean(
    laboratory || doctor || patient || dateFrom || dateTo || overdueOnly || urgentOnly || dueTodayOnly || search
    || stageFilter !== DEFAULT_STAGE_FILTER,
  );
  const clearFilters = () => {
    setSearch(''); setStageFilter(DEFAULT_STAGE_FILTER); setLaboratory(null); setDoctor(null); setPatient(null);
    setDateFrom(''); setDateTo(''); setOverdueOnly(false); setUrgentOnly(false); setDueTodayOnly(false);
  };

  // "Mostrame las atrasadas", "las órdenes de Ana Pérez", "en el tablero"… (comandos de voz).
  useLabOrdersViewRequest((request) => {
    if (request.clear) clearFilters();
    if (request.overdue !== undefined) setOverdueOnly(request.overdue);
    if (request.urgent !== undefined) setUrgentOnly(request.urgent);
    if (request.dueToday !== undefined) setDueTodayOnly(request.dueToday);
    if (request.laboratory !== undefined) setLaboratory(request.laboratory);
    if (request.patient !== undefined) {
      setPatient(request.patient);
      // En la lista, todas sus órdenes (también las finalizadas); el tablero ya muestra todas las etapas.
      if (request.patient) setStageFilter('all');
    }
    if (request.view) changeView(request.view);
    setSelectedId(null);
  });

  // Filtros del popover aplicados, a la vista como chips. En el tablero, el que no se aplica
  // (la etapa) queda atenuado en vez de desaparecer.
  const filterChips = ([
    stageFilter !== DEFAULT_STAGE_FILTER && {
      key: 'stage',
      label: `${t('filters.stage')}: ${stageFilter === 'all'
        ? t('filters.allStages')
        : stages.find((s) => `stage-${s.id}` === stageFilter)?.name ?? ''}`,
      listOnly: true,
      onRemove: () => setStageFilter(DEFAULT_STAGE_FILTER),
    },
    laboratory && { key: 'laboratory', label: `${t('filters.laboratory')}: ${laboratory.name}`, listOnly: false, onRemove: () => setLaboratory(null) },
    doctor && { key: 'doctor', label: `${t('filters.doctor')}: ${doctor.name}`, listOnly: false, onRemove: () => setDoctor(null) },
    patient && { key: 'patient', label: `${t('filters.patient')}: ${patient.name}`, listOnly: false, onRemove: () => setPatient(null) },
    dateFrom && { key: 'dateFrom', label: `${t('filters.createdFrom')}: ${formatDisplayDate(dateFrom)}`, listOnly: false, onRemove: () => setDateFrom('') },
    dateTo && { key: 'dateTo', label: `${t('filters.createdTo')}: ${formatDisplayDate(dateTo)}`, listOnly: false, onRemove: () => setDateTo('') },
  ]).filter((chip): chip is FilterChip => Boolean(chip));
  const hasIgnoredChips = view === 'board' && filterChips.some((chip) => chip.listOnly);

  const columns = React.useMemo<ColumnDef<LabOrder>[]>(() => [
    {
      accessorKey: 'id',
      header: t('columns.id'),
      cell: ({ row }) => (
        <span className="inline-flex flex-col items-start gap-0.5">
          <LabOrderNumber id={row.original.id} className="text-sm" />
          <LabOrderAttachmentsCount order={row.original} />
        </span>
      ),
      size: 64,
    },
    {
      accessorKey: 'patient_name',
      header: t('columns.patient'),
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-col items-start gap-1">
          <span className="font-medium">{row.original.patient_name}</span>
          <LabOrderUrgentBadge order={row.original} />
        </div>
      ),
    },
    {
      accessorKey: 'laboratory_name',
      header: t('columns.laboratory'),
      cell: ({ row }) => row.original.laboratory_name
        || (row.original.is_pending ? <LabOrderNoLabBadge order={row.original} /> : <span className="text-muted-foreground">—</span>),
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
      // La etapa y debajo un solo aviso (atraso > entrega cercana > días en la etapa); el resto en el tooltip.
      id: 'status',
      header: t('columns.status'),
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-col items-start gap-1">
          <LabStageBadge name={row.original.stage_name} color={row.original.stage_color} />
          <LabOrderStatusNote order={row.original} />
        </div>
      ),
    },
  ], [t]);

  const isRightOpen = selectedId != null;
  const closeDetail = () => {
    setSelectedId(null);
    setIsRightExpanded(false);
  };

  /** Barra compacta: búsqueda, "Solo atrasadas" y el resto de los filtros en un popover, para que
   *  la lista tenga lugar también con el panel de detalle abierto. En la lista va como barra de la
   *  tabla (`end` = paginación + recargar); en el tablero, encima de las columnas. */
  const filterBar = (end: React.ReactNode) => (
    <>
      <div data-help-id="lab-orders.section.filters" className="flex flex-none flex-wrap items-center gap-2 pb-3">
        <div className="relative min-w-[10rem] flex-1 sm:max-w-[18rem]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            data-help-id="lab-orders.filter.search"
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
          <QuickCount value={quickCounts?.overdue} active={overdueOnly} />
        </Button>
        <Button
          data-help-id="lab-orders.field.urgent-only"
          variant={urgentOnly ? 'destructive' : 'outline'}
          size="sm"
          className="h-9 gap-1.5"
          aria-pressed={urgentOnly}
          aria-label={t('filters.urgentOnly')}
          title={t('filters.urgentOnlyHint')}
          onClick={() => setUrgentOnly((v) => !v)}
        >
          <Zap className={cn('h-4 w-4', urgentOnly && 'fill-current')} />
          <span className={cn(isRightOpen && 'hidden')}>{t('filters.urgentOnly')}</span>
          <QuickCount value={quickCounts?.urgent} active={urgentOnly} />
        </Button>
        <Button
          data-help-id="lab-orders.field.due-today"
          variant={dueTodayOnly ? 'secondary' : 'outline'}
          size="sm"
          className="h-9 gap-1.5"
          aria-pressed={dueTodayOnly}
          aria-label={t('filters.dueToday')}
          title={t('filters.dueTodayHint')}
          onClick={() => setDueTodayOnly((v) => !v)}
        >
          <CalendarClock className="h-4 w-4" />
          <span className={cn(isRightOpen && 'hidden')}>{t('filters.dueToday')}</span>
          <QuickCount value={quickCounts?.dueToday} active={dueTodayOnly} />
        </Button>
        <Select value={sort} onValueChange={(v) => changeSort(v as LabOrderSort)}>
          <SelectTrigger
            data-help-id="lab-orders.field.sort"
            className={cn('h-9 w-auto gap-1.5', isRightOpen && '[&>span]:sr-only')}
            aria-label={t('filters.sort')}
            title={t('filters.sort')}
          >
            <ArrowUpDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {SORT_OPTIONS.map((value) => (
              <SelectItem key={value} value={value}>{t(`sort.${value}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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
                      <SelectItem value="all">{t('filters.allStages')}</SelectItem>
                      <SelectItem value="pending">{t('filters.pending')}</SelectItem>
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
                <LabSelector
                  value={laboratory?.id ?? ''}
                  selectedName={laboratory?.name}
                  allowCreate={false}
                  clearable
                  onValueChange={(id, lab) => setLaboratory(id ? { id, name: lab?.name ?? '' } : null)}
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
        {/* Lista: paginación y recargar al final de la fila, como en las demás tablas. */}
        {end && <div className="ml-auto flex shrink-0 items-center gap-2">{end}</div>}
      </div>

      {filterChips.length > 0 && (
        <div data-help-id="lab-orders.section.active-filters" className="-mt-1 flex flex-none flex-wrap items-center gap-1.5 pb-3">
          {filterChips.map((chip) => {
            const ignored = view === 'board' && chip.listOnly;
            return (
              <span
                key={chip.key}
                className={cn(
                  'inline-flex max-w-full items-center gap-0.5 rounded-full border border-border bg-muted/40 py-0.5 pl-2.5 pr-0.5 text-xs',
                  ignored && 'border-dashed bg-transparent text-muted-foreground',
                )}
              >
                <span className="truncate">{chip.label}</span>
                {ignored && <span className="sr-only"> ({t('filters.notInBoardShort')})</span>}
                <button
                  type="button"
                  onClick={chip.onRemove}
                  aria-label={t('filters.removeChip', { name: chip.label })}
                  className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
          {hasIgnoredChips && <span className="text-xs text-muted-foreground">{t('filters.notInBoard')}</span>}
          <Button variant="link" size="sm" className="h-6 px-1 text-xs" onClick={clearFilters}>{t('filters.clear')}</Button>
        </div>
      )}
    </>
  );

  const refreshButton = (
    <Button
      data-help-id="lab-orders.btn.refresh"
      variant="outline"
      size="icon"
      className="h-9 w-9 shrink-0"
      onClick={reload}
      disabled={isRefreshing}
      aria-label={t('reload')}
      title={t('reload')}
    >
      <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
    </Button>
  );

  const leftPanel = (
    <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
      <CardHeader className="flex-none p-4">
        <div className="flex flex-wrap items-start gap-3">
          <div className="header-icon-circle mt-0.5">
            <FlaskConical className="h-5 w-5" />
          </div>
          {/* Ancho mínimo: en celular las acciones bajan a otra fila en vez de aplastar el título. */}
          <div className="flex min-w-[11rem] flex-1 flex-col text-left">
            <CardTitle className="text-lg">{t('title')}</CardTitle>
            <CardDescription className="text-xs">{t('description')}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <LabOrdersSetupMenu onOpen={setSetupDialog} compact={isRightOpen} />
            <div data-help-id="lab-orders.section.view" role="group" aria-label={t('view.label')} className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5">
              {([['list', LayoutList], ['board', SquareKanban]] as const).map(([mode, Icon]) => (
                <Button
                  key={mode}
                  data-help-id={`lab-orders.btn.view-${mode}`}
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
        {setupIncomplete && setupStatus && (
          <LabOrdersSetupCard status={setupStatus} onOpen={setSetupDialog} className="mb-3 flex-none" />
        )}
        {view === 'board' && filterBar(refreshButton)}

        {view === 'board' ? (
          <LabOrdersBoard
            stages={stages}
            filters={boardFilters}
            sort={sort}
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
              customToolbar={(_table: unknown, paginationNode: React.ReactNode) => filterBar(<>{paginationNode}{refreshButton}</>)}
              loadError={loadError}
              manualPagination
              pagination={pagination}
              onPaginationChange={setPagination}
              pageCount={Math.max(1, Math.ceil(total / pagination.pageSize))}
              rowCount={total}
              getRowId={(row) => String(row.id)}
              onRowClick={(row) => setSelectedId(row.id)}
              emptyState={hasExtraFilters
                ? (
                  <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-muted-foreground">
                    <p>{t('empty.filtered')}</p>
                    <Button variant="outline" size="sm" onClick={clearFilters}>{t('filters.clear')}</Button>
                  </div>
                )
                : <LabOrdersEmptyState onCreate={() => setCreateOpen(true)} onShowAll={() => setStageFilter('all')} />}
              getRowClassName={(row) => cn(
                row.is_overdue && 'bg-destructive/5',
                // Franja roja a la izquierda: las urgentes se ven de un vistazo (y van primero).
                isUrgentPending(row) && 'shadow-[inset_4px_0_0_hsl(var(--destructive))]',
                row.id === selectedId && 'bg-primary/5',
                row.id === flashId && 'bg-[#7C3AED]/10 transition-colors duration-700',
              )}
              isNarrow={isMobile || isRightOpen}
              renderCard={(row) => (
                <DataCard
                  title={row.patient_name}
                  badge={<LabOrderNumber id={row.id} className="text-sm" />}
                  subtitle={[row.laboratory_name, labOrderWork(row)].filter(Boolean).join(' · ')}
                  accentColor={row.stage_color}
                  isSelected={row.id === selectedId}
                  showArrow
                  actions={(
                    // Igual que la columna Estado: la etapa y un solo aviso (más urgente / sin laboratorio si aplica).
                    <div className="flex w-full min-w-0 flex-wrap items-center gap-1.5">
                      <LabOrderUrgentBadge order={row} />
                      <LabStageBadge name={row.stage_name} color={row.stage_color} />
                      <LabOrderStatusNote order={row} />
                      <LabOrderNoLabBadge order={row} />
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

  // Voz: «abrí la de Ana Pérez», «pasá la primera a recibida», «¿dónde está la de Juan?» (ver
  // src/lib/voice/commands/lab-orders-pick.ts); lo que se ve y la orden abierta.
  useVoiceBridge<LabOrdersPageVoiceBridge>('lab_orders.page', {
    rows: orders.map((o) => ({
      id: o.id, patient: o.patient_name, laboratory: o.laboratory_name ?? '', stage: o.stage_name, work: o.work_summary ?? '',
      due: o.due_date, overdue: o.is_overdue, urgent: o.is_urgent,
    })),
    selectedId,
    select: (id) => setSelectedId(id),
  });

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
          toast({ title: order.stage_kind === 'initial' ? t('created', { id: order.id }) : t('createdAndSent', { id: order.id, stage: order.stage_name }) });
          reload();
          setSelectedId(order.id);
        }}
      />

      <LabCreateDialog
        open={setupDialog === 'laboratory'}
        onOpenChange={(open) => { if (!open) setSetupDialog(null); }}
        onCreated={() => setSetupKey((k) => k + 1)}
      />
      <LabServicesDialog
        open={setupDialog === 'services'}
        onOpenChange={(open) => { if (!open) setSetupDialog(null); }}
        onChanged={() => setSetupKey((k) => k + 1)}
      />

      {/* Comandos de voz de esta pantalla: Ctrl+Espacio o el micrófono del encabezado. */}
    </div>
  );
}

/** Cantidad dentro de un filtro rápido; nada si es 0 o todavía no llegó. */
function QuickCount({ value, active }: { value: number | undefined; active: boolean }) {
  if (!value) return null;
  return (
    <span
      className={cn(
        'grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-semibold tabular-nums',
        active ? 'bg-background/25 text-current' : 'bg-muted text-foreground',
      )}
    >
      {value}
    </span>
  );
}

/**
 * Lista vacía sin filtros: no hay nada pendiente. Las finalizadas no se ven por defecto, así
 * que se ofrece verlas. La configuración la resuelve la tarjeta de primeros pasos.
 */
function LabOrdersEmptyState({ onCreate, onShowAll }: { onCreate: () => void; onShowAll: () => void }) {
  const t = useTranslations('LabOrdersPage.empty');
  return (
    <div data-help-id="lab-orders.section.empty" className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-8 text-center">
      <div className="header-icon-circle"><FlaskConical className="h-5 w-5" /></div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{t('title')}</p>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Can permission={LAB_ORDERS_PERMISSIONS.CREATE}>
          <Button size="sm" className="gap-1.5" onClick={onCreate}>
            <Plus className="h-4 w-4" />
            {t('create')}
          </Button>
        </Can>
        <Button data-help-id="lab-orders.btn.show-all" size="sm" variant="outline" onClick={onShowAll}>
          {t('showAll')}
        </Button>
      </div>
    </div>
  );
}
