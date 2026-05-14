'use client';

import * as React from 'react';
import { format, parseISO } from 'date-fns';
import { BellRing, CalendarDays, CheckCircle2, Clock, Edit, FileText, Flag, Info, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ResizableSheet, SheetDescription, SheetTitle } from '@/components/ui/resizable-sheet';
import { cn, formatDisplayDate } from '@/lib/utils';
import type { CalendarReminder } from '@/lib/types';

interface ReminderPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reminder: CalendarReminder | null;
  onEdit: (reminder: CalendarReminder) => void;
  onMarkDone: (reminder: CalendarReminder) => void;
  onDelete: (reminder: CalendarReminder) => void;
}

function formatLocalTime(value?: string | null): string {
  if (!value) return '';
  const parsed = parseISO(value.replace(/Z$/, ''));
  return Number.isNaN(parsed.getTime()) ? '' : format(parsed, 'HH:mm');
}

interface DetailRowProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  tone?: 'default' | 'warning';
  className?: string;
}

function DetailRow({ icon: Icon, label, value, detail, tone = 'default', className }: DetailRowProps) {
  return (
    <div className={cn('flex w-full items-center gap-3 border-b border-border/70 py-3 text-left', className)}>
      <span
        className={cn(
          'grid h-10 w-10 shrink-0 place-items-center rounded-xl',
          tone === 'warning' ? 'bg-amber-50 text-amber-700' : 'bg-muted/60 text-muted-foreground',
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium text-muted-foreground">{label}</span>
        <span className="block text-sm font-semibold leading-snug text-foreground">{value}</span>
        {detail && <span className="mt-0.5 block text-xs text-muted-foreground">{detail}</span>}
      </span>
    </div>
  );
}

export function ReminderPanel({
  open,
  onOpenChange,
  reminder,
  onEdit,
  onMarkDone,
  onDelete,
}: ReminderPanelProps) {
  const t = useTranslations('Reminders');

  if (!reminder) return null;

  const startTime = formatLocalTime(reminder.start_datetime);
  const endTime = formatLocalTime(reminder.end_datetime);
  const isDone = reminder.status === 'done';

  return (
    <ResizableSheet
      open={open}
      onOpenChange={onOpenChange}
      defaultWidth={560}
      minWidth={420}
      maxWidth={760}
      storageKey="reminder-panel-width"
    >
      <div className="flex h-full flex-col overflow-hidden bg-card font-body">
        <div className="flex-none border-b border-border px-5 py-4 pr-24">
          <div className="flex items-start gap-3">
            <span
              className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-white shadow-sm"
              style={{ backgroundColor: reminder.color || '#8b5cf6' }}
            >
              <BellRing className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <SheetTitle className="truncate text-lg font-semibold text-foreground">
                {reminder.title}
              </SheetTitle>
              <SheetDescription className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>{t('recordatorio')}</span>
                <Badge variant={isDone ? 'success' : 'info'} className="rounded-full">
                  {t(`status.${reminder.status}`)}
                </Badge>
              </SheetDescription>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Info className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-base font-semibold">{t('detailsTitle')}</h3>
            </div>
            <div className="flex flex-col">
              <DetailRow
                icon={CalendarDays}
                label={t('dateLabel')}
                value={formatDisplayDate(reminder.start_datetime)}
              />
              <DetailRow
                icon={Clock}
                label={t('timeLabel')}
                value={endTime ? `${startTime} -> ${endTime}` : startTime}
              />
              <DetailRow
                icon={Flag}
                label={t('priorityLabel')}
                value={t(`priority.${reminder.priority.toLowerCase()}`)}
              />
              {reminder.description && (
                <DetailRow
                  icon={FileText}
                  label={t('descriptionLabel')}
                  value={<span className="whitespace-pre-wrap font-medium">{reminder.description}</span>}
                  tone="warning"
                />
              )}
            </div>
          </section>
        </div>

        <div className="flex-none border-t border-border bg-muted/30 px-5 py-4">
          <div className="flex flex-wrap justify-end gap-2">
            {!isDone && (
              <Button variant="outline" className="gap-2" onClick={() => onMarkDone(reminder)}>
                <CheckCircle2 className="h-4 w-4" />
                {t('markDone')}
              </Button>
            )}
            <Button variant="outline" className="gap-2" onClick={() => onEdit(reminder)}>
              <Edit className="h-4 w-4" />
              {t('edit')}
            </Button>
            <Button variant="destructive" className="gap-2" onClick={() => onDelete(reminder)}>
              <Trash2 className="h-4 w-4" />
              {t('delete')}
            </Button>
          </div>
        </div>
      </div>
    </ResizableSheet>
  );
}
