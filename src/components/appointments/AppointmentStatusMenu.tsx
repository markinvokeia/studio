'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  Ban,
  CalendarCheck,
  CalendarClock,
  Check,
  CheckCircle2,
  CircleDashed,
  ClipboardList,
  Loader2,
  MessageSquare,
  PlayCircle,
  UserCheck,
  UserX,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  ALLOWED_STATUS_TRANSITIONS,
  APPOINTMENT_STATUSES,
  CANCELLATION_REASONS_QUICK,
  STATUS_BADGE_VARIANT,
} from '@/constants/appointment-status';
import type { Appointment, AppointmentStatus, CancellationReason } from '@/lib/types';

const STATUS_ICONS: Record<AppointmentStatus, React.ComponentType<{ className?: string }>> = {
  pending: CircleDashed,
  scheduled: CalendarClock,
  confirmed: CalendarCheck,
  arrived: UserCheck,
  in_progress: PlayCircle,
  completed: CheckCircle2,
  no_show: UserX,
  cancelled: Ban,
};

export interface StatusChangeExtra {
  cancellation_reason?: CancellationReason;
  cancellation_note?: string;
}

interface BaseProps {
  appointment: Appointment;
  onChange: (newStatus: AppointmentStatus, extra?: StatusChangeExtra) => void | Promise<void>;
  /** Called when the user picks "Otro motivo…" — the parent should open its CancellationNoteDialog. */
  onRequestCustomCancellation?: () => void;
  disabled?: boolean;
  isUpdating?: boolean;
}

