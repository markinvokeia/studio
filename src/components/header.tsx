'use client';

import { OpenCashSessionWidget } from '@/components/cash-session-widget';
import { TVDisplayWidget } from '@/components/tv-display-widget';
import { NotificationsBell } from '@/components/notifications/notifications-bell';
import { NotificationsPanel } from '@/components/notifications/notifications-panel';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CASHIER_PERMISSIONS, GLOBAL_PERMISSIONS, SALES_PERMISSIONS, STICKY_NOTES_PERMISSIONS } from '@/constants/permissions';
import { useAlertNotifications } from '@/context/alert-notifications-context';
import { useNotifications } from '@/context/notifications-context';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import { getApiUrl } from '@/lib/runtime-config';
import { cn } from '@/lib/utils';
import { useBillingWizard } from '@/stores/billing-wizard-store';
import {
    Bell,
    ChevronLeft,
    ChevronRight,
    Inbox,
    MessageSquare,
    StickyNote as StickyNoteIcon,
    Volume2,
    VolumeX,
    X,
    Zap,
} from 'lucide-react';
import { useStickyNotes } from '@/hooks/use-sticky-notes';
import type { StickyNote } from '@/lib/types';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { createPortal } from 'react-dom';
import { AlertsWidget } from './alerts-widget';
import { ExchangeRate } from './exchange-rate';
import { StickyNotesOverlay } from './sticky-notes-overlay';
import { VoiceAssistant } from './voice-assistant';
import { VoiceChat, type ChatMessage } from './voice-chat';

// ── Webhook URL ───────────────────────────────────────────────────────────────

const CHAT_WEBHOOK_URL =
    getApiUrl() +
    '/webhook/a8ad846b-de6a-4d89-8e02-01072101cfe6/chat';

// ── TTS ───────────────────────────────────────────────────────────────────────

const PREFERRED_VOICE_NAMES = [
    'Google español',
    'Microsoft Sabina',
    'Microsoft Helena',
    'Paulina',
    'Monica',
    'Jorge',
    'Diego',
];

