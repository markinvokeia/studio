'use client';

import { cn } from '@/lib/utils';
import { CalendarDays, CalendarRange, LayoutGrid, List } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { CalendarView } from './calendar-types';

interface CalendarViewTabsProps {
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
}

const MOBILE_VIEWS: { view: CalendarView; icon: React.ElementType; labelKey: string }[] = [
  { view: 'day', icon: CalendarDays, labelKey: 'views.day' },
  { view: 'week', icon: CalendarRange, labelKey: 'weekShort' },
  { view: 'month', icon: LayoutGrid, labelKey: 'views.month' },
  { view: 'schedule', icon: List, labelKey: 'views.schedule' },
];

export function CalendarViewTabs({ view, onViewChange }: CalendarViewTabsProps) {
  const t = useTranslations('Calendar');

  // Normalize view for active state
  const activeView = view === '3-day' || view === '2-day' ? 'week' : view;

  return (
    <div className="calendar-view-tabs">
      <div className="flex items-center justify-around">
        {MOBILE_VIEWS.map(({ view: tabView, icon: Icon, labelKey }) => {
          const isActive = activeView === tabView;
          return (
            <button
              key={tabView}
              className={cn(
                'flex flex-col items-center gap-0.5 py-2 px-3 min-w-0 flex-1',
                'text-xs font-medium transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground',
              )}
              onClick={() => onViewChange(tabView)}
            >
              <Icon className={cn('h-5 w-5', isActive && 'stroke-[2.5]')} />
              <span className="truncate">{t(labelKey)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
