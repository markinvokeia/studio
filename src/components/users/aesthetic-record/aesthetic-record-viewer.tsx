'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Camera, ChevronLeft, ChevronRight, FileSignature, History, Pencil, PersonStanding, Plus, ScanFace, Sparkles } from 'lucide-react';

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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DoctorSelector } from '@/components/ui/doctor-selector';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';

import { AESTHETIC_RECORD_PERMISSIONS } from '@/constants/permissions';
import { useAsyncAction } from '@/hooks/use-async-action';
import { usePanelWidth } from '@/hooks/use-panel-width';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/error-utils';
import { cn, formatDate, formatDisplayDate } from '@/lib/utils';
import { fetchAestheticSessions, newAestheticPointId, upsertAestheticSession } from '@/services/aesthetic-record';

import type { AestheticBodyFigure, AestheticMapRegion, AestheticMapView, AestheticPhotoKind, AestheticPoint, AestheticSession, AestheticZoneId } from '@/lib/types';
import { ConsentDialog } from './consent-dialog';
import { ConsentPanel } from './consent-panel';
import { AestheticMap } from './aesthetic-map';
import { BODY_FIGURES, getViewZoneIds, MAP_REGIONS, MAP_VIEWS, REGION_VIEWS, UNIT_COLORS, VIEW_REGION } from './map-templates';
import type { PhotoRef } from './photo-compare';
import { PhotosPanel, type PendingPhoto } from './photos-panel';
import { PointDetailCard } from './point-detail-card';
import { isPointIncomplete, PointsSummary } from './points-summary';
import { ZoneHistory } from './zone-history';

type Tab = 'map' | 'photos' | 'consent' | 'zones';

/** Width from which the map and its side panel sit side by side */
const SIDE_BY_SIDE_MIN_WIDTH = 760;

interface Draft {
  sessionId?: string;
  date: string;
  title: string;
  doctorId?: string;
  doctorName?: string;
  appointmentId?: string;
  notes: string;
  points: AestheticPoint[];
  bodyFigure: AestheticBodyFigure;
}

/** Fields a new point copies from the last edited one, so a row of points is quick to mark */
type PointPreset = Pick<AestheticPoint, 'serviceId' | 'productName' | 'quantity' | 'unit' | 'lot' | 'lotExpiry' | 'depth' | 'technique'>;

const DEFAULT_PRESET: PointPreset = { productName: '', quantity: null, unit: 'U' };

const draftKey = (draft: Draft) => JSON.stringify(draft);

function Segmented<T extends string>({ value, options, onChange, ariaLabel, disabled, title }: {
  value: T;
  options: { id: T; label: string; icon?: React.ElementType }[];
  onChange: (value: T) => void;
  ariaLabel: string;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} title={title} className="inline-flex max-w-full overflow-x-auto rounded-lg border bg-muted/30 p-0.5 [scrollbar-width:none]">
      {options.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={value === id}
          disabled={disabled && value !== id}
          onClick={() => onChange(id)}
          className={cn(
            'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
            value === id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {Icon && <Icon className="h-3.5 w-3.5" />}
          {label}
        </button>
      ))}
    </div>
  );
}

export interface AestheticRecordViewerProps {
  patientId: string;
  patientName?: string;
  /** Doctor of the context (e.g. the appointment's); preselected on new sessions */
  doctorId?: string;
  doctorName?: string;
  /** Appointment a new session is linked to */
  appointmentId?: string;
  /** Patient's sex, used to pick the body figure of their first session */
  patientSex?: AestheticBodyFigure | null;
  readOnly?: boolean;
}

