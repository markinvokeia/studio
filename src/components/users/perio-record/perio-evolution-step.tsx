'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, ArrowRight, ChartSpline, Map as MapIcon, Pause, Play } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { SEXTANT_ORDER, SEXTANTS } from '@/lib/perio/assess';
import { interpolateTeeth, significantChanges, siteChanges, type SiteChange } from '@/lib/perio/compare';
import { computeStats } from '@/lib/perio/stats';
import { isUpperPerio } from '@/lib/perio/teeth';
import { cn, formatDisplayDate } from '@/lib/utils';

import type { PerioExamType, PerioScreening, PerioStats, PerioTooth } from '@/lib/types';
import { PerioArch } from './perio-arch';
import { PerioMap } from './perio-map';
import { FooterSpacer, PerioStepFooter } from './perio-step-footer';

/** Each step of the animation, between two sessions */
const PLAY_SEGMENT_MS = 1500;
/** Changes listed under "Mejoraron" before "and N more" */
const BETTER_SHOWN = 6;

type Mode = 'slider' | 'overlay' | 'diff';
type View = 'curves' | 'map';
type ArchFocus = 'U' | 'L' | 'both';

export interface PerioSession {
  id: string;
  date: string;
  examType: PerioExamType;
  teeth: PerioTooth[];
  screening?: PerioScreening | null;
}

export interface PerioEvolutionStepProps {
  /** Earlier exams of the patient, oldest first */
  earlier: PerioSession[];
  /** The exam open in the sheet ("Hoy") */
  today: PerioSession;
  /** Exam compared at first (from "Comparar con hoy" in the history); by default the initial one */
  initialBaseId?: string | null;
  onBackToProbe: () => void;
  onNext: () => void;
}

