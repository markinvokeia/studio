'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogCancelButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

import type { CalendarItemScope } from '@/lib/types';

interface ReminderScopeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Qué se va a hacer: cambia los textos, no las opciones. */
  action: 'edit' | 'delete';
  onConfirm: (scope: CalendarItemScope) => void;
}

/**
 * Pregunta si una edición o un borrado alcanza a una sola ocurrencia o a toda la serie.
 *
 * Arranca siempre en 'occurrence': es la opción que no destruye nada, y la que el usuario
 * quiere la mayoría de las veces. Elegir la serie por descuido rehace fechas de meses.
 */
export function ReminderScopeDialog({
  open,
  onOpenChange,
  action,
  onConfirm,
}: ReminderScopeDialogProps) {
  const t = useTranslations('Reminders');
  const tGeneral = useTranslations('General');
  const [scope, setScope] = React.useState<CalendarItemScope>('occurrence');

  React.useEffect(() => {
    if (open) setScope('occurrence');
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent maxWidth="sm">
        <DialogHeader>
          <DialogTitle>{t(action === 'edit' ? 'scope.editTitle' : 'scope.deleteTitle')}</DialogTitle>
          <DialogDescription>
            {t(action === 'edit' ? 'scope.editDescription' : 'scope.deleteDescription')}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="px-6 py-5">
          <RadioGroup
            value={scope}
            onValueChange={(value) => setScope(value as CalendarItemScope)}
            className="gap-3"
          >
            <div className="flex items-start gap-3 rounded-lg border p-3">
              <RadioGroupItem value="occurrence" id="reminder-scope-occurrence" data-testid="reminder-scope-occurrence" className="mt-0.5" />
              <div className="space-y-1 leading-none">
                <Label htmlFor="reminder-scope-occurrence" className="font-normal">{t('scope.occurrence')}</Label>
                <p className="text-xs text-muted-foreground">{t('scope.occurrenceHint')}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border p-3">
              <RadioGroupItem value="series" id="reminder-scope-series" data-testid="reminder-scope-series" className="mt-0.5" />
              <div className="space-y-1 leading-none">
                <Label htmlFor="reminder-scope-series" className="font-normal">{t('scope.series')}</Label>
                <p className="text-xs text-muted-foreground">{t('scope.seriesHint')}</p>
              </div>
            </div>
          </RadioGroup>
        </DialogBody>

        <DialogFooter>
          <DialogCancelButton variant="outline">{tGeneral('cancel')}</DialogCancelButton>
          <Button
            type="button"
            data-testid="reminder-scope-confirm"
            variant={action === 'delete' ? 'destructive' : 'default'}
            onClick={() => {
              onConfirm(scope);
              onOpenChange(false);
            }}
          >
            {t('scope.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
