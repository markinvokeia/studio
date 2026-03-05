'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { navItems } from '@/config/nav';
import { cn } from '@/lib/utils';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/services/api';
import { API_ROUTES } from '@/constants/routes';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, SubmitHandler } from 'react-hook-form';
import * as z from 'zod';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAlertNotifications } from '@/context/alert-notifications-context';
import { useToast } from '@/hooks/use-toast';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog";
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Sun,
    Moon,
    LogOut,
    KeyRound,
    Bell,
    Check,
    AlertTriangle,
    Settings
} from 'lucide-react';

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

const MainSidebar = ({ onHover, activeItem }: { onHover: (item: any) => void; activeItem: any }) => {
    const pathname = usePathname();
    const router = useRouter();
    const t = useTranslations('Navigation');
    const tHeader = useTranslations('Header');
    const locale = useLocale();
    const { theme, setTheme } = useTheme();
    const { logout, user } = useAuth();
    const { toast } = useToast();
    const { pendingCount } = useAlertNotifications();

    const [isLogoutAlertOpen, setIsLogoutAlertOpen] = React.useState(false);
    const [isChangePasswordOpen, setIsChangePasswordOpen] = React.useState(false);
    const [passwordChangeError, setPasswordChangeError] = React.useState<string | null>(null);

    const form = useForm<PasswordFormValues>({
        resolver: zodResolver(passwordFormSchema(tHeader)),
    });

    const userInitial = React.useMemo(() => {
        const source = user?.name?.trim() || user?.email?.trim() || '';
        return source ? source.charAt(0).toUpperCase() : 'U';
    }, [user?.email, user?.name]);

    const getEffectivePathname = (p: string, l: string) => {
        const localePrefix = `/${l}`;
        if (p.startsWith(localePrefix)) {
            return p.substring(localePrefix.length) || '/';
        }
        return p;
    };

    const effectivePathname = getEffectivePathname(pathname, locale);

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
            handleLogout();
        }
    };

    const handleChangePasswordSubmit: SubmitHandler<PasswordFormValues> = async (data: PasswordFormValues) => {
        setPasswordChangeError(null);
        const token = localStorage.getItem('token');
        if (!token) return;

        try {
            const responseData = await api.post(API_ROUTES.SYSTEM.API_AUTH_PASSWORD_CHANGE, {
                old_password: data.old_password,
                new_password: data.new_password,
            }, undefined, { token });

            toast({ title: tHeader('success.title'), description: responseData.message || tHeader('success.description') });
            setIsChangePasswordOpen(false);
        } catch (error: any) {
            setPasswordChangeError(error.message || tHeader('errors.generic'));
        }
    };

    return (
        <aside className="fixed inset-y-0 left-0 z-[20] flex h-screen w-20 flex-col bg-[var(--nav-bg)] shadow-[4px_0_20px_rgba(0,0,0,0.1)] transition-all">
            <div className="flex h-14 items-center justify-center mb-4 mt-2 shrink-0">
                <Link href={`/${locale}`} className="transition-transform hover:scale-110">
                    <Image src="https://www.invokeia.com/assets/InvokeIA_C@4x-4T0dztu0.webp" width={48} height={48} alt="InvokeIA Logo" priority />
                </Link>
            </div>
            <TooltipProvider>
                <div className="flex-1 min-0 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                    <nav className="flex flex-col items-center gap-2">
                        {navItems.map(item => {
                            const isActive = item.items
                                ? item.items.some(subItem =>
                                    subItem.href !== '' && (effectivePathname === subItem.href || effectivePathname.startsWith(subItem.href + '/'))
                                )
                                : (item.href === '/' ? effectivePathname === '/' : effectivePathname === item.href || effectivePathname.startsWith(item.href + '/'));

                            const isHovered = activeItem?.title === item.title;
                            const isExpanded = isHovered && item.items;

                            let linkHref = `/${locale}${item.href === '/' ? '' : item.href}`;
                            if (item.href.includes('/clinic-history')) {
                                const parts = effectivePathname.split('/');
                                const userIdFromUrl = (effectivePathname.startsWith('/clinic-history') && parts[2])
                                    ? parts[2]
                                    : '1';
                                linkHref = `/${locale}/clinic-history/${userIdFromUrl}`;
                            }

                            return (
                                <Tooltip key={String(item.title)}>
                                    <TooltipTrigger asChild>
                                        <div className="relative mx-auto">
                                            <Link
                                                href={linkHref}
                                                className={cn(
                                                    "flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-xl transition-all duration-300 relative group",
                                                    (isActive || isHovered)
                                                        ? 'bg-accent text-accent-foreground shadow-[0_0_15px_rgba(0,0,0,0.1)]'
                                                        : 'text-[var(--nav-foreground)] hover:bg-accent/50 hover:text-[var(--nav-foreground)] opacity-80 hover:opacity-100',
                                                    isExpanded && "w-20 rounded-r-none z-[31]"
                                                )}
                                                onMouseEnter={() => onHover(item)}
                                            >
                                                <div className="flex flex-col items-center justify-center gap-1 w-16 static">
                                                    <div className="relative">
                                                        <item.icon className={cn("h-6 w-6 transition-transform group-hover:scale-110", (isActive || isHovered) ? "text-accent-foreground" : "")} />
                                                        {item.title === 'AlertsCenter' && pendingCount > 0 && (
                                                            <span className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center rounded-full text-[10px] font-bold text-white bg-red-600 border-2 border-background animate-pulse">
                                                                {pendingCount > 99 ? '99+' : pendingCount}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="block w-full text-center text-[9px] font-semibold uppercase tracking-tight leading-tight line-clamp-1">{t(item.title as any)}</span>
                                                </div>
                                            </Link>
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="right" className="bg-primary text-primary-foreground border-none font-bold">
                                        {t(item.title as any)}
                                    </TooltipContent>
                                </Tooltip>
                            )
                        })}
                    </nav>
                </div>

                <div className="mt-auto flex flex-col items-center gap-2 pb-4 shrink-0 border-t border-white/10 pt-4">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-12 w-12 rounded-xl text-[var(--nav-foreground)] hover:bg-accent/50 opacity-80 hover:opacity-100 transition-all">
                                        <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                                        <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                                        <span className="sr-only">{tHeader('toggleTheme')}</span>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent side="right" align="end" className="rounded-xl w-40">
                                    <DropdownMenuItem onClick={() => setTheme('light')} className="flex items-center justify-between">
                                        <span>Invoke</span>
                                        {theme === 'light' && <Check className="h-4 w-4 text-primary" />}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setTheme('claro')} className="flex items-center justify-between">
                                        <span>Claro</span>
                                        {theme === 'claro' && <Check className="h-4 w-4 text-primary" />}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setTheme('dark')} className="flex items-center justify-between">
                                        <span>Oscuro</span>
                                        {theme === 'dark' && <Check className="h-4 w-4 text-primary" />}
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </TooltipTrigger>
                        <TooltipContent side="right">{tHeader('toggleTheme')}</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-full ring-2 ring-primary/20 hover:ring-primary/40 transition-all shrink-0 bg-accent text-accent-foreground font-bold text-sm">
                                        <span aria-hidden="true">{userInitial}</span>
                                        <span className="sr-only">{user?.name || tHeader('myAccount')}</span>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent side="right" align="end" className="w-56 rounded-xl p-2">
                                    <DropdownMenuLabel className="px-2 py-1.5 text-sm font-bold text-primary truncate">
                                        {user?.name || tHeader('myAccount')}
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => setIsChangePasswordOpen(true)} className="rounded-lg font-medium">
                                        <KeyRound className="mr-2 h-4 w-4" />
                                        <span>{tHeader('changePassword')}</span>
                                    </DropdownMenuItem>
                                    <Link href={`/${locale}/preferences`} passHref>
                                        <DropdownMenuItem className="rounded-lg font-medium">
                                            <Bell className="mr-2 h-4 w-4" />
                                            <span>{tHeader('communicationPreferences')}</span>
                                        </DropdownMenuItem>
                                    </Link>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={handleLogoutClick} className="rounded-lg font-medium text-destructive focus:text-destructive">
                                        <LogOut className="mr-2 h-4 w-4" />
                                        <span>{tHeader('logout')}</span>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </TooltipTrigger>
                        <TooltipContent side="right">{user?.name || tHeader('myAccount')}</TooltipContent>
                    </Tooltip>
                </div>
            </TooltipProvider>

            <AlertDialog open={isLogoutAlertOpen} onOpenChange={setIsLogoutAlertOpen}>
                <AlertDialogContent className="max-w-xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-foreground">
                            <AlertTriangle className="h-6 w-6 text-yellow-500" />
                            {tHeader('logoutConfirmation.title')}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {tHeader('logoutConfirmation.description')}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={handleLogout} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            {tHeader('logoutConfirmation.logoutAnyway')}
                        </AlertDialogAction>
                        <Link href={`/${locale}/cashier`} passHref>
                            <Button variant="outline">{tHeader('logoutConfirmation.goToCashier')}</Button>
                        </Link>
                        <AlertDialogCancel>{tHeader('logoutConfirmation.cancel')}</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Dialog open={isChangePasswordOpen} onOpenChange={setIsChangePasswordOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{tHeader('changePasswordDialog.title')}</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleChangePasswordSubmit)} className="space-y-4 py-4 px-6">
                            {passwordChangeError && (
                                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive text-destructive text-sm flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4" />
                                    {passwordChangeError}
                                </div>
                            )}
                            <FormField control={form.control} name="old_password" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{tHeader('changePasswordDialog.oldPassword')}</FormLabel>
                                    <FormControl><Input type="password" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="new_password" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{tHeader('changePasswordDialog.newPassword')}</FormLabel>
                                    <FormControl><Input type="password" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="confirm_password" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{tHeader('changePasswordDialog.confirmPassword')}</FormLabel>
                                    <FormControl><Input type="password" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <DialogFooter>
                                <Button type="submit">{tHeader('changePasswordDialog.save')}</Button>
                                <Button variant="outline" type="button" onClick={() => setIsChangePasswordOpen(false)}>{tHeader('changePasswordDialog.cancel')}</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </aside>
    );
}

