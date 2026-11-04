import type { AestheticLayer, AestheticPhoto, AestheticServiceConsent, AestheticSessionStatus } from '@/lib/types';

// Same rule as aesthetic_session_recompute() (database/scripts/155): the screen shows it while
// the autosave is on its way, the server stores it.

export type SessionStep = 1 | 2 | 3 | 4;
export const SESSION_STEPS: SessionStep[] = [1, 2, 3, 4];

export interface SessionFacts {
  layers: AestheticLayer[];
  consents: Pick<AestheticServiceConsent, 'serviceId'>[];
  photos: Pick<AestheticPhoto, 'id'>[];
  closed: boolean;
  voided: boolean;
}

export const isServiceSigned = (consents: SessionFacts['consents'], serviceId: string | undefined) =>
  !!serviceId && consents.some((c) => c.serviceId === serviceId);

export const consentComplete = ({ layers, consents }: Pick<SessionFacts, 'layers' | 'consents'>) =>
  layers.length > 0 && layers.every((l) => isServiceSigned(consents, l.serviceId));

export const layerMarked = (layer: AestheticLayer) => layer.marks.some((m) => (m.quantity ?? 0) > 0);

export const treatmentComplete = (layers: AestheticLayer[]) => layers.length > 0 && layers.every(layerMarked);

export function computeStatus(facts: SessionFacts): AestheticSessionStatus {
  if (facts.voided) return 'void';
  if (facts.closed) return 'closed';
  const anyMark = facts.layers.some((l) => l.marks.length > 0);
  if (anyMark) {
    return consentComplete(facts) && treatmentComplete(facts.layers) && facts.photos.length > 0 ? 'ready_to_close' : 'in_treatment';
  }
  return consentComplete(facts) ? 'consented' : 'draft';
}

/** Which of the four steps are done */
export function stepsDone(facts: SessionFacts): Record<SessionStep, boolean> {
  return {
    1: consentComplete(facts),
    2: facts.photos.length > 0,
    3: treatmentComplete(facts.layers),
    4: facts.closed,
  };
}

/** A quarter per completed step (a UI rule, it can change) */
export function computeCompleteness(facts: SessionFacts): number {
  const done = stepsDone(facts);
  return SESSION_STEPS.filter((s) => done[s]).length * 25;
}

/** What is missing, the first thing first; translated by the caller */
export type MissingItem =
  | { key: 'closed' }
  | { key: 'void' }
  | { key: 'pickServices' }
  | { key: 'signConsents'; count: number; service: string }
  | { key: 'takePhoto' }
  | { key: 'markServices'; services: string }
  | { key: 'ready' };

export function nextMissing(facts: SessionFacts, layerName: (layer: AestheticLayer) => string): MissingItem {
  if (facts.voided) return { key: 'void' };
  if (facts.closed) return { key: 'closed' };
  if (!facts.layers.length) return { key: 'pickServices' };
  const unsigned = facts.layers.filter((l) => !isServiceSigned(facts.consents, l.serviceId));
  if (unsigned.length) return { key: 'signConsents', count: unsigned.length, service: layerName(unsigned[0]) };
  if (!facts.photos.length) return { key: 'takePhoto' };
  const unmarked = facts.layers.filter((l) => !layerMarked(l));
  if (unmarked.length) return { key: 'markServices', services: unmarked.map(layerName).join(', ') };
  return { key: 'ready' };
}

/** First step that still needs work: where an open session resumes */
export function resumeStep(facts: SessionFacts): SessionStep {
  if (facts.closed || facts.voided) return 4;
  const done = stepsDone(facts);
  if (!done[1]) return 1;
  if (!done[2]) return 2;
  if (!done[3]) return 3;
  return 4;
}

/** Chip colours of each status (spec: grey, violet, blue, amber, green, red) */
export const STATUS_CHIP: Record<AestheticSessionStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  consented: 'bg-violet-500/12 text-violet-700 dark:text-violet-300',
  in_treatment: 'bg-blue-500/12 text-blue-700 dark:text-blue-300',
  ready_to_close: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  closed: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
  void: 'bg-red-500/12 text-red-700 dark:text-red-300',
};

export const isOpenStatus = (status: AestheticSessionStatus) => status !== 'closed' && status !== 'void';

/** Calendar days from `from` to `to` (both start with yyyy-MM-dd), without time zone shifts */
export function daysBetween(from: string, to: string): number {
  const utc = (d: string) => { const [y, m, day] = d.slice(0, 10).split('-').map(Number); return Date.UTC(y, m - 1, day); };
  return Math.round((utc(to) - utc(from)) / 86_400_000);
}

/** yyyy-MM-dd plus `days` */
export function addDaysToDate(date: string, days: number): string {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

type Translate = (key: string, values?: Record<string, string | number>) => string;

/** Sentence for what is missing, in the AestheticRecord namespace */
export function missingText(t: Translate, missing: MissingItem): string {
  switch (missing.key) {
    case 'signConsents': return t('flow.missing.signConsents', { count: missing.count, service: missing.service });
    case 'markServices': return t('flow.missing.markServices', { services: missing.services });
    default: return t(`flow.missing.${missing.key}`);
  }
}
