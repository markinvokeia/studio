'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, CircleAlert, Pencil, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { assessPerio, assessScreening, EFP_STEP, GRADES, implantStatus, mergePlan, type PlanSite, type RiskParam, STAGES, suggestPlan, suggestScreeningPlan, type Why } from '@/lib/perio/assess';
import { usePerioSettingsContext } from '@/lib/perio/settings';
import { isUpperPerio } from '@/lib/perio/teeth';
import { cn, formatUtcDateTime } from '@/lib/utils';

import type { PerioDiabetes, PerioDiagnosis, PerioExtent, PerioGrade, PerioImplantStatus, PerioPlanItem, PerioRisk, PerioStability, PerioStage } from '@/lib/types';
import type { PerioSession } from './perio-evolution-step';
import { FooterSpacer, PerioStepFooter } from './perio-step-footer';

type Manual = NonNullable<PerioDiagnosis['manual']>;
const IMPLANT_STATUSES: PerioImplantStatus[] = ['health', 'mucositis', 'periimplantitis'];

export interface PerioDiagnosisStepProps {
  today: PerioSession;
  /** Earlier exams of the patient, oldest first, with their diagnoses */
  earlier: (PerioSession & { diagnosis: PerioDiagnosis | null })[];
  diagnosis: PerioDiagnosis | null;
  onChange: (diagnosis: PerioDiagnosis) => void;
  /** Patient's date of birth, for the age */
  birthday?: string;
  /** The probing is complete: the diagnosis can be confirmed */
  probed: boolean;
  readOnly: boolean;
  onBack: () => void;
  onNext: () => void;
}

const yearsBetween = (birthday: string, on: string) => {
  const [by, bm, bd] = birthday.split('-').map(Number);
  const [y, m, d] = on.split('-').map(Number);
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
};

type Translate = (key: string, values?: Record<string, string | number>) => string;

/** "Periodontitis generalizada · estadio III · grado B · inestable" (namespace PerioRecord) */
export function diagnosisPhrase(d: PerioDiagnosis, t: Translate): string {
  const stability = t(`diagnosis.stability.${d.stability}`).toLowerCase();
  if (d.psrMax != null) return t('diagnosis.phrase.psr', { code: d.psrMax });
  if (d.implants?.length) return d.implants.map((i) => `${i.tooth} ${t(`diagnosis.implants.status.${i.status}`).toLowerCase()}`).join(' · ');
  if (!d.isCase) return t('diagnosis.phrase.noCase', { stability });
  return [
    t(d.extent ? `diagnosis.phrase.case.${d.extent}` : 'diagnosis.phrase.case.none'),
    d.stage && t('diagnosis.phrase.stage', { stage: d.stage }),
    d.grade && t('diagnosis.phrase.grade', { grade: d.grade }),
    stability,
  ].filter(Boolean).join(' · ');
}

const STABILITY_TONE: Record<PerioStability, string> = {
  stable: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300',
  gingivitis: 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300',
  unstable: 'border-red-500/40 bg-red-500/10 text-red-800 dark:text-red-300',
};
const ZONE_TONE = ['bg-emerald-500/12 text-emerald-700 dark:text-emerald-300', 'bg-amber-500/15 text-amber-700 dark:text-amber-300', 'bg-red-500/12 text-red-700 dark:text-red-300'];

