'use client';

import Link from 'next/link';
import { Nav } from './nav';
import { navItems } from '@/config/nav';
import { Logo } from './icons/logo';

export function Sidebar() {
  return (
    <aside className="hidden w-64 flex-col border-r bg-card sm:flex">
      <div className="flex h-14 items-center border-b px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold text-primary-foreground">
          <Logo className="h-8 w-8" />
          <span className="text-lg">InvokeIA</span>
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto">
        <Nav items={navItems} />
      </div>
    </aside>
  );
}
