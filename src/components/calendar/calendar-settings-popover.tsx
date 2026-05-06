import * as React from 'react';
import { Settings2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarSettings } from '@/lib/types';
import { CalendarSettingsForm } from './calendar-settings-form';

interface CalendarSettingsPopoverProps {
  onSettingsChange?: (settings: CalendarSettings) => void;
}

export function CalendarSettingsPopover({ onSettingsChange }: CalendarSettingsPopoverProps) {
  const t = useTranslations('AppointmentsPage.settings');

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="h-9 w-9 shrink-0">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-4 shadow-xl border-border/50 bg-card/95 backdrop-blur-sm" align="end">
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-border/50">
            <Settings2 className="h-4 w-4 text-primary" />
            <h4 className="font-semibold text-sm tracking-tight">{t('title')}</h4>
          </div>
          <CalendarSettingsForm onSettingsChange={onSettingsChange} />
        </div>
      </PopoverContent>
    </Popover>
  );
}
