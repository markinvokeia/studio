'use client';

import { useTranslations } from 'next-intl';
import * as React from 'react';

import { InvokeMascot } from '@/components/invoke-mascot';

import { useAuth } from '@/context/AuthContext';
import { useMascotPreference } from '@/hooks/use-mascot-preference';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';

import { HELP_PERMISSIONS } from '@/constants/permissions';

interface MascotWakeButtonProps {
  /** Separador arriba (riel de escritorio). */
  withDivider?: boolean;
  /** Sin etiqueta (barra mobile). */
  compact?: boolean;
}

/**
 * Con la mascota escondida, queda dormida en el riel: un clic y se levanta.
 * No se muestra mientras la mascota está en pantalla.
 */
export function MascotWakeButton({ withDivider, compact }: MascotWakeButtonProps) {
  const t = useTranslations('HelpAssistant.mascot');
  const { user } = useAuth();
  const { hasPermission, isLoading } = usePermissions();
  const [showMascot, setShowMascot] = useMascotPreference(user?.id);

  if (showMascot || isLoading || !hasPermission(HELP_PERMISSIONS.ASSISTANT_USE)) return null;

  const button = (
    <button
      type="button"
      onClick={() => setShowMascot(true)}
      className={cn(
        'flex h-10 w-10 items-center justify-center rounded-xl bg-[#7C3AED]/10 transition-colors hover:bg-[#7C3AED]/20',
        'animate-in fade-in zoom-in-75 duration-300',
      )}
      aria-label={t('wake')}
      title={t('wake')}
    >
      <InvokeMascot size={34} mood="sleeping" title={t('wake')} />
    </button>
  );

  if (compact) return button;

  return (
    <>
      {withDivider && <div className="my-1.5 h-px w-8 shrink-0 bg-border/50" />}
      <div className="flex w-full flex-col items-center gap-1 px-1">
        {button}
        <span className="select-none text-center text-[7.5px] font-medium leading-none tracking-tight text-muted-foreground">
          {t('railLabel')}
        </span>
      </div>
    </>
  );
}
