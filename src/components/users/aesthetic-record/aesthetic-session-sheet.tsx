'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { CalendarDays, Camera, CheckCircle2, ChevronLeft, ChevronRight, CircleAlert, FileSignature, History, ListOrdered, MapPin, Mars, MousePointerClick, NotebookPen, Pencil, PersonStanding, ScanFace, Sparkles, Stethoscope, Venus } from 'lucide-react';

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
import { ResizableSheet, SheetTitle } from '@/components/ui/resizable-sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';

import { AESTHETIC_RECORD_PERMISSIONS } from '@/constants/permissions';
import { useAsyncAction } from '@/hooks/use-async-action';
import { usePanelWidth } from '@/hooks/use-panel-width';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/error-utils';
import { cn, formatDate, formatDisplayDate, toLocalISOString } from '@/lib/utils';
import {
  fetchAestheticSessions,
  newAestheticPointId,
  saveAestheticPhotoAlignment,
  signAestheticConsent,
  upsertAestheticSession,
  type AestheticConsentInput,
  type AestheticConsentUpload,
} from '@/services/aesthetic-record';

import type { AestheticBodyFigure, AestheticConsent, AestheticDoseUnit, AestheticMapRegion, AestheticMapView, AestheticPhotoAlignment, AestheticPhotoKind, AestheticPoint, AestheticSession, AestheticZoneId } from '@/lib/types';
import { ConsentDialog } from './consent-dialog';
import { ConsentPanel } from './consent-panel';
import { AestheticMap } from './aesthetic-map';
import { BODY_FIGURES, getViewZoneIds, MAP_REGIONS, MAP_VIEWS, REGION_VIEWS, UNIT_COLORS, VIEW_REGION } from './map-templates';
import { MapRail, RailGroup, type RailOption } from './map-rail';
import { DEFAULT_PHOTO_ALIGNMENT, PhotoBackdropAdjust, PhotoBackdropToolbar, type BackdropRef } from './photo-backdrop-controls';
import type { ComparePhoto, PhotoRef } from './photo-compare';
import { PhotosPanel, type PendingPhoto } from './photos-panel';
import { PointDetailCard } from './point-detail-card';
import { isPointIncomplete, PointsSummary } from './points-summary';
import { useAestheticFileUrl } from './use-aesthetic-file-url';
import { VIEW_ICONS } from './view-icons';
import { formatQuantity, ZoneHistory } from './zone-history';

type Tab = 'points' | 'photos' | 'consent' | 'zones' | 'notes';

/** Width of the sheet body from which the map and the tabs sit side by side */
const SIDE_BY_SIDE_MIN_WIDTH = 760;
/** Room left for the map drawing once the sheet header, the session fields, the tabs, the footer and the map's hint are on screen */
const MAP_MAX_HEIGHT = 'max(18rem, calc(100dvh - 19rem))';
/** Photos and their comparison go in two columns from this body width */
const WIDE_PHOTOS_MIN_WIDTH = 640;

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

/** Consent signed during the edit, saved together with the session */
interface PendingConsent extends AestheticConsentUpload {
  previewUrl: string;
}

/** Total dose per unit ("24 U", "1.5 mL"), for the one-line session summaries */
export function aestheticUnitTotals(points: AestheticPoint[]): { unit: AestheticDoseUnit; quantity: number }[] {
  const totals = new Map<AestheticDoseUnit, number>();
  for (const point of points) totals.set(point.unit, (totals.get(point.unit) ?? 0) + (point.quantity ?? 0));
  return [...totals.entries()].filter(([, quantity]) => quantity > 0).map(([unit, quantity]) => ({ unit, quantity }));
}

