'use client';

import React from 'react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

import type { OdontogramCondition, OdontogramProcedure, OdontogramSurface, OdontogramToothState } from '@/lib/types';
import { getProcedure, getProcedureColor, isAttentionProcedure, isRightQuadrant, isTemporalTooth, isUpperTooth } from './odontogram-catalog';
import { getToothProcedures, isToothMissing } from './odontogram-state';

// Surface paths on a 50x50 viewBox: a ring split in 4 sectors around a central circle
const SECTOR_PATHS = {
  top: 'M 8.03,8.03 A 24 24 0 0 1 41.97,8.03 L 32.07,17.93 A 10 10 0 0 0 17.93,17.93 Z',
  left: 'M 8.03,41.97 A 24 24 0 0 1 8.03,8.03 L 17.93,17.93 A 10 10 0 0 0 17.93,32.07 Z',
  right: 'M 41.97,8.03 A 24 24 0 0 1 41.97,41.97 L 32.07,32.07 A 10 10 0 0 0 32.07,17.93 Z',
  bottom: 'M 41.97,41.97 A 24 24 0 0 1 8.03,41.97 L 17.93,32.07 A 10 10 0 0 0 32.07,32.07 Z',
};

const SCREW_PATH = 'M -5,0 L 5,0 L 4,3 L -4,3 Z M -4,3 L 4,3 L 3,6 L -3,6 Z M -3,6 L 3,6 L 2,9 L -2,9 Z M -2,9 L 2,9 L 0,12 Z';

interface OdontogramToothProps {
  toothNumber: number;
  tooth: OdontogramToothState | undefined;
  activeProcedure: OdontogramProcedure | null;
  isSelected: boolean;
  readOnly?: boolean;
  /** `compact`: small tooth inside the anatomical arch; `zoom`: enlarged, unframed tooth in the arch center */
  variant?: 'regular' | 'compact' | 'zoom';
  hideNumber?: boolean;
  onSelect: (toothNumber: number) => void;
  onSurfaceApply?: (toothNumber: number, surface: OdontogramSurface) => void;
  onToothApply?: (toothNumber: number, procedure: OdontogramCondition) => void;
}

const MOBILITY_BADGES: { id: OdontogramCondition; label: string; className: string }[] = [
  { id: 'mobility-3', label: 'M3', className: 'bg-red-500 text-white border-red-600' },
  { id: 'mobility-2', label: 'M2', className: 'bg-amber-500 text-slate-950 border-amber-600' },
  { id: 'mobility-1', label: 'M1', className: 'bg-indigo-500 text-white border-indigo-600' },
];

