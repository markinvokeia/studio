'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

interface CodeInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Se dispara al completar los 6 dígitos, con el código ya armado. */
  onComplete?: (code: string) => void;
  disabled?: boolean;
  length?: number;
}

/**
 * Entrada del código de acceso: una casilla por dígito, con avance automático,
 * borrado hacia atrás y soporte de pegado (el paciente suele copiar el código
 * del email de un tirón).
 */
export function CodeInput({ value, onChange, onComplete, disabled = false, length = 6 }: CodeInputProps) {
  const inputsRef = React.useRef<Array<HTMLInputElement | null>>([]);

  const focusAt = (index: number) => {
    const clamped = Math.max(0, Math.min(length - 1, index));
    inputsRef.current[clamped]?.focus();
    inputsRef.current[clamped]?.select();
  };

  const commit = (next: string) => {
    onChange(next);
    if (next.length === length) onComplete?.(next);
  };

  const handleChange = (index: number, raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (!digits) return;

    // Pegado: se reparte desde la casilla actual.
    const chars = value.padEnd(length, ' ').split('');
    for (let i = 0; i < digits.length && index + i < length; i += 1) {
      chars[index + i] = digits[i];
    }
    const next = chars.join('').replace(/\s+$/, '').trimEnd();
    commit(next.slice(0, length));
    focusAt(index + digits.length);
  };

  const handleKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace') {
      event.preventDefault();
      const chars = value.split('');
      if (chars[index]) {
        chars[index] = '';
        commit(chars.join('').trimEnd());
        return;
      }
      chars[index - 1] = '';
      commit(chars.join('').trimEnd());
      focusAt(index - 1);
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusAt(index - 1);
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      focusAt(index + 1);
    }
  };

  return (
    <div className="flex justify-center gap-2 sm:gap-3" dir="ltr">
      {Array.from({ length }).map((_, index) => (
        <input
          key={index}
          ref={(el) => {
            inputsRef.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          aria-label={`${index + 1}`}
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={length}
          disabled={disabled}
          value={value[index] ?? ''}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onFocus={(e) => e.target.select()}
          autoFocus={index === 0}
          className={cn(
            // Casillas grandes: cómodas para el pulgar y legibles a distancia.
            'h-16 w-[13%] max-w-14 rounded-xl border-2 border-input bg-background text-center text-2xl font-bold tabular-nums',
            'transition-colors focus:border-primary focus:outline-none focus:ring-4 focus:ring-ring/25',
            'disabled:cursor-not-allowed disabled:opacity-50',
            value[index] && 'border-primary/60'
          )}
        />
      ))}
    </div>
  );
}