function TabBar<T extends string>({ value, options, onChange, ariaLabel }: {
  value: T;
  options: { id: T; label: string; icon: React.ElementType; badge?: React.ReactNode }[];
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="flex max-w-full gap-1 overflow-x-auto border-b [scrollbar-width:none]">
      {options.map(({ id, label, icon: Icon, badge }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={value === id}
          onClick={() => onChange(id)}
          className={cn(
            '-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors',
            // The dark theme's primary is a dark grey: fall back to the foreground there
            value === id ? 'border-primary text-primary dark:border-foreground dark:text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          <Icon className="h-4 w-4" />
          {label}
          {badge}
        </button>
      ))}
    </div>
  );
}

/** Small count shown next to a tab label */
function TabCount({ count }: { count: number }) {
  return <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold leading-4 text-muted-foreground">{count}</span>;
}

export interface AestheticSessionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  patientName?: string;
  /** Patient's sex, used to pick the body figure of their first session */
  patientSex?: AestheticBodyFigure | null;
  /** Session shown; `null` opens a new one */
  sessionId: string | null;
  /** Open the session straight in edit mode */
  startEditing?: boolean;
  /** Doctor of the context (e.g. the appointment's); preselected on new sessions */
  doctorId?: string;
  doctorName?: string;
  /** Appointment a new session is linked to */
  appointmentId?: string;
  readOnly?: boolean;
  /** A session was created or edited, or its consent was signed */
  onChanged?: () => void;
}

/** Creates, shows and edits one aesthetic session: the map stays in view and the session's parts are tabs beside it */
export function AestheticSessionSheet({ open, onOpenChange, ...panelProps }: AestheticSessionSheetProps) {
  // The panel swaps this for a check of its unsaved changes
  const closeRequestRef = React.useRef<(() => void) | null>(null);

  return (
    <ResizableSheet
      open={open}
      onOpenChange={(next) => {
        if (next) onOpenChange(true);
        else if (closeRequestRef.current) closeRequestRef.current();
        else onOpenChange(false);
      }}
      defaultWidth={1100}
      minWidth={640}
      maxWidth={1600}
      storageKey="aesthetic-session-sheet-width"
    >
      {open && <AestheticSessionPanel {...panelProps} onClose={() => onOpenChange(false)} closeRequestRef={closeRequestRef} />}
    </ResizableSheet>
  );
}

interface AestheticSessionPanelProps extends Omit<AestheticSessionSheetProps, 'open' | 'onOpenChange'> {
  onClose: () => void;
  closeRequestRef: React.MutableRefObject<(() => void) | null>;
}

function AestheticSessionPanel({ patientId, patientName, patientSex, sessionId, startEditing: startInEdit = false, doctorId, doctorName, appointmentId, readOnly = false, onChanged, onClose, closeRequestRef }: AestheticSessionPanelProps) {
  const t = useTranslations('AestheticRecord');
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const canRegister = !readOnly && hasPermission(AESTHETIC_RECORD_PERMISSIONS.REGISTER_SESSION);

  // The body only mounts once the sessions have loaded, so it is tracked as state: a plain ref would
  // be empty when the width observer is set up and the layout would never switch to side by side
  const [bodyEl, setBodyEl] = React.useState<HTMLDivElement | null>(null);
  const bodyRef = React.useMemo(() => ({ current: bodyEl }), [bodyEl]);
  const bodyWidth = usePanelWidth(bodyRef);
  const sideBySide = bodyWidth >= SIDE_BY_SIDE_MIN_WIDTH;

  const [sessions, setSessions] = React.useState<AestheticSession[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<Tab>('points');
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
  const [pendingConsent, setPendingConsent] = React.useState<PendingConsent | null>(null);
  const presetRef = React.useRef<PointPreset>(DEFAULT_PRESET);

  // Photo behind the map
  const [backdropEnabled, setBackdropEnabled] = React.useState(false);
  /** Once the user flips the backdrop switch, taking photos no longer turns it on */
  const backdropTouchedRef = React.useRef(false);
  /** Photo picked for each view; a view without a pick uses its preferred photo */
  const [backdropChoice, setBackdropChoice] = React.useState<Partial<Record<AestheticMapView, string>>>({});
  const [backdropOpacity, setBackdropOpacity] = React.useState(0.85);
  const [backdropHideArt, setBackdropHideArt] = React.useState(false);
  /** Where the map placed the photos that have no alignment of their own yet, by photo id */
  const [autoFits, setAutoFits] = React.useState<Record<string, AestheticPhotoAlignment>>({});
  const [alignmentEdit, setAlignmentEdit] = React.useState<{ photoId: string; alignment: AestheticPhotoAlignment } | null>(null);

  const isEditing = draft !== null;
  /** Session on screen: the one the sheet opened with, then the one reached with previous/next */
  const [shownId, setShownId] = React.useState<string | null>(sessionId ?? null);
  const current = shownId ? sessions.find((s) => s.id === shownId) ?? null : null;
  const currentIndex = current ? sessions.indexOf(current) : -1;
  const previousSession = currentIndex > 0 ? sessions[currentIndex - 1] : null;
  const nextSession = currentIndex >= 0 ? sessions[currentIndex + 1] ?? null : null;
  const isDirty = isEditing && (draftKey(draft) !== initialDraftKey || pendingPhotos.length > 0 || removedPhotoIds.length > 0 || pendingConsent !== null);

  /** Body figure of a new session: the one used last, else the patient's sex */
  const figureFrom = React.useCallback(
    (list: AestheticSession[]): AestheticBodyFigure => [...list].reverse().find((s) => s.bodyFigure)?.bodyFigure ?? patientSex ?? 'female',
    [patientSex],
  );

  const load = React.useCallback(async () => {
    setLoadError(null);
    try {
      const list = await fetchAestheticSessions(patientId);
      setSessions(list);
      return list;
    } catch (error) {
      setLoadError(getErrorMessage(error));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [patientId]);

  React.useEffect(() => {
    load().then((list) => {
      if (!list) return;
      if (!sessionId) {
        if (canRegister) startNewSession(list);
        return;
      }
      const session = list.find((s) => s.id === sessionId);
      if (session && startInEdit && canRegister) startEditing(session, list);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the sheet's content mounts once per opening
  }, []);

  // Closing or reloading the page drops the edit: ask first
  React.useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  // ── Derived ──
  const points = React.useMemo(() => draft?.points ?? current?.points ?? [], [draft, current]);
  // Body points are placed on a figure: it stays fixed once the session has any
  const figure = draft?.bodyFigure ?? current?.bodyFigure ?? figureFrom(sessions);
  const canChangeFigure = isEditing && !points.some((p) => VIEW_REGION[p.view] === 'body');
  const pointNumbers = React.useMemo(() => new Map(points.map((p, i) => [p.id, i + 1])), [points]);
  const selectedPoint = points.find((p) => p.id === selectedPointId) ?? null;
  const allPhotos = React.useMemo<PhotoRef[]>(
    () => sessions.flatMap((session) => session.photos.map((photo) => ({ photo, session }))),
    [sessions],
  );
  const shownPhotos = (current?.photos ?? []).filter((p) => !removedPhotoIds.includes(p.id));
  /** Photos offered to the comparison: the stored ones (minus those removed in this edit) and the ones not saved yet */
  const comparePhotos = React.useMemo<ComparePhoto[]>(() => {
    const pendingDate = draft?.date ?? current?.date ?? toLocalISOString(new Date());
    return [
      ...allPhotos.filter((ref) => !removedPhotoIds.includes(ref.photo.id)).map((ref) => ({ photo: ref.photo, date: ref.session.date })),
      ...pendingPhotos.map((p) => ({ photo: { id: p.key, kind: p.kind, view: p.view }, date: pendingDate, previewUrl: p.previewUrl })),
    ];
  }, [allPhotos, removedPhotoIds, pendingPhotos, draft?.date, current?.date]);
  const photoCount = shownPhotos.length + pendingPhotos.length;
  const notes = draft ? draft.notes : current?.notes ?? '';

  /** Photos of the view, saved or not yet: the session's own first ("before" ahead), then the newest sessions */
  const backdropCandidates = React.useMemo<BackdropRef[]>(() => {
    const pendingDate = draft?.date ?? current?.date ?? toLocalISOString(new Date());
    const stored = allPhotos
      .filter((ref) => ref.photo.view === view && !removedPhotoIds.includes(ref.photo.id) && ref.session.consent?.allowsClinicalPhotos !== false)
      .map((ref) => ({
        ref: { photo: ref.photo, date: ref.session.date } as BackdropRef,
        own: ref.session.id === current?.id,
        createdAt: ref.photo.createdAt,
      }));
    // A photo taken in this edit belongs to the session being edited and is the newest of all
    const unsaved = pendingPhotos
      .filter((p) => p.view === view)
      .map((p) => ({
        ref: { photo: { id: p.key, kind: p.kind, view: p.view, alignment: p.alignment }, date: pendingDate, previewUrl: p.previewUrl } as BackdropRef,
        own: true,
        createdAt: '￿',
      }));
    const rank = (c: { ref: BackdropRef; own: boolean }) => (c.own ? (c.ref.photo.kind === 'before' ? 0 : 1) : 2);
    return [...stored, ...unsaved]
      .sort((a, b) => rank(a) - rank(b) || b.ref.date.localeCompare(a.ref.date) || b.createdAt.localeCompare(a.createdAt))
      .map((c) => c.ref);
  }, [allPhotos, pendingPhotos, view, removedPhotoIds, current?.id, current?.date, draft?.date]);
  const backdropRef = backdropCandidates.find((ref) => ref.photo.id === backdropChoice[view]) ?? backdropCandidates[0] ?? null;
  const showBackdrop = backdropEnabled && !!backdropRef;
  const storedBackdropUrl = useAestheticFileUrl(showBackdrop && !backdropRef?.previewUrl ? backdropRef?.photo.id : undefined);
  const backdropUrl = backdropRef?.previewUrl ?? storedBackdropUrl;
  const backdropFit = backdropRef ? autoFits[backdropRef.photo.id] : undefined;
  const handleBackdropFit = React.useCallback((photoId: string, alignment: AestheticPhotoAlignment) => {
    setAutoFits((prev) => (prev[photoId]?.scale === alignment.scale ? prev : { ...prev, [photoId]: alignment }));
  }, []);
  const editingAlignment = alignmentEdit && alignmentEdit.photoId === backdropRef?.photo.id ? alignmentEdit.alignment : null;
  /** Consent that applies to what is on screen: the one signed in this edit, else the stored one (none for a new session) */
  const effectiveConsent: AestheticConsent | null = pendingConsent
    ? { ...pendingConsent.input, signedAt: pendingConsent.signedAt, signatureFileId: '' }
    : current?.consent ?? null;

  // ── Editing ──
  function beginEditing(next: Draft) {
    setDraft(next);
    setInitialDraftKey(draftKey(next));
    setPendingPhotos([]);
    setRemovedPhotoIds([]);
    setPendingConsent(null);
    setSaveError(null);
    setShowValidation(false);
    setSelectedPointId(null);
    presetRef.current = next.points.length ? pickPreset(next.points[next.points.length - 1]) : DEFAULT_PRESET;
  }

  function startNewSession(list: AestheticSession[]) {
    const today = formatDate(new Date());
    beginEditing({
      date: today,
      title: t('session.defaultTitle', { date: formatDisplayDate(today) }),
      doctorId,
      doctorName,
      appointmentId,
      notes: '',
      points: [],
      bodyFigure: figureFrom(list),
    });
  }

  function startEditing(session: AestheticSession, list: AestheticSession[] = sessions) {
    beginEditing({
      sessionId: session.id,
      date: session.date,
      title: session.title,
      doctorId: session.doctorId,
      doctorName: session.doctorName,
      appointmentId: session.appointmentId,
      notes: session.notes,
      points: session.points,
      bodyFigure: session.bodyFigure ?? figureFrom(list),
    });
  }

  function endEditing() {
    pendingPhotos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    if (pendingConsent) URL.revokeObjectURL(pendingConsent.previewUrl);
    setDraft(null);
    setPendingPhotos([]);
    setRemovedPhotoIds([]);
    setPendingConsent(null);
    setSaveError(null);
    setShowValidation(false);
    setSelectedPointId(null);
  }

  /** Runs `action` right away, or after confirming when there are unsaved changes */
  function guardUnsaved(action: () => void) {
    if (isDirty) setConfirmDiscard(() => action);
    else action();
  }

  function close() {
    guardUnsaved(() => {
      pendingPhotos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      if (pendingConsent) URL.revokeObjectURL(pendingConsent.previewUrl);
      onClose();
    });
  }

  /** A new session has nothing to go back to: cancelling closes the sheet */
  function cancelEditing() {
    if (!draft?.sessionId) close();
    else guardUnsaved(endEditing);
  }

  /** Shows another session; an open edit ends first, asking before dropping unsaved changes */
  function goToSession(target: AestheticSession) {
    guardUnsaved(() => {
      if (isEditing) endEditing();
      setShownId(target.id);
      setSelectedPointId(null);
      setPinnedZone(null);
      setAlignmentEdit(null);
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
    setTab('points');
  }

  function deletePoint(id: string) {
    setDraft((d) => (d ? { ...d, points: d.points.filter((p) => p.id !== id) } : d));
    setSelectedPointId((s) => (s === id ? null : s));
  }

  function addPhotos(files: File[], kind: AestheticPhotoKind, photoView: AestheticMapView) {
    // The first photos show up behind the map by themselves, ready to place the points on them
    if (!backdropTouchedRef.current) setBackdropEnabled(true);
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
        pendingPhotos.map(({ file, kind, view: photoView, alignment }) => ({ file, kind, view: photoView, alignment })),
        removedPhotoIds,
        draft.sessionId,
        pendingConsent ? { input: pendingConsent.input, signature: pendingConsent.signature, signedAt: pendingConsent.signedAt } : undefined,
      );
    },
    {
      onSuccess: (saved) => {
        if (!saved) return;
        toast({ title: draft?.sessionId ? t('toast.updated') : t('toast.created') });
        endEditing();
        onChanged?.();
        onClose();
      },
      onError: (error) => setSaveError(getErrorMessage(error)),
      showErrorToast: false,
    },
  );

  // Closing the sheet (×, Esc, outside click) goes through the unsaved-changes check
  React.useEffect(() => {
    closeRequestRef.current = save.isPending ? () => undefined : close;
    return () => { closeRequestRef.current = null; };
  });

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
      setTab('points');
      setView(incomplete.view);
      setSelectedPointId(incomplete.id);
      return;
    }
    if (effectiveConsent?.allowsClinicalPhotos === false && photoCount > 0) {
      setShowValidation(true);
      setSaveError(t('session.photosNotAllowed'));
      setTab('photos');
      return;
    }
    setSaveError(null);
    save.run();
  }

  /** While editing, the consent waits for the session save; on a saved session it is stored right away */
  async function submitConsent(input: AestheticConsentInput, signature: File) {
    const signedAt = toLocalISOString(new Date());
    if (isEditing) {
      if (pendingConsent) URL.revokeObjectURL(pendingConsent.previewUrl);
      setPendingConsent({ input, signature, signedAt, previewUrl: URL.createObjectURL(signature) });
      toast({ title: t('consent.toastPending') });
      return;
    }
    if (!current) return;
    const updated = await signAestheticConsent(patientId, current.id, input, signature);
    setSessions((list) => list.map((s) => (s.id === updated.id ? updated : s)));
    toast({ title: t('consent.toastSigned') });
    onChanged?.();
  }

  function removePendingConsent() {
    if (pendingConsent) URL.revokeObjectURL(pendingConsent.previewUrl);
    setPendingConsent(null);
  }

  const saveAlignment = useAsyncAction(
    async () => {
      if (!alignmentEdit) return null;
      // A photo not saved yet keeps its alignment with the edit and stores it along with the session
      if (pendingPhotos.some((p) => p.key === alignmentEdit.photoId)) {
        setPendingPhotos((prev) => prev.map((p) => (p.key === alignmentEdit.photoId ? { ...p, alignment: alignmentEdit.alignment } : p)));
        return null;
      }
      return saveAestheticPhotoAlignment(patientId, alignmentEdit.photoId, alignmentEdit.alignment);
    },
    {
      onSuccess: (session) => {
        setAlignmentEdit(null);
        if (!session) return;
        setSessions((prev) => prev.map((s) => (s.id === session.id ? session : s)));
        toast({ title: t('toast.alignmentSaved') });
      },
      errorTitle: t('map.backdrop.saveError'),
    },
  );

  /** Opens the point's row (switching to its view), or closes it when already open */
  function selectFromList(point: AestheticPoint) {
    if (selectedPointId === point.id) {
      setSelectedPointId(null);
      return;
    }
    setView(point.view);
    setSelectedPointId(point.id);
  }

  /** A point picked on the map opens its row in the points tab */
  function selectFromMap(id: string | null) {
    setSelectedPointId(id);
    if (id) setTab('points');
  }

  /** Shows a zone picked in the history: switches to the first view that draws it */
  function showZone(zone: AestheticZoneId | null) {
    setPinnedZone(zone);
    if (!zone || getViewZoneIds(view).includes(zone)) return;
    const target = MAP_VIEWS.find((v) => getViewZoneIds(v).includes(zone));
    if (target) setView(target);
  }

  const defaultProcedure = React.useMemo(() => {
    const names = [...new Set(points.map((p) => p.productName.trim()).filter(Boolean))];
    return names.join(', ');
  }, [points]);

  // ── Render ──
  const consentBadge = effectiveConsent ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-700 dark:text-emerald-400">
      <CheckCircle2 className="h-3 w-3" />{t('consent.signedBadge')}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 font-medium text-amber-700 dark:text-amber-400">
      <CircleAlert className="h-3 w-3" />{t('consent.missingBadge')}
    </span>
  );

  const headerTitle = isEditing ? (draft.sessionId ? draft.title || t('sheet.editTitle') : t('sheet.newTitle')) : current?.title ?? t('sheet.title');
  const header = (
    <div className="flex shrink-0 items-start gap-3 border-b px-6 py-4 pr-24">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-w-0 items-center gap-2">
          <SheetTitle className="truncate text-base font-semibold">{headerTitle}</SheetTitle>
          {isEditing && draft.sessionId && <Badge className="shrink-0">{t('editing')}</Badge>}
        </div>
        {!isEditing && current && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{formatDisplayDate(current.date)}</span>
            {current.doctorName && (
              <span className="inline-flex min-w-0 items-center gap-1"><Stethoscope className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{current.doctorName}</span></span>
            )}
          </div>
        )}
      </div>
      {current && sessions.length > 1 && (
        <div className="flex shrink-0 items-center gap-0.5">
          {([['previous', previousSession, ChevronLeft], ['next', nextSession, ChevronRight]] as const).map(([dir, target, Icon]) => {
            const label = target
              ? t(`sheet.${dir}SessionWithDate`, { date: formatDisplayDate(target.date) })
              : t(`sheet.${dir}Session`);
            return (
              <Button
                key={dir}
                type="button"
                size="icon"
                variant="ghost"
                className={cn('h-8 w-8', dir === 'next' && 'order-last')}
                disabled={!target || save.isPending}
                onClick={() => target && goToSession(target)}
                aria-label={label}
                title={label}
              >
                <Icon className="h-4 w-4" />
              </Button>
            );
          })}
          <span className="min-w-[3.5rem] text-center text-xs tabular-nums text-muted-foreground" aria-live="polite">
            {t('sheet.position', { index: currentIndex + 1, total: sessions.length })}
          </span>
        </div>
      )}
      {!isEditing && current && canRegister && (
        <Button size="sm" variant="outline" className="shrink-0" onClick={() => startEditing(current)}>
          <Pencil className="mr-1.5 h-3.5 w-3.5" />
          {t('editSession')}
        </Button>
      )}
    </div>
  );

  if (isLoading || loadError || (shownId && !current) || (!shownId && !isEditing)) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex shrink-0 items-center gap-3 border-b px-6 py-4 pr-24">
          <SheetTitle className="text-base font-semibold">{shownId ? t('sheet.title') : t('sheet.newTitle')}</SheetTitle>
        </div>
        <div className="flex flex-1 flex-col gap-3 p-6">
          {isLoading ? (
            <>
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-[420px] w-full" />
            </>
          ) : (
            <Alert variant="destructive">
              <AlertDescription>{loadError ?? (shownId ? t('sheet.notFound') : t('consent.noPermission'))}</AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    );
  }

  const dateInvalid = showValidation && !draft?.date;
  const invalidPointIds = showValidation ? new Set(points.filter(isPointIncomplete).map((p) => p.id)) : undefined;

  const sessionFields = draft && (
    <div className="grid shrink-0 gap-3 border-b px-6 py-3 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_minmax(0,1.4fr)]">
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
      <div className="flex min-w-0 flex-col gap-1.5">
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
      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor="aes-session-title" className="text-xs">{t('session.title')}</Label>
        <Input id="aes-session-title" value={draft.title} onChange={(e) => updateDraft({ title: e.target.value })} disabled={save.isPending} className="h-9" />
      </div>
    </div>
  );

  const regionIcons: Record<AestheticMapRegion, React.ElementType> = { face: ScanFace, body: PersonStanding };
  const regionOptions: RailOption<AestheticMapRegion>[] = MAP_REGIONS.map((r) => {
    const count = points.filter((p) => VIEW_REGION[p.view] === r).length;
    return {
      id: r,
      icon: regionIcons[r],
      label: count ? t('map.regionWithCount', { region: t(`regions.${r}`), count }) : t(`regions.${r}`),
      badge: count ? <span className="text-[10px] font-semibold tabular-nums">{count}</span> : undefined,
    };
  });
  const viewOptions: RailOption<AestheticMapView>[] = REGION_VIEWS[region].map((v) => ({
    id: v,
    label: t(`views.${v}`),
    icon: VIEW_ICONS[v],
  }));
  const figureIcons: Record<AestheticBodyFigure, React.ElementType> = { female: Venus, male: Mars };
  const figureOptions: RailOption<AestheticBodyFigure>[] = BODY_FIGURES.map((f) => ({ id: f, label: t(`figures.${f}`), icon: figureIcons[f] }));
  const zoneHighlight = hoveredZone ?? pinnedZone;

  const mapColumn = (
    // Side by side the map stays in view while the tabs scroll; its height is capped so it fits on screen
    <div
      className={cn('flex min-w-0 flex-col gap-2 rounded-2xl border bg-card p-3 shadow-sm', sideBySide ? 'sticky top-0 flex-1 self-start' : 'w-full')}
      style={{ '--aes-map-max-h': MAP_MAX_HEIGHT } as React.CSSProperties}
    >
      {editingAlignment && (
        <PhotoBackdropAdjust
          alignment={editingAlignment}
          onChange={(alignment) => setAlignmentEdit((prev) => (prev ? { ...prev, alignment } : prev))}
          onCancel={() => setAlignmentEdit(null)}
          onSave={() => saveAlignment.run()}
          isSaving={saveAlignment.isPending}
          resetTo={backdropFit}
        />
      )}
      <div className="relative">
        {/* Region, view, figure and backdrop float over the map's left edge, icon only */}
        <MapRail className="absolute left-0 top-0 z-10">
          <RailGroup value={region} options={regionOptions} onChange={(r) => setView(lastViewByRegionRef.current[r])} ariaLabel={t('map.regionsLabel')} />
          <RailGroup value={view} options={viewOptions} onChange={setView} ariaLabel={t('map.viewsLabel')} />
          {region === 'body' && (
            <RailGroup
              value={figure}
              options={figureOptions}
              onChange={(f) => updateDraft({ bodyFigure: f })}
              ariaLabel={t('map.figureLabel')}
              disabled={!canChangeFigure}
              disabledReason={isEditing && !canChangeFigure ? t('map.figureLocked') : undefined}
            />
          )}
          <PhotoBackdropToolbar
            vertical
            candidates={backdropCandidates}
            enabled={backdropEnabled}
            onEnabledChange={(enabled) => { backdropTouchedRef.current = true; setBackdropEnabled(enabled); }}
            selected={backdropRef}
            onSelect={(photoId) => setBackdropChoice((prev) => ({ ...prev, [view]: photoId }))}
            url={backdropUrl}
            opacity={backdropOpacity}
            onOpacityChange={setBackdropOpacity}
            hideArt={backdropHideArt}
            onHideArtChange={setBackdropHideArt}
            canAdjust={canRegister && tab !== 'zones'}
            isAdjusting={!!editingAlignment}
            onStartAdjust={() => backdropRef && setAlignmentEdit({ photoId: backdropRef.photo.id, alignment: backdropRef.photo.alignment ?? backdropFit ?? DEFAULT_PHOTO_ALIGNMENT })}
          />
        </MapRail>
        {/* Legend floats over the top-right corner, out of the way of the drawing */}
        <div className="pointer-events-none absolute right-0 top-0 z-10 flex flex-col gap-1 rounded-lg bg-card/80 px-2 py-1.5 text-[11px] text-muted-foreground backdrop-blur-sm">
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-card" style={{ backgroundColor: UNIT_COLORS.U }} />{t('map.legendToxin')}</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-card" style={{ backgroundColor: UNIT_COLORS.mL }} />{t('map.legendFiller')}</span>
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
          onSelectPoint={selectFromMap}
          onDeletePoint={isEditing ? deletePoint : undefined}
          backdrop={showBackdrop && backdropRef && backdropUrl ? {
            photoId: backdropRef.photo.id,
            url: backdropUrl,
            alignment: editingAlignment ?? backdropRef.photo.alignment ?? backdropFit ?? null,
            opacity: editingAlignment ? Math.min(backdropOpacity, 0.7) : backdropOpacity,
            hideArt: backdropHideArt && !editingAlignment,
          } : null}
          adjustingBackdrop={!!editingAlignment}
          onBackdropFit={handleBackdropFit}
          onBackdropChange={(alignment) => setAlignmentEdit((prev) => (prev ? { ...prev, alignment } : prev))}
          className={cn('mx-auto w-full', region === 'body' ? 'max-w-[420px]' : 'max-w-[640px]')}
        />
      </div>
      {(isEditing && tab !== 'zones') || region === 'body' ? (
        <div className="flex flex-col gap-1 border-t pt-2">
          {isEditing && tab !== 'zones' && (
            <p className="flex items-start justify-center gap-1.5 text-center text-[11px] leading-snug text-muted-foreground">
              <MousePointerClick className="mt-px h-3.5 w-3.5 shrink-0" />
              {t('map.hint')}
            </p>
          )}
          {region === 'body' && <p className="text-center text-[10px] text-muted-foreground/70">{t('credits')}</p>}
        </div>
      ) : null}
    </div>
  );

  const tabs: { id: Tab; label: string; icon: React.ElementType; badge?: React.ReactNode }[] = [
    { id: 'points', label: t('tabs.points'), icon: ListOrdered, badge: points.length ? <TabCount count={points.length} /> : undefined },
    { id: 'photos', label: t('tabs.photos'), icon: Camera, badge: photoCount ? <TabCount count={photoCount} /> : undefined },
    {
      id: 'consent',
      label: t('tabs.consent'),
      icon: FileSignature,
      badge: effectiveConsent
        ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-label={t('consent.signedBadge')} />
        : <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-label={t('consent.missingBadge')} />,
    },
    { id: 'zones', label: t('tabs.zones'), icon: History },
    { id: 'notes', label: t('tabs.notes'), icon: NotebookPen, badge: notes.trim() ? <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" aria-hidden /> : undefined },
  ];

  // The map goes with the points and the zone history; photos, consent and notes use the full width
  const showsMap = tab === 'points' || tab === 'zones';
  const tabContent = (
    <div className="flex min-w-0 flex-1 flex-col gap-3">
      {tab === 'points' && (
        // Side by side the selected point's form takes the side panel (the map stays in view); stacked, it opens under its row
        sideBySide && selectedPoint ? (
          <div key="point-detail" className="flex flex-col duration-150 animate-in fade-in slide-in-from-right-2">
            {/* The way back and the point's header stay on top while the fields scroll */}
            <div className="sticky top-0 z-20 flex h-10 items-center bg-background">
              <Button type="button" size="sm" variant="ghost" className="-ml-2 h-8 text-muted-foreground" onClick={() => setSelectedPointId(null)}>
                <ChevronLeft className="mr-1 h-4 w-4" />
                {t('point.backToList')}
              </Button>
            </div>
            <PointDetailCard
              point={selectedPoint}
              number={pointNumbers.get(selectedPoint.id)}
              readOnly={!isEditing}
              showErrors={showValidation}
              onChange={(patch) => updatePoint(selectedPoint.id, patch)}
              onDelete={() => deletePoint(selectedPoint.id)}
              stickyHeader
            />
          </div>
        ) : (
          <PointsSummary
            points={points}
            pointNumbers={pointNumbers}
            selectedPointId={selectedPointId}
            isEditing={isEditing}
            showErrors={showValidation}
            onSelectPoint={selectFromList}
            renderDetail={sideBySide ? undefined : (point) => (
              <PointDetailCard
                point={point}
                number={pointNumbers.get(point.id)}
                readOnly={!isEditing}
                showErrors={showValidation}
                onChange={(patch) => updatePoint(point.id, patch)}
                onDelete={() => deletePoint(point.id)}
                embedded
              />
            )}
          />
        )
      )}

      {tab === 'photos' && (
        <PhotosPanel
          photos={shownPhotos}
          wide={bodyWidth >= WIDE_PHOTOS_MIN_WIDTH}
          pending={pendingPhotos}
          isEditing={isEditing}
          consent={effectiveConsent}
          allPhotos={comparePhotos}
          onAddFiles={addPhotos}
          onRemoveStored={(id) => setRemovedPhotoIds((prev) => [...prev, id])}
          onRemovePending={removePendingPhoto}
        />
      )}

      {tab === 'consent' && (
        <ConsentPanel
          consent={effectiveConsent}
          pendingSignatureUrl={pendingConsent?.previewUrl}
          isEditing={isEditing}
          canSign={canRegister}
          signDisabledReason={!canRegister ? t('consent.noPermission') : undefined}
          onSign={() => setConsentOpen(true)}
          onRemovePending={save.isPending ? undefined : removePendingConsent}
        />
      )}

      {tab === 'zones' && (
        <ZoneHistory sessions={sessions} selectedZone={pinnedZone} onHoverZone={setHoveredZone} onSelectZone={showZone} />
      )}

      {tab === 'notes' && (
        isEditing ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="aes-session-notes" className="text-xs">{t('session.notes')}</Label>
            <Textarea id="aes-session-notes" value={draft.notes} onChange={(e) => updateDraft({ notes: e.target.value })} disabled={save.isPending} rows={8} placeholder={t('session.notesPlaceholder')} className="resize-y text-sm" />
          </div>
        ) : notes.trim() ? (
          <p className="whitespace-pre-wrap rounded-xl border bg-muted/20 p-3 text-sm leading-relaxed text-foreground">{notes}</p>
        ) : (
          <p className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">{t('sheet.noNotes')}</p>
        )
      )}
    </div>
  );

  const unitTotals = aestheticUnitTotals(points);
  const footer = (
    <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-t px-6 py-3">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{t('map.pointsTitle', { count: points.length })}</span>
        {unitTotals.map(({ unit, quantity }) => (
          <span key={unit} className="inline-flex items-center gap-1.5 font-medium text-foreground">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: UNIT_COLORS[unit] }} aria-hidden />
            {formatQuantity(quantity)} {unit}
          </span>
        ))}
        {photoCount > 0 && <span className="inline-flex items-center gap-1"><Camera className="h-3.5 w-3.5" />{t('sheet.photoCount', { count: photoCount })}</span>}
        {consentBadge}
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {isEditing ? (
          <>
            <Button type="button" variant="outline" onClick={cancelEditing} disabled={save.isPending}>{t('cancel')}</Button>
            <Button type="button" onClick={handleSave} loading={save.isPending}>{t('save')}</Button>
          </>
        ) : (
          <Button type="button" variant="outline" onClick={close}>{t('sheet.close')}</Button>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      {header}
      {sessionFields}
      <div className="shrink-0 px-4 pt-2">
        <TabBar value={tab} options={tabs} onChange={setTab} ariaLabel={t('tabs.label')} />
      </div>
      {/* The gutter stays reserved so a scrollbar showing up never narrows the content */}
      <div ref={setBodyEl} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4 [scrollbar-gutter:stable]">
        {saveError && <Alert variant="destructive"><AlertDescription>{saveError}</AlertDescription></Alert>}
        {showsMap ? (
          <div className={cn('flex gap-4', sideBySide ? 'min-h-0 flex-1 flex-row items-start' : 'flex-col')}>
            {mapColumn}
            {/* Beside the map the tabs are a side panel as tall as the body, scrolling on its own:
                opening or closing a point never changes the body's height */}
            <div className={cn('min-w-0', sideBySide ? 'flex min-h-0 w-[clamp(20rem,38%,28rem)] shrink-0 flex-col self-stretch overflow-y-auto overflow-x-clip [scrollbar-gutter:stable]' : 'w-full')}>
              {tabContent}
            </div>
          </div>
        ) : tabContent}
      </div>
      {footer}

      <ConsentDialog
        open={consentOpen}
        onOpenChange={setConsentOpen}
        patientName={patientName}
        doctorName={draft ? draft.doctorName : current?.doctorName}
        defaultProcedure={defaultProcedure}
        hasPhotos={photoCount > 0}
        onSubmit={submitConsent}
      />

      <AlertDialog open={confirmDiscard !== null} onOpenChange={(next) => { if (!next) setConfirmDiscard(null); }}>
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
