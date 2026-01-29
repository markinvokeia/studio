
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { MessageSquare, X, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TelegramIcon } from './icons/telegram-icon';
import { WhatsAppIcon } from './icons/whatsapp-icon';

import { useTranslations } from 'next-intl';

export function FloatingActions() {
  const t = useTranslations('FloatingActions');
  const [isChatOpen, setChatOpen] = useState(false);
  const [isMenuOpen, setMenuOpen] = useState(false);

  const toggleChat = () => {
    setChatOpen(!isChatOpen);
    if (!isChatOpen) {
      setMenuOpen(false); // Close main menu if opening chat
    }
  };

  const toggleMenu = () => {
    setMenuOpen(!isMenuOpen);
    if (!isMenuOpen) {
      setChatOpen(false); // Close chat if opening menu
    }
  };

  return (
    <>
      <div className="fixed bottom-4 left-4 z-50 flex flex-col items-start gap-2">
        {isMenuOpen && (
          <>
            <Link href="https://wa.me/59894024661" target="_blank" rel="noopener noreferrer">
              <Button size="icon" className="rounded-full h-12 w-12 bg-green-500 text-white shadow-lg hover:bg-green-600">
                <WhatsAppIcon className="h-6 w-6" />
                <span className="sr-only">{t('openWhatsapp')}</span>
              </Button>
            </Link>
            <Link href="https://t.me/InvokIA_bot" target="_blank" rel="noopener noreferrer">
              <Button size="icon" className="rounded-full h-12 w-12 bg-blue-500 text-white shadow-lg hover:bg-blue-600">
                <TelegramIcon className="h-6 w-6" />
                <span className="sr-only">{t('openTelegram')}</span>
              </Button>
            </Link>
            <Button onClick={toggleChat} size="icon" className="rounded-full h-12 w-12 bg-purple-500 text-white shadow-lg hover:bg-purple-600">
              <MessageSquare className="h-6 w-6" />
              <span className="sr-only">{t('openChat')}</span>
            </Button>
          </>
        )}
        <Button onClick={toggleMenu} size="sm" className="rounded-full h-10 w-10 p-0 bg-black text-white shadow-lg hover:bg-gray-800">
          {isMenuOpen ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
          <span className="sr-only">{isMenuOpen ? t('closeMenu') : t('openMenu')}</span>
        </Button>
      </div>

      <div
        className={cn(
          'fixed bottom-20 left-4 z-50 w-full max-w-sm rounded-lg border bg-card shadow-lg transition-all duration-300 ease-in-out',
          isChatOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        )}
      >
        <Card className="flex flex-col h-[60vh]">
          <CardHeader className="flex flex-row items-center justify-between p-4 border-b">
            <CardTitle className="text-lg">{t('chatbotTitle')}</CardTitle>
            <Button variant="ghost" size="icon" onClick={toggleChat}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            <iframe
              src={`${process.env.NEXT_PUBLIC_API_URL}/webhook/a8ad846b-de6a-4d89-8e02-01072101cfe6/chat`}
              className="w-full h-full border-0"
              title="n8n Chatbot"
            ></iframe>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
