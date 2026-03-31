'use client';

import { IMPORT_ENTITY_ORDER, IMPORT_SCHEMAS, ImportEntityType } from '@/config/import-schemas';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

interface StepSelectTypeProps {
  selected: ImportEntityType | null;
  onSelect: (type: ImportEntityType) => void;
}

export function StepSelectType({ selected, onSelect }: StepSelectTypeProps) {
  const t = useTranslations('ImportPage');

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
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
  );
}
