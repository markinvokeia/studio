
'use client';

import * as React from 'react';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ReportFiltersProps {
    date: DateRange | undefined;
    setDate: React.Dispatch<React.SetStateAction<DateRange | undefined>>;
}

export function ReportFilters({ date, setDate }: ReportFiltersProps) {
  const t = useTranslations('ReportFilters');
  console.log('Translations for ReportFilters loaded.');
  return (
    <div className="flex items-center space-x-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={'outline'}
            className={cn(
              'w-[300px] justify-start text-left font-normal',
              !date && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, 'LLL dd, y')} -{' '}
                  {format(date.to, 'LLL dd, y')}
                </>
              ) : (
                format(date.from, 'LLL dd, y')
              )
            ) : (
              <span>{t('pickDate')}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <DatePicker
            initialFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={setDate as any}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
      <Select>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder={t('filterBy')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="service">{t('byService')}</SelectItem>
          <SelectItem value="user">{t('byUser')}</SelectItem>
          <SelectItem value="status">{t('byStatus')}</SelectItem>
        </SelectContent>
      </Select>
      <Button>{t('apply')}</Button>
    </div>
  );
}
