'use client';

import React from 'react';

import { getAestheticFileUrl } from '@/services/aesthetic-record';

/** `undefined` while loading, `null` when the file is not available in this browser */
export function useAestheticFileUrl(fileId: string | undefined): string | null | undefined {
  const [url, setUrl] = React.useState<string | null | undefined>(undefined);

  React.useEffect(() => {
    if (!fileId) {
      setUrl(null);
      return;
    }
    let active = true;
    setUrl(undefined);
    getAestheticFileUrl(fileId)
      .then((next) => { if (active) setUrl(next); })
      .catch(() => { if (active) setUrl(null); });
    return () => { active = false; };
  }, [fileId]);

  return url;
}
