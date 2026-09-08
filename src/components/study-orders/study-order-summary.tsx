'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';

import { ToothGridPicker } from './tooth-grid-picker';

import type { StudyOrderFormOptions } from '@/lib/types';

/**
 * El resumen de una orden: paciente, secciones con sus estudios, piezas y notas.
 *
 * Vive aparte porque lo dibujan dos pantallas que tienen que verse igual: el
 * último paso del asistente, donde el derivador confirma lo que va a mandar, y
 * la pestaña "Orden" del detalle, donde después se lee lo que se mandó. Si cada
 * una lo maquetara por su cuenta, revisar antes de enviar y leer después
 * mostrarían cosas distintas, que es exactamente lo que no puede pasar en un
 * documento clínico.
 *
 * Recibe todo ya resuelto —códigos convertidos a etiquetas, secciones con su
 * nombre y color— porque las dos fuentes son distintas: el asistente trabaja
 * sobre la selección en curso y el detalle sobre la orden guardada. La
 * normalización la hace cada llamador con los helpers de abajo.
 */

export interface StudyOrderSummaryItem {
    id: string;
    name: string;
    /** Modificadores ya traducidos a etiquetas legibles. */
    modifiers: string[];
    notes?: string | null;
    /** Sólo el detalle los conoce: el asistente todavía no agendó nada. */
    isCancelled?: boolean;
    isScheduled?: boolean;
    isCompleted?: boolean;
}

export interface StudyOrderSummarySection {
    code: string;
    name: string;
    color?: string | null;
    items: StudyOrderSummaryItem[];
    teeth: string[];
}

export interface StudyOrderSummaryProps {
    patientName?: string | null;
    patientDocument?: string | null;
    patientPhone?: string | null;
    patientEmail?: string | null;
    /** Formas de entrega, ya traducidas. */
    deliveryLabels: string[];
    sections: StudyOrderSummarySection[];
    /** Campos libres del formulario, ya con su etiqueta. */
    texts?: Array<{ label: string; value: string }>;
    clinicalNotes?: string | null;
    /** Cabecera extra que el detalle mete arriba (doctor, sede sugerida). */
    header?: React.ReactNode;
}

export function StudyOrderSummary({
    patientName, patientDocument, patientPhone, patientEmail,
    deliveryLabels, sections, texts = [], clinicalNotes, header,
}: StudyOrderSummaryProps) {
    const t = useTranslations('StudyOrdersPage');

    const contact = [patientDocument, patientPhone, patientEmail].filter(Boolean).join(' · ');
    const withContent = sections.filter((s) => s.items.length > 0 || s.teeth.length > 0);

    return (
        <div className="space-y-5">
            <div className="rounded-lg border p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t('form.patientSection')}
                </p>
                <p className="mt-1 font-medium">{patientName || '—'}</p>
                <p className="text-sm text-muted-foreground">{contact || '—'}</p>

                {deliveryLabels.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                        {deliveryLabels.map((label) => (
                            <Badge key={label} variant="outline">{label}</Badge>
                        ))}
                    </div>
                )}

                {header}
            </div>

            {withContent.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                    {t('form.noServicesSelected')}
                </p>
            ) : (
                withContent.map((section) => (
                    <div key={section.code} className="rounded-lg border p-4">
                        <div className="flex items-center gap-2">
                            <span
                                className="h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: section.color || 'hsl(var(--muted-foreground))' }}
                            />
                            <p className="text-sm font-semibold">{section.name}</p>
                        </div>

                        <ul className="mt-2 space-y-1.5">
                            {section.items.map((item) => (
                                <li key={item.id} className="text-sm">
                                    <span className={item.isCancelled ? 'line-through opacity-60' : undefined}>
                                        {item.name}
                                    </span>
                                    {item.modifiers.length > 0 && (
                                        <span className="ml-2 text-xs text-muted-foreground">
                                            {item.modifiers.join(' · ')}
                                        </span>
                                    )}
                                    {item.notes && (
                                        <span className="ml-2 text-xs italic text-muted-foreground">{item.notes}</span>
                                    )}
                                    {item.isCompleted ? (
                                        <Badge variant="success" className="ml-2 align-middle">{t('status.completed')}</Badge>
                                    ) : item.isScheduled ? (
                                        <Badge variant="default" className="ml-2 align-middle">{t('status.scheduled')}</Badge>
                                    ) : null}
                                </li>
                            ))}
                        </ul>

                        {section.teeth.length > 0 && (
                            <div className="mt-3">
                                <ToothGridPicker
                                    value={section.teeth}
                                    onChange={() => { /* sólo lectura en el resumen */ }}
                                    disabled
                                    testIdPrefix={`summary-tooth-${section.code.toLowerCase()}`}
                                />
                            </div>
                        )}
                    </div>
                ))
            )}

            {texts.length > 0 && (
                <div className="rounded-lg border p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        {t('form.textsSection')}
                    </p>
                    <dl className="mt-2 space-y-1.5">
                        {texts.map((entry) => (
                            <div key={entry.label} className="text-sm">
                                <dt className="inline font-medium">{entry.label}: </dt>
                                <dd className="inline text-muted-foreground">{entry.value}</dd>
                            </div>
                        ))}
                    </dl>
                </div>
            )}

            {clinicalNotes?.trim() && (
                <div className="rounded-lg border p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        {t('form.clinicalNotes')}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{clinicalNotes}</p>
                </div>
            )}
        </div>
    );
}

// ── Traductores de códigos ───────────────────────────────────────────────────
// Lo que se guarda son códigos; lo que se muestra son etiquetas. El catálogo que
// las relaciona es el mismo que arma el formulario, así que ambas pantallas lo
// resuelven igual en vez de mostrar el código crudo, que es lo que hacía el
// detalle antes.

export function labelForModifier(options: StudyOrderFormOptions | null, code: string): string {
    return options?.modifiers.find((m) => m.code === code)?.label ?? code;
}

export function labelForDelivery(options: StudyOrderFormOptions | null, code: string): string {
    return options?.delivery.find((d) => d.code === code)?.label ?? code;
}

export function labelForText(options: StudyOrderFormOptions | null, code: string): string {
    return options?.texts.find((x) => x.code === code)?.label ?? code;
}

export default StudyOrderSummary;
