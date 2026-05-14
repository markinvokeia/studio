'use client';

import * as React from 'react';
import { addMinutes, format, isValid, parse, parseISO } from 'date-fns';
import { BellRing } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { MagicWandButton } from '@/components/ai/magic-wand-button';
import { getPriorityColor } from '@/lib/reminders';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useLocalAI } from '@/hooks/use-local-ai';
import { toLocalISOString } from '@/lib/utils';
import type { CalendarReminder, CalendarReminderPriority } from '@/lib/types';

export interface ReminderFormValues {
  title: string;
  description?: string | null;
  start_datetime: string;
  end_datetime: string;
  color: string;
  priority: CalendarReminderPriority;
}

interface ReminderFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDate?: Date | null;
  editingReminder?: CalendarReminder | null;
  onSave: (values: ReminderFormValues) => void;
}

const DEFAULT_DURATION_MINUTES = 15;

function parseLocalDateTime(value?: string | null): Date | null {
  if (!value) return null;
  const parsed = parseISO(value.replace(/Z$/, ''));
  return isValid(parsed) ? parsed : null;
}

export function ReminderFormDialog({
  open,
  onOpenChange,
  initialDate,
  editingReminder,
  onSave,
}: ReminderFormDialogProps) {
  const t = useTranslations('Reminders');
  const tGeneral = useTranslations('General');
  const { enhanceText, isReady: aiReady } = useLocalAI();

  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [date, setDate] = React.useState(format(new Date(), 'yyyy-MM-dd'));
  const [time, setTime] = React.useState(format(new Date(), 'HH:mm'));
  const [duration, setDuration] = React.useState(String(DEFAULT_DURATION_MINUTES));
  const [priority, setPriority] = React.useState<CalendarReminderPriority>('MEDIUM');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;

    const start = parseLocalDateTime(editingReminder?.start_datetime) ?? initialDate ?? new Date();
    const end = parseLocalDateTime(editingReminder?.end_datetime);
    const durationMinutes = end ? Math.max(5, Math.round((end.getTime() - start.getTime()) / 60000)) : DEFAULT_DURATION_MINUTES;

    setTitle(editingReminder?.title ?? '');
    setDescription(editingReminder?.description ?? '');
    setDate(format(start, 'yyyy-MM-dd'));
    setTime(format(start, 'HH:mm'));
    setDuration(String(durationMinutes));
    setPriority(editingReminder?.priority ?? 'MEDIUM');
    setError(null);
  }, [editingReminder, initialDate, open]);

  const handleEnhance = React.useCallback(async () => {
    const [titleResult, descResult] = await Promise.all([
      enhanceText(title, 'reminder-title'),
      description.trim() ? enhanceText(description, 'reminder-description') : Promise.resolve(null),
    ]);
    if (titleResult.text) setTitle(titleResult.text);
    if (descResult?.text) setDescription(descResult.text);
  }, [title, description, enhanceText]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanTitle = title.trim();
    const durationMinutes = Number(duration);
    const start = parse(`${date} ${time}`, 'yyyy-MM-dd HH:mm', new Date());

    if (!cleanTitle) {
      setError(t('titleRequired'));
      return;
    }
    if (!isValid(start)) {
      setError(t('dateTimeRequired'));
      return;
    }
    if (!Number.isFinite(durationMinutes) || durationMinutes < 5) {
      setError(t('durationInvalid'));
      return;
    }

    onSave({
      title: cleanTitle,
      description: description.trim() || null,
      start_datetime: toLocalISOString(start),
      end_datetime: toLocalISOString(addMinutes(start, durationMinutes)),
      color: getPriorityColor(priority),
      priority,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent maxWidth="md">
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BellRing className="h-5 w-5" />
              {editingReminder ? t('editTitle') : t('createTitle')}
            </DialogTitle>
            <DialogDescription>{t('dialogDescription')}</DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4 px-6 py-5">
            {error && (
              <div className="rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="reminder-title">{t('titleLabel')}</Label>
              <Input
                id="reminder-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t('titlePlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reminder-description">{t('descriptionLabel')}</Label>
              <Textarea
                id="reminder-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={t('descriptionPlaceholder')}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="reminder-date">{t('dateLabel')}</Label>
                <Input id="reminder-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reminder-time">{t('timeLabel')}</Label>
                <Input id="reminder-time" type="time" value={time} onChange={(event) => setTime(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reminder-duration">{t('durationLabel')}</Label>
                <Input
                  id="reminder-duration"
                  type="number"
                  min={5}
                  step={5}
                  value={duration}
                  onChange={(event) => setDuration(event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('priorityLabel')}</Label>
              <Select value={priority} onValueChange={(value) => setPriority(value as CalendarReminderPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">{t('priority.low')}</SelectItem>
                  <SelectItem value="MEDIUM">{t('priority.medium')}</SelectItem>
                  <SelectItem value="HIGH">{t('priority.high')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </DialogBody>

          <DialogFooter className="justify-between">
            {aiReady ? (
              <MagicWandButton
                onEnhance={handleEnhance}
                tooltipText={t('enhanceTooltip')}
                disabled={!title.trim()}
              />
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {tGeneral('cancel')}
              </Button>
              <Button type="submit">{editingReminder ? t('saveEdit') : t('saveCreate')}</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
