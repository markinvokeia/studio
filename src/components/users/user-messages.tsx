'use client';

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Message } from '@/lib/types';
import { messages as mockMessages } from '@/lib/data';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

async function getMessagesForUser(userId: string): Promise<Message[]> {
  if (!userId) return [];
  // Simulate API call and filter messages for the user.
  // In a real app, you'd fetch this from your backend.
  return Promise.resolve(mockMessages.filter(msg => msg.user_id === userId || msg.user_id === 'mock_user'));
}

interface UserMessagesProps {
  userId: string;
}

export function UserMessages({ userId }: UserMessagesProps) {
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    async function loadMessages() {
      setIsLoading(true);
      // We use a mock user ID here to ensure we get the sample data.
      const fetchedMessages = await getMessagesForUser('mock_user');
      setMessages(fetchedMessages);
      setIsLoading(false);
    }
    loadMessages();
  }, [userId]);

  React.useEffect(() => {
    if (scrollAreaRef.current) {
        // This is a bit of a hack since ScrollArea doesn't expose the viewport ref directly
        const viewport = scrollAreaRef.current.querySelector('div[style*="overflow: scroll"]');
        if (viewport) {
            viewport.scrollTop = viewport.scrollHeight;
        }
    }
  }, [messages]);


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
        <ScrollArea className="h-[400px] w-full p-4" ref={scrollAreaRef}>
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
