'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { VoiceRecorderButton } from '@/components/ui/voice-recorder-button';
import { VoiceChat, type ChatMessage } from '@/components/voice-chat';
import type { DoctorAgentAction, DoctorAiQueryResponse, TreatmentDetail } from '@/lib/types';
import { queryDoctorAi } from '@/services/doctor-ai';
import { cn, formatDate, sanitizeTextForSpeech } from '@/lib/utils';
import { Bot, ChevronRight, MessageSquare, Volume2, VolumeX, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface DoctorAgentChatProps {
  appointmentId?: string;
  locale: string;
  patientName?: string;
  userId?: string;
  onAction?: (action: DoctorAgentAction) => void | { success?: boolean; message?: string } | Promise<void | { success?: boolean; message?: string }>;
  presentation?: 'floating' | 'embedded';
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

function buildDoctorDailySessionId(userId?: string) {
  const dateKey = formatDate(new Date());
  return `doctor-agent:${userId || 'anonymous'}:${dateKey}`;
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

  if (rawAction.type === 'sesion_clinica') {
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

  if (rawAction.type === 'ficha_paciente') {
    return {
      type: 'open_patient_detail',
      payload: {
        appointment_id: rawAction.appointment_id,
      },
    };
  }

  if (rawAction.type === 'historia_clinica') {
    return {
      type: 'open_clinical_history',
      payload: {
        appointment_id: rawAction.appointment_id,
        clinical_history_view: rawAction.vista || rawAction.clinical_history_view || 'timeline',
      },
    };
  }

  if (rawAction.type === 'citas_paciente') {
    return {
      type: 'open_patient_appointments',
      payload: {
        appointment_id: rawAction.appointment_id,
      },
    };
  }

  if (rawAction.type === 'mensajes_paciente') {
    return {
      type: 'open_patient_messages',
      payload: {
        appointment_id: rawAction.appointment_id,
      },
    };
  }

  if (rawAction.type === 'notas_paciente') {
    return {
      type: 'open_patient_notes',
      payload: {
        appointment_id: rawAction.appointment_id,
      },
    };
  }

  if (rawAction.type === 'seleccionar_cita') {
    return {
      type: 'select_appointment',
      payload: {
        appointment_id: rawAction.appointment_id,
      },
    };
  }

  if (
    rawAction.type === 'open_clinic_session' ||
    rawAction.type === 'open_patient_detail' ||
    rawAction.type === 'open_clinical_history' ||
    rawAction.type === 'open_patient_appointments' ||
    rawAction.type === 'open_patient_messages' ||
    rawAction.type === 'open_patient_notes' ||
    rawAction.type === 'select_appointment'
  ) {
    return rawAction as DoctorAgentAction;
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
  const nestedOutput = firstLayer && typeof firstLayer === 'object' && 'output' in (firstLayer as any)
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
  locale,
  patientName,
  userId,
  onAction,
  presentation = 'floating',
}: DoctorAgentChatProps) {
  const t = useTranslations('DoctorWorkspace.focus.ai');
  const [isClient, setIsClient] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);
  const [isMinimized, setIsMinimized] = React.useState(false);
  const [isSending, setIsSending] = React.useState(false);
  const [ttsEnabled, setTtsEnabled] = React.useState(true);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [suggestions, setSuggestions] = React.useState<string[]>([]);
  const sessionId = React.useMemo(() => buildDoctorDailySessionId(userId), [userId]);
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
      const actionResult = await onAction?.(result.action);
      if (actionResult && typeof actionResult === 'object' && actionResult.success === false && actionResult.message) {
        appendAssistantMessage(actionResult.message);
      }
    }
  }, [appendAssistantMessage, locale, onAction, ttsEnabled]);

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
      const result = await queryDoctorAi({
        appointment_id: appointmentId,
        query: prompt,
        channel: 'text',
        session_id: sessionId,
      });
      await applyDoctorResponse(result);
    } catch (error) {
      console.error('Failed to query doctor agent chat:', error);
      appendAssistantMessage(t('chatError'));
    } finally {
      setIsSending(false);
    }
  }, [appendAssistantMessage, appointmentId, applyDoctorResponse, sessionId, t]);

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
        <div className="min-h-0 flex-1 overflow-y-auto">
          <VoiceChat
            messages={messages}
            onSendText={(text) => void askDoctorAgent(text)}
            isSending={isSending}
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
      <div className="fixed bottom-5 right-5 z-[80]">
        {isOpen && isMinimized ? (
          <Button
            type="button"
            onClick={() => setIsMinimized(false)}
            className="h-12 rounded-full px-4 shadow-2xl"
            title={t('restoreChat')}
          >
            <MessageSquare className="mr-2 h-4 w-4" />
            {t('floatingTitle')}
          </Button>
        ) : !isOpen ? (
          <Button
            type="button"
            onClick={openChat}
            className={cn(
              'h-14 rounded-full px-5 shadow-2xl',
              'bg-slate-900 text-white hover:bg-slate-800',
            )}
          >
            <Bot className="mr-2 h-4 w-4" />
            {t('floatingTitle')}
          </Button>
        ) : null}
      </div>

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
