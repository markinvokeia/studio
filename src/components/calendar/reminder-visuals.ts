import type * as React from 'react';

import type { CalendarReminderPriority, CalendarReminderStatus } from '@/lib/types';

const DEFAULT_REMINDER_COLOR = '#8b5cf6';

function colorWithAlpha(color: string, alpha: number) {
  const normalized = color.trim();
  const shortHexMatch = /^#([0-9a-f]{3})$/i.exec(normalized);
  const longHexMatch = /^#([0-9a-f]{6})$/i.exec(normalized);
  const hex = shortHexMatch
    ? shortHexMatch[1].split('').map((char) => `${char}${char}`).join('')
    : longHexMatch?.[1];

  if (hex) {
    const red = parseInt(hex.slice(0, 2), 16);
    const green = parseInt(hex.slice(2, 4), 16);
    const blue = parseInt(hex.slice(4, 6), 16);
    return `rgb(${red} ${green} ${blue} / ${alpha})`;
  }

  return `color-mix(in srgb, ${normalized} ${alpha * 100}%, white)`;
}

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

export function getReminderCardStyle(color?: string | null, done = false): React.CSSProperties {
  const baseColor = color || DEFAULT_REMINDER_COLOR;

  if (done) {
    return {
      '--reminder-bg': 'rgb(249 250 251)',
      '--reminder-border': colorWithAlpha(baseColor, 0.28),
      '--reminder-color': baseColor,
    } as React.CSSProperties;
  }

  return {
    '--reminder-bg': colorWithAlpha(baseColor, 0.16),
    '--reminder-border': colorWithAlpha(baseColor, 0.42),
    '--reminder-color': baseColor,
  } as React.CSSProperties;
}
