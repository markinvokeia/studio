'use client';

import { Loader2, Mic, MicOff, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { StickyNote, StickyNoteColor } from '@/lib/types';

// ── Web Speech API types ──────────────────────────────────────────────────────
interface ISpeechRecognitionEvent extends Event {
    readonly resultIndex: number;
    readonly results: SpeechRecognitionResultList;
}
interface ISpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onresult: ((this: ISpeechRecognition, ev: ISpeechRecognitionEvent) => void) | null;
    onerror: ((this: ISpeechRecognition, ev: Event) => void) | null;
    onend: ((this: ISpeechRecognition, ev: Event) => void) | null;
    start(): void;
    stop(): void;
    abort(): void;
}
interface ISpeechRecognitionConstructor {
    new (): ISpeechRecognition;
}
declare const SpeechRecognition: ISpeechRecognitionConstructor | undefined;
declare const webkitSpeechRecognition: ISpeechRecognitionConstructor | undefined;

// ── Color palette ─────────────────────────────────────────────────────────────
const STICKY_COLORS: Record<StickyNoteColor, { bg: string; border: string; dot: string; textarea: string }> = {
    yellow: { bg: 'bg-yellow-50 dark:bg-yellow-950', border: 'border-yellow-200 dark:border-yellow-800', dot: 'bg-yellow-400', textarea: 'bg-yellow-50 dark:bg-yellow-950' },
    pink:   { bg: 'bg-pink-50 dark:bg-pink-950',     border: 'border-pink-200 dark:border-pink-800',     dot: 'bg-pink-400',   textarea: 'bg-pink-50 dark:bg-pink-950' },
    blue:   { bg: 'bg-blue-50 dark:bg-blue-950',     border: 'border-blue-200 dark:border-blue-800',     dot: 'bg-blue-400',   textarea: 'bg-blue-50 dark:bg-blue-950' },
    green:  { bg: 'bg-green-50 dark:bg-green-950',   border: 'border-green-200 dark:border-green-800',   dot: 'bg-green-400',  textarea: 'bg-green-50 dark:bg-green-950' },
    purple: { bg: 'bg-purple-50 dark:bg-purple-950', border: 'border-purple-200 dark:border-purple-800', dot: 'bg-purple-400', textarea: 'bg-purple-50 dark:bg-purple-950' },
    orange: { bg: 'bg-orange-50 dark:bg-orange-950', border: 'border-orange-200 dark:border-orange-800', dot: 'bg-orange-400', textarea: 'bg-orange-50 dark:bg-orange-950' },
};

const ALL_COLORS = Object.keys(STICKY_COLORS) as StickyNoteColor[];
const STOP_WORDS = ['enviar', 'listo', 'done', 'send'];
const DEFAULT_COLOR: StickyNoteColor = 'yellow';

// ── Color picker ──────────────────────────────────────────────────────────────
function ColorPicker({
    value,
    onChange,
}: {
    value: StickyNoteColor;
    onChange: (c: StickyNoteColor) => void;
}) {
    return (
        <div className="flex gap-1.5">
            {ALL_COLORS.map((c) => (
                <button
                    key={c}
                    type="button"
                    onClick={() => onChange(c)}
                    className={cn(
                        'h-5 w-5 rounded-full transition-transform hover:scale-110',
                        STICKY_COLORS[c].dot,
                        value === c && 'ring-2 ring-offset-1 ring-foreground/40 scale-110',
                    )}
                />
            ))}
        </div>
    );
}

// ── New note card ─────────────────────────────────────────────────────────────
type NewNoteState = 'idle' | 'active-listening' | 'active-text';

interface NewNoteCardProps {
    userId: string;
    onCreate: (p: { text: string; color: string; created_by: string }) => Promise<StickyNote | null>;
    tNewNote: string;
    tSave: string;
    tCancel: string;
    tListening: string;
    tStartListening: string;
    tStopListening: string;
    tMicError: string;
    tSaveError: string;
}

