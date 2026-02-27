'use client';

import { OpenCashSessionWidget } from '@/components/cash-session-widget';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { API_ROUTES } from '@/constants/routes';
import { useAlertNotifications } from '@/context/alert-notifications-context';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import {
    AlertTriangle,
    Bell,
    Check,
    Globe,
    KeyRound,
    LogOut,
    Moon,
    Sun
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';
import * as z from 'zod';
import { ExchangeRate } from './exchange-rate';
import { UsFlagIcon } from './icons/us-flag-icon';
import { UyFlagIcon } from './icons/uy-flag-icon';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from './ui/form';
import { Input } from './ui/input';


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
    const { theme, setTheme } = useTheme();
    const t = useTranslations('Header');
    const locale = useLocale();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { logout, user, activeCashSession } = useAuth();
    const { toast } = useToast();

    const [isLogoutAlertOpen, setIsLogoutAlertOpen] = React.useState(false);
    const [isChangePasswordOpen, setIsChangePasswordOpen] = React.useState(false);
    const [passwordChangeError, setPasswordChangeError] = React.useState<string | null>(null);

    const { pendingCount } = useAlertNotifications();

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
            const data = await api.get(API_ROUTES.CASHIER.SESSIONS_ACTIVE, { user_id: user.id });
            if (data.code === 200) {
                setIsLogoutAlertOpen(true);
            } else {
                handleLogout();
            }
        } catch (error) {
            console.error('Failed to check active session:', error);
            handleLogout();
        }
    };

    const handleChangePasswordSubmit: SubmitHandler<PasswordFormValues> = async (data: PasswordFormValues) => {
        setPasswordChangeError(null);
        const token = localStorage.getItem('token');
        if (!token) {
            setPasswordChangeError(t('errors.noToken'));
            return;
        }

        try {
            const responseData = await api.post(API_ROUTES.SYSTEM.API_AUTH_PASSWORD_CHANGE, {
                old_password: data.old_password,
                new_password: data.new_password,
            }, undefined, { token });

            toast({
                title: t('success.title'),
                description: responseData.message || t('success.description'),
            });
            setIsChangePasswordOpen(false);

        } catch (error) {
            let errorMessage = t('errors.generic');
            if (error instanceof Error) {
                if (error.message.includes('401')) {
                    errorMessage = t('errors.incorrectOldPassword');
                } else if (error.message.includes('400')) {
                    errorMessage = error.message;
                } else {
                    errorMessage = error.message;
                }
            }
            setPasswordChangeError(errorMessage);
        }
    };

    return (
        <>
            <header className="sticky top-0 z-30 w-full bg-background shadow-[0_4px_12px_rgba(0,0,0,0.05)] border-none">
                <div className="flex h-14 items-center justify-between px-4 lg:h-[60px] lg:px-6">
                    <div className="flex items-center gap-4">
                        <OpenCashSessionWidget />
                    </div>

                    <div className="flex items-center justify-end gap-3">
                        <Link href={`/${locale}/alerts`} passHref>
                            <Button variant="ghost" size="icon" className={cn("relative rounded-full hover:bg-primary/10 transition-colors", pendingCount > 0 && "text-primary")}>
                                <div className={cn(pendingCount > 0 && 'animate-bell-ring')}>
                                    <Bell className="h-5 w-5" />
                                </div>
                                {pendingCount > 0 && (
                                    <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white bg-primary ring-2 ring-background">
                                        {pendingCount}
                                    </span>
                                )}
                                <span className="sr-only">{t('alerts')}</span>
                            </Button>
                        </Link>
                        
                        {activeCashSession && <ExchangeRate activeCashSession={activeCashSession} />}
                        
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="rounded-full hover:bg-primary/10">
                                    <Globe className="h-5 w-5" />
                                    <span className="sr-only">{t('toggleLanguage')}</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-xl">
                                <DropdownMenuItem onSelect={() => onSelectLocale('es')} disabled={locale === 'es'}>
                                    <span className="flex items-center justify-between w-full font-medium">
                                        <div className="flex items-center gap-2">
                                            <UyFlagIcon className="h-4 w-4" />
                                            {t('spanish')}
                                        </div>
                                        {locale === 'es' && <Check className="h-4 w-4 ml-2 text-primary" />}
                                    </span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => onSelectLocale('en')} disabled={locale === 'en'}>
                                    <span className="flex items-center justify-between w-full font-medium">
                                        <div className="flex items-center gap-2">
                                            <UsFlagIcon className="h-4 w-4" />
                                            {t('english')}
                                        </div>
                                        {locale === 'en' && <Check className="h-4 w-4 ml-2 text-primary" />}
                                    </span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="rounded-full hover:bg-primary/10">
                                    <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                                    <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                                    <span className="sr-only">{t('toggleTheme')}</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-xl">
                                <DropdownMenuItem onClick={() => setTheme('light')}>
                                    <span className="flex items-center justify-between w-full font-medium">
                                        <span>{t('light')}</span>
                                        {theme === 'light' && <Check className="h-4 w-4 ml-2 text-primary" />}
                                    </span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setTheme('dark')}>
                                    <span className="flex items-center justify-between w-full font-medium">
                                        <span>{t('dark')}</span>
                                        {theme === 'dark' && <Check className="h-4 w-4 ml-2 text-primary" />}
                                    </span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setTheme('system')}>
                                    <span className="flex items-center justify-between w-full font-medium">
                                        <span>{t('system')}</span>
                                        {theme === 'system' && <Check className="h-4 w-4 ml-2 text-primary" />}
                                    </span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-full ring-2 ring-primary/20 hover:ring-primary/40 transition-all overflow-hidden">
                                    <Image src="https://picsum.photos/seed/user/36/36" width={36} height={36} alt="Avatar" className="object-cover" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56 rounded-xl p-2">
                                <DropdownMenuLabel className="px-2 py-1.5 text-sm font-bold text-primary truncate">
                                    {user?.name || t('myAccount')}
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setIsChangePasswordOpen(true)} className="rounded-lg font-medium">
                                    <KeyRound className="mr-2 h-4 w-4" />
                                    <span>{t('changePassword')}</span>
                                </DropdownMenuItem>
                                <Link href={`/${locale}/preferences`} passHref>
                                    <DropdownMenuItem className="rounded-lg font-medium">
                                        <Bell className="mr-2 h-4 w-4" />
                                        <span>{t('communicationPreferences')}</span>
                                    </DropdownMenuItem>
                                </Link>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={handleLogoutClick} className="rounded-lg font-medium text-destructive focus:text-destructive">
                                    <LogOut className="mr-2 h-4 w-4" />
                                    <span>{t('logout')}</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </header>
            <AlertDialog open={isLogoutAlertOpen} onOpenChange={setIsLogoutAlertOpen}>
                <AlertDialogContent className="max-w-xl">
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