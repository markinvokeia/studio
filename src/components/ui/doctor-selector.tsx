'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { API_ROUTES } from '@/constants/routes';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';
import { ensureDoctorOption, normalizeDoctorOptions, type DoctorOption } from '@/services/doctors';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';

interface DoctorSelectorSingleProps {
    multiple?: false;
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

interface DoctorSelectorMultipleProps {
    multiple: true;
    values?: string[];
    selectedDoctors?: DoctorOption[];
    onValuesChange: (doctorIds: string[], doctors: DoctorOption[]) => void;
    placeholder?: string;
    triggerText?: string;
    emptyText?: string;
    loadingText?: string;
    className?: string;
    disabled?: boolean;
}

type DoctorSelectorProps = DoctorSelectorSingleProps | DoctorSelectorMultipleProps;

export function DoctorSelector(props: DoctorSelectorProps) {
    const {
        placeholder = 'Buscar doctor...',
        triggerText = 'Seleccionar',
        emptyText = 'No hay resultados.',
        loadingText = 'Buscando...',
        className,
        disabled = false,
    } = props;

    const value = props.multiple ? undefined : props.value;
    const selectedDoctorName = props.multiple ? undefined : props.selectedDoctorName;
    const values = props.multiple ? (props.values ?? []) : [];

    const [open, setOpen] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [doctors, setDoctors] = React.useState<DoctorOption[]>([]);
    const [selectedDoctorCache, setSelectedDoctorCache] = React.useState<DoctorOption | null>(null);
    const [isLoading, setIsLoading] = React.useState(false);

    React.useEffect(() => {
        if (props.multiple || !value) return;
        let active = true;
        ensureDoctorOption([], value, selectedDoctorName).then(([doctor]) => {
            if (active && doctor) setSelectedDoctorCache(doctor);
        });
        return () => { active = false; };
    }, [props.multiple, selectedDoctorName, value]);

    React.useEffect(() => {
        const handler = setTimeout(async () => {
            setIsLoading(true);
            try {
                const params: Record<string, string> = {};
                if (searchQuery.trim()) params.search = searchQuery.trim();
                const data = await api.get(API_ROUTES.USERS_DOCTORS, params);
                let nextDoctors = normalizeDoctorOptions(data);
                if (props.multiple) {
                    for (const doctor of props.selectedDoctors ?? []) {
                        nextDoctors = await ensureDoctorOption(nextDoctors, doctor.id, doctor.name);
                    }
                } else {
                    nextDoctors = await ensureDoctorOption(nextDoctors, value, selectedDoctorName);
                }
                setDoctors(nextDoctors);
            } catch {
                setDoctors([]);
            } finally {
                setIsLoading(false);
            }
        }, 300);
        return () => clearTimeout(handler);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchQuery, value, selectedDoctorName]);

    const selectedDoctor = React.useMemo(() => {
        const fromResults = doctors.find((d) => d.id === value);
        if (fromResults) return fromResults;
        if (selectedDoctorCache?.id === value) return selectedDoctorCache;
        if (value && selectedDoctorName) return { id: value, name: selectedDoctorName };
        return undefined;
    }, [doctors, selectedDoctorCache, value, selectedDoctorName]);

    React.useEffect(() => {
        if (props.multiple) return;
        const fromResults = doctors.find((d) => d.id === value);
        if (fromResults) setSelectedDoctorCache(fromResults);
        else if (!value) setSelectedDoctorCache(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [doctors, value]);

    const selectedDoctorsMap = React.useMemo(() => {
        const map = new Map<string, DoctorOption>();
        if (props.multiple) {
            for (const doctor of props.selectedDoctors ?? []) map.set(doctor.id, doctor);
        }
        for (const doctor of doctors) map.set(doctor.id, doctor);
        return map;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [doctors, props.multiple ? props.selectedDoctors : null]);

    const handleSelect = (doctor: DoctorOption) => {
        if (props.multiple) {
            const isSelected = values.includes(doctor.id);
            const nextIds = isSelected ? values.filter((id) => id !== doctor.id) : [...values, doctor.id];
            const nextDoctors = nextIds.map((id) => selectedDoctorsMap.get(id)).filter((d): d is DoctorOption => Boolean(d));
            props.onValuesChange(nextIds, nextDoctors);
            return;
        }
        setSelectedDoctorCache(doctor);
        props.onValueChange(doctor.id, doctor);
        setOpen(false);
        setSearchQuery('');
    };

    const triggerLabel = props.multiple
        ? values.length === 0
            ? triggerText
            : values.length === 1
                ? (selectedDoctorsMap.get(values[0])?.name ?? triggerText)
                : `${values.length} doctores seleccionados`
        : value && selectedDoctor
            ? selectedDoctor.name
            : triggerText;

    const hasSelection = props.multiple ? values.length > 0 : Boolean(value);

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
                        ) : doctors.length > 0 ? (
                            <CommandGroup>
                                {doctors.map((doctor) => {
                                    const isChecked = props.multiple ? values.includes(doctor.id) : value === doctor.id;
                                    return (
                                        <CommandItem key={doctor.id} value={doctor.name} onSelect={() => handleSelect(doctor)}>
                                            <Check className={cn('mr-2 h-4 w-4', isChecked ? 'opacity-100' : 'opacity-0')} />
                                            <span className="truncate">{doctor.name}</span>
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

export default DoctorSelector;
