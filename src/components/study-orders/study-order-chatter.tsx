'use client';

import * as React from 'react';
import { AlertCircle, Bell, BellOff, Check, FileText, FlaskConical, Lock, MessageSquare, Paperclip, RefreshCw, StickyNote, UserPlus, Users, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';

import { OrderFileGallery } from './order-file-gallery';
import { ActorLabel, EVENT_STYLES, EventDetail, TONE_CLASSES } from './study-order-timeline';

import { useEventStreamSubscription } from '@/context/event-stream-context';
import { useAsyncAction, useKeyedAsyncAction } from '@/hooks/use-async-action';
import { useStudyOrderChatterSource, type StudyOrderChatterSource } from '@/hooks/use-study-order-chatter-source';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/error-utils';
import { cn, formatDate, formatDateTime, formatDisplayDate, toLocalISOString } from '@/lib/utils';
import { isAbortError } from '@/services/api';
import { isChatterMockStorageKey, resetChatterMock } from '@/services/study-order-chatter-mock';
import { STUDY_ORDER_MESSAGE_LIMITS } from '@/services/study-orders';
import type {
    StudyOrderChatter as ChatterData,
    StudyOrderEvent,
    StudyOrderFollower,
    StudyOrderFollowerAction,
    StudyOrderMessage,
    StudyOrderMessageKind,
    StudyOrderMessagePostResult,
} from '@/lib/types';

/**
 * Chatter de la orden, al estilo del de Odoo: arriba "Enviar mensaje" y "Registrar nota", los
 * seguidores y el botón Seguir; abajo el hilo, del más nuevo al más viejo, con los mensajes y la
 * bitácora (study_order_events) mezclados y agrupados por día.
 *
 *   · Mensaje: lo ven todos los que pueden abrir la orden y avisa a los seguidores.
 *   · Nota: interna de la clínica (STUDY_ORDERS_VIEW_ALL), sin aviso.
 *
 * Mensajes y notas pueden llevar fotos o PDF (clip, arrastrar o pegar): se ven con la misma
 * galería que los originales de la orden. Hace falta texto o al menos un archivo.
 *
 * Quien escribe pasa a seguir la orden. Lo que puede hacer cada uno lo dice el backend
 * (`can_post_*`), que es quien lo hace cumplir; acá además se exige STUDY_ORDERS_MESSAGE.
 *
 * Con NEXT_PUBLIC_STUDY_ORDER_CHATTER=mock (el valor por defecto mientras el backend no esté
 * desplegado) todo esto corre contra una demo en el navegador: ver study-order-chatter-mock.ts.
 *
 * Se refresca solo cuando llega por SSE el aviso de un mensaje nuevo de esta orden (le llega a
 * quien la sigue) y cuando el padre cambia `refreshKey` (se guardó algo de la orden).
 */

export interface StudyOrderChatterProps {
    orderId: string;
    /** Se incrementa desde afuera para recargar (la orden cambió). */
    refreshKey?: number;
    /**
     * `panel`: ocupa toda la altura con el hilo desplazable (columna lateral del asistente).
     * `embedded`: en flujo, el scroll lo pone el contenedor (pestaña del detalle).
     */
    variant?: 'panel' | 'embedded';
    /** Botón de cerrar en la cabecera (el panel lateral del asistente). */
    onClose?: () => void;
    /** Consulta desde la ficha de un paciente o doctor: se lee el hilo, sin escribir ni seguir. */
    readOnly?: boolean;
    className?: string;
}

type FeedEntry =
    | { kind: 'message'; id: string; createdAt: string; message: StudyOrderMessage }
    | { kind: 'event'; id: string; createdAt: string; event: StudyOrderEvent };

const MAX_BODY = STUDY_ORDER_MESSAGE_LIMITS.maxBody;
const ACCEPT = STUDY_ORDER_MESSAGE_LIMITS.mimeTypes.join(',');

/** Archivo elegido para el mensaje, todavía sin subir. */
interface PendingFile {
    id: string;
    file: File;
}

function formatSize(bytes: number): string {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Iniciales para el avatar: dos palabras, mayúsculas. */
const initials = (name: string | null | undefined) =>
    (name ?? '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';

/** Solo la hora: el día ya lo dice el separador del grupo. */
const timeOf = (iso: string) => formatDateTime(iso).slice(11);

export function StudyOrderChatter({
    orderId, refreshKey = 0, variant = 'panel', onClose, readOnly = false, className,
}: StudyOrderChatterProps) {
    const t = useTranslations('StudyOrdersPage.chatter');
    const source = useStudyOrderChatterSource();
    const isDemo = source.mode === 'mock';
    const canMessage = !readOnly && source.canMessage;

    const [data, setData] = React.useState<ChatterData | null>(null);
    /** null = sin error; '' = error sin mensaje del backend (se muestra el genérico). */
    const [loadError, setLoadError] = React.useState<string | null>(null);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const [reloadKey, setReloadKey] = React.useState(0);

    const [composer, setComposer] = React.useState<StudyOrderMessageKind | null>(null);
    const [body, setBody] = React.useState('');
    const [files, setFiles] = React.useState<PendingFile[]>([]);
    const [fileError, setFileError] = React.useState<string | null>(null);
    const [isDragging, setIsDragging] = React.useState(false);
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const clearDraft = React.useCallback(() => {
        setBody('');
        setFiles([]);
        setFileError(null);
    }, []);

    /** Orden en pantalla: recargar la misma no vuelve al esqueleto ni borra lo que se ve. */
    const loadedIdRef = React.useRef<string | null>(null);

    React.useEffect(() => {
        const controller = new AbortController();
        if (loadedIdRef.current !== orderId) {
            setData(null);
            setComposer(null);
            clearDraft();
        }
        setIsRefreshing(true);
        setLoadError(null);
        source.getChatter(orderId, controller.signal)
            .then((result) => {
                setData(result);
                loadedIdRef.current = orderId;
            })
            .catch((error) => {
                if (!isAbortError(error)) setLoadError(getErrorMessage(error));
            })
            .finally(() => {
                if (!controller.signal.aborted) setIsRefreshing(false);
            });
        // Una respuesta lenta de la orden anterior no pisa a la actual.
        return () => controller.abort();
    }, [orderId, refreshKey, reloadKey, source, clearDraft]);

    const reload = React.useCallback(() => setReloadKey((k) => k + 1), []);

    // Demo: lo que se escribe en otra pestaña del mismo navegador aparece acá.
    React.useEffect(() => {
        if (!isDemo) return;
        const onStorage = (e: StorageEvent) => {
            if (isChatterMockStorageKey(e.key, orderId)) reload();
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, [isDemo, orderId, reload]);

    const resetDemo = () => {
        resetChatterMock(orderId);
        setComposer(null);
        clearDraft();
        reload();
    };

    // Un mensaje nuevo de esta orden llega como notificación a quien la sigue: se recarga el hilo.
    useEventStreamSubscription(React.useCallback((eventType: string, payload: unknown) => {
        const row = payload as { type?: string; event_type?: string; metadata?: { order_id?: string } } | null;
        const type = eventType || row?.event_type || row?.type;
        if (type === 'study_order_message' || row?.type === 'study_order_message') {
            if (row?.metadata?.order_id === orderId) reload();
        }
    }, [orderId, reload]));

    const canPostMessage = canMessage && !!data?.can_post_message;
    const canPostNote = canMessage && !!data?.can_post_note;
    const canManageFollowers = canMessage && !!data?.can_manage_followers;

    // ── Publicar ─────────────────────────────────────────────────────────────
    const post = useAsyncAction(
        (kind: StudyOrderMessageKind, text: string, attached: File[]) =>
            source.postMessage({ orderId, kind, body: text, files: attached }),
        {
            onSuccess: async (result: StudyOrderMessagePostResult) => {
                clearDraft();
                setComposer(null);
                // El mensaje quedó, pero sin alguno de los archivos: que se sepa cuál falta volver a subir.
                const failed = result.failed_attachments ?? 0;
                if (failed > 0) {
                    toast({
                        variant: 'destructive',
                        title: t('attachments.partialTitle'),
                        description: t('attachments.partialDescription', { count: failed }),
                    });
                }
                // Sigue "enviando" hasta que el mensaje está en el hilo.
                const fresh = await source.getChatter(orderId).catch(() => null);
                if (fresh) setData(fresh);
                else reload();
            },
            errorTitle: t('postError'),
        },
    );

    const openComposer = (kind: StudyOrderMessageKind) => {
        // Mismo botón otra vez = cerrar, como en Odoo. Lo escrito se conserva al cambiar de modo.
        setComposer((current) => (current === kind ? null : kind));
    };

    React.useEffect(() => {
        if (composer) textareaRef.current?.focus();
    }, [composer]);

    // ── Adjuntos del redactor ────────────────────────────────────────────────
    /** Suma archivos (clip, arrastrar o pegar) respetando tipo, tamaño y cantidad. */
    const addFiles = React.useCallback((incoming: FileList | File[]) => {
        setFileError(null);
        const accepted: PendingFile[] = [];
        for (const file of Array.from(incoming)) {
            if (!(STUDY_ORDER_MESSAGE_LIMITS.mimeTypes as readonly string[]).includes(file.type)) {
                setFileError(t('attachments.errorFormat', { name: file.name }));
                continue;
            }
            if (file.size === 0 || file.size > STUDY_ORDER_MESSAGE_LIMITS.maxBytes) {
                setFileError(t('attachments.errorSize', { name: file.name }));
                continue;
            }
            accepted.push({ id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`, file });
        }
        const room = Math.max(0, STUDY_ORDER_MESSAGE_LIMITS.maxFiles - files.length);
        if (accepted.length > room) {
            setFileError(t('attachments.errorTooMany', { max: STUDY_ORDER_MESSAGE_LIMITS.maxFiles }));
        }
        const kept = accepted.slice(0, room);
        if (kept.length > 0) setFiles((prev) => [...prev, ...kept]);
    }, [t, files.length]);

    const removeFile = (id: string) => {
        setFiles((prev) => prev.filter((f) => f.id !== id));
        setFileError(null);
    };

    const trimmed = body.trim();
    const canSubmit = (!!trimmed || files.length > 0) && trimmed.length <= MAX_BODY;
    const submit = () => {
        if (!composer || !canSubmit) return;
        void post.run(composer, trimmed, files.map((f) => f.file));
    };

    // ── Seguidores ───────────────────────────────────────────────────────────
    const applyFollowers = React.useCallback((result: { followers: StudyOrderFollower[]; is_following: boolean }) => {
        setData((prev) => (prev ? { ...prev, followers: result.followers, is_following: result.is_following } : prev));
    }, []);

    /** Una acción por persona (o 'self' para seguir/dejar de seguir): cada fila se bloquea sola. */
    const followers = useKeyedAsyncAction(
        (action: StudyOrderFollowerAction, target?: StudyOrderFollower) => source.updateFollowers({ orderId, action, target }),
        { onSuccess: applyFollowers, errorTitle: t('followersError') },
    );

    // ── Hilo ─────────────────────────────────────────────────────────────────
    /** Mensajes y eventos en una sola lista, del más nuevo al más viejo, partida por día. */
    const groups = React.useMemo(() => {
        if (!data) return [];
        const entries: FeedEntry[] = [
            ...data.messages.map((message): FeedEntry => ({ kind: 'message', id: `m-${message.id}`, createdAt: message.created_at, message })),
            ...data.events.map((event): FeedEntry => ({ kind: 'event', id: `e-${event.id}`, createdAt: event.created_at, event })),
        ];
        // Las fechas vienen en el mismo formato (hora de Montevideo, sin zona): se comparan como texto.
        entries.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));

        const byDay: Array<{ day: string; entries: FeedEntry[] }> = [];
        for (const entry of entries) {
            const day = formatDate(entry.createdAt);
            const last = byDay[byDay.length - 1];
            if (last && last.day === day) last.entries.push(entry);
            else byDay.push({ day, entries: [entry] });
        }
        return byDay;
    }, [data]);

    const today = formatDate(toLocalISOString(new Date()));
    const dayLabel = (day: string, sample: string) => (day === today ? t('today') : formatDisplayDate(sample));

    const isPanel = variant === 'panel';
    const followerCount = data?.followers.length ?? 0;
    const notifyCount = (data?.followers ?? []).length - (data?.is_following ? 1 : 0);

    return (
        <section
            aria-label={t('title')}
            className={cn('flex min-h-0 flex-col', isPanel && 'h-full bg-card', className)}
        >
            {/* Barra de acciones */}
            <div className={cn('flex flex-none flex-wrap items-center gap-1.5', isPanel ? 'border-b px-3 py-2.5' : 'pb-3')}>
                {canPostMessage && (
                    <Button
                        type="button"
                        size="sm"
                        variant={composer === 'message' ? 'default' : 'outline'}
                        className="h-8 gap-1.5"
                        aria-pressed={composer === 'message'}
                        onClick={() => openComposer('message')}
                    >
                        <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                        {t('sendMessage')}
                    </Button>
                )}
                {canPostNote && (
                    <Button
                        type="button"
                        size="sm"
                        variant={composer === 'note' ? 'default' : 'outline'}
                        className="h-8 gap-1.5"
                        aria-pressed={composer === 'note'}
                        onClick={() => openComposer('note')}
                    >
                        <StickyNote className="h-3.5 w-3.5" aria-hidden="true" />
                        {t('logNote')}
                    </Button>
                )}

                <div className="ml-auto flex items-center gap-0.5">
                    {data && (
                        <FollowersPopover
                            orderId={orderId}
                            loadCandidates={source.getCandidates}
                            followers={data.followers}
                            canManage={canManageFollowers}
                            isPending={followers.isPending}
                            onRemove={(follower) => void followers.run(follower.id, 'remove', follower)}
                            onAdd={(follower) => followers.run(follower.id, 'add', follower)}
                        >
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 gap-1 px-2 text-muted-foreground hover:text-foreground"
                                title={t('followers.title')}
                                aria-label={t('followers.count', { count: followerCount })}
                            >
                                <Users className="h-4 w-4" aria-hidden="true" />
                                <span className="text-xs tabular-nums">{followerCount}</span>
                            </Button>
                        </FollowersPopover>
                    )}
                    {data && canPostMessage && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className={cn('group h-8 gap-1.5 px-2', data.is_following ? 'text-primary' : 'text-muted-foreground')}
                            loading={followers.isPending('self')}
                            onClick={() => void followers.run('self', data.is_following ? 'unfollow' : 'follow')}
                            title={data.is_following ? t('unfollowHint') : t('followHint')}
                        >
                            {data.is_following ? (
                                <>
                                    <Check className="h-3.5 w-3.5 group-hover:hidden" aria-hidden="true" />
                                    <BellOff className="hidden h-3.5 w-3.5 group-hover:inline" aria-hidden="true" />
                                    <span className="text-xs group-hover:hidden">{t('following')}</span>
                                    <span className="hidden text-xs group-hover:inline">{t('unfollow')}</span>
                                </>
                            ) : (
                                <>
                                    <Bell className="h-3.5 w-3.5" aria-hidden="true" />
                                    <span className="text-xs">{t('follow')}</span>
                                </>
                            )}
                        </Button>
                    )}
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={reload}
                        disabled={isRefreshing}
                        aria-label={t('refresh')}
                        title={t('refresh')}
                    >
                        <RefreshCw className={cn('h-4 w-4', isRefreshing && data && 'animate-spin')} aria-hidden="true" />
                    </Button>
                    {onClose && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={onClose}
                            aria-label={t('close')}
                            title={t('close')}
                        >
                            <X className="h-4 w-4" aria-hidden="true" />
                        </Button>
                    )}
                </div>
            </div>

            {/* Demo: que nadie confunda los datos de prueba con mensajes reales. */}
            {isDemo && (
                <div
                    className={cn(
                        'flex flex-none items-center gap-2 border-dashed border-amber-500/40 bg-amber-500/5 text-[11px] text-amber-800 dark:text-amber-300',
                        isPanel ? 'border-b px-3 py-1.5' : 'mb-3 rounded-md border px-2.5 py-1.5',
                    )}
                    role="note"
                >
                    <FlaskConical className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1">{t('demo.banner')}</span>
                    <button
                        type="button"
                        className="shrink-0 font-medium underline-offset-2 hover:underline disabled:opacity-50"
                        onClick={resetDemo}
                        disabled={isRefreshing || post.isPending}
                        title={t('demo.resetHint')}
                    >
                        {t('demo.reset')}
                    </button>
                </div>
            )}

            {/* Redactor */}
            {composer && (
                <div className={cn('flex-none', isPanel ? 'border-b px-3 py-3' : 'pb-4')}>
                    <div
                        className={cn(
                            'rounded-lg border p-2 transition-colors',
                            composer === 'note' ? 'border-amber-500/40 bg-amber-500/5' : 'bg-background',
                            isDragging && 'border-primary bg-primary/5',
                        )}
                        onDragOver={(e) => {
                            if (post.isPending || !e.dataTransfer.types.includes('Files')) return;
                            e.preventDefault();
                            setIsDragging(true);
                        }}
                        onDragLeave={(e) => {
                            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setIsDragging(false);
                        }}
                        onDrop={(e) => {
                            if (post.isPending || e.dataTransfer.files.length === 0) return;
                            e.preventDefault();
                            setIsDragging(false);
                            addFiles(e.dataTransfer.files);
                        }}
                    >
                        <Textarea
                            ref={textareaRef}
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            onKeyDown={(e) => {
                                // Ctrl/Cmd + Enter publica; Enter solo hace salto de línea.
                                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                    e.preventDefault();
                                    submit();
                                }
                            }}
                            onPaste={(e) => {
                                // Una captura pegada se adjunta; el texto pegado sigue yendo al cuadro.
                                const pasted = Array.from(e.clipboardData.files);
                                if (pasted.length === 0) return;
                                e.preventDefault();
                                addFiles(pasted);
                            }}
                            rows={3}
                            maxLength={MAX_BODY}
                            disabled={post.isPending}
                            placeholder={composer === 'note' ? t('notePlaceholder') : t('messagePlaceholder')}
                            aria-label={composer === 'note' ? t('logNote') : t('sendMessage')}
                            className="min-h-[72px] resize-y border-0 bg-transparent p-1 shadow-none focus-visible:ring-0"
                        />
                        {files.length > 0 && (
                            <ul className="flex flex-wrap gap-1.5 px-1 pb-2" aria-label={t('attachments.selected')}>
                                {files.map((f) => (
                                    <li
                                        key={f.id}
                                        className="flex max-w-full items-center gap-1.5 rounded-md border bg-muted/60 py-0.5 pl-2 pr-0.5 text-xs"
                                    >
                                        <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                                        <span className="min-w-0 max-w-[12rem] truncate" title={f.file.name}>{f.file.name}</span>
                                        <span className="shrink-0 text-[10px] text-muted-foreground">{formatSize(f.file.size)}</span>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-5 w-5 shrink-0 text-muted-foreground hover:text-destructive"
                                            disabled={post.isPending}
                                            onClick={() => removeFile(f.id)}
                                            aria-label={t('attachments.remove', { name: f.file.name })}
                                            title={t('attachments.remove', { name: f.file.name })}
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {fileError && (
                            <p className="px-1 pb-1 text-[11px] text-destructive" role="alert">{fileError}</p>
                        )}
                        <p className="px-1 pb-1 text-[11px] text-muted-foreground">
                            {composer === 'note'
                                ? t('noteHint')
                                : notifyCount > 0
                                    ? t('messageHint', { count: notifyCount })
                                    : t('messageHintNobody')}
                        </p>
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                size="sm"
                                className="h-8"
                                loading={post.isPending}
                                disabled={!canSubmit}
                                onClick={submit}
                            >
                                {composer === 'note' ? t('logNoteSubmit') : t('sendMessageSubmit')}
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-8"
                                disabled={post.isPending}
                                onClick={() => { setComposer(null); clearDraft(); }}
                            >
                                {t('discard')}
                            </Button>
                            <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                disabled={post.isPending || files.length >= STUDY_ORDER_MESSAGE_LIMITS.maxFiles}
                                onClick={() => fileInputRef.current?.click()}
                                aria-label={t('attachments.add')}
                                title={t('attachments.addHint', { max: STUDY_ORDER_MESSAGE_LIMITS.maxFiles })}
                            >
                                <Paperclip className="h-4 w-4" aria-hidden="true" />
                            </Button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept={ACCEPT}
                                multiple
                                className="hidden"
                                onChange={(e) => {
                                    if (e.target.files) addFiles(e.target.files);
                                    // Permite volver a elegir el mismo archivo después de quitarlo.
                                    e.target.value = '';
                                }}
                            />
                            <span className="ml-auto hidden text-[11px] text-muted-foreground sm:inline">{t('shortcut')}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Hilo */}
            <div className={cn(isPanel && 'min-h-0 flex-1 overflow-y-auto px-3 py-3')}>
                {!data && loadError === null && (
                    <div className="space-y-4" aria-busy="true">
                        {[0, 1, 2].map((i) => (
                            <div key={i} className="flex gap-2.5">
                                <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                                <div className="flex-1 space-y-1.5">
                                    <Skeleton className="h-3 w-32" />
                                    <Skeleton className="h-10 w-full" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {loadError !== null && (
                    <div className="flex flex-col items-center gap-3 py-8 text-center" role="alert">
                        <AlertCircle className="h-5 w-5 text-destructive" aria-hidden="true" />
                        <p className="text-sm text-muted-foreground">{loadError || t('loadError')}</p>
                        <Button type="button" size="sm" variant="outline" onClick={reload} loading={isRefreshing}>
                            {t('retry')}
                        </Button>
                    </div>
                )}

                {data && loadError === null && groups.length === 0 && (
                    <p className="py-8 text-center text-sm text-muted-foreground">{t('empty')}</p>
                )}

                {data && loadError === null && groups.map((group) => (
                    <div key={group.day} className="mb-2">
                        {/* Separador de día, como el de Odoo. */}
                        <div className="my-3 flex items-center gap-3 text-[11px] text-muted-foreground" role="separator">
                            <span className="h-px flex-1 bg-border" />
                            <span>{dayLabel(group.day, group.entries[0].createdAt)}</span>
                            <span className="h-px flex-1 bg-border" />
                        </div>
                        <ol className="space-y-3">
                            {group.entries.map((entry) => (
                                <li key={entry.id}>
                                    {entry.kind === 'message'
                                        ? <MessageEntry message={entry.message} attachmentLoader={source.attachmentLoader} />
                                        : <EventEntry event={entry.event} />}
                                </li>
                            ))}
                        </ol>
                    </div>
                ))}
            </div>
        </section>
    );
}

/** Mensaje o nota: avatar, autor, hora, el texto tal cual se escribió y sus adjuntos. */
function MessageEntry({ message, attachmentLoader }: {
    message: StudyOrderMessage;
    attachmentLoader: StudyOrderChatterSource['attachmentLoader'];
}) {
    const t = useTranslations('StudyOrdersPage.chatter');
    const isNote = message.kind === 'note';
    const attachments = message.attachments ?? [];

    return (
        <article className="flex gap-2.5">
            <span
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary"
                aria-hidden="true"
            >
                {initials(message.author_name)}
            </span>
            <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-1.5 text-xs">
                    <span className="font-semibold text-foreground">{message.author_name || t('unknownAuthor')}</span>
                    <time dateTime={message.created_at} title={formatDateTime(message.created_at)} className="text-muted-foreground">
                        {timeOf(message.created_at)}
                    </time>
                    {isNote && (
                        <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/15 px-1 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                            <Lock className="h-2.5 w-2.5" aria-hidden="true" />
                            {t('noteBadge')}
                        </span>
                    )}
                </p>
                {message.body && (
                    <div
                        className={cn(
                            'mt-1 whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm',
                            isNote ? 'border border-amber-500/30 bg-amber-500/5' : 'bg-muted/60',
                        )}
                    >
                        {message.body}
                    </div>
                )}
                {attachments.length > 0 && (
                    <MessageAttachments messageId={message.id} attachments={attachments} loader={attachmentLoader} />
                )}
            </div>
        </article>
    );
}

/** Fotos y PDF del mensaje, en la galería de la orden: miniaturas y visor con zoom. */
function MessageAttachments({ messageId, attachments, loader }: {
    messageId: string;
    attachments: NonNullable<StudyOrderMessage['attachments']>;
    loader: StudyOrderChatterSource['attachmentLoader'];
}) {
    const t = useTranslations('StudyOrdersPage.chatter.attachments');
    // La galería pide un cargador estable: uno por mensaje.
    const loadFile = React.useMemo(() => loader(messageId), [loader, messageId]);
    const files = React.useMemo(
        () => attachments.map((a) => ({ id: a.id, name: a.file_name, mimeType: a.mime_type })),
        [attachments],
    );

    return (
        <div className="mt-1.5">
            <OrderFileGallery files={files} loadFile={loadFile} label={t('count', { count: attachments.length })} />
        </div>
    );
}

/** Renglón de la bitácora: qué pasó, quién y cuándo, con el detalle (p. ej. "anterior → nuevo"). */
function EventEntry({ event }: { event: StudyOrderEvent }) {
    const t = useTranslations('StudyOrdersPage.timeline');
    // Un tipo que el front no conoce se dibuja igual, neutro y con su código (ver la línea de tiempo).
    const style = EVENT_STYLES[event.event_type];
    const Icon = style?.icon ?? MessageSquare;

    return (
        <div className="flex gap-2.5">
            <span
                className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-full ring-1', TONE_CLASSES[style?.tone ?? 'neutral'])}
                aria-hidden="true"
            >
                <Icon className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
                <p className="flex flex-wrap items-baseline gap-x-1.5 text-xs text-muted-foreground">
                    <ActorLabel event={event} />
                    <time dateTime={event.created_at} title={formatDateTime(event.created_at)}>{timeOf(event.created_at)}</time>
                </p>
                <p className="text-sm leading-snug">
                    {style ? t(`event.${event.event_type}` as never) : event.event_type}
                </p>
                <EventDetail event={event} />
            </div>
        </div>
    );
}

interface FollowersPopoverProps {
    orderId: string;
    loadCandidates: StudyOrderChatterSource['getCandidates'];
    followers: StudyOrderFollower[];
    canManage: boolean;
    isPending: (key: string) => boolean;
    onRemove: (follower: StudyOrderFollower) => void;
    onAdd: (follower: StudyOrderFollower) => Promise<unknown>;
    children: React.ReactNode;
}

/** Lista de seguidores; la clínica además suma y quita. Los candidatos se piden al abrir "Agregar". */
function FollowersPopover({ orderId, loadCandidates, followers, canManage, isPending, onRemove, onAdd, children }: FollowersPopoverProps) {
    const t = useTranslations('StudyOrdersPage.chatter.followers');
    const [open, setOpen] = React.useState(false);
    const [isAdding, setIsAdding] = React.useState(false);
    const [candidates, setCandidates] = React.useState<StudyOrderFollower[] | null>(null);
    const [candidatesError, setCandidatesError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!open) setIsAdding(false);
    }, [open]);

    React.useEffect(() => {
        if (!isAdding) return;
        const controller = new AbortController();
        setCandidates(null);
        setCandidatesError(null);
        loadCandidates(orderId, controller.signal)
            .then(setCandidates)
            .catch((error) => {
                if (!isAbortError(error)) setCandidatesError(getErrorMessage(error));
            });
        return () => controller.abort();
    }, [isAdding, orderId, loadCandidates]);

    const followerIds = React.useMemo(() => new Set(followers.map((f) => f.id)), [followers]);
    const available = (candidates ?? []).filter((c) => !followerIds.has(c.id));

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>{children}</PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-0">
                {isAdding ? (
                    <Command>
                        <CommandInput placeholder={t('searchPlaceholder')} autoFocus />
                        <CommandList>
                            {candidatesError !== null ? (
                                <p className="p-3 text-center text-xs text-destructive">{candidatesError || t('loadError')}</p>
                            ) : candidates === null ? (
                                <div className="space-y-2 p-3">
                                    <Skeleton className="h-4 w-full" />
                                    <Skeleton className="h-4 w-2/3" />
                                </div>
                            ) : (
                                <>
                                    <CommandEmpty>{t('noCandidates')}</CommandEmpty>
                                    <CommandGroup>
                                        {available.map((candidate) => (
                                            <CommandItem
                                                key={candidate.id}
                                                value={`${candidate.name} ${candidate.email ?? ''}`}
                                                disabled={isPending(candidate.id)}
                                                onSelect={() => {
                                                    void onAdd(candidate).then((result) => {
                                                        if (result) setIsAdding(false);
                                                    });
                                                }}
                                                className="gap-2"
                                            >
                                                <FollowerIdentity follower={candidate} />
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </>
                            )}
                        </CommandList>
                        <div className="border-t p-1">
                            <Button type="button" variant="ghost" size="sm" className="h-8 w-full" onClick={() => setIsAdding(false)}>
                                {t('back')}
                            </Button>
                        </div>
                    </Command>
                ) : (
                    <div>
                        <p className="border-b px-3 py-2 text-xs font-semibold">{t('title')}</p>
                        {followers.length === 0 ? (
                            <p className="px-3 py-4 text-center text-xs text-muted-foreground">{t('empty')}</p>
                        ) : (
                            <ul className="max-h-64 overflow-y-auto py-1">
                                {followers.map((follower) => (
                                    <li key={follower.id} className="flex items-center gap-2 px-3 py-1.5">
                                        <FollowerIdentity follower={follower} />
                                        {canManage && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="ml-auto h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                                                loading={isPending(follower.id)}
                                                onClick={() => onRemove(follower)}
                                                aria-label={t('remove', { name: follower.name })}
                                                title={t('remove', { name: follower.name })}
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </Button>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                        {canManage && (
                            <div className="border-t p-1">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-full justify-start gap-2"
                                    onClick={() => setIsAdding(true)}
                                >
                                    <UserPlus className="h-4 w-4" aria-hidden="true" />
                                    {t('add')}
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}

function FollowerIdentity({ follower }: { follower: StudyOrderFollower }) {
    return (
        <>
            <span
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary"
                aria-hidden="true"
            >
                {initials(follower.name)}
            </span>
            <span className="min-w-0">
                <span className="block truncate text-sm">{follower.name}</span>
                {follower.email && <span className="block truncate text-[11px] text-muted-foreground">{follower.email}</span>}
            </span>
        </>
    );
}

export default StudyOrderChatter;
