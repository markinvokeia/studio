'use client';

import { ArrowLeft, Check, Globe, Loader2, Moon, Sun } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { FormEvent, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { UsFlagIcon } from '@/components/icons/us-flag-icon';
import { UyFlagIcon } from '@/components/icons/uy-flag-icon';

import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';

import { API_ROUTES } from '@/constants/routes';

type View = 'login' | 'forgotPassword';

interface RequestError extends Error {
  status?: number;
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [view, setView] = useState<View>('login');
  const { login } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const locale = useLocale();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const t = useTranslations('Header');
  const tLogin = useTranslations('LoginPage');

  // El video es decoración de escritorio: en pantallas angostas no se monta para no gastar
  // ~2 MB de datos móviles, y si el navegador bloquea la reproducción se descarta y queda el
  // degradado. El formulario nunca depende de él.
  const isNarrow = useViewportNarrow();
  const [isMounted, setIsMounted] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const showVideo = isMounted && !isNarrow && !videoFailed;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    // React aplica `muted` como propiedad después de insertar el elemento, no como atributo del
    // HTML inicial: Safari puede tratar el video como "con sonido" y bloquear el autoplay.
    video.muted = true;
    video.play().catch(() => setVideoFailed(true));
  }, [showVideo]);

  useEffect(() => {
    const savedLocale = localStorage.getItem('locale');
    if (savedLocale && savedLocale !== locale) {
      const newPathname = pathname.replace(`/${locale}`, `/${savedLocale}`);
      router.replace(newPathname);
    }
  }, [locale, pathname, router]);

  const onSelectLocale = (newLocale: string) => {
    localStorage.setItem('locale', newLocale);
    const newPathname = pathname.replace(`/${locale}`, `/${newLocale}`);
    router.replace(newPathname);
  };

  const handleLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await login(email, password);
      router.push(`/${locale}`);
    } catch (err: unknown) {
      const error = err as Partial<RequestError>;
      const message = err instanceof Error ? err.message : tLogin('errors.unexpected');
      if (error.status === 401 || message.includes('Invalid credentials')) {
        toast({
          variant: "destructive",
          title: tLogin('errors.title'),
          description: tLogin('errors.invalidCredentials'),
        });
      } else {
        toast({
          variant: "destructive",
          title: tLogin('errors.title'),
          description: message,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecoverySubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await api.post(API_ROUTES.SYSTEM.RECOVER_EMAIL, { email });

      toast({
        title: tLogin('recoverSuccessTitle'),
        description: tLogin('recoverSuccessDescription'),
      });
      setView('login');
    } catch (err: unknown) {
      const error = err as Partial<RequestError>;
      let errorMessage = err instanceof Error ? err.message : tLogin('errors.unexpected');
      if (error.status === 401 || errorMessage.includes('401')) {
        errorMessage = tLogin('errors.emailNotFound');
      }

      toast({
        variant: "destructive",
        title: tLogin('errors.title'),
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Sobre el video los controles van en blanco translúcido; sobre el degradado del tema ese
  // estilo sería ilegible (en "Claro" el fondo es casi blanco), así que se usa el outline base.
  const controlButtonClass = showVideo
    ? 'bg-white/20 text-white backdrop-blur-sm hover:bg-white/30 hover:text-white'
    : undefined;

  // `html, body` son `overflow: hidden` en globals.css, así que esta pantalla necesita ser su
  // propio contenedor de scroll: sin eso la card queda cortada al abrirse el teclado en mobile.
  return (
    <div className="relative h-[100dvh] w-full overflow-y-auto">
      <div className="fixed inset-0 bg-gradient-to-br from-primary via-primary/40 to-background" />
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--accent)/0.35),transparent_60%)]" />

      {showVideo && (
        <>
          <video
            ref={videoRef}
            className="fixed inset-0 h-full w-full object-cover"
            src="/videos/login_promo.mp4"
            autoPlay
            muted
            playsInline
            onError={() => setVideoFailed(true)}
          />
          <div className="fixed inset-0 bg-black/50" />
        </>
      )}

      {/* `absolute` y no `fixed`: si la card no entra en pantalla, estos controles se van con el
          scroll en lugar de quedar montados encima del formulario. */}
      <div className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-20 flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className={controlButtonClass}>
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
            <Button variant="outline" size="icon" className={cn('relative', controlButtonClass)}>
              <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setTheme('light')}>
              <span className="flex items-center justify-between w-full">
                <span>Invoke</span>
                {theme === 'light' && <Check className="h-4 w-4 ml-2 text-primary" />}
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('claro')}>
              <span className="flex items-center justify-between w-full">
                <span>Claro</span>
                {theme === 'claro' && <Check className="h-4 w-4 ml-2 text-primary" />}
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('dark')}>
              <span className="flex items-center justify-between w-full">
                <span>Oscuro</span>
                {theme === 'dark' && <Check className="h-4 w-4 ml-2 text-primary" />}
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* `my-auto` en lugar de `items-center`: centra igual, pero cuando la card no entra en la
          pantalla el borde superior sigue siendo alcanzable con scroll. */}
      <div className="relative z-10 flex min-h-full justify-center p-4">
        <Card className="my-auto w-full max-w-sm shadow-2xl">
          <CardHeader className="text-center">
            <Image
              src="https://www.invokeia.com/assets/InvokeIA_C@4x-4T0dztu0.webp"
              width={80}
              height={80}
              alt="InvokeIA Logo"
              className="mx-auto mb-4"
            />
            <CardTitle>
              {view === 'login' ? tLogin('title') : tLogin('recoverPasswordTitle')}
            </CardTitle>
            {view === 'forgotPassword' && (
              <CardDescription>{tLogin('recoverPasswordDescription')}</CardDescription>
            )}
          </CardHeader>
          <CardContent>

            {view === 'login' ? (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-foreground">{tLogin('email')}</Label>
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
                  <Label htmlFor="password" className="text-foreground">{tLogin('password')}</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="text-right">
                  <Button variant="link" type="button" onClick={() => setView('forgotPassword')} className="p-0 h-auto">
                    {tLogin('forgotPassword')}
                  </Button>
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : tLogin('signIn')}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleRecoverySubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="recovery-email" className="text-foreground">{tLogin('email')}</Label>
                  <Input
                    id="recovery-email"
                    type="email"
                    placeholder="info@invokeia.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : tLogin('recoverPasswordButton')}
                </Button>
                <Button variant="link" type="button" onClick={() => setView('login')} className="w-full p-0 h-auto">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {tLogin('backToLogin')}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
