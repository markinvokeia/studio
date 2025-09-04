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
    const [isClient, setIsClient] = React.useState(false);

    React.useEffect(() => {
        setIsClient(true);
    }, []);

  return (
    <aside className={cn(
        "hidden flex-col border-r bg-primary text-primary-foreground transition-all duration-300 ease-in-out sm:flex",
        isMinimized ? "w-16" : "w-64"
    )}>
      <div className="flex h-14 items-center border-b border-primary-foreground/20 px-4 lg:h-[60px]">
        <Link href="/" className="flex items-center gap-2 font-semibold text-primary-foreground">
          <Image src="https://www.invokeia.com/assets/InvokeIA_C@4x-4T0dztu0.webp" width={32} height={32} alt="InvokeIA Logo" />
           {!isMinimized && <span className="">InvokeIA</span>}
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto">
        {isClient ? <Nav items={navItems} isMinimized={isMinimized}/> : null}
      </div>
    </aside>
  );
}
