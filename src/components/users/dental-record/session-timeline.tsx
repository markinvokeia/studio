'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { DentalRecordSession } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { CheckCircle2, GitCompare, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface SessionTimelineProps {
  sessions: DentalRecordSession[];
  activeSessionId: string | null;
  compareSessionId: string | null;
  onSelectSession: (id: string) => void;
  onCompareSession: (id: string | null) => void;
  onDeleteSession: (id: string) => void;
  onNewSession: () => void;
  /** Desktop = vertical sidebar; Mobile = horizontal strip */
  orientation?: 'vertical' | 'horizontal';
}

function formatSessionDate(dateStr: string) {
  try {
    return format(parseISO(dateStr), 'dd MMM yyyy', { locale: es });
  } catch {
    return dateStr;
  }
}

export function SessionTimeline({
  sessions,
  activeSessionId,
  compareSessionId,
  onSelectSession,
  onCompareSession,
  onDeleteSession,
  onNewSession,
  orientation = 'vertical',
}: SessionTimelineProps) {
  const t = useTranslations('DentalRecord');

  const isHorizontal = orientation === 'horizontal';

  return (
    <div
      className={cn(
        'flex gap-2',
        isHorizontal
          ? 'flex-row overflow-x-auto pb-1 px-1'
          : 'flex-col overflow-y-auto',
      )}
    >
      {/* New session button */}
      <Button
        variant="outline"
        size="sm"
        onClick={onNewSession}
        className={cn(
          'shrink-0 gap-1.5 text-xs font-medium',
          isHorizontal ? 'h-auto py-2 px-3' : 'w-full justify-start',
        )}
      >
        <Plus className="h-3.5 w-3.5" />
        {t('newSession')}
      </Button>

      {sessions.length === 0 && (
        <p className={cn('text-xs text-muted-foreground', isHorizontal ? 'self-center whitespace-nowrap px-2' : 'px-1 pt-1')}>
          {t('noSessions')}
        </p>
      )}

      {[...sessions].reverse().map((session) => {
        const isActive = session.id === activeSessionId;
        const isCompare = session.id === compareSessionId;

        return (
          <div
            key={session.id}
            className={cn(
              'group relative shrink-0 rounded-lg border cursor-pointer transition-colors',
              isHorizontal ? 'min-w-[120px] p-2' : 'p-2.5',
              isActive
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/40 hover:bg-muted/40',
              isCompare && !isActive && 'border-amber-400/60 bg-amber-50/40 dark:bg-amber-900/10',
            )}
            onClick={() => onSelectSession(session.id)}
          >
            {/* Active indicator */}
            {isActive && (
              <CheckCircle2 className="absolute top-1.5 right-1.5 h-3 w-3 text-primary" />
            )}

            <p className="text-xs font-semibold text-foreground leading-tight pr-4">
              {session.label ?? t('newSessionLabel', { n: '' })}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {formatSessionDate(session.date)}
            </p>

            {/* Actions row */}
            <div
              className={cn(
                'flex items-center gap-1 mt-1.5',
                isHorizontal ? '' : 'opacity-0 group-hover:opacity-100 transition-opacity',
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Compare toggle */}
              {!isActive && (
                <button
                  title={isCompare ? t('stopCompare') : t('compare')}
                  className={cn(
                    'rounded p-0.5 transition-colors',
                    isCompare
                      ? 'text-amber-500 hover:text-amber-600'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  onClick={() => onCompareSession(isCompare ? null : session.id)}
                >
                  <GitCompare className="h-3 w-3" />
                </button>
              )}

              {/* Delete */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    title={t('session.delete')}
                    className="rounded p-0.5 text-muted-foreground hover:text-destructive transition-colors ml-auto"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('session.delete')}</AlertDialogTitle>
                    <AlertDialogDescription>{t('session.deleteConfirm')}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => onDeleteSession(session.id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Eliminar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        );
      })}
    </div>
  );
}
