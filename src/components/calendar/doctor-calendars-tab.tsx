'use client';

import * as React from 'react';
import { AlertTriangle, Calendar as CalendarIcon, Check, ChevronsUpDown, Loader2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useDataLoader } from '@/hooks/use-data-loader';
import { useToast } from '@/hooks/use-toast';
import { API_ROUTES } from '@/constants/routes';
import { getErrorMessage } from '@/lib/error-utils';
import { cn } from '@/lib/utils';
import { api, isTimeoutError, REQUEST_TIMEOUT_MS } from '@/services/api';
import type { Calendar as CalendarType } from '@/lib/types';

interface DoctorCalendarsTabProps {
    userId: string;
    canManage: boolean;
}

async function getCalendars(signal?: AbortSignal): Promise<CalendarType[]> {
        const data = await api.get(API_ROUTES.CALENDARS, undefined, undefined, { signal });
        const raw = Array.isArray(data) ? data : (data?.calendars || data?.data || data?.result || []);
        return raw
            .filter((c: any) => c.is_active !== false)
            .map((c: any) => ({
                id: String(c.id),
                name: c.name,
                color: c.color,
                is_active: c.is_active,
            } as CalendarType));
}

async function getDoctorCalendarIds(userId: string, signal?: AbortSignal): Promise<string[]> {
        const data = await api.get(API_ROUTES.CALENDAR_USERS_SEARCH, { user_id: userId }, undefined, { signal });
        const raw = Array.isArray(data) ? data : (data?.calendar_users || data?.data || []);
        return raw.map((item: any) => String(item.calendar_source_id)).filter(Boolean);
}

/** Error of a multi-calendar save that failed after applying `done` of `total` changes. */
class PartialSaveError extends Error {
    constructor(readonly done: number, readonly total: number, readonly cause: unknown) {
        super(getErrorMessage(cause));
    }
}

async function getCalendarUserIds(calendarId: string): Promise<string[]> {
    const data = await api.get(API_ROUTES.CALENDAR_USERS_SEARCH, { calendar_source_id: calendarId });
    const raw = Array.isArray(data) ? data : (data?.calendar_users || data?.data || []);
    return raw.map((item: any) => String(item.user_id)).filter(Boolean);
}

