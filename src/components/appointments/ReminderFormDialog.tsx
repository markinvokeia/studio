'use client';

import * as React from 'react';
import { addMinutes, format, isValid, parse, parseISO } from 'date-fns';
import { BellRing, FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { DatePickerInput } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogBody,
  DialogCancelButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

import { MagicWandButton } from '@/components/ai/magic-wand-button';
import { GOOGLE_CALENDAR_COLORS } from '@/components/calendar/calendar-constants';

import { useLocalAI } from '@/hooks/use-local-ai';
import { getPriorityColor } from '@/lib/reminders';
import { cn, toLocalISOString } from '@/lib/utils';

import type { Calendar, CalendarItemType, CalendarReminder, CalendarReminderPriority } from '@/lib/types';

export interface ReminderFormValues {
  type: CalendarItemType;
  calendar_id: string | null;
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
  initialType?: CalendarItemType;
  initialCalendarId?: string | null;
  calendars: Calendar[];
  editingReminder?: CalendarReminder | null;
  onSave: (values: ReminderFormValues) => void;
}

const DEFAULT_DURATION_MINUTES = 15;
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

function normalizeSelectableColor(value?: string | null): string | null {
  const rawColor = value?.trim();
  if (!rawColor) return null;

  const paletteColor = GOOGLE_CALENDAR_COLORS.find((option) => option.id === rawColor);
  if (paletteColor) return paletteColor.hex;

  return HEX_COLOR_PATTERN.test(rawColor) ? rawColor.toLowerCase() : null;
}

function getDefaultColor(
  calendars: Calendar[],
  calendarId: string | null,
  priority: CalendarReminderPriority,
): string {
  const calendar = calendarId
    ? calendars.find((option) => String(option.id) === calendarId)
    : null;

  return normalizeSelectableColor(calendar?.color) ?? getPriorityColor(priority);
}

function parseLocalDateTime(value?: string | null): Date | null {
  if (!value) return null;
  const parsed = parseISO(value.replace(/Z$/, ''));
  return isValid(parsed) ? parsed : null;
}

export function ReminderFormDialog({
  open,
  onOpenChange,
  initialDate,
  initialType = 'reminder',
  initialCalendarId = null,
  calendars,
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
  const [calendarId, setCalendarId] = React.useState<string | null>(null);
  const [color, setColor] = React.useState(getPriorityColor('MEDIUM'));
  const [error, setError] = React.useState<string | null>(null);
  const isColorManuallySelectedRef = React.useRef(false);
  const itemType = editingReminder?.type ?? initialType;
  const isNote = itemType === 'note';

  React.useEffect(() => {
    if (!open) return;

    const start = parseLocalDateTime(editingReminder?.start_datetime) ?? initialDate ?? new Date();
    const end = parseLocalDateTime(editingReminder?.end_datetime);
    const durationMinutes = end ? Math.max(5, Math.round((end.getTime() - start.getTime()) / 60000)) : DEFAULT_DURATION_MINUTES;
    const nextPriority = editingReminder?.priority ?? 'MEDIUM';
    const persistedColor = normalizeSelectableColor(editingReminder?.color);

    setTitle(editingReminder?.title ?? '');
    setDescription(editingReminder?.description ?? '');
    setDate(format(start, 'yyyy-MM-dd'));
    setTime(format(start, 'HH:mm'));
    setDuration(String(durationMinutes));
    setPriority(nextPriority);
    setCalendarId(editingReminder?.calendar_id ?? initialCalendarId);
    setColor(persistedColor ?? getPriorityColor(nextPriority));
    isColorManuallySelectedRef.current = persistedColor !== null;
    setError(null);
  }, [editingReminder, initialCalendarId, initialDate, open]);

  React.useEffect(() => {
    if (!open || isColorManuallySelectedRef.current) return;
    setColor(getDefaultColor(calendars, calendarId, priority));
  }, [calendarId, calendars, open, priority]);

  const handleEnhance = React.useCallback(async () => {
    const [titleResult, descResult] = await Promise.all([
      enhanceText(title, 'reminder-title'),
      description.trim() ? enhanceText(description, 'reminder-description') : Promise.resolve(null),
    ]);
    if (titleResult.text) setTitle(titleResult.text);
    if (descResult?.text) setDescription(descResult.text);
  }, [title, description, enhanceText]);

  const handlePriorityChange = (value: string) => {
    const nextPriority = value as CalendarReminderPriority;
    setPriority(nextPriority);
    if (!isColorManuallySelectedRef.current) {
      setColor(getDefaultColor(calendars, calendarId, nextPriority));
    }
  };

  const handleCalendarChange = (value: string) => {
    const nextCalendarId = value === '__none__' ? null : value;
    setCalendarId(nextCalendarId);
    if (!isColorManuallySelectedRef.current) {
      setColor(getDefaultColor(calendars, nextCalendarId, priority));
    }
  };

  const handleColorChange = (nextColor: string) => {
    isColorManuallySelectedRef.current = true;
    setColor(nextColor);
  };

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
      type: itemType,
      calendar_id: calendarId,
      title: cleanTitle,
      description: description.trim() || null,
      start_datetime: toLocalISOString(start),
      end_datetime: toLocalISOString(addMinutes(start, durationMinutes)),
      color,
      priority,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent maxWidth="md" confirmOnClose isDirty={title.trim() !== ''}>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isNote
                ? <FileText className="h-5 w-5" />
                : <BellRing className="h-5 w-5" />}
              {editingReminder
                ? t((editingReminder.type === 'note' ? 'editNoteTitle' : 'editTitle'))
                : t((initialType === 'note' ? 'createNoteTitle' : 'createTitle'))}
            </DialogTitle>
            <DialogDescription>
              {t(isNote ? 'noteDialogDescription' : 'dialogDescription')}
            </DialogDescription>
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
                <DatePickerInput value={date} onChange={setDate} />
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

            {!isNote && (
              <div className="space-y-2">
                <Label>{t('priorityLabel')}</Label>
                <Select value={priority} onValueChange={handlePriorityChange}>
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
            )}

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label>{t('colorLabel')}</Label>
                <span
                  aria-hidden="true"
                  className="h-4 w-4 rounded-full border border-border shadow-sm"
                  style={{ backgroundColor: color }}
                />
              </div>
              <div
                role="radiogroup"
                aria-label={t('colorLabel')}
                className="flex flex-wrap gap-2"
              >
                {GOOGLE_CALENDAR_COLORS.map((option) => {
                  const isSelected = option.hex.toLowerCase() === color.toLowerCase();

                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      aria-label={`${t('colorLabel')} ${option.id}`}
                      data-testid={`reminder-color-${option.id}`}
                      onClick={() => handleColorChange(option.hex)}
                      className={cn(
                        'h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                        isSelected ? 'border-foreground ring-2 ring-ring ring-offset-2' : 'border-transparent',
                      )}
                      style={{ backgroundColor: option.hex }}
                    />
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('calendarLabel')}</Label>
              <Select
                value={calendarId ?? '__none__'}
                onValueChange={handleCalendarChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t('noCalendar')}</SelectItem>
                  {calendars.filter((calendar) => calendar.is_active || String(calendar.id) === calendarId).map((calendar) => (
                    <SelectItem key={calendar.id} value={String(calendar.id)}>
                      {calendar.name}
                    </SelectItem>
                  ))}
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
              <DialogCancelButton variant="outline">
                {tGeneral('cancel')}
              </DialogCancelButton>
              <Button type="submit">{editingReminder ? t('saveEdit') : t('saveCreate')}</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
