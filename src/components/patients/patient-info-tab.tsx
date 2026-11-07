'use client';

import * as React from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Check, ChevronsUpDown, Loader2, UserCheck, UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { DatePickerInput } from '@/components/ui/date-picker';
import { DialogCancelButton } from '@/components/ui/dialog';
import { DoctorSelector } from '@/components/ui/doctor-selector';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DuplicateContactDialog, UniqueConflictDialog } from '@/components/patients/duplicate-contact-dialog';
import { groupCandidates, PatientMatchDialog, type PatientMatchState } from '@/components/patients/patient-match-dialog';
import { useExistingPatientLookup } from '@/components/patients/use-existing-patient-lookup';
import { PatientFormDialogShell } from '@/components/patients/patient-form-dialog-shell';
import { PatientGroupsField, savePatientGroups } from '@/components/patients/patient-groups-field';
import { useReadOnly } from '@/components/patient-portal/read-only-context';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import { useInvalidSubmitToast } from '@/hooks/use-invalid-submit-toast';
import { PATIENTS_PERMISSIONS } from '@/constants/permissions';
import { cn, formatDisplayDate } from '@/lib/utils';
import { formatPhoneNumber } from '@/lib/phone-text';
import { IDENTITY_DOCUMENT_TYPES } from '@/lib/identity-document';
import { normalizePersonName } from '@/lib/person-name';
import { extractCreatedUserId } from '@/services/users';
import { useClinicPreferencesStore } from '@/stores/clinic-preferences-store';
import { usePatientView } from '@/stores/patient-view-store';
import type { DuplicateContactOwner, DuplicateContactOwners, IdentityDocumentType, MutualSociety, UniqueConflict, User } from '@/lib/types';
import {
  contactMovedToGuardian,
  fetchPatientById,
  findPatientByName,
  getDependantContactInfo,
  getDuplicateContactWarning,
  getMutualSocietiesList,
  getUniqueConflict,
  getUpsertErrorPayload,
  matchOwnerToUser,
  mergeTypedIntoExisting,
  userToFormValues,
  type MergeablePatientField,
  type PatientMergeResult,
  resolveUserUpsertError,
  searchGuardianPatients,
  upsertUser,
  userFormSchema,
  type UserFormValues,
} from '@/components/patients/patient-form-utils';

/** Etiqueta (clave i18n) de cada campo que se puede pasar del alta a una ficha existente. */
const MERGE_FIELD_LABEL_KEYS: Record<MergeablePatientField | 'name', string> = {
  name: 'UsersPage.createDialog.name',
  identity_document: 'UsersPage.createDialog.identity_document',
  phone: 'UsersPage.createDialog.phone',
  email: 'UsersPage.createDialog.email',
  birth_date: 'UsersPage.createDialog.birth_date',
  sex: 'UsersPage.createDialog.sex',
  address: 'UsersPage.createDialog.address',
  mutual_society_id: 'UsersPage.mutualSociety.select',
  doctor_id: 'UsersPage.createDialog.doctor',
  notes: 'UsersPage.notes.title',
};

/** Alta convertida en "completar la ficha existente" tras elegirla desde una coincidencia. */
interface CompletingExisting extends Omit<PatientMergeResult, 'values'> {
  user: User;
  /** Lo escrito en el alta, para volver a ella sin perderlo. */
  typed: UserFormValues;
}

