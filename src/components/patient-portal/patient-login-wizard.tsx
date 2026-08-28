'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, CalendarCheck, CheckCircle2, ClipboardPaste, Loader2, Lock, Mail, ShieldCheck, UserPlus } from 'lucide-react';
import { isValidPhoneNumber } from 'libphonenumber-js';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { DatePickerInput } from '@/components/ui/date-picker';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PhoneInput } from '@/components/ui/phone-input';

import { CodeInput } from '@/components/patient-portal/code-input';
import { PatientBookingPanel } from '@/components/patient-portal/patient-booking-panel';

import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { DEFAULT_PHONE_COUNTRY } from '@/lib/countries';
import {
  identifyPatient,
  registerPatient,
  sendPatientCode,
  verifyPatientCode,
} from '@/services/patient-auth';

/**
 * Pasos internos. El stepper visible agrupa `identify`/`register`/`needEmail`
 * bajo "Identificarte", porque para el paciente son todos el mismo momento.
 */
type Step = 'identify' | 'needEmail' | 'register' | 'code' | 'booking' | 'booked';

/** Paciente resuelto sin sesión, para poder reservar antes de tener token. */
interface GuestPatient {
  id: string;
  name: string;
  email: string;
}

const RESEND_SECONDS = 60;

/**
 * Registro mínimo: deliberadamente más corto que `userFormSchema`
 * (patient-form-utils.ts) para que el paciente nuevo no pierda tiempo. Sólo
 * nombre, teléfono y email son obligatorios.
 */
const registerSchema = (t: (key: string) => string) =>
  z.object({
    name: z.string().min(1, { message: t('validation.nameRequired') }),
    phone: z
      .string()
      .optional()
      .refine((v) => !v?.trim() || isValidPhoneNumber(v, DEFAULT_PHONE_COUNTRY), {
        message: t('validation.phoneInvalid'),
      }),
    email: z
      .string()
      .min(1, { message: t('validation.emailRequired') })
      .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, { message: t('validation.emailInvalid') }),
    identity_document: z
      .string()
      .regex(/^\d*$/, { message: t('validation.documentDigits') })
      .max(10, { message: t('validation.documentMax') })
      .optional(),
    birth_date: z.string().optional(),
    address: z.string().optional(),
  });

type RegisterValues = z.infer<ReturnType<typeof registerSchema>>;

interface RequestError extends Error {
  status?: number;
  data?: any;
}

/** Clases compartidas de los controles: alto generoso y texto grande, pensado para el pulgar. */
const TOUCH_INPUT = 'h-14 text-base sm:h-12 sm:text-sm';
const TOUCH_BUTTON = 'h-14 w-full text-base sm:h-12 sm:text-sm';

interface PatientLoginWizardProps {
  /**
   * `true` ⇒ el portal es sólo para reservar: nunca se pide OTP ni se entra al
   * perfil, ni siquiera para un paciente conocido.
   */
  appointmentsOnly?: boolean;
  /** `false` ⇒ la clínica no acepta reservas online; sólo consulta con OTP. */
  onlineBookingEnabled?: boolean;
}

