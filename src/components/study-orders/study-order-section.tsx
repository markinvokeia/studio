'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { ToothGridPicker } from './tooth-grid-picker';

import { cn } from '@/lib/utils';
import type { StudyOrderCatalogService, StudyOrderOption, StudyOrderSection as Section } from '@/lib/types';

/**
 * Una sección del formulario de orden — el equivalente a cada banda de color de
 * la orden impresa ("RADIOGRAFÍAS INTRABUCALES", "TOMOGRAFÍA CONE BEAM"...).
 *
 * Renderiza, en este orden:
 *   1. el odontograma de la sección, si la tiene;
 *   2. los servicios como checkboxes, con sus modificadores indentados debajo
 *      — igual que en el papel, donde las sub-opciones cuelgan del ítem padre;
 *   3. los modificadores de alcance sección (la indicación clínica del Cone Beam).
 *
 * Todo lo que muestra viene de la base (`study_order_options` + `service_catalog`):
 * agregar una opción al formulario es una fila sembrada, no un release del front.
 */

export interface StudyOrderSectionProps {
    section: Section;
    /** Modificadores atados a un servicio de esta sección. */
    serviceModifiers: StudyOrderOption[];
    /** Modificadores de alcance sección. */
    sectionModifiers: StudyOrderOption[];
    /** Odontograma de la sección, si la sección lo tiene. */
    regionGroup?: StudyOrderOption;
    /** Campos de texto libre que pertenecen a esta sección. */
    textOptions?: StudyOrderOption[];
    /** Valores de esos campos, indexados por `code`. */
    textValues?: Record<string, string>;
    onTextChange?: (code: string, value: string) => void;

    selectedServiceIds: string[];
    onToggleService: (service: StudyOrderCatalogService) => void;

    /** `{ [serviceId]: { [groupCode]: string[] } }` */
    itemModifiers: Record<string, Record<string, string[]>>;
    onToggleItemModifier: (serviceId: string, groupCode: string, code: string) => void;

    /** `{ [groupCode]: string[] }` para esta sección. */
    sectionModifierValues: Record<string, string[]>;
    onToggleSectionModifier: (groupCode: string, code: string) => void;

    teeth: string[];
    onTeethChange: (teeth: string[]) => void;

    /** Notas por línea, indexadas por `serviceId`. */
    itemNotes: Record<string, string>;
    onItemNoteChange: (serviceId: string, note: string) => void;

    disabled?: boolean;
    defaultOpen?: boolean;
    /** Oculta la cabecera colapsable: dentro del asistente cada sección ocupa
     *  su propio paso y el título ya está en la barra de pasos. */
    hideHeader?: boolean;
}

/** Agrupa por `group_code`; las opciones sueltas caen en el grupo `''`. */
function groupBy(options: StudyOrderOption[]): Array<[string, StudyOrderOption[]]> {
    const map = new Map<string, StudyOrderOption[]>();
    for (const option of options) {
        const key = option.group_code ?? '';
        const bucket = map.get(key);
        if (bucket) bucket.push(option);
        else map.set(key, [option]);
    }
    return Array.from(map.entries());
}

