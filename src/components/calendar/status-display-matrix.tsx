'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { getStatusIcon } from '@/components/appointments/status-icons';
import { GOOGLE_CALENDAR_COLORS } from '@/components/calendar/calendar-constants';
import { statusBadgeClassNames, statusBadgeInlineStyle } from '@/lib/appointment-status-display';
import type {
  AppointmentStatus,
  AppointmentStatusDisplay,
  AppointmentStatusDisplayMatrix,
  StatusBadgeStyle,
  StatusCalendarMode,
} from '@/lib/types';
import { cn } from '@/lib/utils';

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const CALENDAR_MODES: StatusCalendarMode[] = ['always', 'preference', 'never'];
const BADGE_STYLES: StatusBadgeStyle[] = ['solid', 'soft', 'outline'];

export interface StatusDisplayMatrixProps {
  statuses: AppointmentStatus[];
  matrix: AppointmentStatusDisplayMatrix;
  onChange: (status: AppointmentStatus, patch: Partial<AppointmentStatusDisplay>) => void;
  disabled?: boolean;
}

/**
 * Tabla editable de la matriz de colores de estado. Precedente de UI:
 * `permission-matrix.tsx` (tarjeta + filas), pero el contenido de cada fila es
 * propio: swatch de color, selects de modo/badge y una vista previa real.
 */
export function StatusDisplayMatrix({ statuses, matrix, onChange, disabled }: StatusDisplayMatrixProps) {
  const t = useTranslations('CalendarColorsPage');
  const tStatus = useTranslations('AppointmentStatus');

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-xs font-medium text-muted-foreground">
            <th className="px-3 py-2.5">{t('table.status')}</th>
            <th className="px-3 py-2.5">{t('table.color')}</th>
            <th className="px-3 py-2.5">{t('table.calendarMode')}</th>
            <th className="px-3 py-2.5">{t('table.badgeStyle')}</th>
            <th className="px-3 py-2.5">{t('table.preview')}</th>
          </tr>
        </thead>
        <tbody>
          {statuses.map((status) => {
            const display = matrix[status];
            const Icon = getStatusIcon(status);
            return (
              <tr key={status} className="border-b last:border-b-0">
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2 font-medium">
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    {tStatus(status)}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <ColorPicker
                    color={display.color}
                    disabled={disabled}
                    onChange={(color) => onChange(status, { color })}
                  />
                </td>
                <td className="px-3 py-2.5">
                  <Select
                    value={display.calendarMode}
                    disabled={disabled}
                    onValueChange={(v) => onChange(status, { calendarMode: v as StatusCalendarMode })}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CALENDAR_MODES.map((mode) => (
                        <SelectItem key={mode} value={mode}>
                          {t(`calendarMode.${mode}.label`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-2.5">
                  <Select
                    value={display.badgeStyle}
                    disabled={disabled}
                    onValueChange={(v) => onChange(status, { badgeStyle: v as StatusBadgeStyle })}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BADGE_STYLES.map((style) => (
                        <SelectItem key={style} value={style}>
                          {t(`badgeStyle.${style}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-2.5">
                  <Badge
                    variant="custom"
                    className={cn('gap-1 capitalize', statusBadgeClassNames(display))}
                    style={statusBadgeInlineStyle(display)}
                  >
                    <Icon className="h-3 w-3" />
                    {tStatus(status)}
                  </Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Swatch + popover: 11 presets de Google Calendar + hex libre + `<input type="color">`. */
function ColorPicker({
  color,
  onChange,
  disabled,
}: {
  color: string;
  onChange: (color: string) => void;
  disabled?: boolean;
}) {
  const t = useTranslations('CalendarColorsPage');
  const [draft, setDraft] = React.useState(color);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (open) setDraft(color);
  }, [open, color]);

  const commitDraft = () => {
    if (HEX_RE.test(draft)) onChange(draft);
    else setDraft(color);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="h-4 w-4 shrink-0 rounded-full border" style={{ backgroundColor: color }} />
          <span className="tabular-nums">{color}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-3">
        <div className="grid grid-cols-6 gap-1.5">
          {GOOGLE_CALENDAR_COLORS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              title={preset.hex}
              onClick={() => {
                onChange(preset.hex);
                setOpen(false);
              }}
              className={cn(
                'h-6 w-6 rounded-full border-2 transition-transform hover:scale-110',
                preset.hex.toLowerCase() === color.toLowerCase() ? 'border-foreground' : 'border-transparent',
              )}
              style={{ backgroundColor: preset.hex }}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={HEX_RE.test(draft) ? draft : '#000000'}
            onChange={(e) => {
              setDraft(e.target.value);
              onChange(e.target.value);
            }}
            className="h-8 w-8 shrink-0 cursor-pointer rounded border p-0.5"
            aria-label={t('table.color')}
          />
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitDraft}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitDraft();
            }}
            className="h-8 font-mono text-xs"
            maxLength={7}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
