'use client';

import * as React from 'react';
import { Check, Edit, Palette, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { CalendarReminder } from '@/lib/types';

import { GOOGLE_CALENDAR_COLORS } from './calendar-constants';
import { ActionRow, ActionSeparator, MobileActionSheet } from './mobile-action-sheet';
import { ReminderSummary } from './reminder-quick-view';

interface ReminderMobileSheetProps {
  /** Ítem a mostrar; `null` cierra el sheet. */
  reminder: CalendarReminder | null;
  onClose: () => void;
  calendarName?: string | null;
  locale?: string;
  /** Hay un "marcar hecho", borrado o cambio de color de este ítem en vuelo. */
  isActionPending?: boolean;
  onEdit: (reminder: CalendarReminder) => void;
  onMarkDone: (reminder: CalendarReminder) => void;
  onDelete: (reminder: CalendarReminder) => void;
  onColorChange: (reminder: CalendarReminder, colorId: string) => void;
}

/**
 * Sheet inferior con la ficha y las acciones de una nota o recordatorio, para
 * móvil. Hermano de `AppointmentMobileSheet`: reemplaza al menú contextual de la
 * card, cuyo long-press competía con el arrastre.
 */
export function ReminderMobileSheet({
  reminder,
  onClose,
  calendarName,
  locale = 'es',
  isActionPending = false,
  onEdit,
  onMarkDone,
  onDelete,
  onColorChange,
}: ReminderMobileSheetProps) {
  const t = useTranslations('Reminders');
  const tSheet = useTranslations('CalendarMobileSheet');
  const tPanel = useTranslations('AppointmentPanel');

  // Se conserva el último ítem para que el contenido no desaparezca mientras
  // corre la animación de cierre.
  const [shown, setShown] = React.useState<CalendarReminder | null>(reminder);
  const [page, setPage] = React.useState<'main' | 'color'>('main');
  if (reminder && reminder !== shown) {
    if (reminder.id !== shown?.id) setPage('main');
    setShown(reminder);
  }

  if (!shown) return null;
  const current = shown;
  const closeThen = (fn: (reminder: CalendarReminder) => void) => () => { onClose(); fn(current); };

  return (
    <MobileActionSheet
      open={!!reminder}
      onClose={onClose}
      title={tSheet('reminderTitle')}
      pageTitle={page === 'color' ? tPanel('changeColor') : undefined}
      onBack={page === 'main' ? undefined : () => setPage('main')}
      backLabel={tSheet('back')}
      closeLabel={tSheet('close')}
      data-testid="reminder-mobile-sheet"
    >
      {page === 'color' ? (
        <div className="grid grid-cols-6 gap-3 p-3">
          {GOOGLE_CALENDAR_COLORS.map((color) => (
            <button
              key={color.id}
              type="button"
              disabled={isActionPending}
              aria-label={color.hex}
              className="aspect-square w-full rounded-full disabled:opacity-50"
              style={{ backgroundColor: color.hex }}
              onClick={() => { onColorChange(current, color.id); setPage('main'); }}
            />
          ))}
        </div>
      ) : (
        <>
          <ReminderSummary reminder={current} calendarName={calendarName} locale={locale} className="px-3 pb-3 pt-1" />
          <ActionSeparator />
          {current.status !== 'done' && (
            <ActionRow icon={Check} label={t('markDone')} disabled={isActionPending} onClick={closeThen(onMarkDone)} />
          )}
          <ActionRow icon={Edit} label={t('edit')} onClick={closeThen(onEdit)} />
          <ActionRow icon={Palette} label={tPanel('changeColor')} chevron disabled={isActionPending} onClick={() => setPage('color')} />
          <ActionSeparator />
          <ActionRow icon={Trash2} label={t('delete')} destructive disabled={isActionPending} onClick={closeThen(onDelete)} />
        </>
      )}
    </MobileActionSheet>
  );
}
