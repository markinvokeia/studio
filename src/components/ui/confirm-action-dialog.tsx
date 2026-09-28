'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import { cn } from '@/lib/utils';

export interface ConfirmActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  /** Should name the affected entity (e.g. `t('deleteDialog.description', { name })`). */
  description: React.ReactNode;
  confirmLabel: React.ReactNode;
  cancelLabel: React.ReactNode;
  /** Starts the async action — usually `action.run` from `useAsyncAction`. Close the dialog in its `onSuccess`. */
  onConfirm: () => void;
  /** While true the dialog can't be dismissed and both buttons are disabled. */
  isPending: boolean;
  /** Destructive styling for the confirm button. Defaults to `true`. */
  destructive?: boolean;
  /** Extra content between the description and the footer. */
  children?: React.ReactNode;
}

/**
 * Confirmation for destructive/irreversible async actions. Unlike a bare `AlertDialogAction`,
 * it stays open until the request settles (so errors keep their context and a double click
 * can't fire the action twice) and can't be dismissed with Escape / Cancel while pending.
 */
const ConfirmActionDialog = ({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  isPending,
  destructive = true,
  children,
}: ConfirmActionDialogProps) => (
  <AlertDialog
    open={open}
    onOpenChange={(next) => {
      if (!isPending) onOpenChange(next);
    }}
  >
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{title}</AlertDialogTitle>
      </AlertDialogHeader>
      <AlertDialogDescription>{description}</AlertDialogDescription>
      {children}
      <AlertDialogFooter>
        <AlertDialogCancel disabled={isPending}>{cancelLabel}</AlertDialogCancel>
        <AlertDialogAction
          onClick={(event) => {
            // Keep the dialog open until the request settles; the caller closes it on success.
            event.preventDefault();
            onConfirm();
          }}
          disabled={isPending}
          aria-busy={isPending || undefined}
          className={cn(destructive && 'bg-destructive text-destructive-foreground hover:bg-destructive/90')}
        >
          {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {confirmLabel}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
ConfirmActionDialog.displayName = 'ConfirmActionDialog';

export { ConfirmActionDialog };
