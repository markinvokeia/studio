'use client';

import * as React from 'react';
import { Input } from './input';
import { cn } from '@/lib/utils';

interface FormattedNumberInputProps {
  value: number | undefined;
  onChange: (value: number) => void;
  allowNegative?: boolean;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
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
  const [inputValue, setInputValue] = React.useState(value ? String(value) : '');

  React.useEffect(() => {
    setInputValue(value ? String(value) : '');
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
      onBlur={handleBlur}
    />
  );
}
