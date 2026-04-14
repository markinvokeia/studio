import * as React from 'react';
import { cn } from '@/lib/utils';
import { SIDEBAR_WIDTH } from '@/lib/design-tokens';

interface PageShellProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Presentational wrapper that offsets content from the fixed sidebar.
 * Drop this as the outermost element inside every App Router page.
 */
export function PageShell({ children, className }: PageShellProps) {
  return (
    <div
      className={cn('flex flex-col h-screen overflow-hidden bg-background', className)}
      style={{ marginLeft: SIDEBAR_WIDTH }}
    >
      {children}
    </div>
  );
}
