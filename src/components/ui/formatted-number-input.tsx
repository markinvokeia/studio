'use client';

import * as React from 'react';
import { Input } from './input';

interface FormattedNumberInputProps {
  value: number | string | null | undefined;
  onChange: (value: number) => void;
  allowNegative?: boolean;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
}

function toNumber(value: number | string | null | undefined) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

/**
 * Digit string representing the amount in cents (e.g. "12345" -> 123.45). Typing/deleting
 * a digit always affects the rightmost end of this string — a calculator/POS-style amount
 * mask — so the caret position never matters: entering a digit shifts the existing digits
 * left instead of silently being dropped once the two decimal places are already full
 * (which is what a plain "slice the decimals to 2 chars" approach did before).
 */
function amountToDigits(value: number | string | null | undefined): string {
  const n = toNumber(value);
  if (n === undefined) return '';
  const cents = Math.round(Math.abs(n) * 100);
  return String(cents);
}

function digitsToDisplay(digits: string): string {
  const padded = digits.padStart(3, '0');
  const intPart = padded.slice(0, -2).replace(/^0+(?=\d)/, '');
  return `${intPart}.${padded.slice(-2)}`;
}

export function FormattedNumberInput({
  value,
  onChange,
  allowNegative = false,
  className,
  placeholder,
  disabled,
  id,
  'aria-label': ariaLabel,
}: FormattedNumberInputProps) {
  const isFocused = React.useRef(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [digits, setDigits] = React.useState(() => amountToDigits(value));
  const [negative, setNegative] = React.useState(() => (toNumber(value) ?? 0) < 0);

  React.useEffect(() => {
    if (!isFocused.current) {
      setDigits(amountToDigits(value));
      setNegative((toNumber(value) ?? 0) < 0);
    }
  }, [value]);

  // The mask always grows/shrinks from the right, so the caret is re-parked at the end
  // after every edit — leaving it wherever the browser put it would be meaningless once
  // the digits have been reformatted.
  React.useEffect(() => {
    if (isFocused.current && inputRef.current) {
      const end = inputRef.current.value.length;
      inputRef.current.setSelectionRange(end, end);
    }
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const isNeg = allowNegative && /^\s*-/.test(raw);
    const nextDigits = raw.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '').slice(0, 12);
    setDigits(nextDigits);
    setNegative(isNeg);
    const cents = nextDigits === '' ? 0 : parseInt(nextDigits, 10);
    onChange((isNeg ? -1 : 1) * cents / 100);
  };

  const display = digits === '' ? '' : `${negative ? '-' : ''}${digitsToDisplay(digits)}`;

  return (
    <Input
      id={id}
      ref={inputRef}
      className={className}
      placeholder={placeholder}
      disabled={disabled}
      value={display}
      onChange={handleChange}
      onFocus={() => { isFocused.current = true; }}
      onBlur={() => { isFocused.current = false; }}
      inputMode="decimal"
      aria-label={ariaLabel}
    />
  );
}
