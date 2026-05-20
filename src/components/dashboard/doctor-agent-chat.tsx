'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { VoiceRecorderButton } from '@/components/ui/voice-recorder-button';
import { VoiceChat, type ChatMessage } from '@/components/voice-chat';
import type { DoctorAgentAction, DoctorAgentActionPayload, DoctorAiQueryResponse, TreatmentDetail } from '@/lib/types';
import { queryDoctorAi } from '@/services/doctor-ai';
import { cn, formatDate, sanitizeTextForSpeech } from '@/lib/utils';
import { Bot, ChevronRight, MessageSquare, Volume2, VolumeX, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface DoctorAgentChatProps {
  appointmentId?: string;
  patientId?: string;
  doctorId?: string;
  locale: string;
  patientName?: string;
  userId?: string;
  onAction?: (action: DoctorAgentAction) => void | { success?: boolean; message?: string } | Promise<void | { success?: boolean; message?: string }>;
  presentation?: 'floating' | 'embedded';
  hasExistingSession?: boolean;
  onDirectSave?: (payload: DoctorAgentActionPayload) => Promise<void>;
}

const PREFERRED_VOICE_NAMES = [
  'Google español',
  'Microsoft Sabina',
  'Microsoft Helena',
  'Paulina',
  'Monica',
  'Google US English',
  'Microsoft Aria',
  'Samantha',
];
const DOCTOR_AGENT_CHAT_STORAGE_PREFIX = 'doctor-agent:chat-state';

type PersistedDoctorAgentChatState = {
  isOpen: boolean;
  isMinimized: boolean;
  ttsEnabled: boolean;
  suggestions: string[];
  messages: Array<{
    id: string;
    role: ChatMessage['role'];
    content: string;
    isVoice?: boolean;
    timestamp: string;
  }>;
};

function createChatMessageId(role: ChatMessage['role']) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${role}-${crypto.randomUUID()}`;
  }

  return `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function pickVoice(targetLocale: string): Promise<SpeechSynthesisVoice | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      resolve(null);
      return;
    }

    const synth = window.speechSynthesis;
    const langPrefix = targetLocale.startsWith('es') ? 'es' : 'en';

    const findVoice = () => {
      const voices = synth.getVoices();
      if (voices.length === 0) return null;

      for (const name of PREFERRED_VOICE_NAMES) {
        const voice = voices.find((item) => item.name.includes(name) && item.lang.startsWith(langPrefix));
        if (voice) return voice;
      }

      return voices.find((item) => item.lang.startsWith(langPrefix)) ?? null;
    };

    const voice = findVoice();
    if (voice) {
      resolve(voice);
      return;
    }

    const onVoicesChanged = () => {
      synth.removeEventListener('voiceschanged', onVoicesChanged);
      resolve(findVoice());
    };

    synth.addEventListener('voiceschanged', onVoicesChanged);
    setTimeout(() => {
      synth.removeEventListener('voiceschanged', onVoicesChanged);
      resolve(findVoice());
    }, 1500);
  });
}

async function speakText(text: string, locale: string, enabled: boolean) {
  if (!enabled || typeof window === 'undefined' || !window.speechSynthesis || !text.trim()) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(sanitizeTextForSpeech(text));
  utterance.lang = locale.startsWith('es') ? 'es-ES' : 'en-US';
  utterance.rate = 0.94;

  const voice = await pickVoice(locale);
  if (voice) {
    utterance.voice = voice;
  }

  window.speechSynthesis.speak(utterance);
}

function buildDoctorDailySessionId(userId?: string, appointmentId?: string) {
  const dateKey = formatDate(new Date());
  return `doctor-agent:${userId || 'anonymous'}:${appointmentId || 'no-appointment'}:${dateKey}`;
}

function getDoctorAgentChatStorageKey(sessionId: string) {
  return `${DOCTOR_AGENT_CHAT_STORAGE_PREFIX}:${sessionId}`;
}

