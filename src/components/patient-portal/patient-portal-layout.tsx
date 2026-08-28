'use client';

import { Check, Globe, LayoutDashboard, LogOut, Moon, Sun } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { UsFlagIcon } from '@/components/icons/us-flag-icon';
import { UyFlagIcon } from '@/components/icons/uy-flag-icon';
import { ClinicFooter } from '@/components/patient-portal/clinic-footer';
import { ReadOnlyProvider } from '@/components/patient-portal/read-only-context';

import { useAuth } from '@/context/AuthContext';
import { usePatientPortal } from '@/hooks/usePatientPortal';

/**
 * Shell del portal del paciente. Sustituye a `AuthenticatedLayout` (sidebar +
 * header + banners de licencia) por una barra superior mínima, pensada primero
 * para móvil.
 *
 * Envuelve el contenido en `ReadOnlyProvider`, que es lo que hace que los
 * paneles reutilizados (`PatientInfoTab`, `ClinicHistoryViewer`, …) escondan
 * sus acciones de crear/editar/borrar.
 */
export function PatientPortalLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('PatientPortal');
  const tHeader = useTranslations('Header');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { logout } = useAuth();
  const { patientName, isDualRole } = usePatientPortal();

  const initials = React.useMemo(() => {
    return patientName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }, [patientName]);

  const onSelectLocale = (newLocale: string) => {
    localStorage.setItem('locale', newLocale);
    router.replace(pathname.replace(`/${locale}`, `/${newLocale}`));
  };

  const handleLogout = async () => {
    await logout();
    router.replace(`/${locale}/patient-login`);
  };

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background text-foreground">
      <header className="flex flex-none items-center gap-3 border-b border-[var(--nav-border)] bg-[var(--nav-bg)] px-3 py-2 text-[var(--nav-foreground)] sm:px-6 sm:py-3">
        <Image
          src="https://www.invokeia.com/assets/InvokeIA_C@4x-4T0dztu0.webp"
          width={32}
          height={32}
          alt="Invoke IA"
          className="h-8 w-8 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight">{patientName}</p>
          <p className="truncate text-xs text-[var(--nav-text-muted)]">{t('subtitle')}</p>
        </div>

        {/* Salida visible del modo "ver como paciente": es un modo temporal,
            conviene que el staff no tenga que buscarla dentro del menú. */}
        {isDualRole && (
          <Button
            variant="outline"
            size="sm"
            className="hidden h-9 shrink-0 border-[var(--nav-border)] bg-transparent text-xs text-[var(--nav-foreground)] hover:bg-[var(--nav-active-bg)] hover:text-[var(--nav-foreground)] sm:inline-flex"
            onClick={() => router.push(`/${locale}`)}
          >
            <LayoutDashboard className="mr-1.5 h-4 w-4" />
            {t('backToStaff')}
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 text-[var(--nav-foreground)] hover:bg-[var(--nav-active-bg)] hover:text-[var(--nav-foreground)]">
              <Globe className="h-[1.1rem] w-[1.1rem]" />
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
          className="h-9 w-9 text-[var(--nav-foreground)] hover:bg-[var(--nav-active-bg)] hover:text-[var(--nav-foreground)]"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          <Sun className="h-[1.1rem] w-[1.1rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.1rem] w-[1.1rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">{t('toggleTheme')}</span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-[var(--nav-active-bg)]">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-[var(--nav-active-bg)] text-xs text-[var(--nav-foreground)]">{initials || '?'}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {/* Quien además es staff vuelve al dashboard sin cerrar sesión. */}
            {isDualRole && (
              <>
                <DropdownMenuItem onSelect={() => router.push(`/${locale}`)}>
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  {t('backToStaff')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onSelect={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              {t('logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <ReadOnlyProvider>{children}</ReadOnlyProvider>
      </main>

      {/* Mismos datos de contacto que la landing: el paciente siempre tiene a
          mano cómo comunicarse con la clínica. */}
      <ClinicFooter />
    </div>
  );
}
