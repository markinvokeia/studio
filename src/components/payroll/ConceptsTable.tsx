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
import { ChevronLeft, Plus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

type ConceptTipo = 'haber' | 'descuento' | 'provision' | 'informativo';
type FilterActivo = 'all' | 'active' | 'inactive';

interface DbConcept {
  id: string;
  codigo: string;
  nombre: string;
  tipo: ConceptTipo;
  grava_bps: boolean;
  grava_irpf: boolean;
  activo: boolean;
  created_at?: string;
}

interface ConceptForm {
  codigo: string;
  nombre: string;
  tipo: ConceptTipo;
  grava_bps: boolean;
  grava_irpf: boolean;
  activo: boolean;
}

const EMPTY_FORM: ConceptForm = {
  codigo: '',
  nombre: '',
  tipo: 'haber',
  grava_bps: false,
  grava_irpf: false,
  activo: true,
};

const TIPO_COLORS: Record<ConceptTipo, string> = {
  haber:       'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  descuento:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  provision:   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  informativo: 'bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-400',
};

const TIPOS: ConceptTipo[] = ['haber', 'descuento', 'provision', 'informativo'];

export function ConceptsTable() {
  const t = useTranslations('PayrollPage.settings.concepts');
  const { toast } = useToast();
  const isNarrow = useViewportNarrow(1024);

  const [concepts, setConcepts] = useState<DbConcept[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterActivo, setFilterActivo] = useState<FilterActivo>('active');
  const [selected, setSelected] = useState<DbConcept | null>(null);
  const [editForm, setEditForm] = useState<ConceptForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [addForm, setAddForm] = useState<ConceptForm>(EMPTY_FORM);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get(API_ROUTES.PAYROLL.CONCEPTS)
      .then((res) => {
        if (cancelled) return;
        const data = (Array.isArray(res) ? res : (res?.data ?? [])) as DbConcept[];
        setConcepts(data);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const displayed = concepts.filter((c) => {
    if (filterActivo === 'active') return c.activo !== false;
    if (filterActivo === 'inactive') return c.activo === false;
    return true;
  });

  function selectConcept(concept: DbConcept) {
    setSelected(concept);
    setEditForm({
      codigo: concept.codigo,
      nombre: concept.nombre,
      tipo: concept.tipo,
      grava_bps: concept.grava_bps,
      grava_irpf: concept.grava_irpf,
      activo: concept.activo,
    });
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    try {
      await api.post(API_ROUTES.PAYROLL.CONCEPTS_UPSERT, { id: selected.id, ...editForm });
      setConcepts((prev) => prev.map((c) => c.id === selected.id ? { ...c, ...editForm } : c));
      setSelected((prev) => prev ? { ...prev, ...editForm } : prev);
      toast({ title: t('saved') });
    } catch {
      toast({ title: t('errorSaving'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate() {
    if (!selected) return;
    setDeactivating(true);
    try {
      await api.post(API_ROUTES.PAYROLL.CONCEPTS_DELETE, { id: selected.id });
      setConcepts((prev) => prev.map((c) => c.id === selected.id ? { ...c, activo: false } : c));
      setSelected(null);
      toast({ title: t('deactivated') });
    } catch {
      toast({ title: t('errorDeleting'), variant: 'destructive' });
    } finally {
      setDeactivating(false);
    }
  }

  async function handleAdd() {
    if (!addForm.codigo || !addForm.nombre) return;
    setAdding(true);
    try {
      const res = await api.post(API_ROUTES.PAYROLL.CONCEPTS_UPSERT, addForm);
      const created = (res?.data ?? res) as DbConcept;
      setConcepts((prev) => [...prev, { ...addForm, id: created.id ?? String(Date.now()) }]);
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
            {/* Toolbar */}
            <div className="flex items-center gap-2 p-3 border-b shrink-0">
              <div className="flex gap-1">
                {(['active', 'inactive', 'all'] as FilterActivo[]).map((f) => (
                  <Button key={f} size="sm" variant={filterActivo === f ? 'default' : 'outline'}
                    className="h-7 text-xs"
                    onClick={() => { setFilterActivo(f); setSelected(null); }}>
                    {t(`filter_${f}`)}
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
              {displayed.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">{t('none')}</p>
              ) : (
                <div className="flex flex-col gap-1.5 p-2">
                  {displayed.map((c) => (
                    <DataCard
                      key={c.id}
                      isSelected={selected?.id === c.id}
                      title={c.nombre}
                      subtitle={c.codigo}
                      showArrow
                      onClick={() => selectConcept(c)}
                      badge={
                        <Badge className={cn('text-xs', TIPO_COLORS[c.tipo])}>
                          {t(`tipos.${c.tipo}`)}
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
              <span className="font-medium text-sm flex-1 truncate">{selected.nombre}</span>
              {!isNarrow && (
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"
                  onClick={() => setSelected(null)}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Form */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('codigo')}</Label>
                  <Input value={editForm.codigo}
                    onChange={(e) => setEditForm((p) => ({ ...p, codigo: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('tipo')}</Label>
                  <Select value={editForm.tipo}
                    onValueChange={(v) => setEditForm((p) => ({ ...p, tipo: v as ConceptTipo }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIPOS.map((tp) => (
                        <SelectItem key={tp} value={tp}>{t(`tipos.${tp}`)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('nombre')}</Label>
                <Input value={editForm.nombre}
                  onChange={(e) => setEditForm((p) => ({ ...p, nombre: e.target.value }))} />
              </div>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="checkbox" checked={editForm.grava_bps}
                    onChange={(e) => setEditForm((p) => ({ ...p, grava_bps: e.target.checked }))}
                    className="h-4 w-4 rounded" />
                  {t('gravaBPS')}
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="checkbox" checked={editForm.grava_irpf}
                    onChange={(e) => setEditForm((p) => ({ ...p, grava_irpf: e.target.checked }))}
                    className="h-4 w-4 rounded" />
                  {t('gravaIRPF')}
                </label>
              </div>
              <div className="flex items-center justify-between border rounded-md px-3 py-2 bg-muted/30">
                <Label className="text-sm cursor-pointer" htmlFor="edit-activo">{t('activo')}</Label>
                <input id="edit-activo" type="checkbox" checked={editForm.activo}
                  onChange={(e) => setEditForm((p) => ({ ...p, activo: e.target.checked }))}
                  className="h-4 w-4 rounded cursor-pointer" />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-4 border-t shrink-0">
              <Button variant="outline" size="sm" onClick={handleDeactivate}
                disabled={deactivating || saving || !selected.activo}
                className="text-destructive border-destructive/40 hover:bg-destructive/10">
                {deactivating ? t('deactivating') : t('deactivate')}
              </Button>
              <Button size="sm" onClick={handleSave}
                disabled={saving || deactivating || !editForm.codigo || !editForm.nombre}>
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{t('codigo')}</Label>
                <Input value={addForm.codigo}
                  onChange={(e) => setAddForm((p) => ({ ...p, codigo: e.target.value }))}
                  placeholder="001" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('tipo')}</Label>
                <Select value={addForm.tipo}
                  onValueChange={(v) => setAddForm((p) => ({ ...p, tipo: v as ConceptTipo }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS.map((tp) => (
                      <SelectItem key={tp} value={tp}>{t(`tipos.${tp}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('nombre')}</Label>
              <Input value={addForm.nombre}
                onChange={(e) => setAddForm((p) => ({ ...p, nombre: e.target.value }))}
                placeholder="Sueldo básico" />
            </div>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={addForm.grava_bps}
                  onChange={(e) => setAddForm((p) => ({ ...p, grava_bps: e.target.checked }))}
                  className="h-4 w-4 rounded" />
                {t('gravaBPS')}
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={addForm.grava_irpf}
                  onChange={(e) => setAddForm((p) => ({ ...p, grava_irpf: e.target.checked }))}
                  className="h-4 w-4 rounded" />
                {t('gravaIRPF')}
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleAdd} disabled={adding || !addForm.codigo || !addForm.nombre}>
              {adding ? t('adding') : t('add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
