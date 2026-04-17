'use client';

import { IMPORT_ENTITY_ORDER, IMPORT_SCHEMAS, ImportEntityType } from '@/config/import-schemas';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface StepSelectTypeProps {
  selected: ImportEntityType | null;
  onSelect: (type: ImportEntityType) => void;
}

export function StepSelectType({ selected, onSelect }: StepSelectTypeProps) {
  const t = useTranslations('ImportPage');

  return (
    <>
      {/* Mobile: list rows */}
      <div className="flex flex-col gap-2 sm:hidden">
        {IMPORT_ENTITY_ORDER.map((type) => {
          const schema = IMPORT_SCHEMAS[type];
          const Icon = schema.icon;
          const isSelected = selected === type;

          return (
            <button
              key={type}
              type="button"
              onClick={() => onSelect(type)}
              className={cn(
                'flex items-center gap-3 rounded-lg border-2 px-4 py-3 text-left transition-all',
                isSelected
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-card hover:border-primary/60 hover:bg-accent'
              )}
            >
              <div
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                  isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <span
                className={cn(
                  'flex-1 text-sm font-medium',
                  isSelected ? 'text-primary' : 'text-foreground'
                )}
              >
                {t(`entityTypes.${schema.labelKey}`)}
              </span>
              {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
            </button>
          );
        })}
      </div>

      {/* Desktop: grid cards */}
      <div className="hidden sm:grid grid-cols-3 md:grid-cols-4 gap-3">
        {IMPORT_ENTITY_ORDER.map((type) => {
          const schema = IMPORT_SCHEMAS[type];
          const Icon = schema.icon;
          const isSelected = selected === type;

          return (
            <button
              key={type}
              type="button"
              onClick={() => onSelect(type)}
              className={cn(
                'flex flex-col items-center gap-3 rounded-lg border-2 p-5 text-center transition-all hover:border-primary/60 hover:bg-accent',
                isSelected
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-border bg-card'
              )}
            >
              <div
                className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-full',
                  isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                )}
              >
                <Icon className="h-6 w-6" />
              </div>
              <span
                className={cn(
                  'text-sm font-medium',
                  isSelected ? 'text-primary' : 'text-foreground'
                )}
              >
                {t(`entityTypes.${schema.labelKey}`)}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
