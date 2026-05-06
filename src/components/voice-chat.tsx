'use client';

import { Mic, Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    isVoice?: boolean;
    timestamp: Date;
}

interface VoiceChatProps {
    messages: ChatMessage[];
    onSendText: (text: string) => void;
    isSending: boolean;
}

export function VoiceChat({ messages, onSendText, isSending }: VoiceChatProps) {
    const t = useTranslations('VoiceChat');
    const [input, setInput] = React.useState('');
    const bottomRef = React.useRef<HTMLDivElement>(null);
    const viewportRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isSending]);

    const handleMessagesWheel = React.useCallback((event: React.WheelEvent<HTMLDivElement>) => {
        const viewport = viewportRef.current;
        if (!viewport) return;

        const canScrollVertically = viewport.scrollHeight > viewport.clientHeight;
        const canScrollHorizontally = viewport.scrollWidth > viewport.clientWidth;

        if (!canScrollVertically && !canScrollHorizontally) return;

        event.preventDefault();
        event.stopPropagation();

        if (canScrollVertically) {
            viewport.scrollTop += event.deltaY;
        }

        if (canScrollHorizontally && event.deltaX !== 0) {
            viewport.scrollLeft += event.deltaX;
        }
    }, []);

    const handleSend = () => {
        const text = input.trim();
        if (!text || isSending) return;
        setInput('');
        onSendText(text);
    };

    return (
        <div className="flex flex-col h-full">
            <ScrollArea
                className="flex-1 px-3 py-2"
                viewportRef={viewportRef}
                onWheelCapture={handleMessagesWheel}
            >
                <div className="flex flex-col gap-2">
                    {messages.length === 0 && (
                        <p className="text-center text-xs text-muted-foreground mt-10 px-4">
                            {t('emptyState')}
                        </p>
                    )}

                    {messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={cn(
                                'flex',
                                msg.role === 'user' ? 'justify-end' : 'justify-start',
                            )}
                        >
                            <div
                                className={cn(
                                    'max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed',
                                    msg.role === 'user'
                                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                                        : 'bg-muted text-foreground rounded-bl-sm',
                                )}
                            >
                                {msg.isVoice && msg.role === 'user' && (
                                    <span className="flex items-center gap-1 text-[10px] opacity-60 mb-0.5">
                                        <Mic className="h-2.5 w-2.5" />
                                        {t('voiceMessage')}
                                    </span>
                                )}
                                <p className="whitespace-pre-wrap">{msg.content}</p>
                            </div>
                        </div>
                    ))}

                    {isSending && (
                        <div className="flex justify-start">
                            <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3">
                                <span className="flex gap-1 items-center">
                                    <span className="h-1.5 w-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.3s]" />
                                    <span className="h-1.5 w-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.15s]" />
                                    <span className="h-1.5 w-1.5 bg-muted-foreground rounded-full animate-bounce" />
                                </span>
                            </div>
                        </div>
                    )}

                    <div ref={bottomRef} />
                </div>
            </ScrollArea>

            <div className="flex gap-2 p-3 border-t shrink-0">
                <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                        }
                    }}
                    placeholder={t('inputPlaceholder')}
                    className="text-sm rounded-full"
                    disabled={isSending}
                    autoFocus
                />
                <Button
                    size="icon"
                    onClick={handleSend}
                    disabled={!input.trim() || isSending}
                    className="rounded-full shrink-0"
                >
                    <Send className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
