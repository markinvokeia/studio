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
  Search,
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
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { UyFlagIcon } from './icons/uy-flag-icon';
import { UsFlagIcon } from './icons/us-flag-icon';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from './ui/form';
import { Input } from './ui/input';
import { ExchangeRate } from './exchange-rate';
import { useSidebar } from '@/hooks/use-sidebar';


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
  const tNav = useTranslations('Navigation');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { logout, user } = useAuth();
  const { toast } = useToast();
  const { toggleSidebar } = useSidebar();

  const [isLogoutAlertOpen, setIsLogoutAlertOpen] = React.useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = React.useState(false);
  const [passwordChangeError, setPasswordChangeError] = React.useState<string | null>(null);
  
  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema(t)),
  });

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
      <div className="flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={toggleSidebar}
            >
              <Menu className="h-4 w-4" />
              <span className="sr-only">Toggle Sidebar</span>
            </Button>
          <Link href={`/${locale}`} className="flex items-center gap-2 font-semibold text-foreground">
              <Image src="https://www.invokeia.com/assets/InvokeIA_C@4x-4T0dztu0.webp" width={24} height={24} alt="InvokeIA Logo" />
          </Link>
          <div className="relative ml-auto flex-1 md:grow-0">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder={t('commandPlaceholder')}
              className="w-full rounded-lg bg-muted pl-8 md:w-[200px] lg:w-[320px]"
            />
          </div>
        </div>
        
        <div className="flex items-center justify-end gap-2">
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
                <Link href={`/${locale}/cashier`} passHref>
                  <Button variant="outline">
                      {t('logoutConfirmation.goToCashier')}
                  </Button>
                </Link>
                <AlertDialogAction onClick={handleLogout} className="bg-destructive hover:bg-destructive/90">
                    {t('logoutConfirmation.logoutAnyway')}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    <Dialog open={isChangePasswordOpen} onOpenChange={setIsChangePasswordOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('changePasswordDialog.title')}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleChangePasswordSubmit)} className="space-y-4 py-4">
                {passwordChangeError && (
                    <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>{t('errors.title')}</AlertTitle>
                        <AlertDescription>{passwordChangeError}</AlertDescription>
                    </Alert>
                )}
                <FormField
                    control={form.control}
                    name="old_password"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{t('changePasswordDialog.oldPassword')}</FormLabel>
                            <FormControl>
                                <Input type="password" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="new_password"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{t('changePasswordDialog.newPassword')}</FormLabel>
                            <FormControl>
                                <Input type="password" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="confirm_password"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{t('changePasswordDialog.confirmPassword')}</FormLabel>
                            <FormControl>
                                <Input type="password" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <DialogFooter>
                    <Button variant="outline" type="button" onClick={() => setIsChangePasswordOpen(false)}>{t('changePasswordDialog.cancel')}</Button>
                    <Button type="submit">{t('changePasswordDialog.save')}</Button>
                </DialogFooter>
            </form>
        </Form>
      </DialogContent>
    </Dialog>
    </>
  );
}
