'use client';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useTranslations } from 'next-intl';

interface CalendarFilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function CalendarFilterSheet({ open, onOpenChange, children }: CalendarFilterSheetProps) {
  const t = useTranslations('Calendar');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-xl max-h-[80vh] flex flex-col px-4 pb-6"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2 pb-3">
          <div className="w-12 h-1.5 bg-muted-foreground/20 rounded-full" />
        </div>
        <SheetHeader className="pb-3">
          <SheetTitle className="text-left">{t('filterTitle')}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}
