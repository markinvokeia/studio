'use client';

import React from 'react';
import { Camera, RotateCcw, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import type { AestheticPhoto } from '@/lib/types';
import { AlignedPhoto } from './aligned-photo';
import { getFaceArtwork } from './map-templates';
import { TEMPLATE_ASPECT, TEMPLATE_SIZE, type PhotoView } from './photo-utils';

export interface CapturedPhoto {
  file: File;
  /** Taken through the guide (its frame is the template's): it needs no alignment */
  framed: boolean;
}

interface CameraCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  view: PhotoView;
  viewLabel: string;
  /** Photo of the same view of the last session, shown at 30 % to repeat pose, distance and light */
  ghost?: AestheticPhoto | null;
  onCapture: (photo: CapturedPhoto) => void;
}

/** Outline of the view's template, dashed: where the face goes */
export function FramingGuide({ view }: { view: PhotoView }) {
  const art = React.useMemo(() => getFaceArtwork(view), [view]);
  const outline = art.lines.slice(0, view === 'front' ? 0 : 2);
  const symmetric = view === 'front' ? art.lines.filter((l) => l.key === 'ls0' || l.key === 'ls0m') : [];
  return (
    <svg viewBox={`0 0 ${TEMPLATE_SIZE.width} ${TEMPLATE_SIZE.height}`} preserveAspectRatio="xMidYMid slice" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
      {[...outline, ...symmetric].map((shape) => (
        <path key={shape.key} d={shape.d} transform={shape.transform} fill="none" stroke="white" strokeWidth={2.5} strokeDasharray="7 7" opacity={0.85} vectorEffect="non-scaling-stroke" />
      ))}
      {view === 'front' && <line x1={84} y1={172} x2={216} y2={172} stroke="white" strokeWidth={1.2} strokeDasharray="3 5" opacity={0.7} vectorEffect="non-scaling-stroke" />}
    </svg>
  );
}

/**
 * The device's camera (the back one on a phone or tablet) with the guide over it. Without a live
 * camera (desktop without webcam, a blocked permission) it falls back to the system camera or a file.
 */
export function CameraCaptureDialog({ open, onOpenChange, view, viewLabel, ghost, onCapture }: CameraCaptureDialogProps) {
  const t = useTranslations('AestheticRecord');
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [state, setState] = React.useState<'starting' | 'live' | 'unavailable'>('starting');
  const [shot, setShot] = React.useState<{ file: File; url: string } | null>(null);

  const stop = React.useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const start = React.useCallback(async () => {
    setState('starting');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('no camera api');
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } }, audio: false });
      streamRef.current = stream;
      setState('live');
    } catch {
      setState('unavailable');
    }
  }, []);

  React.useEffect(() => {
    if (!open) return;
    setShot(null);
    start();
    return stop;
  }, [open, start, stop]);

  React.useEffect(() => () => { if (shot) URL.revokeObjectURL(shot.url); }, [shot]);

  // The video mounts after the stream starts (and again after a retake)
  React.useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (state !== 'live' || shot || !video || !stream || video.srcObject === stream) return;
    video.srcObject = stream;
    video.play().catch(() => undefined);
  }, [state, shot]);

  function snap() {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    // Crop the frame to the template's shape, centred like the preview (object-cover)
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    let sw = vw;
    let sh = vh;
    if (vw / vh > TEMPLATE_ASPECT) sw = vh * TEMPLATE_ASPECT;
    else sh = vw / TEMPLATE_ASPECT;
    const canvas = document.createElement('canvas');
    canvas.width = Math.min(1500, Math.round(sw));
    canvas.height = Math.round(canvas.width / TEMPLATE_ASPECT);
    canvas.getContext('2d')?.drawImage(video, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `foto-${view}-${Date.now()}.jpg`, { type: 'image/jpeg' });
      stop();
      setShot({ file, url: URL.createObjectURL(blob) });
    }, 'image/jpeg', 0.9);
  }

  function pickFile(e: React.ChangeEvent<HTMLInputElement>, framed: boolean) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    onCapture({ file, framed });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('flow.photos.cameraTitle', { view: viewLabel })}</DialogTitle>
          <DialogDescription>{ghost ? t('flow.photos.cameraGhostHint') : t('flow.photos.cameraHint')}</DialogDescription>
        </DialogHeader>
        <DialogBody className="px-6 py-3">
          <div className="relative mx-auto w-full max-w-sm overflow-hidden rounded-2xl bg-[#0d0b14]" style={{ aspectRatio: `${TEMPLATE_SIZE.width} / ${TEMPLATE_SIZE.height}` }}>
            {shot ? (
              // eslint-disable-next-line @next/next/no-img-element -- local preview
              <img src={shot.url} alt={t('flow.photos.preview')} className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <>
                <video ref={videoRef} playsInline autoPlay muted className="absolute inset-0 h-full w-full object-cover" />
                {ghost && <div className="pointer-events-none absolute inset-0 opacity-30"><AlignedPhoto photoId={ghost.id} view={view} alignment={ghost.alignment} alt="" /></div>}
                <FramingGuide view={view} />
                {state !== 'live' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-sm text-white/90">
                    {state === 'starting' ? t('flow.photos.cameraStarting') : (
                      <>
                        <b className="text-[15px]">{t('flow.photos.cameraUnavailable')}</b>
                        <span>{t('flow.photos.cameraUnavailableHint')}</span>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </DialogBody>
        <DialogFooter className="flex-wrap gap-2 sm:justify-center">
          {shot ? (
            <>
              <Button type="button" variant="outline" onClick={() => { setShot(null); start(); }}>
                <RotateCcw className="mr-1.5 h-4 w-4" />{t('flow.photos.retake')}
              </Button>
              <Button type="button" onClick={() => { onCapture({ file: shot.file, framed: true }); onOpenChange(false); }}>{t('flow.photos.usePhoto')}</Button>
            </>
          ) : state === 'live' ? (
            <button
              type="button"
              onClick={snap}
              aria-label={t('flow.photos.shutter')}
              className="h-16 w-16 rounded-full border-4 border-border bg-violet-600 shadow-sm transition-transform active:scale-95"
            />
          ) : (
            <>
              <Button type="button" onClick={() => cameraInputRef.current?.click()} disabled={state === 'starting'}>
                <Camera className="mr-1.5 h-4 w-4" />{t('flow.photos.systemCamera')}
              </Button>
              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                <Upload className="mr-1.5 h-4 w-4" />{t('flow.photos.upload')}
              </Button>
            </>
          )}
        </DialogFooter>
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => pickFile(e, false)} />
        <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={(e) => pickFile(e, false)} />
      </DialogContent>
    </Dialog>
  );
}
