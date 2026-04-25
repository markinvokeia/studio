'use client';

import { cn } from '@/lib/utils';
import type { OdontogramCondition, OdontogramSurface, OdontogramToothState } from '@/lib/types';
import { CONDITION_MAP } from './condition-toolbar';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// FDI tooth names
const TOOTH_NAMES: Record<string, string> = {
  '18':'3er molar','17':'2do molar','16':'1er molar','15':'2do premolar','14':'1er premolar','13':'Canino','12':'Lateral','11':'Central',
  '21':'Central','22':'Lateral','23':'Canino','24':'1er premolar','25':'2do premolar','26':'1er molar','27':'2do molar','28':'3er molar',
  '48':'3er molar','47':'2do molar','46':'1er molar','45':'2do premolar','44':'1er premolar','43':'Canino','42':'Lateral','41':'Central',
  '31':'Central','32':'Lateral','33':'Canino','34':'1er premolar','35':'2do premolar','36':'1er molar','37':'2do molar','38':'3er molar',
};

const SURFACE_LABELS: Record<OdontogramSurface, string> = {
  top: 'V', center: 'O', bottom: 'L', left: 'M', right: 'D',
};
const SURFACE_TITLES: Record<OdontogramSurface, string> = {
  top: 'Vestibular', center: 'Oclusal/Incisal', bottom: 'Lingual/Palatino', left: 'Mesial', right: 'Distal',
};

function surfaceColor(condition?: OdontogramCondition): string {
  if (!condition) return 'transparent';
  return CONDITION_MAP[condition]?.color ?? '#e5e7eb';
}

// SVG geometry for 5 zones (viewBox 0 0 90 90)
const SURFACE_PATHS: Record<OdontogramSurface, string> = {
  top:    'M25,0 L65,0 L65,25 L25,25 Z',
  left:   'M0,25 L25,25 L25,65 L0,65 Z',
  center: 'M25,25 L65,25 L65,65 L25,65 Z',
  right:  'M65,25 L90,25 L90,65 L65,65 Z',
  bottom: 'M25,65 L65,65 L65,90 L25,90 Z',
};

const SURFACE_TEXT_POS: Record<OdontogramSurface, { x: number; y: number }> = {
  top:    { x: 45, y: 14 },
  left:   { x: 12, y: 47 },
  center: { x: 45, y: 47 },
  right:  { x: 78, y: 47 },
  bottom: { x: 45, y: 80 },
};

const SURFACES: OdontogramSurface[] = ['top', 'left', 'center', 'right', 'bottom'];

interface ToothDetailPanelProps {
  toothId: string;
  state: OdontogramToothState;
  activeTool: OdontogramCondition | null;
  readOnly?: boolean;
  onApply: (toothId: string, surface: OdontogramSurface | 'whole' | 'overlay', condition: OdontogramCondition | null) => void;
  onClearTooth: (toothId: string) => void;
  onClose: () => void;
}

