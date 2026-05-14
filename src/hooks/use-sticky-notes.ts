'use client';

import { useCallback, useState } from 'react';
import api from '@/services/api';
import { API_ROUTES } from '@/constants/routes';
import type { StickyNote } from '@/lib/types';

export interface UseStickyNotesReturn {
    notes: StickyNote[];
    isLoading: boolean;
    error: string | null;
    fetchNotes: () => Promise<void>;
    createNote: (payload: { text: string; color: string; created_by: string }) => Promise<StickyNote | null>;
    updateNote: (payload: { id: string; text: string; color: string; actions?: string[]; redirects?: string[] }) => Promise<void>;
    deleteNote: (id: string) => Promise<void>;
    prependNote: (note: StickyNote) => void;
}

export function useStickyNotes(): UseStickyNotesReturn {
    const [notes, setNotes] = useState<StickyNote[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchNotes = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await api.get(API_ROUTES.STICKY_NOTES);
            setNotes(
                ((data ?? []) as StickyNote[]).filter((n) => n.status !== 'deleted'),
            );
        } catch {
            setError('load');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const createNote = useCallback(
        async (payload: { text: string; color: string; created_by: string }) => {
            const result = await api.post(API_ROUTES.STICKY_NOTES_UPSERT, payload);
            if (result) setNotes((prev) => [result as StickyNote, ...prev]);
            return (result as StickyNote) ?? null;
        },
        [],
    );

    const updateNote = useCallback(
        async (payload: { id: string; text: string; color: string; actions?: string[]; redirects?: string[] }) => {
            const prev = notes.slice();
            setNotes((cur) =>
                cur.map((n) =>
                    n.id === payload.id
                        ? {
                            ...n,
                            text: payload.text,
                            color: payload.color as StickyNote['color'],
                            ...(payload.actions !== undefined && { actions: payload.actions }),
                            ...(payload.redirects !== undefined && { redirects: payload.redirects }),
                          }
                        : n,
                ),
            );
            try {
                await api.post(API_ROUTES.STICKY_NOTES_UPSERT, payload);
            } catch {
                setNotes(prev);
                throw new Error('update');
            }
        },
        [notes],
    );

    const deleteNote = useCallback(
        async (id: string) => {
            const prev = notes.slice();
            setNotes((cur) => cur.filter((n) => n.id !== id));
            try {
                await api.post(API_ROUTES.STICKY_NOTES_DELETE, { id });
            } catch {
                setNotes(prev);
                throw new Error('delete');
            }
        },
        [notes],
    );

    const prependNote = useCallback((note: StickyNote) => {
        setNotes((cur) =>
            cur.some((n) => n.id === note.id) ? cur : [note, ...cur],
        );
    }, []);

    return { notes, isLoading, error, fetchNotes, createNote, updateNote, deleteNote, prependNote };
}