function readDoctorAgentChatState(sessionId: string): PersistedDoctorAgentChatState | null {
  if (typeof window === 'undefined') return null;

  try {
    const rawValue = window.localStorage.getItem(getDoctorAgentChatStorageKey(sessionId));
    if (!rawValue) return null;

    const parsedValue = JSON.parse(rawValue) as Partial<PersistedDoctorAgentChatState>;
    const seenMessageIds = new Set<string>();
    return {
      isOpen: parsedValue.isOpen ?? false,
      isMinimized: parsedValue.isMinimized ?? false,
      ttsEnabled: parsedValue.ttsEnabled ?? true,
      suggestions: Array.isArray(parsedValue.suggestions) ? parsedValue.suggestions.map((item) => String(item)) : [],
      messages: Array.isArray(parsedValue.messages)
        ? parsedValue.messages
            .filter((message) => message && typeof message === 'object')
            .map((message) => ({
              role: message.role === 'assistant' ? 'assistant' : 'user',
              id: (() => {
                const baseId = String(message.id || '');
                if (baseId && !seenMessageIds.has(baseId)) {
                  seenMessageIds.add(baseId);
                  return baseId;
                }

                const nextId = createChatMessageId(message.role === 'assistant' ? 'assistant' : 'user');
                seenMessageIds.add(nextId);
                return nextId;
              })(),
              content: String(message.content || ''),
              isVoice: Boolean(message.isVoice),
              timestamp: String(message.timestamp || new Date().toISOString()),
            }))
        : [],
    };
  } catch (error) {
    console.error('Failed to restore doctor agent chat state:', error);
    return null;
  }
}

function writeDoctorAgentChatState(sessionId: string, state: PersistedDoctorAgentChatState) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(getDoctorAgentChatStorageKey(sessionId), JSON.stringify(state));
  } catch (error) {
    console.error('Failed to persist doctor agent chat state:', error);
  }
}

function normalizeDoctorAction(rawAction: any): DoctorAgentAction | null {
  if (!rawAction || typeof rawAction !== 'object') return null;

  if (rawAction.type === 'sesion_clinica' || rawAction.type === 'open_clinic_session') {
    const tratamientos: TreatmentDetail[] = Array.isArray(rawAction.tratamientos)
      ? rawAction.tratamientos.map((item: any) => ({
          numero_diente: item?.diente != null ? Number(item.diente) : null,
          descripcion: item?.tratamiento || '',
        }))
      : [];

    return {
      type: 'open_clinic_session',
      payload: {
        procedimiento_realizado: rawAction.procedimiento_realizado || '',
        plan_proxima_cita: rawAction.plan_proxima_cita || '',
        tratamientos,
      },
    };
  }

  if (rawAction.type === 'guardar_sesion' || rawAction.type === 'save_clinic_session') {
    const tratamientos: TreatmentDetail[] = Array.isArray(rawAction.tratamientos)
      ? rawAction.tratamientos.map((item: any) => ({
          numero_diente: item?.diente != null ? Number(item.diente) : null,
          descripcion: item?.tratamiento || '',
        }))
      : [];

    return {
      type: 'save_clinic_session',
      payload: {
        procedimiento_realizado: rawAction.procedimiento_realizado || '',
        plan_proxima_cita: rawAction.plan_proxima_cita || '',
        tratamientos,
      },
    };
  }

  if (rawAction.type === 'revisar_sesion' || rawAction.type === 'review_clinic_session') {
    const tratamientos: TreatmentDetail[] = Array.isArray(rawAction.tratamientos)
      ? rawAction.tratamientos.map((item: any) => ({
          numero_diente: item?.diente != null ? Number(item.diente) : null,
          descripcion: item?.tratamiento || '',
        }))
      : [];

    return {
      type: 'review_clinic_session',
      payload: {
        procedimiento_realizado: rawAction.procedimiento_realizado || '',
        plan_proxima_cita: rawAction.plan_proxima_cita || '',
        tratamientos,
      },
    };
  }

  if (rawAction.type === 'abrir_odontograma' || rawAction.type === 'open_odontogram') {
    return {
      type: 'open_odontogram',
      payload: {
        procedimiento_realizado: rawAction.procedimiento_realizado || '',
        notas_clinicas: rawAction.notas_clinicas || rawAction.notas || '',
        plan_proxima_cita: rawAction.plan_proxima_cita || '',
        marcaciones: Array.isArray(rawAction.marcaciones) ? rawAction.marcaciones : [],
      },
    };
  }

  return null;
}

