'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRight, Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { assessScreening, PSR_CODES, SEXTANT_ORDER, SEXTANTS } from '@/lib/perio/assess';
import { cn } from '@/lib/utils';

import type { PerioExamType, PerioPsrCode, PerioScreening, PerioSextant } from '@/lib/types';
import { FooterSpacer, PerioStepFooter } from './perio-step-footer';

export const PERIO_EXAM_TYPES: PerioExamType[] = ['initial', 'reevaluation', 'maintenance', 'screening', 'implants'];

/** Colour of each PSR/BPE code (also the timeline preview) */
export const CODE_TONE: Record<PerioPsrCode, string> = {
  '0': 'border-emerald-500 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300',
  '1': 'border-lime-500 bg-lime-500/15 text-lime-800 dark:text-lime-300',
  '2': 'border-amber-500 bg-amber-500/15 text-amber-800 dark:text-amber-300',
  '3': 'border-orange-500 bg-orange-500/15 text-orange-800 dark:text-orange-300',
  '4': 'border-red-500 bg-red-500/15 text-red-800 dark:text-red-300',
  X: 'border-muted-foreground/50 bg-muted text-muted-foreground',
};

export interface PerioScreeningStepProps {
  screening: PerioScreening | null;
  onChange: (screening: PerioScreening) => void;
  examType: PerioExamType;
  onExamTypeChange: (type: PerioExamType) => void;
  readOnly: boolean;
  onNext: () => void;
}

