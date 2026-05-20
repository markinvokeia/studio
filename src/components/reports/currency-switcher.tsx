'use client';

import { cn } from '@/lib/utils';

interface CurrencySwitcherProps {
  value: 'UYU' | 'USD';
  onChange: (v: 'UYU' | 'USD') => void;
}

export function CurrencySwitcher({ value, onChange }: CurrencySwitcherProps) {
  return (
    <div className="flex items-center gap-0.5 rounded border bg-muted/50 p-0.5">
      {(['UYU', 'USD'] as const).map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={cn(
            'rounded px-2 py-0.5 text-xs font-medium transition-colors',
            value === c
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {c}
        </button>
      ))}
    </div>
  );
}
