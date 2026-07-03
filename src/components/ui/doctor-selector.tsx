'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { API_ROUTES } from '@/constants/routes';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';
import { ensureDoctorOption, type DoctorOption } from '@/services/doctors';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';

interface DoctorSelectorProps {
    value?: string;
    selectedDoctorName?: string;
    onValueChange: (doctorId: string, doctor?: DoctorOption) => void;
    placeholder?: string;
    triggerText?: string;
    emptyText?: string;
    loadingText?: string;
    className?: string;
    disabled?: boolean;
}

export function DoctorSelector({
    value,
    selectedDoctorName,
    onValueChange,
    placeholder = 'Buscar doctor...',
    triggerText = 'Seleccionar',
    emptyText = 'No hay resultados.',
    loadingText = 'Buscando...',
    className,
    disabled = false,
}: DoctorSelectorProps) {
    const [open, setOpen] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [doctors, setDoctors] = React.useState<DoctorOption[]>([]);
    const [selectedDoctorCache, setSelectedDoctorCache] = React.useState<DoctorOption | null>(null);
    const [isLoading, setIsLoading] = React.useState(false);

    React.useEffect(() => {
        const handler = setTimeout(async () => {
            setIsLoading(true);
            try {
                const params: Record<string, string> = {};
                if (searchQuery.trim()) params.search = searchQuery.trim();
                const data = await api.get(API_ROUTES.USERS_DOCTORS, params);
                const raw = Array.isArray(data) ? data : (data?.doctors || data?.data || data?.result || []);
                let nextDoctors: DoctorOption[] = raw.map((doc: any) => ({
                    id: String(doc.id),
                    name: doc.name ?? doc.nombre ?? '',
                }));
                nextDoctors = await ensureDoctorOption(nextDoctors, value, selectedDoctorName);
                setDoctors(nextDoctors);
            } catch {
                setDoctors([]);
            } finally {
                setIsLoading(false);
            }
        }, 300);
        return () => clearTimeout(handler);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchQuery]);

    const selectedDoctor = React.useMemo(() => {
        const fromResults = doctors.find((d) => d.id === value);
        if (fromResults) return fromResults;
        if (selectedDoctorCache?.id === value) return selectedDoctorCache;
        if (value && selectedDoctorName) return { id: value, name: selectedDoctorName };
        return undefined;
    }, [doctors, selectedDoctorCache, value, selectedDoctorName]);

    React.useEffect(() => {
        const fromResults = doctors.find((d) => d.id === value);
        if (fromResults) setSelectedDoctorCache(fromResults);
        else if (!value) setSelectedDoctorCache(null);
    }, [doctors, value]);

    const handleSelect = (doctor: DoctorOption) => {
        setSelectedDoctorCache(doctor);
        onValueChange(doctor.id, doctor);
        setOpen(false);
        setSearchQuery('');
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    className={cn('w-full justify-between', !value && 'text-muted-foreground', className)}
                    disabled={disabled}
                >
                    {value && selectedDoctor
                        ? <span className="truncate block">{selectedDoctor.name}</span>
                        : triggerText}
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
                        ) : doctors.length > 0 ? (
                            <CommandGroup>
                                {doctors.map((doctor) => (
                                    <CommandItem key={doctor.id} value={doctor.name} onSelect={() => handleSelect(doctor)}>
                                        <Check className={cn('mr-2 h-4 w-4', value === doctor.id ? 'opacity-100' : 'opacity-0')} />
                                        <span className="truncate">{doctor.name}</span>
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

export default DoctorSelector;
