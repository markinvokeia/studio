'use client';

import * as React from 'react';
import { Search } from 'lucide-react';

import { Slider } from '@/components/ui/slider';

interface CalendarZoomControlProps {
  zoom: number;
  onZoomChange: (zoom: number) => void;
  min?: number;
  max?: number;
}

/**
 * Transparent zoom slider pinned to the calendar's bottom-right corner. Scaling
 * the zoom enlarges slot height and font together (the slot:font ratio is kept).
 */
export function CalendarZoomControl({ zoom, onZoomChange, min = 0.7, max = 2.5 }: CalendarZoomControlProps) {
  return (
    <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2 rounded-full border border-border/40 bg-card/70 px-3 py-1.5 opacity-60 shadow-sm backdrop-blur-sm transition-opacity hover:opacity-100">
      <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <Slider
        min={min}
        max={max}
        step={0.1}
        value={[zoom]}
        onValueChange={([v]) => onZoomChange(v)}
        className="w-28"
        aria-label="Zoom"
      />
      <span className="w-9 shrink-0 text-right text-xs font-medium tabular-nums text-muted-foreground">
        {Math.round(zoom * 100)}%
      </span>
    </div>
  );
}
