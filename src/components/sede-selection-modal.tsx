'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { AlertTriangle, Loader2, MapPin } from 'lucide-react';

/**
 * Blocking modal shown to a logged-in user with access to more than one sede
 * but no active sede selected yet. Mirrors WorkingSedeSelector's visibility
 * rule (sedes.length <= 1 never needs a prompt).
 */
export function SedeSelectionModal() {
  const t = useTranslations('SedeSelectionModal');
  const { user, isLoading, sedes, activeSede, setActiveSede } = useAuth();
  const [savingId, setSavingId] = React.useState<string | null>(null);

  const shouldShow = !isLoading && !!user && sedes.length > 1 && !activeSede;

  const handleSelect = async (sedeId: string) => {
    setSavingId(sedeId);
    try {
      await setActiveSede(sedeId);
    } catch (error) {
      console.error('Failed to set active sede:', error);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <AlertDialog open={shouldShow}>
      <AlertDialogContent
        className="sm:max-w-md"
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0" />
            <AlertDialogTitle>{t('title')}</AlertDialogTitle>
          </div>
        </AlertDialogHeader>
        <AlertDialogDescription>{t('description')}</AlertDialogDescription>
        <div className="px-6 pb-6 flex flex-col gap-2 max-h-64 overflow-y-auto">
          {sedes.map((sede) => (
            <Button
              key={sede.id}
              type="button"
              variant="outline"
              className={cn('justify-start gap-2')}
              disabled={savingId !== null}
              onClick={() => handleSelect(sede.id)}
            >
              {savingId === sede.id ? (
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              ) : (
                <MapPin className="h-4 w-4 shrink-0" />
              )}
              {sede.name}
            </Button>
          ))}
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
