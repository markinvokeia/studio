'use client';

import * as React from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { isValidPhoneNumber } from 'libphonenumber-js';
import { AlertTriangle, Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { DatePickerInput } from '@/components/ui/date-picker';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { API_ROUTES } from '@/constants/routes';
import { api } from '@/services/api';
import { cn } from '@/lib/utils';
import type { MutualSociety, User } from '@/lib/types';

// ── Schema ───────────────────────────────────────────────────────────────────
const userFormSchema = (t: (key: string) => string) => z.object({
  id: z.string().optional(),
  name: z.string().min(1, { message: t('UsersPage.createDialog.validation.nameRequired') }),
  email: z.string().optional().refine((val) => {
    if (!val || val.trim() === '') return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  }, { message: t('UsersPage.createDialog.validation.emailInvalid') }),
  phone: z.string().optional().refine((val) => {
    if (!val || val.trim() === '') return true;
    return isValidPhoneNumber(val);
  }, { message: t('UsersPage.createDialog.validation.phoneInvalid') }),
  identity_document: z.string()
    .regex(/^\d*$/, { message: t('UsersPage.createDialog.validation.identityInvalid') })
    .max(10, { message: t('UsersPage.createDialog.validation.identityMaxLength') }),
  birth_date: z.string().optional(),
  notes: z.string().optional(),
  is_active: z.boolean().default(false),
  mutual_society_id: z.string().optional(),
  is_dependent: z.boolean().default(false),
  responsible_contact_id: z.string().nullable().optional(),
}).refine((data) => {
  if (data.is_dependent) return true;
  const hasEmail = data.email && data.email.trim() !== '';
  const hasPhone = data.phone && data.phone.trim() !== '';
  return hasEmail || hasPhone;
}, {
  message: t('UsersPage.createDialog.validation.emailOrPhoneRequired'),
  path: ['email'],
});

type UserFormValues = z.infer<ReturnType<typeof userFormSchema>>;

// ── Data helpers ───────────────────────────────────────────────────────────
function mapApiUser(apiUser: any): User {
  return {
    id: String(apiUser.user_id ?? apiUser.id ?? ''),
    name: apiUser.name || '',
    email: apiUser.email || '',
    phone_number: apiUser.phone_number || '',
    is_active: apiUser.is_active ?? true,
    avatar: '',
    identity_document: apiUser.identity_document || '',
    birth_date: apiUser.birth_date || '',
    notes: apiUser.notes || '',
    mutual_society_id: apiUser.mutual_society_id ?? undefined,
    mutual_society_name: apiUser.mutual_society_name ?? undefined,
    is_dependent: apiUser.is_dependent ?? false,
    responsible_contact_id: apiUser.responsible_contact_id || undefined,
    responsible_contact_name: apiUser.responsible_contact_name || undefined,
  };
}

export async function fetchPatientById(userId: string): Promise<User | null> {
  try {
    const data = await api.get(API_ROUTES.FILTER_USERS, { search: userId });
    const usersData = (Array.isArray(data) && data.length > 0) ? (data[0].data ?? data[0].json?.data ?? []) : (data?.data ?? []);
    const match = usersData.find((u: any) => String(u.user_id ?? u.id) === String(userId)) ?? usersData[0];
    return match ? mapApiUser(match) : null;
  } catch (error) {
    console.error('Failed to fetch patient:', error);
    return null;
  }
}

async function searchGuardianPatients(searchQuery: string, currentUserId?: string): Promise<User[]> {
  try {
    const responseData = await api.get(API_ROUTES.USERS, { search: searchQuery, filter_type: 'PACIENTE' });
    let usersData: any[] = [];
    if (Array.isArray(responseData) && responseData.length > 0) {
      const first = responseData[0];
      usersData = first.json?.data || first.data || [];
    } else if (responseData?.data) {
      usersData = responseData.data;
    }
    return usersData.map(mapApiUser).filter((u: User) => u.id !== currentUserId && !u.is_dependent);
  } catch (error) {
    console.error('Failed to search guardian patients:', error);
    return [];
  }
}

async function upsertUser(userData: UserFormValues) {
  const payload = {
    ...userData,
    mutual_society_id: userData.mutual_society_id && userData.mutual_society_id !== 'none' ? userData.mutual_society_id : null,
    responsible_contact_id: userData.responsible_contact_id || null,
    filter_type: 'PACIENTE',
    is_sales: true,
  };
  const responseData = await api.post(API_ROUTES.USERS_UPSERT, payload);
  if (responseData.error && (responseData.error.error || responseData.code > 200)) {
    const error = new Error('API Error') as any;
    error.status = responseData.code || 500;
    error.data = responseData;
    throw error;
  }
  return responseData;
}

async function getMutualSocietiesList(): Promise<MutualSociety[]> {
  try {
    const data = await api.get(API_ROUTES.MUTUAL_SOCIETIES, { page: '1', limit: '1000' });
    let raw: any[] = [];
    if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object' && 'id' in data[0] && !('json' in data[0])) {
      raw = data;
    } else if (Array.isArray(data) && data.length > 0) {
      const first = data[0];
      raw = first.json?.data || first.data || [];
    } else if (typeof data === 'object' && data !== null) {
      raw = (data[0]?.json || data).data || [];
    }
    return raw
      .map((ms: any) => ({ id: ms.id, name: ms.name, description: ms.description, code: ms.code, is_active: ms.is_active ?? true, created_at: ms.created_at, updated_at: ms.updated_at }))
      .filter((ms: MutualSociety) => ms.id != null && ms.is_active);
  } catch (error) {
    console.error('Failed to fetch mutual societies:', error);
    return [];
  }
}

