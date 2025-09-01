'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquare, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);

  const toggleChat = () => {
    setIsOpen(!isOpen);
  };

  return (
    <>
      <div className="fixed bottom-4 right-4 z-50">
        <Button onClick={toggleChat} size="icon" className="rounded-full h-14 w-14 bg-primary text-primary-foreground shadow-lg hover:bg-primary/90">
          {isOpen ? <X className="h-6 w-6" /> : <MessageSquare className="h-6 w-6" />}
          <span className="sr-only">{isOpen ? 'Close Chat' : 'Open Chat'}</span>
        </Button>
      </div>

      <div
        className={cn(
          'fixed bottom-20 right-4 z-50 w-full max-w-sm rounded-lg border bg-card shadow-lg transition-all duration-300 ease-in-out',
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
