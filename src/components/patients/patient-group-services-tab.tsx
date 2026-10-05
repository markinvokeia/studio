'use client';

import * as React from 'react';
import { Check, Loader2, Plus, Trash2, Stethoscope, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ColumnDef, ColumnFiltersState, PaginationState } from '@tanstack/react-table';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { DataCard } from '@/components/ui/data-card';
import { DataTable } from '@/components/ui/data-table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ViewModeToggle } from '@/components/ui/view-mode-toggle';
import { useTableViewMode } from '@/hooks/use-table-view-mode';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { useAsyncAction, useKeyedAsyncAction } from '@/hooks/use-async-action';
import { useDataLoader } from '@/hooks/use-data-loader';
import { useDebounce } from '@/hooks/use-debounce';
import { useToast } from '@/hooks/use-toast';
import { API_ROUTES } from '@/constants/routes';
import { getErrorMessage } from '@/lib/error-utils';
import { cn, formatServicePrice } from '@/lib/utils';
import { api, isAbortError, isTimeoutError, REQUEST_TIMEOUT_MS } from '@/services/api';
import { getSalesServices } from '@/services/services';
import { getClinicCurrency } from '@/stores/clinic-info-store';
import { createDefaultPagination } from '@/lib/pagination';

interface PatientGroupServicesTabProps {
    groupId: string;
    canManage: boolean;
}

type ServiceRow = {
    id: string;
    name: string;
    category?: string;
    price?: number;
    currency?: string;
    is_active?: boolean;
};

/**
 * Tolerant extractor: handles the paginated `{ data, total }` envelope as well
 * as a bare array of service rows, whether or not it is wrapped in `[{ json: ... }]`.
 */
function parseList(raw: any): { list: any[]; total: number } {
    const fromEnvelope = (o: any) => ({
        list: Array.isArray(o?.data) ? o.data : [],
        total: Number(o?.total ?? (Array.isArray(o?.data) ? o.data.length : 0)),
    });

    if (Array.isArray(raw)) {
        const first = raw[0];
        if (first?.json && typeof first.json === 'object') {
            const inner = first.json;
            if (inner.data !== undefined || inner.total !== undefined) return fromEnvelope(inner);
            return { list: raw.map((i: any) => i.json), total: raw.length };
        }
        if (first && (first.data !== undefined || first.total !== undefined)) return fromEnvelope(first);
        return { list: raw, total: raw.length };
    }
    if (raw && typeof raw === 'object') return fromEnvelope(raw);
    return { list: [], total: 0 };
}

function mapService(s: any): ServiceRow {
    return {
        id: s?.id != null ? String(s.id) : '',
        name: s.name ?? '',
        category: s.category_name ?? s.category ?? '',
        price: s.price != null ? Number(s.price) : undefined,
        currency: s.currency ?? getClinicCurrency(),
        is_active: s.is_active ?? true,
    };
}

async function fetchGroupServices(
    groupId: string,
    pagination: PaginationState,
    search: string,
    signal?: AbortSignal,
): Promise<{ rows: ServiceRow[]; total: number }> {
    try {
        const { list, total } = parseList(await api.get(API_ROUTES.PATIENT_GROUP_SERVICES, {
            group_id: groupId,
            page: (pagination.pageIndex + 1).toString(),
            limit: pagination.pageSize.toString(),
            search,
        }, undefined, { signal }));
        return { rows: list.map(mapService).filter((s) => s.id), total: total || list.length };
    } catch (error) {
        console.error('Failed to fetch group services:', error);
        // Rethrown so the tab shows a load error instead of an empty group.
        throw error;
    }
}

async function searchServices(search: string): Promise<ServiceRow[]> {
    try {
        const { items } = await getSalesServices({ search, limit: 20 });
        return items.map(mapService).filter((s) => s.id);
    } catch (error) {
        console.error('Failed to search services:', error);
        throw error;
    }
}

