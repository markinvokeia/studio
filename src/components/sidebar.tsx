
'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Nav } from '@/components/nav';
import { navItems } from '@/config/nav';
import { cn } from '@/lib/utils';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { useAlertNotifications } from '@/context/alert-notifications-context';

const MainSidebar = ({ onHover }: { onHover: (item: any) => void; }) => {
    const pathname = usePathname();
    const t = useTranslations('Navigation');
    const locale = useLocale();
    const { pendingCount } = useAlertNotifications();

    const getEffectivePathname = (p: string, l: string) => {
        const localePrefix = `/${l}`;
        if (p.startsWith(localePrefix)) {
            return p.substring(localePrefix.length) || '/';
        }
        return p;
    };

    const effectivePathname = getEffectivePathname(pathname, locale);



    return (
        <aside className="fixed inset-y-0 left-0 z-40 flex h-screen w-20 flex-col border-r bg-card">
            <div className="flex h-14 items-center justify-center border-b px-2 lg:h-[60px]">
                <Link href={`/${locale}`} className="flex items-center gap-2 font-semibold text-foreground">
                    <Image src="https://www.invokeia.com/assets/InvokeIA_C@4x-4T0dztu0.webp" width={56} height={56} alt="InvokeIA Logo" />
                </Link>
            </div>
            <TooltipProvider>
                <div className="flex-1 min-h-0 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                    <nav className="flex flex-col items-center gap-0.5 sm:py-2">
                        {navItems.map(item => {
                            const isActive = item.items
                                ? (item.href === '/cashier' 
                                    ? item.items.some(subItem => subItem.href !== '' && effectivePathname === subItem.href)
                                    : item.items.some(subItem => subItem.href !== '' && effectivePathname === subItem.href) || effectivePathname.startsWith(item.href + '/'))
                                : (item.href === '/' ? effectivePathname === '/' : effectivePathname === item.href || effectivePathname.startsWith(item.href + '/'));

                            let linkHref = `/${locale}${item.href === '/' ? '' : item.href}`;
                            if (item.href.includes('/clinic-history')) {
                                const parts = effectivePathname.split('/');
                                const userIdFromUrl = parts[2] && !isNaN(parseInt(parts[2])) ? parts[2] : '1';
                                linkHref = `/${locale}/clinic-history/${userIdFromUrl}`;
                            }

                            return (
                                <Tooltip key={String(item.title)}>
                                    <TooltipTrigger asChild>
                                        <Link
                                            href={linkHref}
                                            className={cn(
                                                "flex h-auto w-full flex-col items-center justify-center gap-1 rounded-none p-2 transition-colors relative",
                                                isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                                            )}
                                            onMouseEnter={() => onHover(item)}
                                        >
                                            <div className="relative">
                                                <item.icon className="h-6 w-6" />
                                                {item.title === 'AlertsCenter' && pendingCount > 0 && (
                                                    <Badge
                                                        variant="destructive"
                                                        className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center text-xs p-0"
                                                    >
                                                        {pendingCount > 99 ? '99+' : pendingCount}
                                                    </Badge>
                                                )}
                                            </div>
                                            <span className="block w-full text-center text-[10px] font-medium leading-tight line-clamp-2">{t(item.title as any)}</span>
                                        </Link>
                                    </TooltipTrigger>
                                    <TooltipContent side="right">
                                        {t(item.title as any)}
                                        {item.title === 'AlertsCenter' && pendingCount > 0 && (
                                            <span className="ml-2 text-xs text-muted-foreground">
                                                ({pendingCount > 99 ? '99+' : pendingCount} pendientes)
                                            </span>
                                        )}
                                    </TooltipContent>
                                </Tooltip>
                            )
                        })}
                    </nav>
                </div>
            </TooltipProvider>
        </aside>
    );
}

const SecondarySidebar = ({ item, onLeave }: { item: any; onLeave: () => void }) => {
    const t = useTranslations('Navigation');
    if (!item || !item.items) {
        return null;
    }

    return (
        <div
            className="fixed inset-y-0 left-20 z-30 hidden h-screen w-64 flex-col border-r bg-card md:flex"
            onMouseLeave={onLeave}
        >
            <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
                <h2 className="text-lg font-semibold">{t(item.title as any)}</h2>
            </div>
            <div className="flex-1 overflow-y-auto">
                <Nav items={item.items} />
            </div>
        </div>
    );
};

export function Sidebar() {
    const [hoveredItem, setHoveredItem] = React.useState<any>(null);
    let leaveTimeout = React.useRef<NodeJS.Timeout>();

    const handleHover = (item: any) => {
        if (leaveTimeout.current) {
            clearTimeout(leaveTimeout.current);
        }
        if (item.items) {
            setHoveredItem(item);
        } else {
            setHoveredItem(null);
        }
    };

    const handleLeave = () => {
        leaveTimeout.current = setTimeout(() => {
            setHoveredItem(null);
        }, 300);
    };

    const handleSecondaryEnter = () => {
        if (leaveTimeout.current) {
            clearTimeout(leaveTimeout.current);
        }
    }

    return (
        <div onMouseLeave={handleLeave}>
            <MainSidebar onHover={handleHover} />
            {hoveredItem && <div onMouseEnter={handleSecondaryEnter}><SecondarySidebar item={hoveredItem} onLeave={handleLeave} /></div>}
        </div>
    );
}
