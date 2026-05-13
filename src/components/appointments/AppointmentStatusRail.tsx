'use client';

import * as React from 'react';
import { ChevronRight, MessageSquare } from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ALLOWED_STATUS_TRANSITIONS,
  APPOINTMENT_STATUSES,
  CANCELLATION_REASONS_QUICK,
  STATUS_ACCENT_COLOR,
} from '@/constants/appointment-status';
import { cn } from '@/lib/utils';
import type { Appointment, AppointmentStatus, CancellationReason } from '@/lib/types';

import { getStatusIcon, STATUS_ICONS } from './status-icons';

export interface StatusChangeExtra {
  cancellation_reason?: CancellationReason;
  cancellation_note?: string;
}

interface AppointmentStatusRailProps {
  appointment: Appointment;
  onChange: (newStatus: AppointmentStatus, extra?: StatusChangeExtra) => void;
  onRequestCustomCancellation?: () => void;
  variant?: 'top' | 'side';
}

const STATUS_FLOW: AppointmentStatus[] = [
  'pending',
  'scheduled',
  'confirmed',
  'arrived',
  'in_progress',
  'completed',
  'no_show',
  'cancelled',
];

export function AppointmentStatusRail({
  appointment,
  onChange,
  onRequestCustomCancellation,
  variant = 'top',
}: AppointmentStatusRailProps) {
  const tStatus = useTranslations('AppointmentStatus');
  const tMenu = useTranslations('AppointmentStatusMenu');
  const tReason = useTranslations('CancellationReason');

  const current = appointment.status;
  const currentIndex = STATUS_FLOW.indexOf(current);
  const allowed = ALLOWED_STATUS_TRANSITIONS[current] ?? [];
  const canCancel = allowed.includes('cancelled');
  const CurrentIcon = getStatusIcon(current, appointment.cancellation_reason);
  const currentColor = STATUS_ACCENT_COLOR[current];
  const activeStatusRef = React.useRef<HTMLButtonElement | null>(null);

  React.useLayoutEffect(() => {
    activeStatusRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  }, [current]);

  const renderCancellationMenuItems = () => (
    <>
      {CANCELLATION_REASONS_QUICK.map((reason) => (
        <DropdownMenuItem
          key={reason}
          onSelect={(event) => {
            event.preventDefault();
            onChange('cancelled', { cancellation_reason: reason });
          }}
          className="gap-2 text-sm"
        >
          <span
            aria-hidden
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: STATUS_ACCENT_COLOR.cancelled }}
          />
          <span>{tReason(reason)}</span>
        </DropdownMenuItem>
      ))}
      {onRequestCustomCancellation && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              onRequestCustomCancellation();
            }}
            className="gap-2 text-sm"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>{tMenu('otherReason')}</span>
          </DropdownMenuItem>
        </>
      )}
    </>
  );

  if (variant === 'side') {
    return (
      <aside className="w-14 shrink-0 overflow-y-auto border-l border-border bg-card px-1.5 py-3 sm:w-52 sm:px-3 sm:py-4 xl:w-56">
        <div className="flex flex-col gap-2">
          {STATUS_FLOW.map((status) => {
            if (!APPOINTMENT_STATUSES.includes(status)) return null;

            const isCurrent = status === current;
            const isDone = currentIndex > -1 && status !== 'cancelled' && status !== 'no_show' && STATUS_FLOW.indexOf(status) < currentIndex;
            const isEnabled = !isCurrent && allowed.includes(status);
            const statusColor = STATUS_ACCENT_COLOR[status];
            const StatusIcon = isCurrent ? getStatusIcon(status, appointment.cancellation_reason) : STATUS_ICONS[status];
            const item = (
              <button
                type="button"
                disabled={!isEnabled && status !== 'cancelled'}
                onClick={() => {
                  if (status !== 'cancelled' && isEnabled) onChange(status);
                }}
                className={cn(
                  'inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border px-2 text-left text-sm font-semibold transition-colors sm:justify-start sm:px-3',
                  isCurrent
                    ? 'border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                    : isDone
                      ? 'border-primary/15 bg-primary/10 text-primary hover:bg-primary/15'
                      : isEnabled
                        ? 'border-border bg-card text-foreground hover:border-primary/30 hover:bg-primary/8 hover:text-primary'
                        : 'border-transparent bg-muted/45 text-muted-foreground opacity-75',
                )}
                aria-current={isCurrent ? 'step' : undefined}
              >
                <span
                  className={cn(
                    'grid h-6 w-6 shrink-0 place-items-center rounded-full',
                    isCurrent ? 'bg-primary-foreground/20' : isDone ? 'bg-primary/15' : 'bg-background/80',
                  )}
                >
                  <StatusIcon
                    className="h-3.5 w-3.5"
                    style={!isCurrent ? { color: statusColor } : undefined}
                    strokeWidth={2.5}
                  />
                </span>
                <span className="hidden min-w-0 flex-1 truncate sm:inline">{tStatus(status)}</span>
              </button>
            );

            if (status === 'cancelled' && canCancel) {
              return (
                <DropdownMenu key={status} modal={false}>
                  <DropdownMenuTrigger asChild>{item}</DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onCloseAutoFocus={(event) => event.preventDefault()}>
                    {renderCancellationMenuItems()}
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            }

            return <React.Fragment key={status}>{item}</React.Fragment>;
          })}
        </div>
      </aside>
    );
  }

  return (
    <div className="border-b border-border bg-card px-3 py-3 sm:px-5 sm:py-4 min-[1200px]:hidden">
      <div className="sm:hidden">
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex h-11 w-full items-center justify-between gap-3 rounded-full border border-primary/25 bg-primary/10 px-4 text-base font-semibold text-primary shadow-sm"
            >
              <span className="inline-flex min-w-0 items-center gap-2">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/15">
                  <CurrentIcon className="h-4 w-4" style={{ color: currentColor }} strokeWidth={2.5} />
                </span>
                <span className="truncate">{tStatus(current)}</span>
              </span>
              <ChevronRight className="h-4 w-4 rotate-90 text-primary/70" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[calc(100vw-1.5rem)]">
            {STATUS_FLOW.map((status) => {
              const Icon = status === current ? CurrentIcon : STATUS_ICONS[status];
              const isCurrent = status === current;
              const isEnabled = !isCurrent && allowed.includes(status);
              const statusColor = STATUS_ACCENT_COLOR[status];

              if (status === 'cancelled' && canCancel) {
                return (
                  <React.Fragment key={status}>
                    {renderCancellationMenuItems()}
                  </React.Fragment>
                );
              }

              return (
                <DropdownMenuItem
                  key={status}
                  disabled={!isEnabled || isCurrent}
                  onSelect={(event) => {
                    event.preventDefault();
                    if (isEnabled) onChange(status);
                  }}
                  className={cn('gap-2 text-sm', isCurrent && 'font-semibold text-primary')}
                >
                  <Icon className="h-4 w-4" style={{ color: isCurrent ? currentColor : statusColor }} />
                  <span className="flex-1">{tStatus(status)}</span>
                  {isCurrent && <span className="h-2 w-2 rounded-full bg-primary" />}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="hidden gap-1 overflow-x-auto pb-1 sm:flex">
        {STATUS_FLOW.map((status, index) => {
          if (!APPOINTMENT_STATUSES.includes(status)) return null;

          const isCurrent = status === current;
          const isDone = currentIndex > -1 && index < currentIndex && current !== 'cancelled' && current !== 'no_show';
          const isEnabled = !isCurrent && allowed.includes(status);
          const statusColor = STATUS_ACCENT_COLOR[status];
          const StatusIcon = isCurrent ? getStatusIcon(status, appointment.cancellation_reason) : STATUS_ICONS[status];
          const item = (
            <button
              ref={isCurrent ? activeStatusRef : undefined}
              type="button"
              disabled={!isEnabled && status !== 'cancelled'}
              onClick={() => {
                if (status !== 'cancelled' && isEnabled) onChange(status);
              }}
              className={cn(
                'group inline-flex h-10 w-full shrink-0 items-center gap-2 rounded-full border px-3 text-sm font-semibold transition-colors sm:w-auto',
                isCurrent
                  ? 'border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                  : isDone
                    ? 'border-primary/15 bg-primary/10 text-primary hover:bg-primary/15'
                    : isEnabled
                      ? 'border-border bg-card text-foreground hover:border-primary/30 hover:bg-primary/8 hover:text-primary'
                      : 'border-transparent bg-muted/45 text-muted-foreground opacity-75',
              )}
              aria-current={isCurrent ? 'step' : undefined}
            >
              <span
                className={cn(
                  'grid h-6 w-6 place-items-center rounded-full',
                  isCurrent ? 'bg-primary-foreground/20' : isDone ? 'bg-primary/15' : 'bg-background/80',
                )}
              >
                <StatusIcon
                  className="h-3.5 w-3.5"
                  style={!isCurrent ? { color: statusColor } : undefined}
                  strokeWidth={2.5}
                />
              </span>
              <span className="whitespace-nowrap">{tStatus(status)}</span>
            </button>
          );

          return (
            <React.Fragment key={status}>
              {status === 'cancelled' && canCancel ? (
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>{item}</DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onCloseAutoFocus={(event) => event.preventDefault()}>
                    {renderCancellationMenuItems()}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                item
              )}
              {index < STATUS_FLOW.length - 1 && (
                <ChevronRight className="mx-auto h-3 w-3 rotate-90 shrink-0 text-muted-foreground/35 sm:mx-0 sm:mt-3.5 sm:rotate-0 sm:text-muted-foreground/40" />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
