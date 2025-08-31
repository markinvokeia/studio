import Link from 'next/link';
import { BotMessageSquare } from 'lucide-react';
import { Nav } from './nav';
import { navItems } from '@/config/nav';

export function Sidebar() {
  return (
    <aside className="hidden w-64 flex-col border-r bg-card sm:flex">
      <div className="flex h-14 items-center border-b px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold text-primary-foreground">
          <BotMessageSquare className="h-6 w-6 text-primary" />
          <span className="text-lg">InvokeIA</span>
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto">
        <Nav items={navItems} />
      </div>
    </aside>
  );
}
