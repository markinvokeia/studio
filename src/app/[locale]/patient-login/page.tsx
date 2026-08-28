'use client';

import { ArrowDown, Check, Globe, Moon, Phone, Sun } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';

import { UsFlagIcon } from '@/components/icons/us-flag-icon';
import { UyFlagIcon } from '@/components/icons/uy-flag-icon';
import { ClinicFooter } from '@/components/patient-portal/clinic-footer';
import { PatientLoginWizard } from '@/components/patient-portal/patient-login-wizard';
import { WelcomeVideo } from '@/components/patient-portal/welcome-video';

import type { PublicClinicInfo } from '@/lib/types';
import { resolveVideoEmbed } from '@/lib/video-embed';
import { DEFAULT_WELCOME_VIDEO_URL, fetchPublicClinicInfo } from '@/services/public-clinic';

const INVOKEIA_LOGO = 'https://www.invokeia.com/assets/InvokeIA_C@4x-4T0dztu0.webp';
const WIZARD_ANCHOR = 'acceso';

/**
 * Landing pública del portal del paciente.
 *
 * No es una pantalla de login de software: es la web de bienvenida de la
 * clínica. Los datos salen de `/api/public/clinic` — el ÚNICO endpoint que se
 * consulta acá, porque el visitante todavía no tiene token; `/clinic` está
 * protegido y no sirve en este punto.
 *
 * Layout: la página nunca scrollea. El alto se reparte entre header, contenido
 * y footer; si el viewport queda corto (móvil, o el paso de registro que es más
 * largo) scrollea el área de contenido, no el documento.
 */