/** PSR/BPE screening: one code per sextant (the worst site), with * for furcation, mobility or recession ≥ 3.5 mm */
export function PerioScreeningStep({ screening, onChange, examType, onExamTypeChange, readOnly, onNext }: PerioScreeningStepProps) {
  const t = useTranslations('PerioRecord');
  const value: PerioScreening = screening ?? { codes: {}, star: [] };
  const a = assessScreening(value);
  const [active, setActive] = React.useState<PerioSextant>(() => SEXTANT_ORDER.find((x) => !value.codes[x]) ?? '1');

  const setCode = (sextant: PerioSextant, code: PerioPsrCode) => {
    if (readOnly) return;
    onChange({ ...value, codes: { ...value.codes, [sextant]: code } });
    const next = SEXTANT_ORDER[SEXTANT_ORDER.indexOf(sextant) + 1];
    if (next) setActive(next);
  };
  const toggleStar = (sextant: PerioSextant) => {
    if (readOnly) return;
    const star = new Set(value.star ?? []);
    if (star.has(sextant)) star.delete(sextant); else star.add(sextant);
    onChange({ ...value, star: SEXTANT_ORDER.filter((x) => star.has(x)) });
  };

  // Keyboard: 0–4 and X code the active sextant and move on; * marks it; arrows move
  const handleKey = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || readOnly || e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.querySelector('[role="alertdialog"]')) return;
    const k = e.key.toLowerCase();
    if (/^[0-4]$/.test(k)) { e.preventDefault(); setCode(active, k as PerioPsrCode); }
    else if (k === 'x') { e.preventDefault(); setCode(active, 'X'); }
    else if (k === '*') { e.preventDefault(); toggleStar(active); }
    else if (k === 'arrowright' || k === 'arrowleft') {
      e.preventDefault();
      const i = SEXTANT_ORDER.indexOf(active) + (k === 'arrowright' ? 1 : -1);
      if (SEXTANT_ORDER[i]) setActive(SEXTANT_ORDER[i]);
    }
  };
  const keyRef = React.useRef(handleKey);
  React.useEffect(() => { keyRef.current = handleKey; });
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const card = (sextant: PerioSextant) => {
    const code = value.codes[sextant];
    const teeth = SEXTANTS[sextant];
    const star = value.star?.includes(sextant);
    return (
      <section
        key={sextant}
        onClick={() => setActive(sextant)}
        className={cn('flex flex-col gap-2 rounded-2xl border bg-card p-3 transition-shadow', active === sextant && !readOnly && 'border-primary ring-2 ring-primary/20')}
      >
        <div className="flex items-center gap-2">
          <b className="text-[14px] font-semibold">{t('screening.sextant', { n: sextant })}</b>
          <small className="text-xs text-muted-foreground">{teeth[0]}–{teeth[teeth.length - 1]}</small>
          {code && <span className={cn('ml-auto grid h-7 min-w-7 place-items-center rounded-lg border px-1.5 text-sm font-bold', CODE_TONE[code])}>{code}{star ? '*' : ''}</span>}
        </div>
        <div className="grid grid-cols-6 gap-1" role="radiogroup" aria-label={t('screening.sextant', { n: sextant })}>
          {PSR_CODES.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={code === c}
              disabled={readOnly}
              title={t(`screening.codes.${c}`)}
              onClick={(e) => { e.stopPropagation(); setCode(sextant, c); }}
              className={cn('h-10 rounded-lg border text-[15px] font-semibold tabular-nums transition-colors disabled:opacity-60', code === c ? CODE_TONE[c] : 'bg-background hover:bg-muted')}
            >
              {c}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-[12.5px] text-muted-foreground" onClick={(e) => e.stopPropagation()}>
          <input type="checkbox" checked={!!star} disabled={readOnly} onChange={() => toggleStar(sextant)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
          {t('screening.star')}
        </label>
      </section>
    );
  };

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-3 p-3">
      <div className="flex flex-wrap items-center gap-2.5 rounded-xl border bg-card px-3 py-1.5 text-[12.5px] text-muted-foreground">
        <span>{t('probe.banner.examType')}</span>
        <Select value={examType} onValueChange={(v) => onExamTypeChange(v as PerioExamType)} disabled={readOnly}>
          <SelectTrigger className="h-7 w-auto gap-1 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{PERIO_EXAM_TYPES.map((type) => <SelectItem key={type} value={type}>{t(`examTypes.${type}`)}</SelectItem>)}</SelectContent>
        </Select>
        <span>· {t('screening.lead')}</span>
      </div>

      <div data-help-id="perio-session.section.sextants" className="grid gap-3 md:grid-cols-3">{SEXTANT_ORDER.slice(0, 3).map(card)}</div>
      <div className="grid gap-3 md:grid-cols-3">{SEXTANT_ORDER.slice(3).map(card)}</div>

      <section data-help-id="perio-session.section.psr-legend" className="grid gap-x-6 gap-y-1 rounded-2xl border bg-card p-3 text-[12.5px] sm:grid-cols-2">
        {PSR_CODES.map((c) => (
          <p key={c} className="flex gap-2"><b className={cn('grid h-5 min-w-5 place-items-center rounded border px-1 text-[11px]', CODE_TONE[c])}>{c}</b><span className="text-muted-foreground">{t(`screening.codes.${c}`)}</span></p>
        ))}
        <p className="flex gap-2"><b className="grid h-5 min-w-5 place-items-center rounded border px-1 text-[11px]">*</b><span className="text-muted-foreground">{t('screening.starHelp')}</span></p>
        {!readOnly && <p className="text-muted-foreground sm:col-span-2">{t('screening.keys')}</p>}
      </section>

      <PerioStepFooter>
        <span className={cn('inline-flex items-center gap-1 text-[12.5px]', a.coded === 6 ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground')}>
          {a.coded === 6 && <Check className="h-3.5 w-3.5" />}{t('screening.progress', { done: a.coded })}
        </span>
        <FooterSpacer />
        <Button type="button" data-help-id="perio-session.btn.next-probe" variant={a.coded === 6 ? 'default' : 'outline'} onClick={onNext}>{t('probe.nextStep')}<ArrowRight className="ml-1.5 h-4 w-4" /></Button>
      </PerioStepFooter>
    </div>
  );
}
