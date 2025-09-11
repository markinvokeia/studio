'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Nav } from './nav';
import { navItems } from '@/config/nav';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/hooks/use-sidebar';
import * as React from 'react';

export function Sidebar() {
    const { isMinimized } = useSidebar();
    const [isMounted, setIsMounted] = React.useState(false);

    React.useEffect(() => {
        setIsMounted(true);
    }, []);

    const sidebarWidth = isMounted && isMinimized ? "w-16" : "w-64";

    return (
        <aside className={cn(
            "hidden flex-col border-r bg-gray-900 text-white transition-all duration-300 ease-in-out sm:flex",
            sidebarWidth
        )}>
            <div className={cn(
                "flex h-14 items-center border-b border-gray-700 px-4 lg:h-[60px]",
                isMounted && isMinimized && "justify-center"
            )}>
                <Link href="/" className="flex items-center gap-2 font-semibold text-white">
                    <Image src="https://www.invokeia.com/assets/InvokeIA_C@4x-4T0dztu0.webp" width={32} height={32} alt="InvokeIA Logo" />
                    {(!isMounted || !isMinimized) && <span className="">InvokeIA</span>}
                </Link>
            </div>
            <div className="flex-1 overflow-y-auto">
                {isMounted ? <Nav items={navItems} isMinimized={isMinimized}/> : <Nav items={navItems} isMinimized={false} />}
            </div>
        </aside>
    );
}
