'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Ban, Brush, ChevronLeft, ChevronRight, Search, Trash2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

import { useHelpScope } from '@/components/help/help-scope';

import { composeHelpId } from '@/lib/help/help-id';
import { cn, formatUtcDateTime } from '@/lib/utils';

import type { OdontogramCondition, OdontogramMarkStatus, OdontogramProcedureCategory, OdontogramState, OdontogramSurface } from '@/lib/types';
import {
  CATEGORY_ORDER,
  conceptOf,
  FREQUENT_TILES,
  type FrequentTile,
  getProcedure,
  getToothKind,
  isTemporalTooth,
  PICKABLE_PROCEDURES,
  surfaceLetter,
} from './odontogram-catalog';
import { isInheritedMark, listToothMarks, type MarkSlot, type OdontogramMark } from './odontogram-state';
import { STATUS_COLOR } from './odontogram-tooth';
import { RING_POSITIONS, sectorPath, surfaceAt } from './tooth-geometry';

export const STATUS_ORDER: OdontogramMarkStatus[] = ['indicated', 'existing', 'done'];

const STATUS_CHIP: Record<OdontogramMarkStatus, string> = {
  indicated: 'bg-red-500/10 text-red-700 dark:text-red-300',
  existing: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
  done: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
};

export function StatusDot({ status, className }: { status: OdontogramMarkStatus; className?: string }) {
  return <span aria-hidden className={cn('inline-block h-2.5 w-2.5 shrink-0 rounded-full', className)} style={{ background: STATUS_COLOR[status] }} />;
}

/** Name of a condition as the professional thinks of it: "Corona", not "Corona protésica indicada" */
export function useConditionLabel() {
  const t = useTranslations('DentalRecord');
  return React.useCallback((id: OdontogramCondition, concept = false) => {
    const key = concept ? conceptOf(id) : null;
    if (key) return t(`inspector.concepts.${key}`);
    return getProcedure(id) ? t(`procedures.${id}.label`) : id;
  }, [t]);
}

const tileKey = (tile: FrequentTile) => tile.id;

export interface ToothInspectorProps {
  state: OdontogramState;
  /** The session this one starts from: its marks are voided, not deleted */
  previousState: OdontogramState | null;
  selectedTeeth: number[];
  selectedSurfaces: OdontogramSurface[];
  mode: OdontogramMarkStatus;
  readOnly: boolean;
  onModeChange: (mode: OdontogramMarkStatus) => void;
  onToggleSurface: (surface: OdontogramSurface) => void;
  onClearSurfaces: () => void;
  onApply: (condition: OdontogramCondition, fixedStatus?: OdontogramMarkStatus) => void;
  onBrush: (condition: OdontogramCondition, fixedStatus?: OdontogramMarkStatus) => void;
  onRemoveMark: (toothId: string, slot: MarkSlot) => void;
  onRequestVoid: (mark: OdontogramMark) => void;
  onChangeStatus: (toothId: string, slot: MarkSlot, status: OdontogramMarkStatus) => void;
  onNotesChange: (toothId: string, notes: string) => void;
  onSelectTooth: (tooth: number | null) => void;
  onNavigate: (delta: number) => void;
  /** Narrow column (300 px): the tiles go one per row */
  narrow?: boolean;
}

export function ToothInspector(props: ToothInspectorProps) {
  const { selectedTeeth } = props;
  if (selectedTeeth.length === 0) return <MouthOverview {...props} />;
  if (selectedTeeth.length > 1) return <MultiInspector {...props} />;
  return <SingleInspector {...props} tooth={selectedTeeth[0]} />;
}

function Section({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cn('flex flex-col gap-2.5 border-b px-4 py-3.5 last:border-b-0', className)}>{children}</section>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground">{children}</h3>;
}

function ModeSelector({ mode, onModeChange }: Pick<ToothInspectorProps, 'mode' | 'onModeChange'>) {
  const t = useTranslations('DentalRecord');
  const helpScope = useHelpScope();
  return (
    <div role="radiogroup" aria-label={t('inspector.recordAs')} className="grid grid-cols-3 gap-1 rounded-xl border bg-muted/60 p-[3px]" data-help-id={composeHelpId(helpScope, 'field', 'odontogram-record-as')}>
      {STATUS_ORDER.map((status) => (
        <button
          key={status}
          type="button"
          role="radio"
          aria-checked={mode === status}
          onClick={() => onModeChange(status)}
          className={cn(
            'inline-flex h-[34px] items-center justify-center gap-1.5 rounded-lg text-xs font-medium text-muted-foreground transition-colors',
            mode === status && 'bg-background font-semibold text-foreground shadow-sm',
          )}
        >
          <StatusDot status={status} />
          {t(`status.${status}`)}
        </button>
      ))}
    </div>
  );
}