export function StudyOrderSection({
    section,
    serviceModifiers,
    sectionModifiers,
    regionGroup,
    textOptions = [],
    textValues = {},
    onTextChange,
    selectedServiceIds,
    onToggleService,
    itemModifiers,
    onToggleItemModifier,
    sectionModifierValues,
    onToggleSectionModifier,
    teeth,
    onTeethChange,
    itemNotes,
    onItemNoteChange,
    disabled = false,
    defaultOpen = false,
    hideHeader = false,
}: StudyOrderSectionProps) {
    const selected = React.useMemo(() => new Set(selectedServiceIds), [selectedServiceIds]);
    const selectedCount = React.useMemo(
        () => section.services.filter((s) => selected.has(s.id)).length,
        [section.services, selected],
    );

    // La sección arranca abierta si ya tiene algo elegido: al reabrir un
    // borrador el doctor ve de una lo que había pedido.
    const [isOpen, setIsOpen] = React.useState(defaultOpen || selectedCount > 0);
    const expanded = hideHeader || isOpen;

    const modifiersByService = React.useMemo(() => {
        const map = new Map<string, StudyOrderOption[]>();
        for (const option of serviceModifiers) {
            if (!option.service_id) continue;
            const bucket = map.get(option.service_id);
            if (bucket) bucket.push(option);
            else map.set(option.service_id, [option]);
        }
        return map;
    }, [serviceModifiers]);

    return (
        <div className={cn(hideHeader ? '' : 'rounded-lg border bg-card')} data-testid={`section-${section.code}`}>
            {!hideHeader && <button
                type="button"
                onClick={() => setIsOpen((v) => !v)}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-3 rounded-t-lg px-4 py-3 text-left transition-colors hover:bg-accent/50"
            >
                <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: section.color || 'hsl(var(--muted-foreground))' }}
                    aria-hidden="true"
                />
                <span className="flex-1 text-sm font-semibold">{section.name}</span>
                {selectedCount > 0 && (
                    <Badge variant="secondary" className="tabular-nums">{selectedCount}</Badge>
                )}
                <ChevronDown
                    className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', isOpen && 'rotate-180')}
                    aria-hidden="true"
                />
            </button>}

            {expanded && (
                <div className={cn('space-y-6', hideHeader ? '' : 'border-t px-4 py-4')}>
                    {regionGroup && (
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">{regionGroup.label}</Label>
                            <ToothGridPicker
                                value={teeth}
                                onChange={onTeethChange}
                                disabled={disabled}
                                testIdPrefix={`tooth-${section.code.toLowerCase()}`}
                            />
                        </div>
                    )}

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {section.services.map((service) => {
                            const isChecked = selected.has(service.id);
                            const mods = modifiersByService.get(service.id) ?? [];
                            return (
                                <div
                                    key={service.id}
                                    className={cn(
                                        'rounded-lg border p-4 transition-colors',
                                        isChecked ? 'border-primary/40 bg-primary/5' : 'border-transparent',
                                        mods.length > 0 && isChecked && 'sm:col-span-2 xl:col-span-3',
                                    )}
                                >
                                    <div className="flex items-start gap-3">
                                        <Checkbox
                                            id={`svc-${service.id}`}
                                            checked={isChecked}
                                            disabled={disabled}
                                            onCheckedChange={() => onToggleService(service)}
                                            className="mt-0.5"
                                        />
                                        <div className="min-w-0 flex-1">
                                            <Label
                                                htmlFor={`svc-${service.id}`}
                                                className="cursor-pointer text-[15px] font-medium leading-snug"
                                            >
                                                {service.name}
                                            </Label>
                                            {service.duration_minutes ? (
                                                <p className="mt-1 text-sm text-muted-foreground">
                                                    {service.duration_minutes} min
                                                </p>
                                            ) : null}
                                        </div>
                                    </div>

                                    {isChecked && mods.length > 0 && (
                                        <div className="ml-8 mt-3 space-y-2.5 border-l pl-4">
                                            {groupBy(mods).map(([groupCode, options]) => (
                                                <div key={groupCode || 'none'} className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                                    {options.map((option) => (
                                                        <div key={option.id} className="flex items-center gap-2">
                                                            <Checkbox
                                                                id={`mod-${service.id}-${option.code}`}
                                                                checked={(itemModifiers[service.id]?.[groupCode] ?? []).includes(option.code)}
                                                                disabled={disabled}
                                                                onCheckedChange={() =>
                                                                    onToggleItemModifier(service.id, groupCode, option.code)
                                                                }
                                                            />
                                                            <Label
                                                                htmlFor={`mod-${service.id}-${option.code}`}
                                                                className="cursor-pointer text-sm font-normal text-muted-foreground"
                                                            >
                                                                {option.label}
                                                            </Label>
                                                        </div>
                                                    ))}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {isChecked && (
                                        <div className="ml-8 mt-2.5">
                                            <Input
                                                value={itemNotes[service.id] ?? ''}
                                                onChange={(e) => onItemNoteChange(service.id, e.target.value)}
                                                disabled={disabled}
                                                placeholder="Indicación (opcional)"
                                                className="h-9 text-sm"
                                            />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {textOptions.length > 0 && (
                        <div className="grid gap-3 border-t pt-3 sm:grid-cols-2 xl:grid-cols-3">
                            {textOptions.map((option) => (
                                <div key={option.id} className="space-y-1.5">
                                    <Label htmlFor={`text-${option.code}`} className="text-sm font-medium">
                                        {option.label}
                                    </Label>
                                    {option.input_type === 'textarea' ? (
                                        <Textarea
                                            id={`text-${option.code}`}
                                            rows={2}
                                            disabled={disabled}
                                            value={textValues[option.code] ?? ''}
                                            onChange={(e) => onTextChange?.(option.code, e.target.value)}
                                        />
                                    ) : (
                                        <Input
                                            id={`text-${option.code}`}
                                            type={option.input_type === 'date' ? 'date' : 'text'}
                                            disabled={disabled}
                                            className="h-9 text-sm"
                                            value={textValues[option.code] ?? ''}
                                            onChange={(e) => onTextChange?.(option.code, e.target.value)}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {sectionModifiers.length > 0 && (
                        <div className="space-y-2 border-t pt-3">
                            {groupBy(sectionModifiers).map(([groupCode, options]) => (
                                <div key={groupCode || 'none'} className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                    {options.map((option) => (
                                        <div key={option.id} className="flex items-center gap-2">
                                            <Checkbox
                                                id={`secmod-${section.code}-${option.code}`}
                                                checked={(sectionModifierValues[groupCode] ?? []).includes(option.code)}
                                                disabled={disabled}
                                                onCheckedChange={() => onToggleSectionModifier(groupCode, option.code)}
                                            />
                                            <Label
                                                htmlFor={`secmod-${section.code}-${option.code}`}
                                                className="cursor-pointer text-sm font-normal text-muted-foreground"
                                            >
                                                {option.label}
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default StudyOrderSection;
