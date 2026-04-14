'use client';

import * as React from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface ResizableSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  storageKey?: string;
  side?: 'left' | 'right';
}

export function ResizableSheet({
  open,
  onOpenChange,
  children,
  defaultWidth = 800,
  minWidth = 480,
  maxWidth = 1200,
  storageKey = 'resizable-sheet-width',
  side = 'right',
}: ResizableSheetProps) {
  const [width, setWidth] = React.useState(defaultWidth);
  const [isResizing, setIsResizing] = React.useState(false);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const resizeRef = React.useRef<{ startX: number; startWidth: number } | null>(null);

  // Load saved width from localStorage on mount
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedWidth = localStorage.getItem(storageKey);
      if (savedWidth) {
        const parsed = parseInt(savedWidth, 10);
        if (!isNaN(parsed) && parsed >= minWidth && parsed <= maxWidth) {
          setWidth(parsed);
        }
      }
    }
  }, [storageKey, minWidth, maxWidth]);

  // Save width to localStorage when it changes
  React.useEffect(() => {
    if (typeof window !== 'undefined' && !isResizing) {
      localStorage.setItem(storageKey, width.toString());
    }
  }, [width, storageKey, isResizing]);

  const handleResizeStart = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeRef.current = {
      startX: e.clientX,
      startWidth: width,
    };
  }, [width]);

  const handleResizeMove = React.useCallback((e: MouseEvent) => {
    if (!isResizing || !resizeRef.current) return;

    const delta = side === 'right' 
      ? resizeRef.current.startX - e.clientX 
      : e.clientX - resizeRef.current.startX;
    
    const newWidth = Math.max(minWidth, Math.min(maxWidth, resizeRef.current.startWidth + delta));
    setWidth(newWidth);
  }, [isResizing, minWidth, maxWidth, side]);

  const handleResizeEnd = React.useCallback(() => {
    setIsResizing(false);
    resizeRef.current = null;
  }, []);

  // Add/remove global mouse event listeners during resize
  React.useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        className={cn(
          'flex flex-col p-0 gap-0 overflow-hidden transition-[width] duration-150',
          side === 'right' ? 'border-l' : 'border-r'
        )}
        style={isFullscreen ? { width: '100vw', maxWidth: 'none' } : { width: `${width}px`, maxWidth: 'none' }}
      >
        {/* Resize Handle — hidden in fullscreen */}
        {!isFullscreen && (
          <div
            className={cn(
              'absolute top-0 bottom-0 w-4 cursor-col-resize z-50 flex items-center justify-center group',
              side === 'right' ? 'left-0 -translate-x-1/2' : 'right-0 translate-x-1/2'
            )}
            onMouseDown={handleResizeStart}
          >
            <div className={cn(
              'w-1 h-12 rounded-full bg-border transition-colors',
              'group-hover:bg-primary/50 group-active:bg-primary',
              isResizing && 'bg-primary'
            )} />
          </div>
        )}

        {/* Fullscreen toggle button */}
        <button
          type="button"
          onClick={() => setIsFullscreen((v) => !v)}
          className={cn(
            'absolute z-50 top-3 flex items-center justify-center w-7 h-7 rounded-lg',
            'text-muted-foreground hover:text-foreground hover:bg-muted transition-colors',
            side === 'right' ? 'left-8' : 'right-8'
          )}
          title={isFullscreen ? 'Restore' : 'Fullscreen'}
        >
          {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </button>

        {/* Content wrapper */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Re-export other sheet components for convenience
export { SheetHeader, SheetTitle, SheetDescription, SheetFooter };