function Tiles({ mode, needsSurface, narrow, onApply, onBrush }: { mode: OdontogramMarkStatus; needsSurface: boolean } & Pick<ToothInspectorProps, 'onApply' | 'onBrush' | 'narrow'>) {
  const t = useTranslations('DentalRecord');
  const helpScope = useHelpScope();
  return (
    <div className="grid grid-cols-2 gap-1.5" data-help-id={composeHelpId(helpScope, 'section', 'odontogram-tiles')}>
      {FREQUENT_TILES.map((tile) => {
        const procedure = getProcedure(tile.id);
        const bySurface = procedure?.appliesTo === 'surface';
        return (
          <div
            key={tileKey(tile)}
            role="button"
            tabIndex={0}
            onClick={() => onApply(tile.id, tile.fixedStatus)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onApply(tile.id, tile.fixedStatus); } }}
            title={bySurface ? t('inspector.bySurface') : undefined}
            className={cn(
              'flex h-[38px] min-w-0 cursor-pointer items-center rounded-xl border bg-card pr-1 font-medium', narrow ? 'gap-1.5 pl-2 text-[12.5px]' : 'gap-2 pl-2.5 text-[13px]', 'transition-colors hover:border-primary hover:bg-[var(--odo-sel)]',
              bySurface && needsSurface && 'opacity-60',
            )}
          >
            <StatusDot status={tile.fixedStatus ?? mode} />
            <span className="min-w-0 flex-1 truncate">{t(`inspector.tiles.${tile.id}`)}</span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onBrush(tile.id, tile.fixedStatus); }}
              className="grid h-6 w-5 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-primary/10 hover:text-primary"
              title={t('inspector.useAsBrush')}
              aria-label={t('inspector.useAsBrushFor', { condition: t(`inspector.tiles.${tile.id}`) })}
            >
              <Brush className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/** Height of the eight tiles (4 rows), kept by the search results so the inspector does not jump */
const PICKER_HEIGHT = 'h-[170px]';

/**
 * Search and categories on top; below, the frequent tiles or, while searching or filtering, the
 * results in the same space (scrolling inside), so the inspector keeps its height.
 */
function ConditionPicker({ mode, needsSurface, narrow, onApply, onBrush }: { mode: OdontogramMarkStatus; needsSurface: boolean } & Pick<ToothInspectorProps, 'onApply' | 'onBrush' | 'narrow'>) {
  const t = useTranslations('DentalRecord');
  const helpScope = useHelpScope();
  const label = useConditionLabel();
  const [query, setQuery] = React.useState('');
  const [category, setCategory] = React.useState<OdontogramProcedureCategory | null>(null);
  const q = query.trim().toLowerCase();
  const list = PICKABLE_PROCEDURES.filter((p) => {
    if (category && p.category !== category) return false;
    if (!q) return true;
    return label(p.id, true).toLowerCase().includes(q) || label(p.id).toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
  });

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('inspector.searchPlaceholder')}
          aria-label={t('inspector.searchPlaceholder')}
          className="h-9 pl-8 text-[13px]"
          data-help-id={composeHelpId(helpScope, 'field', 'odontogram-search')}
        />
      </div>
      <div className="flex flex-wrap gap-1">
        {(category || q) && (
          <button
            type="button"
            onClick={() => { setCategory(null); setQuery(''); }}
            className="inline-flex h-[26px] items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 text-xs font-medium text-primary"
          >
            <X className="h-3 w-3" />{t('inspector.backToFrequent')}
          </button>
        )}
        {CATEGORY_ORDER.map(({ id }) => (
          <button
            key={id}
            type="button"
            onClick={() => setCategory((c) => (c === id ? null : id))}
            aria-pressed={category === id}
            className={cn(
              'h-[26px] rounded-full border px-2.5 text-xs text-muted-foreground transition-colors',
              category === id ? 'border-foreground bg-foreground text-background' : 'bg-card hover:text-foreground',
            )}
          >
            {t(`categories.${id}`)}
          </button>
        ))}
      </div>
      {category || q ? (
        <div className={cn('flex flex-col gap-0.5 overflow-auto rounded-xl border p-1', PICKER_HEIGHT)}>
          {list.length ? list.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onApply(p.id)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-muted"
            >
              <StatusDot status={mode} />
              <span className="min-w-0 flex-1 truncate">{label(p.id, true)}</span>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {p.code} · {t(p.appliesTo === 'surface' ? 'inspector.scope.surface' : 'inspector.scope.tooth')}
              </span>
            </button>
          )) : <p className="px-2 py-1.5 text-xs text-muted-foreground">{t('inspector.noResults')}</p>}
        </div>
      ) : (
        <Tiles mode={mode} needsSurface={needsSurface} narrow={narrow} onApply={onApply} onBrush={onBrush} />
      )}
    </div>
  );
}

