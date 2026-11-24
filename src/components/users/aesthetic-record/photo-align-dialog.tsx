'use client';

import React from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogCancelButton, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';

import type { AestheticPhotoAlignment } from '@/lib/types';
import { AlignedPhoto } from './aligned-photo';
import { alignmentFromLandmarks, useImageSize, type PhotoView } from './photo-utils';
import { useAestheticFileUrl } from './use-aesthetic-file-url';

interface PhotoAlignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photoId: string;
  view: PhotoView;
  onSave: (alignment: AestheticPhotoAlignment | null) => Promise<unknown>;
}

/**
 * Manual alignment in two taps: the eyes on the front, the eye and the chin on a profile. The
 * photo is then placed on the template so every session's photo of the view lines up.
 */
export function PhotoAlignDialog({ open, onOpenChange, photoId, view, onSave }: PhotoAlignDialogProps) {
  const t = useTranslations('AestheticRecord');
  const url = useAestheticFileUrl(open ? photoId : undefined);
  const size = useImageSize(url);
  const [points, setPoints] = React.useState<[number, number][]>([]);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => { if (open) setPoints([]); }, [open]);

  const prompts = view === 'front' ? ['flow.align.rightEye', 'flow.align.leftEye'] : ['flow.align.eye', 'flow.align.chin'];
  const alignment = points.length === 2 && size ? alignmentFromLandmarks(view, size, [points[0], points[1]]) : null;

  /** Where the tap lands on the image, as fractions of it (the image is letterboxed inside the box) */
  function handleTap(e: React.MouseEvent<HTMLDivElement>) {
    if (!size || points.length >= 2) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const scale = Math.min(rect.width / size.width, rect.height / size.height);
    const w = size.width * scale;
    const h = size.height * scale;
    const u = (e.clientX - rect.left - (rect.width - w) / 2) / w;
    const v = (e.clientY - rect.top - (rect.height - h) / 2) / h;
    if (u < 0 || u > 1 || v < 0 || v > 1) return;
    setPoints((p) => [...p, [u, v]]);
  }

  async function save(value: AestheticPhotoAlignment | null) {
    setSaving(true);
    try {
      await onSave(value);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('flow.align.title')}</DialogTitle>
          <DialogDescription>{points.length < 2 ? t(prompts[points.length]) : t('flow.align.done')}</DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-3 px-6 py-3 sm:grid-cols-2">
          <div className="relative aspect-[4/5] cursor-crosshair overflow-hidden rounded-xl bg-muted" onClick={handleTap}>
            {url ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- stored photo (object URL) */}
                <img src={url} alt="" className="absolute inset-0 h-full w-full object-contain" draggable={false} />
                {size && points.map(([u, v], i) => <TapDot key={i} u={u} v={v} size={size} index={i + 1} />)}
              </>
            ) : <Skeleton className="absolute inset-0" />}
          </div>
          <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-muted">
            {alignment ? (
              <AlignedPhoto url={url} view={view} alignment={alignment} alt={t('flow.align.result')} />
            ) : (
              <p className="absolute inset-0 grid place-items-center p-6 text-center text-xs text-muted-foreground">{t('flow.align.resultHint')}</p>
            )}
          </div>
        </DialogBody>
        <DialogFooter className="flex-wrap gap-2">
          <Button type="button" variant="ghost" onClick={() => setPoints([])} disabled={!points.length || saving}>{t('flow.align.restart')}</Button>
          <Button type="button" variant="ghost" onClick={() => save(null)} disabled={saving}>{t('flow.align.clear')}</Button>
          <span className="flex-1" />
          <DialogCancelButton disabled={saving}>{t('cancel')}</DialogCancelButton>
          <Button type="button" onClick={() => alignment && save(alignment)} disabled={!alignment} loading={saving}>{t('flow.align.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Numbered dot where a landmark was tapped, placed over the letterboxed image */
function TapDot({ u, v, size, index }: { u: number; v: number; size: { width: number; height: number }; index: number }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const [pos, setPos] = React.useState<{ left: number; top: number } | null>(null);
  React.useLayoutEffect(() => {
    const box = ref.current?.parentElement?.getBoundingClientRect();
    if (!box) return;
    const scale = Math.min(box.width / size.width, box.height / size.height);
    const w = size.width * scale;
    const h = size.height * scale;
    setPos({ left: (box.width - w) / 2 + u * w, top: (box.height - h) / 2 + v * h });
  }, [u, v, size]);
  return (
    <span
      ref={ref}
      className="pointer-events-none absolute grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-violet-600 text-[11px] font-bold text-white shadow"
      style={pos ?? { visibility: 'hidden' }}
    >
      {index}
    </span>
  );
}
