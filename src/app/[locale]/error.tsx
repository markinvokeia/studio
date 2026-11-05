'use client';

import { AlertTriangle, Loader2, RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

import { Button } from '@/components/ui/button';

const RELOAD_KEY = 'invoke-chunk-reload';
/** Si vuelve a fallar dentro de este lapso después de recargar, no se recarga de nuevo (evita un bucle). */
const RELOAD_WINDOW_MS = 30_000;

/**
 * El navegador pidió un chunk de JS que ya no existe: en desarrollo, Next
 * descarta las pantallas que no se usan hace rato; en producción, pasa tras un
 * deploy con la pestaña abierta. Se arregla recargando la página.
 */
function isChunkLoadError(error: Error): boolean {
  return error.name === 'ChunkLoadError' || /Loading (CSS )?chunk [\s\S]* failed/i.test(error.message);
}

function shouldReload(): boolean {
  try {
    const last = Number(window.sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < RELOAD_WINDOW_MS) return false;
    window.sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    return true;
  } catch {
    return false;
  }
}

export default function LocaleError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('RouteError');
  const chunkError = isChunkLoadError(error);
  const [reloading, setReloading] = React.useState(false);

  React.useEffect(() => {
    if (chunkError && shouldReload()) {
      setReloading(true);
      window.location.reload();
    }
  }, [chunkError]);

  if (reloading) {
    return (
      <div className="flex h-full min-h-[50vh] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('reloading')}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[50vh] items-center justify-center p-6">
      <div className="max-w-sm space-y-3 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
        <h2 className="text-base font-semibold">{t('title')}</h2>
        <p className="text-sm text-muted-foreground">{chunkError ? t('chunkDescription') : t('description')}</p>
        <Button
          variant="outline"
          className="gap-1.5"
          onClick={() => (chunkError ? window.location.reload() : reset())}
        >
          <RotateCcw className="h-4 w-4" />
          {chunkError ? t('reload') : t('retry')}
        </Button>
      </div>
    </div>
  );
}