export function PatientGroupServicesTab({ groupId, canManage }: PatientGroupServicesTabProps) {
    const t = useTranslations('PatientGroupsPage.services');
    const { toast } = useToast();

    const viewportNarrow = useViewportNarrow();
    const [viewMode, setViewMode] = useTableViewMode('patient-group-services', 'table');
    const showToggle = !viewportNarrow;
    const useListView = showToggle && viewMode === 'list';
    const isNarrow = viewportNarrow || useListView;
    const viewToggleEl = showToggle ? <ViewModeToggle value={viewMode} onChange={setViewMode} /> : undefined;

    const [pagination, setPagination] = React.useState<PaginationState>(createDefaultPagination);
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

    // Add popover
    const [isAddOpen, setAddOpen] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [results, setResults] = React.useState<ServiceRow[]>([]);
    const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
    const [known, setKnown] = React.useState<Map<string, string>>(new Map());
    const [isSearching, setIsSearching] = React.useState(false);
    const [searchError, setSearchError] = React.useState<string | null>(null);

    const tableSearch = (columnFilters.find((f) => f.id === 'name')?.value as string) || '';
    const debouncedTableSearch = useDebounce(tableSearch, 400);

    // Only the latest page/search request may write the table: a slow "ju" can't overwrite "juan".
    const {
        data: { rows, total },
        isLoading,
        isRefreshing,
        error: loadError,
        reload: loadData,
    } = useDataLoader(
        (signal) => fetchGroupServices(groupId, pagination, debouncedTableSearch, signal),
        { rows: [] as ServiceRow[], total: 0 },
        [groupId, pagination.pageIndex, pagination.pageSize, debouncedTableSearch]
    );

    React.useEffect(() => {
        setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    }, [columnFilters]);

    // Debounced service search inside the add popover
    // A slower, older response can't overwrite the results of the latest query.
    React.useEffect(() => {
        if (!isAddOpen) return;
        const controller = new AbortController();
        const handler = setTimeout(async () => {
            setIsSearching(true);
            setSearchError(null);
            try {
                const found = await searchServices(searchQuery.trim());
                if (controller.signal.aborted) return;
                setResults(found);
                setKnown((prev) => {
                    const next = new Map(prev);
                    found.forEach((s) => next.set(s.id, s.name));
                    return next;
                });
            } catch (error) {
                if (!controller.signal.aborted && !isAbortError(error)) setSearchError(getErrorMessage(error));
            } finally {
                if (!controller.signal.aborted) setIsSearching(false);
            }
        }, 300);
        return () => {
            clearTimeout(handler);
            controller.abort();
        };
    }, [searchQuery, isAddOpen]);

    const toggleSelect = (id: string) => {
        setSelectedIds((current) =>
            current.includes(id) ? current.filter((v) => v !== id) : [...current, id],
        );
    };

    const add = useAsyncAction(
        async (ids: string[]) => {
            await api.post(API_ROUTES.PATIENT_GROUP_SERVICES_ASSIGN, { group_id: groupId, service_ids: ids }, undefined, undefined, { timeoutMs: REQUEST_TIMEOUT_MS.mutation });
            return ids.length;
        },
        {
            onSuccess: async (count) => {
                toast({ title: t('added', { count }) });
                setSelectedIds([]);
                setSearchQuery('');
                setResults([]);
                setAddOpen(false);
                await loadData();
            },
            onError: (error) => { if (isTimeoutError(error)) loadData(); },
            errorTitle: t('addError'),
        }
    );

    // Per row: removing one entry doesn't block the others.
    const remove = useKeyedAsyncAction(
        (id: string) => api.post(API_ROUTES.PATIENT_GROUP_SERVICES_REMOVE, { group_id: groupId, service_ids: [id] }, undefined, undefined, { timeoutMs: REQUEST_TIMEOUT_MS.mutation }),
        {
            onSuccess: async () => {
                toast({ title: t('removed') });
                await loadData();
            },
            onError: (error) => { if (isTimeoutError(error)) loadData(); },
            errorTitle: t('removeError'),
        }
    );

    const handleRemove = (id: string) => { remove.run(id, id); };

    const columns: ColumnDef<ServiceRow>[] = [
        { accessorKey: 'name', header: t('col_name') },
        { accessorKey: 'category', header: t('col_category') },
        {
            accessorKey: 'price',
            header: t('col_price'),
            cell: ({ row }) => formatServicePrice(row.original.price, row.original.currency, ''),
        },
        {
            id: 'actions',
            header: '',
            cell: ({ row }) => canManage ? (
                <div className="flex justify-end">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => handleRemove(row.original.id)}
                        disabled={remove.isPending(row.original.id)}
                        aria-label={t('remove')}
                    >
                        {remove.isPending(row.original.id)
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <Trash2 className="h-4 w-4" />}
                    </Button>
                </div>
            ) : null,
        },
    ];

    const addPopoverEl = canManage ? (
        <Popover
            open={isAddOpen}
            onOpenChange={(open) => {
                // Don't close (and drop the selection) while the assignment is in flight.
                if (!open && add.isPending) return;
                setAddOpen(open);
                if (!open) { setSelectedIds([]); setSearchQuery(''); setResults([]); setSearchError(null); }
            }}
        >
            <PopoverTrigger asChild>
                <Button size="sm" className="gap-1.5">
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">{t('addButton')}</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
                <Command shouldFilter={false}>
                    <CommandInput placeholder={t('search')} value={searchQuery} onValueChange={setSearchQuery} />
                    <CommandList>
                        {isSearching ? (
                            <div className="flex items-center justify-center py-6 text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                            </div>
                        ) : (
                            <>
                                <CommandEmpty>{searchError ? <span className="text-destructive">{searchError}</span> : t('noResults')}</CommandEmpty>
                                <CommandGroup>
                                    {results.map((s) => (
                                        <CommandItem key={s.id} value={s.id} onSelect={() => toggleSelect(s.id)}>
                                            <Check className={cn('mr-2 h-4 w-4', selectedIds.includes(s.id) ? 'opacity-100' : 'opacity-0')} />
                                            <span className="flex items-center gap-2">
                                                <Stethoscope className="h-3.5 w-3.5 text-muted-foreground" />
                                                {s.name}
                                            </span>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </>
                        )}
                    </CommandList>
                </Command>
                {selectedIds.length > 0 && (
                    <div className="max-h-24 overflow-y-auto border-t p-2">
                        <div className="flex flex-wrap gap-1">
                            {selectedIds.map((id) => (
                                <Badge key={id} variant="secondary" className="gap-1 py-0.5 pl-2 pr-1">
                                    <span className="text-xs">{known.get(id) ?? id}</span>
                                    <button
                                        type="button"
                                        onClick={() => toggleSelect(id)}
                                        className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                                        aria-label={known.get(id) ?? id}
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </Badge>
                            ))}
                        </div>
                    </div>
                )}
                <div className="flex items-center justify-between gap-2 border-t p-2">
                    <span className="text-xs text-muted-foreground">{t('count', { count: selectedIds.length })}</span>
                    <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => setAddOpen(false)} disabled={add.isPending}>
                            {t('addCancel')}
                        </Button>
                        <Button size="sm" onClick={() => add.run(selectedIds)} disabled={selectedIds.length === 0} loading={add.isPending}>
                            {t('addConfirm')}
                        </Button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    ) : undefined;

    return (
            <DataTable
                columns={columns}
                data={rows}
                filterColumnId="name"
                filterPlaceholder={t('filterPlaceholder')}
                onRefresh={loadData}
                isRefreshing={isRefreshing}
                isLoading={isLoading}
                loadError={loadError}
                isNarrow={isNarrow}
                renderCard={(row: ServiceRow) => (
                    <DataCard
                        title={row.name}
                        subtitle={row.category}
                        badge={<Badge variant={row.is_active ? 'success' : 'outline'} className="text-[10px]">{row.is_active ? t('active') : t('inactive')}</Badge>}
                        actions={canManage ? (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => handleRemove(row.id)}
                                disabled={remove.isPending(row.id)}
                                aria-label={t('remove')}
                            >
                                {remove.isPending(row.id)
                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                    : <Trash2 className="h-4 w-4" />}
                            </Button>
                        ) : undefined}
                    />
                )}
                viewControls={viewToggleEl}
                primaryActions={addPopoverEl}
                manualPagination
                pageCount={total > 0 ? Math.ceil(total / pagination.pageSize) : 0}
                rowCount={total}
                pagination={pagination}
                onPaginationChange={setPagination}
                columnFilters={columnFilters}
                onColumnFiltersChange={setColumnFilters}
            />
    );
}

export default PatientGroupServicesTab;
