'use client';

import * as React from 'react';
import { Calendar as CalendarIcon, Check, ChevronsUpDown, Loader2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { API_ROUTES } from '@/constants/routes';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';
import type { Calendar as CalendarType } from '@/lib/types';

interface DoctorCalendarsTabProps {
    userId: string;
    canManage: boolean;
}

async function getCalendars(): Promise<CalendarType[]> {
    try {
        const data = await api.get(API_ROUTES.CALENDARS);
        const raw = Array.isArray(data) ? data : (data?.calendars || data?.data || data?.result || []);
        return raw
            .filter((c: any) => c.is_active !== false)
            .map((c: any) => ({
                id: String(c.id),
                name: c.name,
                color: c.color,
                is_active: c.is_active,
            } as CalendarType));
    } catch (error) {
        console.error('Failed to fetch calendars:', error);
        return [];
    }
}

async function getDoctorCalendarIds(userId: string): Promise<string[]> {
    try {
        const data = await api.get(API_ROUTES.CALENDAR_USERS_SEARCH, { user_id: userId });
        const raw = Array.isArray(data) ? data : (data?.calendar_users || data?.data || []);
        return raw.map((item: any) => String(item.calendar_source_id)).filter(Boolean);
    } catch (error) {
        console.error('Failed to fetch doctor calendars:', error);
        return [];
    }
}

async function getCalendarUserIds(calendarId: string): Promise<string[]> {
    const data = await api.get(API_ROUTES.CALENDAR_USERS_SEARCH, { calendar_source_id: calendarId });
    const raw = Array.isArray(data) ? data : (data?.calendar_users || data?.data || []);
    return raw.map((item: any) => String(item.user_id)).filter(Boolean);
}

export function DoctorCalendarsTab({ userId, canManage }: DoctorCalendarsTabProps) {
    const t = useTranslations('DoctorsPage.calendarAccess');
    const { toast } = useToast();

    const [calendars, setCalendars] = React.useState<CalendarType[]>([]);
    const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
    const [initialIds, setInitialIds] = React.useState<string[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isSaving, setIsSaving] = React.useState(false);
    const [isPopoverOpen, setPopoverOpen] = React.useState(false);

    React.useEffect(() => {
        let cancelled = false;
        setIsLoading(true);
        Promise.all([getCalendars(), getDoctorCalendarIds(userId)])
            .then(([calendarList, calendarIds]) => {
                if (cancelled) return;
                setCalendars(calendarList);
                setSelectedIds(calendarIds);
                setInitialIds(calendarIds);
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });
        return () => { cancelled = true; };
    }, [userId]);

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
    const handleSave = async () => {
        setIsSaving(true);
        try {
            const initialSet = new Set(initialIds);
            const selectedSet = new Set(selectedIds);
            const changed = [
                ...selectedIds.filter((id) => !initialSet.has(id)),
                ...initialIds.filter((id) => !selectedSet.has(id)),
            ];

            for (const calendarId of changed) {
                const currentUsers = await getCalendarUserIds(calendarId);
                const nextUsers = selectedSet.has(calendarId)
                    ? Array.from(new Set([...currentUsers, userId]))
                    : currentUsers.filter((id) => id !== userId);

                const responseData = await api.post(API_ROUTES.CALENDAR_USERS_UPSERT, {
                    calendar_source_id: Number(calendarId),
                    user_ids: nextUsers,
                });
                const error = Array.isArray(responseData)
                    ? responseData.find((item: any) => item?.error)
                    : (responseData as any)?.error;
                if (error) throw new Error(typeof error === 'string' ? error : t('saveError'));
            }

            setInitialIds(selectedIds);
            toast({ title: t('saved') });
        } catch (error) {
            toast({ variant: 'destructive', title: t('saveError'), description: error instanceof Error ? error.message : undefined });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
            </div>
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
                    <Button onClick={handleSave} disabled={isSaving || !isDirty}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {t('save')}
                    </Button>
                </div>
            )}
        </div>
    );
}