// ── Responsible contact (guardian) picker for dependents ─────────────────────
export function ResponsibleContactField({
  form,
  currentUserId,
  initialDisplayName,
  onDisplayNameChange,
  showCancelAction = false,
  locked = false,
  onContactMoved,
}: {
  form: UseFormReturn<UserFormValues>;
  currentUserId?: string;
  initialDisplayName?: string;
  onDisplayNameChange?: (name: string) => void;
  /** Se propaga a la ventana de alta del tutor, igual que en el resto de los hosts. */
  showCancelAction?: boolean;
  /** Tutor fijado por quien abrió el formulario: se muestra pero no se puede quitar ni cambiar. */
  locked?: boolean;
  /** El alta del tutor le sacó a la ficha guardada su teléfono/correo: el host puede refrescar. */
  onContactMoved?: () => void;
}) {
  const t = useTranslations();
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const notifyPatientUpdated = usePatientView((s) => s.notifyPatientUpdated);
  const canCreatePatient = hasPermission(PATIENTS_PERMISSIONS.CREATE);
  const canAdopt = !!currentUserId && hasPermission(PATIENTS_PERMISSIONS.UPDATE);
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<User[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);
  const [displayName, setDisplayName] = React.useState(initialDisplayName || '');
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [isGuardianFormDirty, setIsGuardianFormDirty] = React.useState(false);
  const guardianName = query.trim();

  /**
   * El tutor recién creado se quedó con el contacto de esta ficha. Se lo saca al formulario
   * abierto: al guardarlo se lo devolvería, porque el upsert reescribe la ficha entera.
   */
  const handleGuardianCreated = (guardian: User) => {
    const moved = contactMovedToGuardian(
      { phone: form.getValues('phone'), email: form.getValues('email') },
      guardian,
    );
    if (moved.phone) form.setValue('phone', '', { shouldDirty: true, shouldValidate: true });
    if (moved.email) form.setValue('email', '', { shouldDirty: true, shouldValidate: true });
    if (!moved.phone && !moved.email) return;
    toast({
      title: t('DuplicateContact.adopt.movedTitle'),
      description: t('DuplicateContact.adopt.movedDescription', { name: guardian.name }),
    });
    if (currentUserId) {
      onContactMoved?.();
      fetchPatientById(currentUserId).then((u) => { if (u) notifyPatientUpdated(u); }).catch(() => {});
    }
  };

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
            {field.value && !locked && (
              <Button type="button" variant="ghost" size="sm" className="h-auto px-2 py-1 text-xs" onClick={() => { field.onChange(null); setDisplayName(''); }}>
                {t('UsersPage.createDialog.clearResponsibleContact')}
              </Button>
            )}
          </div>
          <Popover open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) setQuery(''); }}>
            <PopoverTrigger asChild>
              <FormControl>
                <Button type="button" variant="outline" role="combobox" className="w-full justify-between" disabled={locked}>
                  <span className="truncate">{displayName || t('UsersPage.createDialog.responsibleContactPlaceholder')}</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </FormControl>
            </PopoverTrigger>
            {/* `collisionPadding` para que Radix lo dé vuelta hacia arriba cuando el
                campo queda al fondo de la ventana: si no, el popover se salía de la
                pantalla y el pie con la acción de alta quedaba fuera de la vista. */}
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start" collisionPadding={12}>
              <Command shouldFilter={false}>
                <CommandInput placeholder={t('UsersPage.createDialog.searchGuardianPlaceholder')} value={query} onValueChange={setQuery} />
                {/* Arriba y fuera de `CommandList`: el popover se abre hacia abajo y con
                    la lista llena su pie puede quedar fuera de la pantalla, así que la
                    salida "el tutor no existe" tiene que estar donde siempre se ve.
                    Aparece con cualquier texto escrito y no sólo cuando no hay
                    resultados: la búsqueda del backend matchea por palabra suelta, así
                    que un tutor inexistente igual devuelve homónimos parciales. */}
                {guardianName && canCreatePatient && (
                  <div className="border-b p-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start gap-2 font-normal"
                      onClick={() => { setIsOpen(false); setIsCreateOpen(true); }}
                    >
                      <UserPlus className="h-4 w-4 shrink-0" />
                      <span className="truncate">{t('UsersPage.createDialog.createGuardian', { name: guardianName })}</span>
                    </Button>
                  </div>
                )}
                {/* Con tope de alto: sin él la lista crecía hasta pasarse del alto de
                    la ventana y empujaba la acción de alta fuera de la pantalla. */}
                <CommandList className="max-h-48">
                  {/* El vacío se arma a mano en vez de con `CommandEmpty` para poder
                      distinguir "todavía no escribiste" de "no hay nadie con ese
                      nombre". */}
                  {!isSearching && results.length === 0 && (
                    <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                      {guardianName ? t('UsersPage.createDialog.noGuardianResults') : t('UsersPage.createDialog.searchGuardianHint')}
                    </p>
                  )}
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
                          <div className="truncate text-xs text-muted-foreground">{guardian.email || formatPhoneNumber(guardian.phone_number) || guardian.identity_document || guardian.id}</div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {/* Fuera del `Popover`: al abrir la ventana el popover se cierra, y si el
              diálogo colgara de su contenido se desmontaría con él. Al tutor no se le
              ofrece la casilla de dependiente —sería un tutor a cargo de otro tutor—,
              y eso además corta la recursión: sin esa casilla no hay otro picker. */}
          <PatientFormDialogShell
            open={isCreateOpen}
            onOpenChange={setIsCreateOpen}
            title={t('UsersPage.createDialog.createGuardianTitle')}
            description={t('UsersPage.createDialog.createGuardianDescription')}
            confirmOnClose={showCancelAction}
            isDirty={isGuardianFormDirty}
          >
            {isCreateOpen && (
              <PatientInfoTab
                variant="dialog"
                initialName={guardianName}
                initialContact={{
                  phone: form.getValues('phone'),
                  email: form.getValues('email'),
                  address: form.getValues('address'),
                }}
                adoptDependentId={canAdopt ? currentUserId : undefined}
                showDependentField={false}
                showCancelAction={showCancelAction}
                onDirtyChange={setIsGuardianFormDirty}
                onSaved={(created) => {
                  setIsCreateOpen(false);
                  // El alta resuelve el id buscando por nombre; si no lo encuentra
                  // llega un `User` armado con id vacío, que no sirve para vincular.
                  if (!created.id) return;
                  field.onChange(String(created.id));
                  setDisplayName(created.name);
                  setQuery('');
                  handleGuardianCreated(created);
                }}
              />
            )}
          </PatientFormDialogShell>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/** Lo que el formulario de un dependiente sin guardar le entrega a quien guarda el borrador. */
