'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Menu,
  Moon,
  Sun,
  PanelLeftClose,
  PanelRightClose
} from 'lucide-react';
import { useTheme } from 'next-themes';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { CommandBar } from './command-bar';
import { Nav } from './nav';
import { navItems } from '@/config/nav';
import { usePathname } from 'next/navigation';
import { useSidebar } from '@/hooks/use-sidebar';

export function Header() {
  const pathname = usePathname();
  const { setTheme } = useTheme();
  const { isMinimized, toggleSidebar } = useSidebar();
  
  const breadcrumbSegments = pathname.split('/').filter(Boolean);
  const breadcrumbItems = breadcrumbSegments.map((segment, index) => {
    const href = '/' + breadcrumbSegments.slice(0, index + 1).join('/');
    const isLast = index === breadcrumbSegments.length - 1;
    const navItem = navItems.flatMap(item => item.items ? item.items : item).find(item => item.href === href);
    const title = navItem?.title || segment.charAt(0).toUpperCase() + segment.slice(1);
    
    return (
      <React.Fragment key={href}>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          {isLast ? (
            <BreadcrumbPage>{title}</BreadcrumbPage>
          ) : (
            <BreadcrumbLink asChild>
              <Link href={href}>{title}</Link>
            </BreadcrumbLink>
          )}
        </BreadcrumbItem>
      </React.Fragment>
    );
  });

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 mt-4">
      <Sheet>
        <SheetTrigger asChild>
          <Button size="icon" variant="outline" className="sm:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle Menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="sm:max-w-xs p-0">
           <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <Image src="https://www.invokeia.com/assets/InvokeIA_C@4x-4T0dztu0.webp" width={24} height={24} alt="InvokeIA Logo" />
              <span className="">InvokeIA</span>
            </Link>
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            <Nav items={navItems} isMinimized={false} />
          </div>
        </SheetContent>
      </Sheet>
       <Button size="icon" variant="outline" className="hidden sm:flex" onClick={toggleSidebar}>
          {isMinimized ? <PanelRightClose className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          <span className="sr-only">Toggle Menu</span>
        </Button>
      <Breadcrumb className="hidden md:flex">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/">Dashboard</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          {breadcrumbItems}
        </BreadcrumbList>
      </Breadcrumb>
      <div className="relative ml-auto flex flex-1 items-center justify-end gap-2 md:grow-0">
        <CommandBar />
         <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setTheme('light')}>
              Light
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('dark')}>
              Dark
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('system')}>
              System
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="overflow-hidden rounded-full"
            >
              <Image
                src="https://picsum.photos/36/36"
                width={36}
                height={36}
                alt="Avatar"
                className="overflow-hidden rounded-full"
                data-ai-hint="user avatar"
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <DropdownMenuItem>Support</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Logout</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
