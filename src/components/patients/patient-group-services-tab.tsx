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
import { useToast } from '@/hooks/use-toast';
import { API_ROUTES } from '@/constants/routes';
import { cn, formatServicePrice } from '@/lib/utils';
import { api } from '@/services/api';
import { getSalesServices } from '@/services/services';

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
        currency: s.currency ?? 'UYU',
        is_active: s.is_active ?? true,
    };
}

async function fetchGroupServices(
    groupId: string,
    pagination: PaginationState,
    search: string,
): Promise<{ rows: ServiceRow[]; total: number }> {
    try {
        const { list, total } = parseList(await api.get(API_ROUTES.PATIENT_GROUP_SERVICES, {
            group_id: groupId,
            page: (pagination.pageIndex + 1).toString(),
            limit: pagination.pageSize.toString(),
            search,
        }));
        return { rows: list.map(mapService).filter((s) => s.id), total: total || list.length };
    } catch (error) {
        console.error('Failed to fetch group services:', error);
        return { rows: [], total: 0 };
    }
}

async function searchServices(search: string): Promise<ServiceRow[]> {
    try {
        const { items } = await getSalesServices({ search, limit: 20 });
        return items.map(mapService).filter((s) => s.id);
    } catch (error) {
        console.error('Failed to search services:', error);
        return [];
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

    const [rows, setRows] = React.useState<ServiceRow[]>([]);
    const [total, setTotal] = React.useState(0);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: 25 });
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
    const [removingId, setRemovingId] = React.useState<string | null>(null);

    // Add popover
    const [isAddOpen, setAddOpen] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [results, setResults] = React.useState<ServiceRow[]>([]);
    const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
    const [known, setKnown] = React.useState<Map<string, string>>(new Map());
    const [isSearching, setIsSearching] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);

    const loadData = React.useCallback(async () => {
        setIsRefreshing(true);
        const search = (columnFilters.find((f) => f.id === 'name')?.value as string) || '';
        const { rows: fetched, total: t2 } = await fetchGroupServices(groupId, pagination, search);
        setRows(fetched);
        setTotal(t2);
        setIsRefreshing(false);
    }, [groupId, pagination, columnFilters]);

    React.useEffect(() => {
        const debounce = setTimeout(() => { loadData(); }, 400);
        return () => clearTimeout(debounce);
    }, [loadData]);

    React.useEffect(() => {
        setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    }, [columnFilters]);

    // Debounced service search inside the add popover
    React.useEffect(() => {
        if (!isAddOpen) return;
        const handler = setTimeout(async () => {
            setIsSearching(true);
            try {
                const found = await searchServices(searchQuery.trim());
                setResults(found);
                setKnown((prev) => {
                    const next = new Map(prev);
                    found.forEach((s) => next.set(s.id, s.name));
                    return next;
                });
            } finally {
                setIsSearching(false);
            }
        }, 300);
        return () => clearTimeout(handler);
    }, [searchQuery, isAddOpen]);

    const toggleSelect = (id: string) => {
        setSelectedIds((current) =>
            current.includes(id) ? current.filter((v) => v !== id) : [...current, id],
        );
    };

    const handleAdd = async () => {
        if (selectedIds.length === 0) return;
        setIsSaving(true);
        try {
            await api.post(API_ROUTES.PATIENT_GROUP_SERVICES_ASSIGN, { group_id: groupId, service_ids: selectedIds });
            toast({ title: t('added', { count: selectedIds.length }) });
            setSelectedIds([]);
            setSearchQuery('');
            setResults([]);
            setAddOpen(false);
            await loadData();
        } catch (error) {
            toast({ variant: 'destructive', title: t('addError'), description: error instanceof Error ? error.message : undefined });
        } finally {
            setIsSaving(false);
        }
    };

    const handleRemove = async (id: string) => {
        setRemovingId(id);
        try {
            await api.post(API_ROUTES.PATIENT_GROUP_SERVICES_REMOVE, { group_id: groupId, service_ids: [id] });
            toast({ title: t('removed') });
            await loadData();
        } catch (error) {
            toast({ variant: 'destructive', title: t('removeError'), description: error instanceof Error ? error.message : undefined });
        } finally {
            setRemovingId(null);
        }
    };

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
                        disabled={removingId === row.original.id}
                        aria-label={t('remove')}
                    >
                        {removingId === row.original.id
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <Trash2 className="h-4 w-4" />}
                    </Button>
                </div>
            ) : null,
        },
    ];

    const addPopoverEl = canManage ? (
        <Popover open={isAddOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) { setSelectedIds([]); setSearchQuery(''); setResults([]); } }}>
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
                                <CommandEmpty>{t('noResults')}</CommandEmpty>
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
                        <Button size="sm" variant="outline" onClick={() => setAddOpen(false)} disabled={isSaving}>
                            {t('addCancel')}
                        </Button>
                        <Button size="sm" onClick={handleAdd} disabled={isSaving || selectedIds.length === 0}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
                                disabled={removingId === row.id}
                                aria-label={t('remove')}
                            >
                                {removingId === row.id
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
