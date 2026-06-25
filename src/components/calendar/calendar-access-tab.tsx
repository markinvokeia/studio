'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, Loader2, Stethoscope, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { API_ROUTES } from '@/constants/routes';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';
import type { User as UserType } from '@/lib/types';

interface CalendarAccessTabProps {
    calendarId: string;
    canManage: boolean;
}

async function getDoctors(): Promise<UserType[]> {
    try {
        const data = await api.get(API_ROUTES.USERS, { filter_type: 'DOCTOR' });
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
    } catch (error) {
        console.error('Failed to fetch doctors:', error);
        return [];
    }
}

async function getCalendarUserIds(calendarId: string): Promise<string[]> {
    try {
        const data = await api.get(API_ROUTES.CALENDAR_USERS_SEARCH, { calendar_source_id: calendarId });
        const raw = Array.isArray(data) ? data : (data?.calendar_users || data?.data || []);
        return raw.map((item: any) => String(item.user_id ?? item.id)).filter(Boolean);
    } catch (error) {
        console.error('Failed to fetch calendar users:', error);
        return [];
    }
}

export function CalendarAccessTab({ calendarId, canManage }: CalendarAccessTabProps) {
    const t = useTranslations('CalendarsPage.access');
    const { toast } = useToast();

    const [doctors, setDoctors] = React.useState<UserType[]>([]);
    const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
    const [initialIds, setInitialIds] = React.useState<string[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isSaving, setIsSaving] = React.useState(false);
    const [isPopoverOpen, setPopoverOpen] = React.useState(false);

    React.useEffect(() => {
        let cancelled = false;
        setIsLoading(true);
        Promise.all([getDoctors(), getCalendarUserIds(calendarId)])
            .then(([doctorList, userIds]) => {
                if (cancelled) return;
                setDoctors(doctorList);
                setSelectedIds(userIds);
                setInitialIds(userIds);
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });
        return () => { cancelled = true; };
    }, [calendarId]);

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

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const responseData = await api.post(API_ROUTES.CALENDAR_USERS_UPSERT, {
                calendar_source_id: Number(calendarId),
                user_ids: selectedIds,
            });
            const error = Array.isArray(responseData)
                ? responseData.find((item: any) => item?.error)
                : (responseData as any)?.error;
            if (error) throw new Error(typeof error === 'string' ? error : t('saveError'));
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
                    <Button onClick={handleSave} disabled={isSaving || !isDirty}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {t('save')}
                    </Button>
                </div>
            )}
        </div>
    );
}
