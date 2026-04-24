'use client';

import { cn } from '@/lib/utils';
import type { OdontogramCondition } from '@/lib/types';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export type ConditionCategory = 'surface' | 'whole' | 'overlay';

export type ConditionDef = {
  id: OdontogramCondition;
  category: ConditionCategory;
  color: string;       // fill color
  border: string;      // border/outline color
  icon: string;        // short label shown on button
};

export const CONDITIONS: ConditionDef[] = [
  // ── Surface conditions ──
  { id: 'caries',     category: 'surface',  color: '#ef4444', border: '#dc2626', icon: 'Ca' },
  { id: 'filling',    category: 'surface',  color: '#3b82f6', border: '#2563eb', icon: 'Ob' },
  { id: 'wear',       category: 'surface',  color: '#9ca3af', border: '#6b7280', icon: 'De' },
  // ── Whole-tooth conditions ──
  { id: 'missing',    category: 'whole',    color: '#60a5fa', border: '#3b82f6', icon: 'Au' },
  { id: 'crown',      category: 'whole',    color: '#2563eb', border: '#1d4ed8', icon: 'Co' },
  { id: 'implant',    category: 'whole',    color: '#6366f1', border: '#4f46e5', icon: 'Im' },
  { id: 'root_canal', category: 'whole',    color: '#ef4444', border: '#b91c1c', icon: 'En' },
  { id: 'bridge',     category: 'whole',    color: '#1d4ed8', border: '#1e40af', icon: 'Pu' },
  { id: 'impacted',   category: 'whole',    color: '#f59e0b', border: '#d97706', icon: 'Re' },
  { id: 'extracted',  category: 'whole',    color: '#94a3b8', border: '#64748b', icon: 'Ex' },
  { id: 'crown_temp', category: 'whole',    color: '#fb923c', border: '#ea580c', icon: 'CT' },
  { id: 'residual_root', category: 'whole', color: '#dc2626', border: '#991b1b', icon: 'RR' },
  // ── Overlay conditions ──
  { id: 'fracture',    category: 'overlay', color: '#dc2626', border: '#991b1b', icon: 'Fx' },
  { id: 'orthodontics',category: 'overlay', color: '#10b981', border: '#059669', icon: 'Or' },
  { id: 'post',        category: 'overlay', color: '#6b7280', border: '#4b5563', icon: 'Pe' },
  { id: 'gyroversion', category: 'overlay', color: '#8b5cf6', border: '#7c3aed', icon: 'Gi' },
  { id: 'diastema',    category: 'overlay', color: '#0ea5e9', border: '#0284c7', icon: 'Di' },
];

export const CONDITION_MAP = Object.fromEntries(
  CONDITIONS.map((c) => [c.id, c]),
) as Record<OdontogramCondition, ConditionDef>;

const CATEGORIES: { id: ConditionCategory; labelKey: string }[] = [
  { id: 'surface', labelKey: 'conditionCategory.surface' },
  { id: 'whole',   labelKey: 'conditionCategory.whole' },
  { id: 'overlay', labelKey: 'conditionCategory.overlay' },
];

interface ConditionToolbarProps {
  active: OdontogramCondition | null;
  onSelect: (c: OdontogramCondition | null) => void;
  readOnly?: boolean;
  /** When true, categories stack vertically as an accordion (expand downward) */
  vertical?: boolean;
  /** When true, buttons render as icon-only 3-per-row grid (for narrow columns) */
  compact?: boolean;
}