export function AppointmentStatusMenu({
  appointment,
  onChange,
  onRequestCustomCancellation,
  disabled,
  isUpdating,
  size = 'sm',
  className,
}: BaseProps & {
  size?: 'sm' | 'md';
  className?: string;
}) {
  const tStatus = useTranslations('AppointmentStatus');
  const tMenu = useTranslations('AppointmentStatusMenu');
  const tReason = useTranslations('CancellationReason');
  const current = appointment.status;
  const allowed = ALLOWED_STATUS_TRANSITIONS[current] ?? [];
  const variant = (STATUS_BADGE_VARIANT[current] ?? 'default') as
    | 'default' | 'success' | 'destructive' | 'info' | 'warning' | 'secondary' | 'outline';
  const CurrentIcon = STATUS_ICONS[current] ?? ClipboardList;
  const canCancel = allowed.includes('cancelled');

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'inline-flex items-center gap-1 outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 rounded-full',
            disabled && 'cursor-not-allowed opacity-60',
            className,
          )}
          aria-label={tMenu('label')}
        >
          <Badge
            variant={variant}
            className={cn('capitalize gap-1', size === 'sm' ? 'text-xs' : 'text-sm')}
          >
            {isUpdating ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <CurrentIcon className="h-3 w-3" />
            )}
            {tStatus(current)}
          </Badge>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        onClick={(e) => e.stopPropagation()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {tMenu('changeStatus')}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {APPOINTMENT_STATUSES.map((status) => {
          const Icon = STATUS_ICONS[status];
          const isCurrent = status === current;
          const enabled = isCurrent || allowed.includes(status);

          // The "cancelled" entry becomes a submenu so the user picks a reason.
          if (status === 'cancelled') {
            if (!canCancel) {
              return (
                <DropdownMenuItem key={status} disabled className="gap-2 text-sm">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 capitalize">{tStatus(status)}</span>
                  {isCurrent && <Check className="h-3.5 w-3.5 text-muted-foreground" />}
                </DropdownMenuItem>
              );
            }
            return (
              <DropdownMenuSub key={status}>
                <DropdownMenuSubTrigger className="gap-2 text-sm">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 capitalize">{tMenu('cancelSubmenu')}</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {CANCELLATION_REASONS_QUICK.map((reason) => (
                    <DropdownMenuItem
                      key={reason}
                      onSelect={(e) => {
                        e.preventDefault();
                        onChange('cancelled', { cancellation_reason: reason });
                      }}
                      className="gap-2 text-sm"
                    >
                      {tReason(reason)}
                    </DropdownMenuItem>
                  ))}
                  {onRequestCustomCancellation && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onSelect={(e) => {
                          e.preventDefault();
                          onRequestCustomCancellation();
                        }}
                        className="gap-2 text-sm"
                      >
                        <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                        <span>{tMenu('otherReason')}</span>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            );
          }

          return (
            <DropdownMenuItem
              key={status}
              disabled={!enabled || isCurrent}
              onSelect={(e) => {
                e.preventDefault();
                if (!isCurrent && enabled) onChange(status);
              }}
              className="gap-2 text-sm"
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 capitalize">{tStatus(status)}</span>
              {isCurrent && <Check className="h-3.5 w-3.5 text-muted-foreground" />}
            </DropdownMenuItem>
          );
        })}
        {allowed.length === 0 && (
          <p className="px-2 py-1.5 text-xs text-muted-foreground italic">
            {tMenu('noTransitions')}
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Renderable list of <ContextMenuItem> entries for the status submenu inside the calendar's
 * native ContextMenu. The "cancelled" entry is rendered as a nested ContextMenuSub with the
 * 5 quick reasons + "Other reason…".
 */
interface AppointmentStatusContextItemsProps {
  appointment: Appointment;
  onChange: (newStatus: AppointmentStatus, extra?: StatusChangeExtra) => void;
  onRequestCustomCancellation?: () => void;
  ItemComponent: React.ComponentType<any>;
  SubComponent: React.ComponentType<any>;
  SubTriggerComponent: React.ComponentType<any>;
  SubContentComponent: React.ComponentType<any>;
  SeparatorComponent: React.ComponentType<any>;
}

export function AppointmentStatusContextItems({
  appointment,
  onChange,
  onRequestCustomCancellation,
  ItemComponent,
  SubComponent,
  SubTriggerComponent,
  SubContentComponent,
  SeparatorComponent,
}: AppointmentStatusContextItemsProps) {
  const tStatus = useTranslations('AppointmentStatus');
  const tMenu = useTranslations('AppointmentStatusMenu');
  const tReason = useTranslations('CancellationReason');
  const current = appointment.status;
  const allowed = ALLOWED_STATUS_TRANSITIONS[current] ?? [];
  const canCancel = allowed.includes('cancelled');

  return (
    <>
      {APPOINTMENT_STATUSES.map((status) => {
        const Icon = STATUS_ICONS[status];
        const isCurrent = status === current;
        const enabled = !isCurrent && allowed.includes(status);

        if (status === 'cancelled') {
          if (!canCancel) {
            return (
              <ItemComponent
                key={status}
                disabled
                className="flex items-center gap-2 cursor-not-allowed"
              >
                <Icon className="h-4 w-4" />
                <span className="capitalize">{tStatus(status)}</span>
                {isCurrent && <Check className="ml-auto h-3.5 w-3.5 text-muted-foreground" />}
              </ItemComponent>
            );
          }
          return (
            <SubComponent key={status}>
              <SubTriggerComponent className="flex items-center gap-2 cursor-pointer">
                <Icon className="h-4 w-4" />
                <span className="capitalize">{tMenu('cancelSubmenu')}</span>
              </SubTriggerComponent>
              <SubContentComponent>
                {CANCELLATION_REASONS_QUICK.map((reason) => (
                  <ItemComponent
                    key={reason}
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      onChange('cancelled', { cancellation_reason: reason });
                    }}
                    className="cursor-pointer"
                  >
                    {tReason(reason)}
                  </ItemComponent>
                ))}
                {onRequestCustomCancellation && (
                  <>
                    <SeparatorComponent />
                    <ItemComponent
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        onRequestCustomCancellation();
                      }}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      <span>{tMenu('otherReason')}</span>
                    </ItemComponent>
                  </>
                )}
              </SubContentComponent>
            </SubComponent>
          );
        }

        return (
          <ItemComponent
            key={status}
            disabled={!enabled}
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              if (enabled) onChange(status);
            }}
            className="flex items-center gap-2 cursor-pointer"
          >
            <Icon className="h-4 w-4" />
            <span className="capitalize">{tStatus(status)}</span>
            {isCurrent && <Check className="ml-auto h-3.5 w-3.5 text-muted-foreground" />}
          </ItemComponent>
        );
      })}
    </>
  );
}
