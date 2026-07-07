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
  CANCELLATION_REASONS_SUBMENU,
  STATUS_ACCENT_COLOR,
  STATUS_BADGE_VARIANT,
  STATUS_MENU_LAYOUT,
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

/**
 * Shared body for every status picker: renders STATUS_MENU_LAYOUT (statuses,
 * the promoted cancellation actions and the trailing "Cancelar…" submenu with
 * the remaining reasons) using host-provided menu primitives so the exact same
 * ordering/logic drives both the badge DropdownMenu and the calendar ContextMenu.
 */
interface StatusMenuEntriesProps {
  appointment: Appointment;
  onChange: (newStatus: AppointmentStatus, extra?: StatusChangeExtra) => void;
  onRequestCustomCancellation?: () => void;
  Item: React.ComponentType<any>;
  Sub: React.ComponentType<any>;
  SubTrigger: React.ComponentType<any>;
  SubContent: React.ComponentType<any>;
  Separator: React.ComponentType<any>;
  /** How selecting an item is wired: DropdownMenu/ContextMenu `onSelect` vs a plain `onClick`. */
  interaction: 'select' | 'click';
}

function StatusMenuEntries({
  appointment,
  onChange,
  onRequestCustomCancellation,
  Item,
  Sub,
  SubTrigger,
  SubContent,
  Separator,
  interaction,
}: StatusMenuEntriesProps) {
  const tStatus = useTranslations('AppointmentStatus');
  const tMenu = useTranslations('AppointmentStatusMenu');
  const tReason = useTranslations('CancellationReason');
  const current = appointment.status;
  const allowed = ALLOWED_STATUS_TRANSITIONS[current] ?? [];
  const canCancel = allowed.includes('cancelled');
  const CancelIcon = STATUS_ICONS.cancelled;

  // Fire the action using the host menu's interaction API.
  const fire = (fn: () => void) =>
    interaction === 'select'
      ? { onSelect: (e: Event) => { e.preventDefault(); fn(); } }
      : { onClick: (e: React.MouseEvent) => { e.stopPropagation(); fn(); } };

  const statusItem = (status: AppointmentStatus) => {
    const Icon = STATUS_ICONS[status];
    const isCurrent = status === current;
    const enabled = !isCurrent && allowed.includes(status);
    const statusColor = STATUS_ACCENT_COLOR[status];
    return (
      <Item
        key={`status-${status}`}
        disabled={!enabled}
        {...fire(() => { if (enabled) onChange(status); })}
        className="flex items-center gap-2 cursor-pointer"
      >
        <ColorDot color={statusColor} />
        <Icon className="h-4 w-4 shrink-0" style={{ color: statusColor }} />
        <span className="flex-1 capitalize">{tStatus(status)}</span>
        {isCurrent && <Check className="ml-auto h-3.5 w-3.5 text-muted-foreground" />}
      </Item>
    );
  };

  const cancelReasonItem = (reason: CancellationReason) => {
    const ReasonIcon = CANCELLATION_REASON_ICONS[reason];
    const isCurrent = current === 'cancelled' && appointment.cancellation_reason === reason;
    const enabled = canCancel && !isCurrent;
    return (
      <Item
        key={`reason-${reason}`}
        disabled={!enabled}
        {...fire(() => { if (enabled) onChange('cancelled', { cancellation_reason: reason }); })}
        className="flex items-center gap-2 cursor-pointer"
      >
        <ReasonIcon className="h-4 w-4 shrink-0" style={{ color: CANCELLATION_REASON_COLOR }} />
        <ColorDot color={CANCELLATION_REASON_COLOR} />
        <span className="flex-1">{tReason(reason)}</span>
        {isCurrent && <Check className="ml-auto h-3.5 w-3.5 text-muted-foreground" />}
      </Item>
    );
  };

  return (
    <>
      {STATUS_MENU_LAYOUT.map((entry) => {
        if (entry.kind === 'status') return statusItem(entry.status);
        if (entry.kind === 'cancelReason') return cancelReasonItem(entry.reason);
        // Trailing "Cancelar…" submenu with the reasons not promoted above.
        return (
          <React.Fragment key="cancel-submenu">
            <Separator />
            <Sub>
              <SubTrigger disabled={!canCancel} className="flex items-center gap-2 cursor-pointer">
                <ColorDot color={CANCELLATION_REASON_COLOR} />
                <CancelIcon className="h-4 w-4 shrink-0" style={{ color: CANCELLATION_REASON_COLOR }} />
                <span className="capitalize">{tMenu('cancelSubmenu')}</span>
              </SubTrigger>
              <SubContent>
                {CANCELLATION_REASONS_SUBMENU.map((reason) => cancelReasonItem(reason))}
                {onRequestCustomCancellation && (
                  <>
                    <Separator />
                    <Item
                      {...fire(() => onRequestCustomCancellation())}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <ColorDot color={CANCELLATION_REASON_COLOR} />
                      <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                      <span>{tMenu('otherReason')}</span>
                    </Item>
                  </>
                )}
              </SubContent>
            </Sub>
          </React.Fragment>
        );
      })}
    </>
  );
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
        <StatusMenuEntries
          appointment={appointment}
          onChange={onChange}
          onRequestCustomCancellation={onRequestCustomCancellation}
          Item={DropdownMenuItem}
          Sub={DropdownMenuSub}
          SubTrigger={DropdownMenuSubTrigger}
          SubContent={DropdownMenuSubContent}
          Separator={DropdownMenuSeparator}
          interaction="select"
        />
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
 * Renderable list of <ContextMenuItem> entries for the calendar's native
 * ContextMenu. Delegates to the shared STATUS_MENU_LAYOUT renderer so the order,
 * the promoted cancellation actions and the trailing "Cancelar…" submenu stay in
 * sync with the badge dropdown.
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
  return (
    <StatusMenuEntries
      appointment={appointment}
      onChange={onChange}
      onRequestCustomCancellation={onRequestCustomCancellation}
      Item={ItemComponent}
      Sub={SubComponent}
      SubTrigger={SubTriggerComponent}
      SubContent={SubContentComponent}
      Separator={SeparatorComponent}
      interaction="click"
    />
  );
}
