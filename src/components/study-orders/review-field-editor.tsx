'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

import { cn } from '@/lib/utils';

/**
 * El campo del formulario que corresponde a un punto a revisar, en chico, para corregirlo desde
 * la tarjeta sobre el original sin volver al formulario (en el celular, volver es cerrar los
 * originales, buscar el campo y abrirlos otra vez). Cambia el mismo estado que el formulario:
 * lo que se corrige acá se ve allá y viceversa.
 *
 * Es solo presentación: el asistente de órdenes arma qué mostrar con su estado y sus handlers.
 */
export type ReviewFieldEditorProps =
    | { kind: 'text'; label: string; value: string; onChange: (value: string) => void; multiline?: boolean; type?: 'text' | 'date' }
    /** Casillas sueltas (medios de envío, opciones de un grupo). */
    | { kind: 'toggles'; label: string; options: Array<{ code: string; label: string; checked: boolean }>; onToggle: (code: string) => void }
    /** Un estudio: pedirlo o no y su indicación. */
    | { kind: 'service'; name: string; checked: boolean; onToggle: () => void; note: string; onNoteChange: (note: string) => void }
    | { kind: 'teeth'; label: string; value: string[]; onChange: (teeth: string[]) => void }
    /** Algo que el asistente ya tiene armado (el selector de paciente). */
    | { kind: 'custom'; label: string; children: React.ReactNode };

/** Piezas válidas en numeración FDI: 11–48 (permanentes) y 51–85 (temporarias). */
function isTooth(code: string): boolean {
    if (!/^[1-8][1-8]$/.test(code)) return false;
    const quadrant = Number(code[0]);
    const tooth = Number(code[1]);
    return quadrant <= 4 ? tooth <= 8 : tooth <= 5;
}

/** Las piezas marcadas, ordenadas por número. */
const sortTeeth = (teeth: string[]) => [...teeth].sort((a, b) => Number(a) - Number(b));

function TeethEditor({ label, value, onChange }: { label: string; value: string[]; onChange: (teeth: string[]) => void }) {
    const t = useTranslations('StudyOrdersPage.review.focus');
    const [draft, setDraft] = React.useState('');
    const [invalid, setInvalid] = React.useState(false);

    // Se pueden escribir varias juntas: "16 26, 36".
    const add = () => {
        const codes = draft.split(/[\s,;.]+/).filter(Boolean);
        if (codes.length === 0) return;
        if (!codes.every(isTooth)) { setInvalid(true); return; }
        onChange(sortTeeth(Array.from(new Set([...value, ...codes]))));
        setDraft('');
        setInvalid(false);
    };

    return (
        <div className="space-y-1.5">
            {value.length > 0 && (
                <div className="flex flex-wrap gap-1">
                    {value.map((tooth) => (
                        <button
                            key={tooth}
                            type="button"
                            onClick={() => onChange(value.filter((v) => v !== tooth))}
                            className="inline-flex h-6 items-center gap-0.5 rounded-md border bg-primary/10 px-1.5 font-mono text-xs tabular-nums hover:bg-destructive/10"
                            aria-label={t('removeTooth', { tooth })}
                            title={t('removeTooth', { tooth })}
                        >
                            {tooth}
                            <X className="h-3 w-3" aria-hidden="true" />
                        </button>
                    ))}
                </div>
            )}
            <Input
                value={draft}
                onChange={(e) => { setDraft(e.target.value); setInvalid(false); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
                onBlur={add}
                inputMode="numeric"
                placeholder={t('addTooth')}
                aria-label={`${label}: ${t('addTooth')}`}
                aria-invalid={invalid}
                className={cn('h-8 text-sm', invalid && 'border-destructive')}
            />
            {invalid && <p className="text-[11px] text-destructive">{t('invalidTooth')}</p>}
        </div>
    );
}

export function ReviewFieldEditor(props: ReviewFieldEditorProps) {
    const t = useTranslations('StudyOrdersPage.review.focus');

    switch (props.kind) {
        case 'text':
            return props.multiline ? (
                <Textarea
                    value={props.value}
                    onChange={(e) => props.onChange(e.target.value)}
                    rows={2}
                    aria-label={props.label}
                    className="min-h-0 text-sm"
                />
            ) : (
                <Input
                    type={props.type ?? 'text'}
                    value={props.value}
                    onChange={(e) => props.onChange(e.target.value)}
                    aria-label={props.label}
                    className="h-8 text-sm"
                />
            );
        case 'toggles':
            return (
                <div className="flex flex-wrap gap-x-3 gap-y-1.5" role="group" aria-label={props.label}>
                    {props.options.map((option) => (
                        <label key={option.code} className="flex cursor-pointer items-center gap-1.5 text-xs">
                            <Checkbox checked={option.checked} onCheckedChange={() => props.onToggle(option.code)} />
                            {option.label}
                        </label>
                    ))}
                </div>
            );
        case 'service':
            return (
                <div className="space-y-1.5">
                    <label className="flex cursor-pointer items-center gap-1.5 text-xs">
                        <Checkbox checked={props.checked} onCheckedChange={props.onToggle} />
                        {t('requestService', { name: props.name })}
                    </label>
                    {props.checked && (
                        <Input
                            value={props.note}
                            onChange={(e) => props.onNoteChange(e.target.value)}
                            placeholder={t('serviceNote')}
                            aria-label={t('serviceNote')}
                            className="h-8 text-sm"
                        />
                    )}
                </div>
            );
        case 'teeth':
            return <TeethEditor label={props.label} value={props.value} onChange={props.onChange} />;
        case 'custom':
            return <div aria-label={props.label} role="group">{props.children}</div>;
    }
}

export default ReviewFieldEditor;
