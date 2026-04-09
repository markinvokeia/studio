'use client';

import { OpenCashSessionWidget } from '@/components/cash-session-widget';
import { TVDisplayWidget } from '@/components/tv-display-widget';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { GLOBAL_PERMISSIONS } from '@/constants/permissions';
import { useAlertNotifications } from '@/context/alert-notifications-context';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';
import {
    Bell,
    Check,
    ChevronLeft,
    ChevronRight,
    Globe,
    LifeBuoy,
    MessageSquare,
    X
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';
import { ExchangeRate } from './exchange-rate';
import { TelegramIcon } from './icons/telegram-icon';
import { UsFlagIcon } from './icons/us-flag-icon';
import { UyFlagIcon } from './icons/uy-flag-icon';
import { WhatsAppIcon } from './icons/whatsapp-icon';

export function Header() {
    const pathname = usePathname();
    const t = useTranslations('Header');
    const tFloating = useTranslations('FloatingActions');
    const locale = useLocale();
    const router = useRouter();
    const { activeCashSession } = useAuth();
    const { pendingCount } = useAlertNotifications();
    const { hasPermission } = usePermissions();

    const [isExpanded, setIsExpanded] = React.useState(false);
    const [isChatOpen, setIsChatOpen] = React.useState(false);

    const onSelectLocale = (newLocale: string) => {
        const searchParams = new URLSearchParams(window.location.search);
        const newPathname = pathname.replace(`/${locale}`, `/${newLocale}`);
        const newUrl = `${newPathname}?${searchParams.toString()}`;
        router.replace(newUrl);
    };

    const HelpMenu = () => (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full h-9 w-9">
                    <LifeBuoy className="h-5 w-5 text-muted-foreground" />
                    <span className="sr-only">{tFloating('openMenu')}</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl p-2">
                <DropdownMenuLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {tFloating('chatbotTitle')}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                    <Link href="https://wa.me/59894024661" target="_blank" className="flex items-center w-full">
                        <WhatsAppIcon className="mr-2 h-4 w-4 text-green-500" />
                        <span>WhatsApp</span>
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                    <Link href="https://t.me/InvokIA_bot" target="_blank" className="flex items-center w-full">
                        <TelegramIcon className="mr-2 h-4 w-4 text-blue-500" />
                        <span>Telegram</span>
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsChatOpen(true)}>
                    <MessageSquare className="mr-2 h-4 w-4 text-purple-500" />
                    <span>{tFloating('openChat')}</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );

    return (
        <>
            <div className="fixed top-3 right-4 z-[50] flex flex-col items-end gap-2">
                {!isExpanded ? (
                    <div className="flex items-center bg-[hsl(var(--floating-header-bg)/0.8)] backdrop-blur-md p-1 rounded-full border border-border shadow-lg transition-all hover:bg-[hsl(var(--floating-header-bg))]">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsExpanded(true)}
                            className="rounded-full h-8 w-8 hover:bg-accent"
                        >
                            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                        </Button>
                    </div>
                ) : (
                    <div className={cn(
                        "flex items-center gap-3 bg-[hsl(var(--floating-header-bg)/0.95)] backdrop-blur-md p-2 rounded-full border border-border shadow-2xl transition-all",
                        "animate-in fade-in slide-in-from-right-10 duration-300"
                    )}>
                        <div className="flex items-center gap-3 px-2">
                            <OpenCashSessionWidget />
                            <TVDisplayWidget />

                            <div className="h-6 w-px bg-border/50" />

                            {hasPermission(GLOBAL_PERMISSIONS.GLOBAL_VIEW_NOTIFICATIONS_BADGE) && (
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
                            )}

                            {hasPermission(GLOBAL_PERMISSIONS.GLOBAL_VIEW_EXCHANGE_RATE) && activeCashSession && <ExchangeRate activeCashSession={activeCashSession} />}

                            {hasPermission(GLOBAL_PERMISSIONS.GLOBAL_CHANGE_LANGUAGE) && (
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
                            )}

                            <HelpMenu />
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

            {isChatOpen && (
                <div className="fixed bottom-4 right-4 z-[60] w-full max-w-sm animate-in slide-in-from-bottom-4 duration-300">
                    <Card className="h-[60vh] flex flex-col shadow-2xl border-primary/20 overflow-hidden">
                        <CardHeader className="flex flex-row items-center justify-between p-4 border-b bg-primary text-primary-foreground shrink-0">
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <MessageSquare className="h-4 w-4" />
                                {tFloating('chatbotTitle')}
                            </CardTitle>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setIsChatOpen(false)}
                                className="h-8 w-8 text-primary-foreground hover:bg-white/20"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </CardHeader>
                        <CardContent className="p-0 flex-1 overflow-hidden">
                            <iframe
                                src={`${process.env.NEXT_PUBLIC_API_URL || 'https://n8n-project-n8n.7ig1i3.easypanel.host'}/webhook/a8ad846b-de6a-4d89-8e02-01072101cfe6/chat`}
                                className="w-full h-full border-0"
                                title="n8n Chatbot"
                            ></iframe>
                        </CardContent>
                    </Card>
                </div>
            )}
        </>
    );
}