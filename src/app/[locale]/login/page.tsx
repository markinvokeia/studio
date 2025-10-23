'use client';

import * as React from 'react';
import { useState, useEffect, FormEvent } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Loader2, Globe, Check, Moon, Sun } from 'lucide-react';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UsFlagIcon } from '@/components/icons/us-flag-icon';
import { UyFlagIcon } from '@/components/icons/uy-flag-icon';

export default function LoginPage() {
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const locale = useLocale();
  const pathname = usePathname();
  const { setTheme } = useTheme();
  const t = useTranslations('Header');
  const tLogin = useTranslations('LoginPage');

  useEffect(() => {
    const savedLocale = localStorage.getItem('locale');
    if (savedLocale && savedLocale !== locale) {
      const newPathname = pathname.replace(`/${locale}`, `/${savedLocale}`);
      router.replace(newPathname);
    }
  }, [locale, pathname, router]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowForm(true);
    }, 5000); // Show form after 5 seconds

    return () => clearTimeout(timer);
  }, []);

  const onSelectLocale = (newLocale: string) => {
    localStorage.setItem('locale', newLocale);
    const newPathname = pathname.replace(`/${locale}`, `/${newLocale}`);
    router.replace(newPathname);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await login(email, password);
      router.push(`/${locale}`);
    } catch (err: any) {
      if (err.message === 'Invalid credentials') {
        setError(tLogin('errors.invalidCredentials'));
      } else {
        setError(err.message || tLogin('errors.unexpected'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <video
        ref={videoRef}
        className="absolute top-0 left-0 w-full h-full object-cover"
        src="/videos/login_promo.mp4"
        autoPlay
        muted
        loop
        playsInline
      />
       <div
        className={`absolute top-0 left-0 w-full h-full bg-black transition-opacity duration-1000 ${
          showForm ? 'opacity-50' : 'opacity-0'
        }`}
      />
       <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="bg-white/20 text-white backdrop-blur-sm">
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
                <Button variant="outline" size="icon" className="bg-white/20 text-white backdrop-blur-sm">
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
        </div>
      <div
        className={`absolute inset-0 flex items-center justify-center transition-opacity duration-1000 ${
          showForm ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <Image
              src="https://www.invokeia.com/assets/InvokeIA_C@4x-4T0dztu0.webp"
              width={80}
              height={80}
              alt="InvokeIA Logo"
              className="mx-auto mb-4"
            />
            <CardTitle>{tLogin('title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>{tLogin('errors.title')}</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">{tLogin('email')}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="info@invokeia.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{tLogin('password')}</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  tLogin('signIn')
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