export function PerioDiagnosisStep({ today, earlier, diagnosis, onChange, birthday, probed, readOnly, onBack, onNext }: PerioDiagnosisStepProps) {
  const t = useTranslations('PerioRecord');
  const lastWithDx = [...earlier].reverse().find((e) => e.diagnosis)?.diagnosis ?? null;

  // What is stored, or a fresh start that carries over what does not change between sessions
  const base: PerioDiagnosis = diagnosis ?? {
    teethLost: lastWithDx?.teethLost ?? null,
    boneLossPct: lastWithDx?.boneLossPct ?? null,
    age: birthday ? yearsBetween(birthday, today.date) : lastWithDx?.age ?? null,
    cigarettes: lastWithDx?.cigarettes ?? 0,
    diabetes: lastWithDx?.diabetes ?? 'no',
    isCase: true,
    stability: 'stable',
    stage: null,
    extent: null,
    grade: null,
    risk: 'low',
    maintenanceMonths: 6,
    plan: [],
    manual: {},
    confirmedAt: null,
  };
  const manual: Manual = base.manual ?? {};

  // The stage is read in the initial exam (it does not go down with treatment)
  const initial = earlier.find((e) => e.examType === 'initial')?.teeth ?? (today.examType === 'initial' ? today.teeth : earlier[0]?.teeth ?? today.teeth);
  const previousStages = earlier.map((e) => (e.diagnosis?.confirmedAt ? e.diagnosis.stage : null)).filter((s): s is PerioStage => !!s);
  // A few loops over 32 teeth: cheaper to run again than to memoize
  const isScreening = today.examType === 'screening';
  const isImplants = today.examType === 'implants';
  const { intervals } = usePerioSettingsContext();
  const a = assessPerio(today.teeth, initial, previousStages, base, intervals);

  const siteText = React.useCallback((tooth: number, sites: PlanSite[]) => sites.map((s) => {
    const side = t(s.side === 'v' ? 'chart.sidesShort.v' : isUpperPerio(tooth) ? 'chart.sidesShort.iUpper' : 'chart.sidesShort.iLower');
    const marks = [s.bop && t('diagnosis.plan.bleeds'), s.sup && t('diagnosis.plan.suppurates')].filter(Boolean).join(' · ');
    return `${side} ${t(`chart.sites.${s.index}`)} ${s.pd} mm${marks ? ` (${marks})` : ''}`;
  }).join(' · '), [t]);

  if (isScreening) {
    return <ScreeningDiagnosis today={today} base={base} intervals={intervals} probed={probed} readOnly={readOnly} onChange={onChange} onBack={onBack} onNext={onNext} />;
  }

  // Implants-only exam: a status per implant (health, mucositis, peri-implantitis)
  const lastTeeth = earlier.length ? earlier[earlier.length - 1].teeth : null;
  const implantRows = today.teeth.filter((x) => x.status === 'implant').map((x) => ({ tooth: x.tooth, suggested: implantStatus(x, lastTeeth?.find((y) => y.tooth === x.tooth)) }));
  const implants = manual.implants && base.implants ? base.implants : implantRows.map((r) => ({ tooth: r.tooth, status: r.suggested }));
  const implantRisk: PerioRisk = implants.some((i) => i.status === 'periimplantitis') ? 'high' : implants.some((i) => i.status === 'mucositis') ? 'moderate' : 'low';

  // Values on screen: the professional's where changed by hand, the suggestion otherwise
  const effective: PerioDiagnosis = {
    ...base,
    manual,
    isCase: manual.isCase ? base.isCase : a.isCase,
    stability: manual.stability ? base.stability : a.stability,
    stage: manual.stage ? base.stage : a.stage,
    extent: manual.extent ? base.extent : a.extent,
    grade: manual.grade ? base.grade : a.grade,
    risk: manual.risk ? base.risk : a.risk,
    maintenanceMonths: manual.maintenanceMonths ? base.maintenanceMonths : a.months,
    plan: mergePlan(suggestPlan(today.teeth, today.examType, a.stats, siteText), base.plan),
    ...(isImplants ? {
      implants,
      isCase: false,
      stage: null,
      grade: null,
      extent: null,
      stability: implantRisk === 'high' ? 'unstable' : implantRisk === 'moderate' ? 'gingivitis' : 'stable',
      risk: implantRisk,
      maintenanceMonths: manual.maintenanceMonths ? base.maintenanceMonths : intervals[implantRisk],
    } : {}),
  };
  const confirmed = !!base.confirmedAt;

  /** Any change undoes the confirmation: what is in the record is always what was confirmed */
  const change = (patch: Partial<PerioDiagnosis>, by?: keyof Manual) => {
    if (readOnly) return;
    onChange({ ...effective, ...patch, manual: by ? { ...manual, [by]: true } : manual, confirmedAt: null });
  };
  const confirm = () => onChange({ ...effective, confirmedAt: new Date().toISOString() });
  const why = (items: Why[]) => items.map((w) => t(`diagnosis.why.${w.key}`, w.values)).join(' · ');

  const phrase = diagnosisPhrase(effective, t);

  const number = (value: number | null, onValue: (v: number | null) => void, props: { min?: number; max?: number; placeholder?: string } = {}) => (
    <Input
      type="number"
      inputMode="numeric"
      value={value ?? ''}
      min={props.min}
      max={props.max}
      placeholder={props.placeholder}
      readOnly={readOnly}
      onChange={(e) => onValue(e.target.value === '' ? null : Math.max(props.min ?? 0, Math.min(props.max ?? 999, Number(e.target.value))))}
      className="h-8 w-24 text-[13px] tabular-nums"
    />
  );
  const picker = <T extends string>(value: T | null, options: T[], label: (v: T) => string, onValue: (v: T) => void, isManual?: boolean) => (
    <span className="inline-flex items-center gap-1.5">
      <Select value={value ?? undefined} onValueChange={(v) => onValue(v as T)} disabled={readOnly}>
        <SelectTrigger className={cn('h-8 w-auto min-w-[120px] gap-1 text-[13px] font-semibold', isManual && 'border-primary/60')}><SelectValue placeholder="–" /></SelectTrigger>
        <SelectContent>{options.map((o) => <SelectItem key={o} value={o}>{label(o)}</SelectItem>)}</SelectContent>
      </Select>
      {isManual && <span className="inline-flex items-center gap-0.5 text-[11px] text-primary" title={t('diagnosis.manualHint')}><Pencil className="h-3 w-3" />{t('diagnosis.manual')}</span>}
    </span>
  );
  // Help ids of the four cards, by their title (the assistant's guides point at them)
  const cardIds: Record<string, string> = {
    [t('diagnosis.today.title')]: 'perio-session.section.dx-today',
    [t('diagnosis.classification.title')]: 'perio-session.section.dx-classification',
    [t('diagnosis.risk.title')]: 'perio-session.section.dx-risk',
    [t('diagnosis.plan.title')]: 'perio-session.section.dx-plan',
  };
  const card = (title: string, children: React.ReactNode, aside?: React.ReactNode) => (
    <section data-help-id={cardIds[title]} className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <h3 className="text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
        {aside && <span className="ml-auto">{aside}</span>}
      </div>
      {children}
    </section>
  );
  const row = (label: string, control: React.ReactNode, note?: string) => (
    <div className="grid gap-1 sm:grid-cols-[170px_minmax(0,1fr)] sm:items-center">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        {control}
        {note && <small className="min-w-0 text-[12px] text-muted-foreground">{note}</small>}
      </div>
    </div>
  );
  const check = (ok: boolean, label: string) => (
    <span className={cn('inline-flex items-center gap-1.5 text-[13px]', ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400')}>
      {ok ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}{label}
    </span>
  );
  const mm = (v: number | null) => (v == null ? '–' : `${v.toFixed(1)} mm`);

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 p-4">
      <div>
        <h2 className="text-xl font-semibold">{t('diagnosis.title')}</h2>
        <p className="mt-1 max-w-[80ch] text-sm text-muted-foreground">{t('diagnosis.lead')}</p>
      </div>

      {!probed && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[13px] text-amber-800 dark:text-amber-300">
          <CircleAlert className="h-4 w-4 shrink-0" />{t('diagnosis.notProbed')}
        </div>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          {!isImplants && (<>
          {card(t('diagnosis.today.title'), (
            <>
              <div className={cn('rounded-xl border px-4 py-3', STABILITY_TONE[effective.stability])}>
                <div className="flex flex-wrap items-center gap-2">
                  <b className="text-lg font-bold">{t(`diagnosis.stability.${effective.stability}`)}</b>
                  <span className="ml-auto">{picker<PerioStability>(effective.stability, ['stable', 'gingivitis', 'unstable'], (v) => t(`diagnosis.stability.${v}`), (v) => change({ stability: v }, 'stability'), manual.stability)}</span>
                </div>
                <p className="mt-0.5 text-[12.5px] opacity-90">{t(`diagnosis.stabilityHelp.${a.stability}`)}</p>
              </div>
              <div className="flex flex-col gap-1">
                {check(a.stats.bopPct < 10, t('diagnosis.today.bop', { value: a.stats.bopPct }))}
                {check(a.stats.n5 === 0, t('diagnosis.today.pockets5', { count: a.stats.n5 }))}
                {check(a.stats.b4 === 0, t('diagnosis.today.bleeding4', { count: a.stats.b4 }))}
              </div>
              <p className={cn('text-[12.5px]', a.endpoints ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground')}>
                {t(a.endpoints ? 'diagnosis.today.endpointsMet' : 'diagnosis.today.endpointsNotMet')}
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[[t('close.kpi.meanPd'), mm(a.stats.meanPd)], [t('close.kpi.meanCal'), mm(a.stats.meanCal)], [t('close.kpi.plaque'), `${a.stats.plaquePct}%`], [t('close.kpi.teeth5'), a.stats.teeth5]].map(([label, value]) => (
                  <div key={String(label)} className="flex flex-col rounded-xl bg-muted/60 px-3 py-2">
                    <b className="text-base font-bold tabular-nums">{value}</b>
                    <small className="text-[11px] text-muted-foreground">{label}</small>
                  </div>
                ))}
              </div>
            </>
          ))}

          {card(t('diagnosis.classification.title'), (
            <>
              <div data-help-id="perio-session.section.dx-inputs" className="grid gap-2 rounded-xl bg-muted/40 p-3 sm:grid-cols-2">
                {row(t('diagnosis.inputs.teethLost'), number(base.teethLost, (v) => change({ teethLost: v }), { min: 0, max: 32 }))}
                {row(t('diagnosis.inputs.boneLoss'), <span className="inline-flex items-center gap-1">{number(base.boneLossPct, (v) => change({ boneLossPct: v }), { min: 0, max: 100, placeholder: t('diagnosis.inputs.fromXray') })}%</span>)}
                {row(t('diagnosis.inputs.age'), number(base.age, (v) => change({ age: v }), { min: 1, max: 120 }))}
                {row(t('diagnosis.inputs.cigarettes'), number(base.cigarettes, (v) => change({ cigarettes: v ?? 0 }), { min: 0, max: 99 }))}
                {row(t('diagnosis.inputs.diabetes'), (
                  <Select value={base.diabetes} onValueChange={(v) => change({ diabetes: v as PerioDiabetes })} disabled={readOnly}>
                    <SelectTrigger className="h-8 w-auto text-[13px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{(['no', 'controlled', 'uncontrolled'] as PerioDiabetes[]).map((d) => <SelectItem key={d} value={d}>{t(`diagnosis.diabetes.${d}`)}</SelectItem>)}</SelectContent>
                  </Select>
                ))}
              </div>
              <p className="-mt-1 text-[11.5px] text-muted-foreground">{t('diagnosis.inputs.note')}</p>
              {row(t('diagnosis.classification.case'), picker<'yes' | 'no'>(effective.isCase ? 'yes' : 'no', ['yes', 'no'], (v) => t(`diagnosis.yesNo.${v}`), (v) => change({ isCase: v === 'yes' }, 'isCase'), manual.isCase), why(a.caseWhy))}
              {effective.isCase && (
                <>
                  {row(t('diagnosis.classification.stage'), picker<PerioStage>(effective.stage, STAGES, (v) => t('diagnosis.stageOption', { stage: v }), (v) => change({ stage: v }, 'stage'), manual.stage), why(a.stageWhy) || t('diagnosis.why.noInitial'))}
                  {row(t('diagnosis.classification.extent'), picker<PerioExtent>(effective.extent, ['localized', 'generalized', 'molarIncisor'], (v) => t(`diagnosis.extent.${v}`), (v) => change({ extent: v }, 'extent'), manual.extent), t('diagnosis.why.extent', { pct: a.extentPct }))}
                  {row(t('diagnosis.classification.grade'), picker<PerioGrade>(effective.grade, GRADES, (v) => t('diagnosis.gradeOption', { grade: v }), (v) => change({ grade: v }, 'grade'), manual.grade), why(a.gradeWhy))}
                </>
              )}
              <p className="rounded-xl border bg-background px-3 py-2 text-[14px] font-semibold">{phrase}</p>
            </>
          ))}
          </>)}
          {isImplants && <ImplantsCard rows={implantRows} statuses={effective.implants ?? []} months={effective.maintenanceMonths} readOnly={readOnly} onStatus={(tooth, status) => change({ implants: (effective.implants ?? []).map((x) => (x.tooth === tooth ? { ...x, status } : x)) }, 'implants')} onMonths={(m) => change({ maintenanceMonths: m }, 'maintenanceMonths')} />}
        </div>

        <div className="flex flex-col gap-4">
          {!isImplants && card(t('diagnosis.risk.title'), (
            <div className="grid gap-3 sm:grid-cols-[230px_minmax(0,1fr)] sm:items-center">
              <RiskRadar params={a.riskParams} />
              <div className="flex flex-col gap-1.5">
                {a.riskParams.map((p) => (
                  <div key={p.key} className="flex items-center gap-2 text-[13px]">
                    <span className="min-w-0 flex-1 text-muted-foreground">{t(`diagnosis.risk.params.${p.key}`)}</span>
                    <b className="tabular-nums">{riskValue(p, t)}</b>
                    <span className={cn('rounded-full px-2 py-px text-[11px] font-semibold', ZONE_TONE[p.zone])}>{t(`diagnosis.risk.zones.${p.zone}`)}</span>
                  </div>
                ))}
                <div className="mt-1 flex flex-wrap items-center gap-2 border-t pt-2">
                  <span className="text-[13px] text-muted-foreground">{t('diagnosis.risk.label')}</span>
                  {picker<PerioRisk>(effective.risk, ['low', 'moderate', 'high'], (v) => t(`diagnosis.risk.levels.${v}`), (v) => change({ risk: v, maintenanceMonths: manual.maintenanceMonths ? effective.maintenanceMonths : intervals[v] }, 'risk'), manual.risk)}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] text-muted-foreground">{t('diagnosis.risk.maintenance')}</span>
                  {picker<string>(String(effective.maintenanceMonths), ['3', '4', '6', '12'], (v) => t('diagnosis.risk.months', { count: Number(v) }), (v) => change({ maintenanceMonths: Number(v) }, 'maintenanceMonths'), manual.maintenanceMonths)}
                </div>
              </div>
            </div>
          ))}

          {card(t('diagnosis.plan.title'), (
            <>
              <p className="-mt-1 text-[12px] text-muted-foreground">{t('diagnosis.plan.lead')}</p>
              <div className="flex flex-col divide-y rounded-xl border">
                {effective.plan.map((item) => (
                  <PlanRow
                    key={item.id}
                    item={item}
                    readOnly={readOnly}
                    onChange={(next) => change({ plan: effective.plan.map((i) => (i.id === item.id ? next : i)) })}
                  />
                ))}
              </div>
              <p className="text-[11.5px] text-muted-foreground">{t('diagnosis.plan.billingLater')}</p>
            </>
          ))}
        </div>
      </div>

      <PerioStepFooter>
        {confirmed ? (
          <span className="inline-flex items-center gap-1.5 text-[13px] text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />{t('diagnosis.confirmedAt', { date: formatUtcDateTime(base.confirmedAt!) })}
          </span>
        ) : (
          <span className="text-[13px] text-muted-foreground">{t(probed ? 'diagnosis.toConfirm' : 'diagnosis.notProbed')}</span>
        )}
        <FooterSpacer />
        <Button type="button" variant="outline" onClick={onBack}><ArrowLeft className="mr-1.5 h-4 w-4" />{t('diagnosis.back')}</Button>
        {!readOnly && !confirmed && (
          <Button type="button" data-help-id="perio-session.btn.confirm-diagnosis" onClick={confirm} disabled={!probed} title={!probed ? t('diagnosis.notProbed') : undefined}>
            <Check className="mr-1.5 h-4 w-4" />{t('diagnosis.confirm')}
          </Button>
        )}
        {(confirmed || readOnly) && <Button type="button" data-help-id="perio-session.btn.next-diagnosis" onClick={onNext}>{t('diagnosis.next')}<ArrowRight className="ml-1.5 h-4 w-4" /></Button>}
      </PerioStepFooter>
    </div>
  );
}

function riskValue(p: RiskParam, t: ReturnType<typeof useTranslations>) {
  if (p.key === 'bop') return `${p.value}%`;
  if (p.key === 'systemic') return t(p.value ? 'diagnosis.risk.diabetes' : 'diagnosis.yesNo.no');
  if (p.key === 'smoking') return p.value ? t('diagnosis.risk.perDay', { count: p.value }) : t('diagnosis.yesNo.no');
  if (p.key === 'boneAge') return p.value == null ? '–' : p.value.toFixed(2);
  return String(p.value ?? '–');
}

function PlanRow({ item, readOnly, onChange }: { item: PerioPlanItem; readOnly: boolean; onChange: (item: PerioPlanItem) => void }) {
  const t = useTranslations('PerioRecord.diagnosis.plan');
  const step = EFP_STEP[item.kind];
  return (
    <div className={cn('flex items-start gap-3 px-3 py-2.5', !item.include && 'opacity-55')}>
      <Checkbox checked={item.include} disabled={readOnly} onCheckedChange={(v) => onChange({ ...item, include: v === true })} className="mt-0.5" aria-label={t(`kinds.${item.kind}`, { tooth: item.tooth ?? '', teeth: item.detail ?? '' })} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-primary/10 px-1.5 py-px text-[10.5px] font-bold uppercase text-primary">{step === 'implant' ? t('implantStep') : t('step', { step })}</span>
          <b className="text-[13px] font-semibold">{t(`kinds.${item.kind}`, { tooth: item.tooth ?? '', teeth: item.detail ?? '' })}</b>
        </div>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          {item.kind === 'reinstrumentation' || item.kind === 'implantRx' ? item.detail : t(`subs.${item.kind}`, { value: item.detail ?? '' })}
        </p>
      </div>
      <div role="radiogroup" className="inline-flex shrink-0 gap-0.5 rounded-[10px] border bg-muted/60 p-0.5">
        {([true, false] as const).map((today) => (
          <button key={String(today)} type="button" role="radio" aria-checked={item.today === today} disabled={readOnly || !item.include} onClick={() => onChange({ ...item, today })} className={cn('h-6 rounded-[8px] px-2 text-[11.5px] font-medium text-muted-foreground disabled:opacity-60', item.today === today && 'bg-background font-semibold text-foreground shadow-sm')}>
            {t(today ? 'today' : 'later')}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Lang & Tonetti hexagon: six axes, the inner ring is low risk and the second one the limit of moderate */
function RiskRadar({ params }: { params: RiskParam[] }) {
  const t = useTranslations('PerioRecord.diagnosis.risk.params');
  const cx = 115;
  const cy = 110;
  const R = 76;
  const point = (j: number, r: number) => {
    const angle = -Math.PI / 2 + (j * Math.PI) / 3;
    return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r] as const;
  };
  const position = (p: RiskParam) => {
    if (!p.scale) return p.value ? 6 : 0;
    const v = p.value ?? 0;
    const k = p.scale.findIndex((x) => v <= x);
    if (k < 0) return 6.2;
    const lo = k ? p.scale[k - 1] : 0;
    return k + (v - lo) / (p.scale[k] - lo || 1);
  };
  const path = (pts: (readonly [number, number])[]) => `${pts.map((q, i) => `${i ? 'L' : 'M'}${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join(' ')} Z`;
  const values = params.map((p, j) => point(j, (R * Math.min(6.2, Math.max(0.25, position(p)))) / 6));
  return (
    <svg viewBox="0 0 230 222" className="mx-auto h-auto w-full max-w-[230px]" role="img" aria-label={params.map((p) => t(p.key)).join(', ')}>
      {[1, 2, 3, 4, 5, 6].map((ring) => (
        <path key={ring} d={path([0, 1, 2, 3, 4, 5].map((j) => point(j, (R * ring) / 6)))} style={{ fill: ring === 2 ? 'var(--perio-better-soft)' : 'none', stroke: 'hsl(var(--border))', strokeWidth: ring === 2 || ring === 4 ? 1.6 : 1 }} />
      ))}
      {params.map((p, j) => {
        const [x, y] = point(j, R);
        const [lx, ly] = point(j, R + 12);
        return (
          <g key={p.key}>
            <path d={`M${cx} ${cy} L${x} ${y}`} style={{ stroke: 'hsl(var(--border))' }} />
            <text x={lx} y={ly + 3} textAnchor={Math.abs(lx - cx) < 5 ? 'middle' : lx < cx ? 'end' : 'start'} style={{ fontSize: 9.5, fontWeight: 600, fill: 'hsl(var(--muted-foreground))' }}>{t(`short.${p.key}`)}</text>
          </g>
        );
      })}
      <path d={path(values)} style={{ fill: 'hsl(var(--primary) / 0.22)', stroke: 'hsl(var(--primary))', strokeWidth: 2 }} />
      {values.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3" style={{ fill: 'hsl(var(--primary))' }} />)}
    </svg>
  );
}

function ImplantsCard({ rows, statuses, months, readOnly, onStatus, onMonths }: {
  rows: { tooth: number; suggested: PerioImplantStatus }[];
  statuses: { tooth: number; status: PerioImplantStatus }[];
  months: number;
  readOnly: boolean;
  onStatus: (tooth: number, status: PerioImplantStatus) => void;
  onMonths: (months: number) => void;
}) {
  const t = useTranslations('PerioRecord.diagnosis');
  const tone: Record<PerioImplantStatus, string> = { health: 'text-emerald-700 dark:text-emerald-400', mucositis: 'text-amber-700 dark:text-amber-400', periimplantitis: 'text-red-700 dark:text-red-400' };
  return (
    <section data-help-id="perio-session.section.dx-implants" className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
      <h3 className="text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground">{t('implants.title')}</h3>
      <p className="-mt-1 text-[12px] text-muted-foreground">{t('implants.lead')}</p>
      {rows.length ? rows.map((r) => {
        const status = statuses.find((x) => x.tooth === r.tooth)?.status ?? r.suggested;
        return (
          <div key={r.tooth} className="flex flex-wrap items-center gap-2">
            <span className="inline-grid h-7 min-w-[34px] place-items-center rounded-lg bg-primary/10 px-1.5 text-[13px] font-bold text-primary">{r.tooth}</span>
            <Select value={status} onValueChange={(v) => onStatus(r.tooth, v as PerioImplantStatus)} disabled={readOnly}>
              <SelectTrigger className={cn('h-8 w-auto min-w-[150px] text-[13px] font-semibold', tone[status])}><SelectValue /></SelectTrigger>
              <SelectContent>{IMPLANT_STATUSES.map((x) => <SelectItem key={x} value={x}>{t(`implants.status.${x}`)}</SelectItem>)}</SelectContent>
            </Select>
            <small className="text-[12px] text-muted-foreground">{t(`implants.why.${r.suggested}`)}</small>
          </div>
        );
      }) : <p className="text-[13px] text-muted-foreground">{t('implants.none')}</p>}
      <div className="flex flex-wrap items-center gap-2 border-t pt-2">
        <span className="text-[13px] text-muted-foreground">{t('risk.maintenance')}</span>
        <Select value={String(months)} onValueChange={(v) => onMonths(Number(v))} disabled={readOnly}>
          <SelectTrigger className="h-8 w-auto text-[13px]"><SelectValue /></SelectTrigger>
          <SelectContent>{[3, 4, 6, 12].map((m) => <SelectItem key={m} value={String(m)}>{t('risk.months', { count: m })}</SelectItem>)}</SelectContent>
        </Select>
      </div>
    </section>
  );
}

/** Diagnosis of a PSR/BPE screening: what the highest code means and what it calls for */
function ScreeningDiagnosis({ today, base, intervals, probed, readOnly, onChange, onBack, onNext }: {
  today: PerioSession;
  base: PerioDiagnosis;
  intervals: Record<PerioRisk, number>;
  probed: boolean;
  readOnly: boolean;
  onChange: (d: PerioDiagnosis) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const t = useTranslations('PerioRecord');
  const a = assessScreening(today.screening ?? null, intervals);
  const manual = base.manual ?? {};
  const effective: PerioDiagnosis = {
    ...base,
    isCase: false,
    stage: null,
    grade: null,
    extent: null,
    psrMax: a.max,
    stability: a.stability,
    risk: a.risk,
    maintenanceMonths: manual.maintenanceMonths ? base.maintenanceMonths : a.months,
    plan: mergePlan(suggestScreeningPlan(a), base.plan),
  };
  const confirmed = !!base.confirmedAt;
  const change = (patch: Partial<PerioDiagnosis>, by?: keyof Manual) => {
    if (readOnly) return;
    onChange({ ...effective, ...patch, manual: by ? { ...manual, [by]: true } : manual, confirmedAt: null });
  };
  const code = a.max;
  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-4 p-4">
      <div>
        <h2 className="text-xl font-semibold">{t('diagnosis.title')}</h2>
        <p className="mt-1 max-w-[80ch] text-sm text-muted-foreground">{t('diagnosis.screening.lead')}</p>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <section data-help-id="perio-session.section.dx-screening" className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
          <h3 className="text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground">{t('diagnosis.screening.title')}</h3>
          {/* Sin códigos todavía no hay resultado: neutro, no el verde de "estable". */}
          <div className={cn('rounded-xl border px-4 py-3', code == null ? 'border-dashed bg-muted/40 text-muted-foreground' : STABILITY_TONE[a.stability])}>
            <b className="text-lg font-bold">{code == null ? t('diagnosis.screening.notCoded') : t('diagnosis.phrase.psr', { code })}</b>
            {code != null && <p className="mt-0.5 text-[12.5px] opacity-90">{t(`screening.codes.${code}`)}</p>}
          </div>
          {code != null && <p className="text-[13px]">{t(`diagnosis.screening.action.${Math.min(code, 4)}`)}</p>}
          {a.chartSextants.length > 0 && <p className="text-[13px] font-medium">{t('diagnosis.screening.chartSextants', { sextants: a.chartSextants.join(', ') })}</p>}
          <div className="flex flex-wrap items-center gap-2 border-t pt-2">
            <span className="text-[13px] text-muted-foreground">{t('diagnosis.risk.maintenance')}</span>
            <Select value={String(effective.maintenanceMonths)} onValueChange={(v) => change({ maintenanceMonths: Number(v) }, 'maintenanceMonths')} disabled={readOnly}>
              <SelectTrigger className="h-8 w-auto text-[13px]"><SelectValue /></SelectTrigger>
              <SelectContent>{[3, 4, 6, 12].map((m) => <SelectItem key={m} value={String(m)}>{t('diagnosis.risk.months', { count: m })}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </section>
        <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
          <h3 className="text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground">{t('diagnosis.plan.title')}</h3>
          <div className="flex flex-col divide-y rounded-xl border">
            {effective.plan.map((item) => (
              <PlanRow key={item.id} item={item} readOnly={readOnly} onChange={(next) => change({ plan: effective.plan.map((i) => (i.id === item.id ? next : i)) })} />
            ))}
          </div>
        </section>
      </div>
      <PerioStepFooter>
        {confirmed
          ? <span className="inline-flex items-center gap-1.5 text-[13px] text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="h-4 w-4" />{t('diagnosis.confirmedAt', { date: formatUtcDateTime(base.confirmedAt!) })}</span>
          : <span className="text-[13px] text-muted-foreground">{t(probed ? 'diagnosis.toConfirm' : 'diagnosis.screening.notProbed')}</span>}
        <FooterSpacer />
        <Button type="button" variant="outline" onClick={onBack}><ArrowLeft className="mr-1.5 h-4 w-4" />{t('diagnosis.back')}</Button>
        {!readOnly && !confirmed && <Button type="button" data-help-id="perio-session.btn.confirm-diagnosis" onClick={() => onChange({ ...effective, confirmedAt: new Date().toISOString() })} disabled={!probed}><Check className="mr-1.5 h-4 w-4" />{t('diagnosis.confirm')}</Button>}
        {(confirmed || readOnly) && <Button type="button" data-help-id="perio-session.btn.next-diagnosis" onClick={onNext}>{t('diagnosis.next')}<ArrowRight className="ml-1.5 h-4 w-4" /></Button>}
      </PerioStepFooter>
    </div>
  );
}
