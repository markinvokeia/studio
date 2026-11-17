'use client';

import * as React from 'react';
import { ArrowRight, Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { LabStageBadge, useLabDurationText, useLabStayText } from '@/components/lab-orders/lab-order-shared';

import { cn, formatDisplayDate, formatUtcDateTime } from '@/lib/utils';

import type { LabOrderChange, LabOrderChangeField, LabOrderChangeItem, LabOrderDetail, LabOrderHistoryEntry } from '@/lib/types';

const SECTION_TITLE = 'text-xs font-semibold uppercase tracking-wide text-muted-foreground';

type TimelineEntry =
  | { kind: 'stage'; at: string; entry: LabOrderHistoryEntry; changes: LabOrderChange[] }
  | { kind: 'edit'; at: string; change: LabOrderChange };

/**
 * Una sola línea de tiempo, de lo más nuevo a lo más viejo: los movimientos de etapa (con cuánto
 * estuvo en cada una) y las ediciones de la orden y sus servicios (script 175). Lo que se guardó
 * en el mismo movimiento (laboratorio, fecha de entrega al enviar) va dentro de ese movimiento.
 */
function buildTimeline(history: LabOrderHistoryEntry[], changes: LabOrderChange[]): TimelineEntry[] {
  const stages = [...history].sort((a, b) => b.changed_at.localeCompare(a.changed_at) || b.id - a.id);
  const stageAt = new Map<string, TimelineEntry & { kind: 'stage' }>();
  const entries: TimelineEntry[] = stages.map((entry) => {
    const item = { kind: 'stage' as const, at: entry.changed_at, entry, changes: [] as LabOrderChange[] };
    if (!stageAt.has(entry.changed_at)) stageAt.set(entry.changed_at, item);
    return item;
  });
  for (const change of changes) {
    const stage = stageAt.get(change.changed_at);
    if (stage) stage.changes.push(change);
    else entries.push({ kind: 'edit', at: change.changed_at, change });
  }
  // A igual hora, primero la etapa (el alta queda abajo de todo).
  return entries.sort((a, b) => b.at.localeCompare(a.at) || (a.kind === b.kind ? 0 : a.kind === 'stage' ? -1 : 1));
}

function ChangeFields({ fields }: { fields: LabOrderChangeField[] }) {
  const t = useTranslations('LabOrdersPage');

  const label = (field: string): string => {
    switch (field) {
      case 'patient_id': return t('columns.patient');
      case 'doctor_id': return t('columns.doctor');
      case 'laboratory_id': return t('columns.laboratory');
      case 'items': return t('form.services');
      case 'work_description': return t('detail.description');
      case 'teeth': return t('form.teeth');
      case 'due_date': return t('form.dueDate');
      case 'is_urgent': return t('form.urgent');
      case 'notes': return t('form.notes');
      default: return field.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
    }
  };

  const itemText = (item: LabOrderChangeItem): string => [
    `${item.service_name}${item.quantity > 1 ? ` ×${item.quantity}` : ''}`,
    item.teeth.length > 0 ? t('teethShort', { teeth: item.teeth.join(', ') }) : null,
    item.notes,
  ].filter(Boolean).join(' · ');

  const value = (field: string, raw: unknown): string => {
    if (raw === null || raw === undefined || raw === '') return '—';
    if (field === 'items') {
      const items = raw as LabOrderChangeItem[];
      return items.length > 0 ? items.map(itemText).join('; ') : '—';
    }
    if (field === 'due_date') return formatDisplayDate(String(raw));
    if (typeof raw === 'boolean') return raw ? t('detail.yes') : t('detail.no');
    if (Array.isArray(raw)) return raw.length > 0 ? raw.join(', ') : '—';
    return typeof raw === 'string' ? raw : JSON.stringify(raw);
  };

  return (
    <dl className="mt-1.5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1 text-xs">
      {fields.map((f) => {
        const before = value(f.field, f.old);
        return (
        <React.Fragment key={f.field}>
          <dt className="font-medium text-muted-foreground">{label(f.field)}</dt>
          <dd className="min-w-0 whitespace-pre-wrap break-words">
            <span className={cn('text-muted-foreground', before !== '—' && 'line-through')}>{before}</span>
            {' → '}
            <span className="font-medium text-foreground">{value(f.field, f.new)}</span>
          </dd>
        </React.Fragment>
        );
      })}
    </dl>
  );
}

function EntryMeta({ at, by, extra }: { at: string; by: string | null; extra?: string | null }) {
  return (
    <p className="mt-1 text-xs text-muted-foreground">
      {formatUtcDateTime(at)}
      {by ? ` · ${by}` : ''}
      {extra ? ` · ${extra}` : ''}
    </p>
  );
}

/** Historial de la orden: etapas con su duración, ediciones y el tiempo total desde el alta. */
export function LabOrderHistory({ detail }: { detail: LabOrderDetail }) {
  const t = useTranslations('LabOrdersPage');
  const stayText = useLabStayText();
  const durationText = useLabDurationText();

  const timeline = React.useMemo(() => buildTimeline(detail.history, detail.changes), [detail.history, detail.changes]);
  // Solo los movimientos de etapa, del más nuevo al más viejo: de ahí sale cuánto estuvo en cada una.
  const stageEntries = React.useMemo(
    () => timeline.filter((e): e is TimelineEntry & { kind: 'stage' } => e.kind === 'stage').map((e) => e.entry),
    [timeline],
  );

  // Tiempo total: desde el alta hasta hoy, o hasta que llegó a la etapa final.
  const [now] = React.useState(() => new Date().toISOString());
  const createdAt = stageEntries.find((e) => e.from_stage_id === null)?.changed_at || detail.created_at;
  const latest = stageEntries[0];
  const total = !createdAt
    ? null
    : detail.is_pending
      ? durationText(createdAt, now)
      : latest ? durationText(createdAt, latest.changed_at) : null;

  return (
    <section data-help-id="lab-orders.section.history" className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className={SECTION_TITLE}>{t('detail.history')}</h3>
        {total && (
          <span className="text-xs text-muted-foreground">
            {detail.is_pending
              ? t('detail.totalPending', { duration: total })
              : t('detail.totalFinished', { duration: total, stage: detail.stage_name })}
          </span>
        )}
      </div>
      <ol className="space-y-2">
        {timeline.map((item) => {
          if (item.kind === 'edit') {
            const { change } = item;
            return (
              <li key={`c${change.id}`} className="rounded-lg border border-dashed border-border px-3 py-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  {t('detail.edited')}
                </div>
                <ChangeFields fields={change.fields} />
                <EntryMeta at={change.changed_at} by={change.changed_by_name} />
              </li>
            );
          }

          const { entry } = item;
          const index = stageEntries.indexOf(entry);
          // Del más nuevo al más viejo: el movimiento siguiente es el anterior en la lista.
          const isCurrent = index === 0 && entry.to_stage_id === detail.current_stage_id;
          const stay = index > 0 ? stayText(entry.changed_at, stageEntries[index - 1].changed_at) : null;
          const note = entry.note === 'stage_deactivated' ? t('detail.byStageDeactivation') : entry.note;
          return (
            <li key={`s${entry.id}`} className="rounded-lg border border-border bg-card px-3 py-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {entry.from_stage_name ? (
                  <>
                    <LabStageBadge name={entry.from_stage_name} color={entry.from_stage_color || '#64748b'} />
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </>
                ) : (
                  <span className="text-xs font-medium text-muted-foreground">{t('detail.created')}</span>
                )}
                <LabStageBadge name={entry.to_stage_name} color={entry.to_stage_color} />
                {isCurrent && (
                  <span className="ml-auto text-xs font-medium text-primary">
                    {t('detail.current', { days: t('daysInStage', { count: detail.days_in_stage }) })}
                  </span>
                )}
                {stay && <span className="ml-auto text-xs font-medium text-muted-foreground">{stay}</span>}
              </div>
              {item.changes.map((change) => <ChangeFields key={change.id} fields={change.fields} />)}
              <EntryMeta at={entry.changed_at} by={entry.changed_by_name} extra={note} />
            </li>
          );
        })}
      </ol>
    </section>
  );
}