export interface DependentDraftFormData {
  values: UserFormValues;
  groupIds: string[];
  doctorName: string;
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
  /**
   * Called after a successful save with the updated (or newly created) patient. Si devuelve
   * una promesa, el botón Guardar sigue ocupado hasta que termine.
   */
  onSaved?: (updated: User) => void | Promise<void>;
  /** Show the guarded Cancel action supplied by dialog hosts in custom calendar mode. */
  showCancelAction?: boolean;
  /**
   * Habilita la edición aun dentro del portal de sólo lectura. El email queda
   * bloqueado igual: es la credencial con la que el paciente recibe su código.
   */
  allowEdit?: boolean;
  /** Reports whether this form or its embedded group selector has unsaved changes. */
  onDirtyChange?: (isDirty: boolean) => void;
  /**
   * De dónde cuelga el formulario, que es lo único que cambia entre hosts: el
   * padding. `tab` (default) es el panel de pestañas del paciente, que ya trae su
   * propio `p-3`; `dialog` es una ventana modal, donde los campos tienen que
   * alinearse con el `px-6` de la cabecera en vez de pegarse al borde.
   */
  variant?: 'tab' | 'dialog';
  /**
   * Muestra la casilla "paciente dependiente" y, con ella, el picker de tutor.
   * Se apaga cuando el paciente que se está creando *es* el tutor de otro: un
   * tutor a cargo de un tutor no tiene sentido, y sin la casilla el formulario no
   * se puede volver a abrir a sí mismo.
   */
  showDependentField?: boolean;
  /**
   * Alta de un dependiente desde la ficha del tutor: el formulario arranca marcado
   * como dependiente y con ese tutor elegido. Solo aplica en modo alta.
   */
  initialResponsible?: { id: string; name: string };
  /** Alta del tutor desde la ficha del dependiente: arranca con los datos de contacto de esa ficha. */
  initialContact?: { phone?: string; email?: string; address?: string };
  /**
   * Alta del tutor desde una ficha guardada: esa ficha le cede el contacto que tengan en
   * común y queda a su cargo. Es el mismo traspaso que se ofrece al chocar con un dueño,
   * pero sin chocar: quien lo pide ya dijo que esa ficha depende de este paciente.
   */
  adoptDependentId?: string;
  /**
   * Alta desde una cita: si la cédula, el correo o el teléfono ya son de otra ficha, deja
   * elegir esa ficha (recibe el paciente existente) en vez de crear un duplicado. Sin esto
   * el formulario solo advierte o bloquea. Solo aplica en modo alta.
   */
  onSelectExisting?: (user: User) => void | Promise<void>;
  /**
   * Dependiente que todavía no se guarda porque su tutor tampoco existe: el formulario valida
   * y entrega los datos en vez de llamar al backend. Requiere `initialResponsible`.
   */
  draftDependent?: {
    initial?: DependentDraftFormData;
    onSubmit: (data: DependentDraftFormData) => void;
  };
  /**
   * Lugar para los dependientes del paciente, debajo de la casilla "dependiente" (no se
   * muestra si está marcada). Es una función porque el contenido vuelve a usar este
   * formulario, y un import directo sería circular.
   */
  renderDependents?: (context: { patient: User | null; guardianName: string }) => React.ReactNode;
  /** Hay dependientes cargados sin guardar: mientras tanto el paciente no puede ser dependiente. */
  lockDependentCheckbox?: boolean;
  /** Avisa al host que el alta pasó a completar una ficha existente (su nombre) o volvió (`null`). */
  onCompletingChange?: (name: string | null) => void;
  /** El alta del tutor le sacó a esta ficha su teléfono/correo: el host puede refrescar lo que muestra. */
  onContactMoved?: () => void;
}

