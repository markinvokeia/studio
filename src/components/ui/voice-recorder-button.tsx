'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Mic, Square } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface BrowserSpeechRecognitionErrorEvent {
  error: string;
}

interface BrowserSpeechRecognitionAlternative {
  transcript: string;
}

interface BrowserSpeechRecognitionResult {
  0: BrowserSpeechRecognitionAlternative;
  isFinal: boolean;
  length: number;
}

interface BrowserSpeechRecognitionResultEvent {
  resultIndex: number;
  results: ArrayLike<BrowserSpeechRecognitionResult>;
}

interface BrowserSpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: (() => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onresult: ((event: BrowserSpeechRecognitionResultEvent) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;

  const browserWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

  return browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition ?? null;
}

interface VoiceRecorderButtonProps {
  disabled?: boolean;
  locale: string;
  onTranscriptReady: (transcript: string) => Promise<void> | void;
}

export function VoiceRecorderButton({ disabled = false, locale, onTranscriptReady }: VoiceRecorderButtonProps) {
  const t = useTranslations('VoiceAssistant');
  const [isRecording, setIsRecording] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const recognitionRef = React.useRef<BrowserSpeechRecognition | null>(null);
  const transcriptRef = React.useRef('');

  const stopRecognition = React.useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore
    }
  }, []);

  const startRecognition = React.useCallback(() => {
    const Recognition = getSpeechRecognitionConstructor();
    if (!Recognition) return;

    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.lang = locale;
    recognition.continuous = true;
    recognition.interimResults = false;
    transcriptRef.current = '';

    recognition.onresult = (event) => {
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result?.isFinal) {
          transcriptRef.current += `${result[0]?.transcript ?? ''} `;
        }
      }
    };

    recognition.onerror = () => {
      setIsRecording(false);
    };

    recognition.onend = async () => {
      recognitionRef.current = null;
      setIsRecording(false);
      const transcript = transcriptRef.current.trim();
      if (!transcript) return;

      setIsProcessing(true);
      try {
        await onTranscriptReady(transcript);
      } finally {
        setIsProcessing(false);
      }
    };

    try {
      recognition.start();
      setIsRecording(true);
    } catch {
      recognitionRef.current = null;
      setIsRecording(false);
    }
  }, [locale, onTranscriptReady]);

  React.useEffect(() => {
    return () => {
      stopRecognition();
    };
  }, [stopRecognition]);

  const handleClick = () => {
    if (disabled || isProcessing) return;
    if (isRecording) {
      stopRecognition();
      return;
    }
    startRecognition();
  };

  return (
    <div className="relative flex items-center justify-center">
      <Button
        type="button"
        size="icon"
        variant="outline"
        onClick={handleClick}
        disabled={disabled || isProcessing}
        className={cn(
          'relative rounded-full shrink-0',
          isRecording && 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100',
        )}
        title={isRecording ? t('clickToStop') : t('clickToSpeak')}
      >
        {isRecording ? (
          <Square className="h-4 w-4 fill-current" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
        {isRecording && <span className="absolute inset-0 rounded-full border-2 border-red-500 animate-ping opacity-50" />}
      </Button>
    </div>
  );
}
