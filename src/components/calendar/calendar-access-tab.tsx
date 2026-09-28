'use client';

import * as React from 'react';
import { AlertTriangle, Check, ChevronsUpDown, Loader2, Stethoscope, X } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { api, isTimeoutError, REQUEST_TIMEOUT_MS } from '@/services/api';
import type { User as UserType } from '@/lib/types';

interface CalendarAccessTabProps {
    calendarId: string;
    canManage: boolean;
}

async function getDoctors(signal?: AbortSignal): Promise<UserType[]> {
        const data = await api.get(API_ROUTES.USERS, { filter_type: 'DOCTOR' }, undefined, { signal });
        let doctorsData: any[] = [];
        if (Array.isArray(data) && data.length > 0) {
            const first = data[0];
            if (first.json && typeof first.json === 'object') doctorsData = first.json.data || [];
            else if (first.data) doctorsData = first.data;
            else doctorsData = data;
        } else if (data && typeof data === 'object' && data.data) {
            doctorsData = data.data;
        }
        return doctorsData
            .filter((d: any) => d.is_active !== false)
            .map((d: any) => ({ ...d, id: String(d.id) } as UserType));
}

async function getCalendarUserIds(calendarId: string, signal?: AbortSignal): Promise<string[]> {
        const data = await api.get(API_ROUTES.CALENDAR_USERS_SEARCH, { calendar_source_id: calendarId }, undefined, { signal });
        const raw = Array.isArray(data) ? data : (data?.calendar_users || data?.data || []);
        return raw.map((item: any) => String(item.user_id ?? item.id)).filter(Boolean);
}

export function CalendarAccessTab({ calendarId, canManage }: CalendarAccessTabProps) {
    const t = useTranslations('CalendarsPage.access');
    const tCommon = useTranslations('Common');
    const { toast } = useToast();

    const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
    const [isPopoverOpen, setPopoverOpen] = React.useState(false);

    // Switching calendars quickly can't show another calendar's users: only the latest load writes.
    const {
        data: { doctors, userIds: initialIds },
        setData,
        isLoading,
        isRefreshing,
        error: loadError,
        reload,
    } = useDataLoader(
        async (signal) => {
            const [doctorList, userIds] = await Promise.all([getDoctors(signal), getCalendarUserIds(calendarId, signal)]);
            return { doctors: doctorList, userIds };
        },
        { doctors: [] as UserType[], userIds: [] as string[] },
        [calendarId]
    );

    React.useEffect(() => {
        setSelectedIds(initialIds);
    }, [initialIds]);

    const isDirty = React.useMemo(() => {
        if (selectedIds.length !== initialIds.length) return true;
        const initialSet = new Set(initialIds);
        return selectedIds.some((id) => !initialSet.has(id));
    }, [selectedIds, initialIds]);

    const toggleDoctor = (id: string) => {
        setSelectedIds((current) =>
            current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
        );
    };

    const selectedDoctors = React.useMemo(
        () => doctors.filter((doctor) => selectedIds.includes(doctor.id)),
        [doctors, selectedIds],
    );

    const save = useAsyncAction(
        async (userIds: string[]) => {
            const responseData = await api.post(API_ROUTES.CALENDAR_USERS_UPSERT, {
                calendar_source_id: Number(calendarId),
                user_ids: userIds,
            }, undefined, undefined, { timeoutMs: REQUEST_TIMEOUT_MS.mutation });
            const error = Array.isArray(responseData)
                ? responseData.find((item: any) => item?.error)
                : (responseData as any)?.error;
            if (error) throw new Error(typeof error === 'string' ? error : t('saveError'));
            return userIds;
        },
        {
            onSuccess: (userIds) => {
                setData((prev) => ({ ...prev, userIds }));
                toast({ title: t('saved') });
            },
            // The change may have been applied before the timeout: show the real assignments.
            onError: (error) => { if (isTimeoutError(error)) reload(); },
            errorTitle: t('saveError'),
        }
    );

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
                            <CommandEmpty>{t('noDoctors')}</CommandEmpty>
                            <CommandGroup>
                                {doctors.map((doctor) => (
                                    <CommandItem
                                        key={doctor.id}
                                        value={doctor.name}
                                        onSelect={() => toggleDoctor(doctor.id)}
                                    >
                                        <Check className={cn('mr-2 h-4 w-4', selectedIds.includes(doctor.id) ? 'opacity-100' : 'opacity-0')} />
                                        {doctor.name}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>

            {selectedDoctors.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                    {selectedDoctors.map((doctor) => (
                        <Badge key={doctor.id} variant="secondary" className="gap-1 py-1 pl-2 pr-1">
                            <Stethoscope className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs">{doctor.name}</span>
                            {canManage && (
                                <button
                                    type="button"
                                    disabled={save.isPending}
                                    onClick={() => toggleDoctor(doctor.id)}
                                    className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                                    aria-label={doctor.name}
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
                    <Button onClick={() => save.run(selectedIds)} disabled={!isDirty} loading={save.isPending}>
                        {t('save')}
                    </Button>
                </div>
            )}
        </div>
    );
}
