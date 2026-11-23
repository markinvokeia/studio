'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, Box } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

import { usePermissions } from '@/hooks/usePermissions';

import { CASHIER_PERMISSIONS } from '@/constants/permissions';

interface NoCashSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Offered before the invoice exists ("Facturar y Cobrar" without an open cash session): lets
   * the user create the invoice alone and collect it later, instead of leaving the wizard.
   */
  onInvoiceOnly?: () => void;
}

/** "Sin sesión de caja activa" — a payment needs an open cash session. */
export function NoCashSessionDialog({ open, onOpenChange, onInvoiceOnly }: NoCashSessionDialogProps) {
  const t = useTranslations('InvoicesPage');
  const tw = useTranslations('BillingWizard');
  const locale = useLocale();
  const { hasPermission } = usePermissions();
  const canAccessCashier = hasPermission(CASHIER_PERMISSIONS.VIEW_MENU);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-start gap-3">
            <div className="header-icon-circle mt-0.5">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
            </div>
            <div className="flex flex-col text-left">
              <AlertDialogTitle>{t('noSessionDialog.title')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('noSessionDialog.description')}
                {onInvoiceOnly && <span className="mt-2 block">{tw('noSession.invoiceOnlyHint')}</span>}
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{tw('actions.cancel')}</AlertDialogCancel>
          {onInvoiceOnly && (
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                onInvoiceOnly();
              }}
            >
              {tw('actions.invoiceOnly')}
            </Button>
          )}
          {canAccessCashier && (
            <Link href={`/${locale}/cashier`} passHref>
              <Button>
                <Box className="mr-2 h-4 w-4" />
                {tw('payment.openCashSession')}
              </Button>
            </Link>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
