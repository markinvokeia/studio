'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { CalendarDays, Camera, CheckCircle2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, CircleAlert, Eye, EyeOff, FileSignature, History, Layers, MapPin, Mars, MousePointerClick, NotebookPen, Pencil, PersonStanding, ScanFace, Stethoscope, UserRound, Venus, X } from 'lucide-react';

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
  AestheticPartialSaveError,
  fetchAestheticSessions,
  fetchServiceAestheticConfigs,
  newAestheticMarkId,
  newLocalId,
  saveAestheticPhotoAlignment,
  signAestheticConsent,
  upsertAestheticSession,
  type AestheticConsentInput,
  type AestheticConsentUpload,
} from '@/services/aesthetic-record';

import type { AestheticBodyFigure, AestheticConsent, AestheticLayer, AestheticMapRegion, AestheticMapView, AestheticMark, AestheticPhotoAlignment, AestheticPhotoKind, AestheticSession, AestheticZoneId, ServiceAestheticConfig } from '@/lib/types';
import { ConsentDialog } from './consent-dialog';
import { ConsentPanel } from './consent-panel';
import { AestheticMap } from './aesthetic-map';
import { formatQuantity, isMarkIncomplete, layerColor, layerTitle, newLayer, placeMarks, unitTotals, type PlacedMark } from './layers';
import { LayersPanel } from './layers-panel';
import { BODY_FIGURES, getViewZoneIds, MAP_REGIONS, MAP_VIEWS, REGION_VIEWS, VIEW_REGION } from './map-templates';
import { MapRail, RailGroup, type RailOption } from './map-rail';
import { DEFAULT_PHOTO_ALIGNMENT, PhotoBackdropAdjust, PhotoBackdropToolbar, type BackdropRef } from './photo-backdrop-controls';
import type { ComparePhoto, PhotoRef } from './photo-compare';
import { PhotosPanel, type PendingPhoto } from './photos-panel';
import { MarkDetailCard } from './mark-detail-card';
import { useAestheticFileUrl } from './use-aesthetic-file-url';
import { VIEW_ICONS } from './view-icons';
import { ZoneHistory } from './zone-history';

type Tab = 'points' | 'photos' | 'consent' | 'zones' | 'notes';

/** Width of the workspace from which the panels dock beside the canvas */
const SIDE_BY_SIDE_MIN_WIDTH = 760;
/** Photos and their comparison go in two columns from this panel width */
const WIDE_PHOTOS_MIN_WIDTH = 640;
/** Tabs whose panel needs more room than a list (photos side by side, the signed consent) */
const WIDE_TABS: Tab[] = ['photos', 'consent'];

interface Draft {
  sessionId?: string;
  date: string;
  title: string;
  doctorId?: string;
  doctorName?: string;
  appointmentId?: string;
  notes: string;
  layers: AestheticLayer[];
  bodyFigure: AestheticBodyFigure;
}

const draftKey = (draft: Draft) => JSON.stringify(draft);

/** Consent signed during the edit, saved together with the session */
interface PendingConsent extends AestheticConsentUpload {
  previewUrl: string;
}

interface PanelTabOption<T extends string> {
  id: T;
  label: string;
  icon: React.ElementType;
  badge?: React.ReactNode;
}