function SurfaceDiagram({ tooth, state, selectedSurfaces, readOnly, onToggleSurface }: { tooth: number } & Pick<ToothInspectorProps, 'state' | 'selectedSurfaces' | 'readOnly' | 'onToggleSurface'>) {
  const t = useTranslations('DentalRecord');
  const marks = listToothMarks(String(tooth), state[String(tooth)]);
  const colorOf = (surface: OdontogramSurface) => {
    const m = marks.find((x) => x.surface === surface);
    return m ? STATUS_COLOR[m.status] : undefined;
  };
  const labelPos = { top: [0, -40], right: [42, 4], bottom: [0, 47], left: [-42, 4] } as const;
  const style = (surface: OdontogramSurface) => {
    const on = selectedSurfaces.includes(surface);
    return {
      fill: colorOf(surface) ?? 'var(--odo-surf)',
      stroke: on ? 'hsl(var(--primary))' : 'var(--odo-tooth-line)',
      strokeWidth: on ? 3.5 : 1.1,
    };
  };
  const toggle = (surface: OdontogramSurface) => () => { if (!readOnly) onToggleSurface(surface); };

  return (
    <svg viewBox="-66 -66 132 132" className="h-28 w-28 shrink-0" role="group" aria-label={t('inspector.surfacesOf', { tooth })}>
      {RING_POSITIONS.map((position) => {
        const surface = surfaceAt(tooth, position);
        return (
          <path key={position} d={sectorPath(0, 0, 24, 60, position)} style={style(surface)} onClick={toggle(surface)} className={cn(!readOnly && 'cursor-pointer hover:[stroke:hsl(var(--primary))]')}>
            <title>{t(`surfaces.${surface}`)}</title>
          </path>
        );
      })}
      <circle r="24" style={style('center')} onClick={toggle('center')} className={cn(!readOnly && 'cursor-pointer hover:[stroke:hsl(var(--primary))]')}>
        <title>{t('surfaces.center')}</title>
      </circle>
      {RING_POSITIONS.map((position) => {
        const surface = surfaceAt(tooth, position);
        return (
          <text key={position} x={labelPos[position][0]} y={labelPos[position][1]} textAnchor="middle" className="pointer-events-none" style={{ fontSize: 13, fontWeight: 700, fill: colorOf(surface) ? '#fff' : 'hsl(var(--muted-foreground))' }}>
            {surfaceLetter(tooth, surface)}
          </text>
        );
      })}
      <text x="0" y="5" textAnchor="middle" className="pointer-events-none" style={{ fontSize: 13, fontWeight: 700, fill: colorOf('center') ? '#fff' : 'hsl(var(--muted-foreground))' }}>
        {surfaceLetter(tooth, 'center')}
      </text>
    </svg>
  );
}

