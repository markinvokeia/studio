'use client';

import * as React from 'react';
import { BellOff, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { createPortal } from 'react-dom';

import { Button } from '@/components/ui/button';
import { useNotifications } from '@/context/notifications-context';
import { cn } from '@/lib/utils';
import { NotificationCard } from './notification-card';

export function NotificationsPanel() {
  const { notifications, isPanelOpen, closePanel, clearAll } = useNotifications();
  const t = useTranslations('Notifications');
  const [isClient, setIsClient] = React.useState(false);

  React.useEffect(() => { setIsClient(true); }, []);

  // Close on Escape
  React.useEffect(() => {
    if (!isPanelOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closePanel(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isPanelOpen, closePanel]);

  if (!isClient) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-[9980] bg-black/30 backdrop-blur-[1px] transition-opacity duration-300',
          isPanelOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
        onClick={closePanel}
        aria-hidden
      />

      {/* Panel */}
      <div
        className={cn(
          'fixed right-0 top-0 z-[9981] flex h-full w-full max-w-sm flex-col bg-background shadow-2xl border-l border-border transition-transform duration-300 ease-in-out',
          isPanelOpen ? 'translate-x-0' : 'translate-x-full',
        )}
        role="dialog"
        aria-modal="true"
        aria-label={t('panelTitle')}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">{t('panelTitle')}</h2>
            {notifications.length > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                {notifications.length > 99 ? '99+' : notifications.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                onClick={clearAll}
              >
                {t('clearAll')}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={closePanel}
              aria-label={t('close')}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-16">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/60">
                <BellOff className="h-6 w-6 text-muted-foreground/60" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">{t('emptyTitle')}</p>
              <p className="text-xs text-muted-foreground/70">{t('emptyDescription')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((n) => (
                <NotificationCard key={n.id} notification={n} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}