/** Tabs of the docked panel: the open one shows its name, the others only their icon (the name is the tooltip) */
function PanelTabs<T extends string>({ value, options, onChange, ariaLabel, className }: {
  value: T;
  options: PanelTabOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className={cn('flex min-w-0 items-end gap-0.5 overflow-x-auto [scrollbar-width:none]', className)}>
      {options.map(({ id, label, icon: Icon, badge }) => {
        const selected = value === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-label={label}
            title={label}
            onClick={() => onChange(id)}
            className={cn(
              '-mb-px inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-t-md border border-b-0 px-2.5 text-xs font-medium transition-colors',
              selected ? 'border-border bg-card text-foreground' : 'border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground',
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            {selected && <span>{label}</span>}
            {badge}
          </button>
        );
      })}
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

/** Creates, shows and edits one aesthetic session: the map fills the workspace and the session's parts are docked panels beside it */
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

  // The workspace only mounts once the sessions have loaded, so it is tracked as state: a plain ref would
  // be empty when the width observer is set up and the layout would never switch to side by side
  const [bodyEl, setBodyEl] = React.useState<HTMLDivElement | null>(null);
  const bodyRef = React.useMemo(() => ({ current: bodyEl }), [bodyEl]);
  const bodyWidth = usePanelWidth(bodyRef);
  const sideBySide = bodyWidth >= SIDE_BY_SIDE_MIN_WIDTH;
  const [dockEl, setDockEl] = React.useState<HTMLElement | null>(null);
  const dockRef = React.useMemo(() => ({ current: dockEl }), [dockEl]);
  const dockWidth = usePanelWidth(dockRef);
  /** The docked panels folded to a strip of icons, leaving the canvas the whole width */
  const [dockCollapsed, setDockCollapsed] = React.useState(false);

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
  /** Layer the map marks with while editing */
  const [activeLayerId, setActiveLayerId] = React.useState<string | null>(null);
  /** Layers left out of the map to see the others better (view only, not saved) */
  const [hiddenLayerIds, setHiddenLayerIds] = React.useState<Set<string>>(() => new Set());
  const [configs, setConfigs] = React.useState<ServiceAestheticConfig[]>([]);
  const [configsError, setConfigsError] = React.useState<string | null>(null);
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

  // Services that can be marked; only needed to add layers, so a failure doesn't block the sheet
  React.useEffect(() => {
    if (!canRegister) return;
    fetchServiceAestheticConfigs()
      .then(setConfigs)
      .catch((error) => setConfigsError(getErrorMessage(error)));
  }, [canRegister]);

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
  const layers = React.useMemo(() => draft?.layers ?? current?.layers ?? [], [draft, current]);
  const placed = React.useMemo(() => placeMarks(layers), [layers]);
  const visiblePlaced = React.useMemo(() => (hiddenLayerIds.size ? placed.filter((p) => !hiddenLayerIds.has(p.layer.id)) : placed), [placed, hiddenLayerIds]);
  const marks = React.useMemo(() => placed.map((p) => p.mark), [placed]);
  // Body marks are placed on a figure: it stays fixed once the session has any
  const figure = draft?.bodyFigure ?? current?.bodyFigure ?? figureFrom(sessions);
  const canChangeFigure = isEditing && !marks.some((m) => VIEW_REGION[m.view] === 'body');
  const selectedPlaced = placed.find((p) => p.mark.id === selectedPointId) ?? null;
  const selectedPoint = selectedPlaced?.mark ?? null;
  const activeLayerIndex = isEditing ? layers.findIndex((l) => l.id === activeLayerId) : -1;
  const activeLayer = activeLayerIndex >= 0 ? layers[activeLayerIndex] : null;
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
    setActiveLayerId(next.layers[next.layers.length - 1]?.id ?? null);
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
      layers: [],
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
      layers: session.layers,
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

  const updateLayers = (update: (layers: AestheticLayer[]) => AestheticLayer[]) =>
    setDraft((d) => (d ? { ...d, layers: update(d.layers) } : d));

  function updatePoint(id: string, patch: Partial<AestheticMark>) {
    updateLayers((list) => list.map((layer) => (
      layer.marks.some((m) => m.id === id) ? { ...layer, marks: layer.marks.map((m) => (m.id === id ? { ...m, ...patch } : m)) } : layer
    )));
  }

  function toggleLayerVisibility(id: string) {
    setHiddenLayerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** A layer being marked with, or whose mark is picked, can't stay hidden */
  function showLayer(id: string) {
    setHiddenLayerIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function activateLayer(id: string) {
    setActiveLayerId(id);
    showLayer(id);
  }

  function updateLayer(id: string, patch: Partial<AestheticLayer>) {
    updateLayers((list) => list.map((layer) => (layer.id === id ? { ...layer, ...patch } : layer)));
  }

  function addLayer(config: ServiceAestheticConfig) {
    const layer = newLayer(config);
    updateLayers((list) => [...list, layer]);
    setActiveLayerId(layer.id);
    setSelectedPointId(null);
  }

  function removeLayer(id: string) {
    const removed = layers.find((l) => l.id === id);
    updateLayers((list) => list.filter((l) => l.id !== id));
    if (removed?.marks.some((m) => m.id === selectedPointId)) setSelectedPointId(null);
    if (activeLayerId === id) setActiveLayerId(layers.find((l) => l.id !== id)?.id ?? null);
  }

  /** A new mark starts with the quantity of the layer's last one, else the service's default */
  function addMark(mark: Omit<AestheticMark, 'id' | 'quantity'>) {
    if (!activeLayer) return;
    const config = configs.find((c) => c.serviceId === activeLayer.serviceId);
    const quantity = activeLayer.marks[activeLayer.marks.length - 1]?.quantity ?? config?.defaultQuantity ?? null;
    const created: AestheticMark = { id: newAestheticMarkId(), quantity, ...mark };
    showLayer(activeLayer.id);
    updateLayers((list) => list.map((layer) => (layer.id === activeLayer.id ? { ...layer, marks: [...layer.marks, created] } : layer)));
    setSelectedPointId(created.id);
    setTab('points');
  }

  const addPoint = (x: number, y: number, zone: AestheticZoneId | null) => addMark({ kind: 'point', view, x, y, zone });
  const addArea = (polygon: [number, number][], x: number, y: number, zone: AestheticZoneId | null) => addMark({ kind: 'area', view, x, y, polygon, zone });
  const addLine = (ends: [number, number][], x: number, y: number, zone: AestheticZoneId | null) => addMark({ kind: 'line', view, x, y, polygon: ends, zone });

  function deletePoint(id: string) {
    updateLayers((list) => list.map((layer) => ({ ...layer, marks: layer.marks.filter((m) => m.id !== id) })));
    setSelectedPointId((s) => (s === id ? null : s));
  }

  function addPhotos(files: File[], kind: AestheticPhotoKind, photoView: AestheticMapView) {
    // The first photos show up behind the map by themselves, ready to place the points on them
    if (!backdropTouchedRef.current) setBackdropEnabled(true);
    setPendingPhotos((prev) => [
      ...prev,
      ...files.map((file) => ({ key: newLocalId('photo'), file, kind, view: photoView, previewUrl: URL.createObjectURL(file) })),
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
          layers: draft.layers,
          bodyFigure: draft.bodyFigure,
        },
        pendingPhotos.map(({ key, file, kind, view: photoView, alignment }) => ({ key, file, kind, view: photoView, alignment })),
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
      onError: (error) => {
        if (error instanceof AestheticPartialSaveError) keepWhatWasSaved(error);
        else setSaveError(getErrorMessage(error));
      },
      showErrorToast: false,
    },
  );

  /**
   * The session got stored but a photo, a removal or the consent did not: keep editing the stored
   * session with only what is left, so saving again finishes the job instead of creating it twice.
   */
  function keepWhatWasSaved(error: AestheticPartialSaveError) {
    setDraft((d) => (d ? { ...d, sessionId: error.sessionId } : d));
    setPendingPhotos((prev) => {
      prev.filter((p) => error.uploadedPhotoKeys.includes(p.key)).forEach((p) => URL.revokeObjectURL(p.previewUrl));
      return prev.filter((p) => !error.uploadedPhotoKeys.includes(p.key));
    });
    setRemovedPhotoIds((prev) => prev.filter((id) => !error.removedPhotoIds.includes(id)));
    if (error.consentSaved) removePendingConsent();
    setSaveError(t('session.partialSave', { error: error.message }));
    setShownId(error.sessionId);
    onChanged?.();
    load();
  }

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
    const incompleteMarks = placeMarks(draft.layers).filter((p) => isMarkIncomplete(p.mark));
    if (incompleteMarks.length) {
      const first = incompleteMarks[0];
      setShowValidation(true);
      setSaveError(t('session.incompleteMarks', { count: incompleteMarks.length }));
      setTab('points');
      setView(first.mark.view);
      activateLayer(first.layer.id);
      setSelectedPointId(first.mark.id);
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
    const updated = await signAestheticConsent(patientId, current, input, signature, signedAt);
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
      const owner = sessions.find((s) => s.photos.some((p) => p.id === alignmentEdit.photoId));
      if (!owner) throw new Error(t('sheet.notFound'));
      return saveAestheticPhotoAlignment(owner, alignmentEdit.photoId, alignmentEdit.alignment);
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

  /** Opens the mark's row (switching to its view), or closes it when already open */
  function selectFromList({ mark, layer }: PlacedMark) {
    if (selectedPointId === mark.id) {
      setSelectedPointId(null);
      return;
    }
    setView(mark.view);
    setSelectedPointId(mark.id);
    showLayer(layer.id);
    if (isEditing) setActiveLayerId(layer.id);
  }

  /** A mark picked on the map opens its row in the layers tab (and marks with its layer from then on) */
  function selectFromMap(id: string | null) {
    setSelectedPointId(id);
    if (!id) return;
    setTab('points');
    const owner = placed.find((p) => p.mark.id === id);
    if (owner && isEditing) setActiveLayerId(owner.layer.id);
  }

  /** Shows a zone picked in the history: switches to the first view that draws it */
  function showZone(zone: AestheticZoneId | null) {
    setPinnedZone(zone);
    if (!zone || getViewZoneIds(view).includes(zone)) return;
    const target = MAP_VIEWS.find((v) => getViewZoneIds(v).includes(zone));
    if (target) setView(target);
  }

  const defaultProcedure = React.useMemo(() => [...new Set(layers.map(layerTitle).filter(Boolean))].join(', '), [layers]);

  // ── Render ──
  const headerTitle = isEditing ? (draft.sessionId ? draft.title || t('sheet.editTitle') : t('sheet.newTitle')) : current?.title ?? t('sheet.title');
  const totals = unitTotals(layers);
  const dateInvalid = showValidation && !draft?.date;
  const chip = 'inline-flex h-7 min-w-0 shrink-0 items-center gap-1.5 rounded-md border bg-background px-2 text-xs text-muted-foreground transition-colors';
  /** Opens a panel, unfolding the dock when it is folded */
  const openTab = (next: Tab) => {
    setTab(next);
    setDockCollapsed(false);
  };

  const header = (
    <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-2.5 pr-24">
      {/* What the session holds; each one opens its panel */}
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <button type="button" onClick={() => openTab('points')} title={t('tabs.layers')} className={cn(chip, 'hover:bg-muted hover:text-foreground', tab === 'points' && 'border-foreground/25 text-foreground')}>
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          {t('layers.marks', { count: marks.length })}
          {totals.map(({ unit, quantity }) => (
            <span key={unit} className="font-semibold tabular-nums text-foreground">· {formatQuantity(quantity)} {unit}</span>
          ))}
        </button>
        <button type="button" onClick={() => openTab('photos')} title={t('tabs.photos')} className={cn(chip, 'hover:bg-muted hover:text-foreground', tab === 'photos' && 'border-foreground/25 text-foreground')}>
          <Camera className="h-3.5 w-3.5 shrink-0" />
          {t('sheet.photoCount', { count: photoCount })}
        </button>
        <button
          type="button"
          onClick={() => openTab('consent')}
          title={t('tabs.consent')}
          className={cn(
            chip,
            effectiveConsent ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-400' : 'border-amber-500/30 bg-amber-500/10 text-amber-700 hover:bg-amber-500/15 dark:text-amber-400',
            'font-medium',
          )}
        >
          {effectiveConsent ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : <CircleAlert className="h-3.5 w-3.5 shrink-0" />}
          {effectiveConsent ? t('consent.signedBadge') : t('consent.missingBadge')}
        </button>
        {patientName && (
          <span className={chip} title={t('sheet.patient')}>
            <UserRound className="h-3.5 w-3.5 shrink-0" />
            <span className="max-w-[12rem] truncate text-foreground">{patientName}</span>
          </span>
        )}
      </div>

      {/* The session itself: date, professional and title */}
      <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
        {isEditing ? (
          <>
            <SheetTitle className="sr-only">{headerTitle}</SheetTitle>
            {draft.sessionId && <Badge className="shrink-0">{t('editing')}</Badge>}
            <Input
              id="aes-session-date"
              type="date"
              value={draft.date}
              onChange={(e) => updateDraft({ date: e.target.value })}
              disabled={save.isPending}
              aria-label={t('session.date')}
              title={dateInvalid ? t('session.dateRequired') : t('session.date')}
              aria-invalid={dateInvalid || undefined}
              className={cn('h-8 w-[9.5rem] text-xs', dateInvalid && 'border-destructive focus-visible:ring-destructive')}
            />
            <DoctorSelector
              value={draft.doctorId}
              selectedDoctorName={draft.doctorName}
              onValueChange={(id, doctor) => updateDraft({ doctorId: id || undefined, doctorName: doctor?.name })}
              triggerText={t('session.doctorPick')}
              placeholder={t('session.doctorSearch')}
              emptyText={t('session.doctorEmpty')}
              loadingText={t('session.doctorLoading')}
              disabled={save.isPending}
              className="h-8 w-48 text-xs"
            />
            <Input
              id="aes-session-title"
              value={draft.title}
              onChange={(e) => updateDraft({ title: e.target.value })}
              disabled={save.isPending}
              placeholder={t('session.title')}
              aria-label={t('session.title')}
              className="h-8 w-52 text-xs"
            />
          </>
        ) : current && (
          <>
            <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" />{formatDisplayDate(current.date)}</span>
            {current.doctorName && (
              <span className="inline-flex min-w-0 max-w-[12rem] items-center gap-1 text-xs text-muted-foreground"><Stethoscope className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{current.doctorName}</span></span>
            )}
            <SheetTitle className="min-w-0 max-w-[18rem] truncate text-sm font-semibold">{headerTitle}</SheetTitle>
          </>
        )}
        {current && sessions.length > 1 && (
          <div className="flex shrink-0 items-center">
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
                  className={cn('h-7 w-7', dir === 'next' && 'order-last')}
                  disabled={!target || save.isPending}
                  onClick={() => target && goToSession(target)}
                  aria-label={label}
                  title={label}
                >
                  <Icon className="h-4 w-4" />
                </Button>
              );
            })}
            <span className="min-w-[3rem] text-center text-[11px] tabular-nums text-muted-foreground" aria-live="polite">
              {t('sheet.position', { index: currentIndex + 1, total: sessions.length })}
            </span>
          </div>
        )}
        {!isEditing && current && canRegister && (
          <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={() => startEditing(current)}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            {t('editSession')}
          </Button>
        )}
      </div>
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

  const invalidMarkIds = showValidation ? new Set(marks.filter(isMarkIncomplete).map((m) => m.id)) : undefined;

  const regionIcons: Record<AestheticMapRegion, React.ElementType> = { face: ScanFace, body: PersonStanding };
  const regionOptions: RailOption<AestheticMapRegion>[] = MAP_REGIONS.map((r) => {
    const count = marks.filter((m) => VIEW_REGION[m.view] === r).length;
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

  const canvas = (
    <div className={cn('flex min-w-0', sideBySide ? 'min-h-0 flex-1' : 'h-[min(72dvh,44rem)] min-h-[22rem] shrink-0 border-b')}>
      {/* Tools: region, view, figure and the photo behind the map */}
      <MapRail className="shrink-0 items-center overflow-y-auto border-r bg-card px-1.5 py-2 [scrollbar-width:none]">
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

      <div className="relative flex min-w-0 flex-1 flex-col bg-muted/40">
        {editingAlignment && (
          <div className="shrink-0 border-b bg-card p-2">
            <PhotoBackdropAdjust
              alignment={editingAlignment}
              onChange={(alignment) => setAlignmentEdit((prev) => (prev ? { ...prev, alignment } : prev))}
              onCancel={() => setAlignmentEdit(null)}
              onSave={() => saveAlignment.run()}
              isSaving={saveAlignment.isPending}
              resetTo={backdropFit}
            />
          </div>
        )}
        <div className="relative flex min-h-0 flex-1 flex-col">
          {/* Legend (one entry per service) floats over the top-right corner; a click shows or hides that layer's marks */}
          {layers.length > 0 && tab !== 'zones' && (
            <div className="absolute right-2 top-2 z-10 flex max-w-[40%] flex-col items-stretch gap-0.5 rounded-lg border bg-card/85 p-1 text-[11px] text-muted-foreground shadow-sm backdrop-blur-sm">
              {layers.map((layer, index) => {
                const hidden = hiddenLayerIds.has(layer.id);
                const name = layerTitle(layer);
                return (
                  <button
                    key={layer.id}
                    type="button"
                    onClick={() => toggleLayerVisibility(layer.id)}
                    aria-pressed={!hidden}
                    title={hidden ? t('layers.show', { name }) : t('layers.hide', { name })}
                    className={cn(
                      'inline-flex min-w-0 items-center gap-1.5 rounded px-1 py-0.5 text-left transition-colors hover:bg-muted/60',
                      layer.id === activeLayer?.id && 'font-semibold text-foreground',
                      hidden && 'text-muted-foreground/60 line-through',
                    )}
                  >
                    <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white dark:ring-card', hidden && 'opacity-30')} style={{ backgroundColor: layerColor(layer, index) }} />
                    <span className="min-w-0 flex-1 truncate">{name}</span>
                    {hidden ? <EyeOff className="h-3 w-3 shrink-0" aria-hidden /> : <Eye className="h-3 w-3 shrink-0 opacity-50" aria-hidden />}
                  </button>
                );
              })}
              {layers.some((l) => hiddenLayerIds.has(l.id)) && (
                <button type="button" onClick={() => setHiddenLayerIds(new Set())} className="rounded px-1 py-0.5 text-left font-medium text-foreground underline-offset-2 hover:underline">
                  {t('layers.showAll')}
                </button>
              )}
            </div>
          )}
          <AestheticMap
            fill
            view={view}
            figure={figure}
            marks={tab === 'zones' ? [] : visiblePlaced}
            selectedMarkId={selectedPointId}
            readOnly={!isEditing || tab === 'zones'}
            invalidMarkIds={invalidMarkIds}
            highlightZones={tab === 'zones' ? (zoneHighlight ? [zoneHighlight] : []) : selectedPoint?.zone ? [selectedPoint.zone] : []}
            tool={activeLayer?.markingTool}
            toolColor={activeLayer ? layerColor(activeLayer, activeLayerIndex) : undefined}
            onAddPoint={isEditing && activeLayer ? addPoint : undefined}
            onAddArea={isEditing && activeLayer ? addArea : undefined}
            onAddLine={isEditing && activeLayer ? addLine : undefined}
            onMoveMark={isEditing ? (id, position, zone) => updatePoint(id, { ...position, zone }) : undefined}
            onSelectMark={selectFromMap}
            onDeleteMark={isEditing ? deletePoint : undefined}
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
            className="min-h-0 flex-1 p-3 pb-1"
          />
        </div>
        {/* Status bar: what a click does now, and the artwork's credits */}
        {((isEditing && tab !== 'zones') || region === 'body') && (
          <div className="flex shrink-0 items-center gap-3 border-t bg-card px-3 py-1 text-[11px] leading-snug text-muted-foreground">
            {isEditing && tab !== 'zones' && (
              <p className="flex min-w-0 flex-1 items-start gap-1.5">
                <MousePointerClick className="mt-px h-3.5 w-3.5 shrink-0" />
                {!activeLayer
                  ? t('map.hintNoLayer')
                  : t(activeLayer.markingTool === 'area' ? 'map.hintArea' : activeLayer.markingTool === 'line' ? 'map.hintLine' : 'map.hintPoint', { service: layerTitle(activeLayer) })}
              </p>
            )}
            {region === 'body' && <p className="ml-auto shrink-0 text-[10px] text-muted-foreground/70">{t('credits')}</p>}
          </div>
        )}
      </div>
    </div>
  );

  const tabs: { id: Tab; label: string; icon: React.ElementType; badge?: React.ReactNode }[] = [
    { id: 'points', label: t('tabs.layers'), icon: Layers, badge: layers.length ? <TabCount count={layers.length} /> : undefined },
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

  const tabContent = (
    <div className="flex min-w-0 flex-1 flex-col gap-3">
      {saveError && <Alert variant="destructive"><AlertDescription>{saveError}</AlertDescription></Alert>}
      {tab === 'points' && (
          // Docked, the selected mark's properties are a sub-panel under the list; stacked, they open under its row
          <LayersPanel
            layers={layers}
            placed={placed}
            configs={configs}
            configsError={configsError}
            activeLayerId={activeLayer?.id ?? null}
            selectedMarkId={selectedPointId}
            hiddenLayerIds={hiddenLayerIds}
            onToggleLayerVisibility={toggleLayerVisibility}
            isEditing={isEditing}
            showErrors={showValidation}
            onAddLayer={addLayer}
            onRemoveLayer={removeLayer}
            onActivateLayer={(id) => { activateLayer(id); setSelectedPointId(null); }}
            onChangeLayer={updateLayer}
            onChangeMark={updatePoint}
            onSelectMark={selectFromList}
            renderDetail={sideBySide ? undefined : (p) => (
              <MarkDetailCard
                placed={p}
                readOnly={!isEditing}
                showErrors={showValidation}
                onChange={(patch) => updatePoint(p.mark.id, patch)}
                onDelete={() => deletePoint(p.mark.id)}
                embedded
              />
            )}
          />
      )}

      {tab === 'photos' && (
        <PhotosPanel
          photos={shownPhotos}
          wide={(sideBySide ? dockWidth : bodyWidth) >= WIDE_PHOTOS_MIN_WIDTH}
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

  const footer = (
    <div className="flex shrink-0 items-center justify-end gap-2 border-t px-4 py-2">
      {isEditing ? (
        <>
          <Button type="button" size="sm" variant="outline" onClick={cancelEditing} disabled={save.isPending}>{t('cancel')}</Button>
          <Button type="button" size="sm" onClick={handleSave} loading={save.isPending}>{t('save')}</Button>
        </>
      ) : (
        <Button type="button" size="sm" variant="outline" onClick={close}>{t('sheet.close')}</Button>
      )}
    </div>
  );

  const properties = tab === 'points' && selectedPlaced && (
    <section aria-label={t('panels.properties')} className="flex max-h-[55%] shrink-0 flex-col border-t">
      <div className="flex h-8 shrink-0 items-center justify-between gap-2 border-b bg-muted/40 pl-3 pr-1">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t('panels.properties')}</h3>
        <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => setSelectedPointId(null)} aria-label={t('panels.closeProperties')} title={t('panels.closeProperties')}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="min-h-0 overflow-y-auto [scrollbar-gutter:stable]">
        <MarkDetailCard
          key={selectedPlaced.mark.id}
          placed={selectedPlaced}
          readOnly={!isEditing}
          showErrors={showValidation}
          onChange={(patch) => updatePoint(selectedPlaced.mark.id, patch)}
          onDelete={() => deletePoint(selectedPlaced.mark.id)}
          panel
        />
      </div>
    </section>
  );

  // Docked beside the canvas, like an editor's panels: tabs on top, the open panel scrolling on its own,
  // the mark's properties under it. Folded, only the tabs' icons stay.
  const dock = dockCollapsed ? (
    <aside className="flex w-11 shrink-0 flex-col items-center gap-1 border-l bg-card py-2" aria-label={t('tabs.label')}>
      <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" onClick={() => setDockCollapsed(false)} aria-label={t('panels.expand')} title={t('panels.expand')}>
        <ChevronsLeft className="h-4 w-4" />
      </Button>
      <div className="my-1 h-px w-6 bg-border" />
      {tabs.map(({ id, label, icon: Icon }) => (
        <Button key={id} type="button" size="icon" variant="ghost" className={cn('h-8 w-8', tab === id ? 'bg-muted text-foreground' : 'text-muted-foreground')} onClick={() => openTab(id)} aria-label={label} title={label}>
          <Icon className="h-4 w-4" />
        </Button>
      ))}
    </aside>
  ) : (
    <aside
      ref={setDockEl}
      className={cn('flex min-h-0 shrink-0 flex-col border-l bg-card transition-[width] duration-200', WIDE_TABS.includes(tab) ? 'w-[clamp(22rem,46%,40rem)]' : 'w-[clamp(18rem,32%,25rem)]')}
    >
      <div className="flex shrink-0 items-end gap-1 border-b bg-muted/40 pl-1.5 pr-1 pt-1">
        <PanelTabs value={tab} options={tabs} onChange={setTab} ariaLabel={t('tabs.label')} className="flex-1" />
        <Button type="button" size="icon" variant="ghost" className="mb-0.5 h-7 w-7 shrink-0 text-muted-foreground" onClick={() => setDockCollapsed(true)} aria-label={t('panels.collapse')} title={t('panels.collapse')}>
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-clip p-3 [scrollbar-gutter:stable]">{tabContent}</div>
      {properties}
    </aside>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      {header}
      <div ref={setBodyEl} className={cn('flex min-h-0 flex-1', sideBySide ? 'flex-row' : 'flex-col overflow-y-auto')}>
        {canvas}
        {sideBySide ? dock : (
          <div className="flex flex-col">
            <div className="sticky top-0 z-20 shrink-0 border-b bg-muted/40 px-1.5 pt-1">
              <PanelTabs value={tab} options={tabs} onChange={setTab} ariaLabel={t('tabs.label')} />
            </div>
            <div className="p-3">{tabContent}</div>
          </div>
        )}
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
