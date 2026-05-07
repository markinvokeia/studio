'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import { TwoPanelLayout } from '@/components/layout/two-panel-layout';
import { EmployeeList } from '@/components/payroll/EmployeeList';
import { LegajoTabs } from '@/components/payroll/LegajoTabs';
import { API_ROUTES } from '@/constants/routes';
import { api } from '@/services/api';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { PayrollEmployee } from '@/lib/types';
import { Loader2, Search, UserPlus, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface DbCategory {
  id: string;
  codigo: string;
  nombre: string;
}

interface PayrollUser {
  id: string;
  name: string;
  email?: string;
  phone_number?: string;
  identity_document?: string;
  is_active?: boolean;
  roles?: string;
}

interface UserLinkConfig {
  category_id: string;
  fecha_ingreso: string;
}

export default function PayrollEmployeesPage() {
  const t = useTranslations('PayrollPage.employees');
  const { toast } = useToast();

  const [employees, setEmployees] = useState<PayrollEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [isRightExpanded, setIsRightExpanded] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linking, setLinking] = useState(false);
  const [linkProgress, setLinkProgress] = useState<{ done: number; total: number } | null>(null);

  // Categories — loaded once on mount
  const [categories, setCategories] = useState<DbCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  // Users — always fetched fresh when dialog opens
  const [allUsers, setAllUsers] = useState<PayrollUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Multi-select state
  const [selectedUsers, setSelectedUsers] = useState<Map<string, UserLinkConfig>>(new Map());
  const [defaultCategory, setDefaultCategory] = useState('');
  const [defaultFechaIngreso, setDefaultFechaIngreso] = useState('');
  const [userSearch, setUserSearch] = useState('');

  const loadEmployees = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    api
      .get(API_ROUTES.PAYROLL.EMPLOYEES)
      .then((res) => {
        const data = (Array.isArray(res) ? res : (res?.data ?? [])) as PayrollEmployee[];
        setEmployees(data);
      })
      .catch(() => {})
      .finally(() => { if (!silent) setLoading(false); });
  }, []);

  useEffect(() => {
    loadEmployees();
    api.get(API_ROUTES.PAYROLL.CATEGORIES)
      .then((res) => {
        const data = (Array.isArray(res) ? res : (res?.data ?? [])) as DbCategory[];
        setCategories(data);
      })
      .catch(() => {})
      .finally(() => setLoadingCategories(false));
  }, [loadEmployees]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return allUsers;
    return allUsers.filter((u) =>
      (u.name ?? '').toLowerCase().includes(q) ||
      (u.identity_document ?? '').toLowerCase().includes(q) ||
      (u.email ?? '').toLowerCase().includes(q),
    );
  }, [allUsers, userSearch]);

  function openLinkDialog() {
    setSelectedUsers(new Map());
    setDefaultCategory('');
    setDefaultFechaIngreso('');
    setUserSearch('');
    setLinkProgress(null);
    setAllUsers([]);
    setShowLinkDialog(true);

    // Always fetch fresh — exclude users already linked as employees
    const linkedUserIds = new Set(employees.map((e) => e.user_id).filter(Boolean));
    setLoadingUsers(true);
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const base = process.env.NEXT_PUBLIC_API_URL
      ? `${process.env.NEXT_PUBLIC_API_URL}/webhook`
      : 'https://n8n-project-n8n.7ig1i3.easypanel.host/webhook';
    fetch(`${base}${API_ROUTES.PAYROLL.USERS}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      mode: 'cors',
      cache: 'no-store',
    })
      .then((r) => r.json())
      .then((data) => {
        const raw = Array.isArray(data) ? data : (data?.data ?? []);
        const mapped = (raw as PayrollUser[]).map((u) => ({ ...u, id: String(u.id), name: u.name || '—' }));
        setAllUsers(mapped.filter((u) => !linkedUserIds.has(u.id)));
      })
      .catch(() => {})
      .finally(() => setLoadingUsers(false));
  }

  function toggleUser(user: PayrollUser) {
    setSelectedUsers((prev) => {
      const next = new Map(prev);
      if (next.has(user.id)) {
        next.delete(user.id);
      } else {
        next.set(user.id, { category_id: defaultCategory, fecha_ingreso: defaultFechaIngreso });
      }
      return next;
    });
  }

  function updateUserConfig(userId: string, field: keyof UserLinkConfig, value: string) {
    setSelectedUsers((prev) => {
      const next = new Map(prev);
      const existing = next.get(userId);
      if (existing) next.set(userId, { ...existing, [field]: value });
      return next;
    });
  }

  // Apply default category/date to all already-selected users that have none
  function applyDefaultToAll(field: keyof UserLinkConfig, value: string) {
    setSelectedUsers((prev) => {
      const next = new Map(prev);
      for (const [id, cfg] of next) {
        if (!cfg[field]) next.set(id, { ...cfg, [field]: value });
      }
      return next;
    });
  }

  const readyCount = useMemo(
    () => Array.from(selectedUsers.values()).filter((c) => c.category_id && c.fecha_ingreso).length,
    [selectedUsers],
  );

  async function handleLinkMultiple() {
    const toLink = Array.from(selectedUsers.entries()).filter(
      ([, cfg]) => cfg.category_id && cfg.fecha_ingreso,
    );
    if (toLink.length === 0) return;

    setLinking(true);
    setLinkProgress({ done: 0, total: toLink.length });
    const errors: string[] = [];

    for (const [userId, cfg] of toLink) {
      try {
        const res = await api.post(API_ROUTES.PAYROLL.EMPLOYEES_LINK, {
          user_id: userId,
          category_id: cfg.category_id,
          fecha_ingreso: cfg.fecha_ingreso,
        });
        const created = (res?.data ?? res) as PayrollEmployee;
        if (created?.id) {
          setEmployees((prev) => [...prev, created]);
        }
      } catch {
        const user = allUsers.find((u) => u.id === userId);
        errors.push(user?.name ?? userId);
      }
      setLinkProgress((prev) => prev ? { ...prev, done: prev.done + 1 } : null);
    }

    setLinking(false);
    setLinkProgress(null);

    if (errors.length === 0) {
      setShowLinkDialog(false);
      toast({ title: t('linked') });
      loadEmployees();
    } else {
      toast({
        title: `${toLink.length - errors.length} vinculados, ${errors.length} con error`,
        variant: 'destructive',
      });
      // Remove successfully linked users from list
      setAllUsers((prev) => prev.filter((u) => errors.includes(u.name ?? u.id) || !selectedUsers.has(u.id)));
    }
  }

  function handleEmployeeUpdate(updated: PayrollEmployee) {
    setEmployees((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    loadEmployees(true);
  }

  const selected = employees.find((e) => e.id === selectedId);

  return (
    <>
      <TwoPanelLayout
        isRightPanelOpen={!!selectedId}
        onBack={() => setSelectedId(undefined)}
        forceRightOnly={isRightExpanded}
        leftPanelDefaultSize={38}
        rightPanelDefaultSize={62}
        minLeftSize={22}
        minRightSize={30}
        leftPanel={
          <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
            <CardHeader className="flex-none pt-2 px-4 pb-3 sm:pt-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="header-icon-circle mt-0.5">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{t('title')}</CardTitle>
                    <CardDescription className="text-xs">{t('subtitle')}</CardDescription>
                  </div>
                </div>
                <Button size="sm" onClick={openLinkDialog}>
                  <UserPlus className="h-4 w-4 sm:mr-1.5" />
                  <span className="hidden sm:inline">{t('linkUser')}</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden flex flex-col min-h-0 p-0">
              <EmployeeList
                employees={employees}
                loading={loading}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onRefresh={loadEmployees}
              />
            </CardContent>
          </Card>
        }
        rightPanel={
          selectedId ? (
            <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
              <CardContent className="flex-1 overflow-hidden flex flex-col min-h-0 p-0">
                <LegajoTabs
                  key={selectedId}
                  employeeId={selectedId}
                  employee={selected}
                  onEmployeeUpdate={handleEmployeeUpdate}
                  onClose={() => setSelectedId(undefined)}
                  isExpanded={isRightExpanded}
                  onToggleExpand={() => setIsRightExpanded(v => !v)}
                />
              </CardContent>
            </Card>
          ) : (
            <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
              <CardContent className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground p-8">
                <p className="text-sm">{t('selectEmployee')}</p>
              </CardContent>
            </Card>
          )
        }
      />

      {/* Link users dialog — multi-select */}
      <Dialog open={showLinkDialog} onOpenChange={(v) => !v && !linking && setShowLinkDialog(false)}>
        <DialogContent className="max-w-2xl p-0 flex flex-col max-h-[90vh]">
          {/* Header */}
          <DialogHeader className="px-6 py-4 border-b shrink-0 space-y-0">
            <div className="flex items-center gap-3">
              <DialogTitle className="text-base">{t('linkUserTitle')}</DialogTitle>
              {selectedUsers.size > 0 && (
                <Badge className="text-xs">
                  {selectedUsers.size} seleccionado{selectedUsers.size !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
          </DialogHeader>

          {/* Defaults row */}
          <div className="px-6 py-3 border-b bg-muted/30 shrink-0">
            <p className="text-xs text-muted-foreground mb-2">Valores por defecto para nuevas selecciones:</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">{t('selectCategory')}</Label>
                {loadingCategories ? (
                  <Skeleton className="h-8 w-full rounded" />
                ) : (
                  <Select
                    value={defaultCategory}
                    onValueChange={(v) => {
                      setDefaultCategory(v);
                      applyDefaultToAll('category_id', v);
                    }}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder={t('selectCategoryPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.nombre} ({cat.codigo})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="flex-1 space-y-1">
                <Label className="text-xs">{t('fechaIngreso')}</Label>
                <Input
                  type="date"
                  value={defaultFechaIngreso}
                  onChange={(e) => {
                    setDefaultFechaIngreso(e.target.value);
                    applyDefaultToAll('fecha_ingreso', e.target.value);
                  }}
                  className="h-8 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="px-6 py-2 border-b shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder={t('selectUserPlaceholder')}
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
          </div>

          {/* User list */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {loadingUsers ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando usuarios...
              </div>
            ) : filteredUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">Sin resultados</p>
            ) : (
              <div className="divide-y">
                {filteredUsers.map((user) => {
                  const isSelected = selectedUsers.has(user.id);
                  const cfg = selectedUsers.get(user.id);
                  const missingConfig = isSelected && cfg && (!cfg.category_id || !cfg.fecha_ingreso);

                  return (
                    <div
                      key={user.id}
                      className={cn(
                        'px-6 py-3 transition-colors',
                        isSelected ? 'bg-primary/5' : 'hover:bg-muted/20',
                      )}
                    >
                      {/* User row */}
                      <div
                        className="flex items-center gap-3 cursor-pointer"
                        onClick={() => toggleUser(user)}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleUser(user)}
                          onClick={(e) => e.stopPropagation()}
                          className="shrink-0"
                        />
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold shrink-0">
                          {(user.name ?? '?').slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{user.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {[user.identity_document, user.email].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        {user.roles && (
                          <Badge variant="outline" className="text-xs shrink-0 hidden sm:flex">
                            {user.roles.split('--')[0]?.trim()}
                          </Badge>
                        )}
                        {missingConfig && (
                          <span className="text-xs text-amber-600 shrink-0">Completa los datos</span>
                        )}
                      </div>

                      {/* Per-user config — visible only when selected */}
                      {isSelected && cfg && (
                        <div className="mt-2.5 flex flex-col sm:flex-row gap-3 pl-11">
                          <div className="flex-1 space-y-1">
                            <Label className="text-xs">{t('selectCategory')}</Label>
                            <Select
                              value={cfg.category_id}
                              onValueChange={(v) => updateUserConfig(user.id, 'category_id', v)}
                            >
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue placeholder={t('selectCategoryPlaceholder')} />
                              </SelectTrigger>
                              <SelectContent>
                                {categories.map((cat) => (
                                  <SelectItem key={cat.id} value={cat.id} className="text-xs">
                                    {cat.nombre} ({cat.codigo})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex-1 space-y-1">
                            <Label className="text-xs">{t('fechaIngreso')}</Label>
                            <Input
                              type="date"
                              value={cfg.fecha_ingreso}
                              onChange={(e) => updateUserConfig(user.id, 'fecha_ingreso', e.target.value)}
                              className="h-7 text-xs"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <DialogFooter className="px-6 py-4 border-t shrink-0 bg-background flex-row items-center justify-between gap-3 space-x-0">
            <p className="text-sm text-muted-foreground flex-1">
              {linkProgress
                ? `Vinculando... ${linkProgress.done}/${linkProgress.total}`
                : selectedUsers.size === 0
                  ? 'Selecciona uno o más usuarios'
                  : readyCount < selectedUsers.size
                    ? `${selectedUsers.size - readyCount} sin categoría/fecha`
                    : `${readyCount} listo${readyCount !== 1 ? 's' : ''} para vincular`}
            </p>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" onClick={() => setShowLinkDialog(false)} disabled={linking}>
                Cancelar
              </Button>
              <Button
                onClick={handleLinkMultiple}
                disabled={linking || readyCount === 0}
              >
                {linking ? (
                  <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />{t('linking')}</>
                ) : (
                  `${t('linkUser')}${readyCount > 0 ? ` (${readyCount})` : ''}`
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
