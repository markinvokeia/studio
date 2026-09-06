'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogCancelButton,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { useToast } from '@/hooks/use-toast';
import { formatDateTime, toLocalISOString } from '@/lib/utils';
import type { StudyOrder, StudyOrderAppointment } from '@/lib/types';
import { rescheduleStudyOrderAppointment } from '@/services/study-orders';

/**
 * Mueve una cita de la orden a otra fecha y hora.
 *
 * Conserva la duración original: el operario elige cuándo, no cuánto. Si la
 * orden tiene varias citas, primero se elige cuál mover.
 */

export interface StudyOrderRescheduleDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    order: StudyOrder | null;
    onDone?: () => void;
}

/** Sólo se pueden mover las citas que todavía no pasaron ni se cancelaron. */
function isMovable(appointment: StudyOrderAppointment): boolean {
    return !['completed', 'cancelled', 'deleted', 'no_show'].includes(appointment.status);
}

export function StudyOrderRescheduleDialog({
    open,
    onOpenChange,
    order,
    onDone,
}: StudyOrderRescheduleDialogProps) {
    const t = useTranslations('StudyOrdersPage');
    const { toast } = useToast();

    const movable = React.useMemo(
        () => (order?.appointments ?? []).filter(isMovable),
        [order],
    );

    const [appointmentId, setAppointmentId] = React.useState('');
    const [date, setDate] = React.useState('');
    const [time, setTime] = React.useState('');
    const [isSaving, setIsSaving] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    // Al abrir se precarga la primera cita movible con su fecha y hora actuales,
    // que es el caso habitual: una orden, una cita.
    React.useEffect(() => {
        if (!open) return;
        const first = movable[0];
        setError(null);
        setIsSaving(false);
        if (!first) {
            setAppointmentId(''); setDate(''); setTime('');
            return;
        }
        setAppointmentId(first.id);
        // `start_datetime` viene sin zona: se corta en seco para no correr el día.
        const [d, rest] = first.start_datetime.replace('Z', '').split('T');
        setDate(d ?? '');
        setTime((rest ?? '').slice(0, 5));
    }, [open, movable]);

    const selected = movable.find((a) => a.id === appointmentId);

    const handleConfirm = React.useCallback(async () => {
        if (!order || !selected || !date || !time) return;
        setError(null);
        setIsSaving(true);
        try {
            // La duración se mantiene: se mide la original y se traslada.
            const originalStart = new Date(selected.start_datetime.replace('Z', ''));
            const originalEnd = new Date(selected.end_datetime.replace('Z', ''));
            const durationMs = Math.max(originalEnd.getTime() - originalStart.getTime(), 60_000);

            const newStart = new Date(`${date}T${time}:00`);
            const newEnd = new Date(newStart.getTime() + durationMs);

            await rescheduleStudyOrderAppointment({
                orderId: order.id,
                appointmentId: selected.id,
                start: toLocalISOString(newStart),
                end: toLocalISOString(newEnd),
            });

            toast({ title: t('rescheduleDialog.success') });
            onDone?.();
            onOpenChange(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : t('toast.genericError'));
        } finally {
            setIsSaving(false);
        }
    }, [order, selected, date, time, toast, t, onDone, onOpenChange]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{t('rescheduleDialog.title')}</DialogTitle>
                    <DialogDescription>{t('rescheduleDialog.description')}</DialogDescription>
                </DialogHeader>

                {movable.length === 0 ? (
                    <p className="py-4 text-sm text-muted-foreground">
                        {t('rescheduleDialog.noAppointments')}
                    </p>
                ) : (
                    <div className="space-y-4">
                        {movable.length > 1 && (
                            <div className="space-y-1.5">
                                <Label>{t('tabs.appointments')}</Label>
                                <Select value={appointmentId} onValueChange={setAppointmentId}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {movable.map((a) => (
                                            <SelectItem key={a.id} value={a.id}>
                                                {formatDateTime(a.start_datetime)}
                                                {a.sede_name ? ` · ${a.sede_name}` : ''}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="resched-date">{t('rescheduleDialog.date')}</Label>
                                <Input
                                    id="resched-date"
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="resched-time">{t('rescheduleDialog.time')}</Label>
                                <Input
                                    id="resched-time"
                                    type="time"
                                    value={time}
                                    onChange={(e) => setTime(e.target.value)}
                                />
                            </div>
                        </div>

                        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
                    </div>
                )}

                <DialogFooter>
                    <DialogCancelButton />
                    <Button
                        onClick={() => void handleConfirm()}
                        disabled={isSaving || !selected || !date || !time}
                    >
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {t('rescheduleDialog.confirm')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default StudyOrderRescheduleDialog;
