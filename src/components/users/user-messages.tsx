
'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { API_ROUTES } from '@/constants/routes';
import { Message } from '@/lib/types';
import { cn, formatDateTime } from '@/lib/utils';
import { api } from '@/services/api';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { ScrollArea } from '../ui/scroll-area';

async function getMessagesForUser(userId: string): Promise<Message[]> {
  if (!userId) return [];
  try {
    const data = await api.get(API_ROUTES.MESSAGES_LOGS, { user_id: userId });
    const logsData = Array.isArray(data) ? (data[0]?.data || []) : (data.access_logs || data.data || data.result || []);

    const messages: Message[] = [];
    logsData.forEach((log: any) => {
      if (log.details) {
        messages.push({
          id: `${log.id}-user`,
          user_id: userId,
          content: log.details,
          timestamp: log.timestamp,
          sender: 'user',
          channel: log.channel,
        });
      }
      if (log.response) {
        messages.push({
          id: `${log.id}-system`,
          user_id: userId,
          content: log.response,
          timestamp: log.finished || log.timestamp,
          sender: 'system',
        });
      }
    });

    return messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  } catch (error) {
    console.error("Failed to fetch user messages from logs:", error);
    return [];
  }
}

function formatMessageContent(content: string) {
  if (!content) return { __html: '' };
  let html = content
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code class="bg-muted text-foreground p-1 rounded-sm text-xs">$1</code>')
    .replace(/\n/g, '<br />')
    .replace(/(\r\n|\n|\r)/gm, "<br>");

  html = html.replace(/(<br\s*\/?>|^)([\*\-]\s.*(<br\s*\/?>)?)+/g, (match) => {
    const items = match.trim().split(/<br\s*\/?>/);
    const listItems = items.filter(item => item.trim().startsWith('* ') || item.trim().startsWith('- ')).map(item => `<li>${item.trim().substring(2)}</li>`).join('');
    return `<ul>${listItems}</ul>`;
  });

  return { __html: html };
}

interface UserMessagesProps {
  userId: string;
}

export function UserMessages({ userId }: UserMessagesProps) {
  const t = useTranslations('UserMessages');
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const viewportRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    async function loadMessages() {
      setIsLoading(true);
      const fetchedMessages = await getMessagesForUser(userId);
      setMessages(fetchedMessages);
      setIsLoading(false);
    }
    loadMessages();
  }, [userId]);

  React.useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
  }, [messages, isLoading]);


  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col min-h-0 space-y-4 pt-4">
        <Skeleton className="h-16 w-3/4 self-end" />
        <Skeleton className="h-16 w-3/4" />
        <Skeleton className="h-16 w-3/4 self-end" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <ScrollArea className="flex-1 w-full p-4" viewportRef={viewportRef}>
        <div className="flex flex-col gap-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'flex max-w-[80%] flex-col gap-1',
                message.sender === 'user' ? 'self-end items-end' : 'self-start items-start'
              )}
            >
              <div
                className={cn(
                  'rounded-lg p-3 text-sm',
                  message.sender === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                )}
              >
                <p className="font-semibold capitalize">
                  {message.sender === 'user'
                    ? t('userVia', { channel: message.channel || t('website') })
                    : t('systemResponse')}
                </p>
                <div dangerouslySetInnerHTML={formatMessageContent(message.content)} />
              </div>
              <span className="text-xs text-muted-foreground">
                {formatDateTime(message.timestamp)}
              </span>
            </div>
          ))}
          {messages.length === 0 && (
            <div className="flex h-full items-center justify-center text-muted-foreground min-h-[200px]">
              {t('noMessages')}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