function NewNoteCard({
    userId,
    onCreate,
    tNewNote,
    tSave,
    tCancel,
    tListening,
    tStartListening,
    tStopListening,
    tMicError,
    tSaveError,
}: NewNoteCardProps) {
    const { toast } = useToast();
    const [state, setState] = React.useState<NewNoteState>('idle');
    const [text, setText] = React.useState('');
    const [color, setColor] = React.useState<StickyNoteColor>(DEFAULT_COLOR);
    const [isSaving, setIsSaving] = React.useState(false);
    const recognitionRef = React.useRef<ISpeechRecognition | null>(null);
    const restartCountRef = React.useRef(0);
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    const getSpeechRecognition = (): ISpeechRecognitionConstructor | null => {
        if (typeof window === 'undefined') return null;
        return (
            (typeof SpeechRecognition !== 'undefined' ? SpeechRecognition : null) ??
            (typeof webkitSpeechRecognition !== 'undefined' ? webkitSpeechRecognition : null) ??
            null
        );
    };

    const stopRecognition = React.useCallback(() => {
        if (recognitionRef.current) {
            recognitionRef.current.abort();
            recognitionRef.current = null;
        }
    }, []);

    const startRecognition = React.useCallback(() => {
        const SR = getSpeechRecognition();
        if (!SR) return false;

        // Ask the voice assistant to release the mic before starting
        window.dispatchEvent(new CustomEvent('sticky-notes:mic-request'));

        const recognition = new SR();
        recognition.lang = 'es-ES';
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event: ISpeechRecognitionEvent) => {
            let transcript = '';
            for (let i = 0; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
            }
            setText(transcript);

            const lower = transcript.toLowerCase();
            if (STOP_WORDS.some((w) => lower.includes(w))) {
                const cleaned = STOP_WORDS.reduce(
                    (t, w) => t.replace(new RegExp(w, 'gi'), '').trim(),
                    transcript,
                );
                setText(cleaned);
                stopRecognition();
                setState('active-text');
            }
        };

        recognition.onerror = () => {
            stopRecognition();
            setState('active-text');
            toast({ title: tMicError, variant: 'destructive', duration: 3000 });
        };

        recognition.onend = () => {
            if (state === 'active-listening' && restartCountRef.current < 2) {
                restartCountRef.current += 1;
                try { recognition.start(); } catch { setState('active-text'); }
            } else {
                setState((s) => (s === 'active-listening' ? 'active-text' : s));
            }
        };

        recognitionRef.current = recognition;
        try {
            recognition.start();
            return true;
        } catch {
            recognitionRef.current = null;
            return false;
        }
    }, [state, stopRecognition, tMicError, toast]);

    const handleActivate = React.useCallback(() => {
        restartCountRef.current = 0;
        const started = startRecognition();
        setState(started ? 'active-listening' : 'active-text');
        setTimeout(() => textareaRef.current?.focus(), 50);
    }, [startRecognition]);

    const handleMicToggle = React.useCallback(() => {
        if (state === 'active-listening') {
            stopRecognition();
            setState('active-text');
        } else {
            restartCountRef.current = 0;
            const started = startRecognition();
            if (started) setState('active-listening');
        }
    }, [state, stopRecognition, startRecognition]);

    const handleSave = React.useCallback(async () => {
        const trimmed = text.trim();
        if (!trimmed) return;
        stopRecognition();
        setIsSaving(true);
        try {
            await onCreate({ text: trimmed, color, created_by: userId });
            setText('');
            setColor(DEFAULT_COLOR);
            setState('idle');
        } catch {
            toast({ title: tSaveError, variant: 'destructive', duration: 3000 });
        } finally {
            setIsSaving(false);
        }
    }, [text, color, userId, onCreate, stopRecognition, toast, tSaveError]);

    const handleCancel = React.useCallback(() => {
        stopRecognition();
        setText('');
        setColor(DEFAULT_COLOR);
        setState('idle');
    }, [stopRecognition]);

    React.useEffect(() => {
        return () => {
            stopRecognition();
            // Tell the voice assistant it can reclaim the mic
            window.dispatchEvent(new CustomEvent('sticky-notes:mic-release'));
        };
    }, [stopRecognition]);

    const hasMic = typeof window !== 'undefined' && !!(
        (typeof SpeechRecognition !== 'undefined') ||
        (typeof webkitSpeechRecognition !== 'undefined')
    );

    if (state === 'idle') {
        return (
            <button
                type="button"
                onClick={handleActivate}
                className={cn(
                    'w-56 min-h-40 rounded-xl border border-dashed border-border bg-muted/40 flex flex-col items-center justify-center gap-2',
                    'hover:bg-muted/70 hover:border-border/80 transition-colors group',
                )}
            >
                <div className="h-10 w-10 rounded-full bg-background border border-border flex items-center justify-center group-hover:bg-primary/10 group-hover:border-primary/30 transition-colors">
                    <Plus className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors font-medium">
                    {tNewNote}
                </span>
            </button>
        );
    }

    const colors = STICKY_COLORS[color];

    return (
        <div
            className={cn(
                'w-56 min-h-40 rounded-xl border shadow-sm flex flex-col p-3 gap-2',
                colors.bg,
                colors.border,
            )}
            onClick={(e) => e.stopPropagation()}
        >
            <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={tNewNote + '...'}
                className={cn(
                    'flex-1 min-h-20 resize-none text-sm leading-relaxed bg-transparent border-none outline-none placeholder:text-foreground/40',
                    colors.textarea,
                )}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        handleSave();
                    }
                    if (e.key === 'Escape') {
                        e.preventDefault();
                        handleCancel();
                    }
                }}
            />

            <div className="flex items-center justify-between gap-1">
                <ColorPicker value={color} onChange={setColor} />
                {hasMic && (
                    <button
                        type="button"
                        onClick={handleMicToggle}
                        className={cn(
                            'relative flex items-center justify-center h-7 w-7 rounded-full transition-colors',
                            state === 'active-listening'
                                ? 'text-red-500'
                                : 'text-muted-foreground hover:text-foreground',
                        )}
                        title={state === 'active-listening' ? tStopListening : tStartListening}
                    >
                        {state === 'active-listening' && (
                            <span className="absolute inset-0 rounded-full border border-red-400 animate-ping opacity-60" />
                        )}
                        {state === 'active-listening' ? (
                            <Mic className="h-3.5 w-3.5 relative z-10" />
                        ) : (
                            <MicOff className="h-3.5 w-3.5" />
                        )}
                    </button>
                )}
            </div>

            {state === 'active-listening' && (
                <p className="text-[11px] text-red-500 font-medium -mt-1">{tListening}</p>
            )}

            <div className="flex gap-1.5 justify-end">
                <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={handleCancel}
                    disabled={isSaving}
                >
                    {tCancel}
                </Button>
                <Button
                    size="sm"
                    className="h-7 px-3 text-xs"
                    onClick={handleSave}
                    disabled={!text.trim() || isSaving}
                >
                    {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : tSave}
                </Button>
            </div>
        </div>
    );
}