export function PerioEvolutionStep({ earlier, today, initialBaseId, onBackToProbe, onNext }: PerioEvolutionStepProps) {
  const t = useTranslations('PerioRecord');
  const defaultBase = (initialBaseId && earlier.find((e) => e.id === initialBaseId)) || earlier.find((e) => e.examType === 'initial') || earlier[0];
  const [baseId, setBaseId] = React.useState<string | undefined>(defaultBase?.id);
  const [mode, setMode] = React.useState<Mode>('slider');
  const [view, setView] = React.useState<View>('curves');
  const [arch, setArch] = React.useState<ArchFocus>('both');
  const [selectedTooth, setSelectedTooth] = React.useState<number | null>(null);
  const [play, setPlay] = React.useState<number | null>(null);

  const base = earlier.find((e) => e.id === baseId) ?? defaultBase;
  const sessions = React.useMemo(() => [...earlier, today], [earlier, today]);
  const series = React.useMemo(() => sessions.map((s) => computeStats(s.teeth)), [sessions]);
  const changes = React.useMemo(() => (base ? significantChanges(siteChanges(today.teeth, base.teeth)) : { worse: [], better: [] }), [base, today.teeth]);

  // ── Animation: from the compared exam to today, one session after the other ──
  const playFrom = base ? sessions.findIndex((s) => s.id === base.id) : 0;
  const rafRef = React.useRef<number | null>(null);
  const stopPlay = React.useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setPlay(null);
  }, []);
  const startPlay = () => {
    const segments = sessions.length - 1 - playFrom;
    if (segments <= 0) return;
    const started = performance.now();
    let lastFrame = 0;
    const tick = (now: number) => {
      const p = (now - started) / PLAY_SEGMENT_MS;
      if (p >= segments) { stopPlay(); return; }
      // About 30 frames a second is enough for the curves and keeps the tablet free
      if (now - lastFrame > 33) { lastFrame = now; setPlay(p); }
      rafRef.current = requestAnimationFrame(tick);
    };
    setPlay(0);
    rafRef.current = requestAnimationFrame(tick);
  };
  React.useEffect(() => () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); }, []);

  const playFrame = React.useMemo(() => {
    if (play == null) return null;
    const k = Math.min(sessions.length - 2, playFrom + Math.floor(play));
    const f = Math.min(1, play - Math.floor(play));
    const a = sessions[k];
    const b = sessions[k + 1];
    return { teeth: interpolateTeeth(a.teeth, b.teeth, f), label: f > 0.5 ? b : a };
  }, [play, playFrom, sessions]);

  if (today.examType === 'screening') return <ScreeningEvolution earlier={earlier} today={today} onBack={onBackToProbe} onNext={onNext} />;

  if (!base) {
    return (
      <div className="mx-auto flex w-full max-w-[720px] flex-col items-center gap-3 p-8 text-center">
        <ChartSpline className="h-10 w-10 text-muted-foreground" />
        <h2 className="text-lg font-semibold">{t('evolution.empty.title')}</h2>
        <p className="max-w-[52ch] text-sm text-muted-foreground">{t('evolution.empty.description')}</p>
        <EvolutionFooter onBack={onBackToProbe} onNext={onNext} />
      </div>
    );
  }

  const baseLabel = t(`examTypes.${base.examType}`);
  const arches: ('U' | 'L')[] = arch === 'both' ? ['U', 'L'] : [arch];
  const pick = (c: SiteChange) => { setSelectedTooth(c.tooth); if (arch !== 'both') setArch(isUpperPerio(c.tooth) ? 'U' : 'L'); };
  const leadKey = playFrame ? 'play' : view === 'map' ? 'map' : mode;

  return (
    <div className="grid min-h-0 gap-3 p-3 xl:h-full xl:grid-cols-[minmax(0,1fr)_330px] xl:grid-rows-[minmax(0,1fr)]">
      <section className="flex min-h-0 min-w-0 flex-col gap-2.5">
        <div>
          <h2 className="text-lg font-semibold">{t('evolution.title', { date: formatDisplayDate(base.date) })}</h2>
          <p className="mt-0.5 max-w-[80ch] text-[13px] text-muted-foreground">{t(`evolution.lead.${leadKey}`, { date: formatDisplayDate(base.date) })}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {view === 'curves' && <Segmented label={t('evolution.modesLabel')} value={mode} options={[['slider', t('evolution.modes.slider')], ['overlay', t('evolution.modes.overlay')], ['diff', t('evolution.modes.diff')]]} onChange={(m) => { stopPlay(); setMode(m); }} />}
          <Button type="button" size="sm" variant="outline" className="h-8" onClick={play == null ? startPlay : stopPlay} disabled={sessions.length - 1 - playFrom <= 0}>
            {play == null ? <Play className="mr-1.5 h-3.5 w-3.5" /> : <Pause className="mr-1.5 h-3.5 w-3.5" />}
            {play == null ? t('evolution.play') : t('evolution.pause')}
          </Button>
          <div className="ml-auto flex flex-wrap gap-2">
            <Segmented label={t('probe.focus.label')} value={arch} options={[['U', t('probe.focus.U')], ['L', t('probe.focus.L')], ['both', t('probe.focus.both')]]} onChange={setArch} />
            <Segmented label={t('evolution.viewLabel')} value={view} options={[['curves', <><ChartSpline className="h-3.5 w-3.5" />{t('evolution.views.curves')}</>], ['map', <><MapIcon className="h-3.5 w-3.5" />{t('evolution.views.map')}</>]]} onChange={(v) => { stopPlay(); setView(v); }} />
          </div>
        </div>

        <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border bg-card">
          <div className="relative min-h-0 flex-1 overflow-auto px-2.5 pb-2">
            {playFrame && (
              <span className="pointer-events-none absolute right-4 top-2 z-10 rounded-xl bg-foreground px-3 py-1.5 text-[13px] font-semibold text-background">
                {playFrame.label.id === today.id ? t('evolution.tagToday', { date: formatDisplayDate(today.date) }) : t('evolution.tagBase', { exam: t(`examTypes.${playFrame.label.examType}`), date: formatDisplayDate(playFrame.label.date) })}
              </span>
            )}
            {view === 'map' ? (
              <div className={cn('grid gap-3 py-2', arches.length > 1 && 'md:grid-cols-2')}>
                {arches.map((a) => (
                  <PerioMap key={a} arch={a} teeth={playFrame?.teeth ?? today.teeth} base={playFrame ? null : base.teeth} selectedTooth={selectedTooth} onToothClick={setSelectedTooth} />
                ))}
              </div>
            ) : playFrame ? (
              <div className="flex min-w-[760px] flex-col">
                {arches.map((a) => <ArchBlock key={a} arch={a}><PerioArch arch={a} teeth={playFrame.teeth} selectedTooth={selectedTooth} /></ArchBlock>)}
              </div>
            ) : mode === 'slider' ? (
              <CompareSlider
                arches={arches}
                base={base.teeth}
                today={today.teeth}
                baseTag={t('evolution.tagBase', { exam: baseLabel, date: formatDisplayDate(base.date) })}
                todayTag={t('evolution.tagToday', { date: formatDisplayDate(today.date) })}
                handleLabel={t('evolution.handle')}
              />
            ) : (
              <div className="flex min-w-[760px] flex-col">
                {arches.map((a) => (
                  <ArchBlock key={a} arch={a}>
                    <PerioArch arch={a} teeth={today.teeth} compare={{ base: base.teeth, mode }} selectedTooth={selectedTooth} onToothClick={setSelectedTooth} />
                  </ArchBlock>
                ))}
              </div>
            )}
          </div>
          <EvolutionLegend mode={view === 'map' ? 'map' : mode} />
          <div className="border-t px-3 py-2.5">
            <h3 className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground">{t('evolution.compareWith')}</h3>
            <div className="flex items-start overflow-x-auto pb-1" role="radiogroup" aria-label={t('evolution.compareWith')}>
              {sessions.map((s, j) => {
                const isToday = s.id === today.id;
                const on = s.id === base.id;
                return (
                  <React.Fragment key={s.id}>
                    {j > 0 && <span className="mt-[7px] h-0.5 min-w-5 flex-1 bg-border" aria-hidden />}
                    <button
                      type="button"
                      role="radio"
                      aria-checked={on}
                      disabled={isToday}
                      onClick={() => { stopPlay(); setBaseId(s.id); }}
                      className={cn('flex shrink-0 flex-col items-center gap-1 px-1.5 text-center text-[12px] text-muted-foreground disabled:cursor-default', on && 'font-semibold text-foreground')}
                    >
                      <span className={cn('h-4 w-4 rounded-full border-2 bg-card', on ? 'border-primary bg-primary' : isToday ? 'border-pink-500 bg-pink-500' : 'border-muted-foreground/40')} aria-hidden />
                      {isToday ? t('evolution.today') : t(`examTypes.${s.examType}`)}
                      <small className="text-[11px] font-normal text-muted-foreground">{t('evolution.nodeBop', { date: formatDisplayDate(s.date), value: series[j].bopPct })}</small>
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>

        <EvolutionFooter onBack={onBackToProbe} onNext={onNext} />
      </section>

      <aside className="flex min-h-0 flex-col overflow-auto rounded-2xl border bg-card">
        <section className="flex flex-col border-b px-3.5 py-3">
          <h3 className="mb-1 text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground">{t('evolution.trends.title')}</h3>
          {(['bopPct', 'plaquePct', 'n5', 'meanPd', 'meanCal'] as const).map((key) => (
            <Trend key={key} statKey={key} series={series} baseIndex={sessions.findIndex((s) => s.id === base.id)} baseDate={base.date} />
          ))}
        </section>
        <ChangeList title={t('evolution.worse', { count: changes.worse.length })} empty={t('evolution.noWorse')} items={changes.worse} tone="worse" onPick={pick} selectedTooth={selectedTooth} />
        <ChangeList title={t('evolution.better', { count: changes.better.length })} empty={t('evolution.noBetter')} items={changes.better.slice(0, BETTER_SHOWN)} more={Math.max(0, changes.better.length - BETTER_SHOWN)} tone="better" onPick={pick} selectedTooth={selectedTooth} />
        <section className="px-3.5 py-3">
          <p className="rounded-xl bg-muted/60 px-3 py-2 text-[12px] text-muted-foreground">{t('evolution.note')}</p>
        </section>
      </aside>
    </div>
  );
}

/** A screening has no curves: its sextant codes, session after session */
function ScreeningEvolution({ earlier, today, onBack, onNext }: { earlier: PerioSession[]; today: PerioSession; onBack: () => void; onNext: () => void }) {
  const t = useTranslations('PerioRecord');
  const rows = [...earlier.filter((e) => e.screening), today];
  return (
    <div className="mx-auto flex w-full max-w-[900px] flex-col gap-3 p-4">
      <div>
        <h2 className="text-lg font-semibold">{t('evolution.screening.title')}</h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">{t('evolution.screening.lead')}</p>
      </div>
      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b text-left text-[11.5px] uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2 font-semibold">{t('evolution.screening.session')}</th>
              {SEXTANT_ORDER.map((x) => <th key={x} className="px-2 py-2 text-center font-semibold" title={`${SEXTANTS[x][0]}–${SEXTANTS[x].at(-1)}`}>{t('screening.sextantShort', { n: x })}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={cn('border-b last:border-b-0', r.id === today.id && 'bg-primary/5 font-semibold')}>
                <td className="px-3 py-2">{r.id === today.id ? t('evolution.today') : t(`examTypes.${r.examType}`)} · {formatDisplayDate(r.date)}</td>
                {SEXTANT_ORDER.map((x) => {
                  const code = r.screening?.codes[x];
                  return <td key={x} className="px-2 py-2 text-center tabular-nums">{code ?? '–'}{r.screening?.star?.includes(x) ? '*' : ''}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 1 && <p className="text-[12.5px] text-muted-foreground">{t('evolution.screening.first')}</p>}
      <EvolutionFooter onBack={onBack} onNext={onNext} />
    </div>
  );
}

function EvolutionFooter({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const t = useTranslations('PerioRecord.evolution');
  return (
    <PerioStepFooter>
      <FooterSpacer />
      <Button type="button" variant="outline" onClick={onBack}><ArrowLeft className="mr-1.5 h-4 w-4" />{t('backToProbe')}</Button>
      <Button type="button" onClick={onNext}>{t('next')}<ArrowRight className="ml-1.5 h-4 w-4" /></Button>
    </PerioStepFooter>
  );
}

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, React.ReactNode][]; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex gap-0.5 rounded-[11px] border bg-muted/60 p-0.5">
      {options.map(([k, l]) => (
        <button key={k} type="button" role="radio" aria-checked={value === k} onClick={() => onChange(k)} className={cn('inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-[9px] px-2.5 text-[12.5px] font-medium text-muted-foreground', value === k && 'bg-background font-semibold text-foreground shadow-sm')}>
          {l}
        </button>
      ))}
    </div>
  );
}

function ArchBlock({ arch, children }: { arch: 'U' | 'L'; children: React.ReactNode }) {
  const t = useTranslations('PerioRecord.chart');
  return (
    <>
      <div className="flex items-center gap-2 px-0.5 pb-0.5 pt-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground after:flex-1 after:border-t">
        {t(arch === 'U' ? 'upperArch' : 'lowerArch')}
      </div>
      {children}
    </>
  );
}

/**
 * Before and after under one handle: the earlier exam on the left of it, today on the right.
 * Dragging only changes the clip of the two layers (no re-render), so it stays smooth on a tablet.
 */
function CompareSlider({ arches, base, today, baseTag, todayTag, handleLabel }: { arches: ('U' | 'L')[]; base: PerioTooth[]; today: PerioTooth[]; baseTag: string; todayTag: string; handleLabel: string }) {
  const boxRef = React.useRef<HTMLDivElement>(null);
  const baseRef = React.useRef<HTMLDivElement>(null);
  const todayRef = React.useRef<HTMLDivElement>(null);
  const handleRef = React.useRef<HTMLDivElement>(null);
  const posRef = React.useRef(50);
  const dragging = React.useRef(false);

  const apply = (pos: number) => {
    posRef.current = Math.max(2, Math.min(98, pos));
    const p = posRef.current;
    if (baseRef.current) baseRef.current.style.clipPath = `inset(0 ${100 - p}% 0 0)`;
    if (todayRef.current) todayRef.current.style.clipPath = `inset(0 0 0 ${p}%)`;
    if (handleRef.current) { handleRef.current.style.left = `${p}%`; handleRef.current.setAttribute('aria-valuenow', String(Math.round(p))); }
  };
  const fromPointer = (clientX: number) => {
    const r = boxRef.current?.getBoundingClientRect();
    if (r && r.width) apply(((clientX - r.left) / r.width) * 100);
  };

  const layer = (teeth: PerioTooth[]) => arches.map((a) => <ArchBlock key={a} arch={a}><PerioArch arch={a} teeth={teeth} /></ArchBlock>);

  return (
    <div className="min-w-[760px] pt-9">
      <div
        ref={boxRef}
        className="relative cursor-ew-resize touch-pan-y select-none"
        onPointerDown={(e) => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); fromPointer(e.clientX); }}
        onPointerMove={(e) => { if (dragging.current) fromPointer(e.clientX); }}
        onPointerUp={() => { dragging.current = false; }}
        onPointerCancel={() => { dragging.current = false; }}
      >
        <div ref={todayRef} style={{ clipPath: 'inset(0 0 0 50%)' }}>{layer(today)}</div>
        <div ref={baseRef} className="absolute inset-0" style={{ clipPath: 'inset(0 50% 0 0)' }}>{layer(base)}</div>
        <span className="pointer-events-none absolute -top-8 left-2 z-[4] whitespace-nowrap rounded-full bg-foreground/80 px-2.5 py-1 text-[11.5px] font-medium text-background">{baseTag}</span>
        <span className="pointer-events-none absolute -top-8 right-2 z-[4] whitespace-nowrap rounded-full bg-foreground/80 px-2.5 py-1 text-[11.5px] font-medium text-background">{todayTag}</span>
        <div
          ref={handleRef}
          role="slider"
          tabIndex={0}
          aria-label={handleLabel}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={50}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); apply(posRef.current + (e.key === 'ArrowLeft' ? -4 : 4)); }
          }}
          className="absolute -top-2 bottom-0 z-[3] w-0.5 -translate-x-1/2 bg-primary focus-visible:outline-none"
          style={{ left: '50%' }}
        >
          <span className="absolute left-1/2 top-1/2 grid h-[38px] w-[38px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-primary bg-card text-[15px] font-bold text-primary shadow-md">⇆</span>
        </div>
      </div>
    </div>
  );
}

