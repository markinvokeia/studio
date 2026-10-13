'use client';

import * as React from 'react';
import { Check, UserMinus, UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';

import { useAuth } from '@/context/AuthContext';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { StudyOrderAssignee, StudyOrderAssignResult } from '@/lib/types';
import { assignStudyOrder, getStudyOrderAssignees } from '@/services/study-orders';

/**
 * Asignar quién de la clínica revisa la orden ("Revisada por").
 *
 * Solo se ofrece el staff (rol recepcionista, gerente o administrador); el backend lo vuelve a
 * validar. "Asignármela" queda arriba porque es lo más común: quien toma la orden se la queda.
 */

export interface StudyOrderAssignDialogProps {
    /** La orden a asignar; null = cerrado. */
    order: { id: string; order_number: string; assigned_to?: string | null } | null;
    onOpenChange: (open: boolean) => void;
    onAssigned?: (result: StudyOrderAssignResult) => void;
}

/**
 * Se puede asignar quién la revisa: lo que ve la clínica (enviadas, o borradores que creó el agente
 * de WhatsApp) y que no esté anulado. Misma regla que /study-orders/assign.
 */
export function isStudyOrderAssignable(order: { status: string; source?: string | null }): boolean {
    return order.status !== 'cancelled' && (order.status !== 'draft' || order.source === 'whatsapp');
}

/** Iniciales para el avatar: "Ana Pérez" → "AP". */
export function initialsOf(name: string | null | undefined): string {
    return (name ?? '')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('');
}

export function StudyOrderAssignDialog({ order, onOpenChange, onAssigned }: StudyOrderAssignDialogProps) {
    const t = useTranslations('StudyOrdersPage.assign');
    const { toast } = useToast();
    const { user } = useAuth();
    const open = !!order;

    const [assignees, setAssignees] = React.useState<StudyOrderAssignee[] | null>(null);
    const [loadError, setLoadError] = React.useState(false);
    const [reloadKey, setReloadKey] = React.useState(0);
    /** Elegido en la lista ('' = sin asignar). Arranca en el responsable actual. */
    const [selectedId, setSelectedId] = React.useState('');

    React.useEffect(() => {
        if (order) setSelectedId(order.assigned_to ?? '');
    }, [order]);

    // La lista se pide al abrir (y al reintentar); una respuesta tardía no pisa a otra.
    React.useEffect(() => {
        if (!open) return;
        const controller = new AbortController();
        setLoadError(false);
        setAssignees(null);
        getStudyOrderAssignees(controller.signal)
            .then((list) => { if (!controller.signal.aborted) setAssignees(list); })
            .catch(() => { if (!controller.signal.aborted) setLoadError(true); });
        return () => controller.abort();
    }, [open, reloadKey]);

    const save = useAsyncAction(
        (orderId: string, userId: string | null) => assignStudyOrder(orderId, userId),
        {
            onSuccess: (result) => {
                toast({
                    title: result.assigned_to
                        ? t('toast.assigned', { name: result.assigned_to_name ?? '' })
                        : t('toast.unassigned'),
                    description: result.order_number,
                });
                onAssigned?.(result);
                onOpenChange(false);
            },
            errorTitle: t('toast.error'),
        },
    );

    const meIsAssignable = !!user && !!assignees?.some((a) => a.id === user.id);
    const unchanged = selectedId === (order?.assigned_to ?? '');

    return (
        <Dialog
            open={open}
            // No se cierra mientras se guarda: el resultado tiene que llegar a algún lado.
            onOpenChange={(next) => { if (!save.isPending) onOpenChange(next); }}
        >
            <DialogContent maxWidth="md">
                <DialogHeader>
                    <DialogTitle>{t('title', { number: order?.order_number ?? '' })}</DialogTitle>
                    <DialogDescription>{t('description')}</DialogDescription>
                </DialogHeader>

                {loadError ? (
                    <div className="space-y-3 py-4 text-center">
                        <p className="text-sm text-muted-foreground">{t('loadError')}</p>
                        <Button variant="outline" size="sm" onClick={() => setReloadKey((k) => k + 1)}>{t('retry')}</Button>
                    </div>
                ) : !assignees ? (
                    <div className="space-y-2 py-2">
                        <Skeleton className="h-9 w-full" />
                        <Skeleton className="h-9 w-full" />
                        <Skeleton className="h-9 w-full" />
                    </div>
                ) : (
                    <div className="space-y-3">
                        {meIsAssignable && user && selectedId !== user.id && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="w-full justify-start"
                                disabled={save.isPending}
                                onClick={() => setSelectedId(user.id)}
                            >
                                <UserRound className="mr-2 h-4 w-4" aria-hidden="true" />
                                {t('assignToMe')}
                            </Button>
                        )}
                        <Command className="rounded-md border">
                            <CommandInput placeholder={t('search')} />
                            <CommandList className="max-h-64">
                                <CommandEmpty>{t('empty')}</CommandEmpty>
                                <CommandGroup>
                                    <CommandItem
                                        value={`__none__ ${t('nobody')}`}
                                        onSelect={() => setSelectedId('')}
                                        disabled={save.isPending}
                                    >
                                        <span className="mr-2 grid h-6 w-6 place-items-center rounded-full bg-muted text-muted-foreground">
                                            <UserMinus className="h-3.5 w-3.5" aria-hidden="true" />
                                        </span>
                                        <span className="flex-1">{t('nobody')}</span>
                                        <Check className={cn('h-4 w-4', selectedId === '' ? 'opacity-100' : 'opacity-0')} aria-hidden="true" />
                                    </CommandItem>
                                    {assignees.map((a) => (
                                        <CommandItem
                                            key={a.id}
                                            value={`${a.name} ${a.email ?? ''} ${a.id}`}
                                            onSelect={() => setSelectedId(a.id)}
                                            disabled={save.isPending}
                                        >
                                            <span className="mr-2 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                                                {initialsOf(a.name)}
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate">
                                                    {a.name}
                                                    {a.id === user?.id && <span className="text-muted-foreground"> ({t('me')})</span>}
                                                </span>
                                                {a.email && <span className="block truncate text-xs text-muted-foreground">{a.email}</span>}
                                            </span>
                                            <Check className={cn('h-4 w-4', selectedId === a.id ? 'opacity-100' : 'opacity-0')} aria-hidden="true" />
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" disabled={save.isPending} onClick={() => onOpenChange(false)}>
                        {t('cancel')}
                    </Button>
                    <Button
                        loading={save.isPending}
                        disabled={!order || !assignees || unchanged || save.isPending}
                        onClick={() => { if (order) void save.run(order.id, selectedId || null); }}
                    >
                        {t('save')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default StudyOrderAssignDialog;
