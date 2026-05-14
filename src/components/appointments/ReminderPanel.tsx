'use client';

import * as React from 'react';
import { format, parseISO } from 'date-fns';
import { BellRing, Calendar, CalendarDays, CheckCircle2, Clock, Edit, FileText, Flag, Info, Receipt, ShoppingCart, Sparkles, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

import { MagicWandButton } from '@/components/ai/magic-wand-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ResizableSheet, SheetDescription, SheetTitle } from '@/components/ui/resizable-sheet';
import { useLocalAI } from '@/hooks/use-local-ai';
import type { NoteActionKey } from '@/hooks/use-local-ai';
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

// ── AI action metadata ────────────────────────────────────────────────────────
const ACTION_ICONS: Record<NoteActionKey, React.ReactNode> = {
  CALENDAR: <Calendar className="h-3 w-3" />,
  QUOTE:    <FileText className="h-3 w-3" />,
  INVOICE:  <Receipt className="h-3 w-3" />,
  PURCHASE: <ShoppingCart className="h-3 w-3" />,
};

const FALLBACK_REDIRECT: Record<NoteActionKey, string> = {
  CALENDAR: '/appointments?act=Crear',
  QUOTE:    '/users?t=Presupuestos&act=Crear',
  INVOICE:  '/users?t=Facturas&act=Crear',
  PURCHASE: '/purchases/providers',
};

interface ActionButton {
  key: NoteActionKey;
  label: string;
  icon: React.ReactNode;
  href: string;
}

interface Enhancement {
  title: string;
  description: string;
  actionButtons: ActionButton[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
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

// ── Component ─────────────────────────────────────────────────────────────────
export function ReminderPanel({
  open,
  onOpenChange,
  reminder,
  onEdit,
  onMarkDone,
  onDelete,
}: ReminderPanelProps) {
  const t = useTranslations('Reminders');
  const locale = useLocale();
  const router = useRouter();
  const { enhanceText, isReady: aiReady } = useLocalAI();

  const [enhancement, setEnhancement] = React.useState<Enhancement | null>(null);

  // Reset AI state when switching to a different reminder
  React.useEffect(() => {
    setEnhancement(null);
  }, [reminder?.id]);

  const actionLabels = React.useMemo<Record<NoteActionKey, string>>(
    () => ({
      CALENDAR: t('actionNewAppointment'),
      QUOTE:    t('actionNewQuote'),
      INVOICE:  t('actionNewInvoice'),
      PURCHASE: t('actionNewPurchase'),
    }),
    [t],
  );

  const handleEnhance = React.useCallback(async () => {
    if (!reminder) return;

    const [titleResult, descResult] = await Promise.all([
      enhanceText(reminder.title, 'reminder-title'),
      reminder.description
        ? enhanceText(reminder.description, 'reminder-description')
        : Promise.resolve(null),
    ]);

    // Deduplicate actions across both results, preserving order
    const seen = new Set<NoteActionKey>();
    const actionButtons: ActionButton[] = [];

    for (const result of [titleResult, descResult]) {
      if (!result) continue;
      result.actions.forEach((key, i) => {
        if (seen.has(key)) return;
        seen.add(key);
        const redirect = result.redirects[i] ?? FALLBACK_REDIRECT[key];
        actionButtons.push({
          key,
          label: actionLabels[key],
          icon: ACTION_ICONS[key],
          href: `/${locale}${redirect}`,
        });
      });
    }

    setEnhancement({
      title: titleResult.text,
      description: descResult?.text ?? reminder.description ?? '',
      actionButtons,
    });
  }, [reminder, enhanceText, locale, actionLabels]);

  if (!reminder) return null;

  const startTime = formatLocalTime(reminder.start_datetime);
  const endTime = formatLocalTime(reminder.end_datetime);
  const isDone = reminder.status === 'done';

  const displayTitle = enhancement?.title ?? reminder.title;
  const displayDescription = enhancement?.description ?? reminder.description;
  const reminderForEdit = enhancement
    ? { ...reminder, title: enhancement.title, description: enhancement.description }
    : reminder;

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
        {/* Header */}
        <div className="flex-none border-b border-border px-5 py-4 pr-24">
          <div className="flex items-start gap-3">
            <span
              className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-white shadow-sm"
              style={{ backgroundColor: reminder.color || '#8b5cf6' }}
            >
              <BellRing className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <SheetTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <span className="truncate">{displayTitle}</span>
                {enhancement && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 shrink-0">
                    <Sparkles className="h-2.5 w-2.5" />
                    {t('enhancedLabel')}
                  </span>
                )}
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

        {/* Body */}
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
              {displayDescription && (
                <DetailRow
                  icon={FileText}
                  label={t('descriptionLabel')}
                  value={<span className="whitespace-pre-wrap font-medium">{displayDescription}</span>}
                  tone="warning"
                />
              )}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex-none border-t border-border bg-muted/30 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* AI-detected action shortcuts (left) */}
            <div className="flex flex-wrap items-center gap-1.5">
              {enhancement?.actionButtons.map((action) => (
                <button
                  key={action.key}
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/80 px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                  onClick={() => router.push(action.href)}
                >
                  {action.icon}
                  {action.label}
                </button>
              ))}
            </div>

            {/* Standard action buttons + wand (right) */}
            <div className="flex flex-wrap items-center gap-2">
              {aiReady && (
                <MagicWandButton
                  onEnhance={handleEnhance}
                  tooltipText={t('enhanceTooltip')}
                />
              )}
              {!isDone && (
                <Button variant="outline" className="gap-2" onClick={() => onMarkDone(reminder)}>
                  <CheckCircle2 className="h-4 w-4" />
                  {t('markDone')}
                </Button>
              )}
              <Button variant="outline" className="gap-2" onClick={() => onEdit(reminderForEdit)}>
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
      </div>
    </ResizableSheet>
  );
}