// ── Existing note card ────────────────────────────────────────────────────────
interface ExistingNoteCardProps {
    note: StickyNote;
    onUpdate: (p: { id: string; text: string; color: string }) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    tEdit: string;
    tDelete: string;
    tSave: string;
    tCancel: string;
    tDeleteError: string;
    tSaveError: string;
}

function ExistingNoteCard({
    note,
    onUpdate,
    onDelete,
    tEdit,
    tDelete,
    tSave,
    tCancel,
    tDeleteError,
    tSaveError,
}: ExistingNoteCardProps) {
    const { toast } = useToast();
    const [isEditing, setIsEditing] = React.useState(false);
    const [editText, setEditText] = React.useState(note.text);
    const [editColor, setEditColor] = React.useState<StickyNoteColor>(note.color);
    const [isSaving, setIsSaving] = React.useState(false);
    const [isDeleting, setIsDeleting] = React.useState(false);

    const colors = STICKY_COLORS[isEditing ? editColor : note.color];

    const formattedDate = React.useMemo(() => {
        try {
            return new Date(note.created_at).toLocaleDateString('es', {
                day: '2-digit',
                month: 'short',
            });
        } catch {
            return '';
        }
    }, [note.created_at]);

    const handleSave = async () => {
        const trimmed = editText.trim();
        if (!trimmed) return;
        setIsSaving(true);
        try {
            await onUpdate({ id: note.id, text: trimmed, color: editColor });
            setIsEditing(false);
        } catch {
            toast({ title: tSaveError, variant: 'destructive', duration: 3000 });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            await onDelete(note.id);
        } catch {
            setIsDeleting(false);
            toast({ title: tDeleteError, variant: 'destructive', duration: 3000 });
        }
    };

    const handleEditStart = () => {
        setEditText(note.text);
        setEditColor(note.color);
        setIsEditing(true);
    };

    const handleCancel = () => {
        setEditText(note.text);
        setEditColor(note.color);
        setIsEditing(false);
    };

    return (
        <div
            className={cn(
                'w-56 min-h-40 rounded-xl border shadow-sm flex flex-col p-3 gap-2 relative group transition-shadow hover:shadow-md',
                colors.bg,
                colors.border,
                isDeleting && 'opacity-50 pointer-events-none',
            )}
            onClick={(e) => e.stopPropagation()}
        >
            {!isEditing && (
                <div className="absolute top-2 right-2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        type="button"
                        onClick={handleEditStart}
                        className="h-6 w-6 flex items-center justify-center rounded-md bg-background/70 hover:bg-background text-muted-foreground hover:text-foreground transition-colors"
                        title={tEdit}
                    >
                        <Pencil className="h-3 w-3" />
                    </button>
                    <button
                        type="button"
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="h-6 w-6 flex items-center justify-center rounded-md bg-background/70 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        title={tDelete}
                    >
                        {isDeleting ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                            <Trash2 className="h-3 w-3" />
                        )}
                    </button>
                </div>
            )}

            {isEditing ? (
                <>
                    <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className={cn(
                            'flex-1 min-h-20 resize-none text-sm leading-relaxed bg-transparent border-none outline-none',
                            colors.textarea,
                        )}
                        autoFocus
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                e.preventDefault();
                                handleSave();
                            }
                            if (e.key === 'Escape') {
                                e.preventDefault();
                                handleCancel();
                            }
                        }}
                    />
                    <div className="flex items-center justify-between gap-1">
                        <ColorPicker value={editColor} onChange={setEditColor} />
                    </div>
                    <div className="flex gap-1.5 justify-end">
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={handleCancel}
                            disabled={isSaving}
                        >
                            {tCancel}
                        </Button>
                        <Button
                            size="sm"
                            className="h-7 px-3 text-xs"
                            onClick={handleSave}
                            disabled={!editText.trim() || isSaving}
                        >
                            {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : tSave}
                        </Button>
                    </div>
                </>
            ) : (
                <>
                    <p className="flex-1 text-sm leading-relaxed text-foreground whitespace-pre-wrap break-words pr-12">
                        {note.text}
                    </p>
                    <div className="flex items-center justify-between mt-auto pt-1">
                        <span className="text-[11px] text-muted-foreground">{formattedDate}</span>
                        <div className={cn('h-3 w-3 rounded-full', STICKY_COLORS[note.color].dot)} />
                    </div>
                </>
            )}
        </div>
    );
}

