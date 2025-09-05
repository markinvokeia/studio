'use client';

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Message } from '@/lib/types';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

async function getMessagesForUser(userId: string): Promise<Message[]> {
  if (!userId) return [];
  try {
    const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/access_logs?user_id=${userId}`, {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
        },
        cache: 'no-store',
    });

    if (!response.ok) {
        console.error(`HTTP error! status: ${response.status}`);
        return [];
    }

    const data = await response.json();
    const logsData = Array.isArray(data) ? (data[0]?.data || []) : (data.access_logs || data.data || data.result || []);

    const messages: Message[] = [];
    logsData.forEach((log: any) => {
        if(log.details) {
            messages.push({
                id: `${log.id}-user`,
                user_id: userId,
                content: log.details,
                timestamp: log.timestamp,
                sender: 'user',
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

interface UserMessagesProps {
  userId: string;
}

export function UserMessages({ userId }: UserMessagesProps) {
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
      <div className="space-y-4 pt-4">
        <Skeleton className="h-16 w-3/4 self-end" />
        <Skeleton className="h-16 w-3/4" />
        <Skeleton className="h-16 w-3/4 self-end" />
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px] w-full p-4" viewportRef={viewportRef}>
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
                  <p className="font-semibold capitalize">{message.sender === 'user' ? 'User' : 'System Response'}</p>
                  <p>{message.content}</p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(message.timestamp), 'PPpp')}
                </span>
              </div>
            ))}
             {messages.length === 0 && (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                    No messages found for this user.
                </div>
             )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
