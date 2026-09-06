'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Selector múltiple de piezas dentarias con el layout exacto de la orden
 * impresa de Clínica Imagen: permanentes en las filas de afuera, temporarios
 * indentados en las de adentro, y la línea de la mitad separando cuadrantes.
 *
 *          55 54 53 52 51 │ 61 62 63 64 65
 * 18 17 16 15 14 13 12 11 │ 21 22 23 24 25 26 27 28
 * 48 47 46 45 44 43 42 41 │ 31 32 33 34 35 36 37 38
 *          85 84 83 82 81 │ 71 72 73 74 75
 *
 * No reutiliza `@/components/odontogram`: eso es un instrumento clínico con
 * superficies, condiciones y tratamientos. Acá una pieza sólo está marcada o no.
 *
 * La numeración es ISO 3950 (FDI), un estándar internacional, así que se genera
 * en el front en vez de guardarse como catálogo en la base.
 */

/** Cuadrantes superiores e inferiores, en el orden visual de la orden impresa. */
const UPPER_PERMANENT = [
    [18, 17, 16, 15, 14, 13, 12, 11],
    [21, 22, 23, 24, 25, 26, 27, 28],
] as const;
const LOWER_PERMANENT = [
    [48, 47, 46, 45, 44, 43, 42, 41],
    [31, 32, 33, 34, 35, 36, 37, 38],
] as const;
const UPPER_DECIDUOUS = [
    [55, 54, 53, 52, 51],
    [61, 62, 63, 64, 65],
] as const;
const LOWER_DECIDUOUS = [
    [85, 84, 83, 82, 81],
    [71, 72, 73, 74, 75],
] as const;

export interface ToothGridPickerProps {
    /** Piezas marcadas, como códigos FDI en texto: `['16', '26']`. */
    value: string[];
    onChange: (teeth: string[]) => void;
    disabled?: boolean;
    /** Oculta la dentición temporaria cuando la sección no la usa. */
    hideDeciduous?: boolean;
    className?: string;
    /** Prefijo de `data-testid`, para que Playwright distinga los dos odontogramas. */
    testIdPrefix?: string;
}

interface ToothButtonProps {
    tooth: number;
    isSelected: boolean;
    disabled?: boolean;
    onToggle: (tooth: string) => void;
    testId?: string;
}

const ToothButton = React.memo(function ToothButton({
    tooth, isSelected, disabled, onToggle, testId,
}: ToothButtonProps) {
    const code = String(tooth);
    return (
        <button
            type="button"
            role="checkbox"
            aria-checked={isSelected}
            aria-label={`Pieza ${code}`}
            data-testid={testId}
            disabled={disabled}
            onClick={() => onToggle(code)}
            className={cn(
                'h-9 w-9 shrink-0 rounded-md border text-xs font-medium tabular-nums transition-colors',
                'sm:h-10 sm:w-10 sm:text-sm',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                isSelected
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                disabled && 'cursor-not-allowed opacity-50 hover:bg-background',
            )}
        >
            {code}
        </button>
    );
});

export function ToothGridPicker({
    value,
    onChange,
    disabled = false,
    hideDeciduous = false,
    className,
    testIdPrefix = 'tooth',
}: ToothGridPickerProps) {
    // Set para que el lookup de "está marcada" no sea O(n) por cada uno de los 52 botones.
    const selected = React.useMemo(() => new Set(value), [value]);

    const handleToggle = React.useCallback(
        (code: string) => {
            const next = new Set(value);
            if (next.has(code)) {
                next.delete(code);
            } else {
                next.add(code);
            }
            // Se ordena para que el valor guardado no dependa del orden de clic.
            onChange(Array.from(next).sort());
        },
        [value, onChange],
    );

    const renderRow = (quadrants: readonly (readonly number[])[], indent: boolean) => (
        <div className={cn('flex items-center justify-center gap-1 sm:gap-1.5', indent && 'px-0 sm:px-[7.5rem]')}>
            <div className="flex gap-1 sm:gap-1.5">
                {quadrants[0].map((t) => (
                    <ToothButton
                        key={t}
                        tooth={t}
                        isSelected={selected.has(String(t))}
                        disabled={disabled}
                        onToggle={handleToggle}
                        testId={`${testIdPrefix}-${t}`}
                    />
                ))}
            </div>
            <div className="mx-1 h-9 w-px shrink-0 bg-border sm:mx-2 sm:h-10" aria-hidden="true" />
            <div className="flex gap-1 sm:gap-1.5">
                {quadrants[1].map((t) => (
                    <ToothButton
                        key={t}
                        tooth={t}
                        isSelected={selected.has(String(t))}
                        disabled={disabled}
                        onToggle={handleToggle}
                        testId={`${testIdPrefix}-${t}`}
                    />
                ))}
            </div>
        </div>
    );

    return (
        // La grilla no se comprime: en pantallas angostas scrollea horizontalmente
        // dentro de su caja, en vez de romper la correspondencia con la orden impresa.
        <div className={cn('overflow-x-auto', className)} data-testid={`${testIdPrefix}-grid`}>
            <div className="flex min-w-max flex-col gap-1 py-1 sm:gap-1.5">
                {!hideDeciduous && renderRow(UPPER_DECIDUOUS, true)}
                {renderRow(UPPER_PERMANENT, false)}
                {renderRow(LOWER_PERMANENT, false)}
                {!hideDeciduous && renderRow(LOWER_DECIDUOUS, true)}
            </div>
        </div>
    );
}

export default ToothGridPicker;
