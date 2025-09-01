
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Clinic } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

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

        return {
            id: apiClinic.id ? String(apiClinic.id) : `cli_${Math.random().toString(36).substr(2, 9)}`,
            name: apiClinic.name || 'No Name',
            location: apiClinic.address || 'No Location',
            contact_email: apiClinic.email || 'no-email@example.com',
            phone_number: apiClinic.phone || '000-000-0000',
        };
    } catch (error) {
        console.error("Failed to fetch clinics:", error);
        return null;
    }
}


export default function ClinicsPage() {
    const [clinic, setClinic] = React.useState<Clinic | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);

    const loadClinic = React.useCallback(async () => {
        setIsLoading(true);
        const fetchedClinic = await getClinic();
        setClinic(fetchedClinic);
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

    if (isLoading) {
        return (
             <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-1/2" />
                    <Skeleton className="h-4 w-3/4" />
                </CardHeader>
                <CardContent className="space-y-6">
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
            <CardContent className="space-y-6">
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
            </CardContent>
            <CardFooter>
                 <Button>Save Changes</Button>
            </CardFooter>
        </Card>
    );
}