const STAT_FORMAT: Record<'bopPct' | 'plaquePct' | 'n5' | 'meanPd' | 'meanCal', (v: number | null) => string> = {
  bopPct: (v) => `${Math.round(v ?? 0)}%`,
  plaquePct: (v) => `${Math.round(v ?? 0)}%`,
  n5: (v) => String(Math.round(v ?? 0)),
  meanPd: (v) => (v == null ? '–' : `${v.toFixed(1)} mm`),
  meanCal: (v) => (v == null ? '–' : `${v.toFixed(1)} mm`),
};
const STAT_LABEL = { bopPct: 'bop', plaquePct: 'plaque', n5: 'n5', meanPd: 'meanPd', meanCal: 'meanCal' } as const;
const STAT_COLOR = { bopPct: 'var(--perio-bop)', plaquePct: 'var(--perio-pl)', n5: 'var(--perio-s5)', meanPd: 'var(--perio-pd)', meanCal: 'hsl(var(--primary))' } as const;

/** One index over the sessions: today's value, its change against the compared exam (lower is better) and a sparkline */
function Trend({ statKey, series, baseIndex, baseDate }: { statKey: keyof typeof STAT_FORMAT; series: PerioStats[]; baseIndex: number; baseDate: string }) {
  const t = useTranslations('PerioRecord.evolution');
  const values = series.map((s) => s[statKey]);
  const now = values[values.length - 1];
  const then = values[baseIndex];
  const d = now != null && then != null ? Math.round((now - then) * 10) / 10 : null;
  const format = STAT_FORMAT[statKey];
  const numeric = values.map((v) => v ?? 0);
  const min = Math.min(...numeric);
  const max = Math.max(...numeric);
  const x = (i: number) => (values.length === 1 ? 50 : 4 + (i * 92) / (values.length - 1));
  const y = (v: number) => (max === min ? 17 : 30 - ((v - min) / (max - min)) * 26);
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-2.5 border-b border-dashed py-2 last:border-b-0">
      <div className="min-w-0">
        <b className="block text-[13px] font-semibold">{t(`trends.${STAT_LABEL[statKey]}`)}</b>
        <small className="text-[11.5px] text-muted-foreground">{t('trends.from', { date: formatDisplayDate(baseDate), value: format(then) })}</small>
      </div>
      <div className="text-right">
        <span className="block text-lg font-bold tabular-nums leading-tight">{format(now)}</span>
        {d != null && (
          <small className={cn('text-[11.5px] font-semibold tabular-nums', d === 0 ? 'text-muted-foreground' : d < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
            {d > 0 ? '+' : d < 0 ? '−' : ''}{statKey === 'meanPd' || statKey === 'meanCal' ? Math.abs(d).toFixed(1) : Math.abs(Math.round(d))}
          </small>
        )}
      </div>
      <svg viewBox="0 0 100 34" preserveAspectRatio="none" className="col-span-2 h-[34px] w-full" aria-hidden>
        <polyline points={numeric.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" style={{ stroke: STAT_COLOR[statKey], strokeWidth: 1.6, vectorEffect: 'non-scaling-stroke' }} />
        {numeric.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r={i === baseIndex || i === numeric.length - 1 ? 2.6 : 1.6} style={{ fill: i === baseIndex ? 'hsl(var(--card))' : STAT_COLOR[statKey], stroke: STAT_COLOR[statKey], strokeWidth: 1.2, vectorEffect: 'non-scaling-stroke' }} />
        ))}
      </svg>
    </div>
  );
}