function ConditionButtons({
  conditions,
  active,
  onSelect,
  t,
  compact = false,
}: {
  conditions: ConditionDef[];
  active: OdontogramCondition | null;
  onSelect: (c: OdontogramCondition | null) => void;
  t: ReturnType<typeof useTranslations>;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="grid grid-cols-3 gap-1 pt-1">
        {conditions.map((cond) => {
          const isActive = active === cond.id;
          return (
            <button
              key={cond.id}
              title={t(`conditions.${cond.id}`)}
              onClick={() => onSelect(cond.id)}
              className={cn(
                'flex items-center justify-center rounded-md border transition-all',
                'aspect-square w-full p-0',
                isActive ? 'shadow-sm ring-1 ring-inset' : 'bg-background hover:bg-muted/60',
              )}
              style={
                isActive
                  ? { backgroundColor: cond.color, borderColor: cond.border }
                  : { borderColor: `${cond.color}80` }
              }
            >
              <span
                className="h-5 w-5 rounded-sm flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                style={{ backgroundColor: cond.color }}
              >
                {cond.icon}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5 pt-1.5">
      {conditions.map((cond) => {
        const isActive = active === cond.id;
        return (
          <button
            key={cond.id}
            title={t(`conditions.${cond.id}`)}
            onClick={() => onSelect(cond.id)}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium border transition-all',
              isActive ? 'text-white shadow-sm scale-105' : 'bg-background text-foreground hover:scale-105',
            )}
            style={
              isActive
                ? { backgroundColor: cond.color, borderColor: cond.border }
                : { borderColor: cond.color, color: cond.color }
            }
          >
            <span
              className="h-4 w-4 rounded-sm flex items-center justify-center text-[9px] font-bold text-white shrink-0"
              style={{ backgroundColor: cond.color }}
            >
              {cond.icon}
            </span>
            <span className="hidden sm:inline truncate max-w-[72px]">
              {t(`conditions.${cond.id}`)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function ConditionToolbar({ active, onSelect, readOnly, vertical, compact }: ConditionToolbarProps) {
  const t = useTranslations('DentalRecord');
  const [tab, setTab] = useState<ConditionCategory>('surface');

  function handleTabChange(newTab: ConditionCategory) {
    setTab(newTab);
    onSelect(null);
  }

  const visible = CONDITIONS.filter((c) => c.category === tab);

  if (vertical) {
    return (
      <div className={cn('flex flex-col gap-1', readOnly && 'pointer-events-none opacity-60')}>
        {CATEGORIES.map((cat) => {
          const isOpen = tab === cat.id;
          const catConditions = CONDITIONS.filter((c) => c.category === cat.id);
          return (
            <div key={cat.id} className="flex flex-col">
              <button
                onClick={() => handleTabChange(cat.id)}
                className={cn(
                  'flex items-center justify-between w-full py-1.5 px-2.5 rounded-md text-xs font-semibold transition-colors',
                  isOpen
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/60 text-foreground hover:bg-muted',
                )}
              >
                {t(cat.labelKey)}
                <ChevronDown
                  className={cn('h-3.5 w-3.5 transition-transform duration-150', isOpen && 'rotate-180')}
                />
              </button>
              {isOpen && (
                <div className="border border-t-0 rounded-b-md px-2 pb-2">
                  <ConditionButtons conditions={catConditions} active={active} onSelect={onSelect} t={t} compact={compact} />
                </div>
              )}
            </div>
          );
        })}

        {active && (
          <p className="text-[10px] text-muted-foreground mt-1">
            {t('activeTool')}:{' '}
            <span className="font-semibold" style={{ color: CONDITION_MAP[active]?.color }}>
              {t(`conditions.${active}`)}
            </span>
            {' — '}
            {CONDITION_MAP[active]?.category === 'surface' && t('hint.surface')}
            {CONDITION_MAP[active]?.category === 'whole' && t('hint.whole')}
            {CONDITION_MAP[active]?.category === 'overlay' && t('hint.overlay')}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-2', readOnly && 'pointer-events-none opacity-60')}>
      {/* Category tabs — horizontal */}
      <div className="flex rounded-md border overflow-hidden text-xs">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => handleTabChange(cat.id)}
            className={cn(
              'flex-1 py-1.5 font-medium transition-colors',
              tab === cat.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-background text-muted-foreground hover:bg-muted',
            )}
          >
            {t(cat.labelKey)}
          </button>
        ))}
      </div>

      <ConditionButtons conditions={visible} active={active} onSelect={onSelect} t={t} compact={compact} />

      {active && (
        <p className="text-[10px] text-muted-foreground">
          {t('activeTool')}:{' '}
          <span className="font-semibold" style={{ color: CONDITION_MAP[active]?.color }}>
            {t(`conditions.${active}`)}
          </span>
          {' — '}
          {CONDITION_MAP[active]?.category === 'surface' && t('hint.surface')}
          {CONDITION_MAP[active]?.category === 'whole' && t('hint.whole')}
          {CONDITION_MAP[active]?.category === 'overlay' && t('hint.overlay')}
        </p>
      )}
    </div>
  );
}
