'use client';

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
import { Skeleton } from '@/components/ui/skeleton';
import { API_ROUTES } from '@/constants/routes';
import { api } from '@/services/api';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { ChevronLeft, Plus, Trash2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

interface DbCategory {
  id: string;
  codigo: string;
  nombre: string;
  subgrupo?: string;
  descripcion?: string;
  salario_minimo_uyu: string | number;
  vigente_desde?: string;
  vigente_hasta?: string;
  created_at?: string;
}

interface CategoryForm {
  codigo: string;
  nombre: string;
  subgrupo: string;
  descripcion: string;
  salario_minimo_uyu: number;
  vigente_desde: string;
  vigente_hasta: string;
}

const EMPTY_FORM: CategoryForm = {
  codigo: '',
  nombre: '',
  subgrupo: '',
  descripcion: '',
  salario_minimo_uyu: 0,
  vigente_desde: new Date().toISOString().slice(0, 10),
  vigente_hasta: '',
};

function formatSalary(val: string | number): string {
  return Number(val).toLocaleString('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function toDateInput(iso?: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

export function CategoriesTable() {
  const t = useTranslations('PayrollPage.settings.categories');
  const { toast } = useToast();
  const isNarrow = useViewportNarrow(1024);

  const [categories, setCategories] = useState<DbCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<DbCategory | null>(null);
  const [editForm, setEditForm] = useState<CategoryForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [addForm, setAddForm] = useState<CategoryForm>(EMPTY_FORM);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get(API_ROUTES.PAYROLL.CATEGORIES)
      .then((res) => {
        if (cancelled) return;
        const data = (Array.isArray(res) ? res : (res?.data ?? [])) as DbCategory[];
        setCategories(data);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  function selectCategory(cat: DbCategory) {
    setSelected(cat);
    setEditForm({
      codigo: cat.codigo,
      nombre: cat.nombre,
      subgrupo: cat.subgrupo ?? '',
      descripcion: cat.descripcion ?? '',
      salario_minimo_uyu: Number(cat.salario_minimo_uyu),
      vigente_desde: toDateInput(cat.vigente_desde),
      vigente_hasta: toDateInput(cat.vigente_hasta),
    });
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    try {
      await api.post(API_ROUTES.PAYROLL.CATEGORIES_UPSERT, { id: selected.id, ...editForm });
      setCategories((prev) => prev.map((c) => c.id === selected.id ? { ...c, ...editForm } : c));
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
      await api.post(API_ROUTES.PAYROLL.CATEGORIES_DELETE, { id: selected.id });
      setCategories((prev) => prev.filter((c) => c.id !== selected.id));
      setSelected(null);
      toast({ title: t('deleted') });
    } catch {
      toast({ title: t('errorDeleting'), variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  }

  async function handleAdd() {
    if (!addForm.codigo || !addForm.nombre) return;
    setAdding(true);
    try {
      const res = await api.post(API_ROUTES.PAYROLL.CATEGORIES_UPSERT, addForm);
      const created = (res?.data ?? res) as DbCategory;
      setCategories((prev) => [...prev, { ...addForm, id: created.id ?? String(Date.now()) }]);
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
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full rounded" />)}
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
              <span className="text-xs text-muted-foreground flex-1">
                {t('title')} ({categories.length})
              </span>
              <Button size="sm"
                onClick={() => { setAddForm(EMPTY_FORM); setDialogOpen(true); }}>
                <Plus className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">{t('add')}</span>
              </Button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {categories.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">{t('none')}</p>
              ) : (
                <div className="flex flex-col gap-1.5 p-2">
                  {categories.map((cat) => (
                    <DataCard
                      key={cat.id}
                      isSelected={selected?.id === cat.id}
                      title={cat.nombre}
                      subtitle={`${cat.codigo}${cat.subgrupo ? ` · Sg ${cat.subgrupo}` : ''} · $${formatSalary(cat.salario_minimo_uyu)}`}
                      showArrow
                      onClick={() => selectCategory(cat)}
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
                  <Label className="text-xs">{t('subgrupo')}</Label>
                  <Input value={editForm.subgrupo}
                    onChange={(e) => setEditForm((p) => ({ ...p, subgrupo: e.target.value }))}
                    placeholder="01" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('nombre')}</Label>
                <Input value={editForm.nombre}
                  onChange={(e) => setEditForm((p) => ({ ...p, nombre: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('descripcion')}</Label>
                <Input value={editForm.descripcion}
                  onChange={(e) => setEditForm((p) => ({ ...p, descripcion: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('salarioMinimo')}</Label>
                <Input type="number" min={0} value={editForm.salario_minimo_uyu || ''}
                  onChange={(e) => setEditForm((p) => ({ ...p, salario_minimo_uyu: Number(e.target.value) }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('vigenteDes')}</Label>
                  <Input type="date" value={editForm.vigente_desde}
                    onChange={(e) => setEditForm((p) => ({ ...p, vigente_desde: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('vigestaHasta')}</Label>
                  <Input type="date" value={editForm.vigente_hasta}
                    onChange={(e) => setEditForm((p) => ({ ...p, vigente_hasta: e.target.value }))} />
                </div>
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
                disabled={saving || deleting || !editForm.codigo || !editForm.nombre}>
                {saving ? t('saving') : t('save')}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Add dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => !v && setDialogOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('add')}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 px-6 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{t('codigo')}</Label>
                <Input value={addForm.codigo}
                  onChange={(e) => setAddForm((p) => ({ ...p, codigo: e.target.value }))}
                  placeholder="G15-01" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('subgrupo')}</Label>
                <Input value={addForm.subgrupo}
                  onChange={(e) => setAddForm((p) => ({ ...p, subgrupo: e.target.value }))}
                  placeholder="01" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('nombre')}</Label>
              <Input value={addForm.nombre}
                onChange={(e) => setAddForm((p) => ({ ...p, nombre: e.target.value }))}
                placeholder="Odontólogo General" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('descripcion')}</Label>
              <Input value={addForm.descripcion}
                onChange={(e) => setAddForm((p) => ({ ...p, descripcion: e.target.value }))}
                placeholder="Descripción de la categoría" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('salarioMinimo')}</Label>
              <Input type="number" min={0} value={addForm.salario_minimo_uyu || ''}
                onChange={(e) => setAddForm((p) => ({ ...p, salario_minimo_uyu: Number(e.target.value) }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{t('vigenteDes')}</Label>
                <Input type="date" value={addForm.vigente_desde}
                  onChange={(e) => setAddForm((p) => ({ ...p, vigente_desde: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('vigestaHasta')}</Label>
                <Input type="date" value={addForm.vigente_hasta}
                  onChange={(e) => setAddForm((p) => ({ ...p, vigente_hasta: e.target.value }))} />
              </div>
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
