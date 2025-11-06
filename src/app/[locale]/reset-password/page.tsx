
'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { useLocale } from 'next-intl';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';

const passwordResetSchema = z.object({
    new_password: z.string()
        .min(8, 'Password must be at least 8 characters long.')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter.')
        .regex(/[0-9]/, 'Password must contain at least one number.'),
    confirm_password: z.string(),
}).refine(data => data.new_password === data.confirm_password, {
    message: "Passwords don't match.",
    path: ['confirm_password'],
});

type PasswordResetFormValues = z.infer<typeof passwordResetSchema>;

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const locale = useLocale();

  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<PasswordResetFormValues>({
    resolver: zodResolver(passwordResetSchema),
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
      setError('No recovery token provided. Please request a new password recovery link.');
    }
  }, [searchParams]);

  const onSubmit: SubmitHandler<PasswordResetFormValues> = async (data) => {
    if (!token) {
        setError('Recovery token is missing.');
        return;
    }
    setError('');
    setIsLoading(true);

    try {
        const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/api/auth/recover/change?token=${token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ new_password: data.new_password }),
        });

        const responseData = await response.json().catch(() => ({}));

        if (!response.ok) {
            let errorMessage = 'An unexpected error occurred.';
            if (response.status === 400) {
                errorMessage = responseData.message || 'The new password is not valid.';
            } else if (response.status === 401) {
                errorMessage = 'The recovery token is invalid or has expired. Please request a new one.';
            } else if (response.status === 500) {
                errorMessage = 'A server error occurred. Please try again later.';
            }
            throw new Error(errorMessage);
        }

        toast({
            title: 'Password Reset Successful',
            description: responseData.message || 'You can now log in with your new password.',
        });

        router.push(`/${locale}/login`);

    } catch (err: any) {
        setError(err.message);
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden">
        <video
            className="absolute top-0 left-0 w-full h-full object-cover"
            src="/videos/login_promo.mp4"
            autoPlay
            muted
            loop
            playsInline
        />
        <div className="absolute top-0 left-0 w-full h-full bg-black opacity-50" />
      <div className="relative h-screen w-screen flex items-center justify-center">
        <Card className="w-full max-w-sm">
            <CardHeader className="text-center">
                <Image
                src="https://www.invokeia.com/assets/InvokeIA_C@4x-4T0dztu0.webp"
                width={80}
                height={80}
                alt="InvokeIA Logo"
                className="mx-auto mb-4"
                />
            <CardTitle>Set New Password</CardTitle>
            <CardDescription>Enter your new password below.</CardDescription>
            </CardHeader>
            <CardContent>
            {error && (
                <Alert variant="destructive" className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
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
                        <Label htmlFor="new_password">New Password</Label>
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
                        <Label htmlFor="confirm_password">Confirm New Password</Label>
                        <FormControl>
                        <Input id="confirm_password" type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <Button type="submit" className="w-full" disabled={isLoading || !token}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Set New Password'}
                </Button>
                </form>
            </Form>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