function ChangeList({ title, empty, items, more = 0, tone, onPick, selectedTooth }: { title: string; empty: string; items: SiteChange[]; more?: number; tone: 'worse' | 'better'; onPick: (c: SiteChange) => void; selectedTooth: number | null }) {
  const t = useTranslations('PerioRecord');
  const sideName = (c: SiteChange) => t(c.side === 'v' ? 'chart.sides.v' : isUpperPerio(c.tooth) ? 'chart.sides.iUpper' : 'chart.sides.iLower');
  const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)}`;
  return (
    <section className="flex flex-col gap-1 border-b px-3.5 py-3">
      <h3 className="text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      {items.length ? items.map((c) => (
        <button
          key={`${c.tooth}${c.side}${c.index}`}
          type="button"
          onClick={() => onPick(c)}
          className={cn('flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] hover:bg-muted', selectedTooth === c.tooth && 'bg-muted')}
        >
          <span className="inline-grid h-6 min-w-[30px] place-items-center rounded-md bg-primary/10 px-1 text-xs font-bold text-primary">{c.tooth}</span>
          <span className="min-w-0 flex-1">
            {sideName(c)} · {t(`chart.sites.${c.index}`)}
            <small className="block text-[11px] text-muted-foreground">{t('evolution.pocket', { from: c.from, to: c.to })}{c.dCal != null ? ` · ${t('evolution.cal', { value: `${signed(c.dCal)} mm` })}` : ''}</small>
          </span>
          <span className={cn('font-bold tabular-nums', tone === 'worse' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400')}>{signed(c.dPd)} mm</span>
        </button>
      )) : <p className="text-[12px] text-muted-foreground">{empty}</p>}
      {more > 0 && <p className="text-[12px] text-muted-foreground">{t('evolution.more', { count: more })}</p>}
    </section>
  );
}

function EvolutionLegend({ mode }: { mode: Mode | 'map' }) {
  const t = useTranslations('PerioRecord.legend');
  const chip = (color: string, label: string) => <span className="inline-flex items-center gap-1.5"><i className="inline-block h-3 w-2 rounded-sm" style={{ background: color }} />{label}</span>;
  const line = (color: string, label: string, dashed = false) => (
    <span className="inline-flex items-center gap-1.5"><i className="inline-block w-[18px]" style={{ borderTop: `${dashed ? 1.5 : 2}px ${dashed ? 'dashed' : 'solid'} ${color}` }} />{label}</span>
  );
  return (
    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 border-t px-3 py-2 text-[11.5px] text-muted-foreground">
      {line('var(--perio-gm)', t('margin'))}
      {line('var(--perio-pd)', t('pocket'))}
      {mode === 'overlay' && (
        <>
          {line('var(--perio-ghost)', t('previous'), true)}
          {chip('var(--perio-better)', t('gained'))}
          {chip('var(--perio-worse)', t('lost'))}
        </>
      )}
      {(mode === 'diff' || mode === 'map') && (
        <>
          {chip('var(--perio-better)', `${t('better')} ≥ 2 mm`)}
          {chip('var(--perio-better-soft)', `${t('better')} 1 mm`)}
          {chip('var(--perio-s6-soft)', `${t('worse')} 1 mm`)}
          {chip('var(--perio-worse)', `${t('worse')} ≥ 2 mm`)}
        </>
      )}
      {mode !== 'map' && (
        <>
          <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2 w-2 rounded-full" style={{ background: 'var(--perio-bop)' }} />{t('bop')}</span>
        </>
      )}
    </div>
  );
}