function OdontogramToothBase({
  toothNumber,
  tooth,
  activeProcedure,
  isSelected,
  readOnly = false,
  variant = 'regular',
  hideNumber = false,
  onSelect,
  onSurfaceApply,
  onToothApply,
}: OdontogramToothProps) {
  const t = useTranslations('DentalRecord');
  const patternId = `resin-${React.useId().replace(/:/g, '')}`;

  const surfaces = tooth ?? {};
  const procs = getToothProcedures(tooth);
  const has = (id: OdontogramCondition) => procs.includes(id);
  const centerIs = (...ids: OdontogramCondition[]) => !!surfaces.center && ids.includes(surfaces.center);

  const isUpper = isUpperTooth(toothNumber);
  const isTemporal = isTemporalTooth(toothNumber);
  const isMissing = isToothMissing(tooth);

  // Mesial always faces the midline, so the side it is drawn on depends on the quadrant
  const leftSurface: OdontogramSurface = isRightQuadrant(toothNumber) ? 'right' : 'left';
  const rightSurface: OdontogramSurface = isRightQuadrant(toothNumber) ? 'left' : 'right';

  const compact = variant === 'compact';
  const isZoom = variant === 'zoom';
  const isSurfaceToolOnSelected = !readOnly && isSelected && !!activeProcedure && activeProcedure.appliesTo !== 'tooth';
  const mobility = MOBILITY_BADGES.find((b) => has(b.id));

  function surfaceFill(surface: OdontogramSurface): string | undefined {
    const id = surfaces[surface];
    if (!id) return undefined;
    switch (id) {
      case 'resin': return `url(#${patternId})`;
      case 'amalgam':
      case 'filling': return '#2563eb';
      case 'caries':
      case 'restoration-required': return '#ef4444';
      case 'caries-incipient': return '#fee2e2';
      case 'sealant': return '#10b981';
      default: return getProcedureColor(id);
    }
  }

  function surfaceTitle(surface: OdontogramSurface) {
    return t('board.surfaceTitle', { tooth: toothNumber, surface: t(`surfaces.${surface}`) });
  }

  function handleSurfaceClick(surface: OdontogramSurface, e: React.MouseEvent) {
    e.stopPropagation();
    if (readOnly || !activeProcedure) {
      onSelect(toothNumber);
      return;
    }
    if (activeProcedure.appliesTo === 'tooth') onToothApply?.(toothNumber, activeProcedure.id);
    else onSurfaceApply?.(toothNumber, surface);
  }

  function handleSelect(e: React.SyntheticEvent) {
    e.stopPropagation();
    onSelect(toothNumber);
  }

  function renderSurface(surface: OdontogramSurface, visualPath: string | null) {
    const fill = surfaceFill(surface);
    const className = cn(
      'transition-all duration-200 cursor-pointer',
      !fill && 'fill-card',
      isSurfaceToolOnSelected
        ? 'animate-surface-breath hover:fill-primary/25 hover:stroke-primary dark:hover:fill-foreground/20 dark:hover:stroke-foreground'
        : 'hover:stroke-primary dark:hover:stroke-foreground',
    );
    const common = {
      fill,
      className,
      onClick: (e: React.MouseEvent) => handleSurfaceClick(surface, e),
    };
    return visualPath ? (
      <path key={surface} d={visualPath} {...common}>
        <title>{surfaceTitle(surface)}</title>
      </path>
    ) : (
      <circle key={surface} cx="25" cy="25" r="10" {...common}>
        <title>{surfaceTitle(surface)}</title>
      </circle>
    );
  }

  // Positions of the incipient-caries dot on each visual sector
  const incipientDots: { surface: OdontogramSurface; cx: number; cy: number }[] = [
    { surface: 'top', cx: 25, cy: 11 },
    { surface: leftSurface, cx: 11, cy: 25 },
    { surface: 'center', cx: 25, cy: 25 },
    { surface: rightSurface, cx: 39, cy: 25 },
    { surface: 'bottom', cx: 25, cy: 39 },
  ];

  const arrowDown = 'M 25,44 L 25,34 M 21,40 L 25,44 L 29,40';
  const arrowUp = 'M 25,6 L 25,16 M 21,10 L 25,6 L 29,10';

  const numberLabel = !hideNumber && (
    <span
      className={cn(
        'font-mono font-bold',
        compact ? 'text-[9px]' : 'text-[10px] sm:text-[11px]',
        isTemporal ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground',
      )}
    >
      {toothNumber}
    </span>
  );

  const mobilityBadge = mobility && (
    <span className={cn('rounded border px-1 text-[8px] font-extrabold', mobility.className, compact && 'scale-90')}>
      {mobility.label}
    </span>
  );

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={t('board.toothLabel', { tooth: toothNumber })}
      aria-pressed={isSelected}
      onClick={handleSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleSelect(e);
        }
      }}
      className={cn(
        'relative flex shrink-0 cursor-pointer select-none flex-col items-center transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isZoom
          ? 'rounded-full p-0.5'
          : compact
            ? 'rounded-full p-0.5'
            : cn(
                'rounded-xl p-0.5 sm:px-1.5 sm:py-1',
                isSelected
                  ? 'scale-[1.03] border-2 border-primary bg-primary/5 shadow-md dark:border-foreground/60 dark:bg-foreground/10'
                  : 'border border-transparent hover:bg-muted/60',
              ),
      )}
    >
      <div
        className={cn(
          'flex items-center gap-1',
          compact
            ? 'pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2'
            : !isZoom && 'min-h-[14px] sm:min-h-[16px]',
        )}
      >
        {isUpper && numberLabel}
        {isUpper && mobilityBadge}
      </div>

      <div
        className={cn(
          'relative',
          isZoom
            ? 'h-14 w-14 sm:h-16 sm:w-16'
            : compact
              ? cn(
                  'h-7 w-7 rounded-full transition-all duration-300 sm:h-8 sm:w-8',
                  isSelected
                    ? 'z-10 scale-110 bg-primary/15 shadow-md ring-2 ring-primary ring-offset-2 ring-offset-background dark:bg-foreground/15 dark:ring-foreground'
                    : 'hover:bg-muted/60',
                )
              : 'my-0.5 h-8 w-8 sm:my-1 sm:h-10 sm:w-10',
        )}
      >
        {isMissing && <div className="pointer-events-none absolute inset-0 animate-pulse rounded-full bg-red-500/5" />}

        <svg
          viewBox="0 0 50 50"
          className={cn('h-full w-full overflow-visible transition-all duration-300', isMissing && 'opacity-35 grayscale-[30%]')}
        >
          <defs>
            <pattern id={patternId} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="4" height="4" fill="#eff6ff" />
              <line x1="0" y1="0" x2="0" y2="4" stroke="#3b82f6" strokeWidth="1.2" />
            </pattern>
          </defs>

          {/* Underlay: fixed orthodontic retainer wire */}
          {has('fixed-retainer') && (
            <line x1="0" y1="25" x2="50" y2="25" stroke="#475569" strokeWidth="2.5" className="pointer-events-none" />
          )}

          {/* Base: 5 clickable surfaces */}
          <g className="stroke-primary/50 [stroke-width:0.9] dark:stroke-foreground/40">
            {renderSurface('top', SECTOR_PATHS.top)}
            {renderSurface(leftSurface, SECTOR_PATHS.left)}
            {renderSurface('center', null)}
            {renderSurface(rightSurface, SECTOR_PATHS.right)}
            {renderSurface('bottom', SECTOR_PATHS.bottom)}
          </g>

          <g className="pointer-events-none">
            {incipientDots
              .filter((dot) => surfaces[dot.surface] === 'caries-incipient')
              .map((dot) => (
                <circle key={dot.surface} cx={dot.cx} cy={dot.cy} r="3" fill="#ef4444" stroke="#ffffff" strokeWidth="0.5" />
              ))}

            {/* Endodontics: line along the root */}
            {(has('endo-done') || has('endodontics') || centerIs('endodontics', 'endo-done')) && (
              <line x1="25" y1="5" x2="25" y2="45" stroke="#2563eb" strokeWidth="4" strokeLinecap="round" opacity="0.9" />
            )}
            {(has('endo-indicated') || centerIs('endo-indicated')) && (
              <line x1="25" y1="5" x2="25" y2="45" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" opacity="0.9" />
            )}
            {has('root-post') && (
              <line x1="25" y1="14" x2="25" y2="36" stroke="#334155" strokeWidth="6" strokeLinecap="square" />
            )}
            {has('post') && (
              <g>
                <line x1="25" y1="12" x2="25" y2="38" stroke="#64748b" strokeWidth="5.5" strokeLinecap="round" />
                <circle cx="25" cy="25" r="4.5" fill="#94a3b8" stroke="#475569" strokeWidth="1" />
              </g>
            )}
            {has('post-fiber') && (
              <g>
                <line x1="25" y1="12" x2="25" y2="38" stroke="#ca8a04" strokeWidth="5.5" strokeLinecap="round" />
                <circle cx="25" cy="25" r="4.5" fill="#eab308" stroke="#a16207" strokeWidth="1" />
              </g>
            )}

            {/* Fractures and root pathologies */}
            {(has('crown-fracture') || has('fracture') || centerIs('fracture')) && (
              <path d="M 5,23 L 16,16 L 28,30 L 40,18 L 45,25" fill="none" stroke="#eab308" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            )}
            {has('root-fracture') && (
              <path d="M 22,5 L 28,15 L 21,25 L 27,33 L 23,45" fill="none" stroke="#f97316" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            )}
            {has('root-resorption') && (
              <path d="M 25,12 Q 22,20 25,28 T 25,40" fill="none" stroke="#ea580c" strokeWidth="2" strokeDasharray="2.5 1.5" opacity="0.8" />
            )}
            {has('periapical-lesion') && (
              <circle cx="25" cy={isUpper ? 6 : 44} r="4.5" fill="#fee2e2" stroke="#dc2626" strokeWidth="2.5" className="animate-pulse" />
            )}

            {/* Eruption state */}
            {has('retained') && (
              <path d="M 5,25 A 20 20 0 0 1 45,25" fill="none" stroke="#4f46e5" strokeWidth="2.2" strokeLinecap="round" strokeDasharray="2 1.5" />
            )}
            {has('semi-erupted') && (
              <path d="M 8.03,8.03 A 24 24 0 0 1 41.97,8.03 L 25,25 Z" fill="#94a3b8" fillOpacity="0.35" />
            )}

            {/* Orthodontics and periodontics markers */}
            {has('bracket') && (
              <g transform="translate(25,25)" fill="#64748b" stroke="#ffffff" strokeWidth="0.5">
                <rect x="-4.5" y="-4.5" width="9" height="9" rx="1.5" />
                <line x1="-4.5" y1="0" x2="4.5" y2="0" strokeWidth="0.75" />
                <line x1="0" y1="-4.5" x2="0" y2="4.5" strokeWidth="0.75" />
              </g>
            )}
            {has('malposition') && (
              <path d="M 39,11 A 16 16 0 0 1 39,39" fill="none" stroke="#ec4899" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="3 2" />
            )}
            {has('perio-pocket') && (
              <line x1="46" y1="10" x2="46" y2="40" stroke="#dc2626" strokeWidth="3" strokeLinecap="round" />
            )}
            {/* Recession points apically, enlargement coronally */}
            {has('gingival-recession') && (
              <path d={isUpper ? arrowUp : arrowDown} fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" />
            )}
            {has('gingival-enlargement') && (
              <path d={isUpper ? arrowDown : arrowUp} fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" />
            )}
            {has('furcation') && (
              <path d="M 21,32 L 25,25 L 29,32 Z" fill="#ebf8ff" stroke="#4f46e5" strokeWidth="1.5" />
            )}

            {/* Implants */}
            {(has('implant-osseo') || has('implant')) && (
              <g transform="translate(25, 37) scale(0.65)" stroke="#334155" fill="#64748b">
                <path d={SCREW_PATH} />
                <rect x="-6" y="-3.5" width="12" height="3.5" rx="1" fill="#475569" stroke="#ffffff" strokeWidth="0.5" />
              </g>
            )}
            {has('implant-planned') && (
              <g transform="translate(25, 37) scale(0.65)" stroke="#dc2626" fill="#f87171">
                <path d={SCREW_PATH} />
                <rect x="-6" y="-3.5" width="12" height="3.5" rx="1" fill="#ef4444" stroke="#ffffff" strokeWidth="0.5" />
              </g>
            )}

            {/* Extraction indicated (red X) / missing (blue X) */}
            {has('extraction-indicated') && (
              <g stroke="#dc2626" strokeWidth="4.5" strokeLinecap="round">
                <line x1="4" y1="4" x2="46" y2="46" />
                <line x1="46" y1="4" x2="4" y2="46" />
              </g>
            )}
            {has('missing') && (
              <g stroke="#2563eb" strokeWidth="4.5" strokeLinecap="round">
                <line x1="4" y1="4" x2="46" y2="46" />
                <line x1="46" y1="4" x2="4" y2="46" />
              </g>
            )}

            {/* Crowns */}
            {has('crown') && <circle cx="25" cy="25" r="23" fill="none" stroke="#2563eb" strokeWidth="2.5" />}
            {has('crown-indicated') && (
              <circle cx="25" cy="25" r="23" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeDasharray="3.5 2.5" />
            )}
            {has('crown-tmp') && (
              <circle cx="25" cy="25" r="23" fill="none" stroke="#d97706" strokeWidth="2" strokeDasharray="5 2.5" />
            )}

            {/* Fixed bridges */}
            {has('bridge-in-progress') && <rect x="0" y="21" width="50" height="8" rx="2" fill="#ef4444" stroke="#b91c1c" strokeWidth="1.2" />}
            {has('fixed-prosth') && <rect x="0" y="21" width="50" height="8" rx="2" fill="#2563eb" stroke="#1d4ed8" strokeWidth="1.2" />}
            {has('bridge-defective') && <rect x="1" y="20.5" width="48" height="9" rx="2" fill="#2563eb" stroke="#dc2626" strokeWidth="2.5" />}
            {has('rem-prost') && (
              <rect x="1.5" y="1.5" width="47" height="47" rx="3.5" fill="none" stroke="#7c3aed" strokeWidth="2" strokeDasharray="3 2" />
            )}

            {/* Orthodontic anomalies */}
            {has('ortho-fracture') && (
              <path d="M 5,23 L 16,16 L 28,30 L 40,18 L 45,25" fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            )}
            {has('diastema') && (
              <g stroke="#0ea5e9" strokeWidth="2" fill="none" strokeLinecap="round">
                <path d="M 4,14 A 12 12 0 0 1 4,36" />
                <path d="M 46,14 A 12 12 0 0 0 46,36" />
              </g>
            )}
            {has('drifting') && (
              <g stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
                <line x1="12" y1="25" x2="38" y2="25" />
                <polyline points="30,19 38,25 30,31" />
              </g>
            )}
            {has('rotation') && (
              <g stroke="#ec4899" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
                <path d="M 14,25 A 14 14 0 1 1 36,32" />
                <polyline points="32,36 38,32 36,26" />
              </g>
            )}
            {has('fusion') && (
              <path
                d="M 12,25 C 12,18 20,18 25,25 C 30,32 38,32 38,25 C 38,18 30,18 25,25 C 20,32 12,32 12,25 Z"
                fill="none"
                stroke="#14b8a6"
                strokeWidth="2.2"
              />
            )}
            {/* Eruption and extrusion point occlusally, intrusion apically */}
            {(has('eruption') || has('extrusion')) && (
              <g
                stroke={has('extrusion') ? '#9333ea' : '#84cc16'}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              >
                {isUpper ? (
                  <>
                    <line x1="25" y1="12" x2="25" y2="38" />
                    <polyline points="19,30 25,38 31,30" />
                  </>
                ) : (
                  <>
                    <line x1="25" y1="38" x2="25" y2="12" />
                    <polyline points="19,20 25,12 31,20" />
                  </>
                )}
              </g>
            )}
            {has('intrusion') && (
              <g stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
                {isUpper ? (
                  <>
                    <line x1="25" y1="36" x2="25" y2="12" />
                    <polyline points="19,20 25,12 31,20" />
                  </>
                ) : (
                  <>
                    <line x1="25" y1="12" x2="25" y2="36" />
                    <polyline points="19,28 25,36 31,28" />
                  </>
                )}
              </g>
            )}
            {has('transposition') && (
              <g stroke="#f97316" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none">
                <line x1="10" y1="18" x2="40" y2="18" />
                <polyline points="34,13 40,18 34,23" />
                <line x1="40" y1="32" x2="10" y2="32" />
                <polyline points="16,27 10,32 16,37" />
              </g>
            )}
            {has('supernumerary') && (
              <g transform="translate(25,25)">
                <circle cx="0" cy="0" r="14" fill="#f3e8ff" stroke="#a855f7" strokeWidth="2" strokeDasharray="3 1.5" />
                <text x="0" y="4" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#a855f7" fontFamily="sans-serif">+S</text>
              </g>
            )}
            {has('bolt') && (
              <g transform="translate(25, 36) scale(0.65)" stroke="#334155" fill="#64748b">
                <circle cx="0" cy="-6" r="3.5" fill="#475569" stroke="#ffffff" strokeWidth="0.75" />
                <path d="M -4,0 L 4,0 L 3,3 L -3,3 Z M -3,3 L 3,3 L 2,6 L -2,6 Z M -2,6 L 2,6 L 1,9 L -1,9 Z M -1,9 L 1,9 L 0,12 Z" />
              </g>
            )}
            {has('fixed-ortho') && (
              <g transform="translate(25,25)" fill="#10b981" stroke="#ffffff" strokeWidth="0.5">
                <line x1="-22" y1="0" x2="22" y2="0" stroke="#10b981" strokeWidth="2" />
                <rect x="-5" y="-5" width="10" height="10" rx="2" />
                <line x1="-5" y1="0" x2="5" y2="0" strokeWidth="0.75" />
                <line x1="0" y1="-5" x2="0" y2="5" strokeWidth="0.75" />
              </g>
            )}
            {has('macrodontia') && (
              <circle cx="25" cy="25" r="23" fill="none" stroke="#f43f5e" strokeWidth="2.5" strokeDasharray="4 2" />
            )}
            {has('microdontia') && (
              <circle cx="25" cy="25" r="14" fill="none" stroke="#e11d48" strokeWidth="2" strokeDasharray="3 1.5" />
            )}
            {has('impacted-semi') && (
              <path d="M 5,25 A 20 20 0 0 1 45,25" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="3 2" />
            )}
            {has('ectopic') && (
              <g stroke="#06b6d4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
                <line x1="12" y1="38" x2="36" y2="14" />
                <polyline points="24,14 36,14 36,26" />
              </g>
            )}
            {has('impacted') && (
              <g>
                <path d="M 4,25 A 21 21 0 0 1 46,25" fill="none" stroke="#78350f" strokeWidth="3" strokeLinecap="round" strokeDasharray="3 2" />
                <circle cx="25" cy="25" r="23" fill="#78350f" fillOpacity="0.1" />
              </g>
            )}
            {has('rem-orthodo') && (
              <polygon points="25,4 46,42 4,42" fill="none" stroke="#16a34a" strokeWidth="2.2" strokeDasharray="4 2" />
            )}

            {/* Legacy conditions from older sessions */}
            {has('prosthesis') && <circle cx="25" cy="25" r="23" fill="none" stroke="#7c3aed" strokeWidth="2.5" />}
            {has('root-remnant') && (
              <g stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="25" cy="25" r="23" fill="none" strokeDasharray="2 2" />
                <line x1="20" y1={isUpper ? 4 : 30} x2="20" y2={isUpper ? 20 : 46} />
                <line x1="30" y1={isUpper ? 4 : 30} x2="30" y2={isUpper ? 20 : 46} />
              </g>
            )}
            {has('edentulism') && (
              <g stroke="#94a3b8" strokeWidth="2.5">
                <line x1="8" y1="20" x2="42" y2="20" />
                <line x1="8" y1="30" x2="42" y2="30" />
              </g>
            )}
          </g>
        </svg>
      </div>

      <div
        className={cn(
          'flex flex-col items-center text-center',
          compact
            ? 'pointer-events-none absolute left-1/2 top-full -translate-x-1/2'
            : cn('w-full', !isZoom && 'min-h-[16px]'),
        )}
      >
        {!isUpper && numberLabel}
        {!isUpper && mobilityBadge}

        {procs.length > 0 && !isMissing && (
          <div className={cn('flex max-w-[48px] flex-wrap justify-center gap-0.5 overflow-hidden', compact ? 'mt-0.5' : 'mt-1')}>
            {procs.slice(0, 2).map((id) => {
              const procedure = getProcedure(id);
              if (!procedure) return null;
              return (
                <span
                  key={id}
                  title={t(`procedures.${id}.label`)}
                  className={cn(
                    'rounded px-0.5 font-mono text-[8px] font-bold leading-none',
                    isAttentionProcedure(procedure)
                      ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400'
                      : 'bg-primary/10 text-primary dark:bg-foreground/10 dark:text-foreground',
                  )}
                >
                  {procedure.code}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export const OdontogramTooth = React.memo(OdontogramToothBase);
OdontogramTooth.displayName = 'OdontogramTooth';
