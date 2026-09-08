'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { cn } from '@/lib/utils';
import { fetchAppointmentTechnicians, fetchTechnicians, type TechnicianOption } from '@/services/technicians';

/**
 * Quién ejecuta la cita.
 *
 * No es el doctor de la cita: `assignee_id` es el odontólogo derivador, y es lo
 * que hace que la cita aparezca en su agenda. Este selector escribe
 * `technician_id`, que es quien la va a ver en su panel de Tareas.
 *
 * La lista sale de los usuarios con rol `operador`. Se carga una vez al montar:
 * es un puñado de personas y no cambia entre citas.
 */

export interface TechnicianPickerProps {
    value?: string | null;
    onChange: (technicianId: string | null) => void;
    disabled?: boolean;
    /**
     * Modo compacto para la tarjeta inline del calendario: sin etiqueta y con el
     * mismo alto y tipografía que los demás selectores de esa tarjeta, donde
     * ningún campo lleva label.
     */
    compact?: boolean;
    /**
     * Cita que se está editando. Al abrirla se consulta qué técnico tiene
     * asignado y se muestra seleccionado: ese dato no viaja con los datos de la
     * cita, porque Get_Appointments es el monolito compartido de la agenda.
     *
     * Mismo mecanismo que `StudyOrderPicker`, por el mismo motivo.
     */
    appointmentId?: string | null;
}

const NONE = '__none__';

export function TechnicianPicker({ value, onChange, disabled = false, compact = false, appointmentId }: TechnicianPickerProps) {
    const t = useTranslations('AppointmentsPage.technician');

    const [technicians, setTechnicians] = React.useState<TechnicianOption[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        let cancelled = false;
        void fetchTechnicians().then((fetched) => {
            if (cancelled) return;
            setTechnicians(fetched);
            setIsLoading(false);
        });
        return () => { cancelled = true; };
    }, []);

    // El callback va por ref para no re-disparar la consulta cada vez que el
    // padre recrea la función.
    const onChangeRef = React.useRef(onChange);
    React.useEffect(() => { onChangeRef.current = onChange; });

    // Al abrir una cita existente se busca su técnico y se muestra seleccionado.
    // Se hace una sola vez por cita: si el usuario después elige otro, no hay que
    // pisárselo con el que estaba guardado.
    const resolvedForRef = React.useRef<string | null>(null);
    React.useEffect(() => {
        if (!appointmentId || resolvedForRef.current === appointmentId) return;
        resolvedForRef.current = appointmentId;
        void fetchAppointmentTechnicians([appointmentId]).then((map) => {
            const current = map.get(appointmentId);
            if (current) onChangeRef.current(current.id);
        });
    }, [appointmentId]);

    // Sin operadores cargados el campo no aporta nada y sólo ocupa lugar: la
    // clínica que no usa técnicos no tiene por qué verlo.
    if (!isLoading && technicians.length === 0) return null;

    const select = (
        <Select
            value={value ?? NONE}
            onValueChange={(next) => onChange(next === NONE ? null : next)}
            disabled={disabled || isLoading}
        >
            <SelectTrigger
                className={cn(
                    compact && 'h-7 px-2 text-xs font-normal [&>span]:truncate [&>span]:text-muted-foreground',
                )}
            >
                <SelectValue placeholder={t('placeholder')} />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value={NONE}>{t('unassigned')}</SelectItem>
                {technicians.map((technician) => (
                    <SelectItem key={technician.id} value={technician.id}>
                        {technician.name}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );

    if (compact) return select;

    return (
        <div className="space-y-2">
            <Label className="flex items-center gap-2">
                {t('label')}
                {isLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            </Label>
            {select}
        </div>
    );
}

export default TechnicianPicker;
