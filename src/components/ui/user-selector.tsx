'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { API_ROUTES } from '@/constants/routes';
import { User } from '@/lib/types';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';
import { Check, ChevronsUpDown, Loader2, Plus } from 'lucide-react';

interface UserSelectorProps {
    filterType?: 'PACIENTE' | 'PROVEEDOR';
    isSales?: boolean;
    value?: string;
    selectedUserName?: string;
    onValueChange?: (userId: string, user?: User) => void;
    placeholder?: string;
    triggerText?: string;
    className?: string;
    disabled?: boolean;
}

export function UserSelector({
    filterType = 'PACIENTE',
    isSales = true,
    value,
    selectedUserName,
    onValueChange,
    placeholder = 'Buscar...',
    triggerText = 'Seleccionar',
    className,
    disabled = false,
}: UserSelectorProps) {
    const [open, setOpen] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [users, setUsers] = React.useState<User[]>([]);
    const [selectedUserCache, setSelectedUserCache] = React.useState<User | null>(null);
    const [isLoading, setIsLoading] = React.useState(false);
    const [isCreating, setIsCreating] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);
    const [createName, setCreateName] = React.useState('');
    const [createPhone, setCreatePhone] = React.useState('');
    const [createEmail, setCreateEmail] = React.useState('');
    const [createError, setCreateError] = React.useState<string | null>(null);

    React.useEffect(() => {
        setIsCreating(false);
    }, [searchQuery]);

    const handleOpenChange = (nextOpen: boolean) => {
        if (!nextOpen) {
            setIsCreating(false);
            setCreateName('');
            setCreatePhone('');
            setCreateEmail('');
            setCreateError(null);
        }
        setOpen(nextOpen);
    };

    React.useEffect(() => {
        const handler = setTimeout(async () => {
            setIsLoading(true);
            try {
                const params: Record<string, string> = { filter_type: filterType };
                if (searchQuery.trim()) params.search = searchQuery.trim();
                const data = await api.get(API_ROUTES.USERS, params);
                let usersData: any[] = [];
                if (Array.isArray(data) && data.length > 0) {
                    const first = data[0];
                    usersData = first.json?.data || first.data || [];
                } else if (data?.data) {
                    usersData = data.data;
                }
                setUsers(usersData.map((u: any): User => ({
                    id: String(u.id),
                    name: u.name || 'Sin nombre',
                    email: u.email || '',
                    phone_number: u.phone_number || '',
                    is_active: u.is_active ?? true,
                    avatar: '',
                })));
            } catch {
                setUsers([]);
            } finally {
                setIsLoading(false);
            }
        }, 300);
        return () => clearTimeout(handler);
    }, [searchQuery, filterType]);

    const fallbackSelectedUser = React.useMemo<User | undefined>(() => {
        if (!value || !selectedUserName) return undefined;
        return { id: value, name: selectedUserName, email: '', phone_number: '', is_active: true, avatar: '' };
    }, [value, selectedUserName]);

    const selectedUser = React.useMemo(() => {
        const fromResults = users.find(u => u.id === value);
        if (fromResults) return fromResults;
        if (selectedUserCache?.id === value) return selectedUserCache;
        return fallbackSelectedUser;
    }, [fallbackSelectedUser, selectedUserCache, users, value]);

    React.useEffect(() => {
        const fromResults = users.find(u => u.id === value);
        if (fromResults) setSelectedUserCache(fromResults);
        else if (!value) setSelectedUserCache(null);
    }, [users, value]);

    const handleSelect = (user: User) => {
        setSelectedUserCache(user);
        onValueChange?.(user.id, user);
        setOpen(false);
        setSearchQuery('');
        setIsCreating(false);
    };

    const handleStartCreate = () => {
        setCreateName(searchQuery.trim());
        setCreatePhone('');
        setCreateEmail('');
        setCreateError(null);
        setIsCreating(true);
    };

    const buildConflictMessage = (conflictedFields: string[], label: string): string => {
        const fieldLabels: Record<string, string> = { email: 'email', phone: 'teléfono', phone_number: 'teléfono' };
        const names = Array.from(new Set(conflictedFields.map(f => fieldLabels[f] || f)));
        return `Ya existe un ${label} con ese ${names.join(' y ')}.`;
    };

    const handleCreateUser = async () => {
        const name = createName.trim();
        if (!name) return;
        setIsSaving(true);
        setCreateError(null);
        try {
            const responseData = await api.post(API_ROUTES.USERS_UPSERT, {
                name,
                phone: createPhone.trim() || '',
                email: createEmail.trim() || '',
                filter_type: filterType,
                is_sales: isSales,
                is_active: true,
            });

            const errPayload = responseData?.error;
            if (errPayload?.code === 'unique_conflict') {
                setCreateError(buildConflictMessage(errPayload.conflictedFields ?? [], entityLabel));
                return;
            }
            if (errPayload) {
                setCreateError('Revisá que la información ingresada sea válida.');
                return;
            }

            const params: Record<string, string> = { filter_type: filterType, search: name };
            const data = await api.get(API_ROUTES.USERS, params);
            let usersData: any[] = [];
            if (Array.isArray(data) && data.length > 0) {
                const first = data[0];
                usersData = first.json?.data || first.data || [];
            } else if (data?.data) {
                usersData = data.data;
            }
            const newUsers = usersData.map((u: any): User => ({
                id: String(u.id),
                name: u.name || 'Sin nombre',
                email: u.email || '',
                phone_number: u.phone_number || '',
                is_active: u.is_active ?? true,
                avatar: '',
            }));
            setUsers(newUsers);

            const created = newUsers.find((u: User) => u.name.toLowerCase() === name.toLowerCase()) || newUsers[0];
            if (created) handleSelect(created);
        } catch (err: any) {
            const errPayload = err?.response?.error || err?.data?.error || err?.error;
            if (errPayload?.code === 'unique_conflict') {
                setCreateError(buildConflictMessage(errPayload.conflictedFields ?? [], entityLabel));
            } else {
                setCreateError('Revisá que la información ingresada sea válida.');
            }
        } finally {
            setIsSaving(false);
        }
    };

    const entityLabel = filterType === 'PROVEEDOR' ? 'proveedor' : 'paciente';

    return (
        <Popover open={open} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    className={cn('w-full justify-between', !value && 'text-muted-foreground', className)}
                    disabled={disabled}
                >
                    {value && selectedUser
                        ? <span className="truncate block">{selectedUser.name}</span>
                        : triggerText}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command shouldFilter={false}>
                    <CommandInput
                        placeholder={placeholder}
                        value={searchQuery}
                        onValueChange={setSearchQuery}
                    />
                    <CommandList>
                        {isLoading ? (
                            <div className="flex items-center justify-center p-4">
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                <span className="text-sm text-muted-foreground">Buscando...</span>
                            </div>
                        ) : (
                            <>
                                {users.length > 0 && (
                                    <CommandGroup>
                                        {users.map(user => (
                                            <CommandItem
                                                key={user.id}
                                                value={user.name}
                                                onSelect={() => handleSelect(user)}
                                            >
                                                <Check className={cn('mr-2 h-4 w-4', value === user.id ? 'opacity-100' : 'opacity-0')} />
                                                <div className="flex flex-col truncate">
                                                    <span className="truncate">{user.name}</span>
                                                    {user.phone_number && (
                                                        <span className="text-xs text-muted-foreground truncate">{user.phone_number}</span>
                                                    )}
                                                </div>
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                )}

                                {users.length === 0 && (
                                    <p className="py-5 text-center text-sm text-muted-foreground">
                                        No hay resultados.
                                    </p>
                                )}

                                {searchQuery.trim() && (
                                    <div className={cn('border-t', users.length === 0 && 'border-t-0')}>
                                        {isCreating ? (
                                            <div className="p-2 space-y-1.5">
                                                <p className="text-xs text-muted-foreground px-1">
                                                    Se creará un nuevo {entityLabel}
                                                </p>
                                                <Input
                                                    value={createName}
                                                    onChange={e => { setCreateName(e.target.value); setCreateError(null); }}
                                                    placeholder="Nombre *"
                                                    className="h-7 text-sm"
                                                    autoFocus
                                                />
                                                <Input
                                                    value={createPhone}
                                                    onChange={e => { setCreatePhone(e.target.value); setCreateError(null); }}
                                                    placeholder="Teléfono"
                                                    className="h-7 text-sm"
                                                />
                                                <Input
                                                    value={createEmail}
                                                    onChange={e => { setCreateEmail(e.target.value); setCreateError(null); }}
                                                    placeholder="Email"
                                                    className="h-7 text-sm"
                                                />
                                                {createError && (
                                                    <p className="text-xs text-destructive px-1">{createError}</p>
                                                )}
                                                <div className="flex justify-end pt-0.5">
                                                    <Button
                                                        size="sm"
                                                        className="bg-green-600 hover:bg-green-700 text-white shrink-0"
                                                        onClick={handleCreateUser}
                                                        disabled={isSaving || !createName.trim()}
                                                        type="button"
                                                    >
                                                        {isSaving && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                                                        Guardar
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <button
                                                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent cursor-pointer text-left"
                                                onClick={handleStartCreate}
                                                type="button"
                                            >
                                                <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                                <span className="truncate">Crear "{searchQuery}"</span>
                                            </button>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

export default UserSelector;
