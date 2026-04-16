'use client';

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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { navItems } from '@/config/nav';
import { GLOBAL_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import { useAlertNotifications } from '@/context/alert-notifications-context';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { filterNavByPermissions } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import {
    AlertTriangle,
    Bell,
    Check,
    ChevronDown,
    KeyRound,
    LogOut,
    Menu,
    Moon,
    Sun,
    X,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';
import * as z from 'zod';

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
    const { hasPermission, permissions, roles } = usePermissions();
    const { toast } = useToast();
    const { pendingCount } = useAlertNotifications();

    const filteredNavItems = React.useMemo(() => {
        return filterNavByPermissions(navItems, permissions, roles);
    }, [permissions, roles]);

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
        <aside className="fixed inset-y-0 left-0 z-[20] hidden sm:flex h-screen w-20 flex-col bg-[var(--nav-bg)] shadow-[2px_0_12px_rgba(0,0,0,0.15)] transition-all">
            <div className="flex h-14 items-center justify-center mb-2 mt-2 shrink-0">
                <Link href={`/${locale}`} className="transition-transform hover:scale-110">
                    <Image src="https://www.invokeia.com/assets/InvokeIA_C@4x-4T0dztu0.webp" width={44} height={44} alt="InvokeIA Logo" priority />
                </Link>
            </div>
            <TooltipProvider>
                <div className="flex-1 min-0 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                    <nav className="flex flex-col items-center gap-1 px-2">
                        {filteredNavItems.map(item => {
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
                                        <div className="relative w-full">
                                            <Link
                                                href={linkHref}
                                                className={cn(
                                                    "flex h-12 w-full flex-col items-center justify-center gap-0.5 rounded-xl transition-all duration-200 relative group",
                                                    (isActive || isHovered)
                                                        ? 'bg-white/15 text-white shadow-sm'
                                                        : 'text-white/60 hover:bg-white/10 hover:text-white/90',
                                                    isExpanded && "rounded-r-none z-[31]"
                                                )}
                                                onMouseEnter={() => onHover(item)}
                                            >
                                                <div className="flex flex-col items-center justify-center gap-0.5 w-full">
                                                    <div className="relative">
                                                        <item.icon className={cn("h-5 w-5 transition-transform group-hover:scale-110", (isActive || isHovered) ? "text-white" : "")} />
                                                        {item.title === 'AlertsCenter' && pendingCount > 0 && (
                                                            <span className="absolute -top-2 -right-2 h-4 w-4 flex items-center justify-center rounded-full text-[9px] font-bold text-white bg-red-500 border border-white/20 animate-pulse">
                                                                {pendingCount > 99 ? '99+' : pendingCount}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="block w-full text-center text-[8px] font-medium tracking-tight leading-tight line-clamp-1 px-1">{t(item.title as any)}</span>
                                                </div>
                                            </Link>
                                            {(isActive) && (
                                                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-r-full bg-white/80" />
                                            )}
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="right" className="bg-[var(--nav-bg)] text-white border-none font-semibold text-xs">
                                        {t(item.title as any)}
                                    </TooltipContent>
                                </Tooltip>
                            )
                        })}
                    </nav>
                </div>

                <div className="mt-auto flex flex-col items-center gap-2 pb-4 shrink-0 border-t border-white/10 pt-3">
                    {hasPermission(GLOBAL_PERMISSIONS.GLOBAL_CHANGE_THEME) && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-white/70 hover:bg-white/10 hover:text-white transition-all">
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
                    )}

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
                                    {hasPermission(GLOBAL_PERMISSIONS.PROFILE_CHANGE_PASSWORD) && (
                                        <DropdownMenuItem onClick={() => setIsChangePasswordOpen(true)} className="rounded-lg font-medium">
                                            <KeyRound className="mr-2 h-4 w-4" />
                                            <span>{tHeader('changePassword')}</span>
                                        </DropdownMenuItem>
                                    )}
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
            className="fixed left-20 z-[30] hidden md:flex flex-col bg-white dark:bg-card shadow-xl border border-border rounded-r-2xl overflow-hidden animate-in fade-in slide-in-from-left-2 duration-200 h-auto max-h-[85vh] my-auto top-0 bottom-0"
            onMouseLeave={onLeave}
            style={{ width: '200px' }}
        >
            <div className="flex h-11 items-center px-5 border-b border-border">
                <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t(item.title as any)}</h2>
            </div>
            <div className="flex-1 overflow-y-auto py-1.5">
                <nav className="grid gap-0.5 px-2">
                    {item.items.map((subItem: any, index: number) => {
                        if (subItem.isSeparator) {
                            return <hr key={index} className="my-1.5 border-border mx-2" />;
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
                                    "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all active:scale-95 relative",
                                    "hover:bg-muted",
                                    isSubActive
                                        ? "bg-primary/8 text-primary font-semibold"
                                        : "text-foreground font-medium"
                                )}
                            >
                                {isSubActive && (
                                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-primary" />
                                )}
                                <subItem.icon className={cn(
                                    "h-4 w-4 shrink-0",
                                    isSubActive ? "text-primary" : "text-muted-foreground"
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

function MobileNav() {
    const [isOpen, setIsOpen] = React.useState(false);
    const [expandedItem, setExpandedItem] = React.useState<string | null>(null);
    const pathname = usePathname();
    const locale = useLocale();
    const t = useTranslations('Navigation');
    const { permissions, roles } = usePermissions();
    const { pendingCount } = useAlertNotifications();

    const filteredNavItems = React.useMemo(() => {
        return filterNavByPermissions(navItems, permissions, roles);
    }, [permissions, roles]);

    const getEffectivePathname = (p: string, l: string) => {
        const localePrefix = `/${l}`;
        if (p.startsWith(localePrefix)) return p.substring(localePrefix.length) || '/';
        return p;
    };
    const effectivePathname = getEffectivePathname(pathname, locale);

    // Close on navigation
    React.useEffect(() => { setIsOpen(false); }, [pathname]);

    // Expand the active parent on open
    React.useEffect(() => {
        if (isOpen) {
            const active = filteredNavItems.find(item =>
                item.items?.some(sub => sub.href !== '' && (effectivePathname === sub.href || effectivePathname.startsWith(sub.href + '/')))
            );
            if (active) setExpandedItem(active.title);
        }
    }, [isOpen]);

    return (
        <>
            {/* Mobile top bar: hamburger (left) | logo (center) | widget space (right) */}
            <div className="sm:hidden fixed top-0 left-0 right-0 h-12 z-[45] bg-[var(--nav-bg)] flex items-center">
                {/* Hamburger — always accessible, left */}
                <button
                    type="button"
                    onClick={() => setIsOpen(true)}
                    className="relative flex items-center justify-center h-12 w-12 text-white flex-none bg-white/15 hover:bg-white/25 transition-colors border-r border-white/20"
                    aria-label="Abrir menú"
                >
                    <Menu className="h-5 w-5" />
                    {pendingCount > 0 && (
                        <span className="absolute top-2 right-2 h-4 w-4 flex items-center justify-center rounded-full text-[9px] font-bold text-white bg-red-500 border border-[var(--nav-bg)]">
                            {pendingCount > 99 ? '99+' : pendingCount}
                        </span>
                    )}
                </button>
                {/* Logo — centered */}
                <Link href={`/${locale}`} className="flex-1 flex items-center justify-center gap-2">
                    <Image
                        src="https://www.invokeia.com/assets/InvokeIA_C@4x-4T0dztu0.webp"
                        width={28}
                        height={28}
                        alt=""
                        className="h-7 w-7 rounded-lg flex-none"
                        priority
                    />
                    <span className="text-white font-bold text-base tracking-tight select-none">Invoke IA</span>
                </Link>
                {/* Right spacer — widget (header.tsx) overlays this slot */}
                <div className="h-12 w-12 flex-none" />
            </div>

            {/* Full-screen overlay */}
            {isOpen && (
                <div className="sm:hidden fixed inset-0 z-[60] flex">
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/50" onClick={() => setIsOpen(false)} />
                    {/* Panel */}
                    <div className="relative w-full max-w-xs bg-[var(--nav-bg)] h-full flex flex-col animate-in slide-in-from-left-4 duration-200 overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
                            <Link href={`/${locale}`} onClick={() => setIsOpen(false)}>
                                <Image src="https://www.invokeia.com/assets/InvokeIA_C@4x-4T0dztu0.webp" width={36} height={36} alt="InvokeIA Logo" />
                            </Link>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="flex items-center justify-center h-8 w-8 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        {/* Nav items */}
                        <div className="flex-1 overflow-y-auto py-2">
                            {filteredNavItems.map(item => {
                                const isActive = item.items
                                    ? item.items.some(sub => sub.href !== '' && (effectivePathname === sub.href || effectivePathname.startsWith(sub.href + '/')))
                                    : (item.href === '/' ? effectivePathname === '/' : effectivePathname === item.href || effectivePathname.startsWith(item.href + '/'));

                                const hasChildren = !!(item.items && item.items.length > 0);
                                const isExpanded = expandedItem === item.title;

                                let linkHref = `/${locale}${item.href === '/' ? '' : item.href}`;
                                if (item.href.includes('/clinic-history')) {
                                    const parts = effectivePathname.split('/');
                                    const userIdFromUrl = (effectivePathname.startsWith('/clinic-history') && parts[2]) ? parts[2] : '1';
                                    linkHref = `/${locale}/clinic-history/${userIdFromUrl}`;
                                }

                                return (
                                    <div key={String(item.title)}>
                                        {hasChildren ? (
                                            <button
                                                type="button"
                                                onClick={() => setExpandedItem(isExpanded ? null : item.title)}
                                                className={cn(
                                                    "w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors",
                                                    isActive ? 'text-white bg-white/15' : 'text-white/70 hover:text-white hover:bg-white/10'
                                                )}
                                            >
                                                <item.icon className="h-5 w-5 shrink-0" />
                                                <span className="flex-1 text-left">{t(item.title as any)}</span>
                                                {item.title === 'AlertsCenter' && pendingCount > 0 && (
                                                    <span className="flex items-center justify-center h-5 w-5 rounded-full text-[9px] font-bold text-white bg-red-500">
                                                        {pendingCount > 99 ? '99+' : pendingCount}
                                                    </span>
                                                )}
                                                <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", isExpanded && "rotate-180")} />
                                            </button>
                                        ) : (
                                            <Link
                                                href={linkHref}
                                                className={cn(
                                                    "flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors",
                                                    isActive ? 'text-white bg-white/15' : 'text-white/70 hover:text-white hover:bg-white/10'
                                                )}
                                            >
                                                <item.icon className="h-5 w-5 shrink-0" />
                                                <span>{t(item.title as any)}</span>
                                            </Link>
                                        )}
                                        {/* Sub-items */}
                                        {hasChildren && isExpanded && (
                                            <div className="bg-black/20 py-1">
                                                {item.items!.map((sub: any, idx: number) => {
                                                    if (sub.isSeparator) return <div key={idx} className="my-1 mx-4 border-t border-white/10" />;

                                                    const isSubActive = sub.href === '/'
                                                        ? effectivePathname === '/'
                                                        : (effectivePathname === sub.href || effectivePathname.startsWith(sub.href + '/'));

                                                    let subHref = `/${locale}${sub.href === '/' ? '' : sub.href}`;
                                                    if (sub.href.includes('/clinic-history')) {
                                                        const parts = effectivePathname.split('/');
                                                        const userId = (effectivePathname.startsWith('/clinic-history') && parts[2]) ? parts[2] : '1';
                                                        subHref = `/${locale}/clinic-history/${userId}`;
                                                    }

                                                    return (
                                                        <Link
                                                            key={idx}
                                                            href={subHref}
                                                            className={cn(
                                                                "flex items-center gap-3 px-8 py-2.5 text-sm transition-colors relative",
                                                                isSubActive ? 'text-white font-semibold' : 'text-white/60 hover:text-white hover:bg-white/5'
                                                            )}
                                                        >
                                                            {isSubActive && <span className="absolute left-6 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r-full bg-white" />}
                                                            <sub.icon className={cn("h-4 w-4 shrink-0", isSubActive ? "text-white" : "text-white/50")} />
                                                            <span>{t(sub.title as any)}</span>
                                                        </Link>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

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
        <>
            <MobileNav />
            <div className="hidden sm:block" onMouseLeave={handleLeave}>
                <MainSidebar onHover={handleHover} activeItem={hoveredItem} />
                {hoveredItem && (
                    <div onMouseEnter={handleSecondaryEnter}>
                        <SecondarySidebar item={hoveredItem} onLeave={handleLeave} />
                    </div>
                )}
            </div>
        </>
    );
}
