'use client';

import React from 'react';
import { subMonths } from 'date-fns';
import { useLocale, useTranslations } from 'next-intl';
import { Camera, Crosshair, Eye, EyeOff, History, ImageIcon, Lock, MapPin, Mic, Minus, MousePointer2, PersonStanding, Redo2, ScanFace, ScanLine, Shapes, Undo2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { useAsyncAction } from '@/hooks/use-async-action';
import { usePanelWidth } from '@/hooks/use-panel-width';
import { useToast } from '@/hooks/use-toast';
import { cn, formatDisplayDate, formatUtcDateTime, toLocalISOString } from '@/lib/utils';
import { addAestheticNote, newAestheticMarkId, saveAestheticPhotoAlignment } from '@/services/aesthetic-record';

import type { AestheticBodyFigure, AestheticLayer, AestheticMapRegion, AestheticMapView, AestheticMark, AestheticMarkKind, AestheticPhotoAlignment, AestheticZoneId } from '@/lib/types';
import { AestheticMap } from './aesthetic-map';
import { FACE_TONE_PALETTES, FACE_TONES, FaceIllustration } from './face-models/face-illustration';
import { Hint } from './hint';
import { formatQuantity, layerColor, layerQuantity, mirrorMark, placeMarks } from './layers';
import { getViewZoneIds, isFaceView, REGION_VIEWS, VIEW_REGION } from './map-templates';
import { MarkEditor } from './mark-editor';
import { PhotoAlignDialog } from './photo-align-dialog';
import { sessionPhotoOf, type PhotoView } from './photo-utils';
import { useSessionFlow } from './session-flow-context';
import { isServiceSigned } from './session-status';
import { useAestheticFileUrl } from './use-aesthetic-file-url';
import { useZoneLabel } from './use-zone-label';
import { buildZoneRows } from './zone-history';

type Tool = 'select' | AestheticMarkKind;
type PanelTab = 'summary' | 'notes' | 'history';
const TOOLS: { id: Tool; icon: React.ElementType; key: string }[] = [
  { id: 'select', icon: MousePointer2, key: 'v' },
  { id: 'point', icon: MapPin, key: 'p' },
  { id: 'area', icon: Shapes, key: 'a' },
  { id: 'line', icon: Minus, key: 'l' },
];
const QUICK_NOTES = ['topicalAnesthesia', 'ice', 'noIncidents', 'mildBruise', 'toleratesWell'] as const;
/** Below this width the panel goes under the canvas */
const STACK_WIDTH = 820;

const isTyping = (target: EventTarget | null) => target instanceof HTMLElement && !!target.closest('input, textarea, select, [contenteditable], [role="combobox"]');

export function StepTreatment() {
  const t = useTranslations('AestheticRecord');
  const { toast } = useToast();
  const flow = useSessionFlow();
  const { draft, setLayers, stored, readOnly, previousSessions, configFor, modelSex, setModelSex, modelTone, setModelTone, updateDraft, undo, redo, canUndo, canRedo, goToStep, updateSession, reportError } = flow;
  const layers = draft.layers;
  const consents = stored?.consents ?? [];

  const containerRef = React.useRef<HTMLDivElement>(null);
  const stacked = usePanelWidth(containerRef) < STACK_WIDTH;

  const [view, setView] = React.useState<AestheticMapView>('front');
  const region = VIEW_REGION[view];
  const [tool, setTool] = React.useState<Tool>(() => layers.find((l) => isServiceSigned(consents, l.serviceId))?.markingTool ?? 'point');
  const [activeLayerId, setActiveLayerId] = React.useState<string | null>(() => layers.find((l) => isServiceSigned(consents, l.serviceId))?.id ?? layers[0]?.id ?? null);
  const [hidden, setHidden] = React.useState<Set<string>>(() => new Set());
  // Today's photo is the background as soon as there is one: marking goes on the patient's own face
  const [background, setBackground] = React.useState<'model' | 'photo'>(() => (stored?.photos.length ? 'photo' : 'model'));
  const [photoOpacity, setPhotoOpacity] = React.useState(1);
  const [aligning, setAligning] = React.useState(false);
  const [showZones, setShowZones] = React.useState(false);
  const [showGhost, setShowGhost] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  /** The selected mark's panel is open beside it (a tap on a mark opens it; placing a new one doesn't) */
  const [editorOpen, setEditorOpen] = React.useState(false);
  const stageRef = React.useRef<HTMLDivElement>(null);
  const [zoneFocus, setZoneFocus] = React.useState<AestheticZoneId | null>(null);
  const [tab, setTab] = React.useState<PanelTab>('summary');

  const placed = React.useMemo(() => placeMarks(layers), [layers]);
  const visible = React.useMemo(() => placed.filter((p) => !hidden.has(p.layer.id)), [placed, hidden]);
  const selected = placed.find((p) => p.mark.id === selectedId) ?? null;
  const activeLayer = layers.find((l) => l.id === activeLayerId) ?? null;
  const activeIndex = activeLayer ? layers.indexOf(activeLayer) : -1;
  const activeSigned = !!activeLayer && isServiceSigned(consents, activeLayer.serviceId);
  const canMark = !readOnly && activeSigned && tool !== 'select';

  // Photo of today behind the map (face views only)
  const todayPhoto = isFaceView(view) && stored ? sessionPhotoOf(stored, view) : null;
  const photoUrl = useAestheticFileUrl(background === 'photo' && todayPhoto ? todayPhoto.id : undefined);
  const showPhoto = background === 'photo' && !!todayPhoto && !!photoUrl;
  /** The photo background is picked but this view has no photo of today */
  const photoMissing = background === 'photo' && isFaceView(view) && !todayPhoto;

  async function saveAlignment(alignment: AestheticPhotoAlignment | null) {
    if (!stored || !todayPhoto) return;
    try {
      await saveAestheticPhotoAlignment(stored, todayPhoto.id, alignment);
      updateSession(stored.id, (s) => ({ ...s, photos: s.photos.map((p) => (p.id === todayPhoto.id ? { ...p, alignment: alignment ?? undefined } : p)) }));
      toast({ title: t('toast.alignmentSaved') });
    } catch (error) {
      toast({ variant: 'destructive', title: t('map.backdrop.saveError'), description: reportError(error) });
      throw error;
    }
  }

  // The previous session's marks of the services of today, dashed
  const previous = previousSessions[previousSessions.length - 1] ?? null;
  const ghostMarks = React.useMemo(() => {
    if (!showGhost || !previous) return undefined;
    const serviceIds = new Set(layers.map((l) => l.serviceId));
    return placeMarks(previous.layers).filter((p) => serviceIds.has(p.layer.serviceId));
  }, [showGhost, previous, layers]);

  // ── Changes ──
  function updateMark(id: string, patch: Partial<AestheticMark>, options?: { skipHistory?: boolean }) {
    setLayers((list) => list.map((layer) => (
      layer.marks.some((m) => m.id === id) ? { ...layer, marks: layer.marks.map((m) => (m.id === id ? { ...m, ...patch } : m)) } : layer
    )), options);
  }

  function deleteMark(id: string) {
    setLayers((list) => list.map((layer) => ({ ...layer, marks: layer.marks.filter((m) => m.id !== id) })));
    setSelectedId((s) => (s === id ? null : s));
  }

  function addMark(mark: Omit<AestheticMark, 'id' | 'quantity' | 'createdAt'>) {
    if (!activeLayer || !activeSigned) return;
    const config = configFor(activeLayer);
    const created: AestheticMark = {
      id: newAestheticMarkId(),
      quantity: config?.defaultQuantity ?? activeLayer.marks[activeLayer.marks.length - 1]?.quantity ?? null,
      createdAt: toLocalISOString(new Date()),
      ...mark,
    };
    setLayers((list) => list.map((l) => (l.id === activeLayer.id ? { ...l, marks: [...l.marks, created] } : l)));
    setHidden((h) => { if (!h.has(activeLayer.id)) return h; const n = new Set(h); n.delete(activeLayer.id); return n; });
    setSelectedId(created.id);
    // A point takes one tap: the panel waits until the mark itself is tapped
    setEditorOpen(false);
  }

  function mirrorSelected() {
    if (!selected) return;
    const copy = mirrorMark(selected.mark);
    setLayers((list) => list.map((l) => (l.id === selected.layer.id ? { ...l, marks: [...l.marks, copy] } : l)));
    setSelectedId(copy.id);
    if (copy.view !== view) setView(copy.view);
  }

  function pickLayer(layer: AestheticLayer) {
    if (!isServiceSigned(consents, layer.serviceId)) {
      toast({ title: t('flow.treatment.unsignedToast', { service: layer.serviceName }) });
      return;
    }
    setActiveLayerId(layer.id);
    setTool(layer.markingTool);
    setSelectedId(null);
  }

  function selectMark(id: string | null) {
    setSelectedId(id);
    setEditorOpen(!!id);
    if (!id) return;
    const owner = placed.find((p) => p.mark.id === id);
    if (owner) {
      if (owner.mark.view !== view) setView(owner.mark.view);
      if (isServiceSigned(consents, owner.layer.serviceId)) setActiveLayerId(owner.layer.id);
      setHidden((h) => { if (!h.has(owner.layer.id)) return h; const n = new Set(h); n.delete(owner.layer.id); return n; });
    }
  }

  // Escape closes the mark's panel before it can close the sheet
  React.useEffect(() => {
    if (!editorOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.querySelector('[role="listbox"]')) return;
      e.preventDefault();
      e.stopPropagation();
      setEditorOpen(false);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [editorOpen]);

  function focusZone(zone: AestheticZoneId | null) {
    setZoneFocus(zone);
    setTab('history');
  }

  // ── Shortcuts: V P A L, Delete, Ctrl+Z / Ctrl+Shift+Z ──
  const shortcutsRef = React.useRef({ undo, redo, deleteMark, selectedId, readOnly });
  React.useEffect(() => { shortcutsRef.current = { undo, redo, deleteMark, selectedId, readOnly }; });
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const s = shortcutsRef.current;
      if (s.readOnly || isTyping(e.target) || document.querySelector('[role="dialog"][data-state="open"] [role="dialog"]')) return;
      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && (key === 'z' || key === 'y')) {
        e.preventDefault();
        if (key === 'y' || e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && s.selectedId) {
        e.preventDefault();
        s.deleteMark(s.selectedId);
        return;
      }
      const picked = TOOLS.find((x) => x.key === key);
      if (picked) setTool(picked.id);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const hint = readOnly
    ? t('flow.treatment.readOnlyHint')
    : !activeLayer
      ? t('flow.treatment.noServices')
      : !activeSigned
        ? t('flow.treatment.unsignedHint', { service: activeLayer.serviceName })
        : tool === 'select'
          ? t('flow.treatment.hintSelect')
          : t(`flow.treatment.hint.${tool}`, { service: activeLayer.serviceName, quantity: formatQuantity(configFor(activeLayer)?.defaultQuantity ?? 0), unit: activeLayer.unitSymbol });

  const floating = 'absolute z-10 rounded-2xl border bg-card/95 shadow-lg backdrop-blur-sm';
  const segment = (on: boolean) => cn('h-8 whitespace-nowrap rounded-lg px-2.5 text-xs font-medium transition-colors disabled:opacity-40', on ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground');
  const faceViews = REGION_VIEWS.face;
  const bodyViews = REGION_VIEWS.body;

  const editor = selected && editorOpen && (
    <MarkEditor
      key={selected.mark.id}
      placed={selected}
      config={configFor(selected.layer)}
      sessionDate={draft.date}
      previousSessions={previousSessions}
      readOnly={readOnly}
      onChange={(patch, options) => updateMark(selected.mark.id, patch, options)}
      onDelete={() => deleteMark(selected.mark.id)}
      onMirror={mirrorSelected}
      onZoneHistory={() => focusZone(selected.mark.zone)}
      onClose={() => setEditorOpen(false)}
      floating={!stacked}
    />
  );

  const stage = (
    <div ref={stageRef} className={cn('relative min-w-0 overflow-hidden bg-muted/50 [background-image:radial-gradient(hsl(var(--border))_1px,transparent_1.2px)] [background-size:22px_22px]', stacked ? 'h-[68vh] shrink-0' : 'flex-1')}>
      <AestheticMap
        fill
        view={view}
        figure={draft.bodyFigure}
        marks={visible}
        selectedMarkId={selectedId}
        readOnly={readOnly}
        tool={tool === 'select' ? 'point' : tool}
        toolColor={activeLayer ? layerColor(activeLayer, activeIndex) : undefined}
        onAddPoint={canMark && tool === 'point' ? (x, y, zone) => addMark({ kind: 'point', view, x, y, zone }) : undefined}
        onAddArea={canMark && tool === 'area' ? (polygon, x, y, zone) => addMark({ kind: 'area', view, x, y, polygon, zone }) : undefined}
        onAddLine={canMark && tool === 'line' ? (ends, x, y, zone) => addMark({ kind: 'line', view, x, y, polygon: ends, zone }) : undefined}
        onMoveMark={readOnly ? undefined : (id, position, zone) => updateMark(id, { ...position, zone })}
        onSelectMark={selectMark}
        onDeleteMark={readOnly ? undefined : deleteMark}
        onZoneClick={(zone) => focusZone(zone)}
        highlightZones={zoneFocus ? [zoneFocus] : selected?.mark.zone ? [selected.mark.zone] : []}
        zoneOutlines={showZones || tool === 'area'}
        zoneLabels={showZones && isFaceView(view)}
        ghostMarks={ghostMarks}
        illustration={isFaceView(view) && !showPhoto ? <FaceIllustration view={view} sex={modelSex} tone={modelTone} /> : undefined}
        backdrop={showPhoto && todayPhoto && photoUrl ? { photoId: todayPhoto.id, url: photoUrl, alignment: todayPhoto.alignment ?? null, opacity: photoOpacity, hideArt: true } : null}
        className="h-full px-16 pb-24 pt-16"
      />

      {/* View, background and skin tone */}
      <div className={cn(floating, 'left-1/2 top-3 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-1.5 p-1.5')}>
        <div role="group" aria-label={t('map.regionsLabel')} className="flex gap-0.5">
          {([['face', ScanFace], ['body', PersonStanding]] as [AestheticMapRegion, React.ElementType][]).map(([r, Icon]) => (
            <Hint key={r} label={t(`regions.${r}`)} description={t(`flow.hints.region.${r}`)}>
              <button type="button" className={segment(region === r)} onClick={() => setView(REGION_VIEWS[r][0])} aria-pressed={region === r} aria-label={t(`regions.${r}`)}>
                <Icon className="h-4 w-4" />
              </button>
            </Hint>
          ))}
        </div>
        <span className="h-5 w-px bg-border" aria-hidden />
        <div role="group" aria-label={t('map.viewsLabel')} className="flex gap-0.5">
          {(region === 'face' ? faceViews : bodyViews).map((v) => (
            <Hint key={v} label={t(`views.${v}`)} description={t('flow.hints.view', { count: placed.filter((p) => p.mark.view === v).length })}>
              <button type="button" className={segment(view === v)} onClick={() => { setView(v); setSelectedId(null); }} aria-pressed={view === v}>
                {t(`viewsShort.${v}`)}
              </button>
            </Hint>
          ))}
        </div>
        <span className="h-5 w-px bg-border" aria-hidden />
        <div role="group" aria-label={t('flow.treatment.background')} className="flex gap-0.5">
          {(['female', 'male'] as AestheticBodyFigure[]).map((sex) => {
            const lockedFigure = region === 'body' && placed.some((p) => VIEW_REGION[p.mark.view] === 'body') && draft.bodyFigure !== sex;
            const on = background === 'model' && (region === 'face' ? modelSex === sex : draft.bodyFigure === sex);
            return (
              <Hint
                key={sex}
                label={t(`flow.hints.model.${region}.${sex}`)}
                description={lockedFigure ? t('map.figureLocked') : t(`flow.hints.model.${region}.description`)}
              >
                <button
                  type="button"
                  className={segment(on)}
                  disabled={lockedFigure || (region === 'body' && readOnly)}
                  onClick={() => {
                    setBackground('model');
                    if (region === 'face') setModelSex(sex);
                    else updateDraft({ bodyFigure: sex });
                  }}
                >
                  {t(`flow.treatment.model.${sex}`)}
                </button>
              </Hint>
            );
          })}
          {region === 'face' && (
            <Hint label={t('flow.treatment.todayPhoto')} description={todayPhoto ? t('flow.hints.todayPhoto') : t('flow.hints.todayPhotoMissing')}>
              <button
                type="button"
                className={cn(segment(background === 'photo'), 'inline-flex items-center gap-1.5', background === 'photo' && 'bg-violet-600 text-white hover:text-white')}
                onClick={() => setBackground('photo')}
                aria-pressed={background === 'photo'}
              >
                <ImageIcon className="h-3.5 w-3.5" />
                {t('flow.treatment.todayPhoto')}
              </button>
            </Hint>
          )}
        </div>
        {region === 'face' && background === 'model' && (
          <>
            <span className="hidden h-5 w-px bg-border sm:block" aria-hidden />
            <div role="group" aria-label={t('flow.treatment.skinTone')} className="hidden gap-0.5 sm:flex">
              {FACE_TONES.map((tone) => (
                <Hint key={tone} label={t(`flow.treatment.tones.${tone}`)} description={t('flow.hints.tone')}>
                  <button type="button" className={segment(modelTone === tone)} onClick={() => setModelTone(tone)} aria-pressed={modelTone === tone} aria-label={t(`flow.treatment.tones.${tone}`)}>
                    <span className="block h-3 w-3 rounded-full border border-border" style={{ backgroundColor: FACE_TONE_PALETTES[tone].base }} />
                  </button>
                </Hint>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Today's photo as background: how see-through it is and its alignment with the template */}
      {region === 'face' && background === 'photo' && (
        <div className={cn(floating, 'right-3 top-16 flex w-56 flex-col gap-2 p-3', stacked && 'top-[7.5rem]')}>
          <p className="flex items-center gap-1.5 text-xs font-semibold"><ImageIcon className="h-3.5 w-3.5" />{t('flow.treatment.photoBackground', { view: t(`viewsShort.${view}`) })}</p>
          {photoMissing ? (
            <>
              <p className="text-xs text-muted-foreground">{t('flow.treatment.noPhotoOfView')}</p>
              {!readOnly && (
                <Hint label={t('flow.treatment.goTakePhoto')} description={t('flow.hints.goTakePhoto')} side="left">
                  <Button type="button" size="sm" variant="outline" className="h-8 w-full text-xs" onClick={() => goToStep(2)}>
                    <Camera className="mr-1 h-3.5 w-3.5" />{t('flow.treatment.goTakePhoto')}
                  </Button>
                </Hint>
              )}
            </>
          ) : (
            <>
              <Hint label={t('flow.treatment.photoOpacity')} description={t('flow.hints.photoOpacity')} side="left">
                <label className="flex w-full items-center gap-2 text-[11px] text-muted-foreground">
                  {t('flow.treatment.photoOpacity')}
                  <input type="range" min={20} max={100} value={Math.round(photoOpacity * 100)} onChange={(e) => setPhotoOpacity(Number(e.target.value) / 100)} className="min-w-0 flex-1 accent-violet-600" />
                </label>
              </Hint>
              {!todayPhoto?.alignment && <p className="text-[11px] leading-snug text-amber-700 dark:text-amber-400">{t('flow.photos.notAligned')}</p>}
              {!readOnly && todayPhoto && (
                <Hint label={t('flow.photos.align')} description={t('flow.hints.align')} side="left">
                  <Button type="button" size="sm" variant="outline" className="h-8 w-full text-xs" onClick={() => setAligning(true)}>
                    <Crosshair className="mr-1 h-3.5 w-3.5" />{t('flow.photos.align')}
                  </Button>
                </Hint>
              )}
            </>
          )}
        </div>
      )}

      {/* Tools */}
      <div role="toolbar" aria-label={t('flow.treatment.tools')} className={cn(floating, 'left-3 top-1/2 flex -translate-y-1/2 flex-col gap-0.5 p-1.5', stacked && 'bottom-20 top-auto left-1/2 -translate-x-1/2 translate-y-0 flex-row')}>
        {TOOLS.map(({ id, icon: Icon, key }) => (
          <ToolButton
            key={id}
            side={stacked ? 'top' : 'right'}
            label={t(`flow.hints.tools.${id}.label`)}
            description={t(`flow.hints.tools.${id}.description`)}
            shortcut={key.toUpperCase()}
            on={tool === id}
            disabled={readOnly}
            onClick={() => setTool(id)}
          >
            <Icon className="h-5 w-5" />
          </ToolButton>
        ))}
        <span className={cn('bg-border', stacked ? 'mx-1 w-px' : 'my-1 h-px')} aria-hidden />
        <ToolButton side={stacked ? 'top' : 'right'} label={t('flow.hints.undo.label')} description={t('flow.hints.undo.description')} shortcut="Ctrl+Z" disabled={!canUndo} onClick={undo}><Undo2 className="h-5 w-5" /></ToolButton>
        <ToolButton side={stacked ? 'top' : 'right'} label={t('flow.hints.redo.label')} description={t('flow.hints.redo.description')} shortcut="Ctrl+Shift+Z" disabled={!canRedo} onClick={redo}><Redo2 className="h-5 w-5" /></ToolButton>
        <span className={cn('bg-border', stacked ? 'mx-1 w-px' : 'my-1 h-px')} aria-hidden />
        <ToolButton side={stacked ? 'top' : 'right'} label={t('flow.hints.zones.label')} description={t('flow.hints.zones.description')} on={showZones} onClick={() => setShowZones((v) => !v)}><ScanLine className="h-5 w-5" /></ToolButton>
        {previous && (
          <ToolButton
            side={stacked ? 'top' : 'right'}
            label={t('flow.hints.previous.label')}
            description={t('flow.hints.previous.description', { date: formatDisplayDate(previous.date) })}
            on={showGhost}
            onClick={() => setShowGhost((v) => !v)}
          >
            <History className="h-5 w-5" />
          </ToolButton>
        )}
      </div>

      {/* The selected mark's data, beside the mark (on a narrow screen it goes in the panel below) */}
      {!stacked && editor && selected && (
        <MarkPopover stageRef={stageRef} markId={selected.mark.id}>{editor}</MarkPopover>
      )}

      {/* What a tap does now */}
      <div className={cn(floating, 'bottom-[4.5rem] left-1/2 max-w-[calc(100%-1.5rem)] -translate-x-1/2 truncate px-3.5 py-1.5 text-xs text-muted-foreground', stacked && 'bottom-[8.5rem]')} aria-live="polite">{hint}</div>

      {/* One chip per service: the active layer and its visibility */}
      <div role="group" aria-label={t('flow.treatment.services')} className={cn(floating, 'bottom-3 left-1/2 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 gap-1 overflow-x-auto p-1.5')}>
        {layers.length === 0 && <span className="px-3 py-2 text-xs text-muted-foreground">{t('flow.treatment.noServices')}</span>}
        {layers.map((layer, index) => {
          const signed = isServiceSigned(consents, layer.serviceId);
          const isHidden = hidden.has(layer.id);
          const color = layerColor(layer, index);
          const total = `${formatQuantity(layerQuantity(layer))} ${layer.unitSymbol}`;
          return (
            <div
              key={layer.id}
              className={cn('flex h-11 shrink-0 items-center gap-1 rounded-xl border-[1.5px] border-transparent pl-3 pr-1', activeLayerId === layer.id && 'bg-[color-mix(in_srgb,var(--c)_10%,transparent)]', !signed && 'opacity-60')}
              style={{ '--c': color, borderColor: activeLayerId === layer.id ? color : undefined } as React.CSSProperties}
            >
              <Hint
                side="top"
                label={layer.serviceName}
                description={signed
                  ? t('flow.hints.chip', { total, count: layer.marks.length, tool: t(`flow.hints.tools.${layer.markingTool}.label`) })
                  : t('flow.hints.chipLocked')}
              >
                <button type="button" className="flex items-center gap-2 text-[13px] font-medium" onClick={() => pickLayer(layer)} aria-pressed={activeLayerId === layer.id}>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} aria-hidden />
                  {layer.serviceName}
                  <span className="text-xs font-medium tabular-nums text-muted-foreground">{signed ? total : t('flow.treatment.unsigned')}</span>
                  {!signed && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                </button>
              </Hint>
              <Hint side="top" label={isHidden ? t('layers.show', { name: layer.serviceName }) : t('layers.hide', { name: layer.serviceName })} description={t('flow.hints.layerVisibility')}>
                <button
                  type="button"
                  className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
                  onClick={() => setHidden((h) => { const n = new Set(h); if (n.has(layer.id)) n.delete(layer.id); else n.add(layer.id); return n; })}
                  aria-label={isHidden ? t('layers.show', { name: layer.serviceName }) : t('layers.hide', { name: layer.serviceName })}
                  aria-pressed={!isHidden}
                >
                  {isHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </Hint>
            </div>
          );
        })}
      </div>
    </div>
  );


  return (
    <div ref={containerRef} className={cn('flex min-h-0 flex-1', stacked ? 'flex-col overflow-y-auto' : 'flex-row')}>
      {stage}
      <aside aria-label={t('flow.treatment.panel')} className={cn('flex min-h-0 flex-col bg-card', stacked ? 'border-t' : 'w-[clamp(18rem,28%,22rem)] shrink-0 border-l')}>
        <div role="tablist" className="flex shrink-0 border-b px-2.5">
          {(['summary', 'notes', 'history'] as PanelTab[]).map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={cn('-mb-px border-b-2 px-2.5 py-3 text-[13px] font-medium', tab === id ? 'border-violet-600 text-foreground' : 'border-transparent text-muted-foreground')}
            >
              {t(`flow.treatment.tabs.${id}`, { count: stored?.sessionNotes.length ?? 0 })}
            </button>
          ))}
        </div>
        <div className={cn('flex flex-col gap-3 p-3.5', !stacked && 'min-h-0 flex-1 overflow-y-auto')}>
          {stacked && editor}
          {tab === 'summary' && <SummaryPanel selectedId={selectedId} onSelect={selectMark} />}
          {tab === 'notes' && <NotesPanel />}
          {tab === 'history' && <ZoneHistoryPanel zone={zoneFocus} view={view} onClear={() => setZoneFocus(null)} />}
          {tab === 'summary' && !readOnly && (
            <Button type="button" onClick={() => goToStep(4)}>{t('flow.treatment.toClose')}</Button>
          )}
        </div>
      </aside>
      {aligning && todayPhoto && !readOnly && (
        <PhotoAlignDialog
          open
          onOpenChange={(open) => { if (!open) setAligning(false); }}
          photoId={todayPhoto.id}
          view={todayPhoto.view as PhotoView}
          onSave={saveAlignment}
        />
      )}
    </div>
  );
}

const POPOVER_WIDTH = 304;
const POPOVER_GAP = 18;
/** Room kept for the floating bars: the view bar on top, the hint and the chips at the bottom */
const POPOVER_MARGIN = { top: 64, bottom: 116, side: 12 };

/**
 * Keeps its content next to a mark of the map: to its right, or to its left when there is no
 * room, never over the bars. It follows the mark while the map is zoomed, panned or the mark dragged.
 */
function MarkPopover({ stageRef, markId, children }: { stageRef: React.RefObject<HTMLDivElement | null>; markId: string; children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState<{ left: number; top: number; maxHeight: number } | null>(null);

  React.useEffect(() => {
    let frame = 0;
    let last = '';
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const stage = stageRef.current;
      const box = ref.current;
      const target = stage?.querySelector(`[data-point-id="${CSS.escape(markId)}"]`);
      if (!stage || !box || !target) {
        if (last !== 'none') { last = 'none'; setPos(null); }
        return;
      }
      const s = stage.getBoundingClientRect();
      const m = target.getBoundingClientRect();
      const height = box.offsetHeight;
      const maxHeight = Math.max(160, s.height - POPOVER_MARGIN.top - POPOVER_MARGIN.bottom);
      let left = m.right - s.left + POPOVER_GAP;
      if (left + POPOVER_WIDTH > s.width - POPOVER_MARGIN.side) left = m.left - s.left - POPOVER_GAP - POPOVER_WIDTH;
      left = Math.max(POPOVER_MARGIN.side, Math.min(s.width - POPOVER_WIDTH - POPOVER_MARGIN.side, left));
      const centre = m.top - s.top + m.height / 2;
      const top = Math.max(POPOVER_MARGIN.top, Math.min(s.height - POPOVER_MARGIN.bottom - Math.min(height, maxHeight), centre - 48));
      const key = `${Math.round(left)}:${Math.round(top)}:${Math.round(maxHeight)}`;
      if (key !== last) {
        last = key;
        setPos({ left, top, maxHeight });
      }
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [stageRef, markId]);

  return (
    <div
      ref={ref}
      className="absolute z-20 overflow-y-auto rounded-2xl"
      style={{ width: POPOVER_WIDTH, left: pos?.left ?? 0, top: pos?.top ?? 0, maxHeight: pos?.maxHeight, visibility: pos ? 'visible' : 'hidden' }}
      // Taps inside the panel must not reach the map (they would add marks or deselect)
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}

function ToolButton({ label, description, shortcut, side = 'right', on, disabled, onClick, children }: {
  label: string;
  description?: string;
  shortcut?: string;
  side?: 'top' | 'right';
  on?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Hint label={label} description={description} shortcut={shortcut} side={side}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={shortcut ? `${label} (${shortcut})` : label}
        aria-pressed={on}
        className={cn('grid h-10 w-10 place-items-center rounded-xl transition-colors disabled:opacity-35', on ? 'bg-violet-600 text-white' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}
      >
        {children}
      </button>
    </Hint>
  );
}

/** Each service with its total, its marks, and the product and lot loaded once for all of them */
function SummaryPanel({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string) => void }) {
  const t = useTranslations('AestheticRecord');
  const zoneLabel = useZoneLabel();
  const { draft, setLayers, stored, readOnly, goToStep } = useSessionFlow();
  const consents = stored?.consents ?? [];
  const updateLayer = (id: string, patch: Partial<AestheticLayer>) =>
    setLayers((list) => list.map((l) => (l.id === id ? { ...l, ...patch } : l)), { skipHistory: true });

  if (!draft.layers.length) return <p className="text-xs text-muted-foreground">{t('flow.treatment.noServices')}</p>;
  return (
    <>
      {draft.layers.map((layer, index) => {
        const color = layerColor(layer, index);
        const signed = isServiceSigned(consents, layer.serviceId);
        return (
          <div key={layer.id} className="overflow-hidden rounded-xl border">
            <div className="flex items-center gap-2 bg-muted/50 px-3 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} aria-hidden />
              <b className="min-w-0 flex-1 truncate text-[13px] font-semibold">{layer.serviceName}</b>
              <span className="text-[13px] font-semibold tabular-nums">{formatQuantity(layerQuantity(layer))} {layer.unitSymbol}</span>
            </div>
            {!signed && (
              <div className="flex items-center gap-2 border-t px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                <Lock className="h-3.5 w-3.5" />{t('flow.treatment.unsignedRow')}
                {!readOnly && <Button type="button" size="sm" variant="ghost" className="ml-auto h-7 text-xs" onClick={() => goToStep(1)}>{t('flow.treatment.sign')}</Button>}
              </div>
            )}
            {layer.marks.map((mark, i) => (
              <button
                key={mark.id}
                type="button"
                onClick={() => onSelect(mark.id)}
                className={cn('flex w-full items-center gap-2 border-t px-3 py-1.5 text-left text-xs hover:bg-muted/60', selectedId === mark.id && 'bg-violet-500/10')}
              >
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: color }}>{i + 1}</span>
                <span className="min-w-0 flex-1 truncate">
                  {mark.zone ? zoneLabel(mark.zone) : t('zones.none')}
                  {mark.view !== 'front' && <span className="text-muted-foreground"> · {t(`viewsShort.${mark.view}`)}</span>}
                </span>
                <span className={cn('tabular-nums', (mark.quantity ?? 0) <= 0 && 'font-semibold text-destructive')}>
                  {mark.quantity != null ? `${formatQuantity(mark.quantity)} ${layer.unitSymbol}` : t('map.incompletePoint')}
                </span>
              </button>
            ))}
            {signed && !layer.marks.length && <p className="border-t px-3 py-2 text-xs text-muted-foreground">{t('flow.treatment.noMarks')}</p>}
            {signed && (
              <div className="grid grid-cols-2 gap-2 border-t px-3 py-2.5">
                <div className="col-span-2 flex flex-col gap-1">
                  <Label htmlFor={`aes-product-${layer.id}`} className="text-[11px] text-muted-foreground">{t('layers.product')}</Label>
                  <Input id={`aes-product-${layer.id}`} value={layer.productName} placeholder={t('layers.productPlaceholder')} disabled={readOnly} onChange={(e) => updateLayer(layer.id, { productName: e.target.value })} className="h-8 text-xs" />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor={`aes-lot-${layer.id}`} className="text-[11px] text-muted-foreground">{t('point.lot')}</Label>
                  <Input id={`aes-lot-${layer.id}`} value={layer.lot ?? ''} disabled={readOnly} onChange={(e) => updateLayer(layer.id, { lot: e.target.value || undefined })} className="h-8 text-xs" />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor={`aes-exp-${layer.id}`} className="text-[11px] text-muted-foreground">{t('flow.treatment.expiry')}</Label>
                  <Input id={`aes-exp-${layer.id}`} type="date" value={layer.lotExpiry ?? ''} disabled={readOnly} onChange={(e) => updateLayer(layer.id, { lotExpiry: e.target.value || undefined })} className="h-8 text-xs" />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
}

/** Timestamped notes while working, with frequent ones and dictation (the browser's speech recognition) */
function NotesPanel() {
  const t = useTranslations('AestheticRecord');
  const locale = useLocale();
  const { toast } = useToast();
  const { stored, readOnly, ensureSaved, applyServer, reportError } = useSessionFlow();
  const [text, setText] = React.useState('');
  const [listening, setListening] = React.useState(false);
  const notes = (stored?.sessionNotes ?? []).filter((n) => n.kind === 'note');

  const add = useAsyncAction(
    async (body: string) => addAestheticNote(await ensureSaved(), body, 'note'),
    {
      onSuccess: (session) => { applyServer(session); setText(''); },
      errorTitle: t('flow.notes.error'),
      describeError: reportError,
    },
  );

  function dictate() {
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
    const Recognition = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Recognition) {
      toast({ title: t('flow.notes.dictationUnavailable') });
      return;
    }
    const recognition = new Recognition();
    recognition.lang = locale === 'en' ? 'en-US' : locale === 'es-ES' ? 'es-ES' : 'es-UY';
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? '';
      setText((v) => (v ? `${v} ${transcript}` : transcript));
    };
    recognition.onerror = () => toast({ title: t('flow.notes.dictationError') });
    recognition.onend = () => setListening(false);
    setListening(true);
    recognition.start();
  }

  return (
    <div className="flex flex-col gap-3">
      {!readOnly && (
        <div className="flex flex-col gap-2">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder={t('flow.notes.placeholder')} aria-label={t('flow.notes.placeholder')} className="resize-y text-sm" disabled={add.isPending} />
          <div className="flex items-center gap-1.5">
            <Button type="button" size="sm" variant="outline" className="h-8" onClick={dictate} disabled={listening || add.isPending}>
              <Mic className={cn('mr-1 h-3.5 w-3.5', listening && 'animate-pulse text-destructive')} />{listening ? t('flow.notes.listening') : t('flow.notes.dictate')}
            </Button>
            <span className="flex-1" />
            <Button type="button" size="sm" className="h-8" onClick={() => text.trim() && add.run(text.trim())} disabled={!text.trim()} loading={add.isPending}>{t('flow.notes.add')}</Button>
          </div>
          <div className="flex flex-wrap gap-1">
            {QUICK_NOTES.map((key) => (
              <button key={key} type="button" disabled={add.isPending} onClick={() => add.run(t(`flow.notes.quick.${key}`))} className="h-7 rounded-lg bg-muted px-2.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50">
                {t(`flow.notes.quick.${key}`)}
              </button>
            ))}
          </div>
        </div>
      )}
      {notes.length ? [...notes].reverse().map((note) => (
        <div key={note.id} className="border-l-2 border-violet-600 py-0.5 pl-2.5 text-[13px]">
          <time className="mr-1.5 text-[11px] text-muted-foreground">{formatUtcDateTime(note.createdAt).slice(-5)}</time>
          {note.body}
          {note.createdByName && <span className="block text-[11px] text-muted-foreground">{note.createdByName}</span>}
        </div>
      )) : <p className="text-xs text-muted-foreground">{t('flow.notes.empty')}</p>}
    </div>
  );
}

/** Earlier applications on a zone; without a zone, every zone of the last 12 months */
function ZoneHistoryPanel({ zone, view, onClear }: { zone: AestheticZoneId | null; view: AestheticMapView; onClear: () => void }) {
  const t = useTranslations('AestheticRecord');
  const zoneLabel = useZoneLabel();
  const { previousSessions } = useSessionFlow();

  if (!previousSessions.length) return <p className="text-xs text-muted-foreground">{t('flow.history.firstSession')}</p>;

  if (zone) {
    const rows = [...previousSessions].reverse().flatMap((session) => session.layers.flatMap((layer, index) => {
      const quantity = layer.marks.filter((m) => m.zone === zone).reduce((sum, m) => sum + (m.quantity ?? 0), 0);
      const count = layer.marks.filter((m) => m.zone === zone).length;
      return count ? [{ key: `${session.id}-${layer.id}`, date: session.date, name: layer.serviceName, unit: layer.unitSymbol, color: layerColor(layer, index), quantity }] : [];
    }));
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <b className="text-sm font-semibold">{zoneLabel(zone)}</b>
          <Button type="button" size="sm" variant="ghost" className="ml-auto h-7 text-xs" onClick={onClear}>{t('flow.history.all')}</Button>
        </div>
        {rows.length ? rows.map((r) => (
          <div key={r.key} className="flex items-center gap-2 text-xs">
            <time className="w-20 shrink-0 text-muted-foreground">{formatDisplayDate(r.date)}</time>
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: r.color }} aria-hidden />
            <span className="min-w-0 flex-1 truncate">{r.name}</span>
            <span className="tabular-nums">{formatQuantity(r.quantity)} {r.unit}</span>
          </div>
        )) : <p className="text-xs text-muted-foreground">{t('flow.history.noneInZone')}</p>}
      </div>
    );
  }

  const since = toLocalISOString(subMonths(new Date(), 12)).slice(0, 10);
  const viewZones = new Set<string>(getViewZoneIds(view));
  const rows = buildZoneRows(previousSessions, since).filter((r) => r.key !== '__none__' && viewZones.has(r.key));
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">{t('flow.history.hint')}</p>
      {rows.length === 0 && <p className="text-xs text-muted-foreground">{t('zoneHistory.empty')}</p>}
      {rows.map((row) => (
        <div key={row.key} className="overflow-hidden rounded-xl border">
          <div className="flex items-center gap-2 bg-muted/50 px-3 py-2 text-[13px]">
            <b className="min-w-0 flex-1 truncate font-semibold">{zoneLabel(row.key as AestheticZoneId)}</b>
            <span className="text-[11px] text-muted-foreground">{t('zoneHistory.last', { date: formatDisplayDate(row.lastDate) })}</span>
          </div>
          {row.products.map((p) => (
            <div key={`${p.name}-${p.unit}`} className="flex items-center gap-2 border-t px-3 py-1.5 text-xs">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} aria-hidden />
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              <span className="tabular-nums">{formatQuantity(p.quantity)} {p.unit}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

