'use client';

import { OpenCashSessionWidget } from '@/components/cash-session-widget';
import { WorkingSedeSelector } from '@/components/working-sede-selector';
import { TVDisplayWidget } from '@/components/tv-display-widget';
import { QuickPatientSearch } from '@/components/patients/QuickPatientSearch';
import { NotificationsBell } from '@/components/notifications/notifications-bell';
import { NotificationsPanel } from '@/components/notifications/notifications-panel';
import { Button } from '@/components/ui/button';
import { CASHIER_PERMISSIONS, GLOBAL_PERMISSIONS, PATIENTS_PERMISSIONS, SALES_PERMISSIONS, STICKY_NOTES_PERMISSIONS, TV_DISPLAY_PERMISSIONS } from '@/constants/permissions';
import { useAlertNotifications } from '@/context/alert-notifications-context';
import { useNotifications } from '@/context/notifications-context';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';
import { useBillingWizard } from '@/stores/billing-wizard-store';
import {
    Bell,
    ChevronLeft,
    ChevronRight,
    Inbox,
    StickyNote as StickyNoteIcon,
    Zap,
} from 'lucide-react';
import { useStickyNotes } from '@/hooks/use-sticky-notes';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import type { StickyNote } from '@/lib/types';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { createPortal } from 'react-dom';
import { AlertsWidget } from './alerts-widget';
import { ExchangeRate } from './exchange-rate';
import { StickyNotesOverlay } from './sticky-notes-overlay';
import { MascotPeekZone } from '@/components/invoke-mascot';
import { MascotWakeButton } from '@/components/help/mascot-wake-button';

// ── Deep-link helper ──────────────────────────────────────────────────────────

function StickyNotesDeepLink({ onOpen }: { onOpen: () => void }) {
    const searchParams = useSearchParams();
    React.useEffect(() => {
        if (searchParams.get('act') === 'Notes') onOpen();
    }, [searchParams, onOpen]);
    return null;
}

// ── Panel item: icon + label ──────────────────────────────────────────────────