function MarkRow({ mark, inherited, readOnly, showTooth, onRemove, onVoid, onChangeStatus, onSelectTooth }: {
  mark: OdontogramMark;
  inherited: boolean;
  readOnly: boolean;
  showTooth?: boolean;
  onRemove: () => void;
  onVoid: () => void;
  onChangeStatus: (status: OdontogramMarkStatus) => void;
  onSelectTooth?: () => void;
}) {
  const t = useTranslations('DentalRecord');
  const label = useConditionLabel();
  const tooth = Number(mark.toothId);
  const next = STATUS_ORDER[(STATUS_ORDER.indexOf(mark.status) + 1) % STATUS_ORDER.length];
  return (
    <div className="flex items-center gap-2 rounded-xl border py-2 pl-2.5 pr-2 text-[13px]">
      <StatusDot status={mark.status} />
      <button type="button" onClick={onSelectTooth} disabled={!onSelectTooth} className="min-w-0 flex-1 text-left disabled:cursor-default">
        <span className="block truncate">
          {showTooth && <b className="font-semibold">{mark.toothId} · </b>}
          {label(mark.condition, true)}
          {mark.surface && <b className="ml-1 font-semibold">{surfaceLetter(tooth, mark.surface)}</b>}
        </span>
        <span className="block text-[11.5px] text-muted-foreground">
          {inherited ? t('inspector.fromEarlier') : t('inspector.fromToday')}
          {mark.meta?.at ? ` · ${formatUtcDateTime(mark.meta.at)}` : ''}
          {mark.meta?.src === 'voice' ? ` · ${t('inspector.dictated')}` : mark.meta?.src === 'agent' ? ` · ${t('inspector.byAgent')}` : ''}
        </span>
      </button>
      {readOnly ? (
        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', STATUS_CHIP[mark.status])}>{t(`status.${mark.status}`)}</span>
      ) : (
        <>
          <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-[11.5px]" onClick={() => onChangeStatus(next)} title={t('inspector.changeStatusTo', { status: t(`status.${next}`) })}>
            <StatusDot status={mark.status} className="mr-1 h-2 w-2" />
            {t(`status.${mark.status}`)}
          </Button>
          {inherited ? (
            <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={onVoid} title={t('inspector.void')} aria-label={t('inspector.void')}>
              <Ban className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={onRemove} title={t('inspector.remove')} aria-label={t('inspector.remove')}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </>
      )}
    </div>
  );
}

function SingleInspector(props: ToothInspectorProps & { tooth: number }) {
  const { tooth, state, previousState, selectedSurfaces, mode, readOnly } = props;
  const t = useTranslations('DentalRecord');
  const label = useConditionLabel();
  const toothState = state[String(tooth)];
  const marks = listToothMarks(String(tooth), toothState);
  const kind = getToothKind(tooth);
  const quadrant = Math.floor(tooth / 10);
  const chosen = selectedSurfaces.map((s) => t(`surfaces.${s}`)).join(', ');

  return (
    <>
      <Section>
        <div className="flex items-center gap-2.5">
          <span className="inline-grid h-7 min-w-[34px] place-items-center rounded-lg bg-primary px-1.5 text-[13px] font-bold text-primary-foreground">{tooth}</span>
          <div className="min-w-0 flex-1">
            <b className="block truncate text-[15px] font-semibold leading-tight">
              {kind ? t(`toothNames.${kind}`) : t('board.piece', { tooth })}
              {isTemporalTooth(tooth) ? ` ${t('inspector.temporalSuffix')}` : ''}
            </b>
            <small className="text-xs text-muted-foreground">{t(`inspector.position.q${quadrant}`)}</small>
          </div>
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => props.onNavigate(-1)} aria-label={t('inspector.prevTooth')} title={t('inspector.prevTooth')}><ChevronLeft className="h-4 w-4" /></Button>
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => props.onNavigate(1)} aria-label={t('inspector.nextTooth')} title={t('inspector.nextTooth')}><ChevronRight className="h-4 w-4" /></Button>
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => props.onSelectTooth(null)} aria-label={t('inspector.close')} title={t('inspector.close')}><X className="h-4 w-4" /></Button>
        </div>

        <div className="flex items-center gap-3.5">
          <SurfaceDiagram tooth={tooth} state={state} selectedSurfaces={selectedSurfaces} readOnly={readOnly} onToggleSurface={props.onToggleSurface} />
          <div className="flex min-w-0 flex-col gap-1.5 text-xs text-muted-foreground">
            {chosen ? (
              <>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">{t('inspector.chosenSurfaces', { surfaces: chosen })}</span>
                {!readOnly && <Button type="button" size="sm" variant="outline" className="h-7 self-start text-xs" onClick={props.onClearSurfaces}>{t('inspector.clearSurfaces')}</Button>}
              </>
            ) : (
              <span>{readOnly ? t('inspector.readOnlyHint') : t('inspector.surfacesHint')}</span>
            )}
          </div>
        </div>

        {!readOnly && (
          <>
            <ModeSelector mode={mode} onModeChange={props.onModeChange} />
            <ConditionPicker mode={mode} needsSurface={selectedSurfaces.length === 0} narrow={props.narrow} onApply={props.onApply} onBrush={props.onBrush} />
          </>
        )}
      </Section>

      <Section>
        <SectionTitle>{t('inspector.onThisTooth')}</SectionTitle>
        <div className="flex flex-col gap-1.5">
          {marks.length ? marks.map((mark) => (
            <MarkRow
              key={mark.slot}
              mark={mark}
              inherited={isInheritedMark(previousState, mark)}
              readOnly={readOnly}
              onRemove={() => props.onRemoveMark(mark.toothId, mark.slot)}
              onVoid={() => props.onRequestVoid(mark)}
              onChangeStatus={(status) => props.onChangeStatus(mark.toothId, mark.slot, status)}
            />
          )) : <p className="text-xs text-muted-foreground">{t('inspector.healthy')}</p>}
          {toothState?.voided?.map((v, i) => (
            <div key={`${v.slot}-${i}`} className="flex items-start gap-2 rounded-xl border border-dashed py-2 pl-2.5 pr-2 text-[13px] text-muted-foreground">
              <Ban className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0">
                <span className="line-through">{label(v.condition, true)}</span>
                <span className="block text-[11.5px]">{t('inspector.voidedAt', { date: formatUtcDateTime(v.at), reason: v.reason })}</span>
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section>
        <SectionTitle>{t('inspector.toothNotes')}</SectionTitle>
        <Textarea
          rows={2}
          value={toothState?.notes ?? ''}
          readOnly={readOnly}
          onChange={(e) => props.onNotesChange(String(tooth), e.target.value)}
          placeholder={t('inspector.toothNotesPlaceholder', { tooth })}
          className="text-[13px]"
        />
      </Section>
    </>
  );
}

function MultiInspector(props: ToothInspectorProps) {
  const t = useTranslations('DentalRecord');
  const sorted = [...props.selectedTeeth].sort((a, b) => a - b);
  return (
    <Section>
      <div className="flex items-center gap-2.5">
        <span className="inline-grid h-7 min-w-[34px] place-items-center rounded-lg bg-primary px-1.5 text-[13px] font-bold text-primary-foreground">{sorted.length}</span>
        <div className="min-w-0 flex-1">
          <b className="block truncate text-[15px] font-semibold leading-tight">{t('inspector.multiTitle', { teeth: sorted.join(', ') })}</b>
          <small className="text-xs text-muted-foreground">{t('inspector.multiHint')}</small>
        </div>
        <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => props.onSelectTooth(null)} aria-label={t('inspector.close')}><X className="h-4 w-4" /></Button>
      </div>
      {!props.readOnly && (
        <>
          <ModeSelector mode={props.mode} onModeChange={props.onModeChange} />
          <ConditionPicker mode={props.mode} needsSurface={props.selectedSurfaces.length === 0} narrow={props.narrow} onApply={props.onApply} onBrush={props.onBrush} />
          <p className="text-xs text-muted-foreground">{t('inspector.multiSurfacesHint')}</p>
        </>
      )}
    </Section>
  );
}

function MouthOverview({ state, previousState, readOnly, onSelectTooth }: ToothInspectorProps) {
  const t = useTranslations('DentalRecord');
  const label = useConditionLabel();
  const teeth = Object.keys(state)
    .map((id) => ({ id, marks: listToothMarks(id, state[id]) }))
    .filter((x) => x.marks.length > 0)
    .sort((a, b) => Number(a.id) - Number(b.id));
  const newToday = teeth.flatMap((x) => x.marks).filter((m) => !isInheritedMark(previousState, m)).length;

  return (
    <>
      <Section>
        <div className="flex items-center gap-2">
          <SectionTitle>{t('inspector.mouthState')}</SectionTitle>
          <span className="ml-auto text-xs text-muted-foreground">{t('inspector.teethWithMarks', { count: teeth.length })}</span>
        </div>
        {teeth.length ? (
          <div className="flex flex-col gap-0.5">
            {teeth.map(({ id, marks }) => (
              <button key={id} type="button" onClick={() => onSelectTooth(Number(id))} className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] hover:bg-muted">
                <span className="inline-grid h-6 min-w-[30px] shrink-0 place-items-center rounded-lg bg-primary/10 px-1.5 text-xs font-bold text-primary">{id}</span>
                <span className="flex flex-wrap gap-1">
                  {marks.map((m) => (
                    <span key={m.slot} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11.5px]">
                      <StatusDot status={m.status} className="h-[7px] w-[7px]" />
                      {label(m.condition, true)}{m.surface ? ` ${surfaceLetter(Number(id), m.surface)}` : ''}
                    </span>
                  ))}
                </span>
              </button>
            ))}
          </div>
        ) : <p className="text-xs text-muted-foreground">{t('inspector.emptyMouth')}</p>}
        {!readOnly && <p className="text-xs text-muted-foreground">{t('inspector.changesToday', { count: newToday })}</p>}
      </Section>
      {!readOnly && (
        <Section>
          <div className="rounded-xl bg-primary/10 px-3 py-2.5 text-[12.5px] text-primary dark:text-foreground">
            <b>{t('inspector.tipTitle')}</b> {t('inspector.tip')}
          </div>
        </Section>
      )}
    </>
  );
}
