import * as React from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  /** Optional icon rendered before the title */
  icon?: React.ReactNode;
  title: string;
  description?: string;
  /** Action buttons / controls rendered on the right side */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Clean page-level header with no visual separator.
 * Replaces the CardHeader pattern used across detail pages.
 * White bg, no violet tint, typography-driven hierarchy.
 */
export function PageHeader({ icon, title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex items-center gap-3 px-6 py-4 bg-background', className)}>
      {icon && (
        <div className="flex-shrink-0 text-muted-foreground">{icon}</div>
      )}
      <div className="flex-1 min-w-0">
        <h1 className="text-lg font-semibold leading-tight text-foreground truncate">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-0.5 truncate">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>
      )}
    </div>
  );
}
