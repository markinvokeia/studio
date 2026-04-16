'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Locale } from 'date-fns';
import { enUS, es } from 'date-fns/locale';
import { useLocale } from 'next-intl';

import type { CalendarView } from '@/components/calendar/calendar-types';
import { computeDateRange, computeHeaderTitle, navigateDate } from '@/components/calendar/calendar-utils';

interface UseCalendarNavigationOptions {
  onDateChange?: (range: { start: Date; end: Date }) => void;
  onViewChange?: (view: CalendarView) => void;
  initialView?: CalendarView;
}

interface UseCalendarNavigationReturn {
  currentDate: Date;
  view: CalendarView;
  headerTitle: string;
  currentTime: Date;
  setCurrentDate: (date: Date) => void;
  setView: (view: CalendarView) => void;
  handlePrev: () => void;
  handleNext: () => void;
  handleToday: () => void;
  handleViewChange: (view: CalendarView) => void;
  dateLocale: Locale;
}

export function useCalendarNavigation({
  onDateChange,
  onViewChange,
  initialView = 'month',
}: UseCalendarNavigationOptions = {}): UseCalendarNavigationReturn {
  const locale = useLocale();
  const dateLocale = locale === 'es' ? es : enUS;

  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>(initialView);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Fire onDateChange when date or view changes
  const handleDateChange = useCallback(
    (start: Date, end: Date) => {
      if (onDateChange) {
        onDateChange({ start, end });
      }
    },
    [onDateChange]
  );

  useEffect(() => {
    const range = computeDateRange(currentDate, view);
    if (range && view !== 'year') {
      handleDateChange(range.start, range.end);
    }
  }, [currentDate, view, handleDateChange]);

  const handlePrev = useCallback(() => {
    setCurrentDate((prev) => navigateDate(prev, view, -1));
  }, [view]);

  const handleNext = useCallback(() => {
    setCurrentDate((prev) => navigateDate(prev, view, 1));
  }, [view]);

  const handleToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  const handleViewChange = useCallback(
    (newView: CalendarView) => {
      setView(newView);
      if (onViewChange) {
        onViewChange(newView);
      }
    },
    [onViewChange]
  );

  const headerTitle = useMemo(
    () => computeHeaderTitle(currentDate, view, dateLocale),
    [currentDate, view, dateLocale]
  );

  return {
    currentDate,
    view,
    headerTitle,
    currentTime,
    setCurrentDate,
    setView,
    handlePrev,
    handleNext,
    handleToday,
    handleViewChange,
    dateLocale,
  };
}
