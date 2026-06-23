'use client';

import React from 'react';
import { Check, ChevronsUpDown, Loader2, UserCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import {
    Dialog,
    DialogBody,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { User } from '@/lib/types';

interface BulkReassignDoctorDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    doctors: User[];
    selectedCount: number;
    onReassign: (doctorId: string, doctorName: string, doctorEmail?: string) => void | Promise<void>;
    isLoading?: boolean;
}

export function BulkReassignDoctorDialog({
    open,
    onOpenChange,
    doctors,
    selectedCount,
    onReassign,
    isLoading = false,
}: BulkReassignDoctorDialogProps) {
    const t = useTranslations('AppointmentsPage.bulk');
    const [doctorPopoverOpen, setDoctorPopoverOpen] = React.useState(false);
    const [selectedDoctorId, setSelectedDoctorId] = React.useState<string>('');

    const selectedDoctor = doctors.find((d) => d.id === selectedDoctorId);

    const handleConfirm = async () => {
        if (!selectedDoctor) return;
        await onReassign(selectedDoctor.id, selectedDoctor.name, selectedDoctor.email);
    };

    React.useEffect(() => {
        if (!open) setSelectedDoctorId('');
    }, [open]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <UserCheck className="h-5 w-5 text-primary" />
                        {t('reassignTitle', { count: selectedCount })}
                    </DialogTitle>
                </DialogHeader>
                <DialogBody className="px-6 py-4">
                    <p className="text-sm text-muted-foreground mb-4">
                        {t('reassignDescription', { count: selectedCount })}
                    </p>
                    <Popover open={doctorPopoverOpen} onOpenChange={setDoctorPopoverOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={doctorPopoverOpen}
                                className="w-full justify-between"
                            >
                                {selectedDoctor ? selectedDoctor.name : t('selectDoctor')}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                            <Command>
                                <CommandInput placeholder={t('searchDoctor')} />
                                <CommandList>
                                    <CommandEmpty>{t('noDoctor')}</CommandEmpty>
                                    <CommandGroup>
                                        {doctors.map((doctor) => (
                                            <CommandItem
                                                key={doctor.id}
                                                value={doctor.name}
                                                onSelect={() => {
                                                    setSelectedDoctorId(doctor.id);
                                                    setDoctorPopoverOpen(false);
                                                }}
                                            >
                                                <Check
                                                    className={cn(
                                                        'mr-2 h-4 w-4',
                                                        selectedDoctorId === doctor.id ? 'opacity-100' : 'opacity-0',
                                                    )}
                                                />
                                                {doctor.name}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                </DialogBody>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                        {t('cancel')}
                    </Button>
                    <Button onClick={handleConfirm} disabled={!selectedDoctorId || isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {t('confirmReassign')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
