'use client';

import { OpenCashSessionWidget } from '@/components/cash-session-widget';
import { TVDisplayWidget } from '@/components/tv-display-widget';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { GLOBAL_PERMISSIONS } from '@/constants/permissions';
import { useAlertNotifications } from '@/context/alert-notifications-context';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
    Bell,
    Check,
    ChevronLeft,
    ChevronRight,
    Globe,
    LifeBuoy,
    MessageSquare,
    Volume2,
    VolumeX,
    X,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';
import { createPortal } from 'react-dom';
import { ExchangeRate } from './exchange-rate';
import { TelegramIcon } from './icons/telegram-icon';
import { UsFlagIcon } from './icons/us-flag-icon';
import { UyFlagIcon } from './icons/uy-flag-icon';
import { WhatsAppIcon } from './icons/whatsapp-icon';
import { VoiceAssistant } from './voice-assistant';
import { VoiceChat, type ChatMessage } from './voice-chat';

// ── Webhook URL ───────────────────────────────────────────────────────────────

const CHAT_WEBHOOK_URL =
    (process.env.NEXT_PUBLIC_API_URL ?? 'https://n8n-project-n8n.7ig1i3.easypanel.host') +
    '/webhook/a8ad846b-de6a-4d89-8e02-01072101cfe6/chat';

// ── TTS ───────────────────────────────────────────────────────────────────────

// Preferred voice names (ordered by preference). Chrome ships these on most platforms.
const PREFERRED_VOICE_NAMES = [
    'Google español',          // Chrome – es-ES, high quality
    'Microsoft Sabina',        // Windows – es-MX
    'Microsoft Helena',        // Windows – es-ES
    'Paulina',                 // macOS – es-MX
    'Monica',                  // macOS – es-ES
    'Jorge',                   // macOS – es-ES (male fallback)
    'Diego',                   // macOS – es-AR
];

/** Resolves the best Spanish voice available, waiting for voices to load if needed. */
function pickSpanishVoice(): Promise<SpeechSynthesisVoice | null> {
    return new Promise((resolve) => {
        const synth = window.speechSynthesis;

        const find = () => {
            const voices = synth.getVoices();
            if (voices.length === 0) return null;

            // 1. Try preferred names in order
            for (const name of PREFERRED_VOICE_NAMES) {
                const v = voices.find((v) => v.name.includes(name));
                if (v) return v;
            }
            // 2. Any local Spanish voice
            const local = voices.find((v) => v.lang.startsWith('es') && v.localService);
            if (local) return local;
            // 3. Any Spanish voice
            return voices.find((v) => v.lang.startsWith('es')) ?? null;
        };

        const result = find();
        if (result) { resolve(result); return; }

        // Voices not loaded yet — wait for the event (fires once in Chrome)
        const onLoaded = () => {
            synth.removeEventListener('voiceschanged', onLoaded);
            resolve(find());
        };
        synth.addEventListener('voiceschanged', onLoaded);
        // Safety timeout: resolve with null if event never fires
        setTimeout(() => { synth.removeEventListener('voiceschanged', onLoaded); resolve(null); }, 2000);
    });
}