/** Padding del área de campos y del pie de guardado, por host. */
const VARIANT_PADDING = {
  tab: { body: 'p-2', footer: 'px-3 py-2' },
  dialog: { body: 'px-6 py-4', footer: 'px-6 py-3' },
} as const;

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
  variant = 'tab',
  showDependentField = true,
  initialResponsible,
  initialContact,
  adoptDependentId,
  onSelectExisting,
  draftDependent,
  renderDependents,
  lockDependentCheckbox = false,
  onCompletingChange,
  onContactMoved,
}: PatientInfoTabProps) {
  const padding = VARIANT_PADDING[variant];
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
  // Alta desde "Dependientes": el vínculo con el tutor es el motivo del alta, así que
  // la casilla y el tutor quedan fijos (cambiarlos crearía un paciente suelto o colgado
  // de otro tutor mientras la pestaña lo espera en la lista).
  const presetResponsible = isCreateMode ? initialResponsible : undefined;
  const [responsibleContactName, setResponsibleContactName] = React.useState(presetResponsible?.name ?? '');
  const [doctorDisplayName, setDoctorDisplayName] = React.useState(draftDependent?.initial?.doctorName ?? '');
  const [groupsDirty, setGroupsDirty] = React.useState(false);
  // Create mode: groups picked before the patient exists, assigned right after the upsert.
  const [pendingGroupIds, setPendingGroupIds] = React.useState<string[]>(draftDependent?.initial?.groupIds ?? []);
  // Otro paciente ya usa este teléfono/correo: se pide confirmación antes de guardar.
  const [duplicateWarning, setDuplicateWarning] = React.useState<{ owners: DuplicateContactOwners; data: UserFormValues } | null>(null);
  // Dato que no se puede repetir: modal en vez de texto inline, que no se ve con el form scrolleado.
  const [uniqueConflict, setUniqueConflict] = React.useState<(UniqueConflict & { data: UserFormValues }) | null>(null);
  // Alta desde una cita: coincidencias con fichas existentes, con la opción de elegir una.
  const [patientMatch, setPatientMatch] = React.useState<(PatientMatchState & { data?: UserFormValues }) | null>(null);
  const savingRef = React.useRef(false);
  // Ficha existente elegida en lugar del alta, con los datos del alta que le faltaban.
  const [completing, setCompleting] = React.useState<CompletingExisting | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const { hasPermission } = usePermissions();
  const notifyPatientUpdated = usePatientView((s) => s.notifyPatientUpdated);
  const canSelectExisting = isCreateMode && !!onSelectExisting && (!presetResponsible || !!draftDependent) && !completing;
  const completingName = completing?.user.name ?? null;
  React.useEffect(() => {
    onCompletingChange?.(completingName);
  }, [completingName, onCompletingChange]);

  const identityDocumentRequired = useClinicPreferencesStore((s) => s.preferences.identity_document_required);
  const onInvalidSubmit = useInvalidSubmitToast();
  const infoForm = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema(t, { identityDocumentRequired, originalName: user?.name })),
    defaultValues: draftDependent?.initial?.values ?? {
      id: '', name: initialName || '', email: initialContact?.email || '', phone: initialContact?.phone || '', identity_document: '', identity_document_type: 'cedula_uy', birth_date: '', address: initialContact?.address || '',
      notes: '', is_active: true, mutual_society_id: '',
      is_dependent: !!presetResponsible, responsible_contact_id: presetResponsible?.id ?? null,
      doctor_id: null, sex: null,
    },
  });
  const isDependent = infoForm.watch('is_dependent');
  const existingMatches = useExistingPatientLookup({
    enabled: canSelectExisting && !readOnly,
    identityDocument: infoForm.watch('identity_document') ?? '',
    identityDocumentType: infoForm.watch('identity_document_type') as IdentityDocumentType,
    phone: infoForm.watch('phone') ?? '',
  });
  const isDirty = infoForm.formState.isDirty || groupsDirty;
  const loadedUserIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  React.useEffect(() => () => {
    onDirtyChange?.(false);
  }, [onDirtyChange]);

  // La lista llega aparte de la ficha: que se recargue no tiene que tocar el formulario.
  React.useEffect(() => {
    if (mutualSocietiesProp) setMutualSocieties(mutualSocietiesProp);
  }, [mutualSocietiesProp]);

  const hasSocietiesProp = !!mutualSocietiesProp;
  React.useEffect(() => {
    let active = true;
    const applyUser = (u: User | null, societies: MutualSociety[] | null) => {
      if (!active) return;
      if (societies) setMutualSocieties(societies);
      if (u) {
        setUser(u);
        // La misma ficha puede volver a llegar mientras se edita (el host refrescó sus datos):
        // se actualiza lo que no se tocó y se conserva lo que la persona ya cambió.
        const sameRecord = loadedUserIdRef.current === u.id;
        loadedUserIdRef.current = u.id;
        const { dirtyFields } = infoForm.formState;
        if (!sameRecord || !dirtyFields.responsible_contact_id) {
          setResponsibleContactName(u.responsible_contact_name || '');
        }
        if (!sameRecord || !dirtyFields.doctor_id) {
          setDoctorDisplayName(u.doctor_name || '');
        }
        infoForm.reset(userToFormValues(u), { keepDirtyValues: sameRecord });
      }
      setIsLoading(false);
    };

    if (userProp) {
      // Preloaded: only fetch societies if they weren't provided.
      (hasSocietiesProp ? Promise.resolve(null) : getMutualSocietiesList()).then((soc) => applyUser(userProp, soc));
    } else if (!userId) {
      // Create mode: empty form, only the societies list is needed.
      (hasSocietiesProp ? Promise.resolve(null) : getMutualSocietiesList()).then((soc) => applyUser(null, soc));
    } else {
      setIsLoading(true);
      Promise.all([fetchPatientById(userId), getMutualSocietiesList()]).then(([fetchedUser, soc]) => applyUser(fetchedUser, soc));
    }
    return () => { active = false; };
  }, [userId, userProp, hasSocietiesProp, infoForm]);

  React.useEffect(() => {
    if (!isDependent && infoForm.getValues('responsible_contact_id') !== null) {
      infoForm.setValue('responsible_contact_id', null);
    }
  }, [infoForm, isDependent]);

  // The /users list endpoint returns `responsible_contact_id` but not its name, so a dependent
  // patient's guardian picker would render empty. Resolve the name via /user_dependant.
  React.useEffect(() => {
    let cancelled = false;
    if (!user?.is_dependent || !user.responsible_contact_id || user.responsible_contact_name) return;
    getDependantContactInfo(user.id).then((info) => {
      if (!cancelled && info?.name) setResponsibleContactName(info.name);
    });
    return () => { cancelled = true; };
  }, [user]);

  // Poner a otra ficha a cargo de este paciente la modifica: hace falta permiso de edición, y
  // un dependiente no puede tener dependientes.
  const canAdoptDependents = !isPortal && !isDependent && !presetResponsible && hasPermission(PATIENTS_PERMISSIONS.UPDATE);

  /** Las fichas recién pasadas a dependientes cambiaron: la agenda y sus paneles las muestran. */
  const notifyAdopted = (ids: string[]) => {
    ids.forEach((id) => {
      fetchPatientById(id).then((u) => { if (u) notifyPatientUpdated(u); }).catch(() => {});
    });
  };

  const handleSave = async (formData: UserFormValues, confirmDuplicates = false, adoptIds: string[] = []) => {
    const data = presetResponsible
      ? { ...formData, is_dependent: true, responsible_contact_id: presetResponsible.id }
      : formData;
    if (draftDependent) {
      draftDependent.onSubmit({ values: data, groupIds: pendingGroupIds, doctorName: doctorDisplayName });
      return;
    }
    const adoptDependentIds = adoptDependentId ? [adoptDependentId, ...adoptIds] : adoptIds;
    const adoptedToast = adoptIds.length > 0
      ? { title: t('DuplicateContact.adopt.successTitle'), description: t('DuplicateContact.adopt.successDescription', { count: adoptIds.length }) }
      : null;
    // `isSaving` llega un render tarde: Enter + clic podría crear la ficha dos veces.
    if (savingRef.current) return;
    savingRef.current = true;
    setIsSaving(true);
    setSaveError(null);
    try {
      if (isCreateMode && !completing) {
        const response = await upsertUser({ ...data, id: undefined }, { confirmDuplicates, adoptDependentIds });
        const createdId = extractCreatedUserId(response);
        // Con el id no se busca por nombre: con homónimos podría devolver a otra persona.
        // El nombre queda solo para el flujo de n8n anterior, que no devuelve el id.
        const fetched = createdId ? await fetchPatientById(createdId) : await findPatientByName(data.name);
        const created = !createdId || fetched?.id === createdId ? fetched : null;
        const resolvedId = createdId ?? created?.id ?? '';
        // Sin id, quien abrió el alta (p. ej. la cita) no puede seleccionarlo: se avisa
        // en vez de dejar el selector vacío sin explicación.
        toast(adoptedToast ?? {
          title: t('UsersPage.createDialog.createSuccessTitle'),
          description: resolvedId
            ? t('UsersPage.createDialog.createSuccessDescription')
            : t('UsersPage.createDialog.createdNotResolvedDescription'),
        });
        notifyAdopted(adoptIds);
        if (resolvedId && pendingGroupIds.length > 0) {
          try {
            await savePatientGroups(resolvedId, pendingGroupIds);
          } catch (groupsError) {
            console.error('Failed to assign groups to the new patient:', groupsError);
          }
        }
        await onSaved?.(created ?? {
          id: resolvedId,
          name: normalizePersonName(data.name),
          email: data.email || '',
          phone_number: data.phone || '',
          is_active: data.is_active,
          avatar: '',
          identity_document: data.identity_document,
          identity_document_type: data.identity_document_type as User['identity_document_type'],
          birth_date: data.birth_date,
          address: data.address,
          notes: data.notes,
          doctor_id: data.doctor_id || null,
          doctor_name: doctorDisplayName || undefined,
          sex: data.sex ?? null,
        });
        return;
      }
      await upsertUser(data, { confirmDuplicates, adoptDependentIds });
      toast(adoptedToast ?? (completing
        ? { title: t('PatientMatch.completedTitle'), description: t('PatientMatch.completedDescription', { name: data.name }) }
        : { title: t('UsersPage.createDialog.editSuccessTitle'), description: t('UsersPage.createDialog.editSuccessDescription') }));
      notifyAdopted(adoptIds);
      const updated: User = {
        ...(user as User),
        name: data.name,
        email: data.email || '',
        phone_number: data.phone || '',
        identity_document: data.identity_document,
        identity_document_type: data.identity_document_type as User['identity_document_type'],
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
      // Ficha existente completada desde una cita: se usa en la cita en vez de crear otra.
      if (completing) await onSelectExisting?.(updated);
      else await onSaved?.(updated);
    } catch (e: any) {
      const duplicateOwners = getDuplicateContactWarning(e);
      const conflict = getUniqueConflict(getUpsertErrorPayload(e));
      if (canSelectExisting && (duplicateOwners || conflict)) {
        setPatientMatch(duplicateOwners
          ? { reason: 'warning', owners: duplicateOwners, data }
          : { reason: 'conflict', owners: conflict!.owners, conflictedFields: conflict!.conflictedFields, data });
      } else if (duplicateOwners) {
        setDuplicateWarning({ owners: duplicateOwners, data });
      } else if (conflict) {
        setUniqueConflict({ ...conflict, data });
      } else {
        setSaveError(
          resolveUserUpsertError(e, t)
            || (e instanceof Error ? e.message : t('UsersPage.createDialog.validation.genericError')),
        );
      }
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  /** Vincula la ficha existente a la cita tal como está. */
  const linkExisting = (selected: User) => {
    toast({
      title: t('PatientMatch.selectedTitle'),
      description: t('PatientMatch.selectedDescription', { name: selected.name }),
    });
    onSelectExisting?.(selected);
  };

  /**
   * Usa la ficha existente (traída completa: doctor por defecto, tutor). Si lo escrito en el
   * alta le agrega algo, el formulario pasa a completar esa ficha: nada de lo cargado se
   * pierde y se guarda sobre la misma ficha antes de vincularla a la cita.
   */
  const selectExisting = async (owner: DuplicateContactOwner) => {
    const fetched = await fetchPatientById(String(owner.id));
    const existing = fetched?.id === String(owner.id) ? fetched : null;
    setPatientMatch(null);
    // Sin la ficha completa no se puede guardar encima (el upsert reescribe todo) y sin
    // permiso de edición tampoco: se vincula como está. Un borrador de dependiente tampoco
    // completa la ficha: solo la pone a cargo del tutor.
    if (!existing || !hasPermission(PATIENTS_PERMISSIONS.UPDATE) || draftDependent) {
      linkExisting(existing ?? matchOwnerToUser(owner));
      return;
    }
    const typed = infoForm.getValues();
    const { values, added, differing } = mergeTypedIntoExisting(userToFormValues(existing), typed);
    if (!added.length && !differing.length) {
      linkExisting(existing);
      return;
    }
    setUser(existing);
    setResponsibleContactName(existing.responsible_contact_name || '');
    // El doctor elegido en el alta se conserva si la ficha no tenía uno.
    if (!added.includes('doctor_id')) setDoctorDisplayName(existing.doctor_name || '');
    // Se compara contra el alta vacía: cerrar la ventana sigue pidiendo confirmación.
    infoForm.reset(values, { keepDefaultValues: true });
    setCompleting({ user: existing, typed, added, differing });
    scrollRef.current?.scrollTo({ top: 0 });
  };

  /** Descarta la ficha elegida y vuelve al alta con lo que se había escrito. */
  const backToNewPatient = () => {
    if (!completing) return;
    setUser(null);
    setResponsibleContactName('');
    infoForm.reset(completing.typed, { keepDefaultValues: true });
    setCompleting(null);
  };

  /** Valor legible de un campo en el resumen de diferencias. */
  const formatMergeValue = (field: MergeablePatientField | 'name', value: string) =>
    field === 'birth_date' ? formatDisplayDate(value) : value;

  /** Marca junto a la etiqueta de un campo completado con lo escrito en el alta. */
  const addedMark = (field: MergeablePatientField) =>
    completing?.added.includes(field) ? (
      <Badge variant="outline" className="ml-2 border-emerald-500/50 px-1.5 py-0 text-[10px] font-normal text-emerald-700 dark:text-emerald-400">
        {t('PatientMatch.completing.addedBadge')}
      </Badge>
    ) : null;

  // Coincidencias de cédula y teléfono juntas: la misma ficha aparece una sola vez.
  const existingMatchOwners = { identity_document: existingMatches.identity_document, phone: existingMatches.phone };
  const existingCandidates = groupCandidates(existingMatchOwners);
  // El aviso va debajo del último campo que coincidió, cerca de donde se está escribiendo.
  const existingMatchAnchor = existingMatches.phone.length ? 'phone' : 'identity_document';

  /** Aviso con las fichas que ya tienen esa cédula o ese teléfono; abre el detalle para elegir. */
  const renderExistingMatchHint = (field: 'identity_document' | 'phone') => {
    if (field !== existingMatchAnchor || !existingCandidates.length) return null;
    const shown = existingCandidates.slice(0, 3);
    return (
      <Alert className="border-amber-500/40 bg-amber-50 py-2 dark:bg-amber-950/30" data-help-id="appointments.section.existing-patient-hint">
        <AlertTriangle className="h-4 w-4 !text-amber-600" />
        <AlertDescription className="space-y-2 text-sm">
          <p className="font-medium">{t('PatientMatch.hint.title', { count: existingCandidates.length })}</p>
          <ul className="space-y-1">
            {shown.map(({ owner, fields }) => (
              <li key={owner.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="font-semibold">{owner.name}</span>
                {fields.map((matched) => (
                  <Badge key={matched} variant="outline" className="px-1.5 py-0 text-[10px] font-normal">
                    {t(`PatientMatch.matchedBy.${matched}`)}
                  </Badge>
                ))}
                {(owner.document || owner.phone_number) && (
                  <span className="text-xs text-muted-foreground">
                    {[
                      owner.document && t('DuplicateContact.document', { value: owner.document }),
                      owner.phone_number && t('PatientMatch.phone', { value: owner.phone_number }),
                    ].filter(Boolean).join(' · ')}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {existingCandidates.length > shown.length && (
            <p className="text-xs text-muted-foreground">
              {t('PatientMatch.hint.more', { count: existingCandidates.length - shown.length })}
            </p>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7"
            onClick={() => setPatientMatch({ reason: 'lookup', owners: existingMatchOwners })}
            data-help-id="appointments.btn.review-patient-matches"
          >
            {t('PatientMatch.review')}
          </Button>
        </AlertDescription>
      </Alert>
    );
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
      {/* `stopPropagation`: este formulario se abre dentro de otro (tutor, dependiente) y React
          sube el `submit` por el árbol de componentes aunque la ventana esté en un portal.
          Sin esto, guardar el de adentro también enviaría el de afuera. */}
      <form
        onSubmit={(event) => {
          event.stopPropagation();
          return infoForm.handleSubmit((data) => handleSave(data), onInvalidSubmit)(event);
        }}
        className="flex max-h-full min-h-0 flex-col"
      >
        {/* El scroll va en este div y no en el `fieldset`: Chrome no hace scrollable
            la caja de un fieldset —renderiza su contenido en una caja anónima—, así
            que con `overflow-y-auto` sobre el fieldset la rueda no hacía nada y su
            `scrollTop` se quedaba en 0 aunque `scrollHeight` superara al alto
            visible. Resultado: los campos de abajo quedaban recortados y sin forma
            de llegar a ellos. */}
        <div ref={scrollRef} className={cn('min-h-0 overflow-y-auto', padding.body)}>
          {/* `fieldset disabled` desactiva de una sola vez todos los controles del
              portal del paciente. `min-w-0` neutraliza el `min-inline-size: min-content`
              que el navegador aplica a los fieldset y que rompería el flex. */}
          <fieldset disabled={readOnly} className="min-w-0 space-y-4">
            {completing && (
              <Alert className="border-sky-500/40 bg-sky-50 dark:bg-sky-950/30" data-help-id="appointments.section.completing-existing">
                <UserCheck className="h-4 w-4 !text-sky-600" />
                <AlertTitle>{t('PatientMatch.completing.title', { name: completing.user.name })}</AlertTitle>
                <AlertDescription className="space-y-2 text-sm">
                  {completing.added.length > 0 && (
                    <p>
                      {t('PatientMatch.completing.added', {
                        fields: completing.added.map((field) => t(MERGE_FIELD_LABEL_KEYS[field])).join(', '),
                      })}
                    </p>
                  )}
                  {completing.differing.length > 0 && (
                    <div>
                      <p>{t('PatientMatch.completing.differingIntro')}</p>
                      <ul className="ml-4 list-disc text-xs text-muted-foreground">
                        {completing.differing.map(({ field, typed, existing }) => (
                          <li key={field}>
                            {typed !== null && existing !== null
                              ? t('PatientMatch.completing.differingValue', {
                                field: t(MERGE_FIELD_LABEL_KEYS[field]),
                                typed: formatMergeValue(field, typed),
                                existing: formatMergeValue(field, existing),
                              })
                              : t('PatientMatch.completing.differingField', { field: t(MERGE_FIELD_LABEL_KEYS[field]) })}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">{t('PatientMatch.completing.hint')}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7"
                      disabled={isSaving}
                      onClick={() => linkExisting(completing.user)}
                      data-help-id="appointments.btn.use-existing-without-changes"
                    >
                      {t('PatientMatch.completing.useWithoutChanges')}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7"
                      disabled={isSaving}
                      onClick={backToNewPatient}
                      data-help-id="appointments.btn.back-to-new-patient"
                    >
                      {t('PatientMatch.completing.backToNew')}
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}
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
            <FormField control={infoForm.control} name="identity_document_type" render={({ field }) => (
              <FormItem>
                <FormLabel>{t('UsersPage.createDialog.identity_document_type')}</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {IDENTITY_DOCUMENT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {t(`UsersPage.createDialog.identityDocumentTypes.${type}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={infoForm.control} name="identity_document" render={({ field }) => (
              <FormItem>
                <FormLabel>{t('UsersPage.createDialog.identity_document')}{addedMark('identity_document')}</FormLabel>
                <FormControl><Input placeholder={t('UsersPage.createDialog.identity_document_placeholder')} {...field} /></FormControl>
                <FormMessage />
                {renderExistingMatchHint('identity_document')}
              </FormItem>
            )} />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField control={infoForm.control} name="birth_date" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('UsersPage.createDialog.birth_date')}{addedMark('birth_date')}</FormLabel>
                  <FormControl>
                    <DatePickerInput value={field.value} onChange={field.onChange} placeholder={t('UsersPage.createDialog.birth_date_placeholder')} disabledDays={(date: Date) => date > new Date() || date < new Date('1900-01-01')} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={infoForm.control} name="sex" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('UsersPage.createDialog.sex')}{addedMark('sex')}</FormLabel>
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
                <FormLabel>{t('UsersPage.createDialog.phone')}{addedMark('phone')}</FormLabel>
                <FormControl>
                  <PhoneInput {...field} defaultCountry="UY" onChange={field.onChange} value={field.value} />
                </FormControl>
                <FormMessage />
                {renderExistingMatchHint('phone')}
              </FormItem>
            )} />
            <FormField control={infoForm.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel>{t('UsersPage.createDialog.email')}{addedMark('email')}</FormLabel>
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
                <FormLabel>{t('UsersPage.createDialog.address')}{addedMark('address')}</FormLabel>
                <FormControl><Input placeholder={t('UsersPage.createDialog.addressPlaceholder')} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            {/* Grupos, doctor asignado, dependencia y estado son campos de gestión
                interna: el paciente no los ve ni los edita en su portal. */}
            {!isPortal && (userId || completing
              ? <PatientGroupsField patientId={userId || completing!.user.id} onDirtyChange={setGroupsDirty} />
              : <PatientGroupsField value={pendingGroupIds} onChange={setPendingGroupIds} onDirtyChange={setGroupsDirty} />)}
            {!isPortal && <FormField control={infoForm.control} name="doctor_id" render={({ field }) => (
              <FormItem>
                <FormLabel>{t('UsersPage.createDialog.doctor')}{addedMark('doctor_id')}</FormLabel>
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
                <FormLabel>{t('UsersPage.mutualSociety.select')}{addedMark('mutual_society_id')}</FormLabel>
                {/* Si el valor llega antes que su opción (la lista carga aparte), el Select dispara un
                    cambio con '' y guardar borraría la mutualista. Elegir "Sin asignar" manda 'none'. */}
                <Select onValueChange={(value) => { if (value) field.onChange(value); }} value={field.value || ''}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder={t('UsersPage.mutualSociety.select')} /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">{t('UsersPage.mutualSociety.none')}</SelectItem>
                    {/* Mientras no llega la lista, o si la mutualista de la ficha ya no está activa. */}
                    {field.value && field.value !== 'none' && !mutualSocieties.some((ms) => String(ms.id) === field.value) && (
                      <SelectItem value={field.value}>{user?.mutual_society_name || t('Common.loading')}</SelectItem>
                    )}
                    {mutualSocieties.map((ms) => (
                      <SelectItem key={ms.id} value={String(ms.id)}>{ms.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            {!isPortal && showDependentField && (
              <FormField control={infoForm.control} name="is_dependent" render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                  <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={!!presetResponsible || lockDependentCheckbox} /></FormControl>
                  <FormLabel>{t('UsersPage.createDialog.isDependent')}</FormLabel>
                </FormItem>
              )} />
            )}
            {!isPortal && showDependentField && lockDependentCheckbox && (
              <p className="text-xs text-muted-foreground">{t('UsersPage.dependents.draft.checkboxLocked')}</p>
            )}
            {!isPortal && showDependentField && isDependent ? (
              <ResponsibleContactField
                form={infoForm}
                currentUserId={user?.id ?? userId}
                initialDisplayName={responsibleContactName}
                onDisplayNameChange={setResponsibleContactName}
                showCancelAction={showCancelAction}
                locked={!!presetResponsible}
                onContactMoved={onContactMoved}
              />
            ) : null}
            {!isPortal && !isDependent && renderDependents?.({
              patient: user,
              guardianName: normalizePersonName(infoForm.watch('name') ?? ''),
            })}
            {showNotes && (
              <FormField control={infoForm.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('UsersPage.notes.title')}{addedMark('notes')}</FormLabel>
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
        </div>
        {/* Status-bar footer, outside the scroll area */}
        {!readOnly && (
          <div className={cn('flex flex-none justify-end gap-2 border-t bg-card', padding.footer)}>
            {showCancelAction && (
              <DialogCancelButton size="sm" disabled={isSaving}>
                {t('UsersPage.createDialog.cancel')}
              </DialogCancelButton>
            )}
            <Button type="submit" size="sm" disabled={isSaving || (isPortal && !isDirty)}>
              {isSaving
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('UsersPage.notes.saving')}</>
                : completing
                  ? t('PatientMatch.completing.saveAndUse')
                  : draftDependent ? t('UsersPage.dependents.draft.submit') : t('UsersPage.notes.save')}
            </Button>
          </div>
        )}
      </form>
      <DuplicateContactDialog
        owners={duplicateWarning?.owners ?? null}
        onCancel={() => setDuplicateWarning(null)}
        onConfirm={() => {
          const pending = duplicateWarning;
          setDuplicateWarning(null);
          if (pending) void handleSave(pending.data, true);
        }}
        onAdopt={canAdoptDependents ? (ids) => {
          const pending = duplicateWarning;
          setDuplicateWarning(null);
          // Si otra ficha sigue compartiendo el teléfono, ya se la mostró: no se vuelve a preguntar.
          if (pending) void handleSave(pending.data, true, ids);
        } : undefined}
      />
      <UniqueConflictDialog
        conflict={uniqueConflict}
        onClose={() => setUniqueConflict(null)}
        onAdopt={canAdoptDependents ? (ids) => {
          const pending = uniqueConflict;
          setUniqueConflict(null);
          if (pending) void handleSave(pending.data, false, ids);
        } : undefined}
      />
      <PatientMatchDialog
        match={patientMatch}
        onSelect={selectExisting}
        onCancel={() => setPatientMatch(null)}
        onCreateAnyway={() => {
          const pending = patientMatch?.data;
          setPatientMatch(null);
          if (pending) void handleSave(pending, true);
        }}
        onAdopt={canAdoptDependents ? (ids) => {
          const pending = patientMatch;
          setPatientMatch(null);
          if (pending?.data) void handleSave(pending.data, pending.reason === 'warning', ids);
        } : undefined}
      />
    </Form>
  );
}
