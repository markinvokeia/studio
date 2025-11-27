
'use client';

import * as React from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useAuth } from '@/context/AuthContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Box, AlertTriangle, ArrowRight } from 'lucide-react';
import type { CajaSesion } from '@/lib/types';
import { Skeleton } from './ui/skeleton';

export const OpenCashSessionWidget = () => {
    const t = useTranslations('OpenCashSessionWidget');
    const locale = useLocale();
    const { user } = useAuth();
    const [activeSession, setActiveSession] = React.useState<CajaSesion | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        const checkActiveSession = async () => {
            if (!user) {
                setIsLoading(false);
                return;
            };
            setIsLoading(true);
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/cash-session/active?user_id=${user.id}`, {
                    method: 'GET',
                    mode: 'cors',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                });

                const data = await response.json();
                if (response.ok && data.code === 200) {
                    setActiveSession(data.data);
                } else {
                    setActiveSession(null);
                }
            } catch (error) {
                console.error("Failed to check active session:", error);
                setActiveSession(null);
            } finally {
                setIsLoading(false);
            }
        };
        checkActiveSession();
    }, [user]);

    if (isLoading) {
        return <Skeleton className="h-8 w-64" />;
    }
    
    if (activeSession) {
        return (
            <Alert variant="success" className="flex items-center justify-between p-2 h-10 max-w-md">
                <div className="flex items-center">
                    <Box className="h-4 w-4" />
                    <div className="ml-2">
                        <AlertTitle className="font-bold text-sm">{t('activeSession.title')}</AlertTitle>
                    </div>
                </div>
                <Link href={`/${locale}/cashier`} passHref>
                    <Button variant="ghost" size="sm">
                        {t('activeSession.button')}
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                </Link>
            </Alert>
        );
    }

    return (
        <Alert variant="warning" className="flex items-center justify-between p-2 h-10 max-w-md">
            <div className="flex items-center">
                <AlertTriangle className="h-4 w-4" />
                <div className="ml-2">
                    <AlertTitle className="font-bold text-sm">{t('title')}</AlertTitle>
                </div>
            </div>
            <Link href={`/${locale}/cashier`} passHref>
                <Button variant="outline" size="sm" className="text-yellow-900 hover:text-yellow-900 dark:text-yellow-200">
                    {t('button')}
                    <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            </Link>
        </Alert>
    );
};
