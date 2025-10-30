
'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Menu,
  Moon,
  Sun,
  PanelLeftClose,
  PanelRightClose,
  Globe,
  Check,
  LogOut,
  AlertTriangle,
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Nav } from './nav';
import { navItems, NavItem } from '@/config/nav';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { useSidebar } from '@/hooks/use-sidebar';
import { useLocale, useTranslations } from 'next-intl';
import { UyFlagIcon } from './icons/uy-flag-icon';
import { UsFlagIcon } from './icons/us-flag-icon';
import { useAuth } from '@/context/AuthContext';


export function Header() {
  const pathname = usePathname();
  const { setTheme } = useTheme();
  const { isMinimized, toggleSidebar } = useSidebar();
  const t = useTranslations('Header');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { logout, user } = useAuth();
  const tLogoutConfirm = useTranslations('LogoutConfirmation');

  const [isLogoutAlertOpen, setIsLogoutAlertOpen] = React.useState(false);


  const onSelectLocale = (newLocale: string) => {
    const newPathname = pathname.replace(`/${locale}`, `/${newLocale}`);
    const newUrl = `${newPathname}?${searchParams.toString()}`;
    router.replace(newUrl);
  };
  
  const breadcrumbSegments = pathname.split('/').filter(Boolean).slice(1);
  const tNav = useTranslations('Navigation');
  
  const findNavItemBySegment = (items: NavItem[], segment: string): NavItem | undefined => {
    for (const item of items) {
      const itemBase = item.href.split('/').pop() || '';
      if (itemBase === segment) {
        return item;
      }
      if (item.items) {
        const found = findNavItemBySegment(item.items, segment);
        if (found) return found;
      }
    }
    return undefined;
  };

  const breadcrumbItems = breadcrumbSegments.map((segment, index) => {
      let currentPath = `/${locale}/${breadcrumbSegments.slice(0, index + 1).join('/')}`;
      const isLast = index === breadcrumbSegments.length - 1;
  
      const navItem = findNavItemBySegment(navItems, segment);
      
      let title: string;
       if (navItem) {
        try {
          title = tNav(navItem.title as any);
        } catch (e) {
          title = segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');
        }
      } else {
        // Handle dynamic segments like user_id by showing them as is
        title = segment;
      }

      return (
        <React.Fragment key={currentPath}>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            {isLast ? (
              <BreadcrumbPage>{title}</BreadcrumbPage>
            ) : (
              <BreadcrumbLink asChild>
                 <Link href={currentPath}>{title}</Link>
              </BreadcrumbLink>
            )}
          </BreadcrumbItem>
        </React.Fragment>
      );
  });

  const handleLogout = () => {
    logout();
    router.push(`/${locale}/login`);
  };

  const handleLogoutClick = async () => {
    if (!user) {
        handleLogout();
        return;
    }
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/cash-session/active?user_id=${user.id}`, {
            method: 'GET',
            mode: 'cors',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok && data.code === 200) {
            setIsLogoutAlertOpen(true);
        } else {
            handleLogout();
        }
    } catch (error) {
        console.error("Failed to check active session, logging out anyway:", error);
        handleLogout();
    }
  };

  return (
    <>
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
            <Link href={`/${locale}`} className="flex items-center gap-2 font-semibold">
              <Image src="https://www.invokeia.com/assets/InvokeIA_C@4x-4T0dztu0.webp" width={24} height={24} alt="InvokeIA Logo" />
              <span className="text-xl drop-shadow-[1px_1px_1px_rgba(0,0,0,0.4)]">InvokeIA</span>
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
          {pathname === `/${locale}` ? (
            <BreadcrumbItem>
              <BreadcrumbPage>{tNav('Dashboard')}</BreadcrumbPage>
            </BreadcrumbItem>
          ) : (
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={`/${locale}`}>{tNav('Dashboard')}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
          )}
          {breadcrumbItems}
        </BreadcrumbList>
      </Breadcrumb>
      <div className="relative ml-auto flex flex-1 items-center justify-end gap-2 md:grow-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <Globe className="h-[1.2rem] w-[1.2rem]" />
              <span className="sr-only">{t('toggleLanguage')}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onSelectLocale('es')} disabled={locale === 'es'}>
                 <span className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                        <UyFlagIcon className="h-4 w-4" />
                        {t('spanish')}
                    </div>
                    {locale === 'es' && <Check className="h-4 w-4 ml-2" />}
                </span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onSelectLocale('en')} disabled={locale === 'en'}>
                <span className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                        <UsFlagIcon className="h-4 w-4" />
                        {t('english')}
                    </div>
                    {locale === 'en' && <Check className="h-4 w-4 ml-2" />}
                </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
            <DropdownMenuLabel>{user?.name || t('myAccount')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogoutClick}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>{t('logout')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
    <AlertDialog open={isLogoutAlertOpen} onOpenChange={setIsLogoutAlertOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-6 w-6 text-yellow-500" />
                    {tLogoutConfirm('title')}
                </AlertDialogTitle>
                <AlertDialogDescription>
                    {tLogoutConfirm('description')}
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>{tLogoutConfirm('cancel')}</AlertDialogCancel>
                <Button variant="outline" onClick={() => router.push(`/${locale}/cashier`)}>
                    {tLogoutConfirm('goToCashier')}
                </Button>
                <AlertDialogAction onClick={handleLogout} className="bg-destructive hover:bg-destructive/90">
                    {tLogoutConfirm('logoutAnyway')}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
