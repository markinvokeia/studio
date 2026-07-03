'use client';

import React from 'react';
import { ChevronDown, Eye } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

import type { CalendarView } from './calendar-types';

interface ViewMenuCalendar {
  id: string;
  name: string;
  color?: string;
}

interface ViewMenuSedeGroup {
  id: string;
  name: string;
  calendars: ViewMenuCalendar[];
}

interface CalendarViewMenuProps {
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
  /** Calendars grouped by sede (from `calendarSedeGroups.sedeGroups`). */
  sedeGroups: ViewMenuSedeGroup[];
  /** Calendars without a sede. */
  noSede: ViewMenuCalendar[];
  /** Ids of currently-visible calendars. */
  selectedCalendarIds: string[];
  /** Toggle a single calendar's visibility. */
  onToggleCalendar: (calendarId: string, checked: boolean) => void;
}

/** View options (custom mode) — day counts, month and "list", each mapped to a CalendarView. */
const VIEW_OPTIONS: { view: CalendarView; labelKey: string }[] = [
  { view: 'day', labelKey: 'views.1day' },
  { view: '2-day', labelKey: 'views.2day' },
  { view: '3-day', labelKey: 'views.3day' },
  { view: '4-day', labelKey: 'views.4day' },
  { view: '5-day', labelKey: 'views.5day' },
  { view: '6-day', labelKey: 'views.6day' },
  { view: 'week', labelKey: 'views.week' },
  { view: 'month', labelKey: 'views.month' },
  { view: 'schedule', labelKey: 'views.list' },
];

/**
 * Desktop "Ver" dropdown (custom mode): pick the view (1–7 days, month, list) and
 * toggle which agendas are visible (governs the left Agendas panel).
 */
export function CalendarViewMenu({
  view,
  onViewChange,
  sedeGroups,
  noSede,
  selectedCalendarIds,
  onToggleCalendar,
}: CalendarViewMenuProps) {
  const t = useTranslations('Calendar');
  const selectedSet = React.useMemo(() => new Set(selectedCalendarIds), [selectedCalendarIds]);

  const renderCalendar = (cal: ViewMenuCalendar) => (
    <DropdownMenuCheckboxItem
      key={cal.id}
      checked={selectedSet.has(cal.id)}
      onCheckedChange={(v) => onToggleCalendar(cal.id, v === true)}
      onSelect={(e) => e.preventDefault()}
    >
      <span
        className="mr-2 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: cal.color || 'hsl(var(--muted-foreground))' }}
      />
      <span className="truncate">{cal.name}</span>
    </DropdownMenuCheckboxItem>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-11 gap-1.5">
          <Eye className="h-4 w-4" />
          {t('view')}
          <ChevronDown className="h-3.5 w-3.5 opacity-80" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 max-h-[70vh] overflow-y-auto">
        <DropdownMenuRadioGroup value={view} onValueChange={(v) => onViewChange(v as CalendarView)}>
          {VIEW_OPTIONS.map((opt) => (
            <DropdownMenuRadioItem key={opt.view} value={opt.view}>
              {t(opt.labelKey)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t('agendas')}</DropdownMenuLabel>
        {sedeGroups.map((group) => (
          <React.Fragment key={group.id}>
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              {group.name}
            </DropdownMenuLabel>
            {group.calendars.map(renderCalendar)}
          </React.Fragment>
        ))}
        {noSede.map(renderCalendar)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
