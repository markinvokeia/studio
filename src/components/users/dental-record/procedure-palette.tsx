'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { HelpCircle, MousePointerClick, Search, X } from 'lucide-react';

import { Input } from '@/components/ui/input';

import { cn } from '@/lib/utils';

import type { OdontogramProcedure, OdontogramProcedureCategory } from '@/lib/types';
import { DESKTOP_CATEGORY_ORDER, MOBILE_CATEGORY_ORDER, SELECTABLE_PROCEDURES } from './odontogram-catalog';

interface ProcedurePaletteProps {
  activeProcedure: OdontogramProcedure | null;
  onSelectProcedure: (procedure: OdontogramProcedure | null) => void;
  /** `sidebar`: compact 2-column category grid; `stacked`: 4-column grid for full-width placement */
  variant?: 'sidebar' | 'stacked';
}

function ProcedureSwatch({ procedure }: { procedure: OdontogramProcedure }) {
  const { id, color } = procedure;
  if (id === 'bridge-in-progress' || id === 'fixed-prosth' || id === 'bridge-defective') {
    return (
      <span
        className="h-2.5 w-5 shrink-0 rounded-sm border"
        style={{ backgroundColor: id === 'bridge-in-progress' ? '#dc2626' : '#2563eb', borderColor: id === 'bridge-defective' ? '#dc2626' : color, borderWidth: id === 'bridge-defective' ? 2 : 1 }}
      />
    );
  }
  if (id === 'crown' || id === 'crown-indicated' || id === 'crown-tmp') {
    return (
      <span
        className={cn('h-3.5 w-3.5 shrink-0 rounded-full border-2', id !== 'crown' && 'border-dashed')}
        style={{ borderColor: color }}
      />
    );
  }
  return <span className="h-3.5 w-3.5 shrink-0 rounded border" style={{ backgroundColor: color, borderColor: color }} />;
}