export function AestheticRecordViewer({ patientId, patientName, doctorId, doctorName, appointmentId, patientSex, readOnly = false }: AestheticRecordViewerProps) {
  const t = useTranslations('AestheticRecord');
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const canRegister = !readOnly && hasPermission(AESTHETIC_RECORD_PERMISSIONS.REGISTER_SESSION);

  // The root element changes between the loading and loaded renders, so the width is
  // measured on whichever one is mounted (a plain ref would keep observing the skeleton)
  const [rootEl, setRootEl] = React.useState<HTMLDivElement | null>(null);
  const rootRef = React.useMemo(() => ({ current: rootEl }), [rootEl]);
  const sideBySide = usePanelWidth(rootRef) >= SIDE_BY_SIDE_MIN_WIDTH;

  const [sessions, setSessions] = React.useState<AestheticSession[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [index, setIndex] = React.useState(-1);
  const [tab, setTab] = React.useState<Tab>('map');
  const [view, setView] = React.useState<AestheticMapView>('front');
  const region = VIEW_REGION[view];
  // Switching region returns to the view last used in it
  const lastViewByRegionRef = React.useRef<Record<AestheticMapRegion, AestheticMapView>>({ face: 'front', body: 'bodyFront' });
  React.useEffect(() => { lastViewByRegionRef.current[region] = view; }, [region, view]);
  const [pinnedZone, setPinnedZone] = React.useState<AestheticZoneId | null>(null);
  const [selectedPointId, setSelectedPointId] = React.useState<string | null>(null);
  const [hoveredZone, setHoveredZone] = React.useState<AestheticZoneId | null>(null);

  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [initialDraftKey, setInitialDraftKey] = React.useState('');
  const [pendingPhotos, setPendingPhotos] = React.useState<PendingPhoto[]>([]);
  const [removedPhotoIds, setRemovedPhotoIds] = React.useState<string[]>([]);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  /** A save was blocked by missing fields: mark them in red until editing ends */
  const [showValidation, setShowValidation] = React.useState(false);
  const [confirmDiscard, setConfirmDiscard] = React.useState<null | (() => void)>(null);
  const [consentOpen, setConsentOpen] = React.useState(false);
  const presetRef = React.useRef<PointPreset>(DEFAULT_PRESET);

  const isEditing = draft !== null;
  const current = index >= 0 ? sessions[index] ?? null : null;
  const isDirty = isEditing && (draftKey(draft) !== initialDraftKey || pendingPhotos.length > 0 || removedPhotoIds.length > 0);

  const load = React.useCallback(async (selectId?: string) => {
    setLoadError(null);
    try {
      const list = await fetchAestheticSessions(patientId);
      setSessions(list);
      const selected = selectId ? list.findIndex((s) => s.id === selectId) : -1;
      setIndex(selected >= 0 ? selected : list.length - 1);
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [patientId]);

  React.useEffect(() => {
    setIsLoading(true);
    setDraft(null);
    load();
  }, [load]);

  // Object URLs of photo previews are released when they leave the draft
  const pendingRef = React.useRef(pendingPhotos);
  React.useEffect(() => { pendingRef.current = pendingPhotos; }, [pendingPhotos]);
  React.useEffect(() => () => pendingRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl)), []);

  // ── Derived ──
  const points = React.useMemo(() => draft?.points ?? current?.points ?? [], [draft, current]);
  // Body points are placed on a figure: it stays fixed once the session has any
  const defaultFigure: AestheticBodyFigure = [...sessions].reverse().find((s) => s.bodyFigure)?.bodyFigure ?? patientSex ?? 'female';
  const figure = draft?.bodyFigure ?? current?.bodyFigure ?? defaultFigure;
  const canChangeFigure = isEditing && !points.some((p) => VIEW_REGION[p.view] === 'body');
  const pointNumbers = React.useMemo(() => new Map(points.map((p, i) => [p.id, i + 1])), [points]);
  const selectedPoint = points.find((p) => p.id === selectedPointId) ?? null;
  const allPhotos = React.useMemo<PhotoRef[]>(
    () => sessions.flatMap((session) => session.photos.map((photo) => ({ photo, session }))),
    [sessions],
  );
  const shownPhotos = (current && (!draft || draft.sessionId === current.id) ? current.photos : [])
    .filter((p) => !removedPhotoIds.includes(p.id));

  // ── Editing ──
  function beginEditing(next: Draft) {
    const key = draftKey(next);
    setDraft(next);
    setInitialDraftKey(key);
    setPendingPhotos([]);
    setRemovedPhotoIds([]);
    setSaveError(null);
    setShowValidation(false);
    setSelectedPointId(null);
    presetRef.current = next.points.length ? pickPreset(next.points[next.points.length - 1]) : DEFAULT_PRESET;
  }

  function startNewSession() {
    const today = formatDate(new Date());
    beginEditing({
      date: today,
      title: t('session.defaultTitle', { date: formatDisplayDate(today) }),
      doctorId,
      doctorName,
      appointmentId,
      notes: '',
      points: [],
      bodyFigure: defaultFigure,
    });
    setIndex(-1);
    setTab('map');
  }

  function startEditing(session: AestheticSession) {
    beginEditing({
      sessionId: session.id,
      date: session.date,
      title: session.title,
      doctorId: session.doctorId,
      doctorName: session.doctorName,
      appointmentId: session.appointmentId,
      notes: session.notes,
      points: session.points,
      bodyFigure: session.bodyFigure ?? defaultFigure,
    });
  }

  function endEditing() {
    pendingPhotos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setDraft(null);
    setPendingPhotos([]);
    setRemovedPhotoIds([]);
    setSaveError(null);
    setShowValidation(false);
    setSelectedPointId(null);
  }

  /** Runs `action` right away, or after confirming when there are unsaved changes */
  function guardUnsaved(action: () => void) {
    if (isDirty) setConfirmDiscard(() => action);
    else action();
  }

  function cancelEditing() {
    guardUnsaved(() => {
      endEditing();
      if (index < 0) setIndex(sessions.length - 1);
    });
  }

  const updateDraft = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  function updatePoint(id: string, patch: Partial<AestheticPoint>) {
    setDraft((d) => {
      if (!d) return d;
      const nextPoints = d.points.map((p) => (p.id === id ? { ...p, ...patch } : p));
      const edited = nextPoints.find((p) => p.id === id);
      if (edited) presetRef.current = pickPreset(edited);
      return { ...d, points: nextPoints };
    });
  }

  function addPoint(x: number, y: number, zone: AestheticZoneId | null) {
    const point: AestheticPoint = { id: newAestheticPointId(), view, x, y, zone, ...presetRef.current };
    setDraft((d) => (d ? { ...d, points: [...d.points, point] } : d));
    setSelectedPointId(point.id);
  }

  function deletePoint(id: string) {
    setDraft((d) => (d ? { ...d, points: d.points.filter((p) => p.id !== id) } : d));
    setSelectedPointId((s) => (s === id ? null : s));
  }

  function addPhotos(files: File[], kind: AestheticPhotoKind, photoView: AestheticMapView) {
    setPendingPhotos((prev) => [
      ...prev,
      ...files.map((file) => ({ key: newAestheticPointId(), file, kind, view: photoView, previewUrl: URL.createObjectURL(file) })),
    ]);
  }

  function removePendingPhoto(key: string) {
    setPendingPhotos((prev) => {
      const removed = prev.find((p) => p.key === key);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((p) => p.key !== key);
    });
  }

  const save = useAsyncAction(
    async () => {
      if (!draft) return null;
      return upsertAestheticSession(
        patientId,
        {
          date: draft.date,
          title: draft.title.trim() || t('session.defaultTitle', { date: formatDisplayDate(draft.date) }),
          doctorId: draft.doctorId,
          doctorName: draft.doctorName,
          appointmentId: draft.appointmentId,
          notes: draft.notes,
          points: draft.points,
          bodyFigure: draft.bodyFigure,
        },
        pendingPhotos.map(({ file, kind, view: photoView }) => ({ file, kind, view: photoView })),
        removedPhotoIds,
        draft.sessionId,
      );
    },
    {
      onSuccess: async (saved) => {
        if (!saved) return;
        toast({ title: draft?.sessionId ? t('toast.updated') : t('toast.created') });
        endEditing();
        await load(saved.id);
      },
      onError: (error) => setSaveError(getErrorMessage(error)),
      showErrorToast: false,
    },
  );

  function handleSave() {
    if (!draft) return;
    if (!draft.date) {
      setShowValidation(true);
      setSaveError(t('session.dateRequired'));
      document.getElementById('aes-session-date')?.focus();
      return;
    }
    const incomplete = draft.points.find(isPointIncomplete);
    if (incomplete) {
      setShowValidation(true);
      setSaveError(t('session.incompletePoints', { count: draft.points.filter(isPointIncomplete).length }));
      setTab('map');
      setView(incomplete.view);
      setSelectedPointId(incomplete.id);
      return;
    }
    setSaveError(null);
    save.run();
  }

  function selectFromList(point: AestheticPoint) {
    setView(point.view);
    setSelectedPointId(point.id);
  }

  function goTo(nextIndex: number) {
    setIndex(nextIndex);
    setSelectedPointId(null);
  }

  const defaultProcedure = React.useMemo(() => {
    const names = [...new Set((current?.points ?? []).map((p) => p.productName.trim()).filter(Boolean))];
    return names.join(', ');
  }, [current]);

  // ── Render ──
  if (isLoading) {
    return (
      <div ref={setRootEl} className="flex flex-col gap-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[420px] w-full max-w-md" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div ref={setRootEl} className="flex flex-col items-start gap-3">
        <Alert variant="destructive"><AlertDescription>{loadError}</AlertDescription></Alert>
        <Button variant="outline" size="sm" onClick={() => { setIsLoading(true); load(); }}>{t('retry')}</Button>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'map', label: t('tabs.map'), icon: ScanFace },
    { id: 'photos', label: t('tabs.photos'), icon: Camera },
    { id: 'consent', label: t('tabs.consent'), icon: FileSignature },
    { id: 'zones', label: t('tabs.zones'), icon: History },
  ];
  const regionIcons: Record<AestheticMapRegion, React.ElementType> = { face: ScanFace, body: PersonStanding };
  const regionOptions = MAP_REGIONS.map((r) => {
    const count = points.filter((p) => VIEW_REGION[p.view] === r).length;
    return { id: r, icon: regionIcons[r], label: count ? t('map.regionWithCount', { region: t(`regions.${r}`), count }) : t(`regions.${r}`) };
  });
  const viewOptions = REGION_VIEWS[region].map((v) => ({ id: v, label: t(`views.${v}`) }));
  const zoneHighlight = hoveredZone ?? pinnedZone;

  /** Shows a zone picked in the history: switches to the first view that draws it */
  function showZone(zone: AestheticZoneId | null) {
    setPinnedZone(zone);
    if (!zone || getViewZoneIds(view).includes(zone)) return;
    const target = MAP_VIEWS.find((v) => getViewZoneIds(v).includes(zone));
    if (target) setView(target);
  }

  const header = (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => goTo(Math.max(0, index - 1))} disabled={isEditing || index <= 0} aria-label={t('prevSession')} title={t('prevSession')}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="min-w-0 flex-1">
        {isEditing ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-foreground">{draft.sessionId ? draft.title : t('session.new')}</span>
            <Badge className="shrink-0">{t('editing')}</Badge>
          </div>
        ) : current ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="max-w-[260px] truncate text-sm font-semibold text-foreground">{current.title}</span>
            <Badge variant="outline" className="shrink-0 text-xs">{formatDisplayDate(current.date)}</Badge>
            {current.doctorName && <span className="truncate text-xs text-muted-foreground">{current.doctorName}</span>}
            {current.consent && <Badge variant="secondary" className="shrink-0 gap-1 text-xs"><FileSignature className="h-3 w-3" />{t('consent.badge')}</Badge>}
            <span className="text-xs text-muted-foreground">{t('sessionCounter', { current: index + 1, total: sessions.length })}</span>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">{t('noSessions')}</span>
        )}
      </div>
      <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => goTo(Math.min(sessions.length - 1, index + 1))} disabled={isEditing || index >= sessions.length - 1} aria-label={t('nextSession')} title={t('nextSession')}>
        <ChevronRight className="h-4 w-4" />
      </Button>
      {canRegister && !isEditing && (
        <>
          {current && (
            <Button size="sm" variant="outline" onClick={() => startEditing(current)}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              {t('editSession')}
            </Button>
          )}
          <Button size="sm" onClick={startNewSession}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {t('newSession')}
          </Button>
        </>
      )}
    </div>
  );

  const dateInvalid = showValidation && !draft?.date;
  const invalidPointIds = showValidation ? new Set(points.filter(isPointIncomplete).map((p) => p.id)) : undefined;

  const sessionFields = draft && (
    <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="aes-session-date" className={cn('text-xs', dateInvalid && 'text-destructive')}>{t('session.date')}</Label>
          <Input
            id="aes-session-date"
            type="date"
            value={draft.date}
            onChange={(e) => updateDraft({ date: e.target.value })}
            disabled={save.isPending}
            aria-invalid={dateInvalid || undefined}
            aria-describedby={dateInvalid ? 'aes-session-date-error' : undefined}
            className="h-9"
          />
          {dateInvalid && <p id="aes-session-date-error" className="text-xs font-medium text-destructive">{t('session.dateRequired')}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">{t('session.doctor')}</Label>
          <DoctorSelector
            value={draft.doctorId}
            selectedDoctorName={draft.doctorName}
            onValueChange={(id, doctor) => updateDraft({ doctorId: id || undefined, doctorName: doctor?.name })}
            triggerText={t('session.doctorPick')}
            placeholder={t('session.doctorSearch')}
            emptyText={t('session.doctorEmpty')}
            loadingText={t('session.doctorLoading')}
            disabled={save.isPending}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="aes-session-title" className="text-xs">{t('session.title')}</Label>
        <Input id="aes-session-title" value={draft.title} onChange={(e) => updateDraft({ title: e.target.value })} disabled={save.isPending} className="h-9" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="aes-session-notes" className="text-xs">{t('session.notes')}</Label>
        <Textarea id="aes-session-notes" value={draft.notes} onChange={(e) => updateDraft({ notes: e.target.value })} disabled={save.isPending} rows={3} placeholder={t('session.notesPlaceholder')} className="resize-none text-sm" />
      </div>
      {saveError && <Alert variant="destructive"><AlertDescription>{saveError}</AlertDescription></Alert>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={cancelEditing} disabled={save.isPending}>{t('cancel')}</Button>
        <Button type="button" onClick={handleSave} loading={save.isPending}>{t('save')}</Button>
      </div>
    </div>
  );

  const mapColumn = (
    <div className={cn('flex w-full flex-col gap-2', sideBySide && 'max-w-[420px] shrink-0')}>
      <Segmented
        value={region}
        options={regionOptions}
        onChange={(r) => setView(lastViewByRegionRef.current[r])}
        ariaLabel={t('map.regionsLabel')}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented value={view} options={viewOptions} onChange={setView} ariaLabel={t('map.viewsLabel')} />
          {region === 'body' && (
            <Segmented
              value={figure}
              options={BODY_FIGURES.map((f) => ({ id: f, label: t(`figures.${f}`) }))}
              onChange={(f) => updateDraft({ bodyFigure: f })}
              ariaLabel={t('map.figureLabel')}
              disabled={!canChangeFigure}
              title={isEditing && !canChangeFigure ? t('map.figureLocked') : undefined}
            />
          )}
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: UNIT_COLORS.U }} />{t('map.legendToxin')}</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: UNIT_COLORS.mL }} />{t('map.legendFiller')}</span>
        </div>
      </div>
      <AestheticMap
        view={view}
        figure={figure}
        points={tab === 'zones' ? [] : points}
        pointNumbers={pointNumbers}
        selectedPointId={selectedPointId}
        readOnly={!isEditing || tab === 'zones'}
        invalidPointIds={invalidPointIds}
        highlightZones={tab === 'zones' ? (zoneHighlight ? [zoneHighlight] : []) : selectedPoint?.zone ? [selectedPoint.zone] : []}
        onAddPoint={isEditing ? addPoint : undefined}
        onMovePoint={isEditing ? (id, x, y, zone) => updatePoint(id, { x, y, zone }) : undefined}
        onSelectPoint={setSelectedPointId}
        onDeletePoint={isEditing ? deletePoint : undefined}
        className={cn('mx-auto', region === 'body' ? 'max-w-[260px]' : 'max-w-[420px]')}
      />
      {isEditing && tab === 'map' && <p className="text-center text-[11px] text-muted-foreground">{t('map.hint')}</p>}
      {region === 'body' && <p className="text-center text-[10px] text-muted-foreground/70">{t('credits')}</p>}
    </div>
  );

  const mapSide = (
    <div className="flex min-w-0 flex-1 flex-col gap-3">
      {selectedPoint && (
        <PointDetailCard
          key={selectedPoint.id}
          point={selectedPoint}
          number={pointNumbers.get(selectedPoint.id)}
          readOnly={!isEditing}
          showErrors={showValidation}
          onChange={(patch) => updatePoint(selectedPoint.id, patch)}
          onDelete={() => deletePoint(selectedPoint.id)}
        />
      )}
      {(isEditing || current) && (
        <PointsSummary points={points} pointNumbers={pointNumbers} selectedPointId={selectedPointId} isEditing={isEditing} showErrors={showValidation} onSelectPoint={selectFromList} />
      )}
      {!isEditing && current?.notes && (
        <div className="flex flex-col gap-1 rounded-xl border bg-muted/20 p-3">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t('session.notes')}</span>
          <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground">{current.notes}</p>
        </div>
      )}
    </div>
  );

  const noSessionsState = !isEditing && !current && (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed p-8 text-center">
      <Sparkles className="h-8 w-8 text-muted-foreground/60" />
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{t('emptyTitle')}</p>
        <p className="text-xs text-muted-foreground">{t('emptyDescription')}</p>
      </div>
      {canRegister && (
        <Button size="sm" onClick={startNewSession}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          {t('newSession')}
        </Button>
      )}
    </div>
  );

  return (
    <div ref={setRootEl} className="flex flex-col gap-3">
      {header}

      {noSessionsState || (
        <>
          <Segmented value={tab} options={tabs} onChange={setTab} ariaLabel={t('tabs.label')} />

          {(tab === 'map' || tab === 'zones') && (
            <div className={cn('flex gap-4', sideBySide ? 'flex-row items-start' : 'flex-col')}>
              {mapColumn}
              {tab === 'map' ? mapSide : (
                <div className="min-w-0 flex-1">
                  <ZoneHistory sessions={sessions} selectedZone={pinnedZone} onHoverZone={setHoveredZone} onSelectZone={showZone} />
                </div>
              )}
            </div>
          )}

          {tab === 'photos' && (
            <PhotosPanel
              photos={shownPhotos}
              pending={pendingPhotos}
              isEditing={isEditing}
              allPhotos={allPhotos}
              onAddFiles={addPhotos}
              onRemoveStored={(id) => setRemovedPhotoIds((prev) => [...prev, id])}
              onRemovePending={removePendingPhoto}
            />
          )}

          {tab === 'consent' && (
            <ConsentPanel
              session={isEditing && !draft.sessionId ? null : current}
              canSign={canRegister && !!current && !isEditing}
              signDisabledReason={isEditing ? t('consent.saveFirst') : !canRegister ? t('consent.noPermission') : undefined}
              onSign={() => setConsentOpen(true)}
            />
          )}

          {isEditing && tab !== 'zones' && sessionFields}
        </>
      )}

      {current && (
        <ConsentDialog
          open={consentOpen}
          onOpenChange={setConsentOpen}
          patientId={patientId}
          patientName={patientName}
          session={current}
          defaultProcedure={defaultProcedure}
          onSigned={(updated) => setSessions((list) => list.map((s) => (s.id === updated.id ? updated : s)))}
        />
      )}

      <AlertDialog open={confirmDiscard !== null} onOpenChange={(open) => { if (!open) setConfirmDiscard(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('discard.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('discard.description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('discard.keep')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => {
                confirmDiscard?.();
                setConfirmDiscard(null);
              }}
            >
              {t('discard.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function pickPreset(point: AestheticPoint): PointPreset {
  const { serviceId, productName, quantity, unit, lot, lotExpiry, depth, technique } = point;
  return { serviceId, productName, quantity, unit, lot, lotExpiry, depth, technique };
}
