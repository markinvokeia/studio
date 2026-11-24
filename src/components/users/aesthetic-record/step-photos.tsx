'use client';

import React from 'react';
import { Camera, Crosshair, Lock, MapPin, Trash2, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

import { usePanelWidth } from '@/hooks/use-panel-width';
import { useToast } from '@/hooks/use-toast';
import { cn, formatDisplayDate } from '@/lib/utils';
import { deleteAestheticPhoto, saveAestheticPhotoAlignment, uploadAestheticPhoto } from '@/services/aesthetic-record';

import type { AestheticPhoto, AestheticPhotoAlignment, AestheticPhotoSource, AestheticSession } from '@/lib/types';
import { useAestheticErrorMessage } from './aesthetic-errors';
import { AlignedPhoto } from './aligned-photo';
import { CameraCaptureDialog, FramingGuide, type CapturedPhoto } from './camera-capture-dialog';
import { placeMarks } from './layers';
import { PhotoAlignDialog } from './photo-align-dialog';
import { GUIDE_ALIGNMENT, PHOTO_VIEWS, prepareUpload, sessionPhotoOf, type PhotoView } from './photo-utils';
import { useSessionFlow } from './session-flow-context';
import { daysBetween, isOpenStatus } from './session-status';
import { Hint } from './hint';
import { useAestheticFileUrl } from './use-aesthetic-file-url';

type CompareMode = 'slider' | 'side' | 'overlay';
const COMPARE_MODES: CompareMode[] = ['slider', 'side', 'overlay'];

/** Panel width from which views, photo and sessions sit side by side and the step stops scrolling */
const WIDE_WIDTH = 860;
/** Panel width under which it is a phone: the photo takes the whole width and the views fit in a row */
const COMPACT_WIDTH = 640;
/** Area that sizes the photo: `cq` units let the box fit both its width and its height */
const STAGE = 'flex items-center justify-center gap-2.5 [container-type:size]';
const PHOTO_BOX = 'relative aspect-[300/380] overflow-hidden rounded-2xl bg-muted';
const PHOTO_WIDTH = 'w-[min(100cqw,calc(100cqh*300/380))]';
const HALF_PHOTO_WIDTH = 'w-[min(calc(50cqw-5px),calc(100cqh*300/380))]';

interface HistoryPhoto {
  session: AestheticSession;
  /** 1 for the patient's first session */
  number: number;
  photo: AestheticPhoto;
}

export function StepPhotos() {
  const t = useTranslations('AestheticRecord');
  const { toast } = useToast();
  const flow = useSessionFlow();
  const { stored, draft, previousSessions, readOnly, goToStep, updateSession, ensureSaved, reportError } = flow;
  const describeError = useAestheticErrorMessage();
  const [view, setView] = React.useState<PhotoView>('front');
  const [cameraOpen, setCameraOpen] = React.useState(false);
  const [uploading, setUploading] = React.useState<Partial<Record<PhotoView, number>>>({});
  const [dragOver, setDragOver] = React.useState(false);
  const [aligning, setAligning] = React.useState<{ photo: AestheticPhoto; sessionId: string } | null>(null);
  const [removing, setRemoving] = React.useState<AestheticPhoto | null>(null);
  const [baseBySession, setBaseBySession] = React.useState<Partial<Record<PhotoView, string>>>({});
  const [mode, setMode] = React.useState<CompareMode>('slider');
  const [showMarks, setShowMarks] = React.useState<{ base: boolean; today: boolean }>({ base: false, today: false });
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const width = usePanelWidth(rootRef);
  const wide = width === 0 || width >= WIDE_WIDTH;
  const compact = width > 0 && width < COMPACT_WIDTH;
  const stageClass = cn(STAGE, wide ? 'min-h-0 flex-1' : compact ? 'aspect-[300/380] w-full shrink-0' : 'h-[60vh] shrink-0');
  // Side by side on a phone, two half-width photos: no more height than they need
  const sideStageClass = compact ? cn(STAGE, 'aspect-[610/380] w-full shrink-0') : stageClass;

  const photosAllowed = stored?.photoConsent?.allowsClinicalPhotos === true;
  const photosDeclined = stored?.photoConsent?.allowsClinicalPhotos === false;
  const todayPhotos = stored?.photos ?? [];
  const todayOf = (v: PhotoView) => sessionPhotoOf({ photos: todayPhotos }, v);
  const historyOf = React.useCallback((v: PhotoView): HistoryPhoto[] => previousSessions
    .map((session, i) => ({ session, number: i + 1, photo: sessionPhotoOf(session, v) }))
    .filter((h): h is HistoryPhoto => !!h.photo), [previousSessions]);
  const history = historyOf(view);
  const today = todayOf(view);
  const base = history.find((h) => h.session.id === baseBySession[view]) ?? history[history.length - 1] ?? null;
  const viewLabel = (v: PhotoView) => t(`views.${v}`);
  const sessionLabel = (h: HistoryPhoto) => (h.number === 1 ? t('flow.photos.initial') : t('flow.photos.sessionN', { number: h.number }));

  async function upload(files: File[], target: PhotoView, source: AestheticPhotoSource, framed: boolean) {
    const images = files.filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name));
    if (!images.length) {
      toast({ variant: 'destructive', title: t('flow.photos.notAnImage') });
      return;
    }
    setUploading((u) => ({ ...u, [target]: (u[target] ?? 0) + images.length }));
    try {
      const sessionId = await ensureSaved();
      for (const original of images) {
        const file = framed ? original : await prepareUpload(original);
        const photo = await uploadAestheticPhoto(sessionId, { file, view: target, source, alignment: framed ? GUIDE_ALIGNMENT : undefined });
        updateSession(sessionId, (s) => ({ ...s, photos: [...s.photos, photo] }));
        setUploading((u) => ({ ...u, [target]: Math.max(0, (u[target] ?? 1) - 1) }));
      }
      toast({ title: t('flow.photos.saved', { view: viewLabel(target) }) });
    } catch (error) {
      toast({ variant: 'destructive', title: t('flow.photos.uploadError'), description: reportError(error) });
    } finally {
      setUploading((u) => ({ ...u, [target]: 0 }));
    }
  }

  async function saveAlignment(alignment: AestheticPhotoAlignment | null) {
    if (!aligning) return;
    const owner = flow.sessions.find((s) => s.id === aligning.sessionId);
    if (!owner) return;
    try {
      await saveAestheticPhotoAlignment(owner, aligning.photo.id, alignment);
      updateSession(owner.id, (s) => ({ ...s, photos: s.photos.map((p) => (p.id === aligning.photo.id ? { ...p, alignment: alignment ?? undefined } : p)) }));
      toast({ title: t('toast.alignmentSaved') });
    } catch (error) {
      // The photo may belong to an earlier session: only this session's own errors lock the sheet
      toast({ variant: 'destructive', title: t('map.backdrop.saveError'), description: owner.id === stored?.id ? reportError(error) : describeError(error) });
      throw error;
    }
  }

  async function confirmRemove() {
    const photo = removing;
    if (!photo || !stored) return;
    setRemoving(null);
    try {
      await deleteAestheticPhoto(photo.id);
      updateSession(stored.id, (s) => ({ ...s, photos: s.photos.filter((p) => p.id !== photo.id) }));
    } catch (error) {
      toast({ variant: 'destructive', title: t('flow.photos.removeError'), description: reportError(error) });
    }
  }

  const busy = (uploading[view] ?? 0) > 0;
  const canCapture = !readOnly && photosAllowed;

  const captureActions = (
    <div className="flex flex-wrap items-center gap-2">
      <Hint label={t('flow.photos.take')} description={t('flow.hints.photos.take')}>
        <Button data-help-id="aesthetic-session.btn.photo-take" type="button" onClick={() => setCameraOpen(true)} disabled={!canCapture || busy}>
          <Camera className="mr-1.5 h-4 w-4" />{t('flow.photos.take')}
        </Button>
      </Hint>
      <Hint label={t('flow.photos.upload')} description={t('flow.hints.photos.upload')}>
        <Button data-help-id="aesthetic-session.btn.photo-upload" type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={!canCapture || busy} loading={busy}>
          <Upload className="mr-1.5 h-4 w-4" />{t('flow.photos.upload')}
        </Button>
      </Hint>
    </div>
  );

  let body: React.ReactNode;
  if (!photosAllowed && !todayPhotos.length) {
    body = (
      <div className="flex flex-wrap items-center gap-5 rounded-2xl border-2 border-dashed bg-card p-5">
        <div className="relative aspect-[300/380] w-40 shrink-0 overflow-hidden rounded-xl bg-muted"><FramingGuide view={view} /></div>
        <div className="flex min-w-[220px] flex-1 flex-col gap-2">
          <h3 className="flex items-center gap-2 text-[15px] font-semibold"><Lock className="h-4 w-4" />{photosDeclined ? t('flow.photos.declinedTitle') : t('flow.photos.blockedTitle')}</h3>
          <p className="text-sm text-muted-foreground">{photosDeclined ? t('flow.photos.declinedHint') : t('flow.photos.blockedHint')}</p>
          {!readOnly && !photosDeclined && <div><Button type="button" onClick={() => goToStep(1)}>{t('flow.photos.goToConsent')}</Button></div>}
        </div>
      </div>
    );
  } else if (!today) {
    const ghost = history[history.length - 1]?.photo ?? null;
    body = (
      <>
        <div
          className={cn('flex flex-wrap items-center gap-5 rounded-2xl border-2 border-dashed bg-card p-5', dragOver && 'border-violet-500 bg-violet-500/5')}
          onDragOver={(e) => { if (!canCapture) return; e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (canCapture) upload(Array.from(e.dataTransfer.files), view, 'upload', false);
          }}
        >
          <div className="relative aspect-[300/380] w-44 shrink-0 overflow-hidden rounded-xl bg-muted">
            {ghost && <div className="absolute inset-0 opacity-35"><AlignedPhoto photoId={ghost.id} view={view} alignment={ghost.alignment} alt="" /></div>}
            <FramingGuide view={view} />
          </div>
          <div className="flex min-w-[220px] flex-1 flex-col gap-2.5">
            <h3 className="text-[15px] font-semibold">{t('flow.photos.todayOf', { view: viewLabel(view) })}</h3>
            <p className="text-sm text-muted-foreground">
              {ghost ? t('flow.photos.ghostHint', { date: formatDisplayDate(history[history.length - 1].session.date) }) : t('flow.photos.firstSessionHint')}
            </p>
            {readOnly ? <p className="text-sm text-muted-foreground">{t('flow.photos.noneToday')}</p> : captureActions}
            {!readOnly && <span className="text-xs text-muted-foreground">{t('flow.photos.dropHint')}</span>}
          </div>
        </div>
      </>
    );
  } else if (!history.length) {
    body = (
      <>
        <div className={stageClass}>
          <div className={cn(PHOTO_BOX, PHOTO_WIDTH)}>
            <AlignedPhoto photoId={today.id} view={view} alignment={today.alignment} alt={t('flow.photos.todayAlt', { view: viewLabel(view) })} />
            <span className="absolute bottom-3 left-3 rounded-full bg-black/70 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">{t('flow.photos.todayLabel', { date: formatDisplayDate(draft.date) })}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[11px] font-semibold text-violet-700 dark:text-violet-300">{t('flow.photos.noHistory')}</span>
          <span className="text-xs text-muted-foreground">{t('flow.photos.noHistoryHint')}</span>
          <span className="flex-1" />
          <TodayPhotoActions photo={today} readOnly={readOnly} canCapture={canCapture} onRetake={() => setCameraOpen(true)} onAlign={() => stored && setAligning({ photo: today, sessionId: stored.id })} onRemove={() => setRemoving(today)} />
        </div>
      </>
    );
  } else {
    const baseLabel = base ? t('flow.photos.baseLabel', { label: sessionLabel(base), date: formatDisplayDate(base.session.date), days: daysBetween(base.session.date, draft.date) }) : '';
    const todayLabel = t('flow.photos.todayLabel', { date: formatDisplayDate(draft.date) });
    const baseMarks = showMarks.base && base ? placeMarks(base.session.layers) : undefined;
    const todayMarks = showMarks.today ? placeMarks(draft.layers) : undefined;
    body = (
      <>
        <div className="flex shrink-0 flex-wrap items-center gap-2 max-sm:order-1 max-sm:[&>span:has(button)]:flex-1 max-sm:[&>span:last-child]:flex-none max-sm:[&>span:not(:last-child)>button]:w-full">
          <div data-help-id="aesthetic-session.section.compare-modes" role="group" aria-label={t('photos.compareModeLabel')} className="inline-flex gap-0.5 rounded-xl border bg-muted/50 p-0.5">
            {COMPARE_MODES.map((m) => (
              <Hint key={m} label={t(`flow.photos.modes.${m}`)} description={t(`flow.hints.photos.modes.${m}`)}>
                <button type="button" onClick={() => setMode(m)} aria-pressed={mode === m} className={cn('h-8 rounded-lg px-3 text-xs font-medium', mode === m ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground')}>
                  {t(`flow.photos.modes.${m}`)}
                </button>
              </Hint>
            ))}
          </div>
          <span className="flex-1 max-sm:hidden" />
          <Hint label={t('flow.photos.compareInitial')} description={base?.number === 1 ? t('flow.hints.photos.alreadyInitial') : t('flow.hints.photos.compareInitial', { date: formatDisplayDate(history[0].session.date) })}>
            <Button data-help-id="aesthetic-session.btn.compare-initial" type="button" size="sm" variant="outline" disabled={base?.number === 1} onClick={() => setBaseBySession((b) => ({ ...b, [view]: history[0].session.id }))}>
              {t('flow.photos.compareInitial')}
            </Button>
          </Hint>
          <TodayPhotoActions photo={today} readOnly={readOnly} canCapture={canCapture} onRetake={() => setCameraOpen(true)} onAlign={() => stored && setAligning({ photo: today, sessionId: stored.id })} onRemove={() => setRemoving(today)} />
        </div>
        {base && <Comparison stageClass={stageClass} sideStageClass={sideStageClass} mode={mode} base={base.photo} today={today} view={view} baseLabel={baseLabel} todayLabel={todayLabel} baseMarks={baseMarks} todayMarks={todayMarks} />}
        <div className="flex shrink-0 flex-wrap items-center gap-4 text-xs text-muted-foreground max-sm:order-2">
          <Hint label={t('flow.photos.marksOf', { label: base ? sessionLabel(base) : '' })} description={t('flow.hints.photos.marksBase')}>
            <label className="flex items-center gap-2"><Switch checked={showMarks.base} onCheckedChange={(v) => setShowMarks((m) => ({ ...m, base: v }))} /><MapPin className="h-3.5 w-3.5" />{t('flow.photos.marksOf', { label: base ? sessionLabel(base) : '' })}</label>
          </Hint>
          <Hint label={t('flow.photos.marksToday')} description={t('flow.hints.photos.marksToday')}>
            <label className="flex items-center gap-2"><Switch checked={showMarks.today} onCheckedChange={(v) => setShowMarks((m) => ({ ...m, today: v }))} /><MapPin className="h-3.5 w-3.5" />{t('flow.photos.marksToday')}</label>
          </Hint>
          {/* The earlier session is usually closed, and a closed session doesn't change */}
          {base && !readOnly && isOpenStatus(base.session.status) && (
            <span className="ml-auto">
              <Hint label={t('flow.photos.alignBase', { label: sessionLabel(base) })} description={t('flow.hints.align')}>
                <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAligning({ photo: base.photo, sessionId: base.session.id })}>
                  <Crosshair className="mr-1 h-3.5 w-3.5" />{t('flow.photos.alignBase', { label: sessionLabel(base) })}
                </Button>
              </Hint>
            </span>
          )}
        </div>
      </>
    );
  }

  const showHistory = history.length > 0 && (photosAllowed || todayPhotos.length > 0);

  return (
    <div ref={rootRef} className="flex min-h-0 flex-1 flex-col">
      <div className={cn('flex min-h-0 flex-1 flex-col gap-3 p-3.5', !wide && 'overflow-y-auto')}>
        <h2 className="shrink-0 text-base font-semibold leading-tight">{previousSessions.length ? t('flow.photos.titleHistory') : t('flow.photos.title')}</h2>
        <div className={cn('flex gap-3.5', wide ? 'min-h-0 flex-1' : 'flex-col')}>
          <div data-help-id="aesthetic-session.section.photo-views" role="tablist" aria-label={t('photos.view')} className={cn('shrink-0 gap-2', wide ? 'flex w-56 flex-col gap-2.5 overflow-y-auto' : compact ? 'grid w-full grid-cols-3' : 'flex w-full gap-2.5 overflow-x-auto')}>
            {PHOTO_VIEWS.map((v) => (
              <ViewSlot
                key={v}
                view={v}
                label={viewLabel(v)}
                photo={todayOf(v)}
                uploading={(uploading[v] ?? 0) > 0}
                previousCount={historyOf(v).length}
                selected={view === v}
                wide={wide}
                tile={compact}
                onSelect={() => setView(v)}
              />
            ))}
            {wide && <p className="px-0.5 text-xs text-muted-foreground">{t('flow.photos.anyViewHint')}</p>}
          </div>
          <div data-help-id="aesthetic-session.section.photo-stage" className={cn('flex min-w-0 flex-1 flex-col gap-2.5', wide && 'min-h-0')}>{body}</div>
          {showHistory && (
            <div data-help-id="aesthetic-session.section.photo-history" className={cn('flex shrink-0 flex-col gap-2', wide ? 'min-h-0 w-[10.5rem]' : 'w-full')}>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {today ? t('flow.photos.compareWith') : wide ? t('flow.photos.previousShort') : t('flow.photos.previousOf', { view: viewLabel(view) })}
              </p>
              <Timeline
                items={history}
                today={today}
                selectedId={today ? base?.session.id ?? null : null}
                label={sessionLabel}
                todayDate={draft.date}
                vertical={wide}
                onSelect={today ? (id) => setBaseBySession((b) => ({ ...b, [view]: id })) : undefined}
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t bg-card px-3.5 py-2.5">
        <Button type="button" variant="outline" onClick={() => goToStep(1)}>{t('flow.back')}</Button>
        <Button data-help-id="aesthetic-session.btn.to-treatment" type="button" className={cn(compact && 'flex-1')} onClick={() => goToStep(3)} disabled={!readOnly && !flow.facts.consents.length}>{t('flow.photos.continue')}</Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (files.length) upload(files, view, 'upload', false);
        }}
      />
      <CameraCaptureDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        view={view}
        viewLabel={viewLabel(view)}
        ghost={history[history.length - 1]?.photo ?? null}
        onCapture={({ file, framed }: CapturedPhoto) => upload([file], view, 'camera', framed)}
      />
      {aligning && !readOnly && (
        <PhotoAlignDialog
          open
          onOpenChange={(open) => { if (!open) setAligning(null); }}
          photoId={aligning.photo.id}
          view={aligning.photo.view as PhotoView}
          onSave={saveAlignment}
        />
      )}
      <AlertDialog open={!!removing} onOpenChange={(open) => { if (!open) setRemoving(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('flow.photos.removeTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('flow.photos.removeDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={confirmRemove}>{t('flow.photos.remove')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TodayPhotoActions({ photo, readOnly, canCapture, onRetake, onAlign, onRemove }: {
  photo: AestheticPhoto;
  readOnly: boolean;
  canCapture: boolean;
  onRetake: () => void;
  onAlign: () => void;
  onRemove: () => void;
}) {
  const t = useTranslations('AestheticRecord');
  if (readOnly) return null;
  return (
    <>
      <Hint label={t('flow.photos.align')} description={`${photo.alignment ? t('flow.photos.aligned') : t('flow.photos.notAligned')}. ${t('flow.hints.align')}`}>
        <Button data-help-id="aesthetic-session.btn.photo-align" type="button" size="sm" variant="outline" onClick={onAlign}>
          <Crosshair className="mr-1 h-3.5 w-3.5" />{t('flow.photos.align')}
        </Button>
      </Hint>
      <Hint label={t('flow.photos.retake')} description={t('flow.hints.photos.retake')}>
        <Button type="button" size="sm" variant="outline" onClick={onRetake} disabled={!canCapture}>
          <Camera className="mr-1 h-3.5 w-3.5" />{t('flow.photos.retake')}
        </Button>
      </Hint>
      <Hint label={t('flow.photos.remove')} description={t('flow.hints.photos.remove')} side="left">
        <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={onRemove} aria-label={t('flow.photos.remove')}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </Hint>
    </>
  );
}

function ViewSlot({ view, label, photo, uploading, previousCount, selected, wide, tile, onSelect }: {
  view: PhotoView;
  label: string;
  photo: AestheticPhoto | null;
  uploading: boolean;
  previousCount: number;
  selected: boolean;
  wide: boolean;
  /** One of three in a row: the photo on top and the text below it */
  tile: boolean;
  onSelect: () => void;
}) {
  const t = useTranslations('AestheticRecord');
  const url = useAestheticFileUrl(photo?.id);
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      className={cn(
        'flex rounded-xl border-[1.5px] bg-card transition-colors',
        tile ? 'min-w-0 flex-col gap-1 p-1.5 text-center' : 'shrink-0 items-center gap-3 p-2.5 text-left',
        !wide && !tile && 'min-w-[220px]',
        selected ? 'border-violet-600 shadow-[0_0_0_3px_rgb(124_58_237/0.15)]' : 'hover:border-foreground/25',
      )}
    >
      <span className={cn('relative grid shrink-0 place-items-center overflow-hidden rounded-lg bg-muted text-muted-foreground', tile ? 'h-16 w-full' : 'h-[74px] w-[58px]')}>
        {/* eslint-disable-next-line @next/next/no-img-element -- stored photo (object URL) */}
        {photo && url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <Camera className="h-5 w-5" />}
        {uploading && <span className="absolute inset-0 grid place-items-center bg-black/40 text-[10px] font-medium text-white">{t('flow.photos.uploading')}</span>}
      </span>
      <span className="min-w-0">
        <b className={cn('block font-semibold', tile ? 'text-xs leading-tight' : 'text-sm')}>{label}</b>
        <span className={cn('text-muted-foreground', tile ? 'block text-[11px] leading-tight' : 'text-xs')}>
          {photo ? t('flow.photos.takenToday') : t('flow.photos.pending')}
          {previousCount > 0 && ` · ${t('flow.photos.previousCount', { count: previousCount })}`}
        </span>
      </span>
      <span className="sr-only">{view}</span>
    </button>
  );
}

function Timeline({ items, today, selectedId, label, todayDate, vertical, onSelect }: {
  items: HistoryPhoto[];
  today: AestheticPhoto | null;
  selectedId: string | null;
  label: (h: HistoryPhoto) => string;
  todayDate: string;
  vertical?: boolean;
  onSelect?: (sessionId: string) => void;
}) {
  const t = useTranslations('AestheticRecord');
  return (
    <div className={cn('flex gap-2.5', vertical ? 'min-h-0 flex-1 flex-col overflow-y-auto' : 'overflow-x-auto pb-1')}>
      {items.map((h) => (
        <button
          key={h.session.id}
          type="button"
          onClick={() => onSelect?.(h.session.id)}
          disabled={!onSelect}
          aria-pressed={selectedId === h.session.id}
          className={cn(
            'flex shrink-0 flex-col gap-1 rounded-xl border-[1.5px] bg-card p-1.5 text-left disabled:cursor-default',
            vertical ? 'w-full' : 'w-24',
            selectedId === h.session.id ? 'border-violet-600 shadow-[0_0_0_3px_rgb(124_58_237/0.15)]' : 'hover:border-foreground/25',
          )}
        >
          <span className="relative block aspect-[4/5] overflow-hidden rounded-lg bg-muted">
            <AlignedPhoto photoId={h.photo.id} view={h.photo.view} alignment={h.photo.alignment} alt={label(h)} />
          </span>
          <b className="text-xs font-semibold">{label(h)}</b>
          <span className="text-[11px] text-muted-foreground">{formatDisplayDate(h.session.date)}</span>
          <span className="text-[11px] text-muted-foreground">{t('flow.photos.daysAgo', { days: daysBetween(h.session.date, todayDate) })}</span>
        </button>
      ))}
      {today && (
        <div className={cn('flex shrink-0 flex-col gap-1 rounded-xl border-[1.5px] border-violet-600 bg-card p-1.5', vertical ? 'w-full' : 'w-24')}>
          <span className="relative block aspect-[4/5] overflow-hidden rounded-lg bg-muted">
            <AlignedPhoto photoId={today.id} view={today.view} alignment={today.alignment} alt={t('flow.photos.today')} />
          </span>
          <b className="text-xs font-semibold">{t('flow.photos.today')}</b>
          <span className="text-[11px] text-muted-foreground">{formatDisplayDate(todayDate)}</span>
        </div>
      )}
    </div>
  );
}

/** Today against an earlier session: a curtain, side by side, or one over the other */
function Comparison({ stageClass, sideStageClass, mode, base, today, view, baseLabel, todayLabel, baseMarks, todayMarks }: {
  stageClass: string;
  sideStageClass: string;
  mode: CompareMode;
  base: AestheticPhoto;
  today: AestheticPhoto;
  view: PhotoView;
  baseLabel: string;
  todayLabel: string;
  baseMarks?: ReturnType<typeof placeMarks>;
  todayMarks?: ReturnType<typeof placeMarks>;
}) {
  const t = useTranslations('AestheticRecord');
  const [position, setPosition] = React.useState(50);
  const [opacity, setOpacity] = React.useState(50);
  const boxRef = React.useRef<HTMLDivElement>(null);
  const draggingRef = React.useRef(false);
  const tag = 'absolute bottom-3 max-w-[calc(100%-1.25rem)] truncate rounded-full bg-black/70 px-2.5 py-1 text-xs font-medium text-white backdrop-blur';

  const move = (clientX: number) => {
    const rect = boxRef.current?.getBoundingClientRect();
    if (rect?.width) setPosition(Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)));
  };

  if (mode === 'side') {
    return (
      <div className={sideStageClass}>
        {[[base, baseLabel, baseMarks], [today, todayLabel, todayMarks]].map(([photo, label, marks]) => (
          <div key={(photo as AestheticPhoto).id} className={cn(PHOTO_BOX, HALF_PHOTO_WIDTH)}>
            <AlignedPhoto photoId={(photo as AestheticPhoto).id} view={view} alignment={(photo as AestheticPhoto).alignment} marks={marks as typeof baseMarks} alt={label as string} />
            <span className={cn(tag, 'left-2.5')}>{label as string}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className={stageClass}>
      <div
        ref={boxRef}
        className={cn(PHOTO_BOX, PHOTO_WIDTH, 'touch-pan-y select-none')}
        onPointerDown={(e) => {
          if (mode !== 'slider') return;
          e.currentTarget.setPointerCapture(e.pointerId);
          draggingRef.current = true;
          move(e.clientX);
        }}
        onPointerMove={(e) => { if (draggingRef.current) move(e.clientX); }}
        onPointerUp={() => { draggingRef.current = false; }}
        onPointerCancel={() => { draggingRef.current = false; }}
      >
        <div className="absolute inset-0"><AlignedPhoto photoId={base.id} view={view} alignment={base.alignment} marks={baseMarks} alt={baseLabel} /></div>
        <div className="absolute inset-0" style={mode === 'slider' ? { clipPath: `inset(0 0 0 ${position}%)` } : undefined}>
          <AlignedPhoto photoId={today.id} view={view} alignment={today.alignment} marks={todayMarks} alt={todayLabel} opacity={mode === 'overlay' ? opacity / 100 : 1} />
        </div>
        {mode === 'slider' && (
          <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,.15)]" style={{ left: `${position}%` }}>
            <span className="absolute left-1/2 top-1/2 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-sm text-slate-700 shadow">⇆</span>
          </div>
        )}
        {mode === 'slider' ? (
          <>
            <span className={cn(tag, 'left-3 max-sm:bottom-11')}>{baseLabel}</span>
            <span className={cn(tag, 'right-3')}>{todayLabel}</span>
          </>
        ) : (
          <span className={cn(tag, 'left-3')}>{baseLabel} + {todayLabel}</span>
        )}
        {mode === 'slider' && (
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(position)}
            onChange={(e) => setPosition(Number(e.target.value))}
            aria-label={t('photos.compareSlider')}
            className="sr-only"
          />
        )}
      </div>
      </div>
      {mode === 'overlay' && (
        <label className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
          {t('flow.photos.todayOpacity')}
          <input type="range" min={0} max={100} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} className="flex-1 accent-violet-600" />
        </label>
      )}
    </>
  );
}
