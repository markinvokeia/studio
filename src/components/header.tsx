'use client';

import { OpenCashSessionWidget } from '@/components/cash-session-widget';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAlertNotifications } from '@/context/alert-notifications-context';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import {
    Bell,
    Check,
    Globe,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';
import { ExchangeRate } from './exchange-rate';
import { UsFlagIcon } from './icons/us-flag-icon';
import { UyFlagIcon } from './icons/uy-flag-icon';

export function Header() {
    const pathname = usePathname();
    const t = useTranslations('Header');
    const locale = useLocale();
    const router = useRouter();
    const { activeCashSession } = useAuth();
    const { pendingCount } = useAlertNotifications();

    const [isExpanded, setIsExpanded] = React.useState(false);

    const onSelectLocale = (newLocale: string) => {
        const searchParams = new URLSearchParams(window.location.search);
        const newPathname = pathname.replace(`/${locale}`, `/${newLocale}`);
        const newUrl = `${newPathname}?${searchParams.toString()}`;
        router.replace(newUrl);
    };

    return (
        <div className="fixed top-4 right-4 z-[50] flex flex-col items-end gap-2">
            {!isExpanded ? (
                <div className="flex items-center bg-[hsl(var(--floating-header-bg)/0.8)] backdrop-blur-md p-1 rounded-full border border-border shadow-lg transition-all hover:bg-[hsl(var(--floating-header-bg))]">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => setIsExpanded(true)} 
                        className="rounded-full h-9 w-9 hover:bg-accent"
                    >
                        <ChevronLeft className="h-5 w-5 text-muted-foreground" />
                    </Button>
                </div>
            ) : (
                <div className={cn(
                    "flex items-center gap-3 bg-[hsl(var(--floating-header-bg)/0.95)] backdrop-blur-md p-2 rounded-full border border-border shadow-2xl transition-all",
                    "animate-in fade-in slide-in-from-right-10 duration-300"
                )}>
                    <div className="flex items-center gap-3 px-2">
                        <OpenCashSessionWidget />
                        
                        <div className="h-6 w-px bg-border/50" />

                        <Link href={`/${locale}/alerts`} passHref>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className={cn(
                                    "relative rounded-full transition-all duration-300 h-9 w-9",
                                    pendingCount > 0 && "bg-red-500/10 text-red-600"
                                )}
                            >
                                <div className={cn(pendingCount > 0 && 'animate-bell-ring')}>
                                    <Bell className="h-5 w-5" />
                                </div>
                                {pendingCount > 0 && (
                                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white bg-red-600 ring-2 ring-background">
                                        {pendingCount > 99 ? '99+' : pendingCount}
                                    </span>
                                )}
                                <span className="sr-only">{t('alerts')}</span>
                            </Button>
                        </Link>
                        
                        {activeCashSession && <ExchangeRate activeCashSession={activeCashSession} />}
                        
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="rounded-full h-9 w-9">
                                    <Globe className="h-5 w-5 text-muted-foreground" />
                                    <span className="sr-only">{t('toggleLanguage')}</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-xl">
                                <DropdownMenuItem onSelect={() => onSelectLocale('es')} disabled={locale === 'es'}>
                                    <span className="flex items-center justify-between w-full font-medium">
                                        <div className="flex items-center gap-2">
                                            <UyFlagIcon className="h-4 w-4" />
                                            {t('spanish')}
                                        </div>
                                        {locale === 'es' && <Check className="h-4 w-4 ml-2 text-primary" />}
                                    </span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => onSelectLocale('en')} disabled={locale === 'en'}>
                                    <span className="flex items-center justify-between w-full font-medium">
                                        <div className="flex items-center gap-2">
                                            <UsFlagIcon className="h-4 w-4" />
                                            {t('english')}
                                        </div>
                                        {locale === 'en' && <Check className="h-4 w-4 ml-2 text-primary" />}
                                    </span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => setIsExpanded(false)} 
                        className="rounded-full h-8 w-8 hover:bg-accent ml-1"
                    >
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </Button>
                </div>
            )}
        </div>
    );
}