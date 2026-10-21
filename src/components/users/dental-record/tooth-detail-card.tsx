'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { MousePointerClick, RefreshCcw, Undo2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

import type { OdontogramCondition, OdontogramProcedureCategory, OdontogramSurface, OdontogramToothState } from '@/lib/types';
import { getProcedureColor, getToothKind, isTemporalTooth, SELECTABLE_PROCEDURES, SURFACE_ABBR, SURFACE_ORDER } from './odontogram-catalog';
import { getToothProcedures } from './odontogram-state';

interface ToothDetailCardProps {
  toothId: string | null;
  tooth: OdontogramToothState | undefined;
  readOnly?: boolean;
  canUndo?: boolean;
  onUndo?: () => void;
  onClearTooth?: (toothId: string) => void;
  onToggleToothProcedure?: (toothId: string, procedure: OdontogramCondition) => void;
  onToggleSurface?: (toothId: string, surface: OdontogramSurface, procedure: OdontogramCondition) => void;
  onNotesChange?: (toothId: string, notes: string) => void;
}

// Whole-tooth procedures offered in the quick selector, grouped by category
const TOOTH_PROCEDURES_BY_CATEGORY = SELECTABLE_PROCEDURES
  .filter((p) => p.appliesTo !== 'surface')
  .reduce((acc, p) => {
    (acc[p.category] ??= []).push(p);
    return acc;
  }, {} as Partial<Record<OdontogramProcedureCategory, typeof SELECTABLE_PROCEDURES>>);

export function ToothDetailCard({
  toothId,
  tooth,
  readOnly = false,
  canUndo = false,
  onUndo,
  onClearTooth,
  onToggleToothProcedure,
  onToggleSurface,
  onNotesChange,
}: ToothDetailCardProps) {
  const t = useTranslations('DentalRecord');

  if (!toothId) {
    return (
      <div className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed p-4 text-center text-xs text-muted-foreground">
        <MousePointerClick className="h-5 w-5" />
        {t('selectToothHint')}
      </div>
    );
  }

  const toothNumber = Number(toothId);
  const kind = getToothKind(toothNumber);
  const toothProcedures = getToothProcedures(tooth);
  const surfaceEntries = SURFACE_ORDER.flatMap((surface) => {
    const procedure = tooth?.[surface];
    return procedure ? [{ surface, procedure }] : [];
  });
  const hasMarks = toothProcedures.length > 0 || surfaceEntries.length > 0;

  function renderChip(key: string, procedure: OdontogramCondition, detail: string | null, onRemove?: () => void) {
    const color = getProcedureColor(procedure);
    return (
      <span
        key={key}
        className="flex items-center gap-1.5 rounded-md border bg-muted/30 px-2 py-1 text-xs"
        style={{ borderColor: `${color}55` }}
      >
        <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
        <span className="font-medium text-foreground">{t(`procedures.${procedure}.label`)}</span>
        {detail && <span className="rounded bg-muted px-1 text-[10px] text-muted-foreground">{detail}</span>}
        {onRemove && !readOnly && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={t('toothCard.removeProcedure')}
            className="text-muted-foreground hover:text-destructive"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </span>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border bg-card p-4 text-left shadow-sm sm:p-5">
      <div className="flex flex-col justify-between gap-3 border-b pb-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary font-mono text-sm font-bold text-primary-foreground shadow-sm">
            {toothNumber}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {kind ? t(`toothNames.${kind}`) : t('board.piece', { tooth: toothNumber })}
            </h3>
            <p className="text-xs text-muted-foreground">
              {isTemporalTooth(toothNumber) ? t('toothCard.temporal') : t('toothCard.permanent')}
            </p>
          </div>
        </div>

        {!readOnly && (
          <div className="flex items-center gap-2">
            {onUndo && (
              <Button type="button" size="sm" variant="outline" onClick={onUndo} disabled={!canUndo} className="gap-1.5 text-xs">
                <Undo2 className="h-3.5 w-3.5" />
                {t('toothCard.undo')}
              </Button>
            )}
            {onClearTooth && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onClearTooth(toothId)}
                disabled={!hasMarks && !tooth?.notes}
                className="gap-1.5 text-xs hover:text-destructive"
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                {t('clearTooth')}
              </Button>
            )}
          </div>
        )}
      </div>

      {!readOnly && onToggleToothProcedure && (
        <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
          <Label className="text-[11px] font-bold text-foreground">{t('toothCard.quickAdd', { tooth: toothNumber })}</Label>
          <Select value="" onValueChange={(value) => onToggleToothProcedure(toothId, value as OdontogramCondition)}>
            <SelectTrigger className="h-8 bg-background text-xs">
              <SelectValue placeholder={t('toothCard.quickAddPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TOOTH_PROCEDURES_BY_CATEGORY).map(([category, list]) => (
                <SelectGroup key={category}>
                  <SelectLabel className="text-[11px]">{t(`categories.${category as OdontogramProcedureCategory}`)}</SelectLabel>
                  {list?.map((p) => (
                    <SelectItem key={p.id} value={p.id} disabled={toothProcedures.includes(p.id)} className="text-xs">
                      [{p.code}] {t(`procedures.${p.id}.label`)}
                      {toothProcedures.includes(p.id) && ` ✓ ${t('toothCard.alreadyApplied')}`}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t('toothCard.summary')}</span>
        {hasMarks ? (
          <div className="flex flex-wrap gap-1.5">
            {toothProcedures.map((procedure) =>
              renderChip(procedure, procedure, t('toothCard.wholeTooth'), () => onToggleToothProcedure?.(toothId, procedure)),
            )}
            {surfaceEntries.map(({ surface, procedure }) =>
              renderChip(surface, procedure, SURFACE_ABBR[surface], () => onToggleSurface?.(toothId, surface, procedure)),
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{t('toothCard.noMarks')}</p>
        )}
      </div>

      {(!readOnly || tooth?.notes) && (
        <div className="space-y-1.5">
          <Label className="text-xs">{t('toothCard.notes')}</Label>
          {readOnly ? (
            <p className="whitespace-pre-wrap rounded-lg border bg-muted/30 px-3 py-2 text-xs text-foreground">{tooth?.notes}</p>
          ) : (
            <Textarea
              value={tooth?.notes ?? ''}
              onChange={(e) => onNotesChange?.(toothId, e.target.value)}
              placeholder={t('toothCard.notesPlaceholder')}
              rows={2}
              className="min-h-[60px] resize-y text-xs"
            />
          )}
        </div>
      )}
    </div>
  );
}
