'use client';

import { HelpCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

import { InvokeMascot, useMascot } from '@/components/invoke-mascot';

import { activateAssistant } from '@/components/help/mascot-host';

import { useAuth } from '@/context/AuthContext';
import { useMascotPreference } from '@/hooks/use-mascot-preference';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';
import { useHelpAssistant } from '@/stores/help-assistant-store';

import { HELP_PERMISSIONS } from '@/constants/permissions';

/** Escondida, el ícono del riel saluda cada tanto para que se note que está ahí. */
const WAVE_EVERY_MS = 7000;
const WAVE_FOR_MS = 1600;

interface MascotWakeButtonProps {
  /** Separador arriba (riel de escritorio). */
  withDivider?: boolean;
  /** Sin etiqueta (barra mobile). */
  compact?: boolean;
}

/** Saluda cada `WAVE_EVERY_MS` mientras `active` (nada con movimiento reducido). */
function usePeriodicWave(active: boolean): boolean {
  const [waving, setWaving] = React.useState(false);
  React.useEffect(() => {
    setWaving(false);
    if (!active || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let stop: ReturnType<typeof setTimeout> | undefined;
    const wave = () => {
      setWaving(true);
      stop = setTimeout(() => setWaving(false), WAVE_FOR_MS);
    };
    const first = setTimeout(wave, 1200);
    const interval = setInterval(wave, WAVE_EVERY_MS);
    return () => { clearTimeout(first); clearInterval(interval); clearTimeout(stop); };
  }, [active]);
  return waving;
}

/**
 * Entrada al asistente desde el riel:
 * - la clínica no quiere la mascota (Preferencias de Clínica) → sólo el ícono de ayuda,
 *   que abre el asistente (las guías funcionan igual, sin mascota);
 * - la mascota está fuera de escena (la persona la escondió, o está dormida o tras el riel)
 *   → su ícono saludando cada tanto: un clic y vuelve;
 * - la mascota está a la vista → su ícono quieto, que abre el asistente como ella.
 */
export function MascotWakeButton({ withDivider, compact }: MascotWakeButtonProps) {
  const t = useTranslations('HelpAssistant.mascot');
  const { user } = useAuth();
  const { hasPermission, isLoading } = usePermissions();
  const [showMascot, setShowMascot] = useMascotPreference(user?.id);
  const clinicVisible = useHelpAssistant((s) => s.clinicMascotVisible);
  const open = useHelpAssistant((s) => s.open);
  const mascot = useMascot();
  const offStage = !showMascot || mascot.phase === 'sleeping' || mascot.phase === 'peeking';
  const waving = usePeriodicWave(clinicVisible && offStage);

  if (isLoading || !hasPermission(HELP_PERMISSIONS.ASSISTANT_USE)) return null;

  const onClick = () => {
    if (!clinicVisible) open();
    else if (!showMascot) setShowMascot(true);
    else activateAssistant(mascot);
  };
  const label = !clinicVisible ? t('openHelp') : offStage ? t('wake') : t('openHelp');
  const button = (
    <button
      type="button"
      data-help-launcher
      data-help-id="rail.section.assistant"
      onClick={onClick}
      className={cn(
        'flex h-10 w-10 items-center justify-center rounded-xl bg-[#7C3AED]/10 text-[#7C3AED] transition-colors hover:bg-[#7C3AED]/20',
        'animate-in fade-in zoom-in-75 duration-300',
      )}
      aria-label={label}
      title={label}
    >
      {clinicVisible ? (
        <InvokeMascot size={34} mood={waving ? 'happy' : 'neutral'} gesture={waving ? 'wave' : 'none'} animated={offStage} autoBlink={offStage} title={label} />
      ) : (
        <HelpCircle className="h-5 w-5" />
      )}
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