// ── Responsible contact (guardian) picker for dependents ─────────────────────
export function ResponsibleContactField({
  form,
  currentUserId,
  initialDisplayName,
  onDisplayNameChange,
}: {
  form: UseFormReturn<UserFormValues>;
  currentUserId?: string;
  initialDisplayName?: string;
  onDisplayNameChange?: (name: string) => void;
}) {
  const t = useTranslations();
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<User[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);
  const [displayName, setDisplayName] = React.useState(initialDisplayName || '');

  React.useEffect(() => { setDisplayName(initialDisplayName || ''); }, [initialDisplayName, currentUserId]);
  React.useEffect(() => { onDisplayNameChange?.(displayName); }, [displayName, onDisplayNameChange]);

  React.useEffect(() => {
    const handler = setTimeout(async () => {
      if (!isOpen) { setResults([]); return; }
      setIsSearching(true);
      setResults(await searchGuardianPatients(query, currentUserId));
      setIsSearching(false);
    }, 300);
    return () => clearTimeout(handler);
  }, [query, currentUserId, isOpen]);

  return (
    <FormField
      control={form.control}
      name="responsible_contact_id"
      render={({ field }) => (
        <FormItem>
          <div className="flex items-center justify-between gap-3">
            <FormLabel>{t('UsersPage.createDialog.responsibleContact')}</FormLabel>
            {field.value && (
              <Button type="button" variant="ghost" size="sm" className="h-auto px-2 py-1 text-xs" onClick={() => { field.onChange(null); setDisplayName(''); }}>
                {t('UsersPage.createDialog.clearResponsibleContact')}
              </Button>
            )}
          </div>
          <Popover open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) setQuery(''); }}>
            <PopoverTrigger asChild>
              <FormControl>
                <Button type="button" variant="outline" role="combobox" className="w-full justify-between">
                  <span className="truncate">{displayName || t('UsersPage.createDialog.responsibleContactPlaceholder')}</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </FormControl>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <Command shouldFilter={false}>
                <CommandInput placeholder={t('UsersPage.createDialog.searchGuardianPlaceholder')} value={query} onValueChange={setQuery} />
                <CommandList>
                  <CommandEmpty>{t('UsersPage.createDialog.noGuardianResults')}</CommandEmpty>
                  <CommandGroup>
                    {isSearching && (
                      <div className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>{t('UsersPage.createDialog.searchGuardianPlaceholder')}</span>
                      </div>
                    )}
                    {results.map((guardian) => (
                      <CommandItem
                        key={guardian.id}
                        value={`${guardian.name} ${guardian.email} ${guardian.phone_number}`}
                        onSelect={() => { field.onChange(guardian.id); setDisplayName(guardian.name); setIsOpen(false); }}
                      >
                        <Check className={cn('mr-2 h-4 w-4', field.value === guardian.id ? 'opacity-100' : 'opacity-0')} />
                        <div className="min-w-0">
                          <div className="truncate">{guardian.name}</div>
                          <div className="truncate text-xs text-muted-foreground">{guardian.email || guardian.phone_number || guardian.identity_document || guardian.id}</div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

interface PatientInfoTabProps {
  userId: string;
  /** Preloaded patient — when given, the form skips fetching it (used by the patients page). */
  user?: User;
  /** Preloaded mutual societies — when given, skips fetching them. */
  mutualSocieties?: MutualSociety[];
  /** Show the notes field inline. Disable when the host has a separate notes tab. Default true. */
  showNotes?: boolean;
  /** Called after a successful save with the updated patient. */
  onSaved?: (updated: User) => void;
}

/**
 * Self-contained patient details form (demographics + notes) with edit/save.
 * Fetches the patient and mutual societies by id when not preloaded, so it can be
 * embedded anywhere (patient quick view, patients page) with only a user_id.
 */
export function PatientInfoTab({ userId, user: userProp, mutualSocieties: mutualSocietiesProp, showNotes = true, onSaved }: PatientInfoTabProps) {
  const t = useTranslations();
  const { toast } = useToast();
  const [user, setUser] = React.useState<User | null>(userProp ?? null);
  const [mutualSocieties, setMutualSocieties] = React.useState<MutualSociety[]>(mutualSocietiesProp ?? []);
  const [isLoading, setIsLoading] = React.useState(!userProp);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [responsibleContactName, setResponsibleContactName] = React.useState('');

  const infoForm = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema(t)),
    defaultValues: {
      id: '', name: '', email: '', phone: '', identity_document: '', birth_date: '',
      notes: '', is_active: true, mutual_society_id: '', is_dependent: false, responsible_contact_id: null,
    },
  });
  const isDependent = infoForm.watch('is_dependent');

  React.useEffect(() => {
    let active = true;
    const applyUser = (u: User | null, societies: MutualSociety[]) => {
      if (!active) return;
      setMutualSocieties(societies);
      if (u) {
        setUser(u);
        setResponsibleContactName(u.responsible_contact_name || '');
        infoForm.reset({
          id: u.id,
          name: u.name,
          email: u.email || '',
          phone: u.phone_number || '',
          identity_document: u.identity_document || '',
          birth_date: u.birth_date || '',
          notes: u.notes || '',
          is_active: u.is_active,
          mutual_society_id: u.mutual_society_id ? String(u.mutual_society_id) : '',
          is_dependent: u.is_dependent ?? false,
          responsible_contact_id: u.responsible_contact_id || null,
        });
      }
      setIsLoading(false);
    };

    if (userProp) {
      // Preloaded: only fetch societies if they weren't provided.
      if (mutualSocietiesProp) applyUser(userProp, mutualSocietiesProp);
      else getMutualSocietiesList().then((soc) => applyUser(userProp, soc));
    } else {
      setIsLoading(true);
      Promise.all([fetchPatientById(userId), getMutualSocietiesList()]).then(([fetchedUser, soc]) => applyUser(fetchedUser, soc));
    }
    return () => { active = false; };
  }, [userId, userProp, mutualSocietiesProp, infoForm]);

  React.useEffect(() => {
    if (!isDependent && infoForm.getValues('responsible_contact_id') !== null) {
      infoForm.setValue('responsible_contact_id', null);
    }
  }, [infoForm, isDependent]);

  const handleSave = async (data: UserFormValues) => {
    setIsSaving(true);
    setSaveError(null);
    try {
      await upsertUser(data);
      toast({ title: t('UsersPage.createDialog.editSuccessTitle'), description: t('UsersPage.createDialog.editSuccessDescription') });
      const updated: User = {
        ...(user as User),
        name: data.name,
        email: data.email || '',
        phone_number: data.phone || '',
        identity_document: data.identity_document,
        birth_date: data.birth_date,
        notes: data.notes,
        is_active: data.is_active,
        mutual_society_id: data.mutual_society_id,
        is_dependent: data.is_dependent,
        responsible_contact_id: data.responsible_contact_id || undefined,
        responsible_contact_name: data.is_dependent ? responsibleContactName || undefined : undefined,
      };
      setUser(updated);
      onSaved?.(updated);
    } catch (e: any) {
      setSaveError(e instanceof Error ? e.message : t('UsersPage.createDialog.validation.genericError'));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  return (
    <div className="pr-1">
      <Form {...infoForm}>
        <form onSubmit={infoForm.handleSubmit(handleSave)} className="space-y-4 p-2">
          {saveError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          )}
          <FormField control={infoForm.control} name="name" render={({ field }) => (
            <FormItem>
              <FormLabel>{t('UsersPage.createDialog.name')}</FormLabel>
              <FormControl><Input placeholder={t('UsersPage.createDialog.namePlaceholder')} {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={infoForm.control} name="email" render={({ field }) => (
            <FormItem>
              <FormLabel>{t('UsersPage.createDialog.email')}</FormLabel>
              <FormControl><Input type="email" placeholder={t('UsersPage.createDialog.emailPlaceholder')} {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={infoForm.control} name="phone" render={({ field }) => (
            <FormItem>
              <FormLabel>{t('UsersPage.createDialog.phone')}</FormLabel>
              <FormControl>
                <PhoneInput {...field} defaultCountry="UY" placeholder={t('UsersPage.createDialog.phonePlaceholder')} onChange={field.onChange} value={field.value} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={infoForm.control} name="identity_document" render={({ field }) => (
            <FormItem>
              <FormLabel>{t('UsersPage.createDialog.identity_document')}</FormLabel>
              <FormControl><Input placeholder={t('UsersPage.createDialog.identity_document_placeholder')} {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={infoForm.control} name="birth_date" render={({ field }) => (
            <FormItem>
              <FormLabel>{t('UsersPage.createDialog.birth_date')}</FormLabel>
              <FormControl>
                <DatePickerInput value={field.value} onChange={field.onChange} placeholder={t('UsersPage.createDialog.birth_date_placeholder')} disabledDays={(date: Date) => date > new Date() || date < new Date('1900-01-01')} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={infoForm.control} name="mutual_society_id" render={({ field }) => (
            <FormItem>
              <FormLabel>{t('UsersPage.mutualSociety.select')}</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || ''}>
                <FormControl>
                  <SelectTrigger><SelectValue placeholder={t('UsersPage.mutualSociety.select')} /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">{t('UsersPage.mutualSociety.none')}</SelectItem>
                  {mutualSocieties.map((ms) => (
                    <SelectItem key={ms.id} value={String(ms.id)}>{ms.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={infoForm.control} name="is_dependent" render={({ field }) => (
            <FormItem className="flex flex-row items-center space-x-3 space-y-0">
              <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
              <FormLabel>{t('UsersPage.createDialog.isDependent')}</FormLabel>
            </FormItem>
          )} />
          {isDependent ? (
            <ResponsibleContactField
              form={infoForm}
              currentUserId={userId}
              initialDisplayName={responsibleContactName}
              onDisplayNameChange={setResponsibleContactName}
            />
          ) : null}
          {showNotes && (
            <FormField control={infoForm.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>{t('UsersPage.notes.title')}</FormLabel>
                <FormControl>
                  <Textarea {...field} placeholder={t('UsersPage.notes.placeholder')} className="min-h-[100px] resize-none" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
          )}
          <FormField control={infoForm.control} name="is_active" render={({ field }) => (
            <FormItem className="flex flex-row items-center space-x-3 space-y-0">
              <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
              <FormLabel>{t('UsersPage.createDialog.isActive')}</FormLabel>
            </FormItem>
          )} />
          <Button type="submit" disabled={isSaving} className="w-full">
            {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('UsersPage.notes.saving')}</> : t('UsersPage.notes.save')}
          </Button>
        </form>
      </Form>
    </div>
  );
}