function PanelItem({ label, helpId, children }: { label: string; helpId?: string; children: React.ReactNode }) {
    return (
        <div data-help-id={helpId} className="flex flex-col items-center gap-1 w-full px-1">
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
    const tStickyNotes = useTranslations('StickyNotes');
    const locale = useLocale();
    const { activeCashSession, user, sedes } = useAuth();
    const { pendingCount: alertCount, highestPriority } = useAlertNotifications();
    const { pendingCount: inboxCount, notifications } = useNotifications();
    const { hasPermission } = usePermissions();

    const { notes, isLoading: isLoadingNotes, fetchNotes, createNote, updateNote, deleteNote } = useStickyNotes();
    const { open: openBillingWizard } = useBillingWizard();

    const [isExpanded, setIsExpanded] = React.useState(true);
    // La barra mobile arranca cerrada: desplegada tapa la parte superior de la pantalla
    // en cada carga. Estado propio porque el riel de desktop sí arranca abierto.
    const [isMobileExpanded, setIsMobileExpanded] = React.useState(false);
    // 640px = el breakpoint `sm` con el que se alternan las dos ramas del panel. Sirve
    // para saber cuál de los dos estados es el que el usuario está viendo: de eso depende
    // marcar las novedades como vistas y hacer pulsar la pestaña colapsada.
    const isNarrowViewport = useViewportNarrow(640);
    const isPanelOpen = isNarrowViewport ? isMobileExpanded : isExpanded;
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

        if (isPanelOpen) {
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
    }, [alertCount, inboxCount, notes.length, isPanelOpen]);

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

    const openStickyNotes = React.useCallback(() => { setIsStickyNotesOpen(true); }, []);

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
                        data-help-id="rail.btn.expand"
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
                    <MascotPeekZone
                        edge="left"
                        name="right"
                        className="help-rail-zone"
                        // Escondite de la mascota: el riel tiene fondo opaco y nada lo recorta. El
                        // posicionamiento va acá (inline: el CSS de la mascota se carga después de Tailwind).
                        style={{ position: 'fixed', top: 0, bottom: 0, right: 0, width: '3.5rem', zIndex: 50 }}
                    >
                    <div data-help-rail data-help-id="rail.section.rail" className="flex h-full w-full flex-col items-center gap-2 pt-3 pb-3 bg-[hsl(var(--floating-header-bg))] border-l border-border shadow-[-2px_0_16px_rgba(0,0,0,0.08)] animate-in fade-in slide-in-from-right-4 duration-200 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

                            <Button
                                ref={toggleBtnRef}
                                variant="ghost"
                                size="icon"
                                data-help-id="rail.btn.collapse"
                                onClick={() => setIsExpanded(false)}
                                className="rounded-xl h-9 w-9 bg-muted/60 hover:bg-muted text-muted-foreground shrink-0"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>

                            {hasPermission(PATIENTS_PERMISSIONS.VIEW_LIST) && (
                                <PanelItem label="Paciente" helpId="rail.section.patient">
                                    <QuickPatientSearch />
                                </PanelItem>
                            )}

                            {sedes.length > 1 && (
                                <PanelItem label="Sede" helpId="rail.section.sede">
                                    <WorkingSedeSelector />
                                </PanelItem>
                            )}

                            {hasPermission(CASHIER_PERMISSIONS.VIEW_WIDGET) && (
                                <PanelItem label="Caja" helpId="rail.section.cash">
                                    <OpenCashSessionWidget />
                                </PanelItem>
                            )}

                            {hasPermission(TV_DISPLAY_PERMISSIONS.VIEW_MENU) && (
                                <PanelItem label="TV" helpId="rail.section.tv">
                                    <TVDisplayWidget />
                                </PanelItem>
                            )}

                            {hasPermission(SALES_PERMISSIONS.INVOICES_CREATE) && (
                                <PanelItem label="Cobrar" helpId="rail.section.bill">
                                    <Button
                                        data-help-id="rail.btn.bill"
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
                                <PanelItem label="Alertas" helpId="rail.section.alerts">
                                    <AlertsWidget />
                                </PanelItem>
                            </div>

                            {hasPermission(GLOBAL_PERMISSIONS.GLOBAL_VIEW_EXCHANGE_RATE) && activeCashSession && (
                                <PanelItem label="Cambio" helpId="rail.section.exchange">
                                    <ExchangeRate activeCashSession={activeCashSession} />
                                </PanelItem>
                            )}

                            <div ref={inboxIconRef} className="w-full">
                                <PanelItem label="Inbox" helpId="rail.section.inbox">
                                    <NotificationsBell variant="round" />
                                </PanelItem>
                            </div>

                            {hasPermission(STICKY_NOTES_PERMISSIONS.VIEW) && (
                                <div ref={notesIconRef} className="w-full">
                                <PanelItem label="Notas" helpId="rail.section.notes">
                                        <Button
                                            data-help-id="rail.btn.notes"
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

                            {/* Asistente escondido: la mascota dormida, un clic y se levanta. */}
                            <MascotWakeButton withDivider />

                        </div>
                    </MascotPeekZone>
                )}
            </div>

            {/* ── Mobile widget ─────────────────────────────────────────── */}
            <div className={cn(
                "sm:hidden fixed z-[50]",
                isMobileExpanded
                    ? "top-0 left-0 right-0 flex items-start"
                    : "top-0 right-0 flex items-start"
            )}>
                {!isMobileExpanded ? (
                    <button
                        type="button"
                        onClick={() => setIsMobileExpanded(true)}
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
                        'flex flex-row flex-wrap items-center justify-evenly px-1.5 py-2 gap-0.5',
                        'bg-[hsl(var(--floating-header-bg)/0.95)] backdrop-blur-md border-b border-border shadow-md w-full',
                        'animate-in fade-in slide-in-from-top-2 duration-200',
                    )}>
                        {hasPermission(PATIENTS_PERMISSIONS.VIEW_LIST) && <QuickPatientSearch />}
                        {sedes.length > 1 && <WorkingSedeSelector />}
                        <OpenCashSessionWidget />
                        {hasPermission(TV_DISPLAY_PERMISSIONS.VIEW_MENU) && <TVDisplayWidget />}

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

                        <MascotWakeButton compact />

                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsMobileExpanded(false)}
                            className="rounded-xl h-10 w-10 hover:bg-accent"
                        >
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </Button>
                    </div>
                )}
            </div>

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
