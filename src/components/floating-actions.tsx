'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { MessageSquare, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TelegramIcon } from './icons/telegram-icon';
import { WhatsAppIcon } from './icons/whatsapp-icon';

export function FloatingActions() {
  const [isOpen, setIsOpen] = useState(false);

  const toggleChat = () => {
    setIsOpen(!isOpen);
  };

  return (
    <>
      <div className="fixed bottom-4 left-4 z-50 flex flex-col items-start gap-2">
         <Link href="https://wa.me/59894024661" target="_blank" rel="noopener noreferrer">
          <Button size="icon" className="rounded-full h-12 w-12 bg-green-500 text-white shadow-lg hover:bg-green-600">
            <WhatsAppIcon className="h-6 w-6" />
            <span className="sr-only">Open WhatsApp</span>
          </Button>
        </Link>
         <Link href="https://t.me/InvokIA_bot" target="_blank" rel="noopener noreferrer">
          <Button size="icon" className="rounded-full h-12 w-12 bg-blue-500 text-white shadow-lg hover:bg-blue-600">
            <TelegramIcon className="h-6 w-6" />
            <span className="sr-only">Open Telegram</span>
          </Button>
        </Link>
        <Button onClick={toggleChat} size="icon" className="rounded-full h-12 w-12 bg-fuchsia-600 text-primary-foreground shadow-lg hover:bg-fuchsia-700">
          {isOpen ? <X className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
          <span className="sr-only">{isOpen ? 'Close Chat' : 'Open Chat'}</span>
        </Button>
      </div>

      <div
        className={cn(
          'fixed bottom-20 left-4 z-50 w-full max-w-sm rounded-lg border bg-card shadow-lg transition-all duration-300 ease-in-out',
          isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        )}
      >
        <Card className="flex flex-col h-[60vh]">
          <CardHeader className="flex flex-row items-center justify-between p-4 border-b">
            <CardTitle className="text-lg">Chatbot</CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            <iframe
              src="https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/a8ad846b-de6a-4d89-8e02-01072101cfe6/chat"
              className="w-full h-full border-0"
              title="n8n Chatbot"
            ></iframe>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
