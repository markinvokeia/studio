'use client';

import * as React from 'react';
import { Inbox } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { useNotifications } from '@/context/notifications-context';
import { cn } from '@/lib/utils';

interface NotificationsBellProps {
  className?: string;
  /** 'round' for the desktop pill, 'square' for mobile bar */
  variant?: 'round' | 'square';
}

export function NotificationsBell({ className, variant = 'round' }: NotificationsBellProps) {
  const { pendingCount, openPanel } = useNotifications();
  const t = useTranslations('Notifications');

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={openPanel}
      className={cn(
        'relative',
        variant === 'round' ? 'rounded-full h-9 w-9' : 'rounded-xl h-9 w-9',
        pendingCount > 0 && 'bg-primary/10 text-primary',
        className,
      )}
      aria-label={t('openPanel')}
    >
      <div className={cn(pendingCount > 0 && 'animate-bell-ring')}>
        <Inbox className="h-5 w-5" />
      </div>
      {pendingCount > 0 && (
        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white bg-primary ring-2 ring-background">
          {pendingCount > 99 ? '99+' : pendingCount}
        </span>
      )}
      <span className="sr-only">{t('openPanel')}</span>
    </Button>
  );
}
