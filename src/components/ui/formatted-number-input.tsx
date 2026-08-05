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

/** Canonical 2-decimal text for a committed value (shown while not focused, and on blur). */
function formatForDisplay(value: number | string | null | undefined): string {
  const n = toNumber(value);
  return n === undefined ? '' : n.toFixed(2);
}

/** Best-effort numeric value of whatever's currently typed, mid-edit text included
 *  ("12.", "-", "" all parse to 0 rather than NaN). */
function parseAmountText(text: string): number {
  const n = Number(text);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Strips `raw` down to a valid amount string (digits, at most one decimal separator, at
 * most 2 decimal places, and a leading `-` only when negatives are allowed) while keeping
 * the caret glued to the character it was next to — every dropped character before the
 * caret shifts it left by one, instead of the caret being reset to some fixed spot.
 */
function sanitizeAmountText(raw: string, caret: number, allowNegative: boolean): { text: string; caret: number } {
  let sawDot = false;
  let decimals = 0;
  let hasMinus = false;
  let out = '';
  let droppedBeforeCaret = 0;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    let kept = false;

    if (ch === '-') {
      if (allowNegative && !hasMinus && out.length === 0) {
        hasMinus = true;
        out += '-';
        kept = true;
      }
    } else if (ch >= '0' && ch <= '9') {
      if (!sawDot) {
        out += ch;
        kept = true;
      } else if (decimals < 2) {
        out += ch;
        decimals++;
        kept = true;
      }
    } else if ((ch === '.' || ch === ',') && !sawDot) {
      sawDot = true;
      out += '.';
      kept = true;
    }

    if (!kept && i < caret) droppedBeforeCaret++;
  }

  return { text: out, caret: Math.max(0, caret - droppedBeforeCaret) };
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
  const pendingCaret = React.useRef<number | null>(null);
  const [text, setText] = React.useState(() => formatForDisplay(value));

  React.useEffect(() => {
    if (!isFocused.current) setText(formatForDisplay(value));
  }, [value]);

  // Restore the caret to where `sanitizeAmountText` computed it should land — needed
  // because replacing the value wholesale (rather than a plain in-place edit) makes the
  // browser's own caret tracking unreliable once characters get dropped.
  React.useLayoutEffect(() => {
    if (pendingCaret.current !== null && inputRef.current) {
      const pos = pendingCaret.current;
      inputRef.current.setSelectionRange(pos, pos);
      pendingCaret.current = null;
    }
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const caret = e.target.selectionStart ?? raw.length;
    const { text: sanitized, caret: nextCaret } = sanitizeAmountText(raw, caret, allowNegative);
    pendingCaret.current = nextCaret;
    setText(sanitized);
    onChange(parseAmountText(sanitized));
  };

  return (
    <Input
      id={id}
      ref={inputRef}
      className={className}
      placeholder={placeholder}
      disabled={disabled}
      value={text}
      onChange={handleChange}
      onFocus={() => { isFocused.current = true; }}
      onBlur={() => {
        isFocused.current = false;
        setText(text === '' || text === '-' ? '' : formatForDisplay(parseAmountText(text)));
      }}
      inputMode="decimal"
      aria-label={ariaLabel}
    />
  );
}
