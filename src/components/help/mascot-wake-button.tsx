'use client';

import { HelpCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

import { InvokeMascot } from '@/components/invoke-mascot';

import { useAuth } from '@/context/AuthContext';
import { useMascotPreference } from '@/hooks/use-mascot-preference';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';
import { useHelpAssistant } from '@/stores/help-assistant-store';

import { HELP_PERMISSIONS } from '@/constants/permissions';

interface MascotWakeButtonProps {
  /** Separador arriba (riel de escritorio). */
  withDivider?: boolean;
  /** Sin etiqueta (barra mobile). */
  compact?: boolean;
}

/**
 * Entrada al asistente desde el riel cuando la mascota no está en pantalla:
 * - la persona la escondió → la mascota dormida: un clic y se levanta;
 * - la clínica no la quiere visible (Preferencias de Clínica) → el ícono de ayuda,
 *   que abre el asistente (las guías funcionan igual, sin mascota).
 */
export function MascotWakeButton({ withDivider, compact }: MascotWakeButtonProps) {
  const t = useTranslations('HelpAssistant.mascot');
  const { user } = useAuth();
  const { hasPermission, isLoading } = usePermissions();
  const [showMascot, setShowMascot] = useMascotPreference(user?.id);
  const clinicVisible = useHelpAssistant((s) => s.clinicMascotVisible);
  const open = useHelpAssistant((s) => s.open);

  if ((clinicVisible && showMascot) || isLoading || !hasPermission(HELP_PERMISSIONS.ASSISTANT_USE)) return null;

  const label = clinicVisible ? t('wake') : t('openHelp');
  const button = (
    <button
      type="button"
      data-help-launcher
      data-help-id="rail.section.assistant"
      onClick={() => (clinicVisible ? setShowMascot(true) : open())}
      className={cn(
        'flex h-10 w-10 items-center justify-center rounded-xl bg-[#7C3AED]/10 text-[#7C3AED] transition-colors hover:bg-[#7C3AED]/20',
        'animate-in fade-in zoom-in-75 duration-300',
      )}
      aria-label={label}
      title={label}
    >
      {clinicVisible ? <InvokeMascot size={34} mood="sleeping" title={label} /> : <HelpCircle className="h-5 w-5" />}
    </button>
  );

  if (compact) return button;

  return (
    <>
      {withDivider && <div className="my-1.5 h-px w-8 shrink-0 bg-border/50" />}
      <div className="flex w-full flex-col items-center gap-1 px-1">
        {button}
        <span className="select-none text-center text-[7.5px] font-medium leading-none tracking-tight text-muted-foreground">
          {clinicVisible ? t('railLabel') : t('helpLabel')}
        </span>
      </div>
    </>
  );
}
