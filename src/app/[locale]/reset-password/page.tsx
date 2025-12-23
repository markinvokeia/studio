'use client';

import { UsFlagIcon } from '@/components/icons/us-flag-icon';
import { UyFlagIcon } from '@/components/icons/uy-flag-icon';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Check, Globe, Loader2, Moon, Sun } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';
import * as z from 'zod';

const passwordResetSchema = (t: (key: string) => string) => z.object({
    new_password: z.string()
        .min(8, t('validation.newPasswordMin'))
        .regex(/[A-Z]/, t('validation.newPasswordUpper'))
        .regex(/[0-9]/, t('validation.newPasswordNumber')),
    confirm_password: z.string(),
}).refine(data => data.new_password === data.confirm_password, {
    message: t('validation.passwordsMismatch'),
    path: ['confirm_password'],
});

type PasswordResetFormValues = z.infer<ReturnType<typeof passwordResetSchema>>;

export default function ResetPasswordPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const locale = useLocale();
    const pathname = usePathname();
    const t = useTranslations('ResetPasswordPage');
    const tHeader = useTranslations('Header');
    const { setTheme } = useTheme();

    const [token, setToken] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const form = useForm<PasswordResetFormValues>({
        resolver: zodResolver(passwordResetSchema(t)),
        defaultValues: {
            new_password: '',
            confirm_password: '',
        },
    });

    useEffect(() => {
        const tokenFromUrl = searchParams.get('token');
        if (tokenFromUrl) {
            setToken(tokenFromUrl);
        } else {
            setError(t('errors.tokenMissing'));
        }
    }, [searchParams, t]);

    const onSelectLocale = (newLocale: string) => {
        localStorage.setItem('locale', newLocale);
        const newPathname = pathname.replace(`/${locale}`, `/${newLocale}`);
        const newUrl = `${newPathname}?${searchParams.toString()}`;
        router.replace(newUrl);
    };

    const onSubmit: SubmitHandler<PasswordResetFormValues> = async (data) => {
        if (!token) {
            setError(t('errors.tokenMissing'));
            return;
        }
        setError('');
        setIsLoading(true);

        try {
            const responseData = await api.post(API_ROUTES.SYSTEM.RESET_PASSWORD_CHANGE, { new_password: data.new_password }, undefined, { token });


            toast({
                title: t('success.title'),
                description: responseData.message || t('success.description'),
            });

            router.push(`/${locale}/login`);

        } catch (err: any) {
            let errorMessage = t('errors.generic');
            if (err.message.includes('400')) {
                errorMessage = t('errors.invalidPassword');
            } else if (err.message.includes('401')) {
                errorMessage = t('errors.invalidToken');
            } else if (err.message.includes('500')) {
                errorMessage = t('errors.serverError');
            } else {
                errorMessage = err.message;
            }
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="relative h-screen w-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
            <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon">
                            <Globe className="h-[1.2rem] w-[1.2rem]" />
                            <span className="sr-only">{tHeader('toggleLanguage')}</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => onSelectLocale('es')} disabled={locale === 'es'}>
                            <span className="flex items-center justify-between w-full">
                                <div className="flex items-center gap-2">
                                    <UyFlagIcon className="h-4 w-4" />
                                    {tHeader('spanish')}
                                </div>
                                {locale === 'es' && <Check className="h-4 w-4 ml-2" />}
                            </span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => onSelectLocale('en')} disabled={locale === 'en'}>
                            <span className="flex items-center justify-between w-full">
                                <div className="flex items-center gap-2">
                                    <UsFlagIcon className="h-4 w-4" />
                                    {tHeader('english')}
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
            </div>
            <Card className="w-full max-w-sm">
                <CardHeader className="text-center">
                    <Image
                        src="https://www.invokeia.com/assets/InvokeIA_C@4x-4T0dztu0.webp"
                        width={80}
                        height={80}
                        alt="InvokeIA Logo"
                        className="mx-auto mb-4"
                    />
                    <CardTitle>{t('title')}</CardTitle>
                    <CardDescription>{t('description')}</CardDescription>
                </CardHeader>
                <CardContent>
                    {error && (
                        <Alert variant="destructive" className="mb-4">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>{t('errors.title')}</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <FormField
                                control={form.control}
                                name="new_password"
                                render={({ field }) => (
                                    <FormItem>
                                        <Label htmlFor="new_password">{t('newPassword')}</Label>
                                        <FormControl>
                                            <Input id="new_password" type="password" {...field} />
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
                                        <Label htmlFor="confirm_password">{t('confirmPassword')}</Label>
                                        <FormControl>
                                            <Input id="confirm_password" type="password" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <Button type="submit" className="w-full" disabled={isLoading || !token}>
                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : t('submitButton')}
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    );
}
