
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

type PasswordFormValues = z.infer<typeof passwordFormSchema>;

export function Header() {
    const pathname = usePathname();
    const { setTheme } = useTheme();
    const t = useTranslations('Header');
    const locale = useLocale();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { logout, user, activeCashSession } = useAuth();
    const { toast } = useToast();

    const [isLogoutAlertOpen, setIsLogoutAlertOpen] = React.useState(false);
    const [isChangePasswordOpen, setIsChangePasswordOpen] = React.useState(false);
    const [passwordChangeError, setPasswordChangeError] = React.useState<string | null>(null);

    const [pendingAlertsCount, setPendingAlertsCount] = React.useState(0);
    const [highestPriority, setHighestPriority] = React.useState<'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'>('LOW');

    const alertBadgeColor = {
        CRITICAL: 'bg-red-500',
        HIGH: 'bg-orange-500',
        MEDIUM: 'bg-blue-500',
        LOW: 'bg-gray-500'
    }[highestPriority];

    const fetchPendingAlertsCount = async () => {
        try {
            const response = await api.get(API_ROUTES.SYSTEM.ALERT_INSTANCES, { status: 'PENDING' });
            if (response.length === 1 && Object.keys(response[0]).length === 0) {
                setPendingAlertsCount(0);
                setHighestPriority('LOW');
                return;
            }
            const alerts: any[] = response;
            setPendingAlertsCount(alerts.length);
            if (alerts.length > 0) {
                const priorities = alerts.map(a => a.priority);
                if (priorities.includes('CRITICAL')) setHighestPriority('CRITICAL');
                else if (priorities.includes('HIGH')) setHighestPriority('HIGH');
                else if (priorities.includes('MEDIUM')) setHighestPriority('MEDIUM');
                else setHighestPriority('LOW');
            } else {
                setHighestPriority('LOW');
            }
        } catch (error) {
            console.error('Failed to fetch pending alerts count:', error);
            setPendingAlertsCount(0);
            setHighestPriority('LOW');
        }
    };


    const form = useForm<PasswordFormValues>({
        resolver: zodResolver(passwordFormSchema(t)),
    });

    React.useEffect(() => {
        fetchPendingAlertsCount();
        // Refresh every 30 seconds
        const interval = setInterval(fetchPendingAlertsCount, 30000);
        return () => clearInterval(interval);
    }, []);

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
            console.error("Failed to check active session, logging out anyway:", error);
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
            <header className="sticky top-0 z-20 w-full border-b bg-background/95 backdrop-blur-sm">
                <div className="flex h-14 items-center justify-between px-4 lg:h-[60px] lg:px-6">
                    <OpenCashSessionWidget />

                    <div className="flex items-center justify-end gap-2">
<Link href={`/${locale}/alerts`} passHref>
                            <Button variant="outline" size="icon" className="relative">
                                <div className={`h-[1.2rem] w-[1.2rem] flex items-center justify-center ${pendingAlertsCount > 0 ? 'animate-bell-ring' : ''}`}>
                                    <Bell className="h-[1.2rem] w-[1.2rem]" />
                                </div>
                                {pendingAlertsCount > 0 && (
                                    <span className={`absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-xs text-white bg-red-500`}>
                                        {pendingAlertsCount}
                                    </span>
                                )}
                                <span className="sr-only">Alerts</span>
                            </Button>
                        </Link>
                        {activeCashSession && <ExchangeRate />}
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
