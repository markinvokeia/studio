'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSidebar } from '@/hooks/use-sidebar';
import { Nav } from '@/components/nav';
import { navItems } from '@/config/nav';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

export function Sidebar() {
    const { isMinimized } = useSidebar();
    const t = useTranslations();
    
    return (
        <aside className={cn(
            "fixed inset-y-0 left-0 z-50 hidden md:flex flex-col bg-card border-r transition-all duration-300",
            isMinimized ? "w-20" : "w-64"
        )}>
             <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
                <Link href="/" className="flex items-center gap-2 font-semibold text-foreground">
                    <Image src="https://www.invokeia.com/assets/InvokeIA_C@4x-4T0dztu0.webp" width={24} height={24} alt="InvokeIA Logo" />
                    {!isMinimized && <span>{t('Header.commandPlaceholder')}</span>}
                </Link>
             </div>
            <div className="flex-1 overflow-y-auto">
                <Nav items={navItems} isMinimized={isMinimized} />
            </div>
        </aside>
    );
}