const SecondarySidebar = ({ item, onLeave }: { item: any; onLeave: () => void }) => {
    const pathname = usePathname();
    const t = useTranslations('Navigation');
    const locale = useLocale();
    if (!item || !item.items) return null;

    const getEffectivePathname = (p: string, l: string) => {
        const localePrefix = `/${l}`;
        if (p.startsWith(localePrefix)) {
            return p.substring(localePrefix.length) || '/';
        }
        return p;
    };

    const effectivePathname = getEffectivePathname(pathname, locale);

    return (
        <div
            className="fixed left-20 z-[30] hidden md:flex flex-col bg-accent text-accent-foreground shadow-[8px_8px_20px_rgba(0,0,0,0.1)] rounded-r-2xl overflow-hidden animate-in fade-in slide-in-from-left-2 duration-200 h-auto max-h-[85vh] my-auto top-0 bottom-0 border-l border-white/10 [.claro_&]:border-gray-200"
            onMouseLeave={onLeave}
            style={{ width: '200px' }}
        >
            <div className="flex h-12 items-center px-6 border-b border-white/10 [.claro_&]:border-gray-200">
                <h2 className="text-xs font-bold uppercase tracking-widest [.claro_&]:text-gray-500">{t(item.title as any)}</h2>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
                <nav className="grid gap-1 pl-2 pr-0">
                    {item.items.map((subItem: any, index: number) => {
                        if (subItem.isSeparator) {
                            return <hr key={index} className="my-2 border-white/10 [.claro_&]:border-gray-200 mx-4" />;
                        }

                        const isSubActive = subItem.href === '/'
                            ? effectivePathname === '/'
                            : (effectivePathname === subItem.href || effectivePathname.startsWith(subItem.href + '/'));

                        let subLinkHref = `/${locale}${subItem.href === '/' ? '' : subItem.href}`;
                        if (subItem.href.includes('/clinic-history')) {
                            const parts = effectivePathname.split('/');
                            // Si ya estamos en una página de historia clínica, intentamos mantener el ID del paciente actual
                            const userIdFromUrl = (effectivePathname.startsWith('/clinic-history') && parts[2])
                                ? parts[2]
                                : '1';
                            subLinkHref = `/${locale}/clinic-history/${userIdFromUrl}`;
                        }

                        return (
                            <Link
                                key={index}
                                href={subLinkHref}
                                className={cn(
                                    "flex items-center gap-3 px-4 py-2.5 rounded-l-lg rounded-r-none text-sm font-semibold transition-all active:scale-95",
                                    "hover:bg-white/10 [.claro_&]:hover:bg-black/5",
                                    isSubActive
                                        ? "bg-white/20 text-white [.claro_&]:bg-black/10 [.claro_&]:text-gray-900"
                                        : "text-white/70 [.claro_&]:text-gray-600"
                                )}
                            >
                                <subItem.icon className={cn(
                                    "h-4 w-4 transition-opacity",
                                    isSubActive ? "opacity-100" : "opacity-70",
                                    "[.claro_&]:text-gray-700"
                                )} />
                                <span>{t(subItem.title as any)}</span>
                            </Link>
                        )
                    })}
                </nav>
            </div>
        </div>
    );
};

export function Sidebar() {
    const [hoveredItem, setHoveredItem] = React.useState<any>(null);
    let leaveTimeout = React.useRef<NodeJS.Timeout>();

    const handleHover = (item: any) => {
        if (leaveTimeout.current) {
            clearTimeout(leaveTimeout.current);
        }
        setHoveredItem(item);
    };

    const handleLeave = () => {
        leaveTimeout.current = setTimeout(() => {
            setHoveredItem(null);
        }, 300);
    };

    const handleSecondaryEnter = () => {
        if (leaveTimeout.current) {
            clearTimeout(leaveTimeout.current);
        }
    }

    return (
        <div onMouseLeave={handleLeave}>
            <MainSidebar onHover={handleHover} activeItem={hoveredItem} />
            {hoveredItem && (
                <div onMouseEnter={handleSecondaryEnter}>
                    <SecondarySidebar item={hoveredItem} onLeave={handleLeave} />
                </div>
            )}
        </div>
    );
}