export function ToothDetailPanel({
  toothId, state, activeTool, readOnly,
  onApply, onClearTooth, onClose,
}: ToothDetailPanelProps) {
  const t = useTranslations('DentalRecord');

  const toolDef = activeTool ? CONDITION_MAP[activeTool] : null;
  const isWholeTool = toolDef?.category === 'whole';
  const isOverlayTool = toolDef?.category === 'overlay';
  const isSurfaceTool = toolDef?.category === 'surface';

  function handleSurfaceClick(surface: OdontogramSurface) {
    if (readOnly || !activeTool) return;
    if (isSurfaceTool) {
      onApply(toothId, surface, activeTool);
    } else if (isWholeTool) {
      onApply(toothId, 'whole', activeTool);
    } else if (isOverlayTool) {
      onApply(toothId, 'overlay', activeTool);
    }
  }

  // Whole condition determines background tint
  const wholeDef = state.whole ? CONDITION_MAP[state.whole] : null;

  return (
    <div className="flex flex-col items-center gap-3 p-3 rounded-xl border bg-background shadow-sm min-w-[200px]">
      {/* Header */}
      <div className="flex items-center w-full gap-1.5">
        <span className="text-base font-bold text-foreground">{toothId}</span>
        <span className="text-xs text-muted-foreground">{TOOTH_NAMES[toothId] ?? ''}</span>
      </div>

      {/* Whole condition badge */}
      {state.whole && (
        <div
          className="w-full text-center text-xs font-semibold rounded-md py-0.5 text-white"
          style={{ backgroundColor: CONDITION_MAP[state.whole]?.color ?? '#6b7280' }}
        >
          {t(`conditions.${state.whole}`)}
        </div>
      )}

      {/* SVG cross diagram */}
      <div className="relative">
        <svg
          viewBox="0 0 90 90"
          className={cn(
            'w-36 h-36 rounded-lg',
            !readOnly && activeTool && 'cursor-pointer',
          )}
          style={{
            background: wholeDef
              ? `${wholeDef.color}18`
              : 'var(--muted)',
            border: wholeDef ? `2px solid ${wholeDef.color}44` : '2px solid var(--border)',
          }}
        >
          {/* Grid dividers */}
          <line x1="25" y1="0"  x2="25" y2="90" stroke="var(--border)" strokeWidth="0.5" />
          <line x1="65" y1="0"  x2="65" y2="90" stroke="var(--border)" strokeWidth="0.5" />
          <line x1="0"  y1="25" x2="90" y2="25" stroke="var(--border)" strokeWidth="0.5" />
          <line x1="0"  y1="65" x2="90" y2="65" stroke="var(--border)" strokeWidth="0.5" />

          {/* Surface zones */}
          {SURFACES.map((surface) => {
            const condition = state[surface];
            const fill = surfaceColor(condition);
            const isActive = !isOverlayTool && !isWholeTool && isSurfaceTool;

            return (
              <g key={surface} onClick={() => handleSurfaceClick(surface)}>
                <path
                  d={SURFACE_PATHS[surface]}
                  fill={fill !== 'transparent' ? fill : 'transparent'}
                  className={cn(
                    isActive && !readOnly && activeTool
                      ? 'hover:opacity-70 cursor-pointer'
                      : '',
                  )}
                />
                {/* Surface label */}
                <text
                  x={SURFACE_TEXT_POS[surface].x}
                  y={SURFACE_TEXT_POS[surface].y + 4}
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="600"
                  fill={condition ? '#fff' : 'var(--muted-foreground)'}
                  className="pointer-events-none select-none"
                >
                  {SURFACE_LABELS[surface]}
                </text>
              </g>
            );
          })}

          {/* Whole/overlay click overlay (transparent, full area) */}
          {(isWholeTool || isOverlayTool) && !readOnly && activeTool && (
            <rect
              x="0" y="0" width="90" height="90"
              fill="transparent"
              className="cursor-pointer"
              onClick={() => handleSurfaceClick('center')}
            />
          )}

          {/* Whole condition inner ring + symbol */}
          {wholeDef && (
            <>
              <circle cx="45" cy="45" r="37" fill="none" stroke={wholeDef.color} strokeWidth="3"
                strokeDasharray={state.whole === 'crown-tmp' ? '8,4' : undefined} />
              {state.whole === 'missing' && (
                <>
                  <line x1="14" y1="14" x2="76" y2="76" stroke={wholeDef.color} strokeWidth="2.5" strokeLinecap="round" />
                  <line x1="76" y1="14" x2="14" y2="76" stroke={wholeDef.color} strokeWidth="2.5" strokeLinecap="round" />
                </>
              )}
              {state.whole === 'implant' && (
                <>
                  <line x1="45" y1="10" x2="45" y2="80" stroke={wholeDef.color} strokeWidth="3" strokeLinecap="round" />
                  <line x1="28" y1="28" x2="62" y2="28" stroke={wholeDef.color} strokeWidth="2.5" strokeLinecap="round" />
                  <line x1="31" y1="44" x2="59" y2="44" stroke={wholeDef.color} strokeWidth="2" strokeLinecap="round" />
                </>
              )}
              {state.whole === 'endodontics' && (
                <circle cx="45" cy="45" r="12" fill={wholeDef.color} opacity="0.35" />
              )}
              {state.whole === 'edentulism' && (
                <>
                  <line x1="18" y1="38" x2="72" y2="38" stroke={wholeDef.color} strokeWidth="2.5" />
                  <line x1="18" y1="52" x2="72" y2="52" stroke={wholeDef.color} strokeWidth="2.5" />
                </>
              )}
              {state.whole === 'fixed-prosth' && (
                <line x1="8" y1="45" x2="82" y2="45" stroke={wholeDef.color} strokeWidth="4" strokeDasharray="7,3" />
              )}
            </>
          )}

          {/* Overlay symbols */}
          {state.overlays?.includes('fracture') && (
            <line x1="20" y1="5" x2="70" y2="85" stroke={CONDITION_MAP.fracture.color} strokeWidth="2" strokeLinecap="round" />
          )}
          {state.overlays?.includes('fixed-ortho') && (
            <>
              <rect x="32" y="40" width="26" height="10" rx="2" fill={CONDITION_MAP['fixed-ortho'].color} />
              <line x1="5"  y1="45" x2="32" y2="45" stroke={CONDITION_MAP['fixed-ortho'].color} strokeWidth="1.5" />
              <line x1="58" y1="45" x2="85" y2="45" stroke={CONDITION_MAP['fixed-ortho'].color} strokeWidth="1.5" />
            </>
          )}
          {state.overlays?.includes('post') && (
            <line x1="45" y1="30" x2="45" y2="75" stroke={CONDITION_MAP.post.color} strokeWidth="3" strokeLinecap="round" strokeDasharray="4,2" />
          )}
        </svg>
      </div>

      {/* Surface legend strip */}
      <div className="flex gap-1 text-[9px] text-muted-foreground w-full justify-center">
        {SURFACES.map((s) => (
          <div key={s} className="flex flex-col items-center gap-0.5">
            <span
              className="h-2.5 w-2.5 rounded-sm border"
              style={{ background: surfaceColor(state[s]) }}
            />
            <span>{SURFACE_LABELS[s]}</span>
          </div>
        ))}
      </div>

      {/* Overlays */}
      {state.overlays && state.overlays.length > 0 && (
        <div className="flex flex-wrap gap-1 justify-center">
          {state.overlays.map((ov) => (
            <Badge
              key={ov}
              variant="outline"
              className="text-[9px] px-1 py-0"
              style={{ borderColor: CONDITION_MAP[ov]?.color, color: CONDITION_MAP[ov]?.color }}
            >
              {t(`conditions.${ov}`)}
            </Badge>
          ))}
        </div>
      )}

      {/* Clear tooth button */}
      {!readOnly && (
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground hover:text-destructive h-6 px-2"
          onClick={() => onClearTooth(toothId)}
        >
          {t('clearTooth')}
        </Button>
      )}
    </div>
  );
}
