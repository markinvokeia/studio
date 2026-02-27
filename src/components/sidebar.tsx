'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
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

const MainSidebar = ({ onHover, activeItem }: { onHover: (item: any) => void; activeItem: any }) => {
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
        <aside className="fixed inset-y-0 left-0 z-50 flex h-screen w-20 flex-col bg-[var(--sidebar-gradient)] shadow-[4px_0_20px_rgba(0,0,0,0.1)] transition-all">
            <div className="flex h-14 items-center justify-center mb-4 mt-2 shrink-0">
                <Link href={`/${locale}`} className="transition-transform hover:scale-110">
                    <Image src="https://www.invokeia.com/assets/InvokeIA_C@4x-4T0dztu0.webp" width={48} height={48} alt="InvokeIA Logo" priority />
                </Link>
            </div>
            <TooltipProvider>
                <div className="flex-1 min-0 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                    <nav className="flex flex-col items-center gap-2">
                        {navItems.map(item => {
                            const isActive = item.items
                                ? (item.href === '/cashier' 
                                    ? item.items.some(subItem => subItem.href !== '' && effectivePathname === subItem.href)
                                    : item.items.some(subItem => subItem.href !== '' && effectivePathname === subItem.href) || effectivePathname.startsWith(item.href + '/'))
                                : (item.href === '/' ? effectivePathname === '/' : effectivePathname === item.href || effectivePathname.startsWith(item.href + '/'));

                            const isHovered = activeItem?.title === item.title;
                            const isExpanded = isHovered && item.items;

                            let linkHref = `/${locale}${item.href === '/' ? '' : item.href}`;
                            if (item.href.includes('/clinic-history')) {
                                const parts = effectivePathname.split('/');
                                const userIdFromUrl = parts[2] && !isNaN(parseInt(parts[2])) ? parts[2] : '1';
                                linkHref = `/${locale}/clinic-history/${userIdFromUrl}`;
                            }

                            return (
                                <Tooltip key={String(item.title)}>
                                    <TooltipTrigger asChild>
                                        <div className="relative mx-auto">
                                            <Link
                                                href={linkHref}
                                                className={cn(
                                                    "flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-xl transition-all duration-300 relative group",
                                                    (isActive || isHovered) 
                                                        ? 'bg-primary text-primary-foreground shadow-[0_0_15px_rgba(0,0,0,0.1)]' 
                                                        : 'text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground',
                                                    isExpanded && "w-20 rounded-r-none z-[61]"
                                                )}
                                                onMouseEnter={() => onHover(item)}
                                            >
                                                <div className="flex flex-col items-center justify-center gap-1 w-16 static">
                                                    <div className="relative">
                                                        <item.icon className={cn("h-6 w-6 transition-transform group-hover:scale-110", (isActive || isHovered) ? "text-primary-foreground" : "")} />
                                                        {item.title === 'AlertsCenter' && pendingCount > 0 && (
                                                            <Badge
                                                                variant="destructive"
                                                                className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center text-[10px] p-0 border-2 border-background animate-pulse"
                                                            >
                                                                {pendingCount > 99 ? '99+' : pendingCount}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <span className="block w-full text-center text-[9px] font-bold uppercase tracking-tight leading-tight line-clamp-1 opacity-80">{t(item.title as any)}</span>
                                                </div>
                                            </Link>
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="right" className="bg-primary text-primary-foreground border-none font-bold">
                                        {t(item.title as any)}
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
    const locale = useLocale();
    if (!item || !item.items) return null;

    return (
        <div
            className="fixed left-20 z-[60] hidden md:flex flex-col bg-primary text-primary-foreground shadow-[8px_8px_20px_rgba(0,0,0,0.1)] rounded-r-2xl overflow-hidden animate-in fade-in slide-in-from-left-2 duration-200 h-auto max-h-[85vh] my-auto top-0 bottom-0"
            onMouseLeave={onLeave}
            style={{ width: '200px' }}
        >
            <div className="flex h-12 items-center px-6 border-b border-primary-foreground/10 bg-primary-foreground/5">
                <h2 className="text-xs font-black uppercase tracking-widest">{t(item.title as any)}</h2>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
                <nav className="grid gap-1 pl-2 pr-0">
                    {item.items.map((subItem: any, index: number) => (
                        <Link
                            key={index}
                            href={`/${locale}${subItem.href}`}
                            className="flex items-center gap-3 px-4 py-2.5 rounded-l-lg rounded-r-none text-sm font-bold transition-all hover:bg-primary-foreground/20 active:scale-95"
                        >
                            <subItem.icon className="h-4 w-4 opacity-80" />
                            <span>{t(subItem.title as any)}</span>
                        </Link>
                    ))}
                </nav>
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
        setHoveredItem(item);
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
            <MainSidebar handleHover={handleHover} onHover={handleHover} activeItem={hoveredItem} />
            {hoveredItem && (
                <div onMouseEnter={handleSecondaryEnter}>
                    <SecondarySidebar item={hoveredItem} onLeave={handleLeave} />
                </div>
            )}
        </div>
    );
}