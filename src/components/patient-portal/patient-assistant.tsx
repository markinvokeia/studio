'use client';

import { Bot, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { VoiceChat, type ChatMessage } from '@/components/voice-chat';

import { usePermissions } from '@/hooks/usePermissions';
import { PATIENT_PORTAL_PERMISSIONS } from '@/constants/permissions';
import { queryPatientAi } from '@/services/patient-ai';
import { cn } from '@/lib/utils';

/** Id de mensaje estable. A nivel de módulo, igual que en `doctor-agent-chat.tsx`. */
function createChatMessageId(role: ChatMessage['role']): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${role}-${crypto.randomUUID()}`;
  }
  return `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

interface PatientAssistantProps {
  patientId: string;
  /** Acción `open_booking` devuelta por el agente. */
  onOpenBooking: () => void;
  /** Acción `open_tab` devuelta por el agente. */
  onOpenTab: (tab: string) => void;
}

/**
 * Asistente virtual del portal: responde sobre la clínica y sobre los datos del
 * paciente logueado. Reutiliza el primitivo `VoiceChat` y sigue el patrón de
 * sesión/acciones de `doctor-agent-chat.tsx`.
 *
 * El `patient_id` se manda por conveniencia pero el backend usa el `sub` del JWT
 * — un paciente nunca puede consultar por otro (docs/patient-portal.md §2.5).
 */
export function PatientAssistant({ patientId, onOpenBooking, onOpenTab }: PatientAssistantProps) {
  const t = useTranslations('PatientPortal.assistant');
  const { hasPermission } = usePermissions();

  const [isOpen, setIsOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = React.useState(false);
  // Un id de sesión estable por montaje, para que el agente hile la conversación.
  const [sessionId] = React.useState(() =>
    typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now())
  );

  const appendMessage = (message: ChatMessage) => setMessages((prev) => [...prev, message]);

  const handleSend = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    const hadSession = messages.length > 0;
    appendMessage({ id: createChatMessageId('user'), role: 'user', content: trimmed, timestamp: new Date() });
    setIsSending(true);

    try {
      const response = await queryPatientAi({
        patient_id: patientId,
        query: trimmed,
        channel: 'text',
        session_id: sessionId,
        has_existing_session: hadSession,
      });

      const answer = response.answer || response.output || t('noAnswer');
      appendMessage({ id: createChatMessageId('assistant'), role: 'assistant', content: answer, timestamp: new Date() });

      if (response.action?.type === 'open_booking') {
        setIsOpen(false);
        onOpenBooking();
      } else if (response.action?.type === 'open_tab' && response.action.payload?.tab) {
        setIsOpen(false);
        onOpenTab(response.action.payload.tab);
      }
    } catch (error) {
      appendMessage({
        id: createChatMessageId('assistant'),
        role: 'assistant',
        content: error instanceof Error && error.message ? error.message : t('error'),
        timestamp: new Date(),
      });
    } finally {
      setIsSending(false);
    }
  };

  if (!hasPermission(PATIENT_PORTAL_PERMISSIONS.USE_ASSISTANT)) return null;

  return (
    <>
      {!isOpen && (
        <Button
          size="icon"
          className="fixed bottom-5 right-5 z-40 h-14 w-14 rounded-full shadow-lg"
          onClick={() => setIsOpen(true)}
          aria-label={t('open')}
        >
          <Bot className="h-6 w-6" />
        </Button>
      )}

      <div
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl border bg-card shadow-2xl transition-transform',
          'h-[70dvh] sm:inset-x-auto sm:bottom-5 sm:right-5 sm:h-[560px] sm:w-[380px] sm:rounded-2xl',
          isOpen ? 'translate-y-0' : 'pointer-events-none translate-y-full sm:translate-y-[120%]'
        )}
      >
        <div className="flex flex-none items-center gap-2 border-b px-4 py-3">
          <Bot className="h-5 w-5 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{t('title')}</p>
            <p className="truncate text-xs text-muted-foreground">{t('subtitle')}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsOpen(false)}>
            <X className="h-4 w-4" />
            <span className="sr-only">{t('close')}</span>
          </Button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          {messages.length === 0 && (
            <div className="flex flex-wrap gap-2 border-b px-4 py-3">
              {[t('suggestions.nextAppointment'), t('suggestions.balance'), t('suggestions.hours')].map(
                (suggestion) => (
                  <Button
                    key={suggestion}
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => handleSend(suggestion)}
                  >
                    {suggestion}
                  </Button>
                )
              )}
            </div>
          )}
          <VoiceChat
            messages={messages}
            onSendText={handleSend}
            isSending={isSending}
            composerPlaceholder={t('placeholder')}
          />
        </div>
      </div>
    </>
  );
}
