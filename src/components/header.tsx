
'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Menu,
  Moon,
  Sun,
  Globe,
  Check,
  LogOut,
  AlertTriangle,
  KeyRound,
  MoreHorizontal,
} from 'lucide-react';
import { useTheme } from 'next-themes';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { navItems } from '@/config/nav';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { UyFlagIcon } from './icons/uy-flag-icon';
import { UsFlagIcon } from './icons/us-flag-icon';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Form } from './ui/form';
import { HorizontalNav } from './horizontal-nav';
import { ExchangeRate } from './exchange-rate';


const passwordFormSchema = (t: (key: string) => string) => z.object({
    old_password: z.string().min(1, t('validation.oldPasswordRequired')),
    new_password: z.string()
        .min(8, t('validation.newPasswordMin'))
        .regex(/[A-Z]/, t('validation.newPasswordUpper'))
        .regex(/[0-9]/, t('validation.newPasswordNumber')),
    confirm_password: z.string(),
}).refine(data => data.new_password === data.confirm_password, {
    message: t('validation.passwordsMismatch'),
    path: ['confirm_password'],
});

type PasswordFormValues = z.infer<ReturnType<typeof passwordFormSchema>>;

export function Header() {
  const pathname = usePathname();
  const { setTheme } = useTheme();
  const t = useTranslations('Header');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { logout, user } = useAuth();
  const { toast } = useToast();

  const [isLogoutAlertOpen, setIsLogoutAlertOpen] = React.useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = React.useState(false);
  const [passwordChangeError, setPasswordChangeError] = React.useState<string | null>(null);

  const [visibleItems, setVisibleItems] = React.useState(navItems);
  const [hiddenItems, setHiddenItems] = React.useState<typeof navItems>([]);
  const navRef = React.useRef<HTMLDivElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema(t)),
    defaultValues: {
      old_password: '',
      new_password: '',
      confirm_password: '',
    },
  });

  const updateMenu = React.useCallback(() => {
    if (navRef.current && containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const navItemsElements = Array.from(navRef.current.children) as HTMLElement[];
        let currentWidth = 0;
        let visibleCount = 0;

        for (const item of navItemsElements) {
            currentWidth += item.offsetWidth;
            if (currentWidth > containerWidth) {
                break;
            }
            visibleCount++;
        }
        
        // Adjust for the "More" button width if it's needed
        if (visibleCount < navItems.length) {
            let widthWithMore = 0;
            let countWithMore = 0;
            for (let i = 0; i < navItems.length; i++) {
                widthWithMore += navItemsElements[i]?.offsetWidth || 0;
                // 80px is a safe estimate for the "More" button width + gap
                if (widthWithMore + 80 > containerWidth) {
                    break;
                }
                countWithMore++;
            }
             setVisibleItems(navItems.slice(0, countWithMore));
             setHiddenItems(navItems.slice(countWithMore));
        } else {
            setVisibleItems(navItems);
            setHiddenItems([]);
        }
    }
  }, []);

  React.useEffect(() => {
    updateMenu();
    window.addEventListener('resize', updateMenu);
    return () => window.removeEventListener('resize', updateMenu);
  }, [updateMenu]);


  React.useEffect(() => {
    if (isChangePasswordOpen) {
      form.reset({
        old_password: '',
        new_password: '',
        confirm_password: '',
      });
      setPasswordChangeError(null);
    }
  }, [isChangePasswordOpen, form]);

  const onSelectLocale = (newLocale: string) => {
    const newPathname = pathname.replace(`/${locale}`, `/${newLocale}`);
    const newUrl = `${newPathname}?${searchParams.toString()}`;
    router.replace(newUrl);
  };

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

  const handleChangePasswordSubmit: SubmitHandler<PasswordFormValues> = async (data) => {
    setPasswordChangeError(null);
    const token = localStorage.getItem('token');
    if (!token) {
        setPasswordChangeError(t('errors.noToken'));
        return;
    }

    try {
        const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/api/auth/password-change?token=${token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                old_password: data.old_password,
                new_password: data.new_password,
            }),
        });

        const responseData = await response.json().catch(() => ({}));
        
        if (!response.ok) {
            let errorMessage = t('errors.generic');
            if (response.status === 401) {
                errorMessage = t('errors.incorrectOldPassword');
            } else if (response.status === 400 && responseData.message) {
                 errorMessage = responseData.message;
            }
            throw new Error(errorMessage);
        }

        toast({
            title: t('success.title'),
            description: responseData.message || t('success.description'),
        });
        setIsChangePasswordOpen(false);

    } catch (error) {
        setPasswordChangeError(error instanceof Error ? error.message : t('errors.generic'));
    }
  };

  return (
    <>
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur-sm">
      <div className="container flex h-14 items-center">
        <div className="mr-4 hidden md:flex">
          <Link href={`/${locale}`} className="flex items-center gap-2 font-semibold text-foreground">
              <Image src="https://www.invokeia.com/assets/InvokeIA_C@4x-4T0dztu0.webp" width={24} height={24} alt="InvokeIA Logo" />
          </Link>
        </div>
        
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
                </Link>
                </div>
                 <div className="flex-1 overflow-y-auto py-2">
                    {/* Simplified nav for mobile */}
                </div>
            </SheetContent>
        </Sheet>
        
        <div ref={containerRef} className="flex flex-1 items-center justify-end space-x-2">
            <div ref={navRef} className="hidden md:flex flex-1 items-center">
                <HorizontalNav items={visibleItems} />
                {hiddenItems.length > 0 && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-9 px-3 text-sm font-medium">
                                More
                                <MoreHorizontal className="ml-2 h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            {hiddenItems.map(item => (
                                <DropdownMenuItem key={item.title} asChild>
                                    <Link href={item.href}>{t(item.title as any)}</Link>
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>
            <nav className="flex items-center gap-2">
                <ExchangeRate />
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
                        <DropdownMenuItem onClick={() => setTheme('light')}>Light</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setTheme('dark')}>Dark</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setTheme('system')}>System</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="overflow-hidden rounded-full">
                            <Image src="https://picsum.photos/36/36" width={36} height={36} alt="Avatar" className="overflow-hidden rounded-full" data-ai-hint="user avatar" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>{user?.name || t('myAccount')}</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setIsChangePasswordOpen(true)}>
                            <KeyRound className="mr-2 h-4 w-4" />
                            <span>{t('changePassword')}</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleLogoutClick}>
                            <LogOut className="mr-2 h-4 w-4" />
                            <span>{t('logout')}</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </nav>
        </div>
      </div>
    </header>
    <AlertDialog open={isLogoutAlertOpen} onOpenChange={setIsLogoutAlertOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-6 w-6 text-yellow-500" />
                    {t('logoutConfirmation.title')}
                </AlertDialogTitle>
                <AlertDialogDescription>
                    {t('logoutConfirmation.description')}
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>{t('logoutConfirmation.cancel')}</AlertDialogCancel>
                <Button variant="outline" onClick={() => {router.push(`/${locale}/cashier`); setIsLogoutAlertOpen(false);}}>
                    {t('logoutConfirmation.goToCashier')}
                </Button>
                <AlertDialogAction onClick={handleLogout} className="bg-destructive hover:bg-destructive/90">
                    {t('logoutConfirmation.logoutAnyway')}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    {/* Form is not a direct child of DialogContent, so we wrap it here */}
    <Dialog open={isChangePasswordOpen} onOpenChange={setIsChangePasswordOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('changePasswordDialog.title')}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleChangePasswordSubmit)}>
            {/* The actual form content */}
          </form>
        </Form>
      </DialogContent>
    </Dialog>
    </>
  );
}
