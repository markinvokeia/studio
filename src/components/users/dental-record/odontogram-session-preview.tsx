'use client';

import React from 'react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

import type { OdontogramState } from '@/lib/types';
import { isTemporalTooth } from './odontogram-catalog';
import { OdontogramChart } from './odontogram-chart';
import { listToothMarks } from './odontogram-state';
import { StatusDot, STATUS_ORDER } from './tooth-inspector';

/** `estado_odontograma` as it comes from the API: an object, a JSON string or nothing */
function parseState(raw: unknown): OdontogramState {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof raw === 'object' ? (raw as OdontogramState) : {};
}

interface OdontogramSessionPreviewProps {
  state: unknown;
  /** Opens the session in the odontogram viewer */
  onOpen?: () => void;
  className?: string;
}

/** Small read-only odontogram of a session, for the clinical timeline */
export function OdontogramSessionPreview({ state: raw, onOpen, className }: OdontogramSessionPreviewProps) {
  const t = useTranslations('DentalRecord');
  const state = React.useMemo(() => parseState(raw), [raw]);
  const dentition = Object.keys(state).some((id) => isTemporalTooth(Number(id))) ? 'mixed' : 'permanent';
  const counts = { indicated: 0, existing: 0, done: 0 };
  Object.keys(state).forEach((id) => listToothMarks(id, state[id]).forEach((m) => { counts[m.status] += 1; }));

  const body = (
    <>
      <OdontogramChart state={state} dentition={dentition} variant="mini" />
      <span className="flex flex-wrap justify-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
        {STATUS_ORDER.map((s) => (
          <span key={s} className="inline-flex items-center gap-1"><StatusDot status={s} className="h-2 w-2" />{t(`status.${s}`)} <b className="font-semibold tabular-nums text-foreground">{counts[s]}</b></span>
        ))}
      </span>
    </>
  );

  return onOpen ? (
    <button
      type="button"
      onClick={onOpen}
      title={t('timeline.openSession')}
      aria-label={t('timeline.openSession')}
      className={cn('flex w-full flex-col gap-1.5 rounded-xl border bg-card p-2 transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', className)}
    >
      {body}
    </button>
  ) : (
    <div className={cn('flex w-full flex-col gap-1.5 rounded-xl border bg-card p-2', className)}>{body}</div>
  );
}
