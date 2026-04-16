'use client';

import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface CalendarFabProps {
  onClick: () => void;
}

export function CalendarFab({ onClick }: CalendarFabProps) {
  return (
    <Button
      size="icon"
      className="fixed bottom-20 right-4 z-50 h-14 w-14 rounded-full shadow-lg"
      onClick={onClick}
    >
      <Plus className="h-6 w-6" />
      <span className="sr-only">Create appointment</span>
    </Button>
  );
}
