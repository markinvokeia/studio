'use client';

import * as React from 'react';
import { DateVariableInput } from '@/components/ui/date-variable-input';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';

interface DynamicFieldInputProps {
  value: string;
  onChange: (value: string) => void;
  fieldType: string;
  operator: string;
  placeholder?: string;
  className?: string;
}

export const DynamicFieldInput: React.FC<DynamicFieldInputProps> = ({
  value,
  onChange,
  fieldType,
  operator,
  placeholder,
  className
}) => {
  // Don't show input for IS NULL and IS NOT NULL operators
  if (operator === 'IS NULL' || operator === 'IS NOT NULL') {
    return null;
  }

  const lowerType = fieldType.toLowerCase();

  // Handle boolean fields
  if (lowerType === 'boolean' || lowerType === 'bit') {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className={cn('w-full', className)}>
          <SelectValue placeholder={placeholder || 'Select value'} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">True</SelectItem>
          <SelectItem value="false">False</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  // Handle date/datetime fields
  if (lowerType.includes('date') || lowerType.includes('time')) {
    return (
      <DateVariableInput
        value={value}
        onChange={onChange}
        operator={operator}
        placeholder={placeholder}
        className={className}
      />
    );
  }

  // Handle numeric fields
  if (
    lowerType.includes('int') ||
    lowerType.includes('decimal') ||
    lowerType.includes('numeric') ||
    lowerType.includes('float') ||
    lowerType.includes('double')
  ) {
    return (
      <Input
        type="number"
        step={lowerType.includes('decimal') || lowerType.includes('numeric') || lowerType.includes('float') || lowerType.includes('double') ? '0.01' : '1'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || 'Enter number'}
        className={className}
      />
    );
  }

  // Handle string/text fields (default case)
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder || 'Enter value'}
      className={className}
    />
  );
};