export function PatientLoginWizard({
  appointmentsOnly = false,
  onlineBookingEnabled = true,
}: PatientLoginWizardProps) {
  const t = useTranslations('PatientLogin');
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const { loginWithToken } = useAuth();

  const [step, setStep] = React.useState<Step>('identify');
  const [identifier, setIdentifier] = React.useState('');
  const [missingEmail, setMissingEmail] = React.useState('');
  const [maskedEmail, setMaskedEmail] = React.useState<string | null>(null);
  const [code, setCode] = React.useState('');
  const [isNewPatient, setIsNewPatient] = React.useState(false);
  /** Paciente ya resuelto (registrado o encontrado) para reservar sin sesión. */
  const [guest, setGuest] = React.useState<GuestPatient | null>(null);
  const [bookedDetails, setBookedDetails] = React.useState<{ date: string; time: string } | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [resendIn, setResendIn] = React.useState(0);

  const registerForm = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema(t)),
    defaultValues: { name: '', phone: '', email: '', identity_document: '', birth_date: '', address: '' },
  });

  React.useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  // El tercer paso sólo existe para pacientes nuevos: entran directo a reservar.
  const showError = (err: unknown, fallbackKey = 'errors.unexpected') => {
    const message = err instanceof Error && err.message ? err.message : t(fallbackKey);
    toast({ variant: 'destructive', title: t('errors.title'), description: message });
  };

  const goToCodeStep = (masked: string | null) => {
    setMaskedEmail(masked);
    setCode('');
    setResendIn(RESEND_SECONDS);
    setStep('code');
  };

  const openRegisterStep = (prefill = '') => {
    const value = prefill.trim();
    const digitCount = value.replace(/\D/g, '').length;
    registerForm.reset({
      name: '',
      phone: !value.includes('@') && digitCount >= 6 ? value : '',
      email: value.includes('@') ? value : '',
      identity_document: '',
      birth_date: '',
      address: '',
    });
    setIsNewPatient(true);
    setStep('register');
  };

  // ── Paso 1: identificar ───────────────────────────────────────────────────
  const handleIdentify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;
    setIsLoading(true);
    try {
      const result = await identifyPatient(identifier);

      // No está en el sistema ⇒ se registra y pasa directo a reservar. Sin
      // reserva online el auto-registro no tiene destino (no hay OTP para un
      // paciente nuevo), así que ni se lo ofrece.
      if (!result.found) {
        if (!onlineBookingEnabled) {
          toast({ title: t('identify.newPatientDisabled') });
          return;
        }
        openRegisterStep(identifier);
        return;
      }

      // Modo "sólo citas": nunca se pide OTP, ni siquiera a un paciente conocido.
      // Tampoco tiene sentido si la clínica no acepta reservas online.
      if (appointmentsOnly && onlineBookingEnabled) {
        setGuest({ id: result.user_id ?? '', name: result.name ?? '', email: '' });
        setStep('booking');
        return;
      }

      // Sin citas futuras no hay nada que consultar: va directo a reservar,
      // sin la fricción del código. Con citas, sí se le pide el OTP porque
      // detrás está su historia clínica y su estado de cuenta.
      if (!result.has_upcoming_appointments && onlineBookingEnabled) {
        setGuest({ id: result.user_id ?? '', name: result.name ?? '', email: '' });
        setStep('booking');
        return;
      }

      if (result.needs_email) {
        setStep('needEmail');
        return;
      }

      const sent = await sendPatientCode(identifier);
      goToCodeStep(sent.masked_email ?? result.masked_email);
    } catch (err) {
      showError(err);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Paso 1b: existe pero no tiene email cargado ───────────────────────────
  const handleSubmitMissingEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const sent = await sendPatientCode(identifier, missingEmail);
      goToCodeStep(sent.masked_email);
    } catch (err) {
      showError(err);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Paso 1c: auto-registro ────────────────────────────────────────────────
  const handleRegister = async (values: RegisterValues) => {
    // Defensivo: el botón que lleva acá ya está oculto sin reserva online,
    // pero si la clínica lo deshabilitó mientras el paciente completaba el
    // formulario, no lo mandamos a un panel de reserva que igual va a fallar.
    if (!onlineBookingEnabled) {
      showError(new Error(t('identify.newPatientDisabled')));
      return;
    }
    setIsLoading(true);
    try {
      const result = await registerPatient(values);
      setIdentifier(values.email);
      setIsNewPatient(true);
      // El paciente nuevo NO recibe OTP: pasa directo a reservar su primera cita.
      // El correo se valida a posteriori por rebote (docs/patient-portal.md §3).
      setGuest({
        id: result.user_id,
        name: result.name ?? values.name,
        email: result.email ?? values.email,
      });
      setStep('booking');
    } catch (err) {
      const error = err as Partial<RequestError>;
      const conflicted: string[] | undefined = error.data?.error?.conflictedFields;
      if (error.data?.error?.code === 'unique_conflict' && conflicted?.length) {
        const labels = conflicted.map((f) => t(`fields.${f}` as never)).join(', ');
        toast({
          variant: 'destructive',
          title: t('errors.title'),
          description: t('errors.alreadyRegistered', { fields: labels }),
        });
        return;
      }
      showError(err);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Paso 2: verificar el código ───────────────────────────────────────────
  const handleVerify = async (submittedCode?: string) => {
    const value = (submittedCode ?? code).trim();
    if (value.length !== 6) return;
    setIsLoading(true);
    try {
      const result = await verifyPatientCode(identifier, value);
      await loginWithToken(result.token);
      // El portal decide solo si toca reservar primero (paciente sin citas
      // futuras) o mostrar el perfil directamente — no hace falta pasárselo.
      router.replace(`/${locale}/my-profile`);
    } catch (err) {
      setCode('');
      showError(err, 'errors.invalidCode');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendIn > 0) return;
    setIsLoading(true);
    try {
      const sent = await sendPatientCode(identifier, missingEmail || undefined);
      setMaskedEmail(sent.masked_email);
      setResendIn(RESEND_SECONDS);
      toast({ title: t('code.resentTitle'), description: t('code.resentDescription') });
    } catch (err) {
      showError(err);
    } finally {
      setIsLoading(false);
    }
  };

  const backToIdentify = () => {
    setStep('identify');
    setCode('');
    setMissingEmail('');
    setIsNewPatient(false);
    setGuest(null);
    setBookedDetails(null);
    setIdentifier('');
  };

  /** Motivo que se le muestra al paciente en cada paso. */
  const reasons: Record<Step, { icon: React.ElementType; text: string }> = {
    identify: { icon: ShieldCheck, text: t('identify.reason') },
    needEmail: { icon: Mail, text: t('needEmail.reason') },
    register: { icon: UserPlus, text: t('register.reason') },
    code: { icon: Lock, text: t('code.reason') },
    booking: { icon: CalendarCheck, text: t('booking.reason') },
    booked: { icon: CalendarCheck, text: t('booked.reason') },
  };
  const reason = reasons[step];

  const headings: Record<Step, { title: string; description: string }> = {
    identify: { title: t('identify.title'), description: t('identify.description') },
    needEmail: { title: t('needEmail.title'), description: t('needEmail.description') },
    register: { title: t('register.title'), description: t('register.description') },
    code: { title: t('code.title'), description: t('code.description', { email: maskedEmail ?? '' }) },
    booking: { title: t('booking.title'), description: t('booking.description') },
    booked: { title: t('booked.title'), description: t('booked.description') },
  };

  return (
    <div>
      <div className="space-y-1.5 text-center lg:text-left">
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{headings[step].title}</h2>
        <p className="text-sm text-muted-foreground">{headings[step].description}</p>
      </div>

      {/* Por qué pedimos esto: el paciente no está en un software, está en la web
          de su clínica — cada paso explica para qué sirve el dato. */}
      {step !== 'booked' && <Explainer icon={reason.icon}>{reason.text}</Explainer>}

      <div className="mt-5">
        {/* ── Identificar ──────────────────────────────────────────────── */}
        {step === 'identify' && (
          <div className="space-y-5">
            <form onSubmit={handleIdentify} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="identifier" className="text-sm font-medium">
                  {t('identify.label')}
                </Label>
                <Input
                  id="identifier"
                  autoComplete="username"
                  inputMode="email"
                  className={TOUCH_INPUT}
                  placeholder={t('identify.placeholder')}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">{t('identify.hint')}</p>
              </div>
              <Button type="submit" size="lg" className={TOUCH_BUTTON} disabled={isLoading || !identifier.trim()}>
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    {t('identify.submit')}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>
            </form>

            {/* Sin reserva online el auto-registro no lleva a ningún lado
                (el paciente nuevo entra directo a reservar, nunca a OTP). */}
            {onlineBookingEnabled && (
              <>
                <div className="flex items-center gap-3">
                  <span className="h-px flex-1 bg-border" />
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">{t('or')}</span>
                  <span className="h-px flex-1 bg-border" />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className={TOUCH_BUTTON}
                  onClick={() => openRegisterStep(identifier)}
                >
                  <UserPlus className="mr-2 h-5 w-5" />
                  {t('identify.newPatient')}
                </Button>
              </>
            )}
          </div>
        )}

        {/* ── Falta el email ───────────────────────────────────────────── */}
        {step === 'needEmail' && (
          <form onSubmit={handleSubmitMissingEmail} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="missing-email">{t('needEmail.label')}</Label>
              <Input
                id="missing-email"
                type="email"
                inputMode="email"
                autoFocus
                className={TOUCH_INPUT}
                placeholder="tu@email.com"
                value={missingEmail}
                onChange={(e) => setMissingEmail(e.target.value)}
                required
              />
            </div>
            <Button type="submit" size="lg" className={TOUCH_BUTTON} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : t('needEmail.submit')}
            </Button>
            <BackLink onClick={backToIdentify} label={t('back')} />
          </form>
        )}

        {/* ── Auto-registro ────────────────────────────────────────────── */}
        {step === 'register' && (
          <Form {...registerForm}>
            <form onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-4">
              <FormField
                control={registerForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('register.name')}</FormLabel>
                    <FormControl>
                      <Input autoFocus className={TOUCH_INPUT} placeholder={t('register.namePlaceholder')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Correo y teléfono, uno debajo del otro y a ancho completo: el
                  correo es la credencial (ahí llega el código) y el teléfono
                  queda para que la clínica pueda contactarlo, sin bloquear el
                  registro. */}
              <FormField
                control={registerForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('register.email')}</FormLabel>
                    <FormControl>
                      <Input type="email" inputMode="email" className={TOUCH_INPUT} placeholder="tu@email.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={registerForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t('register.phone')}{' '}
                      <span className="font-normal text-muted-foreground">{t('register.optionalSuffix')}</span>
                    </FormLabel>
                    <FormControl>
                      <PhoneInput
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        defaultCountry={DEFAULT_PHONE_COUNTRY}
                        className={TOUCH_INPUT}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <details className="rounded-xl border bg-muted/30 px-4 py-3">
                <summary className="cursor-pointer select-none text-sm font-medium text-muted-foreground">
                  {t('register.optionalToggle')}
                </summary>
                <div className="mt-4 space-y-4">
                  <FormField
                    control={registerForm.control}
                    name="identity_document"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('register.document')}</FormLabel>
                        <FormControl>
                          <Input inputMode="numeric" className={TOUCH_INPUT} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={registerForm.control}
                    name="birth_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('register.birthDate')}</FormLabel>
                        <FormControl>
                          <DatePickerInput
                            value={field.value}
                            onChange={field.onChange}
                            disabledDays={(date: Date) => date > new Date() || date < new Date('1900-01-01')}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={registerForm.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('register.address')}</FormLabel>
                        <FormControl>
                          <Input className={TOUCH_INPUT} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </details>

              <Button type="submit" size="lg" className={TOUCH_BUTTON} disabled={isLoading}>
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : t('register.submit')}
              </Button>
              <BackLink onClick={backToIdentify} label={t('back')} />
            </form>
          </Form>
        )}

        {/* ── Reserva sin sesión ───────────────────────────────────────── */}
        {step === 'booking' && guest && (
          /* Alto acotado: el panel reparte scroll interno y footer fijo. */
          <div className="flex h-[32rem] min-h-0 flex-col sm:h-[34rem]">
            <PatientBookingPanel
              authMode="public"
              patient={{
                id: guest.id,
                name: guest.name,
                email: guest.email,
                phone_number: '',
                is_active: true,
                avatar: '',
              }}
              onBooked={(details) => {
                setBookedDetails(details);
                setStep('booked');
              }}
              secondaryAction={<BackLink onClick={backToIdentify} label={t('startOver')} />}
            />
          </div>
        )}

        {/* ── Confirmación final ───────────────────────────────────────── */}
        {step === 'booked' && (
          <div className="space-y-5 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
            {bookedDetails && (
              <p className="text-base font-semibold">
                {t('booked.when', { date: bookedDetails.date, time: bookedDetails.time })}
              </p>
            )}
            <p className="rounded-xl bg-primary/5 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
              {t('booked.emailSent')}
            </p>
            <Button type="button" variant="outline" size="lg" className={TOUCH_BUTTON} onClick={backToIdentify}>
              {t('booked.done')}
            </Button>
          </div>
        )}

        {/* ── Código ───────────────────────────────────────────────────── */}
        {step === 'code' && (
          <div className="space-y-5">
            <div className="flex items-center justify-center gap-2 rounded-xl bg-muted/50 px-4 py-3 text-sm">
              <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate font-medium">{maskedEmail}</span>
            </div>

            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <ClipboardPaste className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              {t('code.pasteHint')}
            </p>

            <CodeInput value={code} onChange={setCode} onComplete={handleVerify} disabled={isLoading} />

            <Button
              type="button"
              size="lg"
              className={TOUCH_BUTTON}
              disabled={isLoading || code.length !== 6}
              onClick={() => handleVerify()}
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <ShieldCheck className="mr-2 h-5 w-5" />
                  {t('code.submit')}
                </>
              )}
            </Button>

            <div className="space-y-2 text-center">
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 text-sm"
                disabled={resendIn > 0 || isLoading}
                onClick={handleResend}
              >
                {resendIn > 0 ? t('code.resendIn', { seconds: resendIn }) : t('code.resend')}
              </Button>
              <BackLink onClick={backToIdentify} label={t('back')} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Nota de contexto de un paso: por qué se piden esos datos o qué protege. */
function Explainer({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <p className="mt-4 flex items-start gap-2.5 rounded-xl bg-primary/5 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

function BackLink({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <Button
      type="button"
      variant="link"
      className="h-auto w-full py-1 text-xs font-normal text-muted-foreground hover:text-foreground"
      onClick={onClick}
    >
      {label}
    </Button>
  );
}
