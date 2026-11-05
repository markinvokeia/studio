'use client';

import React from 'react';
import { useTranslations } from 'next-intl';

import { SEXTANT_ORDER } from '@/lib/perio/assess';
import { cn } from '@/lib/utils';
import { fetchPerioExams } from '@/services/perio-record';

import type { PerioExam, PerioExamStatus } from '@/lib/types';
import { PerioPreview } from './perio-arch';
import { diagnosisPhrase } from './perio-diagnosis-step';
import { PERIO_STATUS_CHIP } from './perio-session-sheet';

/** Patient's periodontograms for the timeline; `reload` after the sheet changes one */
export function usePerioExams(patientId: string, enabled: boolean) {
  const [exams, setExams] = React.useState<PerioExam[]>([]);

  const reload = React.useCallback(async () => {
    if (!enabled || !patientId) {
      setExams([]);
      return;
    }
    try {
      setExams(await fetchPerioExams(patientId));
    } catch {
      // The timeline still shows the other sessions without them
      setExams([]);
    }
  }, [patientId, enabled]);

  React.useEffect(() => { reload(); }, [reload]);

  return { exams, reload };
}

export function PerioStatusChip({ status, completeness }: { status: PerioExamStatus; completeness?: number }) {
  const t = useTranslations('PerioRecord');
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-1.5 py-0 text-[10px] font-semibold leading-relaxed', PERIO_STATUS_CHIP[status])}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {t(`status.${status}`)}
      {completeness != null && status !== 'closed' && status !== 'void' && <span className="tabular-nums opacity-75">· {completeness}%</span>}
    </span>
  );
}

/** One line for the collapsed timeline row, e.g. "Mantenimiento · sangrado 12% · 3 bolsas ≥ 5 mm" */
export function usePerioExamSummary() {
  const t = useTranslations('PerioRecord');
  return React.useCallback((exam: PerioExam) => {
    const parts = [t(`examTypes.${exam.examType}`)];
    if (exam.diagnosis?.confirmedAt && exam.diagnosis.isCase && exam.diagnosis.stage) parts.push(t('diagnosis.stageOption', { stage: exam.diagnosis.stage }));
    if (exam.stats?.sites) {
      parts.push(t('timeline.bop', { value: exam.stats.bopPct }));
      parts.push(t('timeline.pockets5', { count: exam.stats.n5 }));
    }
    return parts.join(' · ');
  }, [t]);
}

/** Body of an expanded periodontogram in the timeline: indices and notes */
export function PerioExamDetails({ exam }: { exam: PerioExam }) {
  const t = useTranslations('PerioRecord');
  const s = exam.stats;
  const mm = (v: number | null) => (v == null ? '–' : `${v.toFixed(1)} mm`);
  const row = (label: string, value: React.ReactNode) => (
    <p className="break-words text-foreground"><span className="text-muted-foreground">{label}:</span> {value}</p>
  );
  return (
    <>
      {row(t('timeline.type'), t(`examTypes.${exam.examType}`))}
      {exam.doctorName && row(t('timeline.doctor'), exam.doctorName)}
      {exam.diagnosis?.confirmedAt && row(t('timeline.diagnosis'), `${diagnosisPhrase(exam.diagnosis, t)} · ${t(`diagnosis.risk.levels.${exam.diagnosis.risk}`)}`)}
      {exam.screening ? row(t('timeline.sextants'), SEXTANT_ORDER.map((x) => `${t('screening.sextantShort', { n: x })} ${exam.screening!.codes[x] ?? '–'}${exam.screening!.star?.includes(x) ? '*' : ''}`).join(' · ')) : s && s.sites > 0 ? (
        <>
          {row(t('timeline.sites'), s.sites)}
          {row(t('timeline.bopLabel'), `${s.bopPct}%`)}
          {row(t('timeline.plaqueLabel'), `${s.plaquePct}%`)}
          {row(t('timeline.means'), `${mm(s.meanPd)} · ${mm(s.meanCal)}`)}
          {row(t('timeline.pocketsLabel'), t('timeline.pocketsValue', { n4: s.n4, n5: s.n5, n6: s.n6 }))}
        </>
      ) : <p className="text-muted-foreground">{t('timeline.noProbing')}</p>}
      {exam.notes.trim() && row(t('timeline.notes'), <span className="whitespace-pre-wrap">{exam.notes}</span>)}
    </>
  );
}

/** Small read-only chart of the exam; a click opens it */
export function PerioExamPreview({ exam, onOpen }: { exam: PerioExam; onOpen?: () => void }) {
  const t = useTranslations('PerioRecord');
  const body = <PerioPreview teeth={exam.teeth} />;
  return onOpen ? (
    <button
      type="button"
      onClick={onOpen}
      title={t('timeline.open')}
      aria-label={t('timeline.open')}
      className="w-full rounded-xl border bg-card p-2 transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {body}
    </button>
  ) : <div className="w-full rounded-xl border bg-card p-2">{body}</div>;
}
