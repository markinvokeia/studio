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
  { id: 'healthy',    category: 'surface',  color: '#22c55e', border: '#16a34a', icon: 'Sa' },
  { id: 'caries',     category: 'surface',  color: '#ef4444', border: '#dc2626', icon: 'Ca' },
  { id: 'filling',    category: 'surface',  color: '#3b82f6', border: '#2563eb', icon: 'Ob' },
  { id: 'pulp',       category: 'surface',  color: '#f97316', border: '#ea580c', icon: 'Pu' },
  { id: 'dyschromic', category: 'surface',  color: '#eab308', border: '#ca8a04', icon: 'Dc' },
  { id: 'worn',       category: 'surface',  color: '#9ca3af', border: '#6b7280', icon: 'Dg' },
  // ── Whole-tooth conditions ──
  { id: 'crown',       category: 'whole',   color: '#2563eb', border: '#1d4ed8', icon: 'Co' },
  { id: 'crown-tmp',   category: 'whole',   color: '#fb923c', border: '#ea580c', icon: 'CT' },
  { id: 'missing',     category: 'whole',   color: '#64748b', border: '#475569', icon: 'Au' },
  { id: 'root-remnant',category: 'whole',   color: '#dc2626', border: '#b91c1c', icon: 'RR' },
  { id: 'prosthesis',  category: 'whole',   color: '#7c3aed', border: '#6d28d9', icon: 'Pr' },
  { id: 'fixed-prosth',category: 'whole',   color: '#1d4ed8', border: '#1e40af', icon: 'PF' },
  { id: 'implant',     category: 'whole',   color: '#6366f1', border: '#4f46e5', icon: 'Im' },
  { id: 'edentulism',  category: 'whole',   color: '#94a3b8', border: '#64748b', icon: 'Ed' },
  { id: 'endodontics', category: 'whole',   color: '#be123c', border: '#9f1239', icon: 'En' },
  // ── Overlay conditions ──
  { id: 'fracture',     category: 'overlay', color: '#dc2626', border: '#b91c1c', icon: 'Fx' },
  { id: 'diastema',     category: 'overlay', color: '#0ea5e9', border: '#0284c7', icon: 'Di' },
  { id: 'rem-prost',    category: 'overlay', color: '#8b5cf6', border: '#7c3aed', icon: 'RP' },
  { id: 'drifting',     category: 'overlay', color: '#f59e0b', border: '#d97706', icon: 'Dt' },
  { id: 'rotation',     category: 'overlay', color: '#ec4899', border: '#db2777', icon: 'Ro' },
  { id: 'fusion',       category: 'overlay', color: '#14b8a6', border: '#0d9488', icon: 'Fu' },
  { id: 'eruption',     category: 'overlay', color: '#84cc16', border: '#65a30d', icon: 'Er' },
  { id: 'transposition',category: 'overlay', color: '#f97316', border: '#ea580c', icon: 'Tp' },
  { id: 'supernumerary',category: 'overlay', color: '#a855f7', border: '#9333ea', icon: 'Sn' },
  { id: 'bolt',         category: 'overlay', color: '#6b7280', border: '#4b5563', icon: 'Bl' },
  { id: 'fixed-ortho',  category: 'overlay', color: '#10b981', border: '#059669', icon: 'OF' },
  { id: 'macrodontia',  category: 'overlay', color: '#f43f5e', border: '#e11d48', icon: 'Mc' },
  { id: 'microdontia',  category: 'overlay', color: '#db2777', border: '#be185d', icon: 'Mi' },
  { id: 'impacted-semi',category: 'overlay', color: '#d97706', border: '#b45309', icon: 'SI' },
  { id: 'intrusion',    category: 'overlay', color: '#7c3aed', border: '#6d28d9', icon: 'In' },
  { id: 'ectopic',      category: 'overlay', color: '#06b6d4', border: '#0891b2', icon: 'Ec' },
  { id: 'impacted',     category: 'overlay', color: '#92400e', border: '#78350f', icon: 'Ip' },
  { id: 'rem-orthodo',  category: 'overlay', color: '#16a34a', border: '#15803d', icon: 'RO' },
  { id: 'extrusion',    category: 'overlay', color: '#7e22ce', border: '#6b21a8', icon: 'Ex' },
  { id: 'post',         category: 'overlay', color: '#78716c', border: '#57534e', icon: 'Pe' },
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
                'flex flex-col items-center justify-center gap-0.5 rounded-md border transition-all py-1.5 px-0.5',
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
              <span
                className="text-[8px] leading-tight text-center w-full truncate px-0.5"
                style={{ color: isActive ? '#fff' : cond.color }}
              >
                {t(`conditions.${cond.id}`)}
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
