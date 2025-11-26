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

const MainSidebar = () => {
    const pathname = usePathname();
    const t = useTranslations('Navigation');
    const locale = useLocale();

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
            <div className="flex h-14 items-center justify-center border-b px-4 lg:h-[60px] lg:px-6">
                <Link href="/" className="flex items-center gap-2 font-semibold text-foreground">
                    <Image src="https://www.invokeia.com/assets/InvokeIA_C@4x-4T0dztu0.webp" width={32} height={32} alt="InvokeIA Logo" />
                </Link>
            </div>
            <TooltipProvider>
                <nav className="flex flex-col items-center gap-4 px-2 sm:py-5">
                    {navItems.map(item => {
                        const isActive = item.href === '/'
                            ? effectivePathname === '/'
                            : effectivePathname.startsWith(item.href);

                        let linkHref = `/${locale}${item.href === '/' ? '' : item.href}`;
                        if (item.href.includes('/clinic-history')) {
                            linkHref = `/${locale}/clinic-history/1`; // Default user
                        }

                        return (
                            <Tooltip key={item.title}>
                                <TooltipTrigger asChild>
                                    <Link href={linkHref}
                                        className={cn(
                                            "flex h-9 w-9 items-center justify-center rounded-lg transition-colors md:h-8 md:w-8",
                                            isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                                        )}>
                                        <item.icon className="h-5 w-5" />
                                        <span className="sr-only">{t(item.title as any)}</span>
                                    </Link>
                                </TooltipTrigger>
                                <TooltipContent side="right">{t(item.title as any)}</TooltipContent>
                            </Tooltip>
                        )
                    })}
                </nav>
            </TooltipProvider>
        </aside>
    );
}

const SecondarySidebar = () => {
    const pathname = usePathname();
    const locale = useLocale();
    const [isClient, setIsClient] = React.useState(false);
    
    React.useEffect(() => {
        setIsClient(true);
    }, []);

    const getEffectivePathname = (p: string, l: string) => {
        const localePrefix = `/${l}`;
        if (p.startsWith(localePrefix)) {
            return p.substring(localePrefix.length) || '/';
        }
        return p;
    };
    const effectivePathname = getEffectivePathname(pathname, locale);
    
    const activeParentItem = navItems.find(item => item.href !== '/' && effectivePathname.startsWith(item.href));

    if (!isClient || !activeParentItem || !activeParentItem.items) {
        return null;
    }
    
    return (
        <div className="fixed inset-y-0 left-20 z-30 hidden h-screen w-64 flex-col border-r bg-muted/40 md:flex">
             <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
                <h2 className="text-lg font-semibold">{activeParentItem.title}</h2>
             </div>
            <div className="flex-1 overflow-y-auto">
                <Nav items={activeParentItem.items} />
            </div>
        </div>
    );
};

export function Sidebar() {
  return (
    <>
        <MainSidebar />
        <SecondarySidebar />
    </>
  );
}
