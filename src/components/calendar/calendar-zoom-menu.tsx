'use client';

import React from 'react';
import { ChevronDown, Minus, Plus, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

interface CalendarZoomMenuProps {
  zoom: number;
  onZoomChange: (zoom: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

/**
 * Desktop "Zoom" dropdown (custom mode): +/- controls that scale slot height while the
 * day view keeps the current visible range. Also shows the Ctrl +/- keyboard shortcuts.
 */
export function CalendarZoomMenu({ zoom, onZoomChange, min = 0.7, max = 2.5, step = 0.1 }: CalendarZoomMenuProps) {
  const t = useTranslations('Calendar');
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v * 10) / 10));
  const decrease = () => onZoomChange(clamp(zoom - step));
  const increase = () => onZoomChange(clamp(zoom + step));
  const reset = () => onZoomChange(1);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-11 gap-1.5">
          <Search className="h-4 w-4" />
          {t('zoom')}
          <ChevronDown className="h-3.5 w-3.5 opacity-80" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={decrease}
            disabled={zoom <= min}
            aria-label={t('zoomOut')}
            title={`${t('zoomOut')} (Ctrl -)`}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span className="min-w-[3.5rem] text-center text-sm font-medium tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={increase}
            disabled={zoom >= max}
            aria-label={t('zoomIn')}
            title={`${t('zoomIn')} (Ctrl +)`}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); reset(); }}>
          <span className="flex-1">{t('resetZoom')}</span>
          <span className="text-xs text-muted-foreground">Ctrl 0</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
