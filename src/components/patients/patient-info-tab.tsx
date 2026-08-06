'use client';

import * as React from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { DatePickerInput } from '@/components/ui/date-picker';
import { DialogCancelButton } from '@/components/ui/dialog';
import { DoctorSelector } from '@/components/ui/doctor-selector';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PatientGroupsField, savePatientGroups } from '@/components/patients/patient-groups-field';
import { useReadOnly } from '@/components/patient-portal/read-only-context';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { MutualSociety, User } from '@/lib/types';
import {
  fetchPatientById,
  findPatientByName,
  getMutualSocietiesList,
  searchGuardianPatients,
  upsertUser,
  userFormSchema,
  type UserFormValues,
} from '@/components/patients/patient-form-utils';

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
  /** Patient to edit. Omit to run in create mode (empty form, upsert creates a new patient). */
  userId?: string;
  /** Preloaded patient — when given, the form skips fetching it (used by the patients page). */
  user?: User;
  /** Preloaded mutual societies — when given, skips fetching them. */
  mutualSocieties?: MutualSociety[];
  /** Show the notes field inline. Disable when the host has a separate notes tab. Default true. */
  showNotes?: boolean;
  /** Prefill for the name field in create mode (e.g. the search query typed by the user). */
  initialName?: string;
  /** Called after a successful save with the updated (or newly created) patient. */
  onSaved?: (updated: User) => void;
  /** Show the guarded Cancel action supplied by dialog hosts in custom calendar mode. */
  showCancelAction?: boolean;
  /**
   * Habilita la edición aun dentro del portal de sólo lectura. El email queda
   * bloqueado igual: es la credencial con la que el paciente recibe su código.
   */
  allowEdit?: boolean;
  /** Reports whether this form or its embedded group selector has unsaved changes. */
  onDirtyChange?: (isDirty: boolean) => void;
}

/**
 * Self-contained patient details form (demographics + notes) with edit/save.
 * Fetches the patient and mutual societies by id when not preloaded, so it can be
 * embedded anywhere (patient quick view, patients page) with only a user_id.
 */
