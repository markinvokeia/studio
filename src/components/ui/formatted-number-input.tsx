'use client';

import * as React from 'react';
import { Input } from './input';
import { cn } from '@/lib/utils';

interface FormattedNumberInputProps {
  value: number | string | null | undefined;
  onChange: (value: number) => void;
  allowNegative?: boolean;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
}

function toNumber(value: number | string | null | undefined) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function formatValue(value: number | string | null | undefined) {
  const numericValue = toNumber(value);
  return numericValue !== undefined ? numericValue.toFixed(2) : '';
}

export function FormattedNumberInput({
  value,
  onChange,
  allowNegative = false,
  className,
  placeholder,
  disabled,
  id,
}: FormattedNumberInputProps) {
  const isFocused = React.useRef(false);

  const [inputValue, setInputValue] = React.useState(() => formatValue(value));

  React.useEffect(() => {
    if (!isFocused.current) {
      setInputValue(formatValue(value));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const sanitized = allowNegative 
      ? rawValue.replace(/[^0-9.-]/g, '')
      : rawValue.replace(/[^0-9.]/g, '');
    
    const parts = sanitized.split('.');
    let formatted = parts[0];
    if (parts.length > 1) {
      formatted += '.' + parts[1].slice(0, 2);
    }
    setInputValue(formatted);
    const numValue = formatted === '' ? 0 : parseFloat(formatted);
    onChange(isNaN(numValue) ? 0 : numValue);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    isFocused.current = false;
    const numValue = parseFloat(e.target.value);
    if (!isNaN(numValue) && (allowNegative ? true : numValue >= 0)) {
      onChange(numValue);
      setInputValue(numValue.toFixed(2));
    } else if (e.target.value !== '') {
      onChange(0);
      setInputValue('');
    }
  };

  return (
    <Input
      id={id}
      className={className}
      placeholder={placeholder}
      disabled={disabled}
      value={inputValue}
      onChange={handleChange}
      onFocus={() => { isFocused.current = true; }}
      onBlur={handleBlur}
    />
  );
}
