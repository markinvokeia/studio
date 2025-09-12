
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Nav } from './nav';
import { navItems } from '@/config/nav';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/hooks/use-sidebar';
import * as React from 'react';
import { useLocale } from 'next-intl';

export function Sidebar() {
    const { isMinimized } = useSidebar();
    const locale = useLocale();
    const sidebarWidth = isMinimized ? "w-16" : "w-64";
    
    return (
        <aside className={cn(
            "hidden flex-col border-r text-white transition-all duration-300 ease-in-out sm:flex sidebar-bg-pattern",
            sidebarWidth
        )}>
            <div className={cn(
                "flex h-14 items-center border-b border-white/20 px-4 lg:h-[60px]",
                isMinimized && "justify-center"
            )}>
                <Link href={`/${locale}`} className="flex items-center gap-2 font-semibold text-white">
                    <Image src="https://www.invokeia.com/assets/InvokeIA_C@4x-4T0dztu0.webp" width={32} height={32} alt="InvokeIA Logo" />
                    {!isMinimized && <span className="text-xl drop-shadow-[1px_1px_1px_rgba(0,0,0,0.4)]">InvokeIA</span>}
                </Link>
            </div>
            <div className="flex-1 overflow-y-auto">
                <Nav items={navItems} isMinimized={isMinimized}/>
            </div>
        </aside>
    );
}