export function PatientInfoTab({
  userId,
  user: userProp,
  mutualSocieties: mutualSocietiesProp,
  showNotes = true,
  initialName,
  onSaved,
  showCancelAction = false,
  allowEdit = false,
  onDirtyChange,
}: PatientInfoTabProps) {
  const isCreateMode = !userId && !userProp;
  // Portal del paciente. Con `allowEdit` el paciente sí puede actualizar sus
  // propios datos: sólo se bloquea el email.
  const isPortal = useReadOnly();
  const readOnly = isPortal && !allowEdit;
  // El email identifica al paciente y es a donde llega el código de acceso:
  // cambiarlo desde el portal lo dejaría afuera de su propia cuenta.
  const lockEmail = isPortal;
  const t = useTranslations();
  const { toast } = useToast();
  const [user, setUser] = React.useState<User | null>(userProp ?? null);
  const [mutualSocieties, setMutualSocieties] = React.useState<MutualSociety[]>(mutualSocietiesProp ?? []);
  const [isLoading, setIsLoading] = React.useState(!userProp);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [responsibleContactName, setResponsibleContactName] = React.useState('');
  const [doctorDisplayName, setDoctorDisplayName] = React.useState('');
  const [groupsDirty, setGroupsDirty] = React.useState(false);
  // Create mode: groups picked before the patient exists, assigned right after the upsert.
  const [pendingGroupIds, setPendingGroupIds] = React.useState<string[]>([]);

  const infoForm = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema(t)),
    defaultValues: {
      id: '', name: initialName || '', email: '', phone: '', identity_document: '', birth_date: '', address: '',
      notes: '', is_active: true, mutual_society_id: '', is_dependent: false, responsible_contact_id: null,
      doctor_id: null, sex: null,
    },
  });
  const isDependent = infoForm.watch('is_dependent');
  const isDirty = infoForm.formState.isDirty || groupsDirty;

  React.useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  React.useEffect(() => () => {
    onDirtyChange?.(false);
  }, [onDirtyChange]);

  React.useEffect(() => {
    let active = true;
    const applyUser = (u: User | null, societies: MutualSociety[]) => {
      if (!active) return;
      setMutualSocieties(societies);
      if (u) {
        setUser(u);
        setResponsibleContactName(u.responsible_contact_name || '');
        setDoctorDisplayName(u.doctor_name || '');
        infoForm.reset({
          id: u.id,
          name: u.name,
          email: u.email || '',
          phone: u.phone_number || '',
          identity_document: u.identity_document || '',
          birth_date: u.birth_date || '',
          address: u.address || '',
          notes: u.notes || '',
          is_active: u.is_active,
          mutual_society_id: u.mutual_society_id ? String(u.mutual_society_id) : '',
          is_dependent: u.is_dependent ?? false,
          responsible_contact_id: u.responsible_contact_id || null,
          doctor_id: u.doctor_id || null,
          sex: u.sex ?? null,
        });
      }
      setIsLoading(false);
    };

    if (userProp) {
      // Preloaded: only fetch societies if they weren't provided.
      const societiesPromise = mutualSocietiesProp ? Promise.resolve(mutualSocietiesProp) : getMutualSocietiesList();
      societiesPromise.then((soc) => applyUser(userProp, soc));
    } else if (!userId) {
      // Create mode: empty form, only the societies list is needed.
      const societiesPromise = mutualSocietiesProp ? Promise.resolve(mutualSocietiesProp) : getMutualSocietiesList();
      societiesPromise.then((soc) => applyUser(null, soc));
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
      if (isCreateMode) {
        await upsertUser({ ...data, id: undefined });
        toast({ title: t('UsersPage.createDialog.createSuccessTitle'), description: t('UsersPage.createDialog.createSuccessDescription') });
        // The upsert response doesn't return the record — resolve the new id by name.
        const created = await findPatientByName(data.name);
        if (created?.id && pendingGroupIds.length > 0) {
          try {
            await savePatientGroups(created.id, pendingGroupIds);
          } catch (groupsError) {
            console.error('Failed to assign groups to the new patient:', groupsError);
          }
        }
        onSaved?.(created ?? {
          id: '',
          name: data.name,
          email: data.email || '',
          phone_number: data.phone || '',
          is_active: data.is_active,
          avatar: '',
          identity_document: data.identity_document,
          birth_date: data.birth_date,
          address: data.address,
          notes: data.notes,
          doctor_id: data.doctor_id || null,
          doctor_name: doctorDisplayName || undefined,
          sex: data.sex ?? null,
        });
        return;
      }
      await upsertUser(data);
      toast({ title: t('UsersPage.createDialog.editSuccessTitle'), description: t('UsersPage.createDialog.editSuccessDescription') });
      const updated: User = {
        ...(user as User),
        name: data.name,
        email: data.email || '',
        phone_number: data.phone || '',
        identity_document: data.identity_document,
        birth_date: data.birth_date,
        address: data.address,
        notes: data.notes,
        is_active: data.is_active,
        mutual_society_id: data.mutual_society_id,
        is_dependent: data.is_dependent,
        responsible_contact_id: data.responsible_contact_id || undefined,
        responsible_contact_name: data.is_dependent ? responsibleContactName || undefined : undefined,
        doctor_id: data.doctor_id || null,
        doctor_name: doctorDisplayName || undefined,
        sex: data.sex ?? null,
      };
      setUser(updated);
      infoForm.reset(data);
      onSaved?.(updated);
    } catch (e: any) {
      const errorData = e?.data?.error || (Array.isArray(e?.data) && e.data[0]?.error);
      if (errorData?.code === 'unique_conflict' && errorData?.conflictedFields) {
        const fields = errorData.conflictedFields.map((f: string) => t(`UsersPage.createDialog.validation.fields.${f}`)).join(', ');
        setSaveError(t('UsersPage.createDialog.validation.uniqueConflict', { fields }));
      } else if (e?.status >= 500) {
        setSaveError(t('UsersPage.createDialog.validation.serverError'));
      } else {
        setSaveError(errorData?.message || (e instanceof Error ? e.message : t('UsersPage.createDialog.validation.genericError')));
      }
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
    <Form {...infoForm}>
      {/* Column capped at the host height: the fields scroll internally and the
          save footer sits right below them — hugging the form when it's short,
          pinned to the bottom edge when the form overflows. No content shows
          through the footer. */}
      <form onSubmit={infoForm.handleSubmit(handleSave)} className="flex max-h-full min-h-0 flex-col">
        {/* `fieldset disabled` desactiva de una sola vez todos los controles del
            portal del paciente. `min-w-0` neutraliza el `min-inline-size: min-content`
            que el navegador aplica a los fieldset y que rompería el flex. */}
        <fieldset disabled={readOnly} className="min-h-0 min-w-0 space-y-4 overflow-y-auto p-2">
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
          <FormField control={infoForm.control} name="identity_document" render={({ field }) => (
            <FormItem>
              <FormLabel>{t('UsersPage.createDialog.identity_document')}</FormLabel>
              <FormControl><Input placeholder={t('UsersPage.createDialog.identity_document_placeholder')} {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField control={infoForm.control} name="birth_date" render={({ field }) => (
              <FormItem>
                <FormLabel>{t('UsersPage.createDialog.birth_date')}</FormLabel>
                <FormControl>
                  <DatePickerInput value={field.value} onChange={field.onChange} placeholder={t('UsersPage.createDialog.birth_date_placeholder')} disabledDays={(date: Date) => date > new Date() || date < new Date('1900-01-01')} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={infoForm.control} name="sex" render={({ field }) => (
              <FormItem>
                <FormLabel>{t('UsersPage.createDialog.sex')}</FormLabel>
                <Select onValueChange={(value) => field.onChange(value === 'none' ? null : value)} value={field.value || 'none'}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder={t('UsersPage.createDialog.sex')} /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">{t('UsersPage.createDialog.sexNone')}</SelectItem>
                    <SelectItem value="male">{t('UsersPage.createDialog.sexMale')}</SelectItem>
                    <SelectItem value="female">{t('UsersPage.createDialog.sexFemale')}</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
          </div>
          <FormField control={infoForm.control} name="phone" render={({ field }) => (
            <FormItem>
              <FormLabel>{t('UsersPage.createDialog.phone')}</FormLabel>
              <FormControl>
                <PhoneInput {...field} defaultCountry="UY" placeholder={t('UsersPage.createDialog.phonePlaceholder')} onChange={field.onChange} value={field.value} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={infoForm.control} name="email" render={({ field }) => (
            <FormItem>
              <FormLabel>{t('UsersPage.createDialog.email')}</FormLabel>
              <FormControl>
                <Input type="email" placeholder={t('UsersPage.createDialog.emailPlaceholder')} {...field} disabled={lockEmail} />
              </FormControl>
              {lockEmail && (
                <p className="text-xs text-muted-foreground">{t('PatientPortal.info.emailLocked')}</p>
              )}
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={infoForm.control} name="address" render={({ field }) => (
            <FormItem>
              <FormLabel>{t('UsersPage.createDialog.address')}</FormLabel>
              <FormControl><Input placeholder={t('UsersPage.createDialog.addressPlaceholder')} {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          {/* Grupos, doctor asignado, dependencia y estado son campos de gestión
              interna: el paciente no los ve ni los edita en su portal. */}
          {!isPortal && (userId
            ? <PatientGroupsField patientId={userId} onDirtyChange={setGroupsDirty} />
            : <PatientGroupsField value={pendingGroupIds} onChange={setPendingGroupIds} onDirtyChange={setGroupsDirty} />)}
          {!isPortal && <FormField control={infoForm.control} name="doctor_id" render={({ field }) => (
            <FormItem>
              <FormLabel>{t('UsersPage.createDialog.doctor')}</FormLabel>
              <FormControl>
                <DoctorSelector
                  value={field.value || undefined}
                  selectedDoctorName={doctorDisplayName}
                  onValueChange={(doctorId, doctor) => {
                    field.onChange(doctorId || null);
                    setDoctorDisplayName(doctor?.name || '');
                  }}
                  placeholder={t('UsersPage.createDialog.searchDoctor')}
                  triggerText={t('UsersPage.createDialog.selectDoctor')}
                />
              </FormControl>
              {field.value && (
                <Button type="button" variant="ghost" size="sm" className="h-auto px-2 py-1 text-xs" onClick={() => { field.onChange(null); setDoctorDisplayName(''); }}>
                  {t('UsersPage.createDialog.clearDoctor')}
                </Button>
              )}
              <FormMessage />
            </FormItem>
          )} />}
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
          {!isPortal && (
            <FormField control={infoForm.control} name="is_dependent" render={({ field }) => (
              <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                <FormLabel>{t('UsersPage.createDialog.isDependent')}</FormLabel>
              </FormItem>
            )} />
          )}
          {!isPortal && isDependent ? (
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
          {/* Estado administrativo — no tiene sentido para el paciente en su propio portal */}
          {!isPortal && (
            <FormField control={infoForm.control} name="is_active" render={({ field }) => (
              <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                <FormLabel>{t('UsersPage.createDialog.isActive')}</FormLabel>
              </FormItem>
            )} />
          )}
        </fieldset>
        {/* Status-bar footer, outside the scroll area */}
        {!readOnly && (
          <div className="flex flex-none justify-end gap-2 border-t bg-card px-3 py-2">
            {showCancelAction && (
              <DialogCancelButton size="sm" disabled={isSaving}>
                {t('UsersPage.createDialog.cancel')}
              </DialogCancelButton>
            )}
            <Button type="submit" size="sm" disabled={isSaving || (isPortal && !isDirty)}>
              {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('UsersPage.notes.saving')}</> : t('UsersPage.notes.save')}
            </Button>
          </div>
        )}
      </form>
    </Form>
  );
}
