'use client';

import Link from 'next/link';
import { Nav } from './nav';
import { navItems } from '@/config/nav';
import { Logo } from './icons/logo';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/hooks/use-sidebar';

export function Sidebar() {
    const { isMinimized } = useSidebar();
  return (
    <aside className={cn("hidden flex-col border-r bg-muted/40 transition-all duration-300 ease-in-out sm:flex", isMinimized ? "w-16" : "w-64")}>
      <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold text-foreground">
          <Logo className="h-6 w-6" />
          {!isMinimized && <span className="">InvokeIA</span>}
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto">
        <Nav items={navItems} isMinimized={isMinimized}/>
      </div>
    </aside>
  );
}