// ── Skeleton cards ────────────────────────────────────────────────────────────
function SkeletonCards() {
    return (
        <>
            {[1, 2, 3].map((i) => (
                <div key={i} className="w-56 min-h-40 rounded-xl border border-border bg-muted/30 p-3 flex flex-col gap-3">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-4/5" />
                    <Skeleton className="h-3 w-3/5" />
                    <div className="mt-auto">
                        <Skeleton className="h-3 w-16" />
                    </div>
                </div>
            ))}
        </>
    );
}

// ── Main overlay ──────────────────────────────────────────────────────────────
interface StickyNotesOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
    notes: StickyNote[];
    isLoading: boolean;
    createNote: (p: { text: string; color: string; created_by: string }) => Promise<StickyNote | null>;
    updateNote: (p: { id: string; text: string; color: string }) => Promise<void>;
    deleteNote: (id: string) => Promise<void>;
}

export function StickyNotesOverlay({
    isOpen,
    onClose,
    userId,
    notes,
    isLoading,
    createNote,
    updateNote,
    deleteNote,
}: StickyNotesOverlayProps) {
    const t = useTranslations('StickyNotes');

    React.useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const tStrings = {
        newNote: t('newNote'),
        save: t('save'),
        cancel: t('cancel'),
        edit: t('edit'),
        deleteNote: t('delete'),
        listening: t('listening'),
        startListening: t('startListening'),
        stopListening: t('stopListening'),
        micError: t('micError'),
        saveError: t('saveError'),
        deleteError: t('deleteError'),
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-[9980] bg-black/20 backdrop-blur-[1px]"
                onClick={onClose}
            />

            {/* Content */}
            <div className="fixed inset-0 z-[9981] overflow-y-auto pointer-events-none">
                <div className="min-h-full flex items-start justify-center p-4 pt-20 pointer-events-auto">
                    {/* Header row with close */}
                    <div className="w-full max-w-6xl">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-sm font-semibold text-black drop-shadow-sm">
                                {t('openNotes')}
                            </h2>
                            <button
                                type="button"
                                onClick={onClose}
                                className="h-9 w-9 flex items-center justify-center rounded-full bg-white shadow-md hover:bg-red-50 hover:text-red-600 text-foreground transition-colors"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="flex flex-wrap gap-4">
                            <NewNoteCard
                                userId={userId}
                                onCreate={createNote}
                                tNewNote={tStrings.newNote}
                                tSave={tStrings.save}
                                tCancel={tStrings.cancel}
                                tListening={tStrings.listening}
                                tStartListening={tStrings.startListening}
                                tStopListening={tStrings.stopListening}
                                tMicError={tStrings.micError}
                                tSaveError={tStrings.saveError}
                            />

                            {isLoading && notes.length === 0 && <SkeletonCards />}

                            {!isLoading && notes.length === 0 && (
                                <div className="w-56 min-h-40 rounded-xl border border-dashed border-white/30 flex items-center justify-center">
                                    <p className="text-sm text-white/60">{t('empty')}</p>
                                </div>
                            )}

                            {notes.map((note) => (
                                <ExistingNoteCard
                                    key={note.id}
                                    note={note}
                                    onUpdate={updateNote}
                                    onDelete={deleteNote}
                                    tEdit={tStrings.edit}
                                    tDelete={tStrings.deleteNote}
                                    tSave={tStrings.save}
                                    tCancel={tStrings.cancel}
                                    tDeleteError={tStrings.deleteError}
                                    tSaveError={tStrings.saveError}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
