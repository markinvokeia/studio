'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { API_ROUTES } from '@/constants/routes';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';
import { ensureGroupOption, normalizeGroupOptions, type GroupOption } from '@/services/patientGroups';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';

interface PatientGroupSelectorProps {
    values?: string[];
    selectedGroups?: GroupOption[];
    onValuesChange: (groupIds: string[], groups: GroupOption[]) => void;
    placeholder?: string;
    triggerText?: string;
    emptyText?: string;
    loadingText?: string;
    className?: string;
    disabled?: boolean;
}

export function PatientGroupSelector({
    values,
    selectedGroups,
    onValuesChange,
    placeholder = 'Buscar grupo...',
    triggerText = 'Seleccionar',
    emptyText = 'No hay resultados.',
    loadingText = 'Buscando...',
    className,
    disabled = false,
}: PatientGroupSelectorProps) {
    const ids = values ?? [];

    const [open, setOpen] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [groups, setGroups] = React.useState<GroupOption[]>([]);
    const [isLoading, setIsLoading] = React.useState(false);

    React.useEffect(() => {
        const handler = setTimeout(async () => {
            setIsLoading(true);
            try {
                const params: Record<string, string> = { page: '1', limit: '50' };
                if (searchQuery.trim()) params.search = searchQuery.trim();
                const data = await api.get(API_ROUTES.PATIENT_GROUPS, params);
                let nextGroups = normalizeGroupOptions(data);
                nextGroups = await ensureGroupOption(nextGroups, selectedGroups ?? []);
                setGroups(nextGroups);
            } catch {
                setGroups([]);
            } finally {
                setIsLoading(false);
            }
        }, 300);
        return () => clearTimeout(handler);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchQuery]);

    const selectedGroupsMap = React.useMemo(() => {
        const map = new Map<string, GroupOption>();
        for (const group of selectedGroups ?? []) map.set(group.id, group);
        for (const group of groups) map.set(group.id, group);
        return map;
    }, [groups, selectedGroups]);

    const handleSelect = (group: GroupOption) => {
        const isSelected = ids.includes(group.id);
        const nextIds = isSelected ? ids.filter((id) => id !== group.id) : [...ids, group.id];
        const nextGroups = nextIds.map((id) => selectedGroupsMap.get(id)).filter((g): g is GroupOption => Boolean(g));
        onValuesChange(nextIds, nextGroups);
    };

    const triggerLabel = ids.length === 0
        ? triggerText
        : ids.length === 1
            ? (selectedGroupsMap.get(ids[0])?.name ?? triggerText)
            : `${ids.length} grupos seleccionados`;

    const hasSelection = ids.length > 0;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    className={cn('w-full justify-between', !hasSelection && 'text-muted-foreground', className)}
                    disabled={disabled}
                >
                    <span className="truncate block">{triggerLabel}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command shouldFilter={false}>
                    <CommandInput placeholder={placeholder} value={searchQuery} onValueChange={setSearchQuery} />
                    <CommandList>
                        {isLoading ? (
                            <div className="flex items-center justify-center p-4">
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                <span className="text-sm text-muted-foreground">{loadingText}</span>
                            </div>
                        ) : groups.length > 0 ? (
                            <CommandGroup>
                                {groups.map((group) => {
                                    const isChecked = ids.includes(group.id);
                                    return (
                                        <CommandItem key={group.id} value={group.name} onSelect={() => handleSelect(group)}>
                                            <Check className={cn('mr-2 h-4 w-4', isChecked ? 'opacity-100' : 'opacity-0')} />
                                            <span className="truncate">{group.name}</span>
                                        </CommandItem>
                                    );
                                })}
                            </CommandGroup>
                        ) : (
                            <p className="py-5 text-center text-sm text-muted-foreground">{emptyText}</p>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

export default PatientGroupSelector;
