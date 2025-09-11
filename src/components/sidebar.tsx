
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Nav } from './nav';
import { navItems } from '@/config/nav';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/hooks/use-sidebar';
import * as React from 'react';
import { Skeleton } from './ui/skeleton';
import { useLocale } from 'next-intl';

export function Sidebar() {
    const { isMinimized } = useSidebar();
    const [isMounted, setIsMounted] = React.useState(false);
    const locale = useLocale();

    React.useEffect(() => {
        setIsMounted(true);
    }, []);

    const sidebarWidth = isMinimized ? "w-16" : "w-64";

    if (!isMounted) {
        return (
            <aside className="hidden w-64 flex-col border-r bg-gray-900 text-white sm:flex">
                <div className="flex h-14 items-center border-b border-gray-700 px-4 lg:h-[60px]">
                     <Link href={`/${locale}`} className="flex items-center gap-2 font-semibold text-white">
                        <Image src="https://www.invokeia.com/assets/InvokeIA_C@4x-4T0dztu0.webp" width={32} height={32} alt="InvokeIA Logo" />
                        <span>InvokeIA</span>
                    </Link>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                   <div className="grid items-start gap-1 text-sm font-medium">
                        {navItems.map((item, index) => (
                            <div key={index} className="p-2">
                                <Skeleton className="h-5 w-3/4" />
                            </div>
                        ))}
                    </div>
                </div>
            </aside>
        );
    }
    
    return (
        <aside className={cn(
            "hidden flex-col border-r bg-gray-900 text-white transition-all duration-300 ease-in-out sm:flex",
            sidebarWidth
        )}>
            <div className={cn(
                "flex h-14 items-center border-b border-gray-700 px-4 lg:h-[60px]",
                isMinimized && "justify-center"
            )}>
                <Link href={`/${locale}`} className="flex items-center gap-2 font-semibold text-white">
                    <Image src="https://www.invokeia.com/assets/InvokeIA_C@4x-4T0dztu0.webp" width={32} height={32} alt="InvokeIA Logo" />
                    {!isMinimized && <span>InvokeIA</span>}
                </Link>
            </div>
            <div className="flex-1 overflow-y-auto">
                <Nav items={navItems} isMinimized={isMinimized}/>
            </div>
        </aside>
    );
}
