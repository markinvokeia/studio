import type * as React from 'react';

import type { CalendarReminder, CalendarReminderPriority, CalendarReminderStatus } from '@/lib/types';

import { getReadableTextColor } from './calendar-utils';

const DEFAULT_REMINDER_COLOR = '#8b5cf6';

export function getReminderPriorityColor(priority?: CalendarReminderPriority | null) {
  switch (priority) {
    case 'HIGH':
      return '#f97316';
    case 'LOW':
      return '#64748b';
    case 'MEDIUM':
    default:
      return '#8b5cf6';
  }
}

export function isReminderDone(status?: CalendarReminderStatus | string | null) {
  return status === 'done';
}

export function isGeneralReminder(reminder?: Pick<CalendarReminder, 'visibility'> | null) {
  return reminder?.visibility === 'clinic';
}

export function getReminderCardStyle(color?: string | null, done = false): React.CSSProperties {
  const baseColor = color || DEFAULT_REMINDER_COLOR;

  if (done) {
    return {
      backgroundColor: 'rgb(249 250 251)',
      color: 'rgb(107 114 128)',
      '--reminder-bg': 'rgb(249 250 251)',
      '--reminder-border': baseColor,
      '--reminder-color': baseColor,
      '--reminder-foreground': 'rgb(107 114 128)',
    } as React.CSSProperties;
  }

  const foregroundColor = getReadableTextColor(baseColor);

  return {
    backgroundColor: baseColor,
    color: foregroundColor,
    '--reminder-bg': baseColor,
    '--reminder-border': baseColor,
    '--reminder-color': baseColor,
    '--reminder-foreground': foregroundColor,
  } as React.CSSProperties;
}
