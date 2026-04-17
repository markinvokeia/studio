'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PANEL_ANIMATION_DURATION } from '@/lib/design-tokens';

interface DetailPanelProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Position in the panel stack (0 = top/active) */
  depth?: number;
  /** Total panels currently in stack */
  totalDepth?: number;
  className?: string;
}

/**
 * Slide-in detail panel that renders inline in the DOM (no portal).
 * Uses CSS keyframe animations defined in globals.css via --panel-transition.
 * Stacks visually: deeper panels peek behind the active one.
 */
export function DetailPanel({
  isOpen,
  onClose,
  children,
  depth = 0,
  totalDepth = 1,
  className,
}: DetailPanelProps) {
  const [mounted, setMounted] = React.useState(false);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setMounted(true);
      // Small delay to ensure CSS transition fires
      const t = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(t);
    } else {
      setVisible(false);
      const t = setTimeout(() => setMounted(false), PANEL_ANIMATION_DURATION);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  if (!mounted) return null;

  // Panels behind the active one are shifted left and slightly faded
  const behindOffset = totalDepth - 1 - depth;
  const peekTranslate = behindOffset > 0 ? `-${behindOffset * 8}px` : '0px';
  const peekOpacity = behindOffset > 0 ? Math.max(0.6, 1 - behindOffset * 0.15) : 1;

  return (
    <div
      className={cn(
        'absolute inset-0 flex flex-col bg-background border-l border-border shadow-xl z-10 transition-all',
        visible ? 'panel-enter' : 'panel-exit',
        className,
      )}
      style={{
        transform: `translateX(${peekTranslate})`,
        opacity: peekOpacity,
        transitionDuration: `${PANEL_ANIMATION_DURATION}ms`,
        transitionTimingFunction: 'cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={onClose}
        className="absolute top-3 right-3 z-20 h-7 w-7 rounded-full text-muted-foreground hover:bg-muted"
        aria-label="Cerrar panel"
      >
        <X className="h-4 w-4" />
      </Button>
      {children}
    </div>
  );
}
