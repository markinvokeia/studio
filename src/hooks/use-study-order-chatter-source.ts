'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { getStudyOrderChatterMode, type StudyOrderChatterMode } from '@/lib/runtime-config';
import {
    getStudyOrderChatterMock,
    getStudyOrderFollowerCandidatesMock,
    postStudyOrderMessageMock,
    updateStudyOrderFollowersMock,
    type ChatterMockSeed,
    type ChatterMockViewer,
} from '@/services/study-order-chatter-mock';
import {
    getStudyOrderChatter,
    getStudyOrderFollowerCandidates,
    postStudyOrderMessage,
    updateStudyOrderFollowers,
} from '@/services/study-orders';
import { STUDY_ORDERS_PERMISSIONS } from '@/constants/permissions';
import type {
    StudyOrderChatter,
    StudyOrderFollower,
    StudyOrderFollowerAction,
    StudyOrderFollowersResult,
    StudyOrderMessage,
    StudyOrderMessageKind,
} from '@/lib/types';

/** Lo que el chatter le pide al backend, venga de n8n (`live`) o de la demo en el navegador (`mock`). */
export interface StudyOrderChatterSource {
    mode: Exclude<StudyOrderChatterMode, 'off'>;
    /** Permiso de escribir. En la demo no existe todavía STUDY_ORDERS_MESSAGE: alcanza con ver órdenes. */
    canMessage: boolean;
    getChatter: (orderId: string, signal?: AbortSignal) => Promise<StudyOrderChatter>;
    postMessage: (params: { orderId: string; kind: StudyOrderMessageKind; body: string }) => Promise<StudyOrderMessage>;
    updateFollowers: (params: {
        orderId: string;
        action: StudyOrderFollowerAction;
        target?: StudyOrderFollower;
    }) => Promise<StudyOrderFollowersResult>;
    getCandidates: (orderId: string, signal?: AbortSignal) => Promise<StudyOrderFollower[]>;
}

/** El modo se lee una vez: viene de la config de runtime, que no cambia sin recargar. */
export const useStudyOrderChatterMode = (): StudyOrderChatterMode => React.useMemo(() => getStudyOrderChatterMode(), []);

const LIVE: Omit<StudyOrderChatterSource, 'mode' | 'canMessage'> = {
    getChatter: getStudyOrderChatter,
    postMessage: postStudyOrderMessage,
    updateFollowers: ({ orderId, action, target }) => updateStudyOrderFollowers({ orderId, action, userId: target?.id }),
    getCandidates: getStudyOrderFollowerCandidates,
};

export function useStudyOrderChatterSource(): StudyOrderChatterSource {
    const mode = useStudyOrderChatterMode();
    const t = useTranslations('StudyOrdersPage.chatter.demo');
    const { user } = useAuth();
    const { hasPermission } = usePermissions();

    const canViewAll = hasPermission(STUDY_ORDERS_PERMISSIONS.VIEW_ALL);
    const canMessage = mode === 'mock'
        ? canViewAll || hasPermission(STUDY_ORDERS_PERMISSIONS.VIEW_MINE)
        : hasPermission(STUDY_ORDERS_PERMISSIONS.MESSAGE);

    const seedMessage = t('seedDoctorMessage');
    const seedNote = t('seedClinicNote');
    const clinicAuthor = t('clinicAuthor');

    return React.useMemo((): StudyOrderChatterSource => {
        if (mode !== 'mock') return { mode: 'live', canMessage, ...LIVE };

        const viewer: ChatterMockViewer = {
            id: user?.id ?? '',
            name: user?.name ?? '',
            email: user?.email ?? null,
            canViewAll,
            canMessage,
        };
        const seed: ChatterMockSeed = { doctorMessage: seedMessage, clinicNote: seedNote, clinicAuthor };
        return {
            mode: 'mock',
            canMessage,
            getChatter: (orderId, signal) => getStudyOrderChatterMock(orderId, viewer, seed, signal),
            postMessage: (params) => postStudyOrderMessageMock(params, viewer, seed),
            updateFollowers: (params) => updateStudyOrderFollowersMock(params, viewer, seed),
            getCandidates: (orderId, signal) => getStudyOrderFollowerCandidatesMock(orderId, seed, signal),
        };
    }, [mode, canMessage, canViewAll, user?.id, user?.name, user?.email, seedMessage, seedNote, clinicAuthor]);
}
