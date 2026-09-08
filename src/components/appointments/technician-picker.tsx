'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { cn } from '@/lib/utils';
import { fetchTechnicians, type TechnicianOption } from '@/services/technicians';

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
}

const NONE = '__none__';

export function TechnicianPicker({ value, onChange, disabled = false, compact = false }: TechnicianPickerProps) {
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
