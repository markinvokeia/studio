'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useLicenseStore } from '@/stores/license-store';
import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

const schema = z.object({
  masterKey: z.string().min(1, 'La clave maestra es requerida'),
});
type FormValues = z.infer<typeof schema>;

interface MasterKeyPromptModalProps {
  isOpen: boolean;
  onVerified: (masterKey: string) => void;
  onCancel?: () => void;
}

export function MasterKeyPromptModal({ isOpen, onVerified, onCancel }: MasterKeyPromptModalProps) {
  const t = useTranslations('License');
  const { licenseKey, verifyLicenseIntegrity } = useLicenseStore();
  const [isVerifying, setIsVerifying] = React.useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { masterKey: '' },
  });

  async function onSubmit({ masterKey }: FormValues) {
    setIsVerifying(true);
    try {
      if (licenseKey) {
        const valid = await verifyLicenseIntegrity(licenseKey, masterKey);
        if (!valid) {
          form.setError('masterKey', { message: t('masterKey.invalid') });
          return;
        }
      }
      onVerified(masterKey);
    } finally {
      setIsVerifying(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open) onCancel?.(); }}>
      <DialogContent className="sm:max-w-md" onInteractOutside={e => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            {t('masterKey.prompt')}
          </DialogTitle>
          <DialogDescription>{t('masterKey.promptDescription')}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="masterKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('masterKey.prompt')}</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder={t('masterKey.placeholder')}
                      autoComplete="off"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancelar
                </Button>
              )}
              <Button type="submit" disabled={isVerifying}>
                {isVerifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('masterKey.submit')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