async function speakText(text: string, enabled: boolean) {
    if (!enabled || typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-ES';
    utterance.rate = 0.92;
    utterance.pitch = 1;

    const voice = await pickSpanishVoice();
    if (voice) utterance.voice = voice;

    window.speechSynthesis.speak(utterance);
}

// ─────────────────────────────────────────────────────────────────────────────

export function Header() {
    const pathname = usePathname();
    const t = useTranslations('Header');
    const tFloating = useTranslations('FloatingActions');
    const tChat = useTranslations('VoiceChat');
    const locale = useLocale();
    const router = useRouter();
    const { activeCashSession, user } = useAuth();
    const { pendingCount } = useAlertNotifications();
    const { hasPermission } = usePermissions();
    const { toast } = useToast();

    const [isExpanded, setIsExpanded] = React.useState(false);
    const [isChatOpen, setIsChatOpen] = React.useState(false);
    const [isChatMinimized, setIsChatMinimized] = React.useState(false);
    const [chatMessages, setChatMessages] = React.useState<ChatMessage[]>([]);
    const [isSending, setIsSending] = React.useState(false);
    const [ttsEnabled, setTtsEnabled] = React.useState(true);
    const [isClient, setIsClient] = React.useState(false);

    const sessionId = React.useRef(`sid-${Date.now()}`);

    React.useEffect(() => {
        setIsClient(true);
    }, []);

    const openChatPanel = React.useCallback(() => {
        setIsChatOpen(true);
        setIsChatMinimized(false);
    }, []);

    const closeChatPanel = React.useCallback(() => {
        setIsChatOpen(false);
        setIsChatMinimized(false);
    }, []);

    // ── Send a message (text or voice) to the webhook ─────────────────────────

    const sendToWebhook = React.useCallback(
        async (chatInput: string, audioBlob?: Blob) => {
            setIsSending(true);
            try {
                let body: BodyInit;

                if (audioBlob) {
                    const fd = new FormData();
                    fd.append('action', 'sendMessage');
                    fd.append('sessionId', sessionId.current);
                    fd.append('chatInput', chatInput);
                    if (user?.id) fd.append('user_id', String(user.id));
                    fd.append('files', audioBlob, 'voice-message.webm');
                    body = fd;
                } else {
                    body = JSON.stringify({
                        action: 'sendMessage',
                        sessionId: sessionId.current,
                        chatInput,
                        ...(user?.id ? { user_id: user.id } : {}),
                    });
                }

                const response = await fetch(CHAT_WEBHOOK_URL, {
                    method: 'POST',
                    headers: audioBlob ? undefined : { 'Content-Type': 'application/json' },
                    body,
                });

                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                let reply = '';
                let redirect: string | null = null;
                try {
                    const data = await response.json() as Record<string, unknown>;
                    reply =
                        (data.output as string) ??
                        (data.text as string) ??
                        (data.message as string) ??
                        (data.response as string) ??
                        '';
                    if (typeof data.redirect === 'string' && data.redirect) {
                        redirect = data.redirect;
                    }
                } catch {
                    reply = await response.text();
                }

                if (reply) {
                    setChatMessages((prev) => [
                        ...prev,
                        {
                            id: `${Date.now()}-ai`,
                            role: 'assistant',
                            content: reply,
                            timestamp: new Date(),
                        },
                    ]);
                    speakText(reply, ttsEnabled);
                    if (redirect) router.push(`/${locale}${redirect}`);
                }
            } catch {
                toast({ title: tChat('sendError'), variant: 'destructive', duration: 4000 });
            } finally {
                setIsSending(false);
            }
        },
        [tChat, toast, ttsEnabled, locale, router, user],
    );

    // ── VoiceAssistant callback ───────────────────────────────────────────────

    const handleAudioReady = React.useCallback(
        (blob: Blob) => {
            openChatPanel();
            setChatMessages((prev) => [
                ...prev,
                {
                    id: `${Date.now()}-user`,
                    role: 'user',
                    content: tChat('voiceMessage'),
                    isVoice: true,
                    timestamp: new Date(),
                },
            ]);
            sendToWebhook(tChat('voiceMessage'), blob);
        },
        [openChatPanel, sendToWebhook, tChat],
    );

    // ── Text chat callback ────────────────────────────────────────────────────

    const handleSendText = React.useCallback(
        (text: string) => {
            setChatMessages((prev) => [
                ...prev,
                {
                    id: `${Date.now()}-user`,
                    role: 'user',
                    content: text,
                    timestamp: new Date(),
                },
            ]);
            sendToWebhook(text);
        },
        [sendToWebhook],
    );

    // ── Mobile: track viewport ────────────────────────────────────────────────
    const [isMobile, setIsMobile] = React.useState(false);
    React.useEffect(() => {
        const mq = window.matchMedia('(max-width: 639px)');
        const update = () => setIsMobile(mq.matches);
        update();
        mq.addEventListener('change', update);
        return () => mq.removeEventListener('change', update);
    }, []);

    // ── Locale switcher ───────────────────────────────────────────────────────

    const onSelectLocale = (newLocale: string) => {
        const searchParams = new URLSearchParams(window.location.search);
        const newPathname = pathname.replace(`/${locale}`, `/${newLocale}`);
        router.replace(`${newPathname}?${searchParams.toString()}`);
    };

    // ── Help menu ─────────────────────────────────────────────────────────────

    const HelpMenu = () => (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full h-9 w-9">
                    <LifeBuoy className="h-5 w-5 text-muted-foreground" />
                    <span className="sr-only">{tFloating('openMenu')}</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl p-2">
                <DropdownMenuLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {tFloating('chatbotTitle')}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                    <Link
                        href="https://wa.me/59894024661"
                        target="_blank"
                        className="flex items-center w-full"
                    >
                        <WhatsAppIcon className="mr-2 h-4 w-4 text-green-500" />
                        <span>WhatsApp</span>
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                    <Link
                        href="https://t.me/InvokIA_bot"
                        target="_blank"
                        className="flex items-center w-full"
                    >
                        <TelegramIcon className="mr-2 h-4 w-4 text-blue-500" />
                        <span>Telegram</span>
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={openChatPanel}>
                    <MessageSquare className="mr-2 h-4 w-4 text-purple-500" />
                    <span>{tFloating('openChat')}</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );

    // ─────────────────────────────────────────────────────────────────────────

    return (
        <>
            {/* ── Floating widget ─────────────────────────────────────────── */}
            {/* Desktop: top-right pill | Mobile: right-edge vertical column */}
            <div className={cn(
                "fixed z-[50]",
                isMobile
                    ? isExpanded
                        ? "top-0 left-0 right-0 flex items-start"
                        : "top-0 right-0 flex items-start"
                    : "top-3 right-4 flex flex-col items-end gap-2"
            )}>
                {!isExpanded ? (
                    /* ── Collapsed state: widget toggle button in top-right slot ── */
                    <button
                        type="button"
                        onClick={() => setIsExpanded(true)}
                        className={cn(
                            "flex items-center justify-center bg-[hsl(var(--floating-header-bg)/0.85)] backdrop-blur-md border border-border shadow-lg transition-all hover:bg-[hsl(var(--floating-header-bg))]",
                            isMobile
                                ? "h-12 w-12 rounded-none border-t-0 border-r-0 border-l border-b border-[var(--nav-border)] bg-[var(--nav-active-bg)] hover:bg-[var(--nav-hover-bg)]"
                                : "h-8 w-8 rounded-full"
                        )}
                        aria-label={tFloating('openMenu')}
                    >
                        <ChevronLeft className={cn("h-4 w-4", isMobile ? "text-foreground" : "text-muted-foreground")} />
                    </button>
                ) : isMobile ? (
                    /* ── Mobile expanded: full-width bar (leaves space for hamburger) ── */
                    <div className={cn(
                        'flex flex-row-reverse items-center gap-0.5 bg-[hsl(var(--floating-header-bg)/0.95)] backdrop-blur-md py-1.5 px-1.5 border-b border-border shadow-md w-full justify-start overflow-x-auto',
                        'animate-in fade-in slide-in-from-top-2 duration-200',
                    )}>
                        {/* Close button */}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsExpanded(false)}
                            className="rounded-xl h-8 w-8 hover:bg-accent flex-none"
                        >
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </Button>

                        <div className="h-6 w-px bg-border/50 mx-0.5 flex-none" />

                        <OpenCashSessionWidget />
                        <TVDisplayWidget />

                        {hasPermission(GLOBAL_PERMISSIONS.GLOBAL_VIEW_NOTIFICATIONS_BADGE) && (
                            <Link href={`/${locale}/alerts`} passHref>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className={cn(
                                        'relative rounded-xl h-9 w-9',
                                        pendingCount > 0 && 'bg-red-500/10 text-red-600',
                                    )}
                                >
                                    <div className={cn(pendingCount > 0 && 'animate-bell-ring')}>
                                        <Bell className="h-5 w-5" />
                                    </div>
                                    {pendingCount > 0 && (
                                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white bg-red-600 ring-2 ring-background">
                                            {pendingCount > 99 ? '99+' : pendingCount}
                                        </span>
                                    )}
                                </Button>
                            </Link>
                        )}

                        {hasPermission(GLOBAL_PERMISSIONS.GLOBAL_CHANGE_LANGUAGE) && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9">
                                        <Globe className="h-5 w-5 text-muted-foreground" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" side="left" className="rounded-xl">
                                    <DropdownMenuItem onSelect={() => onSelectLocale('es')} disabled={locale === 'es'}>
                                        <div className="flex items-center gap-2"><UyFlagIcon className="h-4 w-4" />{t('spanish')}</div>
                                        {locale === 'es' && <Check className="h-4 w-4 ml-2 text-primary" />}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => onSelectLocale('en')} disabled={locale === 'en'}>
                                        <div className="flex items-center gap-2"><UsFlagIcon className="h-4 w-4" />{t('english')}</div>
                                        {locale === 'en' && <Check className="h-4 w-4 ml-2 text-primary" />}
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}

                        <HelpMenu />
                        <VoiceAssistant onAudioReady={handleAudioReady} isProcessing={isSending} />
                    </div>
                ) : (
                    /* ── Desktop expanded: horizontal pill ── */
                    <div
                        className={cn(
                            'flex items-center gap-3 bg-[hsl(var(--floating-header-bg)/0.95)] backdrop-blur-md p-2 rounded-full border border-border shadow-2xl transition-all',
                            'animate-in fade-in slide-in-from-right-10 duration-300',
                        )}
                    >
                        <div className="flex items-center gap-3 px-2">
                            <OpenCashSessionWidget />
                            <TVDisplayWidget />

                            <div className="h-6 w-px bg-border/50" />

                            {hasPermission(GLOBAL_PERMISSIONS.GLOBAL_VIEW_NOTIFICATIONS_BADGE) && (
                                <Link href={`/${locale}/alerts`} passHref>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className={cn(
                                            'relative rounded-full transition-all duration-300 h-9 w-9',
                                            pendingCount > 0 && 'bg-red-500/10 text-red-600',
                                        )}
                                    >
                                        <div className={cn(pendingCount > 0 && 'animate-bell-ring')}>
                                            <Bell className="h-5 w-5" />
                                        </div>
                                        {pendingCount > 0 && (
                                            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white bg-red-600 ring-2 ring-background">
                                                {pendingCount > 99 ? '99+' : pendingCount}
                                            </span>
                                        )}
                                        <span className="sr-only">{t('alerts')}</span>
                                    </Button>
                                </Link>
                            )}

                            {hasPermission(GLOBAL_PERMISSIONS.GLOBAL_VIEW_EXCHANGE_RATE) && activeCashSession && (
                                <ExchangeRate activeCashSession={activeCashSession} />
                            )}

                            {hasPermission(GLOBAL_PERMISSIONS.GLOBAL_CHANGE_LANGUAGE) && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="rounded-full h-9 w-9">
                                            <Globe className="h-5 w-5 text-muted-foreground" />
                                            <span className="sr-only">{t('toggleLanguage')}</span>
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="rounded-xl">
                                        <DropdownMenuItem onSelect={() => onSelectLocale('es')} disabled={locale === 'es'}>
                                            <span className="flex items-center justify-between w-full font-medium">
                                                <div className="flex items-center gap-2"><UyFlagIcon className="h-4 w-4" />{t('spanish')}</div>
                                                {locale === 'es' && <Check className="h-4 w-4 ml-2 text-primary" />}
                                            </span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onSelect={() => onSelectLocale('en')} disabled={locale === 'en'}>
                                            <span className="flex items-center justify-between w-full font-medium">
                                                <div className="flex items-center gap-2"><UsFlagIcon className="h-4 w-4" />{t('english')}</div>
                                                {locale === 'en' && <Check className="h-4 w-4 ml-2 text-primary" />}
                                            </span>
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}

                            <HelpMenu />

                            <div className="h-6 w-px bg-border/50" />

                            <VoiceAssistant onAudioReady={handleAudioReady} isProcessing={isSending} />
                        </div>

                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsExpanded(false)}
                            className="rounded-full h-8 w-8 hover:bg-accent ml-1"
                        >
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </Button>
                    </div>
                )}
            </div>

            {/* ── Chat panel ─────────────────────────────────────────────── */}
            {isClient && isChatOpen && createPortal(
                <div className="fixed bottom-0 right-0 z-[9990] flex w-full justify-end p-0 sm:bottom-4 sm:right-4 sm:w-auto sm:p-0 pointer-events-none">
                    {isChatMinimized ? (
                        <div className="pointer-events-auto px-3 pb-3 sm:px-0 sm:pb-0">
                            <Button
                                type="button"
                                onClick={() => setIsChatMinimized(false)}
                                className="h-12 rounded-full px-4 shadow-2xl"
                                title={tFloating('restoreChat')}
                            >
                                <MessageSquare className="mr-2 h-4 w-4" />
                                {tFloating('chatbotTitle')}
                            </Button>
                        </div>
                    ) : (
                        <div className="pointer-events-auto w-full px-0 md:w-[24rem] lg:w-[26rem]">
                            <Card className="h-[60vh] w-full rounded-none border-primary/20 shadow-2xl overflow-hidden sm:rounded-2xl">
                                <CardHeader className="flex flex-row items-center justify-between p-4 border-b bg-primary text-primary-foreground shrink-0">
                                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                                        <MessageSquare className="h-4 w-4" />
                                        {tFloating('chatbotTitle')}
                                    </CardTitle>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => {
                                                setTtsEnabled((v) => {
                                                    if (v) window.speechSynthesis?.cancel();
                                                    return !v;
                                                });
                                            }}
                                            className="h-7 w-7 text-primary-foreground hover:bg-white/20"
                                            title={
                                                ttsEnabled
                                                    ? tChat('ttsDisable')
                                                    : tChat('ttsEnable')
                                            }
                                        >
                                            {ttsEnabled ? (
                                                <Volume2 className="h-4 w-4" />
                                            ) : (
                                                <VolumeX className="h-4 w-4" />
                                            )}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setIsChatMinimized(true)}
                                            className="h-7 w-7 text-primary-foreground hover:bg-white/20"
                                            title={tFloating('minimizeChat')}
                                        >
                                            <ChevronRight className="h-4 w-4 rotate-90" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={closeChatPanel}
                                            className="h-7 w-7 text-primary-foreground hover:bg-white/20"
                                            title={tFloating('closeChat')}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0 flex-1 overflow-hidden">
                                    <VoiceChat
                                        messages={chatMessages}
                                        onSendText={handleSendText}
                                        isSending={isSending}
                                    />
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </div>,
                document.body
            )}
        </>
    );
}
