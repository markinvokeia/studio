'use client';

import React from 'react';

import type { AestheticMapView, AestheticPhoto, AestheticPhotoAlignment, AestheticSession } from '@/lib/types';
import { FRONT_TEMPLATE } from './map-templates';

/** Face views a session takes photos of, in the order of their slots */
export const PHOTO_VIEWS = ['front', 'left', 'right'] as const satisfies readonly AestheticMapView[];
export type PhotoView = (typeof PHOTO_VIEWS)[number];

/** Both face templates share this size; photos are aligned to it */
export const TEMPLATE_SIZE = { width: FRONT_TEMPLATE.width, height: FRONT_TEMPLATE.height };
/** A photo taken through the guide has the template's shape */
export const TEMPLATE_ASPECT = TEMPLATE_SIZE.width / TEMPLATE_SIZE.height;

/** A photo framed with the guide fills the template exactly */
export const GUIDE_ALIGNMENT: AestheticPhotoAlignment = { x: 0.5, y: 0.5, scale: 1, rotation: 0, mirrored: false };

const MAX_SIDE = 2000;

/**
 * Re-encodes a picture as JPEG (at most 2000 px a side). Drawing it on a canvas drops its
 * metadata, GPS location included. A format the browser can't decode (HEIC on most) goes as is.
 */
export async function prepareUpload(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const ratio = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * ratio);
    canvas.height = Math.round(bitmap.height * ratio);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

/**
 * Two facial landmarks per view, in template units: both eyes on the front (the patient's right
 * first, on the viewer's left), the eye and the chin on a profile. The left profile is the right
 * one mirrored.
 */
export function viewLandmarks(view: PhotoView): [[number, number], [number, number]] {
  if (view === 'front') return [[114, 172], [186, 172]];
  const right: [[number, number], [number, number]] = [[214, 166], [226, 314]];
  if (view === 'right') return right;
  return [[TEMPLATE_SIZE.width - right[0][0], right[0][1]], [TEMPLATE_SIZE.width - right[1][0], right[1][1]]];
}

/**
 * Placement that puts two points of the photo (fractions of its width and height) on the
 * view's two landmarks. Same model as the map's backdrop: centred at (x, y) of the template,
 * fitted inside it times `scale`, rotated around its centre.
 */
export function alignmentFromLandmarks(view: PhotoView, image: { width: number; height: number }, points: [[number, number], [number, number]]): AestheticPhotoAlignment {
  const { width: W, height: H } = TEMPLATE_SIZE;
  const aspect = image.height / image.width;
  const base = Math.min(W, H / aspect);
  const [t1, t2] = viewLandmarks(view);
  // The photo's points relative to its centre, at scale 1
  const l1 = [(points[0][0] - 0.5) * base, (points[0][1] - 0.5) * base * aspect];
  const l2 = [(points[1][0] - 0.5) * base, (points[1][1] - 0.5) * base * aspect];
  const dl = [l2[0] - l1[0], l2[1] - l1[1]];
  const dt = [t2[0] - t1[0], t2[1] - t1[1]];
  const scale = Math.hypot(dt[0], dt[1]) / Math.max(1e-6, Math.hypot(dl[0], dl[1]));
  const angle = Math.atan2(dt[1], dt[0]) - Math.atan2(dl[1], dl[0]);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const cx = t1[0] - scale * (cos * l1[0] - sin * l1[1]);
  const cy = t1[1] - scale * (sin * l1[0] + cos * l1[1]);
  const round = (n: number, d = 4) => Math.round(n * 10 ** d) / 10 ** d;
  return { x: round(cx / W), y: round(cy / H), scale: round(scale, 3), rotation: round((angle * 180) / Math.PI, 2), mirrored: false };
}

/** Natural size of an image, `null` until it loads */
export function useImageSize(url: string | null | undefined): { width: number; height: number } | null {
  const [size, setSize] = React.useState<{ url: string; width: number; height: number } | null>(null);
  React.useEffect(() => {
    if (!url) return;
    let active = true;
    const img = new Image();
    img.onload = () => { if (active) setSize({ url, width: img.naturalWidth, height: img.naturalHeight }); };
    img.src = url;
    return () => { active = false; };
  }, [url]);
  return size && size.url === url ? size : null;
}

/** A session's photo of a view: the newest one, an "after" over a "before" in older sessions */
export function sessionPhotoOf(session: Pick<AestheticSession, 'photos'>, view: AestheticMapView): AestheticPhoto | null {
  const ofView = session.photos.filter((p) => p.view === view);
  if (!ofView.length) return null;
  const rank = (p: AestheticPhoto) => (p.kind === 'after' ? 1 : 0);
  return [...ofView].sort((a, b) => rank(b) - rank(a) || b.createdAt.localeCompare(a.createdAt))[0];
}
