import api, { REQUEST_TIMEOUT_MS } from '@/services/api';

import { API_ROUTES } from '@/constants/routes';
import type {
  HelpAssistantReply,
  HelpInsights,
  HelpTicketStatus,
  HelpVideo,
  HelpCatalog,
  HelpVisibleTarget,
  OnboardingStatusResponse,
} from '@/lib/types';

const READ_TIMEOUT_MS = 20_000;

export async function getOnboardingStatus(signal?: AbortSignal): Promise<OnboardingStatusResponse> {
  const data = await api.get(API_ROUTES.HELP.ONBOARDING_STATUS, undefined, undefined, { signal, timeoutMs: READ_TIMEOUT_MS });
  return { steps: Array.isArray(data?.steps) ? data.steps : [] };
}

export function updateOnboardingProgress(stepId: string, status: 'skipped' | 'pending', notes?: string) {
  return api.post(
    API_ROUTES.HELP.ONBOARDING_PROGRESS,
    { step_id: stepId, status, notes },
    undefined,
    undefined,
    { timeoutMs: REQUEST_TIMEOUT_MS.mutation },
  );
}

export interface AskAssistantPayload {
  message: string;
  locale: string;
  route: string;
  screenId: string;
  visibleTargets: HelpVisibleTarget[];
  history: { role: 'user' | 'assistant'; content: string }[];
}

export async function askAssistant(payload: AskAssistantPayload, signal?: AbortSignal): Promise<HelpAssistantReply> {
  const data = await api.post(API_ROUTES.HELP.ASSISTANT_CHAT, payload, undefined, undefined, {
    signal,
    timeoutMs: REQUEST_TIMEOUT_MS.longRunning,
  });
  return { answer: String(data?.answer ?? ''), ...data };
}

export function sendAssistantFeedback(questionId: string, rating: 1 | -1) {
  return api.post(API_ROUTES.HELP.ASSISTANT_FEEDBACK, { question_id: questionId, rating }, undefined, undefined, {
    timeoutMs: REQUEST_TIMEOUT_MS.mutation,
  });
}

export async function getPublishedCatalogVersion(signal?: AbortSignal): Promise<string | null> {
  const data = await api.get(API_ROUTES.HELP.CATALOG_VERSION, undefined, undefined, { signal, timeoutMs: READ_TIMEOUT_MS });
  return typeof data?.version === 'string' ? data.version : null;
}

/** Ajustes del asistente que fija la clínica. Sin el flujo o la clave, la mascota se ve. */
export async function getHelpSettings(signal?: AbortSignal): Promise<{ mascotVisible: boolean }> {
  const data = await api.get(API_ROUTES.HELP.SETTINGS, undefined, undefined, { signal, timeoutMs: READ_TIMEOUT_MS });
  const body = Array.isArray(data) ? data[0] : data;
  return { mascotVisible: body?.mascot_visible !== false };
}

/** Videos de las guías (help_videos), uno por guía, en el idioma de la app o el español. */
export async function getHelpVideos(locale: string, signal?: AbortSignal): Promise<HelpVideo[]> {
  const data = await api.get(API_ROUTES.HELP.VIDEOS, { locale }, undefined, { signal, timeoutMs: READ_TIMEOUT_MS });
  const body = Array.isArray(data) ? data[0] : data;
  return Array.isArray(body?.videos) ? body.videos : [];
}

export function publishCatalog(catalog: HelpCatalog) {
  return api.post(API_ROUTES.HELP.CATALOG_SYNC, catalog, undefined, undefined, { timeoutMs: REQUEST_TIMEOUT_MS.longRunning });
}

export async function getHelpInsights(days: number, signal?: AbortSignal): Promise<HelpInsights> {
  return api.get(API_ROUTES.HELP.INSIGHTS, { days: String(days) }, undefined, { signal, timeoutMs: READ_TIMEOUT_MS });
}

export function updateHelpQuestion(id: string, status: 'resolved' | 'ignored' | 'open', note?: string) {
  return api.post(API_ROUTES.HELP.SUPPORT_UPDATE, { type: 'question', id, status, note }, undefined, undefined, {
    timeoutMs: REQUEST_TIMEOUT_MS.mutation,
  });
}

export function updateHelpTicket(id: number, status: HelpTicketStatus, note?: string) {
  return api.post(API_ROUTES.HELP.SUPPORT_UPDATE, { type: 'ticket', id: String(id), status, note }, undefined, undefined, {
    timeoutMs: REQUEST_TIMEOUT_MS.mutation,
  });
}
