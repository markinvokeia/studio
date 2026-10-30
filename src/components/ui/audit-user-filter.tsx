'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { API_ROUTES } from '@/constants/routes';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';

export interface AuditUserOption {
    id: string;
    name: string;
}

interface AuditUserFilterProps {
    value?: string;
    selectedUserName?: string;
    onValueChange: (userId: string, user?: AuditUserOption) => void;
    placeholder?: string;
    triggerText?: string;
    emptyText?: string;
    loadingText?: string;
    className?: string;
}

/** Async, searchable user picker used to filter the audit log by `changed_by`.
 *  Backed by `API_ROUTES.USERS` (any clinic staff user) — unlike `FILTER_USERS`
 *  (trigram similarity search), it also returns a plain browsable list when the
 *  search box is empty, so the popover shows candidates as soon as it opens. */
export function AuditUserFilter({
    value,
    selectedUserName,
    onValueChange,
    placeholder = 'Buscar usuario...',
    triggerText = 'Usuario',
    emptyText = 'No hay resultados.',
    loadingText = 'Buscando...',
    className,
}: AuditUserFilterProps) {
    const [open, setOpen] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [users, setUsers] = React.useState<AuditUserOption[]>([]);
    const [isLoading, setIsLoading] = React.useState(false);

    React.useEffect(() => {
        if (!open) return;
        const handler = setTimeout(async () => {
            setIsLoading(true);
            try {
                const params: Record<string, string> = { limit: '10', page: '1', only_active: 'false' };
                if (searchQuery.trim()) params.search = searchQuery.trim();
                const responseData = await api.get(API_ROUTES.USERS, params);
                let usersData: any[] = [];
                if (Array.isArray(responseData) && responseData.length > 0) {
                    const first = responseData[0];
                    usersData = first.json?.data || first.data || [];
                } else if (responseData?.data) {
                    usersData = responseData.data;
                }
                setUsers(usersData.map((u: any) => ({ id: String(u.id ?? u.user_id), name: u.name || '' })));
            } catch {
                setUsers([]);
            } finally {
                setIsLoading(false);
            }
        }, 400);
        return () => clearTimeout(handler);
    }, [searchQuery, open]);

    const handleSelect = (user: AuditUserOption) => {
        onValueChange(user.id, user);
        setOpen(false);
        setSearchQuery('');
    };

    const triggerLabel = value ? (selectedUserName || users.find((u) => u.id === value)?.name || triggerText) : triggerText;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    className={cn('justify-between font-normal', !value && 'text-muted-foreground', className)}
                >
                    <span className="truncate">{triggerLabel}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[220px] p-0" align="start">
                <Command shouldFilter={false}>
                    <CommandInput placeholder={placeholder} value={searchQuery} onValueChange={setSearchQuery} />
                    <CommandList>
                        {isLoading ? (
                            <div className="flex items-center justify-center p-4">
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                <span className="text-sm text-muted-foreground">{loadingText}</span>
                            </div>
                        ) : users.length > 0 ? (
                            <CommandGroup>
                                {users.map((user) => (
                                    <CommandItem key={user.id} value={user.id} onSelect={() => handleSelect(user)}>
                                        <Check className={cn('mr-2 h-4 w-4', value === user.id ? 'opacity-100' : 'opacity-0')} />
                                        <span className="truncate">{user.name}</span>
                                    </CommandItem>
                                ))}
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

export default AuditUserFilter;
