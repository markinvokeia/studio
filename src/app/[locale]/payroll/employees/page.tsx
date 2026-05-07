'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
import { Check, ChevronsUpDown, Loader2, UserPlus, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
  avatar?: string;
  roles?: string;
}

interface LinkForm {
  user_id: string;
  category_id: string;
  fecha_ingreso: string;
}

const EMPTY_LINK_FORM: LinkForm = { user_id: '', category_id: '', fecha_ingreso: '' };

export default function PayrollEmployeesPage() {
  const t = useTranslations('PayrollPage.employees');
  const { toast } = useToast();

  const [employees, setEmployees] = useState<PayrollEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linking, setLinking] = useState(false);

  // Categories — loaded once on mount
  const [categories, setCategories] = useState<DbCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  // Users — loaded once when dialog opens, filtered client-side
  const [allUsers, setAllUsers] = useState<PayrollUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const usersLoadedRef = useRef(false);

  const [userPopoverOpen, setUserPopoverOpen] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');

  // Selected user (roles come embedded in the user data from PAYROLL.USERS)
  const [selectedUser, setSelectedUser] = useState<PayrollUser | null>(null);

  const [linkForm, setLinkForm] = useState<LinkForm>(EMPTY_LINK_FORM);

  const loadEmployees = useCallback(() => {
    setLoading(true);
    api
      .get(API_ROUTES.PAYROLL.EMPLOYEES)
      .then((res) => {
        const data = (Array.isArray(res) ? res : (res?.data ?? [])) as PayrollEmployee[];
        setEmployees(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
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

  // Client-side filter — no extra API calls after initial load
  const filteredUsers = useMemo(() => {
    const q = userSearchQuery.trim().toLowerCase();
    if (!q) return allUsers;
    return allUsers.filter((u) =>
      (u.name ?? '').toLowerCase().includes(q) ||
      (u.identity_document ?? '').toLowerCase().includes(q) ||
      (u.email ?? '').toLowerCase().includes(q),
    );
  }, [allUsers, userSearchQuery]);

  function loadPayrollUsers() {
    if (usersLoadedRef.current) return;
    usersLoadedRef.current = true;
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
        setAllUsers((raw as PayrollUser[]).map((u) => ({ ...u, id: String(u.id), name: u.name || '—' })));
      })
      .catch(() => {})
      .finally(() => setLoadingUsers(false));
  }

  function openLinkDialog() {
    setSelectedUser(null);
    setUserSearchQuery('');
    setUserPopoverOpen(false);
    setLinkForm(EMPTY_LINK_FORM);
    setShowLinkDialog(true);
    loadPayrollUsers();
  }

  function handleSelectUser(user: PayrollUser) {
    setSelectedUser(user);
    setLinkForm((p) => ({ ...p, user_id: user.id }));
    setUserPopoverOpen(false);
  }

  async function handleLink() {
    if (!linkForm.user_id || !linkForm.category_id || !linkForm.fecha_ingreso) return;
    setLinking(true);
    try {
      const res = await api.post(API_ROUTES.PAYROLL.EMPLOYEES_LINK, linkForm);
      const created = (res?.data ?? res) as PayrollEmployee;
      if (created?.id) {
        setEmployees((prev) => [...prev, created]);
      } else {
        loadEmployees();
      }
      setAllUsers((prev) => prev.filter((u) => u.id !== linkForm.user_id));
      setShowLinkDialog(false);
      toast({ title: t('linked') });
    } catch {
      toast({ title: t('errorLinking'), variant: 'destructive' });
    } finally {
      setLinking(false);
    }
  }

  function handleEmployeeUpdate(updated: PayrollEmployee) {
    setEmployees((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
  }

  const selected = employees.find((e) => e.id === selectedId);

  return (
    <>
      <TwoPanelLayout
        isRightPanelOpen={!!selectedId}
        onBack={() => setSelectedId(undefined)}
        leftPanelDefaultSize={38}
        rightPanelDefaultSize={62}
        minLeftSize={22}
        minRightSize={30}
        leftPanel={
          <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
            <CardHeader className="flex-none p-4 pb-3">
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
                  employeeId={selectedId}
                  employee={selected}
                  onEmployeeUpdate={handleEmployeeUpdate}
                  onClose={() => setSelectedId(undefined)}
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

      {/* Link user dialog */}
      <Dialog open={showLinkDialog} onOpenChange={(v) => !v && setShowLinkDialog(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('linkUserTitle')}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 px-6 py-4">
            {/* User combobox — same pattern as AppointmentFormDialog patient selector */}
            <div className="space-y-1.5">
              <Label className="text-xs">{t('selectUser')}</Label>
              <Popover open={userPopoverOpen} onOpenChange={setUserPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn('w-full justify-start font-normal', !selectedUser && 'text-muted-foreground')}
                  >
                    {selectedUser ? selectedUser.name : t('selectUserPlaceholder')}
                    <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  {loadingUsers ? (
                    <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Cargando usuarios...
                    </div>
                  ) : (
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder={t('selectUserPlaceholder')}
                        value={userSearchQuery}
                        onValueChange={setUserSearchQuery}
                      />
                      <CommandList>
                        <CommandEmpty>Sin resultados</CommandEmpty>
                        <CommandGroup>
                          {filteredUsers.map((user) => (
                            <CommandItem
                              key={user.id}
                              value={user.id}
                              onSelect={() => handleSelectUser(user)}
                            >
                              <Check
                                className={cn('mr-2 h-4 w-4 shrink-0', selectedUser?.id === user.id ? 'opacity-100' : 'opacity-0')}
                              />
                              <span className="flex-1 truncate">{user.name}</span>
                              {user.identity_document && (
                                <span className="text-xs text-muted-foreground ml-2 shrink-0">{user.identity_document}</span>
                              )}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  )}
                </PopoverContent>
              </Popover>
            </div>

            {/* Selected user info + roles — only after selection */}
            {selectedUser && (
              <>
                <div className="rounded-md border bg-muted/30 px-3 py-2.5 flex flex-col gap-1 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{selectedUser.name}</span>
                    <Badge className={cn(
                      'text-xs',
                      selectedUser.is_active !== false
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                    )}>
                      {selectedUser.is_active !== false ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>
                  {selectedUser.email && (
                    <span className="text-xs text-muted-foreground">{selectedUser.email}</span>
                  )}
                  {selectedUser.phone_number && (
                    <span className="text-xs text-muted-foreground">{selectedUser.phone_number}</span>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">{t('userRoles')}</Label>
                  {!selectedUser.roles?.trim() ? (
                    <p className="text-xs text-muted-foreground">{t('noRoles')}</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedUser.roles.split('--').map((r, i) => (
                        <Badge key={i} variant="secondary" className="text-xs capitalize">
                          {r.trim()}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Category selector */}
            <div className="space-y-1.5">
              <Label className="text-xs">{t('selectCategory')}</Label>
              {loadingCategories ? (
                <Skeleton className="h-9 w-full rounded" />
              ) : (
                <Select
                  value={linkForm.category_id}
                  onValueChange={(v) => setLinkForm((p) => ({ ...p, category_id: v }))}
                >
                  <SelectTrigger>
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

            {/* Fecha ingreso */}
            <div className="space-y-1.5">
              <Label className="text-xs">{t('fechaIngreso')}</Label>
              <Input
                type="date"
                value={linkForm.fecha_ingreso}
                onChange={(e) => setLinkForm((p) => ({ ...p, fecha_ingreso: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLinkDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleLink}
              disabled={linking || !linkForm.user_id || !linkForm.category_id || !linkForm.fecha_ingreso}
            >
              {linking ? t('linking') : t('linkUser')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
