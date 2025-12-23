
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { Clinic } from '@/lib/types';
import { api } from '@/services/api';
import { RefreshCw, UploadCloud } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import * as React from 'react';

async function getClinic(): Promise<Clinic | null> {
    try {
        const data = await api.get(API_ROUTES.CLINIC);
        const clinicsData = Array.isArray(data) ? data : (data.clinics || data.data || data.result || []);

        if (clinicsData.length === 0) {
            return null;
        }

        const apiClinic = clinicsData[0];

        return {
            id: apiClinic.id ? String(apiClinic.id) : `cli_${Math.random().toString(36).substr(2, 9)}`,
            name: apiClinic.name || 'No Name',
            location: apiClinic.address || 'No Location',
            contact_email: apiClinic.email || 'no-email@example.com',
            phone_number: apiClinic.phone || '000-000-0000',
            logo_base64: apiClinic.logo_base64,
            currency: apiClinic.currency || 'USD',
        };
    } catch (error) {
        console.error("Failed to fetch clinics:", error);
        return null;
    }
}


export default function ClinicsPage() {
    const t = useTranslations('ClinicDetailsPage');
    const [clinic, setClinic] = React.useState<Clinic | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isSaving, setIsSaving] = React.useState(false);
    const [logoPreview, setLogoPreview] = React.useState<string | null>(null);
    const [logoFile, setLogoFile] = React.useState<File | null>(null);
    const { toast } = useToast();

    const loadClinic = React.useCallback(async () => {
        setIsLoading(true);
        const fetchedClinic = await getClinic();
        setClinic(fetchedClinic);
        if (fetchedClinic?.logo_base64) {
            setLogoPreview(fetchedClinic.logo_base64);
        }
        setIsLoading(false);
    }, []);

    React.useEffect(() => {
        loadClinic();
    }, [loadClinic]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!clinic) return;
        const { id, value } = e.target;
        setClinic({ ...clinic, [id]: value });
    };

    const handleSelectChange = (id: keyof Clinic, value: string) => {
        if (!clinic) return;
        setClinic({ ...clinic, [id]: value });
    };

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 1024 * 1024) { // 1MB limit
                toast({
                    variant: 'destructive',
                    title: t('toast.fileTooLargeTitle'),
                    description: t('toast.fileTooLargeDesc'),
                });
                return;
            }
            setLogoFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setLogoPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSaveChanges = async () => {
        if (!clinic) return;
        setIsSaving(true);

        const formData = new FormData();
        formData.append('id', clinic.id);
        formData.append('name', clinic.name);
        formData.append('address', clinic.location);
        formData.append('email', clinic.contact_email);
        formData.append('phone', clinic.phone_number);
        if (clinic.currency) {
            formData.append('currency', clinic.currency);
        }

        if (logoFile) {
            formData.append('logo', logoFile);
        }

        try {
            const responseData = await api.post(API_ROUTES.CLINIC_UPDATE, formData);

            if (responseData.code === 200 || responseData[0]?.code === 200) {
                toast({
                    title: t('toast.successTitle'),
                    description: t('toast.successDesc'),
                });
                loadClinic();
            } else {
                const errorMessage = responseData.message || (responseData[0]?.message) || t('toast.errorUnknown');
                throw new Error(errorMessage);
            }
        } catch (error) {
            toast({
                variant: 'destructive',
                title: t('toast.errorTitle'),
                description: error instanceof Error ? error.message : t('toast.errorUnknown'),
            });
        } finally {
            setIsSaving(false);
        }
    };


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
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                        </div>
                        <div>
                            <Skeleton className="h-[400px] w-full" />
                        </div>
                    </div>
                </CardContent>
                <CardFooter>
                    <Skeleton className="h-10 w-32" />
                </CardFooter>
            </Card>
        );
    }

    if (!clinic) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>{t('title')}</CardTitle>
                    <CardDescription>{t('description')}</CardDescription>
                </CardHeader>
                <CardContent>
                    <p>{t('noClinic')}</p>
                </CardContent>
            </Card>
        );
    }


    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('title')}</CardTitle>
                <CardDescription>{t('description')}</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="logo">{t('logoLabel')}</Label>
                            <div className="flex items-center gap-4">
                                <div className="relative h-24 w-24 rounded-md border-2 border-dashed border-muted-foreground/50 flex items-center justify-center">
                                    {logoPreview ? (
                                        <Image src={logoPreview} alt="Logo Preview" layout="fill" className="object-contain rounded-md" />
                                    ) : (
                                        <UploadCloud className="h-8 w-8 text-muted-foreground" />
                                    )}
                                </div>
                                <Input id="logo" type="file" onChange={handleLogoChange} accept="image/*" className="max-w-xs" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="name">{t('nameLabel')}</Label>
                            <Input id="name" value={clinic.name} onChange={handleInputChange} placeholder={t('namePlaceholder')} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="location">{t('locationLabel')}</Label>
                            <Input id="location" value={clinic.location} onChange={handleInputChange} placeholder={t('locationPlaceholder')} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="contact_email">{t('emailLabel')}</Label>
                            <Input id="contact_email" type="email" value={clinic.contact_email} onChange={handleInputChange} placeholder={t('emailPlaceholder')} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone_number">{t('phoneLabel')}</Label>
                            <Input id="phone_number" value={clinic.phone_number} onChange={handleInputChange} placeholder={t('phonePlaceholder')} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="currency">{t('currencyLabel')}</Label>
                            <Select onValueChange={(value) => handleSelectChange('currency', value)} value={clinic.currency}>
                                <SelectTrigger>
                                    <SelectValue placeholder={t('currencyPlaceholder')} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="USD">USD</SelectItem>
                                    <SelectItem value="UYU">UYU</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="h-[400px] w-full overflow-hidden rounded-lg md:h-full">
                        <iframe
                            className="h-full w-full border-0"
                            loading="lazy"
                            allowFullScreen
                            src={`https://maps.google.com/maps?q=${encodeURIComponent(clinic.location)}&output=embed`}
                        ></iframe>
                    </div>
                </div>
            </CardContent>
            <CardFooter className="justify-between">
                <Button onClick={handleSaveChanges} disabled={isSaving}>
                    {isSaving ? t('saving') : t('save')}
                </Button>
                <Button variant="outline" size="icon" onClick={loadClinic} disabled={isLoading}>
                    <RefreshCw className={`h-4 w-4 ${isLoading || isSaving ? 'animate-spin' : ''}`} />
                </Button>
            </CardFooter>
        </Card>
    );
}
