'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  Check,
  ClipboardList,
  Loader2,
  MessageSquare,
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
  STATUS_ACCENT_COLOR,
  STATUS_BADGE_VARIANT,
} from '@/constants/appointment-status';
import type { Appointment, AppointmentStatus, CancellationReason } from '@/lib/types';
import { CANCELLATION_REASON_ICONS, getStatusIcon, STATUS_ICONS } from './status-icons';

// Small colored dot used as a swatch in front of each status / reason item.
function ColorDot({ color, className }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-block h-2.5 w-2.5 rounded-full shrink-0', className)}
      style={{ backgroundColor: color }}
    />
  );
}

// The "cancelled" accent serves as the swatch for every cancellation reason
// (they all end the appointment in the same state).
const CANCELLATION_REASON_COLOR = STATUS_ACCENT_COLOR.cancelled;

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
  const CurrentIcon = getStatusIcon(current, appointment.cancellation_reason) ?? ClipboardList;
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
            {current === 'cancelled' && appointment.cancellation_reason
              ? tReason(appointment.cancellation_reason)
              : tStatus(current)}
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
          const statusColor = STATUS_ACCENT_COLOR[status];

          // The "cancelled" entry becomes a submenu so the user picks a reason.
          if (status === 'cancelled') {
            if (!canCancel) {
              return (
                <DropdownMenuItem key={status} disabled className="gap-2 text-sm">
                  <ColorDot color={statusColor} />
                  <Icon className="h-4 w-4 shrink-0" style={{ color: statusColor }} />
                  <span className="flex-1 capitalize">{tStatus(status)}</span>
                  {isCurrent && <Check className="h-3.5 w-3.5 text-muted-foreground" />}
                </DropdownMenuItem>
              );
            }
            return (
              <DropdownMenuSub key={status}>
                <DropdownMenuSubTrigger className="gap-2 text-sm">
                  <ColorDot color={statusColor} />
                  <Icon className="h-4 w-4 shrink-0" style={{ color: statusColor }} />
                  <span className="flex-1 capitalize">{tMenu('cancelSubmenu')}</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {CANCELLATION_REASONS_QUICK.map((reason) => (
                    (() => {
                      const ReasonIcon = CANCELLATION_REASON_ICONS[reason];

                      return (
                        <DropdownMenuItem
                          key={reason}
                          onSelect={(e) => {
                            e.preventDefault();
                            onChange('cancelled', { cancellation_reason: reason });
                          }}
                          className="gap-2 text-sm"
                        >
                          <ReasonIcon className="h-4 w-4 shrink-0" style={{ color: CANCELLATION_REASON_COLOR }} />
                          <ColorDot color={CANCELLATION_REASON_COLOR} />
                          <span>{tReason(reason)}</span>
                        </DropdownMenuItem>
                      );
                    })()
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
                        <ColorDot color={CANCELLATION_REASON_COLOR} />
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
              <ColorDot color={statusColor} />
              <Icon className="h-4 w-4 shrink-0" style={{ color: statusColor }} />
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
        const statusColor = STATUS_ACCENT_COLOR[status];

        if (status === 'cancelled') {
          if (!canCancel) {
            return (
              <ItemComponent
                key={status}
                disabled
                className="flex items-center gap-2 cursor-not-allowed"
              >
                <ColorDot color={statusColor} />
                <Icon className="h-4 w-4" style={{ color: statusColor }} />
                <span className="capitalize">{tStatus(status)}</span>
                {isCurrent && <Check className="ml-auto h-3.5 w-3.5 text-muted-foreground" />}
              </ItemComponent>
            );
          }
          return (
            <SubComponent key={status}>
              <SubTriggerComponent className="flex items-center gap-2 cursor-pointer">
                <ColorDot color={statusColor} />
                <Icon className="h-4 w-4" style={{ color: statusColor }} />
                <span className="capitalize">{tMenu('cancelSubmenu')}</span>
              </SubTriggerComponent>
              <SubContentComponent>
                {CANCELLATION_REASONS_QUICK.map((reason) => (
                  (() => {
                    const ReasonIcon = CANCELLATION_REASON_ICONS[reason];

                    return (
                      <ItemComponent
                        key={reason}
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                          onChange('cancelled', { cancellation_reason: reason });
                        }}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <ReasonIcon className="h-4 w-4 shrink-0" style={{ color: CANCELLATION_REASON_COLOR }} />
                        <ColorDot color={CANCELLATION_REASON_COLOR} />
                        <span>{tReason(reason)}</span>
                      </ItemComponent>
                    );
                  })()
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
                      <ColorDot color={CANCELLATION_REASON_COLOR} />
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
            <ColorDot color={statusColor} />
            <Icon className="h-4 w-4" style={{ color: statusColor }} />
            <span className="capitalize">{tStatus(status)}</span>
            {isCurrent && <Check className="ml-auto h-3.5 w-3.5 text-muted-foreground" />}
          </ItemComponent>
        );
      })}
    </>
  );
}
