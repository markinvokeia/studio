
'use client';

import * as React from 'react';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Clinic } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, UploadCloud } from 'lucide-react';

async function getClinic(): Promise<Clinic | null> {
    try {
        const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/clinic', {
            method: 'GET',
            mode: 'cors',
            headers: {
                'Accept': 'application/json',
            },
            cache: 'no-store',
        });

        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`);
        }

        const data = await response.json();
        const clinicsData = Array.isArray(data) ? data : (data.clinics || data.data || data.result || []);

        if (clinicsData.length === 0) {
            return null;
        }
        
        const apiClinic = clinicsData[0];
        
        let logoUrl = null;
        if (apiClinic.logo_base64) {
            logoUrl = `data:image/webp;base64,${apiClinic.logo_base64}`;
        }

        return {
            id: apiClinic.id ? String(apiClinic.id) : `cli_${Math.random().toString(36).substr(2, 9)}`,
            name: apiClinic.name || 'No Name',
            location: apiClinic.address || 'No Location',
            contact_email: apiClinic.email || 'no-email@example.com',
            phone_number: apiClinic.phone || '000-000-0000',
            logo: logoUrl,
        };
    } catch (error) {
        console.error("Failed to fetch clinics:", error);
        return null;
    }
}


export default function ClinicsPage() {
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
        if (fetchedClinic?.logo) {
            setLogoPreview(fetchedClinic.logo);
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

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 1024 * 1024) { // 1MB limit
                toast({
                    variant: 'destructive',
                    title: 'File Too Large',
                    description: 'The selected logo image must be less than 1MB.',
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

        if (logoFile) {
            formData.append('logo', logoFile);
        }

        try {
            const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/clinic/update', {
                method: 'POST',
                mode: 'cors',
                body: formData,
            });

            const responseData = await response.json();

            if (response.ok && (responseData.code === 200 || responseData[0]?.code === 200)) {
                toast({
                    title: 'Success',
                    description: 'Clinic details updated successfully.',
                });
                loadClinic();
            } else {
                 const errorMessage = responseData.message || (responseData[0]?.message) || 'An unknown error occurred.';
                throw new Error(errorMessage);
            }
        } catch (error) {
             toast({
                variant: 'destructive',
                title: 'Error',
                description: error instanceof Error ? error.message : 'Could not update clinic details.',
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
                    <CardTitle>Clinic Details</CardTitle>
                    <CardDescription>Manage clinic locations and contact information.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p>No clinic information found.</p>
                </CardContent>
            </Card>
        );
    }


    return (
        <Card>
            <CardHeader>
                <CardTitle>Clinic Details</CardTitle>
                <CardDescription>Manage clinic locations and contact information.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="logo">Clinic Logo</Label>
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
                            <Label htmlFor="name">Name</Label>
                            <Input id="name" value={clinic.name} onChange={handleInputChange} placeholder="e.g., Downtown Branch" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="location">Location</Label>
                            <Input id="location" value={clinic.location} onChange={handleInputChange} placeholder="e.g., 123 Main St, Anytown" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="contact_email">Email</Label>
                            <Input id="contact_email" type="email" value={clinic.contact_email} onChange={handleInputChange} placeholder="e.g., branch@clinic.com" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone_number">Phone</Label>
                            <Input id="phone_number" value={clinic.phone_number} onChange={handleInputChange} placeholder="e.g., 111-222-3333" />
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
                    {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button variant="outline" size="icon" onClick={loadClinic} disabled={isLoading}>
                    <RefreshCw className={`h-4 w-4 ${isLoading || isSaving ? 'animate-spin' : ''}`} />
                </Button>
            </CardFooter>
        </Card>
    );
}
