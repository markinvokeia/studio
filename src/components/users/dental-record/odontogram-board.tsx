'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Brush, LayoutList, Orbit } from 'lucide-react';

import { usePanelWidth } from '@/hooks/use-panel-width';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { cn } from '@/lib/utils';

import type { OdontogramCondition, OdontogramProcedure, OdontogramState, OdontogramSurface } from '@/lib/types';
import {
  ANATOMICAL_COORDS,
  isTemporalTooth,
  isUpperTooth,
  PERMANENT_LOWER_LEFT,
  PERMANENT_LOWER_RIGHT,
  PERMANENT_UPPER_LEFT,
  PERMANENT_UPPER_RIGHT,
  TEMPORAL_LOWER_LEFT,
  TEMPORAL_LOWER_RIGHT,
  TEMPORAL_UPPER_LEFT,
  TEMPORAL_UPPER_RIGHT,
} from './odontogram-catalog';
import { OdontogramTooth } from './odontogram-tooth';

type DentitionFilter = 'permanent' | 'temporal' | 'both';
type ViewLayout = 'traditional' | 'anatomical';

/** Below this viewport width the anatomical arch is the default view */
const ANATOMICAL_DEFAULT_BELOW = 1024;
/** Container width needed to show both anatomical arches side by side */
const SIDE_BY_SIDE_MIN_WIDTH = 640;
/** Container width needed to fit two 8-tooth quadrants on one line */
const QUADRANTS_SIDE_BY_SIDE_MIN_WIDTH = 960;
/** Below this width the zoomed tooth is kept small so the arch stays visible */
const COMPACT_ZOOM_BELOW = 480;

interface OdontogramBoardProps {
  state: OdontogramState;
  selectedToothId: string | null;
  onSelectTooth: (toothId: string | null) => void;
  activeProcedure?: OdontogramProcedure | null;
  onSurfaceApply?: (toothId: string, surface: OdontogramSurface) => void;
  onToothApply?: (toothId: string, procedure: OdontogramCondition) => void;
  onDeactivateTool?: () => void;
  readOnly?: boolean;
}

