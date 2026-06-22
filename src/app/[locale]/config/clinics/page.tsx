
'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogBody, DialogCancelButton, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PhoneInput } from '@/components/ui/phone-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { BUSINESS_CONFIG_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { Clinic, Sede } from '@/lib/types';
import { api } from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { isValidPhoneNumber } from 'libphonenumber-js';
import { AlertTriangle, Building, Building2, Info, Loader2, Mail, MapPin, Pencil, Phone, Plus, RefreshCw, Trash2, UploadCloud } from 'lucide-react';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

const ClinicsSedesMap = dynamic(
    () => import('@/components/config/clinics-sedes-map'),
    { ssr: false, loading: () => <Skeleton className="h-full w-full rounded-lg" /> }
);

// ─── Zod schema for sede form ────────────────────────────────────────────────

const sedeFormSchema = (t: (key: string) => string) =>
    z.object({
        id: z.string().optional(),
        name: z.string().min(1, t('SedesPage.validation.nameRequired')),
        address: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().optional().refine(
            (val) => !val || val.trim() === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
            { message: t('SedesPage.validation.emailInvalid') }
        ),
        is_active: z.boolean().default(true),
    });

type SedeFormValues = z.infer<ReturnType<typeof sedeFormSchema>>;

// ─── API helpers ─────────────────────────────────────────────────────────────

interface ClinicFallbacks { name: string; location: string; }

async function getClinic(fallbacks: ClinicFallbacks): Promise<Clinic | null> {
    try {
        const data = await api.get(API_ROUTES.CLINIC);
        const clinicsData = Array.isArray(data) ? data : (data.clinics || data.data || data.result || []);
        if (clinicsData.length === 0) return null;
        const c = clinicsData[0];
        return {
            id: c.id ? String(c.id) : `cli_${Math.random().toString(36).substr(2, 9)}`,
            name: c.name || fallbacks.name,
            location: c.address || fallbacks.location,
            contact_email: c.email || 'no-email@example.com',
            phone_number: c.phone || '000-000-0000',
            currency: c.currency || 'USD',
            rut: c.rut || '',
            razon_social: c.razon_social || '',
            domicilio_fiscal: c.domicilio_fiscal || '',
            bps_empresa_nro: c.bps_empresa_nro || '',
            bps_grupo: c.bps_grupo || '',
            bps_subgrupo: c.bps_subgrupo || '',
            bse_nro: c.bse_nro || '',
            mtss_planilla_nro: c.mtss_planilla_nro || '',
            banco_empresa: c.banco_empresa || '',
            cuenta_empresa: c.cuenta_empresa || '',
        };
    } catch {
        return null;
    }
}

async function getClinicLogo(): Promise<string | null> {
    try {
        const blob = await api.getBlob(API_ROUTES.CLINIC_LOGO) as unknown as Blob;
        return blob?.size > 0 ? URL.createObjectURL(blob) : null;
    } catch { return null; }
}

async function getSedes(): Promise<Sede[]> {
    try {
        const data = await api.get(API_ROUTES.SEDES, { page: '1', limit: '200' });
        const raw = Array.isArray(data) ? data : (data.sedes || data.data || data.result || []);
        return raw.map((s: any) => ({
            id: String(s.id),
            clinic_id: String(s.clinic_id),
            name: s.name || '',
            address: s.address || undefined,
            phone: s.phone || undefined,
            email: s.email || undefined,
            is_active: s.is_active !== undefined ? s.is_active : true,
            created_at: s.created_at,
            updated_at: s.updated_at,
        }));
    } catch { return []; }
}

async function upsertSede(sedeData: SedeFormValues & { clinic_id: string }) {
    const payload: any = {
        clinic_id: Number(sedeData.clinic_id),
        name: sedeData.name,
        address: sedeData.address || null,
        phone: sedeData.phone || null,
        email: sedeData.email || null,
        is_active: sedeData.is_active,
    };
    if (sedeData.id) payload.id = Number(sedeData.id);
    const res = await api.post(API_ROUTES.SEDE_UPSERT, payload);
    if (Array.isArray(res) && res[0]?.code >= 400) throw new Error(res[0]?.message || 'Error');
    return res;
}

async function deleteSede(id: string) {
    const res = await api.delete(API_ROUTES.SEDE_DELETE, { id: Number(id) });
    if (Array.isArray(res) && res[0]?.code >= 400) throw new Error(res[0]?.message || 'Error');
    return res;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ClinicsPage() {
    const t = useTranslations();
    const tc = useTranslations('ClinicDetailsPage');
    const { hasPermission } = usePermissions();
    const canUpdate = hasPermission(BUSINESS_CONFIG_PERMISSIONS.CLINIC_DETAILS_UPDATE);
    const canUploadLogo = hasPermission(BUSINESS_CONFIG_PERMISSIONS.CLINIC_DETAILS_UPLOAD_LOGO);
    const canCreateSede = hasPermission(BUSINESS_CONFIG_PERMISSIONS.SEDES_CREATE);
    const canUpdateSede = hasPermission(BUSINESS_CONFIG_PERMISSIONS.SEDES_UPDATE);
    const canDeleteSede = hasPermission(BUSINESS_CONFIG_PERMISSIONS.SEDES_DELETE);

    const { toast } = useToast();

    // Clinic state
    const [clinic, setClinic] = React.useState<Clinic | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isSaving, setIsSaving] = React.useState(false);
    const [logoPreview, setLogoPreview] = React.useState<string | null>(null);
    const [logoFile, setLogoFile] = React.useState<File | null>(null);
    const [phoneError, setPhoneError] = React.useState<string | null>(null);

    // Sedes state
    const [sedes, setSedes] = React.useState<Sede[]>([]);
    const [clinicId, setClinicId] = React.useState('');
    const [isSedesLoading, setIsSedesLoading] = React.useState(true);
    const [isCreateSedeOpen, setIsCreateSedeOpen] = React.useState(false);
    const [editingSede, setEditingSede] = React.useState<Sede | null>(null);
    const [deletingSede, setDeletingSede] = React.useState<Sede | null>(null);
    const [isDeleteSedeOpen, setIsDeleteSedeOpen] = React.useState(false);
    const [isSavingSede, setIsSavingSede] = React.useState(false);
    const [sedeError, setSedeError] = React.useState<string | null>(null);

    const sedeForm = useForm<SedeFormValues>({
        resolver: zodResolver(sedeFormSchema(t)),
        defaultValues: { name: '', address: '', phone: '', email: '', is_active: true },
    });

    // ── Loaders ───────────────────────────────────────────────────────────────

    const loadClinic = React.useCallback(async () => {
        setIsLoading(true);
        const [fetchedClinic, logoUrl] = await Promise.all([
            getClinic({ name: tc('fallbacks.name'), location: tc('fallbacks.location') }),
            getClinicLogo(),
        ]);
        setClinic(fetchedClinic);
        if (fetchedClinic) setClinicId(fetchedClinic.id);
        if (logoUrl) setLogoPreview(logoUrl);
        setIsLoading(false);
    }, [tc]);

    const loadSedes = React.useCallback(async () => {
        setIsSedesLoading(true);
        setSedes(await getSedes());
        setIsSedesLoading(false);
    }, []);

    React.useEffect(() => { loadClinic(); }, [loadClinic]);
    React.useEffect(() => { loadSedes(); }, [loadSedes]);

    // ── Clinic handlers ───────────────────────────────────────────────────────

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!clinic) return;
        setClinic({ ...clinic, [e.target.id]: e.target.value });
    };

    const handlePhoneChange = (value: string) => {
        if (!clinic) return;
        setClinic({ ...clinic, phone_number: value });
        if (phoneError) setPhoneError(null);
    };

    const handleSelectChange = (id: keyof Clinic, value: string) => {
        if (!clinic) return;
        setClinic({ ...clinic, [id]: value });
    };

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 1024 * 1024) {
            toast({ variant: 'destructive', title: tc('toast.fileTooLargeTitle'), description: tc('toast.fileTooLargeDesc') });
            return;
        }
        setLogoFile(file);
        const reader = new FileReader();
        reader.onloadend = () => setLogoPreview(reader.result as string);
        reader.readAsDataURL(file);
    };

    const handleSaveChanges = async () => {
        if (!clinic) return;
        const phone = clinic.phone_number?.trim();
        if (phone && !isValidPhoneNumber(phone)) { setPhoneError(tc('validation.phoneInvalid')); return; }
        setPhoneError(null);
        setIsSaving(true);
        const formData = new FormData();
        formData.append('id', clinic.id);
        formData.append('name', clinic.name);
        formData.append('address', clinic.location);
        formData.append('email', clinic.contact_email);
        formData.append('phone', clinic.phone_number);
        if (clinic.currency) formData.append('currency', clinic.currency);
        if (clinic.rut) formData.append('rut', clinic.rut);
        // Datos fiscales / patronales (reportes de nómina)
        formData.append('razon_social', clinic.razon_social ?? '');
        formData.append('domicilio_fiscal', clinic.domicilio_fiscal ?? '');
        formData.append('bps_empresa_nro', clinic.bps_empresa_nro ?? '');
        formData.append('bps_grupo', clinic.bps_grupo ?? '');
        formData.append('bps_subgrupo', clinic.bps_subgrupo ?? '');
        formData.append('bse_nro', clinic.bse_nro ?? '');
        formData.append('mtss_planilla_nro', clinic.mtss_planilla_nro ?? '');
        formData.append('banco_empresa', clinic.banco_empresa ?? '');
        formData.append('cuenta_empresa', clinic.cuenta_empresa ?? '');
        if (logoFile) formData.append('data', logoFile);
        try {
            const res = await api.post(API_ROUTES.CLINIC_UPDATE, formData);
            if (Array.isArray(res) && res.length > 0) {
                const first = res[0];
                if (first.message) throw new Error(first.message);
                if (first.id && first.name) {
                    toast({ title: tc('toast.successTitle'), description: tc('toast.successDesc') });
                    loadClinic();
                } else throw new Error(tc('toast.errorUnknown'));
            } else throw new Error(tc('toast.errorUnknown'));
        } catch (error) {
            toast({ variant: 'destructive', title: tc('toast.errorTitle'), description: error instanceof Error ? error.message : tc('toast.errorUnknown') });
        } finally {
            setIsSaving(false);
        }
    };

    // ── Sede handlers ─────────────────────────────────────────────────────────

    const openCreateSede = () => {
        setSedeError(null);
        sedeForm.reset({ name: '', address: '', phone: '', email: '', is_active: true });
        setIsCreateSedeOpen(true);
    };

    const openEditSede = (sede: Sede) => {
        setSedeError(null);
        sedeForm.reset({
            id: sede.id,
            name: sede.name,
            address: sede.address || '',
            phone: sede.phone || '',
            email: sede.email || '',
            is_active: sede.is_active,
        });
        setEditingSede(sede);
    };

    const onSedeSubmit = async (values: SedeFormValues) => {
        setSedeError(null);
        setIsSavingSede(true);
        try {
            await upsertSede({ ...values, clinic_id: clinicId });
            toast({ title: values.id ? tc('toast.sedeEditSuccess') : tc('toast.sedeCreateSuccess') });
            await loadSedes();
            setIsCreateSedeOpen(false);
            setEditingSede(null);
        } catch (err) {
            setSedeError(err instanceof Error ? err.message : tc('toast.sedeGenericError'));
        } finally {
            setIsSavingSede(false);
        }
    };

    const confirmDeleteSede = async () => {
        if (!deletingSede) return;
        try {
            await deleteSede(deletingSede.id);
            toast({ title: tc('toast.sedeDeleteSuccess') });
            setIsDeleteSedeOpen(false);
            setDeletingSede(null);
            loadSedes();
        } catch {
            toast({ variant: 'destructive', title: tc('toast.errorTitle'), description: tc('toast.sedeDeleteError') });
        }
    };

    // ── Sede form fields (shared between create/edit dialogs) ─────────────────

    const sedeFormFields = (disabled = false) => (
        <div className="space-y-4">
            {sedeError && (
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>{tc('toast.errorTitle')}</AlertTitle>
                    <AlertDescription>{sedeError}</AlertDescription>
                </Alert>
            )}
            <FormField control={sedeForm.control} name="name" render={({ field }) => (
                <FormItem>
                    <FormLabel>{t('SedesPage.form.name')}</FormLabel>
                    <FormControl><Input {...field} disabled={disabled} placeholder={t('SedesPage.form.namePlaceholder')} /></FormControl>
                    <FormMessage />
                </FormItem>
            )} />
            <FormField control={sedeForm.control} name="address" render={({ field }) => (
                <FormItem>
                    <FormLabel>{t('SedesPage.form.address')}</FormLabel>
                    <FormControl><Input {...field} disabled={disabled} placeholder={t('SedesPage.form.addressPlaceholder')} /></FormControl>
                    <FormMessage />
                </FormItem>
            )} />
            <FormField control={sedeForm.control} name="phone" render={({ field }) => (
                <FormItem>
                    <FormLabel>{t('SedesPage.form.phone')}</FormLabel>
                    <FormControl>
                        <PhoneInput {...field} defaultCountry="UY" disabled={disabled} placeholder={t('SedesPage.form.phonePlaceholder')} onChange={field.onChange} value={field.value} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )} />
            <FormField control={sedeForm.control} name="email" render={({ field }) => (
                <FormItem>
                    <FormLabel>{t('SedesPage.form.email')}</FormLabel>
                    <FormControl><Input type="email" {...field} disabled={disabled} placeholder={t('SedesPage.form.emailPlaceholder')} /></FormControl>
                    <FormMessage />
                </FormItem>
            )} />
            <FormField control={sedeForm.control} name="is_active" render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-lg border p-3">
                    <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={disabled} /></FormControl>
                    <FormLabel className="font-normal">{t('SedesPage.form.isActive')}</FormLabel>
                </FormItem>
            )} />
        </div>
    );

    // ── Skeletons ─────────────────────────────────────────────────────────────

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-1/2" />
                    <Skeleton className="h-4 w-3/4" />
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                        <div className="space-y-6">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="space-y-2">
                                    <Skeleton className="h-4 w-24" />
                                    <Skeleton className="h-10 w-full" />
                                </div>
                            ))}
                        </div>
                        <div><Skeleton className="h-[400px] w-full" /></div>
                    </div>
                </CardContent>
                <CardFooter><Skeleton className="h-10 w-32" /></CardFooter>
            </Card>
        );
    }

    if (!clinic) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>{tc('title')}</CardTitle>
                    <CardDescription>{tc('description')}</CardDescription>
                </CardHeader>
                <CardContent><p>{tc('noClinic')}</p></CardContent>
            </Card>
        );
    }

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <Card className="flex-1 flex flex-col min-h-0 overflow-hidden border-0 lg:border shadow-none lg:shadow-sm">
                <CardHeader className="flex-none p-4">
                    <div className="flex items-start gap-3">
                        <div className="header-icon-circle mt-0.5">
                            <Building className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col text-left">
                            <CardTitle className="text-lg">{tc('title')}</CardTitle>
                            <CardDescription className="text-xs">{tc('description')}</CardDescription>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="flex-1 overflow-y-auto bg-card p-4">
                    <div className="grid grid-cols-1 gap-8 md:grid-cols-2">

                        {/* ── Left column: clinic form ── */}
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="logo">{tc('logoLabel')}</Label>
                                <div className="flex items-center gap-4">
                                    <div className="relative h-24 w-24 rounded-md border-2 border-dashed border-muted-foreground/50 flex items-center justify-center">
                                        {logoPreview ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={logoPreview} alt={tc('logoAlt')} className="h-full w-full object-contain rounded-md" />
                                        ) : (
                                            <UploadCloud className="h-8 w-8 text-muted-foreground" />
                                        )}
                                    </div>
                                    {canUploadLogo && (
                                        <Input id="logo" type="file" onChange={handleLogoChange} accept="image/*" className="max-w-xs" />
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="name">{tc('nameLabel')}</Label>
                                <Input id="name" value={clinic.name} onChange={handleInputChange} placeholder={tc('namePlaceholder')} />
                            </div>

                            {/* Address field: hidden when clinic has more than 1 sede */}
                            {sedes.length <= 1 ? (
                                <div className="space-y-2">
                                    <Label htmlFor="location">{tc('locationLabel')}</Label>
                                    <Input id="location" value={clinic.location} onChange={handleInputChange} placeholder={tc('locationPlaceholder')} />
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                                    <Info className="h-3.5 w-3.5 flex-none" />
                                    {tc('locationManagedBySedes')}
                                </p>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="contact_email">{tc('emailLabel')}</Label>
                                <Input id="contact_email" type="email" value={clinic.contact_email} onChange={handleInputChange} placeholder={tc('emailPlaceholder')} />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="phone_number">{tc('phoneLabel')}</Label>
                                <PhoneInput defaultCountry="UY" value={clinic.phone_number} onChange={handlePhoneChange} placeholder={tc('phonePlaceholder')} />
                                {phoneError && <p className="text-sm font-medium text-destructive">{phoneError}</p>}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="rut">{tc('rutLabel')}</Label>
                                <Input id="rut" value={clinic.rut ?? ''} onChange={handleInputChange} placeholder={tc('rutPlaceholder')} />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="currency">{tc('currencyLabel')}</Label>
                                <Select onValueChange={(v) => handleSelectChange('currency', v)} value={clinic.currency}>
                                    <SelectTrigger>
                                        <SelectValue placeholder={tc('currencyPlaceholder')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="USD">USD</SelectItem>
                                        <SelectItem value="UYU">UYU</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* ── Datos fiscales / patronales (reportes de nómina) ── */}
                            <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
                                <div>
                                    <p className="text-sm font-medium">{tc('fiscalSection')}</p>
                                    <p className="text-xs text-muted-foreground">{tc('fiscalSectionDesc')}</p>
                                </div>
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <div className="space-y-2 sm:col-span-2">
                                        <Label htmlFor="razon_social">{tc('razonSocialLabel')}</Label>
                                        <Input id="razon_social" value={clinic.razon_social ?? ''} onChange={handleInputChange} placeholder={tc('razonSocialPlaceholder')} />
                                    </div>
                                    <div className="space-y-2 sm:col-span-2">
                                        <Label htmlFor="domicilio_fiscal">{tc('domicilioFiscalLabel')}</Label>
                                        <Input id="domicilio_fiscal" value={clinic.domicilio_fiscal ?? ''} onChange={handleInputChange} placeholder={tc('domicilioFiscalPlaceholder')} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="bps_empresa_nro">{tc('bpsEmpresaLabel')}</Label>
                                        <Input id="bps_empresa_nro" value={clinic.bps_empresa_nro ?? ''} onChange={handleInputChange} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="mtss_planilla_nro">{tc('mtssPlanillaLabel')}</Label>
                                        <Input id="mtss_planilla_nro" value={clinic.mtss_planilla_nro ?? ''} onChange={handleInputChange} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="bps_grupo">{tc('bpsGrupoLabel')}</Label>
                                        <Input id="bps_grupo" value={clinic.bps_grupo ?? ''} onChange={handleInputChange} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="bps_subgrupo">{tc('bpsSubgrupoLabel')}</Label>
                                        <Input id="bps_subgrupo" value={clinic.bps_subgrupo ?? ''} onChange={handleInputChange} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="bse_nro">{tc('bseLabel')}</Label>
                                        <Input id="bse_nro" value={clinic.bse_nro ?? ''} onChange={handleInputChange} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="banco_empresa">{tc('bancoEmpresaLabel')}</Label>
                                        <Input id="banco_empresa" value={clinic.banco_empresa ?? ''} onChange={handleInputChange} />
                                    </div>
                                    <div className="space-y-2 sm:col-span-2">
                                        <Label htmlFor="cuenta_empresa">{tc('cuentaEmpresaLabel')}</Label>
                                        <Input id="cuenta_empresa" value={clinic.cuenta_empresa ?? ''} onChange={handleInputChange} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── Right column: map + sedes list ── */}
                        <div className="flex flex-col gap-4">

                            {/* Map — `isolate` creates a stacking context so Leaflet's internal z-indices don't escape above dialogs */}
                            <div className="h-[220px] w-full overflow-hidden rounded-lg border flex-none isolate">
                                <ClinicsSedesMap
                                    sedes={sedes}
                                    clinicAddress={sedes.length === 0 ? clinic.location : undefined}
                                    activeLabel={tc('sedeActiveStatus')}
                                    inactiveLabel={tc('sedeInactiveStatus')}
                                />
                            </div>

                            {/* Sedes list */}
                            <div className="flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium">{tc('sedesSection')}</p>
                                        <p className="text-xs text-muted-foreground">{tc('sedesSectionDesc')}</p>
                                    </div>
                                    {canCreateSede && (
                                        <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={openCreateSede}>
                                            <Plus className="h-3.5 w-3.5" />
                                            {tc('addSede')}
                                        </Button>
                                    )}
                                </div>

                                {isSedesLoading ? (
                                    <div className="space-y-2">
                                        <Skeleton className="h-16 w-full rounded-lg" />
                                        <Skeleton className="h-16 w-full rounded-lg" />
                                    </div>
                                ) : sedes.length === 0 ? (
                                    <div className="rounded-lg border border-dashed p-5 text-center">
                                        <Building2 className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
                                        <p className="text-sm text-muted-foreground">{tc('noSedes')}</p>
                                        <p className="text-xs text-muted-foreground/70 mt-0.5">{tc('noSedesHint')}</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {sedes.map((sede) => (
                                            <div
                                                key={sede.id}
                                                className="group flex items-start gap-3 rounded-lg border bg-card px-3 py-2.5 hover:bg-muted/40 transition-colors"
                                            >
                                                <MapPin className="h-4 w-4 mt-0.5 flex-none text-muted-foreground" />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="text-sm font-medium truncate">{sede.name}</span>
                                                        <Badge
                                                            variant={sede.is_active ? 'success' : 'outline'}
                                                            className="text-[10px] flex-none"
                                                        >
                                                            {sede.is_active ? tc('sedeActiveStatus') : tc('sedeInactiveStatus')}
                                                        </Badge>
                                                    </div>
                                                    {sede.address && (
                                                        <p className="text-xs text-muted-foreground truncate mt-0.5">{sede.address}</p>
                                                    )}
                                                    <div className="flex items-center gap-3 mt-0.5">
                                                        {sede.phone && (
                                                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                                                <Phone className="h-3 w-3" />{sede.phone}
                                                            </span>
                                                        )}
                                                        {sede.email && (
                                                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                                                <Mail className="h-3 w-3" />{sede.email}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-none">
                                                    {canUpdateSede && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7"
                                                            onClick={() => openEditSede(sede)}
                                                        >
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </Button>
                                                    )}
                                                    {canDeleteSede && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive"
                                                            onClick={() => { setDeletingSede(sede); setIsDeleteSedeOpen(true); }}
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </CardContent>

                <CardFooter className="flex-none justify-between border-t bg-card px-4 py-3">
                    {canUpdate && (
                        <Button onClick={handleSaveChanges} disabled={isSaving}>
                            {isSaving ? tc('saving') : tc('save')}
                        </Button>
                    )}
                    <Button variant="outline" size="icon" onClick={() => { loadClinic(); loadSedes(); }} disabled={isLoading}>
                        <RefreshCw className={`h-4 w-4 ${isLoading || isSaving ? 'animate-spin' : ''}`} />
                    </Button>
                </CardFooter>
            </Card>

            {/* ── Create sede dialog ── */}
            <Dialog open={isCreateSedeOpen} onOpenChange={(open) => {
                setIsCreateSedeOpen(open);
                if (!open) { setSedeError(null); sedeForm.reset(); }
            }}>
                <DialogContent maxWidth="lg" confirmOnClose isDirty={sedeForm.formState.isDirty}>
                    <DialogHeader>
                        <DialogTitle>{tc('sedeCreateTitle')}</DialogTitle>
                    </DialogHeader>
                    <Form {...sedeForm}>
                        <form onSubmit={sedeForm.handleSubmit(onSedeSubmit)} className="flex flex-col min-h-0">
                            <DialogBody className="px-6 py-4">
                                {sedeFormFields(false)}
                            </DialogBody>
                            <DialogFooter>
                                <DialogCancelButton disabled={isSavingSede}>
                                    {t('SedesPage.form.cancel')}
                                </DialogCancelButton>
                                <Button type="submit" disabled={isSavingSede}>
                                    {isSavingSede && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {t('SedesPage.form.create')}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            {/* ── Edit sede dialog ── */}
            <Dialog open={!!editingSede} onOpenChange={(open) => {
                if (!open) { setEditingSede(null); setSedeError(null); sedeForm.reset(); }
            }}>
                <DialogContent maxWidth="lg" confirmOnClose isDirty={sedeForm.formState.isDirty}>
                    <DialogHeader>
                        <DialogTitle>{tc('sedeEditTitle')}</DialogTitle>
                    </DialogHeader>
                    <Form {...sedeForm}>
                        <form onSubmit={sedeForm.handleSubmit(onSedeSubmit)} className="flex flex-col min-h-0">
                            <DialogBody className="px-6 py-4">
                                {sedeFormFields(false)}
                            </DialogBody>
                            <DialogFooter>
                                <DialogCancelButton disabled={isSavingSede}>
                                    {t('SedesPage.form.cancel')}
                                </DialogCancelButton>
                                <Button type="submit" disabled={isSavingSede}>
                                    {isSavingSede && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {t('SedesPage.form.save')}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            {/* ── Delete sede dialog ── */}
            <AlertDialog open={isDeleteSedeOpen} onOpenChange={setIsDeleteSedeOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{tc('sedeDeleteConfirmTitle')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {tc('sedeDeleteConfirmDesc', { name: deletingSede?.name ?? '' })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{tc('sedeDeleteConfirmCancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDeleteSede}
                            className="bg-destructive hover:bg-destructive/90"
                        >
                            {tc('sedeDeleteConfirmDelete')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