function parseDoctorAgentPayload(rawValue: unknown): any {
  if (rawValue && typeof rawValue === 'object') {
    return rawValue;
  }

  if (typeof rawValue === 'string') {
    try {
      const parsedValue = JSON.parse(rawValue);
      if (parsedValue && typeof parsedValue === 'object') {
        return parseDoctorAgentPayload(parsedValue);
      }
    } catch {
      return { output: rawValue };
    }
  }

  return {};
}

function normalizeDoctorResponse(result: unknown): DoctorAiQueryResponse {
  const firstLayer = Array.isArray(result) ? result[0] : result;
  // If the top-level object already has an `action` field, use it directly.
  // Only descend into `.output` when the backend wraps the agent JSON as a nested string.
  const hasTopLevelAction = firstLayer != null && typeof firstLayer === 'object' && 'action' in (firstLayer as any);
  const nestedOutput = !hasTopLevelAction && firstLayer && typeof firstLayer === 'object' && 'output' in (firstLayer as any)
    ? (firstLayer as any).output
    : firstLayer;
  let outputObject: any = parseDoctorAgentPayload(nestedOutput);

  if (typeof outputObject.output === 'string') {
    const nestedObject = parseDoctorAgentPayload(outputObject.output);
    if (nestedObject && typeof nestedObject === 'object' && (nestedObject.output || nestedObject.action)) {
      outputObject = {
        ...nestedObject,
        ...outputObject,
        output: typeof nestedObject.output === 'string' ? nestedObject.output : outputObject.output,
        action: nestedObject.action ?? outputObject.action,
      };
    }
  }

  const action = normalizeDoctorAction(outputObject.action);

  return {
    intent: outputObject.intent || 'clinical_question',
    answer: outputObject.answer,
    output: typeof outputObject.output === 'string' ? outputObject.output : undefined,
    speak_text: outputObject.speak_text,
    suggestions: Array.isArray(outputObject.suggestions) ? outputObject.suggestions : [],
    clinical_brief: outputObject.clinical_brief || null,
    session_patch: outputObject.session_patch || null,
    action,
  };
}

