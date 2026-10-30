'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, Loader2, Boxes, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PURCHASES_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';

interface ProviderGroupsFieldProps {
    /** Provider whose groups are managed. Omit for deferred mode (provider not
     *  created yet): the selection is reported via `onChange` and the host
     *  persists it later with `saveProviderGroups`. */
    providerId?: string;
    /** Deferred mode: initial selection. */
    value?: string[];
    /** Deferred mode: called with the selected group ids on every change. */
    onChange?: (groupIds: string[]) => void;
}

type GroupOption = { id: string; name: string };

/** Tolerant extractor for the different shapes the n8n webhooks return. */
function extractRows(data: any): any[] {
    if (Array.isArray(data)) {
        if (data.length === 0) return [];
        const first = data[0];
        if (first?.json && typeof first.json === 'object') return first.json.data ?? first.json ?? [];
        if (first?.data) return first.data;
        return data;
    }
    if (data && typeof data === 'object') return data.data ?? [];
    return [];
}

const mapGroup = (g: any): GroupOption => ({ id: g?.id != null ? String(g.id) : '', name: g?.name ?? '' });

async function fetchAllGroups(): Promise<GroupOption[]> {
    try {
        const data = await api.get(API_ROUTES.PROVIDER_GROUPS, { page: '1', limit: '1000' });
        return extractRows(data)
            .filter((g: any) => g.is_active !== false)
            .map(mapGroup)
            .filter((g) => g.id);
    } catch (error) {
        console.error('Failed to fetch groups:', error);
        return [];
    }
}

async function fetchProviderGroups(providerId: string): Promise<GroupOption[]> {
    try {
        const data = await api.get(API_ROUTES.PROVIDER_GROUPS_BY_PROVIDER, { provider_id: providerId });
        return extractRows(data).map(mapGroup).filter((g) => g.id);
    } catch (error) {
        console.error('Failed to fetch provider groups:', error);
        return [];
    }
}

/** Persists a provider's group assignments (used inline and by deferred-mode hosts). */
export async function saveProviderGroups(providerId: string, groupIds: string[]): Promise<void> {
    const responseData = await api.post(API_ROUTES.PROVIDER_GROUPS_BY_PROVIDER, {
        provider_id: providerId,
        group_ids: groupIds,
    });
    const error = Array.isArray(responseData)
        ? responseData.find((item: any) => item?.error)
        : (responseData as any)?.error;
    if (error) throw new Error(typeof error === 'string' ? error : 'Failed to save provider groups');
}

export function ProviderGroupsField({ providerId, value, onChange }: ProviderGroupsFieldProps) {
    const t = useTranslations('ProvidersPage.providerGroups');
    const { toast } = useToast();
    const { hasPermission } = usePermissions();
    // Deferred mode has no provider yet — the host (create dialog) is already
    // permission-gated, so selection is always allowed there.
    const canManage = providerId ? hasPermission(PURCHASES_PERMISSIONS.SUPPLIERS_UPDATE) : true;

    const [groups, setGroups] = React.useState<GroupOption[]>([]);
    const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
    const [initialIds, setInitialIds] = React.useState<string[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isSaving, setIsSaving] = React.useState(false);
    const [open, setOpen] = React.useState(false);

    React.useEffect(() => {
        let cancelled = false;
        setIsLoading(true);
        if (!providerId) {
            // Deferred mode: only the catalog is needed; selection starts from `value`.
            fetchAllGroups()
                .then((all) => {
                    if (cancelled) return;
                    setSelectedIds(value ?? []);
                    setInitialIds([]);
                    setGroups(all.sort((a, b) => a.name.localeCompare(b.name)));
                })
                .finally(() => { if (!cancelled) setIsLoading(false); });
            return () => { cancelled = true; };
        }
        Promise.all([fetchAllGroups(), fetchProviderGroups(providerId)])
            .then(([all, mine]) => {
                if (cancelled) return;
                const ids = mine.map((m) => m.id);
                setSelectedIds(ids);
                setInitialIds(ids);
                // Merge so the provider's current groups are always selectable, even if inactive.
                const map = new Map(all.map((g) => [g.id, g]));
                mine.forEach((m) => { if (!map.has(m.id)) map.set(m.id, m); });
                setGroups([...map.values()].sort((a, b) => a.name.localeCompare(b.name)));
            })
            .finally(() => { if (!cancelled) setIsLoading(false); });
        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [providerId]);

    const isDirty = React.useMemo(() => {
        if (selectedIds.length !== initialIds.length) return true;
        const initialSet = new Set(initialIds);
        return selectedIds.some((id) => !initialSet.has(id));
    }, [selectedIds, initialIds]);

    const toggleGroup = (id: string) => {
        const next = selectedIds.includes(id)
            ? selectedIds.filter((v) => v !== id)
            : [...selectedIds, id];
        setSelectedIds(next);
        onChange?.(next);
    };

    const selectedGroups = React.useMemo(
        () => groups.filter((g) => selectedIds.includes(g.id)),
        [groups, selectedIds],
    );

    const handleSave = async () => {
        if (!providerId) return;
        setIsSaving(true);
        try {
            await saveProviderGroups(providerId, selectedIds);
            setInitialIds(selectedIds);
            toast({ title: t('saved') });
        } catch (error) {
            toast({ variant: 'destructive', title: t('saveError'), description: error instanceof Error ? error.message : undefined });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-2">
            <label className="text-sm font-medium leading-none">{t('label')}</label>

            {isLoading ? (
                <div className="flex items-center gap-2 py-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                </div>
            ) : (
                <>
                    <Popover open={open} onOpenChange={setOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                type="button"
                                variant="outline"
                                role="combobox"
                                disabled={!canManage}
                                className="w-full justify-between font-normal"
                            >
                                <span className="truncate">
                                    {selectedIds.length > 0 ? t('count', { count: selectedIds.length }) : t('selectPlaceholder')}
                                </span>
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                            <Command>
                                <CommandInput placeholder={t('search')} />
                                <CommandList>
                                    <CommandEmpty>{t('noResults')}</CommandEmpty>
                                    <CommandGroup>
                                        {groups.map((group) => (
                                            <CommandItem key={group.id} value={group.name} onSelect={() => toggleGroup(group.id)}>
                                                <Check className={cn('mr-2 h-4 w-4', selectedIds.includes(group.id) ? 'opacity-100' : 'opacity-0')} />
                                                {group.name}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>

                    {selectedGroups.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {selectedGroups.map((group) => (
                                <Badge key={group.id} variant="secondary" className="gap-1 py-1 pl-2 pr-1">
                                    <Boxes className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-xs">{group.name}</span>
                                    {canManage && (
                                        <button
                                            type="button"
                                            onClick={() => toggleGroup(group.id)}
                                            className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                                            aria-label={group.name}
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    )}
                                </Badge>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-muted-foreground">{t('empty')}</p>
                    )}

                    {providerId && canManage && isDirty && (
                        <div className="flex justify-end">
                            <Button type="button" size="sm" onClick={handleSave} disabled={isSaving}>
                                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {t('save')}
                            </Button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export default ProviderGroupsField;
