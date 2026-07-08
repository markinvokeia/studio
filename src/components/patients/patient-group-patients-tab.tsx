'use client';

import * as React from 'react';
import { Check, Loader2, Plus, Trash2, User as UserIcon, X } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { api } from '@/services/api';

interface PatientGroupPatientsTabProps {
    groupId: string;
    canManage: boolean;
}

type PatientRow = {
    id: string;
    name: string;
    email?: string;
    phone_number?: string;
    identity_document?: string;
    is_active?: boolean;
};

/**
 * Tolerant extractor: handles the paginated `{ data, total }` envelope as well
 * as a bare array of patient rows (older flow shape), whether or not it is
 * wrapped in `[{ json: ... }]`.
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
            // array of `{ json: row }` items
            return { list: raw.map((i: any) => i.json), total: raw.length };
        }
        if (first && (first.data !== undefined || first.total !== undefined)) return fromEnvelope(first);
        // bare array of patient rows
        return { list: raw, total: raw.length };
    }
    if (raw && typeof raw === 'object') return fromEnvelope(raw);
    return { list: [], total: 0 };
}

function mapPatient(p: any): PatientRow {
    return {
        id: String(p.id),
        name: p.name ?? '',
        email: p.email ?? '',
        phone_number: p.phone_number ?? '',
        identity_document: p.identity_document ?? '',
        is_active: p.is_active ?? true,
    };
}

async function fetchGroupPatients(
    groupId: string,
    pagination: PaginationState,
    search: string,
): Promise<{ rows: PatientRow[]; total: number }> {
    try {
        const { list, total } = parseList(await api.get(API_ROUTES.PATIENT_GROUP_PATIENTS, {
            group_id: groupId,
            page: (pagination.pageIndex + 1).toString(),
            limit: pagination.pageSize.toString(),
            search,
        }));
        return { rows: list.map(mapPatient).filter((p) => p.id), total: total || list.length };
    } catch (error) {
        console.error('Failed to fetch group patients:', error);
        return { rows: [], total: 0 };
    }
}

async function searchPatients(search: string): Promise<PatientRow[]> {
    try {
        const { list } = parseList(await api.get(API_ROUTES.USERS, {
            filter_type: 'PACIENTE',
            search,
            page: '1',
            limit: '20',
            only_debtors: 'false',
            only_active: 'true',
        }));
        return list.map(mapPatient).filter((p) => p.id);
    } catch (error) {
        console.error('Failed to search patients:', error);
        return [];
    }
}

export function PatientGroupPatientsTab({ groupId, canManage }: PatientGroupPatientsTabProps) {
    const t = useTranslations('PatientGroupsPage.patients');
    const { toast } = useToast();

    const viewportNarrow = useViewportNarrow();
    const [viewMode, setViewMode] = useTableViewMode('patient-group-patients', 'table');
    const showToggle = !viewportNarrow;
    const useListView = showToggle && viewMode === 'list';
    const isNarrow = viewportNarrow || useListView;
    const viewToggleEl = showToggle ? <ViewModeToggle value={viewMode} onChange={setViewMode} /> : undefined;

    const [rows, setRows] = React.useState<PatientRow[]>([]);
    const [total, setTotal] = React.useState(0);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: 25 });
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
    const [removingId, setRemovingId] = React.useState<string | null>(null);

    // Add popover
    const [isAddOpen, setAddOpen] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [results, setResults] = React.useState<PatientRow[]>([]);
    const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
    const [known, setKnown] = React.useState<Map<string, string>>(new Map());
    const [isSearching, setIsSearching] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);

    const loadData = React.useCallback(async () => {
        setIsRefreshing(true);
        const search = (columnFilters.find((f) => f.id === 'name')?.value as string) || '';
        const { rows: fetched, total: t2 } = await fetchGroupPatients(groupId, pagination, search);
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

    // Debounced patient search inside the add popover
    React.useEffect(() => {
        if (!isAddOpen) return;
        const handler = setTimeout(async () => {
            setIsSearching(true);
            try {
                const found = await searchPatients(searchQuery.trim());
                setResults(found);
                setKnown((prev) => {
                    const next = new Map(prev);
                    found.forEach((p) => next.set(p.id, p.name));
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
            await api.post(API_ROUTES.PATIENT_GROUP_ASSIGN, { group_id: groupId, user_ids: selectedIds });
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
            await api.post(API_ROUTES.PATIENT_GROUP_REMOVE, { group_id: groupId, user_ids: [id] });
            toast({ title: t('removed') });
            await loadData();
        } catch (error) {
            toast({ variant: 'destructive', title: t('removeError'), description: error instanceof Error ? error.message : undefined });
        } finally {
            setRemovingId(null);
        }
    };

    const columns: ColumnDef<PatientRow>[] = [
        { accessorKey: 'name', header: t('col_name') },
        { accessorKey: 'identity_document', header: t('col_document') },
        { accessorKey: 'phone_number', header: t('col_phone') },
        { accessorKey: 'email', header: t('col_email') },
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
                                    {results.map((p) => (
                                        <CommandItem key={p.id} value={p.id} onSelect={() => toggleSelect(p.id)}>
                                            <Check className={cn('mr-2 h-4 w-4', selectedIds.includes(p.id) ? 'opacity-100' : 'opacity-0')} />
                                            <span className="flex items-center gap-2">
                                                <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                                {p.name}
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
                renderCard={(row: PatientRow) => (
                    <DataCard
                        title={row.name}
                        subtitle={[row.identity_document, row.phone_number].filter(Boolean).join(' · ')}
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

export default PatientGroupPatientsTab;