export function DoctorAgentChat({
  appointmentId,
  patientId,
  doctorId,
  locale,
  patientName,
  userId,
  onAction,
  presentation = 'floating',
  hasExistingSession = false,
  onDirectSave,
}: DoctorAgentChatProps) {
  const t = useTranslations('DoctorWorkspace.focus.ai');
  const [isClient, setIsClient] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);
  const [isMinimized, setIsMinimized] = React.useState(false);
  const [isSending, setIsSending] = React.useState(false);
  const [ttsEnabled, setTtsEnabled] = React.useState(true);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [suggestions, setSuggestions] = React.useState<string[]>([]);
  const [pendingSessionAction, setPendingSessionAction] = React.useState<DoctorAgentAction | null>(null);
  const [isSavingDirect, setIsSavingDirect] = React.useState(false);
  const sessionId = React.useMemo(() => buildDoctorDailySessionId(userId, appointmentId), [userId, appointmentId]);
  const isFloating = presentation === 'floating';

  const quickQuestions = React.useMemo(
    () => [t('quickLastDone'), t('quickToday'), t('quickAlerts')],
    [t],
  );

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  React.useEffect(() => {
    const persistedState = readDoctorAgentChatState(sessionId);
    if (!persistedState) {
      setMessages([]);
      setSuggestions([]);
      setIsOpen(false);
      setIsMinimized(false);
      setTtsEnabled(true);
      return;
    }

    setMessages(
      persistedState.messages.map((message) => ({
        ...message,
        timestamp: new Date(message.timestamp),
      })),
    );
    setSuggestions(persistedState.suggestions);
    setIsOpen(persistedState.isOpen);
    setIsMinimized(persistedState.isMinimized);
    setTtsEnabled(persistedState.ttsEnabled);
  }, [sessionId]);

  React.useEffect(() => {
    if (!isClient) return;

    writeDoctorAgentChatState(sessionId, {
      isOpen,
      isMinimized,
      ttsEnabled,
      suggestions,
      messages: messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        isVoice: message.isVoice,
        timestamp: message.timestamp.toISOString(),
      })),
    });
  }, [isClient, isMinimized, isOpen, messages, sessionId, suggestions, ttsEnabled]);

  React.useEffect(() => {
    if (appointmentId || !isFloating) return;

    setIsOpen(false);
    setIsMinimized(false);
  }, [appointmentId, isFloating]);

  const appendAssistantMessage = React.useCallback((content: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: createChatMessageId('assistant'),
        role: 'assistant',
        content,
        timestamp: new Date(),
      },
    ]);
  }, []);

  const applyDoctorResponse = React.useCallback(async (rawResult: unknown) => {
    const result = normalizeDoctorResponse(rawResult);
    setSuggestions(result.suggestions || []);

    const responseText = result.answer || result.output;
    if (responseText) {
      appendAssistantMessage(responseText);
      await speakText(result.speak_text || responseText, locale, ttsEnabled);
    }

    if (result.clinical_brief) {
      const briefMessage = [
        result.clinical_brief.resumen_clinico,
        result.clinical_brief.ultimo_realizado,
        ...result.clinical_brief.que_toca_hoy,
        ...result.clinical_brief.alertas,
      ].filter(Boolean).join('\n\n');

      if (briefMessage) {
        appendAssistantMessage(briefMessage);
        await speakText(result.speak_text || result.clinical_brief.resumen_clinico, locale, ttsEnabled);
      }
    }

    if (result.action) {
      if (result.action.type === 'open_clinic_session') {
        // Store as pending — agent will ask the doctor via text what to do next
        setPendingSessionAction(result.action);
      } else if (result.action.type === 'save_clinic_session') {
        // Doctor confirmed via voice/text: save directly without opening dialog
        const payload = (result.action.payload && Object.keys(result.action.payload).length > 0)
          ? result.action.payload
          : pendingSessionAction?.payload ?? {};
        if (onDirectSave) {
          setIsSavingDirect(true);
          try {
            await onDirectSave(payload);
            setPendingSessionAction(null);
          } catch {
            appendAssistantMessage(t('chatError'));
          } finally {
            setIsSavingDirect(false);
          }
        }
      } else if (result.action.type === 'review_clinic_session') {
        // Doctor confirmed via voice/text: open dialog to review/edit
        const reviewAction: DoctorAgentAction = {
          type: 'open_clinic_session',
          payload: (result.action.payload && Object.keys(result.action.payload).length > 0)
            ? result.action.payload
            : pendingSessionAction?.payload,
        };
        setPendingSessionAction(null);
        const actionResult = await onAction?.(reviewAction);
        if (actionResult && typeof actionResult === 'object' && actionResult.success === false && actionResult.message) {
          appendAssistantMessage(actionResult.message);
        }
      } else {
        const actionResult = await onAction?.(result.action);
        if (actionResult && typeof actionResult === 'object' && actionResult.success === false && actionResult.message) {
          appendAssistantMessage(actionResult.message);
        }
      }
    }
  }, [appendAssistantMessage, locale, onAction, onDirectSave, pendingSessionAction, t, ttsEnabled]);

  const askDoctorAgent = React.useCallback(async (prompt: string) => {
    if (!appointmentId) return;

    setMessages((prev) => [
      ...prev,
      {
        id: createChatMessageId('user'),
        role: 'user',
        content: prompt,
        timestamp: new Date(),
      },
    ]);

    setIsSending(true);
    try {
      const jwtToken = typeof window !== 'undefined' ? (window.localStorage.getItem('token') ?? undefined) : undefined;
      const result = await queryDoctorAi({
        appointment_id: appointmentId,
        patient_id: patientId,
        doctor_id: doctorId,
        query: prompt,
        channel: 'text',
        session_id: sessionId,
        token: jwtToken,
        has_existing_session: hasExistingSession,
      });
      await applyDoctorResponse(result);
    } catch (error) {
      console.error('Failed to query doctor agent chat:', error);
      appendAssistantMessage(t('chatError'));
    } finally {
      setIsSending(false);
    }
  }, [appendAssistantMessage, appointmentId, patientId, doctorId, applyDoctorResponse, sessionId, t]);

  const openChat = React.useCallback(() => {
    if (!appointmentId) return;

    setIsOpen(true);
    setIsMinimized(false);
  }, [appointmentId]);

  const closeChat = React.useCallback(() => {
    setIsOpen(false);
    setIsMinimized(false);
  }, []);

  if (!appointmentId) return null;

  const chatCard = (
    <Card className={cn(
      'flex h-full min-h-0 w-full flex-col overflow-hidden border-primary/20',
      isFloating
        ? 'h-[68vh] rounded-none shadow-2xl sm:rounded-2xl'
        : 'rounded-xl',
    )}>
      <CardHeader className={cn(
        'flex shrink-0 flex-row items-center justify-between gap-3 border-b p-4',
        isFloating ? 'bg-primary text-primary-foreground' : '',
      )}>
        <div className="min-w-0">
          <CardTitle className={cn('flex items-center gap-2 text-sm font-bold', !isFloating && 'text-foreground')}>
            <MessageSquare className="h-4 w-4" />
            {t('floatingTitle')}
          </CardTitle>
          <p className={cn('mt-1 truncate text-xs', isFloating ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
            {patientName ? t('chatPatientSubtitle', { patient: patientName }) : t('sidebarDescription')}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setTtsEnabled((value) => {
                if (value) window.speechSynthesis?.cancel();
                return !value;
              });
            }}
            className={cn(
              'h-7 w-7',
              isFloating
                ? 'text-primary-foreground hover:bg-white/20'
                : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
            )}
            title={ttsEnabled ? t('ttsDisable') : t('ttsEnable')}
          >
            {ttsEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </Button>
          {isFloating && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMinimized(true)}
                className="h-7 w-7 text-primary-foreground hover:bg-white/20"
                title={t('minimizeChat')}
              >
                <ChevronRight className="h-4 w-4 rotate-90" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={closeChat}
                className="h-7 w-7 text-primary-foreground hover:bg-white/20"
                title={t('closeChat')}
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
        <div className="min-h-0 flex-1 overflow-hidden">
          <VoiceChat
            messages={messages}
            onSendText={(text) => void askDoctorAgent(text)}
            isSending={isSending || isSavingDirect}
            composerPlaceholder={t('questionPlaceholder')}
            trailingActions={(
              <VoiceRecorderButton
                locale={locale}
                disabled={isSending}
                onTranscriptReady={(transcript) => askDoctorAgent(transcript)}
              />
            )}
          />
        </div>
      </CardContent>
    </Card>
  );

  if (!isFloating) {
    return chatCard;
  }

  return (
    <>
      {isOpen && isMinimized ? (
        <div className="fixed bottom-5 right-5 z-[80]">
          <Button
            type="button"
            onClick={() => setIsMinimized(false)}
            size="icon"
            className="h-14 w-14 rounded-full shadow-2xl"
            title={t('restoreChat')}
          >
            <MessageSquare className="h-5 w-5" />
          </Button>
        </div>
      ) : !isOpen ? (
        <div className="fixed bottom-24 left-1/2 z-[80] -translate-x-1/2 flex flex-col items-center gap-2.5 sm:bottom-10">
          <span className="rounded-full border border-border/50 bg-background/90 px-3.5 py-1.5 text-xs font-medium text-foreground shadow-sm backdrop-blur-sm">
            {t('openAgentChat')}
          </span>
          <div className="relative">
            <span className="absolute inset-0 animate-ping rounded-full bg-primary/30" />
            <Button
              type="button"
              onClick={openChat}
              size="icon"
              className="relative h-14 w-14 rounded-full shadow-2xl bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Bot className="h-5 w-5" />
            </Button>
          </div>
        </div>
      ) : null}

      {isClient && isOpen && createPortal(
        <div className="pointer-events-none fixed bottom-0 right-0 z-[9990] flex w-full justify-end p-0 sm:bottom-4 sm:right-4 sm:w-auto">
          {isMinimized ? null : (
            <div className="pointer-events-auto w-full px-0 md:w-[24rem] lg:w-[26rem]">
              {chatCard}
            </div>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}