export function ProcedurePalette({ activeProcedure, onSelectProcedure, variant = 'sidebar' }: ProcedurePaletteProps) {
  const t = useTranslations('DentalRecord');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [showSearch, setShowSearch] = React.useState(false);
  const [openCategory, setOpenCategory] = React.useState<OdontogramProcedureCategory | null>(null);

  const categories = variant === 'sidebar' ? DESKTOP_CATEGORY_ORDER : MOBILE_CATEGORY_ORDER;

  const filtered = React.useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return SELECTABLE_PROCEDURES;
    return SELECTABLE_PROCEDURES.filter((p) =>
      [
        t(`procedures.${p.id}.label`),
        p.code,
        t(`categories.${p.category}`),
        t(`procedures.${p.id}.description`),
      ].some((text) => text.toLowerCase().includes(term)),
    );
  }, [searchTerm, t]);

  const grouped = React.useMemo(() => {
    const groups = {} as Record<OdontogramProcedureCategory, OdontogramProcedure[]>;
    for (const category of categories) groups[category.id] = [];
    for (const procedure of filtered) groups[procedure.category]?.push(procedure);
    return groups;
  }, [categories, filtered]);

  // Follow the active tool's category so its description stays visible
  React.useEffect(() => {
    if (activeProcedure) setOpenCategory(activeProcedure.category);
  }, [activeProcedure]);

  function renderProcedureButton(procedure: OdontogramProcedure, detailed: boolean) {
    const isSelected = activeProcedure?.id === procedure.id;
    return (
      <button
        key={procedure.id}
        type="button"
        onClick={() => onSelectProcedure(procedure)}
        className={cn(
          'group flex w-full flex-col rounded-lg border p-1.5 text-left text-xs shadow-sm transition-all',
          isSelected
            ? 'border-primary/60 bg-primary/5 font-bold ring-1 ring-primary/20'
            : 'bg-card text-muted-foreground hover:bg-muted/60 hover:text-foreground',
        )}
      >
        <div className="flex w-full items-center justify-between gap-1.5">
          <div className="flex max-w-[78%] items-center gap-1.5 overflow-hidden">
            <ProcedureSwatch procedure={procedure} />
            <span className="truncate text-[11px] font-bold text-foreground">{t(`procedures.${procedure.id}.label`)}</span>
          </div>
          <span className="shrink-0 rounded border bg-muted px-1 font-mono text-[9px] font-extrabold uppercase text-muted-foreground transition-colors group-hover:border-primary/20 group-hover:text-primary">
            {procedure.code}
          </span>
        </div>

        {detailed && (
          <div
            className={cn(
              'w-full text-left',
              isSelected
                ? 'mt-1 block border-t border-dashed border-primary/30 pt-1'
                : 'mt-1 hidden border-t border-dashed pt-1 group-hover:block',
            )}
          >
            <p className="mb-0.5 text-[10px] font-medium leading-normal text-muted-foreground">
              {t(`procedures.${procedure.id}.description`)}
            </p>
            <div className="flex w-full items-center justify-between border-t border-dotted pt-0.5 text-[9px] font-semibold text-muted-foreground">
              <span className="mr-1 truncate font-mono">
                {t('palette.symbol', { symbol: t(`procedures.${procedure.id}.symbol`) })}
              </span>
              <span className="shrink-0 rounded border bg-muted/60 px-1">{t(`palette.appliesTo.${procedure.appliesTo}`)}</span>
            </div>
          </div>
        )}
      </button>
    );
  }

  const openCategoryMeta = categories.find((c) => c.id === openCategory);

  return (
    <div className="flex h-full flex-col justify-between rounded-2xl border bg-card p-2.5 shadow-sm sm:p-3">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-1 border-b pb-1.5">
          <h3 className="shrink-0 text-xs font-bold tracking-tight text-foreground">✨ {t('palette.title')}</h3>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onSelectProcedure(null)}
              title={t('palette.selectModeHint')}
              className={cn(
                'flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-bold shadow-sm transition-all',
                activeProcedure === null
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <MousePointerClick className="h-3 w-3" />
              <span className="whitespace-nowrap">{t('palette.selectMode')}</span>
              {activeProcedure === null && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary-foreground" />}
            </button>

            <button
              type="button"
              onClick={() => setShowSearch((prev) => !prev)}
              title={t('palette.searchHint')}
              className={cn(
                'flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-bold transition-all',
                showSearch || searchTerm
                  ? 'border-primary/40 bg-primary/5 text-primary dark:text-foreground'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted',
              )}
            >
              <Search className="h-3 w-3" />
              <span>{t('palette.search')}</span>
            </button>
          </div>
        </div>

        {(showSearch || searchTerm) && (
          <div className="relative duration-200 animate-in fade-in">
            <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              autoFocus
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('palette.searchPlaceholder')}
              className="h-7 pl-6 pr-6 text-[11px]"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                aria-label={t('palette.clearSearch')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        )}

        <div className={cn('grid pt-0.5', variant === 'sidebar' ? 'grid-cols-2 gap-1' : 'grid-cols-4 gap-1.5')}>
          {categories.map((category) => {
            const isOpen = openCategory === category.id;
            const count = grouped[category.id]?.length ?? 0;
            const hasActive = activeProcedure?.category === category.id;
            const label = t(`categories.${category.id}`);
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => setOpenCategory((prev) => (prev === category.id ? null : category.id))}
                title={t('palette.categoryCount', { category: label, count })}
                className={cn(
                  'select-none rounded-lg border transition-all',
                  variant === 'sidebar'
                    ? 'flex min-h-[32px] items-center justify-between px-2 py-1.5 text-left'
                    : 'flex min-h-[46px] flex-col items-center justify-center rounded-xl p-1.5 text-center',
                  isOpen
                    ? 'border-primary/60 bg-primary/10 font-bold text-foreground ring-1 ring-primary/20'
                    : hasActive
                      ? 'border-primary/30 bg-primary/5 font-semibold text-foreground'
                      : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <span className={cn('flex items-center gap-1 overflow-hidden', variant === 'stacked' && 'flex-col gap-0.5')}>
                  <span className="shrink-0 text-[11px]">{category.icon}</span>
                  <span className="w-full truncate text-[10px] font-medium leading-tight tracking-tight">{label}</span>
                </span>
                {isOpen ? (
                  <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full bg-primary', variant === 'stacked' && 'mt-0.5')} />
                ) : (
                  <span className="shrink-0 font-mono text-[9px] font-semibold text-muted-foreground">{count}</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="pt-0.5">
          {searchTerm.trim() ? (
            <div className="max-h-[240px] space-y-1 overflow-y-auto pr-0.5 text-left">
              <div className="flex items-center justify-between border-b pb-0.5 text-[10px] font-bold text-muted-foreground">
                <span>{t('palette.results', { count: filtered.length })}</span>
                <span className="text-[9px]">&quot;{searchTerm}&quot;</span>
              </div>
              {filtered.length === 0 ? (
                <div className="rounded-lg border bg-muted/40 p-2.5 text-center text-[11px] text-muted-foreground">
                  {t('palette.noResults')}
                </div>
              ) : (
                <div className="space-y-1">{filtered.map((p) => renderProcedureButton(p, false))}</div>
              )}
            </div>
          ) : openCategory && openCategoryMeta ? (
            <div className="max-h-[240px] space-y-1 overflow-y-auto pr-0.5 text-left duration-200 animate-in fade-in">
              <div className="flex items-center justify-between border-b pb-0.5 text-[11px]">
                <span className="flex items-center gap-1 font-bold text-foreground">
                  <span>{openCategoryMeta.icon}</span>
                  {t(`categories.${openCategory}`)}
                </span>
                <button
                  type="button"
                  onClick={() => setOpenCategory(null)}
                  aria-label={t('palette.closeCategory')}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              <div className="space-y-1">{(grouped[openCategory] ?? []).map((p) => renderProcedureButton(p, true))}</div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed bg-muted/30 p-2 text-center text-[10px] font-medium text-muted-foreground">
              {t('palette.pickCategory')}
            </div>
          )}
        </div>
      </div>

      <div className="-mx-2.5 -mb-2.5 mt-2 rounded-b-2xl border-t bg-muted/40 p-2 sm:-mx-3 sm:-mb-3 sm:p-2.5">
        <div className="flex items-start gap-1.5 text-left text-xs">
          <HelpCircle className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
          <div className="w-full space-y-0.5">
            <span className="block text-[9px] font-bold uppercase tracking-wider text-foreground">{t('palette.legendTitle')}</span>
            <div className="grid grid-cols-2 gap-x-1.5 gap-y-0.5 font-mono text-[9px] leading-tight text-muted-foreground">
              <div><span className="font-sans font-bold text-blue-600">■ AM</span> {t('palette.legend.amalgam')}</div>
              <div><span className="font-sans font-bold text-sky-500">■ RC</span> {t('palette.legend.resin')}</div>
              <div><span className="font-sans font-bold text-rose-500">■ REQ</span> {t('palette.legend.required')}</div>
              <div><span className="font-sans font-bold text-rose-500">● CAI</span> {t('palette.legend.caries')}</div>
              <div><span className="font-sans font-bold text-blue-600">✕ EXO</span> {t('palette.legend.missing')}</div>
              <div><span className="font-sans font-bold text-rose-600">✕ IND</span> {t('palette.legend.extraction')}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
