'use client';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { SixPointMeasure } from '@/lib/types';
import { Delete } from 'lucide-react';
import React from 'react';

export const SIX_POINTS = ['MB', 'B', 'DB', 'ML', 'L', 'DL'] as const;
export type PerioPoint = (typeof SIX_POINTS)[number];

const POINT_LABELS: Record<PerioPoint, string> = {
  MB: 'MB', B: 'V', DB: 'DB', ML: 'ML', L: 'L', DL: 'DL',
};

const POINT_GROUP_LABELS: Record<PerioPoint, string> = {
  MB: 'Vestibular', B: 'Vestibular', DB: 'Vestibular',
  ML: 'Lingual', L: 'Lingual', DL: 'Lingual',
};

const DEPTH_COLOR = (v: number) => {
  if (v <= 0) return 'text-muted-foreground';
  if (v <= 3) return 'text-green-600';
  if (v === 4) return 'text-yellow-600';
  if (v <= 6) return 'text-orange-500';
  return 'text-red-600';
};

interface NumpadPopoverProps {
  toothId: string;
  activePoint: PerioPoint;
  values: SixPointMeasure;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onValue: (point: PerioPoint, value: number) => void;
  onAdvance: () => void;
  children: React.ReactNode;
}

export function NumpadPopover({
  toothId,
  activePoint,
  values,
  open,
  onOpenChange,
  onValue,
  onAdvance,
  children,
}: NumpadPopoverProps) {
  const handleKey = (digit: number) => {
    onValue(activePoint, digit);
    onAdvance();
  };

  const handleClear = () => {
    onValue(activePoint, 0);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="w-52 p-3 shadow-lg"
        side="top"
        align="center"
        sideOffset={4}
      >
        {/* Header */}
        <div className="mb-2 text-center">
          <p className="text-xs font-bold text-foreground">Diente {toothId}</p>
          <p className="text-[10px] text-muted-foreground">
            {POINT_GROUP_LABELS[activePoint]} · <span className="font-semibold text-primary">{POINT_LABELS[activePoint]}</span>
          </p>
        </div>

        {/* 6-point values display */}
        <div className="grid grid-cols-6 gap-0.5 mb-2 text-center">
          {SIX_POINTS.map((pt) => (
            <div
              key={pt}
              className={cn(
                'rounded text-[10px] font-mono py-0.5',
                pt === activePoint ? 'bg-primary text-primary-foreground font-bold' : 'bg-muted',
                DEPTH_COLOR(values[pt]),
              )}
            >
              {values[pt] > 0 ? values[pt] : '–'}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-6 gap-0.5 mb-3 text-center">
          {SIX_POINTS.map((pt) => (
            <div key={pt} className="text-[9px] text-muted-foreground">{POINT_LABELS[pt]}</div>
          ))}
        </div>

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-1">
          {[7, 8, 9, 4, 5, 6, 1, 2, 3].map((n) => (
            <button
              key={n}
              onClick={() => handleKey(n)}
              className="h-9 rounded-md bg-muted text-sm font-semibold hover:bg-primary hover:text-primary-foreground transition-colors active:scale-95"
            >
              {n}
            </button>
          ))}
          <button
            onClick={handleClear}
            className="h-9 rounded-md bg-muted text-sm hover:bg-destructive hover:text-white transition-colors active:scale-95 flex items-center justify-center"
          >
            <Delete className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => handleKey(0)}
            className="h-9 rounded-md bg-muted text-sm font-semibold hover:bg-primary hover:text-primary-foreground transition-colors active:scale-95"
          >
            0
          </button>
          <button
            onClick={onAdvance}
            className="h-9 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors active:scale-95"
          >
            →
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
