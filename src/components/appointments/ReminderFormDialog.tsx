'use client';

import * as React from 'react';
import { addMinutes, format, getDate, getISODay, isValid, parse, parseISO } from 'date-fns';
import { BellRing, FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { getPriorityColor, isReminderAuthor } from '@/lib/reminders';
import { cn, toLocalISOString } from '@/lib/utils';

import type {
  Calendar,
  CalendarItemType,
  CalendarReminder,
  CalendarReminderPriority,
  CalendarItemScope,
  CalendarReminderVisibility,
  ReminderRecurrence,
  ReminderRecurrenceEndMode,
  ReminderRecurrenceFreq,
} from '@/lib/types';

export interface ReminderFormValues {
  type: CalendarItemType;
  calendar_id: string | null;
  title: string;
  description?: string | null;
  start_datetime: string;
  end_datetime: string;
  color: string;
  priority: CalendarReminderPriority;
  visibility: CalendarReminderVisibility;
  is_all_day: boolean;
  /** `null` = ítem suelto. Con regla, el backend crea o actualiza la serie. */
  recurrence: ReminderRecurrence | null;
}

interface ReminderFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDate?: Date | null;
  initialType?: CalendarItemType;
  initialCalendarId?: string | null;
  calendars: Calendar[];
  /** Usuario en sesión: define si el alcance del ítem que se edita se puede cambiar. */
  currentUserId?: string | null;
  /** Alcance elegido en `ReminderScopeDialog`. Al editar UNA ocurrencia de una serie, el
   *  editor de repetición no se muestra: cambiar la regla desde ahí sería una edición de
   *  serie disfrazada, y el backend la ignora. */
  scope?: CalendarItemScope;
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
  currentUserId,
  scope = 'occurrence',
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
  // Hora de fin, no duración: un ítem largo se lee mucho mejor como "09:00 → 17:00" que
  // como "09:00 + 480 min". El payload no cambia; sigue viajando `end_datetime`.
  const [endTime, setEndTime] = React.useState(format(addMinutes(new Date(), DEFAULT_DURATION_MINUTES), 'HH:mm'));
  const [isAllDay, setIsAllDay] = React.useState(false);
  const [isRecurring, setIsRecurring] = React.useState(false);
  const [freq, setFreq] = React.useState<ReminderRecurrenceFreq>('WEEKLY');
  const [repeatInterval, setRepeatInterval] = React.useState('1');
  const [weekdays, setWeekdays] = React.useState<number[]>([]);
  const [monthDay, setMonthDay] = React.useState('1');
  const [endMode, setEndMode] = React.useState<ReminderRecurrenceEndMode>('never');
  const [untilDate, setUntilDate] = React.useState('');
  const [occurrenceCount, setOccurrenceCount] = React.useState('10');
  const [priority, setPriority] = React.useState<CalendarReminderPriority>('MEDIUM');
  const [visibility, setVisibility] = React.useState<CalendarReminderVisibility>('clinic');
  const [calendarId, setCalendarId] = React.useState<string | null>(null);
  const [color, setColor] = React.useState(getPriorityColor('MEDIUM'));
  const [error, setError] = React.useState<string | null>(null);
  const isColorManuallySelectedRef = React.useRef(false);
  const itemType = editingReminder?.type ?? initialType;
  const isNote = itemType === 'note';
  // El alcance solo lo cambia el autor. Si B marcara "solo para mí" un ítem creado por A,
  // el backend preserva created_by = A: el ítem pasaría a ser personal DE A y
  // desaparecería del calendario de B, sin forma de revertirlo desde la UI.
  const isScopeLocked = !!editingReminder && !isReminderAuthor(editingReminder, currentUserId);
  // Editar una sola ocurrencia no puede tocar la regla: el backend ignora `recurrence`
  // cuando el alcance es 'occurrence', así que mostrar el editor prometería algo que no pasa.
  const isSingleOccurrenceEdit = Boolean(editingReminder?.series_id) && scope === 'occurrence';

  React.useEffect(() => {
    if (!open) return;

    const start = parseLocalDateTime(editingReminder?.start_datetime) ?? initialDate ?? new Date();
    const end = parseLocalDateTime(editingReminder?.end_datetime);
    const allDay = editingReminder?.is_all_day ?? false;
    const nextPriority = editingReminder?.priority ?? 'MEDIUM';
    const persistedColor = normalizeSelectableColor(editingReminder?.color);

    setTitle(editingReminder?.title ?? '');
    setDescription(editingReminder?.description ?? '');
    setDate(format(start, 'yyyy-MM-dd'));
    setIsAllDay(allDay);
    // Un ítem de todo el día guarda 00:00–23:59, que como horas sugeridas no sirven de
    // nada si se destilda la casilla: se siembran las de un ítem normal.
    setTime(allDay ? format(new Date(), 'HH:mm') : format(start, 'HH:mm'));
    setEndTime(format(
      !allDay && end && end > start ? end : addMinutes(allDay ? new Date() : start, DEFAULT_DURATION_MINUTES),
      'HH:mm',
    ));
    const recurrence = editingReminder?.recurrence ?? null;
    setIsRecurring(recurrence !== null);
    setFreq(recurrence?.freq ?? 'WEEKLY');
    setRepeatInterval(String(recurrence?.interval ?? 1));
    // Sin regla previa, se siembra con el día de la fecha elegida: es lo que el usuario
    // acaba de decir que quiere, y evita que "Repetir" arranque sin ningún día marcado.
    setWeekdays(recurrence?.byweekday?.length ? [...recurrence.byweekday] : [getISODay(start)]);
    setMonthDay(String(recurrence?.by_month_day ?? getDate(start)));
    setEndMode(recurrence?.end_mode ?? 'never');
    setUntilDate(recurrence?.until_date ?? '');
    setOccurrenceCount(String(recurrence?.occurrence_count ?? 10));
    setPriority(nextPriority);
    setVisibility(editingReminder?.visibility ?? 'clinic');
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
    // Con "todo el día" las horas las fija la convención de la tabla (00:00:00–23:59:59 del
    // mismo día, atada por reminders_all_day_range_check), no los inputs, que están ocultos.
    const start = isAllDay
      ? parse(`${date} 00:00:00`, 'yyyy-MM-dd HH:mm:ss', new Date())
      : parse(`${date} ${time}`, 'yyyy-MM-dd HH:mm', new Date());
    const end = isAllDay
      ? parse(`${date} 23:59:59`, 'yyyy-MM-dd HH:mm:ss', new Date())
      : parse(`${date} ${endTime}`, 'yyyy-MM-dd HH:mm', new Date());

    if (!cleanTitle) {
      setError(t('titleRequired'));
      return;
    }
    if (!isValid(start) || !isValid(end)) {
      setError(t('dateTimeRequired'));
      return;
    }
    // Estrictamente mayor: un ítem de duración cero se dibujaría con `height: 0` en la
    // rejilla, o sea invisible. El respaldo en la base es reminders_time_range_check.
    if (end <= start) {
      setError(t('endTimeInvalid'));
      return;
    }

    let recurrence: ReminderRecurrence | null = null;
    if (isRecurring && !isSingleOccurrenceEdit) {
      const everyN = Number(repeatInterval);
      if (!Number.isInteger(everyN) || everyN < 1 || everyN > 52) {
        setError(t('recurrence.intervalInvalid'));
        return;
      }
      if (freq === 'WEEKLY' && weekdays.length === 0) {
        setError(t('recurrence.weekdaysRequired'));
        return;
      }
      const times = Number(occurrenceCount);
      if (endMode === 'count' && (!Number.isInteger(times) || times < 1)) {
        setError(t('recurrence.countInvalid'));
        return;
      }
      // La fecha de corte tiene que dejar entrar al menos al ancla, o la serie nace vacía.
      if (endMode === 'until' && (!untilDate || untilDate < date)) {
        setError(t('recurrence.untilInvalid'));
        return;
      }

      recurrence = {
        freq,
        interval: everyN,
        byweekday: freq === 'WEEKLY' ? [...weekdays].sort((a, b) => a - b) : null,
        by_month_day: freq === 'MONTHLY' ? Number(monthDay) : null,
        end_mode: endMode,
        until_date: endMode === 'until' ? untilDate : null,
        occurrence_count: endMode === 'count' ? times : null,
      };
    }

    onSave({
      type: itemType,
      calendar_id: calendarId,
      title: cleanTitle,
      description: description.trim() || null,
      start_datetime: toLocalISOString(start),
      end_datetime: toLocalISOString(end),
      color,
      priority,
      visibility,
      is_all_day: isAllDay,
      recurrence,
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

            <div className={cn('grid gap-4', isAllDay ? 'sm:grid-cols-1' : 'sm:grid-cols-3')}>
              <div className="space-y-2">
                <Label htmlFor="reminder-date">{t('dateLabel')}</Label>
                <DatePickerInput value={date} onChange={setDate} />
              </div>
              {!isAllDay && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="reminder-time">{t('timeLabel')}</Label>
                    <Input
                      id="reminder-time"
                      data-testid="reminder-start-time"
                      type="time"
                      value={time}
                      onChange={(event) => setTime(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reminder-end-time">{t('endTimeLabel')}</Label>
                    <Input
                      id="reminder-end-time"
                      data-testid="reminder-end-time"
                      type="time"
                      value={endTime}
                      onChange={(event) => setEndTime(event.target.value)}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Todo el día. Al marcarlo, las horas las fija la convención de la tabla, así
                que los dos inputs de hora se ocultan en vez de quedar inertes. */}
            <div className="flex items-start gap-3 rounded-lg border p-3">
              <Checkbox
                id="reminder-all-day"
                data-testid="reminder-all-day"
                className="mt-0.5"
                checked={isAllDay}
                onCheckedChange={(checked) => setIsAllDay(checked === true)}
              />
              <div className="space-y-1 leading-none">
                <Label htmlFor="reminder-all-day" className="font-normal">{t('allDayLabel')}</Label>
                <p className="text-xs text-muted-foreground">{t('allDayHint')}</p>
              </div>
            </div>

            {/* Repetición. La fecha de arriba es el ancla de la serie: la regla se aplica
                desde ahí. Los campos auxiliares aparecen solo en su patrón, igual que en
                el formulario de disponibilidad del doctor. */}
            {!isSingleOccurrenceEdit && (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="reminder-repeat"
                  data-testid="reminder-repeat"
                  className="mt-0.5"
                  checked={isRecurring}
                  onCheckedChange={(checked) => setIsRecurring(checked === true)}
                />
                <div className="space-y-1 leading-none">
                  <Label htmlFor="reminder-repeat" className="font-normal">{t('repeatLabel')}</Label>
                  <p className="text-xs text-muted-foreground">{t('repeatHint')}</p>
                </div>
              </div>

              {isRecurring && (
                <div className="space-y-3 border-t pt-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="reminder-freq">{t('recurrence.freqLabel')}</Label>
                      <Select value={freq} onValueChange={(value) => setFreq(value as ReminderRecurrenceFreq)}>
                        <SelectTrigger id="reminder-freq" data-testid="reminder-freq">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="DAILY">{t('recurrence.freq.daily')}</SelectItem>
                          <SelectItem value="WEEKLY">{t('recurrence.freq.weekly')}</SelectItem>
                          <SelectItem value="MONTHLY">{t('recurrence.freq.monthly')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reminder-interval">{t('recurrence.intervalLabel')}</Label>
                      <Input
                        id="reminder-interval"
                        data-testid="reminder-interval"
                        type="number"
                        min={1}
                        max={52}
                        value={repeatInterval}
                        onChange={(event) => setRepeatInterval(event.target.value)}
                      />
                    </div>
                  </div>

                  {freq === 'WEEKLY' && (
                    <div className="space-y-2">
                      <Label>{t('recurrence.weekdaysLabel')}</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                          <Button
                            key={day}
                            type="button"
                            size="sm"
                            variant={weekdays.includes(day) ? 'default' : 'outline'}
                            data-testid={`reminder-weekday-${day}`}
                            className="h-8 min-w-11 px-2 text-xs capitalize"
                            onClick={() => setWeekdays((prev) => (
                              prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
                            ))}
                          >
                            {t(`recurrence.weekdayShort.${day}`)}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {freq === 'MONTHLY' && (
                    <div className="space-y-2">
                      <Label htmlFor="reminder-month-day">{t('recurrence.monthDayLabel')}</Label>
                      <Input
                        id="reminder-month-day"
                        data-testid="reminder-month-day"
                        type="number"
                        min={1}
                        max={31}
                        value={monthDay}
                        onChange={(event) => setMonthDay(event.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">{t('recurrence.monthlyClampHint')}</p>
                    </div>
                  )}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="reminder-end-mode">{t('recurrence.endLabel')}</Label>
                      <Select value={endMode} onValueChange={(value) => setEndMode(value as ReminderRecurrenceEndMode)}>
                        <SelectTrigger id="reminder-end-mode" data-testid="reminder-end-mode">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="never">{t('recurrence.end.never')}</SelectItem>
                          <SelectItem value="until">{t('recurrence.end.until')}</SelectItem>
                          <SelectItem value="count">{t('recurrence.end.count')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {endMode === 'until' && (
                      <div className="space-y-2">
                        <Label htmlFor="reminder-until-date">{t('recurrence.untilDateLabel')}</Label>
                        <DatePickerInput value={untilDate} onChange={setUntilDate} />
                      </div>
                    )}
                    {endMode === 'count' && (
                      <div className="space-y-2">
                        <Label htmlFor="reminder-count">{t('recurrence.countLabel')}</Label>
                        <Input
                          id="reminder-count"
                          data-testid="reminder-count"
                          type="number"
                          min={1}
                          value={occurrenceCount}
                          onChange={(event) => setOccurrenceCount(event.target.value)}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            )}

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

            {/* Alcance. Sin marcar (el default) el ítem es del equipo: todo el staff lo
                ve, lo edita y lo elimina. Aplica a notas y a recordatorios. */}
            <div className="flex items-start gap-3 rounded-lg border p-3">
              <Checkbox
                id="reminder-only-me"
                data-testid="reminder-only-me"
                className="mt-0.5"
                checked={visibility === 'personal'}
                disabled={isScopeLocked}
                onCheckedChange={(checked) => setVisibility(checked === true ? 'personal' : 'clinic')}
              />
              <div className="space-y-1 leading-none">
                <Label htmlFor="reminder-only-me" className="font-normal">{t('onlyForMeLabel')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t(isScopeLocked ? 'onlyForMeLockedHint' : 'onlyForMeHint')}
                </p>
              </div>
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
