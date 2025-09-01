'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export const Timeline = React.forwardRef<HTMLOListElement, React.ComponentProps<'ol'>>(
  ({ className, ...props }, ref) => (
    <ol
      ref={ref}
      className={cn('flex flex-col', className)}
      {...props}
    />
  )
);
Timeline.displayName = 'Timeline';


export const TimelineItem = React.forwardRef<HTMLLIElement, React.ComponentProps<'li'>>(
  ({ className, ...props }, ref) => (
    <li
      ref={ref}
      className={cn('relative flex flex-col p-6 pt-0', className)}
      {...props}
    />
  )
);
TimelineItem.displayName = 'TimelineItem';

export const TimelineConnector = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'absolute left-[34px] top-6 h-full w-px -translate-x-1/2 translate-y-2 bg-primary/20',
        className
      )}
      {...props}
    />
  )
);
TimelineConnector.displayName = 'TimelineConnector';

export const TimelineHeader = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-center gap-4', className)}
      {...props}
    >
      {children}
    </div>
  )
);
TimelineHeader.displayName = 'TimelineHeader';

export const TimelineTitle = React.forwardRef<HTMLHeadingElement, React.ComponentProps<'h3'>>(
  ({ className, children, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('font-semibold', className)}
      {...props}
    >
      {children}
    </h3>
  )
);
TimelineTitle.displayName = 'TimelineTitle';

export const TimelineIcon = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'absolute left-[34px] top-6 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);
TimelineIcon.displayName = 'TimelineIcon';


export const TimelineDescription = React.forwardRef<HTMLParagraphElement, React.ComponentProps<'p'>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  )
);
TimelineDescription.displayName = 'TimelineDescription';

export const TimelineContent = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('p-4 pl-12', className)}
      {...props}
    />
  )
);
TimelineContent.displayName = 'TimelineContent';
