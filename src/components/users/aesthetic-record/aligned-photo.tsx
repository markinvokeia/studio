'use client';

import React from 'react';
import { ImageOff } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';

import { cn } from '@/lib/utils';

import type { AestheticMapView, AestheticPhotoAlignment } from '@/lib/types';
import { fitBackdrop } from './aesthetic-map';
import type { PlacedMark } from './layers';
import { TEMPLATE_SIZE, useImageSize } from './photo-utils';
import { useAestheticFileUrl } from './use-aesthetic-file-url';

interface AlignedPhotoProps {
  /** Stored photo id; ignored when `url` is given */
  photoId?: string;
  url?: string | null;
  view: AestheticMapView;
  alignment?: AestheticPhotoAlignment;
  /** Marks drawn over the photo (only those of `view`) */
  marks?: PlacedMark[];
  alt: string;
  opacity?: number;
  className?: string;
}

/**
 * A photo in the template's space, placed with its alignment: two aligned photos of the same
 * view show the face at the same spot, so a slider or an overlay compares the same thing.
 */
export function AlignedPhoto({ photoId, url: urlProp, view, alignment, marks, alt, opacity = 1, className }: AlignedPhotoProps) {
  const storedUrl = useAestheticFileUrl(urlProp !== undefined ? undefined : photoId);
  const url = urlProp !== undefined ? urlProp : storedUrl;
  const size = useImageSize(url);
  const clipId = `aligned-${React.useId().replace(/:/g, '')}`;
  const { width: W, height: H } = TEMPLATE_SIZE;

  if (url === undefined) return <Skeleton className={cn('h-full w-full rounded-none', className)} />;
  if (!url) {
    return (
      <div className={cn('flex h-full w-full items-center justify-center bg-muted text-muted-foreground', className)}>
        <ImageOff className="h-6 w-6" aria-label={alt} />
      </div>
    );
  }

  let image: React.ReactNode = null;
  if (size) {
    const a = alignment ?? fitBackdrop(view, size, TEMPLATE_SIZE);
    const aspect = size.height / size.width;
    const width = Math.min(W, H / aspect) * a.scale;
    const height = width * aspect;
    image = (
      <image
        href={url}
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        preserveAspectRatio="none"
        transform={`translate(${a.x * W} ${a.y * H}) rotate(${a.rotation}) scale(${a.mirrored ? -1 : 1} 1)`}
      />
    );
  }

  const shown = marks?.filter((m) => m.mark.view === view) ?? [];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={alt} className={cn('h-full w-full select-none', className)} style={{ opacity }}>
      <defs>
        <clipPath id={clipId}><rect width={W} height={H} /></clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>{image}</g>
      {shown.length > 0 && (
        <g pointerEvents="none">
          {shown.map(({ mark, color, number }) => {
            const at = { x: mark.x * W, y: mark.y * H };
            const pts = mark.polygon?.map(([x, y]) => `${x * W},${y * H}`).join(' ');
            return (
              <g key={mark.id}>
                {mark.kind === 'area' && pts && <polygon points={pts} fill={color} fillOpacity={0.3} stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />}
                {mark.kind === 'line' && pts && <polyline points={pts} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" />}
                <circle cx={at.x} cy={at.y} r={6} fill={color} stroke="white" strokeWidth={1.5} />
                <text x={at.x} y={at.y} dy="0.35em" textAnchor="middle" fontSize={6.5} className="fill-white font-semibold">{number}</text>
              </g>
            );
          })}
        </g>
      )}
    </svg>
  );
}