/** Places each tooth number radially outside (permanent) or inside (temporal) the arch */
function getLabelPosition(tooth: number, coords: { left: number; top: number }) {
  const cy = isUpperTooth(tooth) ? 95 : 5;
  const dx = coords.left - 50;
  const dy = coords.top - cy;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const offset = isTemporalTooth(tooth) ? -8.5 : 9.5;
  return {
    left: `${coords.left + (dx / dist) * offset}%`,
    top: `${coords.top + (dy / dist) * offset}%`,
  };
}

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex gap-0.5 rounded-lg border bg-muted/60 p-0.5" role="radiogroup">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all',
            value === option.value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function OdontogramBoard({
  state,
  selectedToothId,
  onSelectTooth,
  activeProcedure = null,
  onSurfaceApply,
  onToothApply,
  onDeactivateTool,
  readOnly = false,
}: OdontogramBoardProps) {
  const t = useTranslations('DentalRecord');
  const containerRef = React.useRef<HTMLDivElement>(null);
  const width = usePanelWidth(containerRef);
  const sideBySide = width >= SIDE_BY_SIDE_MIN_WIDTH;
  const quadrantsSideBySide = width >= QUADRANTS_SIDE_BY_SIDE_MIN_WIDTH;
  const compactZoom = width > 0 && width < COMPACT_ZOOM_BELOW;

  const [filter, setFilter] = React.useState<DentitionFilter>('permanent');

  // Defaults to the anatomical arch on narrow viewports; a manual choice holds until the
  // viewport crosses the breakpoint again.
  const isNarrowViewport = useViewportNarrow(ANATOMICAL_DEFAULT_BELOW);
  const [layoutOverride, setLayoutOverride] = React.useState<ViewLayout | null>(null);
  React.useEffect(() => setLayoutOverride(null), [isNarrowViewport]);
  const layout: ViewLayout = layoutOverride ?? (isNarrowViewport ? 'anatomical' : 'traditional');

  const selectedTooth = selectedToothId ? Number(selectedToothId) : null;
  const showPermanent = filter !== 'temporal';
  const showTemporal = filter !== 'permanent';

  const handleSelect = React.useCallback((tooth: number) => onSelectTooth(String(tooth)), [onSelectTooth]);
  const handleSurfaceApply = React.useCallback(
    (tooth: number, surface: OdontogramSurface) => onSurfaceApply?.(String(tooth), surface),
    [onSurfaceApply],
  );
  const handleToothApply = React.useCallback(
    (tooth: number, procedure: OdontogramCondition) => onToothApply?.(String(tooth), procedure),
    [onToothApply],
  );

  function renderTooth(tooth: number, options: { variant?: 'regular' | 'compact' | 'zoom'; hideNumber?: boolean } = {}) {
    return (
      <OdontogramTooth
        toothNumber={tooth}
        tooth={state[String(tooth)]}
        activeProcedure={readOnly ? null : activeProcedure}
        isSelected={selectedTooth === tooth}
        readOnly={readOnly}
        variant={options.variant}
        hideNumber={options.hideNumber}
        onSelect={handleSelect}
        onSurfaceApply={handleSurfaceApply}
        onToothApply={handleToothApply}
      />
    );
  }

  function renderRow(teeth: number[], title: string) {
    return (
      <div className="flex w-full min-w-0 flex-col items-center">
        <span className="mb-1 max-w-full truncate px-1 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        <div className="flex w-full flex-nowrap justify-center gap-0.5 overflow-x-auto rounded-xl border bg-muted/30 p-1 sm:gap-1 sm:p-1.5">
          {teeth.map((tooth) => (
            <React.Fragment key={tooth}>{renderTooth(tooth)}</React.Fragment>
          ))}
        </div>
      </div>
    );
  }

  function renderArch(arch: 'upper' | 'lower') {
    const isUpper = arch === 'upper';
    const permanent = isUpper
      ? [...PERMANENT_UPPER_RIGHT, ...PERMANENT_UPPER_LEFT]
      : [...PERMANENT_LOWER_RIGHT, ...PERMANENT_LOWER_LEFT];
    const temporal = isUpper
      ? [...TEMPORAL_UPPER_RIGHT, ...TEMPORAL_UPPER_LEFT]
      : [...TEMPORAL_LOWER_RIGHT, ...TEMPORAL_LOWER_LEFT];
    const visible = [...(showPermanent ? permanent : []), ...(showTemporal ? temporal : [])];
    const zoomTooth = selectedTooth !== null && isUpperTooth(selectedTooth) === isUpper ? selectedTooth : null;

    return (
      <div
        className="relative aspect-[1.15/1] w-full cursor-pointer rounded-3xl border bg-muted/20 p-4 shadow-[inset_0_2px_8px_rgba(0,0,0,0.02)]"
        onClick={() => onSelectTooth(null)}
      >
        {/* Teeth and labels live in an inset area so the outermost molars stay inside the border */}
        <div className="absolute inset-x-[7%] inset-y-[9%]">
          {visible.map((tooth) => {
            const coords = ANATOMICAL_COORDS[tooth];
            const isTemporal = isTemporalTooth(tooth);
            const isSelected = selectedTooth === tooth;
            return (
              <div
                key={`label-${tooth}`}
                className={cn(
                  'pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2 select-none rounded-sm px-1 font-mono font-bold transition-all duration-300',
                  isTemporal ? 'text-[9px] md:text-[10px]' : 'text-[10px] md:text-[11px]',
                  isSelected
                    ? 'scale-105 rounded border border-primary/40 bg-primary/10 text-primary dark:text-foreground shadow-sm'
                    : isTemporal
                      ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                      : 'border border-border/40 bg-background/70 text-muted-foreground',
                )}
                style={getLabelPosition(tooth, coords)}
              >
                {tooth}
              </div>
            );
          })}
        </div>

        <div
          className={cn(
            'absolute left-1/2 -translate-x-1/2 -translate-y-1/2',
            isUpper ? 'top-[58%]' : 'top-[42%]',
            zoomTooth !== null ? 'z-40' : 'pointer-events-none z-0',
          )}
        >
          {zoomTooth !== null ? (
            <div
              key={zoomTooth}
              className={cn(
                'flex flex-col items-center justify-center rounded-full border border-primary/30 bg-background/95 shadow-2xl ring-4 ring-background/60 backdrop-blur-xl duration-300 animate-in fade-in zoom-in-50 dark:border-foreground/30',
                compactZoom ? 'h-[150px] w-[150px] gap-3 p-3' : 'h-[142px] w-[142px] scale-125 gap-1 p-3.5',
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-bold text-primary dark:text-foreground">
                {t('board.piece', { tooth: zoomTooth })}
              </span>
              {/* On narrow screens the zoomed tooth is the main working surface, so it is drawn larger */}
              <div className={cn(compactZoom && 'scale-[1.3]')}>
                {renderTooth(zoomTooth, { variant: 'zoom', hideNumber: true })}
              </div>
            </div>
          ) : (
            <div className="flex h-[124px] w-[124px] select-none flex-col items-center justify-center rounded-full border border-dashed border-border/60 p-4 text-center">
              <span className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                {isUpper ? t('board.upperPiece') : t('board.lowerPiece')}
              </span>
              <span className="block px-1 text-[9px] leading-tight text-muted-foreground/80">{t('board.clickToZoom')}</span>
            </div>
          )}
        </div>

        <div className="absolute inset-x-[7%] inset-y-[9%]">
          {visible.map((tooth) => {
            const coords = ANATOMICAL_COORDS[tooth];
            return (
              <div
                key={tooth}
                className={cn(
                  'absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-300',
                  isTemporalTooth(tooth) && 'scale-[0.85]',
                  selectedTooth === tooth && 'z-30',
                )}
                style={{ left: `${coords.left}%`, top: `${coords.top}%` }}
              >
                {renderTooth(tooth, { variant: 'compact', hideNumber: true })}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-muted/30 p-3">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'permanent', label: t('board.filter.permanent') },
            { value: 'temporal', label: t('board.filter.temporal') },
            { value: 'both', label: t('board.filter.both') },
          ]}
        />
        <Segmented
          value={layout}
          onChange={setLayoutOverride}
          options={[
            { value: 'anatomical', label: t('board.layout.anatomical'), icon: <Orbit className="h-3.5 w-3.5" /> },
            { value: 'traditional', label: t('board.layout.traditional'), icon: <LayoutList className="h-3.5 w-3.5" /> },
          ]}
        />
      </div>

      <div
        className={cn('rounded-2xl border bg-card p-4 sm:p-6', layout === 'traditional' ? 'overflow-x-auto' : 'overflow-hidden')}
        onClick={() => onSelectTooth(null)}
      >
        {activeProcedure && !readOnly && (
          <div
            className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs font-medium text-foreground duration-300 animate-in fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <Brush className="h-3.5 w-3.5 animate-bounce text-primary dark:text-foreground" />
              <span>
                {t.rich('board.activeToolBanner', {
                  tool: t(`procedures.${activeProcedure.id}.label`),
                  strong: (chunks) => <strong className="font-bold">{chunks}</strong>,
                })}
              </span>
            </div>
            {onDeactivateTool && (
              <button type="button" onClick={onDeactivateTool} className="font-bold text-primary dark:text-foreground underline hover:text-primary/80 dark:hover:text-foreground/80">
                {t('board.deactivateTool')}
              </button>
            )}
          </div>
        )}

        {layout === 'traditional' ? (
          <div className="flex w-full max-w-full flex-col gap-4 overflow-x-auto py-1 sm:gap-6 sm:py-2">
            {showPermanent && (
              <div className={cn('grid gap-4 border-b border-dashed pb-2', quadrantsSideBySide ? 'grid-cols-2' : 'grid-cols-1')}>
                {renderRow(PERMANENT_UPPER_RIGHT, t('board.quadrant.q1'))}
                {renderRow(PERMANENT_UPPER_LEFT, t('board.quadrant.q2'))}
              </div>
            )}
            {showTemporal && (
              <div className="grid grid-cols-2 gap-4 pb-2">
                {renderRow(TEMPORAL_UPPER_RIGHT, t('board.quadrant.q5'))}
                {renderRow(TEMPORAL_UPPER_LEFT, t('board.quadrant.q6'))}
              </div>
            )}
            {showTemporal && (
              <div className="grid grid-cols-2 gap-4 border-t border-dashed pt-2">
                {renderRow(TEMPORAL_LOWER_RIGHT, t('board.quadrant.q8'))}
                {renderRow(TEMPORAL_LOWER_LEFT, t('board.quadrant.q7'))}
              </div>
            )}
            {showPermanent && (
              <div className={cn('grid gap-4 border-t pt-2', quadrantsSideBySide ? 'grid-cols-2' : 'grid-cols-1')}>
                {renderRow(PERMANENT_LOWER_RIGHT, t('board.quadrant.q4'))}
                {renderRow(PERMANENT_LOWER_LEFT, t('board.quadrant.q3'))}
              </div>
            )}
          </div>
        ) : (
          <div className={cn('grid w-full gap-6 py-2', sideBySide ? 'grid-cols-2 gap-8' : 'grid-cols-1')}>
            {renderArch('upper')}
            {renderArch('lower')}
          </div>
        )}
      </div>
    </div>
  );
}