function pickSpanishVoice(): Promise<SpeechSynthesisVoice | null> {
    return new Promise((resolve) => {
        const synth = window.speechSynthesis;

        const find = () => {
            const voices = synth.getVoices();
            if (voices.length === 0) return null;
            for (const name of PREFERRED_VOICE_NAMES) {
                const v = voices.find((v) => v.name.includes(name));
                if (v) return v;
            }
            const local = voices.find((v) => v.lang.startsWith('es') && v.localService);
            if (local) return local;
            return voices.find((v) => v.lang.startsWith('es')) ?? null;
        };

        const result = find();
        if (result) { resolve(result); return; }

        const onLoaded = () => {
            synth.removeEventListener('voiceschanged', onLoaded);
            resolve(find());
        };
        synth.addEventListener('voiceschanged', onLoaded);
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

// ── Deep-link helper ──────────────────────────────────────────────────────────

function StickyNotesDeepLink({ onOpen }: { onOpen: () => void }) {
    const searchParams = useSearchParams();
    React.useEffect(() => {
        if (searchParams.get('act') === 'Notes') onOpen();
    }, [searchParams, onOpen]);
    return null;
}

// ── Panel item: icon + label ──────────────────────────────────────────────────

function PanelItem({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col items-center gap-1 w-full px-1">
            {children}
            <span className="text-[7.5px] font-medium text-muted-foreground leading-none text-center tracking-tight select-none">
                {label}
            </span>
        </div>
    );
}

const PANEL_SEEN_KEY = 'widget-panel-seen';

// ── Peek icon for collapsed state ─────────────────────────────────────────────

type PeekItem = 'alerts' | 'inbox' | 'notes';

const PEEK_ICON: Record<PeekItem, React.ReactNode> = {
    alerts: <Bell className="h-3.5 w-3.5 text-red-500" />,
    inbox: <Inbox className="h-3.5 w-3.5 text-primary" />,
    notes: <StickyNoteIcon className="h-3.5 w-3.5 text-yellow-500" />,
};

// ─────────────────────────────────────────────────────────────────────────────

export function Header() {
    const pathname = usePathname();
    const tFloating = useTranslations('FloatingActions');
    const tChat = useTranslations('VoiceChat');
    const tStickyNotes = useTranslations('StickyNotes');
    const locale = useLocale();
    const router = useRouter();
    const { activeCashSession, user } = useAuth();
    const { pendingCount: alertCount, highestPriority } = useAlertNotifications();
    const { pendingCount: inboxCount, notifications } = useNotifications();
    const { hasPermission } = usePermissions();
    const { toast } = useToast();

    const { notes, isLoading: isLoadingNotes, fetchNotes, createNote, updateNote, deleteNote, prependNote } = useStickyNotes();
    const { open: openBillingWizard } = useBillingWizard();

    const [isExpanded, setIsExpanded] = React.useState(true);
    const [isChatOpen, setIsChatOpen] = React.useState(false);
    const [isChatMinimized, setIsChatMinimized] = React.useState(false);
    const [chatMessages, setChatMessages] = React.useState<ChatMessage[]>([]);
    const [isSending, setIsSending] = React.useState(false);
    const [ttsEnabled, setTtsEnabled] = React.useState(false);
    const [isClient, setIsClient] = React.useState(false);
    const [isStickyNotesOpen, setIsStickyNotesOpen] = React.useState(false);
    const [peekItem, setPeekItem] = React.useState<PeekItem | null>(null);
    const [shouldPulse, setShouldPulse] = React.useState(false);

    const [panelHint, setPanelHint] = React.useState<{
        label: string;
        colorClass: string;
        iconEl: React.ReactNode;
        top: number;
    } | null>(null);
    const [panelHintLeaving, setPanelHintLeaving] = React.useState(false);

    const sessionId = React.useRef(`sid-${Date.now()}`);
    // Tracks count at the previous render (to detect increases)
    const prevCountsRef = React.useRef({ alerts: 0, inbox: 0, notes: 0 });
    // Tracks what the user last saw when they opened the panel (persisted)
    const lastSeenRef = React.useRef({ alerts: 0, inbox: 0 });
    const panelHintTimerRef = React.useRef<ReturnType<typeof setTimeout>[]>([]);
    const hintInitializedRef = React.useRef(false);
    const prevHintCountsRef = React.useRef({ alerts: 0, inbox: 0, notes: 0 });
    const toggleBtnRef = React.useRef<HTMLButtonElement>(null);
    const alertsIconRef = React.useRef<HTMLDivElement>(null);
    const inboxIconRef = React.useRef<HTMLDivElement>(null);
    const notesIconRef = React.useRef<HTMLDivElement>(null);
    const isExpandedRef = React.useRef(isExpanded);

    React.useEffect(() => { setIsClient(true); }, []);

    React.useEffect(() => {
        isExpandedRef.current = isExpanded;
        document.documentElement.classList.toggle('widget-panel-open', isExpanded);
        return () => document.documentElement.classList.remove('widget-panel-open');
    }, [isExpanded]);
    React.useEffect(() => { fetchNotes(); }, [fetchNotes]);
    React.useEffect(() => { if (isStickyNotesOpen) fetchNotes(); }, [isStickyNotesOpen, fetchNotes]);

    // Read persisted last-seen counts on mount and compute initial pulse state
    React.useEffect(() => {
        try {
            const stored = JSON.parse(localStorage.getItem(PANEL_SEEN_KEY) || '{}');
            lastSeenRef.current = { alerts: stored.alerts ?? 0, inbox: stored.inbox ?? 0 };
        } catch { /* ignore */ }
    }, []);

    // Unified effect: detect new items while collapsed, save seen counts while open
    React.useEffect(() => {
        const prev = prevCountsRef.current;

        if (isExpanded) {
            // Panel is visible — mark everything as seen and stop pulsing
            lastSeenRef.current = { alerts: alertCount, inbox: inboxCount };
            try { localStorage.setItem(PANEL_SEEN_KEY, JSON.stringify(lastSeenRef.current)); } catch { /* ignore */ }
            setShouldPulse(false);
            setPeekItem(null);
        } else {
            // Panel is collapsed — fire peek/pulse only on increases
            if (alertCount > prev.alerts) {
                setShouldPulse(true);
                setPeekItem('alerts');
            } else if (inboxCount > prev.inbox) {
                setShouldPulse(true);
                setPeekItem('inbox');
            } else if (notes.length > prev.notes) {
                setPeekItem('notes');
            }
        }

        prevCountsRef.current = { alerts: alertCount, inbox: inboxCount, notes: notes.length };
    }, [alertCount, inboxCount, notes.length, isExpanded]);

    // Show floating hint when a new notification arrives while the panel is expanded
    React.useEffect(() => {
        // Skip first render — don't hint for pre-existing notifications
        if (!hintInitializedRef.current) {
            hintInitializedRef.current = true;
            prevHintCountsRef.current = { alerts: alertCount, inbox: inboxCount, notes: notes.length };
            return;
        }

        const prev = prevHintCountsRef.current;
        prevHintCountsRef.current = { alerts: alertCount, inbox: inboxCount, notes: notes.length };

        const triggerHint = (
            label: string,
            colorClass: string,
            iconEl: React.ReactNode,
            iconRef: React.RefObject<HTMLDivElement | null>,
        ) => {
            panelHintTimerRef.current.forEach(clearTimeout);
            panelHintTimerRef.current = [];
            setPanelHintLeaving(false);
            // When expanded use the specific icon ref; when collapsed use the toggle tab ref
            const sourceEl = isExpandedRef.current ? iconRef.current : toggleBtnRef.current;
            const rect = sourceEl?.getBoundingClientRect();
            const top = rect ? rect.top + rect.height / 2 : 32;
            setPanelHint({ label, colorClass, iconEl, top });
            panelHintTimerRef.current.push(
                setTimeout(() => setPanelHintLeaving(true), 4700),
                setTimeout(() => { setPanelHint(null); setPanelHintLeaving(false); }, 5000),
            );
        };

        if (alertCount > prev.alerts) {
            const pl: Record<string, string> = { CRITICAL: 'crítica', HIGH: 'alta', MEDIUM: 'media', LOW: 'baja' };
            triggerHint(
                `Nueva alerta · prioridad ${pl[highestPriority] ?? highestPriority}`,
                'bg-card border-red-400 text-red-700 dark:text-red-300 shadow-lg',
                <Bell className="h-3.5 w-3.5 text-red-500 shrink-0" />,
                alertsIconRef,
            );
        } else if (inboxCount > prev.inbox) {
            const latest = notifications.find((n) => !n.seen);
            let label = 'Nueva notificación';
            if (latest) {
                if (latest.type === 'new_appointment') label = `Nuevo turno · ${latest.appointment.patientName}`;
                else if (latest.type === 'appointment_status_change') label = `${latest.appointment.patientName} · estado actualizado`;
                else if (latest.type === 'session_completed') label = `Sesión completada · ${latest.appointment.patientName}`;
                else if (latest.type === 'reminder') label = latest.reminder.title;
            }
            triggerHint(
                label,
                'bg-card border-primary/60 text-foreground shadow-lg',
                <Inbox className="h-3.5 w-3.5 text-primary shrink-0" />,
                inboxIconRef,
            );
        } else if (notes.length > prev.notes) {
            const note = notes[0];
            const raw = note?.text ?? 'Nueva nota';
            const label = raw.length > 40 ? raw.slice(0, 40) + '…' : raw;
            triggerHint(
                label,
                'bg-card border-yellow-400 text-foreground shadow-lg',
                <StickyNoteIcon className="h-3.5 w-3.5 text-yellow-500 shrink-0" />,
                notesIconRef,
            );
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [alertCount, inboxCount, notes.length]);

    React.useEffect(() => {
        return () => { panelHintTimerRef.current.forEach(clearTimeout); };
    }, []);

    const openChatPanel = React.useCallback(() => {
        setIsChatOpen(true);
        setIsChatMinimized(false);
    }, []);

    const openStickyNotes = React.useCallback(() => { setIsStickyNotesOpen(true); }, []);
    const closeChatPanel = React.useCallback(() => { setIsChatOpen(false); setIsChatMinimized(false); }, []);

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
                    if (typeof data.redirect === 'string' && data.redirect) redirect = data.redirect;
                    if (data.openStickyNotes === true) setIsStickyNotesOpen(true);
                    if (data.note && typeof (data.note as Record<string, unknown>).id === 'string') {
                        prependNote(data.note as StickyNote);
                    }
                } catch {
                    reply = await response.text();
                }

                if (reply) {
                    setChatMessages((prev) => [
                        ...prev,
                        { id: `${Date.now()}-ai`, role: 'assistant', content: reply, timestamp: new Date() },
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
        [tChat, toast, ttsEnabled, locale, router, user, prependNote],
    );

    const handleAudioReady = React.useCallback(
        (blob: Blob) => {
            openChatPanel();
            setChatMessages((prev) => [
                ...prev,
                { id: `${Date.now()}-user`, role: 'user', content: tChat('voiceMessage'), isVoice: true, timestamp: new Date() },
            ]);
            sendToWebhook(tChat('voiceMessage'), blob);
        },
        [openChatPanel, sendToWebhook, tChat],
    );

    const handleSendText = React.useCallback(
        (text: string) => {
            setChatMessages((prev) => [
                ...prev,
                { id: `${Date.now()}-user`, role: 'user', content: text, timestamp: new Date() },
            ]);
            sendToWebhook(text);
        },
        [sendToWebhook],
    );

    // ─────────────────────────────────────────────────────────────────────────

    return (
        <>
            {/* ── Desktop widget: Google-style vertical right panel ─────── */}
            <div className="hidden sm:block">
                {!isExpanded ? (
                    /* Collapsed tab — fixed to top-right corner */
                    <button
                        ref={toggleBtnRef}
                        type="button"
                        onClick={() => { setIsExpanded(true); setShouldPulse(false); setPeekItem(null); }}
                        className={cn(
                            'fixed top-3 right-0 z-[50]',
                            'flex flex-col items-center gap-1 pt-2 pb-1.5 min-h-14 w-6 rounded-l-xl',
                            'bg-[hsl(var(--floating-header-bg)/0.92)] backdrop-blur-md',
                            'border border-r-0 border-border shadow-lg',
                            'hover:bg-[hsl(var(--floating-header-bg))] hover:w-7 transition-all duration-200',
                            shouldPulse && 'animate-tab-alert',
                        )}
                        aria-label={tFloating('openMenu')}
                    >
                        <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        {peekItem && (
                            <div className="animate-peek-icon shrink-0">
                                {PEEK_ICON[peekItem]}
                            </div>
                        )}
                    </button>
                ) : (
                    /* Expanded: vertical strip */
                    <div className="fixed inset-y-0 right-0 z-[50] flex flex-col items-center gap-2 pt-3 pb-3 w-14 bg-[hsl(var(--floating-header-bg)/0.97)] backdrop-blur-md border-l border-border shadow-[-2px_0_16px_rgba(0,0,0,0.08)] animate-in fade-in slide-in-from-right-4 duration-200 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

                        <Button
                            ref={toggleBtnRef}
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsExpanded(false)}
                            className="rounded-xl h-9 w-9 bg-muted/60 hover:bg-muted text-muted-foreground shrink-0"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>

                        {hasPermission(CASHIER_PERMISSIONS.VIEW_WIDGET) && (
                            <PanelItem label="Caja">
                                <OpenCashSessionWidget />
                            </PanelItem>
                        )}

                        <PanelItem label="TV">
                            <TVDisplayWidget />
                        </PanelItem>

                        {hasPermission(SALES_PERMISSIONS.INVOICES_CREATE) && (
                            <PanelItem label="Cobrar">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openBillingWizard({})}
                                    className="rounded-xl h-10 w-10 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
                                    title="Cobro Rápido"
                                >
                                    <Zap className="h-5 w-5" />
                                </Button>
                            </PanelItem>
                        )}

                        <div className="w-8 h-px bg-border/50 my-1.5 shrink-0" />

                        <div ref={alertsIconRef} className="w-full">
                            <PanelItem label="Alertas">
                                <AlertsWidget />
                            </PanelItem>
                        </div>

                        {hasPermission(GLOBAL_PERMISSIONS.GLOBAL_VIEW_EXCHANGE_RATE) && activeCashSession && (
                            <PanelItem label="Cambio">
                                <ExchangeRate activeCashSession={activeCashSession} />
                            </PanelItem>
                        )}

                        <div ref={inboxIconRef} className="w-full">
                            <PanelItem label="Inbox">
                                <NotificationsBell variant="round" />
                            </PanelItem>
                        </div>

                        {hasPermission(STICKY_NOTES_PERMISSIONS.VIEW) && (
                            <div ref={notesIconRef} className="w-full">
                            <PanelItem label="Notas">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setIsStickyNotesOpen(true)}
                                        className={cn(
                                            'relative rounded-xl h-10 w-10',
                                            notes.length > 0
                                                ? 'bg-yellow-400/20 text-yellow-500'
                                                : 'bg-muted/60 text-muted-foreground',
                                        )}
                                        title={tStickyNotes('openNotes')}
                                    >
                                        <StickyNoteIcon className={cn('h-5 w-5', notes.length > 0 ? 'text-yellow-500' : 'text-muted-foreground')} />
                                        {notes.length > 0 && (
                                            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white bg-yellow-500 ring-2 ring-background">
                                                {notes.length > 99 ? '99+' : notes.length}
                                            </span>
                                        )}
                                    </Button>
                                </PanelItem>
                            </div>
                        )}

                        <div className="w-8 h-px bg-border/50 my-1.5 shrink-0" />

                        <PanelItem label="Chat">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={openChatPanel}
                                className={cn(
                                    'rounded-xl h-10 w-10',
                                    isChatOpen ? 'bg-primary/10 text-primary' : 'bg-muted/60 text-muted-foreground',
                                )}
                                title={tFloating('openChat')}
                            >
                                <MessageSquare className="h-5 w-5" />
                            </Button>
                        </PanelItem>

                        <PanelItem label="Voz">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setTtsEnabled((v) => !v)}
                                className={cn(
                                    'rounded-xl h-10 w-10',
                                    ttsEnabled ? 'bg-primary/10 text-primary' : 'bg-muted/60 text-muted-foreground',
                                )}
                                title={ttsEnabled ? tChat('ttsDisable') : tChat('ttsEnable')}
                            >
                                {ttsEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
                            </Button>
                        </PanelItem>

                        <PanelItem label="Mic">
                            <VoiceAssistant onAudioReady={handleAudioReady} isProcessing={isSending} />
                        </PanelItem>

                    </div>
                )}
            </div>

            {/* ── Mobile widget ─────────────────────────────────────────── */}
            <div className={cn(
                "sm:hidden fixed z-[50]",
                isExpanded
                    ? "top-0 left-0 right-0 flex items-start"
                    : "top-0 right-0 flex items-start"
            )}>
                {!isExpanded ? (
                    <button
                        type="button"
                        onClick={() => setIsExpanded(true)}
                        className={cn(
                            "h-12 w-12 flex items-center justify-center border-l border-b border-[var(--nav-border)] bg-[var(--nav-active-bg)] hover:bg-[var(--nav-hover-bg)] transition-colors",
                            shouldPulse && 'animate-tab-alert',
                        )}
                        aria-label={tFloating('openMenu')}
                    >
                        <ChevronLeft className="h-4 w-4 text-foreground" />
                    </button>
                ) : (
                    <div className={cn(
                        'flex flex-row items-center justify-evenly px-3 py-2 gap-1',
                        'bg-[hsl(var(--floating-header-bg)/0.95)] backdrop-blur-md border-b border-border shadow-md w-full',
                        'animate-in fade-in slide-in-from-top-2 duration-200',
                    )}>
                        <OpenCashSessionWidget />
                        <TVDisplayWidget />

                        {hasPermission(SALES_PERMISSIONS.INVOICES_CREATE) && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openBillingWizard({})}
                                className="rounded-xl h-10 w-10 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
                                title="Cobro Rápido"
                            >
                                <Zap className="h-5 w-5" />
                            </Button>
                        )}

                        {hasPermission(GLOBAL_PERMISSIONS.GLOBAL_VIEW_NOTIFICATIONS_BADGE) && (
                            <Link href={`/${locale}/alerts`} passHref>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className={cn('relative rounded-xl h-10 w-10', alertCount > 0 && 'bg-red-500/10 text-red-600')}
                                >
                                    <Bell className="h-5 w-5" />
                                    {alertCount > 0 && (
                                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white bg-red-600 ring-2 ring-background">
                                            {alertCount > 99 ? '99+' : alertCount}
                                        </span>
                                    )}
                                </Button>
                            </Link>
                        )}

                        <NotificationsBell variant="square" />

                        {hasPermission(STICKY_NOTES_PERMISSIONS.VIEW) && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setIsStickyNotesOpen(true)}
                                className={cn('relative rounded-xl h-10 w-10', notes.length > 0 && 'bg-yellow-400/20 text-yellow-500')}
                                title={tStickyNotes('openNotes')}
                            >
                                <StickyNoteIcon className={cn('h-5 w-5', notes.length > 0 ? 'text-yellow-500' : 'text-muted-foreground')} />
                                {notes.length > 0 && (
                                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white bg-yellow-500 ring-2 ring-background">
                                        {notes.length > 99 ? '99+' : notes.length}
                                    </span>
                                )}
                            </Button>
                        )}

                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={openChatPanel}
                            className="rounded-xl h-10 w-10"
                        >
                            <MessageSquare className="h-5 w-5 text-muted-foreground" />
                        </Button>

                        <VoiceAssistant onAudioReady={handleAudioReady} isProcessing={isSending} />

                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsExpanded(false)}
                            className="rounded-xl h-10 w-10 hover:bg-accent"
                        >
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </Button>
                    </div>
                )}
            </div>

            {/* ── Chat panel ─────────────────────────────────────────────── */}
            {isClient && isChatOpen && createPortal(
                <div className="fixed bottom-0 right-0 z-[9990] flex w-full justify-end p-0 sm:bottom-4 sm:right-16 sm:w-auto sm:p-0 pointer-events-none">
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

            {/* ── Sticky notes overlay ────────────────────────────────────── */}
            {isClient && (
                <React.Suspense fallback={null}>
                    <StickyNotesDeepLink onOpen={openStickyNotes} />
                </React.Suspense>
            )}
            {isClient && isStickyNotesOpen && createPortal(
                <StickyNotesOverlay
                    isOpen={isStickyNotesOpen}
                    onClose={() => setIsStickyNotesOpen(false)}
                    userId={user?.id ?? ''}
                    notes={notes}
                    isLoading={isLoadingNotes}
                    createNote={createNote}
                    updateNote={updateNote}
                    deleteNote={deleteNote}
                />,
                document.body,
            )}

            {/* ── Notifications panel ─────────────────────────────────────── */}
            {isClient && <NotificationsPanel />}

            {/* ── Panel hint: slides in from the right when a new notification arrives ── */}
            {isClient && panelHint && createPortal(
                <div
                    style={{ top: panelHint.top, right: isExpanded ? '3.75rem' : '1.75rem' }}
                    className="fixed z-[49] -translate-y-1/2 pointer-events-none"
                >
                    <div className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-xl border shadow-md',
                        'text-xs font-medium max-w-[240px]',
                        panelHint.colorClass,
                        panelHintLeaving ? 'panel-hint-exit' : 'panel-hint-enter',
                    )}>
                        {panelHint.iconEl}
                        <span className="truncate">{panelHint.label}</span>
                    </div>
                </div>,
                document.body,
            )}
        </>
    );
}