export function DoctorCalendarsTab({ userId, canManage }: DoctorCalendarsTabProps) {
    const t = useTranslations('DoctorsPage.calendarAccess');
    const tCommon = useTranslations('Common');
    const { toast } = useToast();

    const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
    const [isPopoverOpen, setPopoverOpen] = React.useState(false);

    // Switching doctors quickly can't show another doctor's calendars: only the latest load writes.
    const {
        data: { calendars, calendarIds: initialIds },
        setData,
        isLoading,
        isRefreshing,
        error: loadError,
        reload,
    } = useDataLoader(
        async (signal) => {
            const [calendarList, calendarIds] = await Promise.all([getCalendars(signal), getDoctorCalendarIds(userId, signal)]);
            return { calendars: calendarList, calendarIds };
        },
        { calendars: [] as CalendarType[], calendarIds: [] as string[] },
        [userId]
    );

    React.useEffect(() => {
        setSelectedIds(initialIds);
    }, [initialIds]);

    const isDirty = React.useMemo(() => {
        if (selectedIds.length !== initialIds.length) return true;
        const initialSet = new Set(initialIds);
        return selectedIds.some((id) => !initialSet.has(id));
    }, [selectedIds, initialIds]);

    const toggleCalendar = (id: string) => {
        setSelectedIds((current) =>
            current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
        );
    };

    const selectedCalendars = React.useMemo(
        () => calendars.filter((calendar) => selectedIds.includes(calendar.id)),
        [calendars, selectedIds],
    );

    // Reuses the per-calendar upsert endpoint: for each calendar whose access changed,
    // fetch its current users, add/remove this doctor, and replace the set.
    // One lock for the whole sequence: for each calendar whose access changed, fetch its current
    // users, add/remove this doctor, and replace the set.
    const save = useAsyncAction(
        async (nextIds: string[]) => {
            const initialSet = new Set(initialIds);
            const selectedSet = new Set(nextIds);
            const changed = [
                ...nextIds.filter((id) => !initialSet.has(id)),
                ...initialIds.filter((id) => !selectedSet.has(id)),
            ];

            let done = 0;
            try {
                for (const calendarId of changed) {
                    const currentUsers = await getCalendarUserIds(calendarId);
                    const nextUsers = selectedSet.has(calendarId)
                        ? Array.from(new Set([...currentUsers, userId]))
                        : currentUsers.filter((id) => id !== userId);

                    const responseData = await api.post(API_ROUTES.CALENDAR_USERS_UPSERT, {
                        calendar_source_id: Number(calendarId),
                        user_ids: nextUsers,
                    }, undefined, undefined, { timeoutMs: REQUEST_TIMEOUT_MS.mutation });
                    const error = Array.isArray(responseData)
                        ? responseData.find((item: any) => item?.error)
                        : (responseData as any)?.error;
                    if (error) throw new Error(typeof error === 'string' ? error : t('saveError'));
                    done += 1;
                }
            } catch (error) {
                if (done > 0 || isTimeoutError(error)) throw new PartialSaveError(done, changed.length, error);
                throw error;
            }
            return nextIds;
        },
        {
            onSuccess: (nextIds) => {
                setData((prev) => ({ ...prev, calendarIds: nextIds }));
                toast({ title: t('saved') });
            },
            onError: (error) => {
                if (error instanceof PartialSaveError) {
                    // Some calendars may already be updated: say so and show what the backend really has.
                    toast({
                        variant: 'destructive',
                        title: t('saveError'),
                        description: isTimeoutError(error.cause)
                            ? tCommon('timeoutError')
                            : t('partialSaveError', { done: error.done, total: error.total }),
                    });
                    reload();
                    return;
                }
                // Nothing was applied: keep the user's selection so they can retry.
                toast({ variant: 'destructive', title: t('saveError'), description: getErrorMessage(error) });
            },
            showErrorToast: false,
        }
    );

    const runSave = () => save.run(selectedIds);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
            </div>
        );
    }

    if (loadError) {
        // Showing an empty selection here would let a save wipe the real assignments.
        return (
            <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{tCommon('loadError')}</AlertTitle>
                <AlertDescription className="flex flex-wrap items-center gap-3">
                    <span>{loadError}</span>
                    <Button size="sm" variant="outline" onClick={() => reload()} loading={isRefreshing}>
                        {tCommon('retry')}
                    </Button>
                </AlertDescription>
            </Alert>
        );
    }

    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-sm font-semibold text-foreground">{t('title')}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{t('description')}</p>
            </div>

            <Popover open={isPopoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        disabled={!canManage || save.isPending}
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
                            <CommandEmpty>{t('noItems')}</CommandEmpty>
                            <CommandGroup>
                                {calendars.map((calendar) => (
                                    <CommandItem
                                        key={calendar.id}
                                        value={calendar.name}
                                        onSelect={() => toggleCalendar(calendar.id)}
                                    >
                                        <Check className={cn('mr-2 h-4 w-4', selectedIds.includes(calendar.id) ? 'opacity-100' : 'opacity-0')} />
                                        <span className="flex items-center gap-2">
                                            {calendar.color && (
                                                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: calendar.color }} />
                                            )}
                                            {calendar.name}
                                        </span>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>

            {selectedCalendars.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                    {selectedCalendars.map((calendar) => (
                        <Badge key={calendar.id} variant="secondary" className="gap-1 py-1 pl-2 pr-1">
                            {calendar.color ? (
                                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: calendar.color }} />
                            ) : (
                                <CalendarIcon className="h-3 w-3 text-muted-foreground" />
                            )}
                            <span className="text-xs">{calendar.name}</span>
                            {canManage && (
                                <button
                                    type="button"
                                    disabled={save.isPending}
                                    onClick={() => toggleCalendar(calendar.id)}
                                    className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                                    aria-label={calendar.name}
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

            {canManage && (
                <div className="flex justify-end pt-2">
                    <Button onClick={runSave} disabled={!isDirty} loading={save.isPending}>
                        {t('save')}
                    </Button>
                </div>
            )}
        </div>
    );
}
