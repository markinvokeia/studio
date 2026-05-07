'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataCard } from '@/components/ui/data-card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { API_ROUTES } from '@/constants/routes';
import { api } from '@/services/api';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { ChevronLeft, Plus, Trash2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

type CalendarTipo = 'feriado_no_laborable' | 'feriado_comun' | 'cierre_clinica';

interface DbCalendarEvent {
  id: string;
  clinic_id?: number;
  fecha: string;
  tipo: CalendarTipo;
  descripcion: string;
  created_at?: string;
}

interface EventForm {
  fecha: string;
  tipo: CalendarTipo;
  descripcion: string;
}

const EMPTY_FORM: EventForm = {
  fecha: '',
  tipo: 'feriado_no_laborable',
  descripcion: '',
};

const TIPO_COLORS: Record<CalendarTipo, string> = {
  feriado_no_laborable: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  feriado_comun:        'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  cierre_clinica:       'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};

const TIPOS: CalendarTipo[] = ['feriado_no_laborable', 'feriado_comun', 'cierre_clinica'];

const CURRENT_YEAR = new Date().getFullYear();

function formatDate(iso: string): string {
  try {
    return new Date(iso + (iso.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('es-UY', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  } catch { return iso; }
}

function getYear(iso: string): number {
  try { return new Date(iso + (iso.length === 10 ? 'T12:00:00' : '')).getFullYear(); } catch { return 0; }
}

function toDateInput(iso: string): string {
  return iso.slice(0, 10);
}

export function WorkCalendarPanel() {
  const t = useTranslations('PayrollPage.settings.calendar');
  const { toast } = useToast();
  const isNarrow = useViewportNarrow(1024);

  const [events, setEvents] = useState<DbCalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [selected, setSelected] = useState<DbCalendarEvent | null>(null);
  const [editForm, setEditForm] = useState<EventForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [addForm, setAddForm] = useState<EventForm>(EMPTY_FORM);
  const [adding, setAdding] = useState(false);

  const years = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get(API_ROUTES.PAYROLL.CALENDAR)
      .then((res) => {
        if (cancelled) return;
        const data = (Array.isArray(res) ? res : (res?.data ?? [])) as DbCalendarEvent[];
        setEvents(data);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const filtered = events
    .filter((e) => getYear(e.fecha) === selectedYear)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  function selectEvent(event: DbCalendarEvent) {
    setSelected(event);
    setEditForm({
      fecha: toDateInput(event.fecha),
      tipo: event.tipo,
      descripcion: event.descripcion,
    });
  }

  function handleYearChange(year: number) {
    setSelectedYear(year);
    setSelected(null);
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    try {
      await api.post(API_ROUTES.PAYROLL.CALENDAR_UPSERT, { id: selected.id, ...editForm });
      setEvents((prev) => prev.map((e) => e.id === selected.id ? { ...e, ...editForm } : e));
      setSelected((prev) => prev ? { ...prev, ...editForm } : prev);
      toast({ title: t('saved') });
    } catch {
      toast({ title: t('errorSaving'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selected) return;
    setDeleting(true);
    try {
      await api.post(API_ROUTES.PAYROLL.CALENDAR_DELETE, { id: selected.id });
      setEvents((prev) => prev.filter((e) => e.id !== selected.id));
      setSelected(null);
      toast({ title: t('deleted') });
    } catch {
      toast({ title: t('errorDeleting'), variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  }

  async function handleAdd() {
    if (!addForm.fecha) return;
    setAdding(true);
    try {
      const res = await api.post(API_ROUTES.PAYROLL.CALENDAR_UPSERT, addForm);
      const created = (res?.data ?? res) as DbCalendarEvent;
      setEvents((prev) => [...prev, { ...addForm, id: created.id ?? String(Date.now()) }]);
      setDialogOpen(false);
      setAddForm(EMPTY_FORM);
      toast({ title: t('added') });
    } catch {
      toast({ title: t('errorSaving'), variant: 'destructive' });
    } finally {
      setAdding(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-3 p-4">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full rounded" />)}
      </div>
    );
  }

  const showList   = !isNarrow || !selected;
  const showDetail = !!selected;

  return (
    <>
      <div className="flex h-full overflow-hidden">
        {/* ── Left: list ──────────────────────────────────────────────── */}
        {showList && (
          <div className={cn(
            'flex flex-col overflow-hidden',
            !isNarrow && showDetail ? 'w-2/5 border-r' : 'flex-1',
          )}>
            {/* Toolbar: year selector + add */}
            <div className="flex items-center gap-2 p-3 border-b shrink-0">
              <span className="text-xs text-muted-foreground shrink-0">{t('year')}:</span>
              <div className="flex gap-1">
                {years.map((year) => (
                  <Button key={year} size="sm"
                    variant={selectedYear === year ? 'default' : 'outline'}
                    className="h-7 text-xs"
                    onClick={() => handleYearChange(year)}>
                    {year}
                  </Button>
                ))}
              </div>
              <Button size="sm" className="ml-auto"
                onClick={() => { setAddForm(EMPTY_FORM); setDialogOpen(true); }}>
                <Plus className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">{t('add')}</span>
              </Button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">{t('none')}</p>
              ) : (
                <div className="flex flex-col gap-1.5 p-2">
                  {filtered.map((ev) => (
                    <DataCard
                      key={ev.id}
                      isSelected={selected?.id === ev.id}
                      title={ev.descripcion}
                      subtitle={formatDate(ev.fecha)}
                      showArrow
                      onClick={() => selectEvent(ev)}
                      badge={
                        <Badge className={cn('text-xs', TIPO_COLORS[ev.tipo])}>
                          {t(`tipos.${ev.tipo}`)}
                        </Badge>
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Right: edit panel ────────────────────────────────────────── */}
        {showDetail && selected && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Panel header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0">
              {isNarrow && (
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"
                  onClick={() => setSelected(null)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}
              <span className="font-medium text-sm flex-1 truncate">{selected.descripcion}</span>
              {!isNarrow && (
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"
                  onClick={() => setSelected(null)}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Form */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">{t('fecha')}</Label>
                <Input type="date" value={editForm.fecha}
                  onChange={(e) => setEditForm((p) => ({ ...p, fecha: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('tipo')}</Label>
                <Select value={editForm.tipo}
                  onValueChange={(v) => setEditForm((p) => ({ ...p, tipo: v as CalendarTipo }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS.map((tp) => (
                      <SelectItem key={tp} value={tp}>{t(`tipos.${tp}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('descripcion')}</Label>
                <Input value={editForm.descripcion}
                  onChange={(e) => setEditForm((p) => ({ ...p, descripcion: e.target.value }))}
                  placeholder="Año Nuevo" />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-4 border-t shrink-0">
              <Button variant="destructive" size="sm" onClick={handleDelete}
                disabled={deleting || saving}>
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                {deleting ? t('deleting') : t('delete')}
              </Button>
              <Button size="sm" onClick={handleSave}
                disabled={saving || deleting || !editForm.fecha}>
                {saving ? t('saving') : t('save')}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Add dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => !v && setDialogOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('add')}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 px-6 py-4">
            <div className="space-y-1.5">
              <Label className="text-xs">{t('fecha')}</Label>
              <Input type="date" value={addForm.fecha}
                onChange={(e) => setAddForm((p) => ({ ...p, fecha: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('tipo')}</Label>
              <Select value={addForm.tipo}
                onValueChange={(v) => setAddForm((p) => ({ ...p, tipo: v as CalendarTipo }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map((tp) => (
                    <SelectItem key={tp} value={tp}>{t(`tipos.${tp}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('descripcion')}</Label>
              <Input value={addForm.descripcion}
                onChange={(e) => setAddForm((p) => ({ ...p, descripcion: e.target.value }))}
                placeholder="Año Nuevo" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleAdd} disabled={adding || !addForm.fecha}>
              {adding ? t('adding') : t('add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