export default function PatientLoginPage() {
  const t = useTranslations('PatientLogin');
  const tHeader = useTranslations('Header');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const [clinic, setClinic] = React.useState<PublicClinicInfo | null>(null);
  const [isLoadingClinic, setIsLoadingClinic] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const info = await fetchPublicClinicInfo();
      if (cancelled) return;
      setClinic(info);
      setIsLoadingClinic(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSelectLocale = (newLocale: string) => {
    localStorage.setItem('locale', newLocale);
    router.replace(pathname.replace(`/${locale}`, `/${newLocale}`));
  };

  const clinicName = clinic?.name ?? '';
  const displayName = clinicName || t('genericClinicName');
  // Cae al video por defecto tanto si la clínica no cargó ninguno como si el
  // enlace que cargó no es reproducible: al paciente hay que mostrarle algo,
  // no un placeholder de error. En la página de configuración sí se le avisa
  // al staff que el enlace no sirve.
  const configuredVideo = clinic?.welcome_video_url ?? '';
  const videoUrl =
    resolveVideoEmbed(configuredVideo).kind === 'none' ? DEFAULT_WELCOME_VIDEO_URL : configuredVideo;
  const portalEnabled = clinic ? clinic.patient_portal_enabled : true;

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background text-foreground">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="flex-none border-b bg-card/60 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-2.5 sm:px-6">
          <ClinicLogo clinic={clinic} isLoading={isLoadingClinic} />
          <div className="min-w-0 flex-1">
            {isLoadingClinic ? (
              <Skeleton className="h-4 w-36" />
            ) : (
              <p className="truncate text-sm font-bold leading-tight sm:text-base">{displayName}</p>
            )}
            <p className="truncate text-[11px] text-muted-foreground">{t('header.tagline')}</p>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="hidden h-9 text-xs text-muted-foreground sm:inline-flex"
            onClick={() => router.push(`/${locale}/login`)}
          >
            {t('hero.staffCta')}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0">
                <Globe className="h-[1.05rem] w-[1.05rem]" />
                <span className="sr-only">{tHeader('toggleLanguage')}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onSelectLocale('es')} disabled={locale === 'es'}>
                <span className="flex w-full items-center justify-between">
                  <span className="flex items-center gap-2">
                    <UyFlagIcon className="h-4 w-4" />
                    {tHeader('spanish')}
                  </span>
                  {locale === 'es' && <Check className="ml-2 h-4 w-4" />}
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onSelectLocale('en')} disabled={locale === 'en'}>
                <span className="flex w-full items-center justify-between">
                  <span className="flex items-center gap-2">
                    <UsFlagIcon className="h-4 w-4" />
                    {tHeader('english')}
                  </span>
                  {locale === 'en' && <Check className="ml-2 h-4 w-4" />}
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            <Sun className="h-[1.05rem] w-[1.05rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-[1.05rem] w-[1.05rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">{t('toggleTheme')}</span>
          </Button>
        </div>
      </header>

      {/* ── Contenido ──────────────────────────────────────────────────── */}
      <main className="relative min-h-0 flex-1 overflow-y-auto lg:overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_55%_at_50%_0%,hsl(var(--primary)/0.12),transparent_70%)]"
        />
        <div className="relative mx-auto grid w-full max-w-6xl gap-8 px-4 py-6 sm:px-6 lg:h-full lg:grid-cols-[1fr_minmax(0,26rem)] lg:items-center lg:gap-14 lg:py-0">
          {/* Bienvenida + video */}
          <section className="space-y-5 text-center lg:text-left">
            <div className="space-y-3">
              <h1 className="text-3xl font-extrabold leading-[1.1] tracking-tight sm:text-4xl xl:text-5xl">
                {isLoadingClinic ? (
                  <Skeleton className="mx-auto h-11 w-4/5 lg:mx-0" />
                ) : (
                  t('hero.title', { clinic: displayName })
                )}
              </h1>
              <p className="mx-auto max-w-prose text-sm text-muted-foreground sm:text-base lg:mx-0">
                {clinic?.welcome_message || t('hero.subtitle')}
              </p>
            </div>

            {/* Video de bienvenida: archivo, YouTube, Instagram o Vimeo — el
                reproductor se resuelve solo. Por defecto, el genérico de
                Invoke IA. Se configura en Configuración → Portal del Paciente. */}
            <WelcomeVideo url={videoUrl} title={t('hero.videoTitle', { clinic: displayName })} />

            <ul className="flex flex-wrap justify-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground sm:text-sm lg:justify-start">
              {[t('hero.perks.appointments'), t('hero.perks.history'), t('hero.perks.finance')].map((perk) => (
                <li key={perk} className="flex items-center gap-1.5">
                  <Check className="h-4 w-4 shrink-0 text-primary" />
                  {perk}
                </li>
              ))}
            </ul>

            {/* En móvil el wizard queda abajo: se ofrece un salto directo. */}
            <Button
              variant="outline"
              size="lg"
              className="h-12 w-full lg:hidden"
              onClick={() =>
                document.getElementById(WIZARD_ANCHOR)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
            >
              {t('hero.cta')}
              <ArrowDown className="ml-2 h-4 w-4" />
            </Button>
          </section>

          {/* Acceso — sin marco: comparte la superficie con la bienvenida */}
          <section
            id={WIZARD_ANCHOR}
            className="scroll-mt-4 pb-6 lg:max-h-full lg:overflow-y-auto lg:py-8 lg:pl-10 lg:pr-1 lg:[border-left:1px_solid_hsl(var(--border))]"
          >
            {portalEnabled ? (
              <PatientLoginWizard
                appointmentsOnly={clinic?.appointments_only ?? false}
                onlineBookingEnabled={clinic?.online_booking_enabled ?? true}
              />
            ) : (
              <div className="space-y-3 text-center lg:text-left">
                <h2 className="text-xl font-bold">{t('disabled.title')}</h2>
                <p className="text-sm text-muted-foreground">
                  {t('disabled.description', { clinic: displayName })}
                </p>
                {clinic?.phone && (
                  <a
                    href={`tel:${clinic.phone}`}
                    className="inline-flex h-12 items-center gap-2 rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground"
                  >
                    <Phone className="h-4 w-4" />
                    {clinic.phone}
                  </a>
                )}
              </div>
            )}
          </section>
        </div>
      </main>

      <ClinicFooter />
    </div>
  );
}

// ── Piezas de presentación ───────────────────────────────────────────────────

/** Logo de la clínica, con el isotipo de Invoke IA como respaldo. */
function ClinicLogo({ clinic, isLoading }: { clinic: PublicClinicInfo | null; isLoading: boolean }) {
  if (isLoading) return <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />;

  if (clinic?.logo_url) {
    return (
      // El logo llega como data URI desde el endpoint público: `next/image` no
      // aporta nada acá y `unoptimized` obligaría a configurar el loader.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={clinic.logo_url} alt={clinic.name} className="h-9 w-9 shrink-0 rounded-lg object-contain" />
    );
  }

  return <Image src={INVOKEIA_LOGO} width={36} height={36} alt="" className="h-9 w-9 shrink-0" />;
}
