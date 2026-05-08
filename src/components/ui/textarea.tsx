'use client';

import * as React from 'react';

import { Mic, Square } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import {cn} from '@/lib/utils';

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

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

type TextareaProps = React.ComponentProps<'textarea'> & {
  disableSpeechInput?: boolean;
};

function setRef<T>(ref: React.ForwardedRef<T>, value: T) {
  if (typeof ref === 'function') {
    ref(value);
    return;
  }

  if (ref) {
    ref.current = value;
  }
}

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;

  const browserWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

  return browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition ?? null;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({className, disableSpeechInput = false, disabled, readOnly, onBlur, ...props}, ref) => {
    const t = useTranslations('VoiceInput');
    const locale = useLocale();
    const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
    const recognitionRef = React.useRef<BrowserSpeechRecognition | null>(null);
    const selectionRef = React.useRef<{start: number; end: number}>({start: 0, end: 0});
    const [speechSupported, setSpeechSupported] = React.useState(false);
    const [isListening, setIsListening] = React.useState(false);

    React.useEffect(() => {
      setSpeechSupported(Boolean(getSpeechRecognitionConstructor()));
    }, []);

    React.useEffect(() => {
      return () => {
        recognitionRef.current?.abort();
      };
    }, []);

    const setTextareaRefs = React.useCallback(
      (node: HTMLTextAreaElement | null) => {
        textareaRef.current = node;
        setRef(ref, node);
      },
      [ref],
    );

    const insertTranscript = React.useCallback((rawTranscript: string) => {
      const textarea = textareaRef.current;
      const transcript = rawTranscript.trim();

      if (!textarea || !transcript) return;

      const start = selectionRef.current.start;
      const end = selectionRef.current.end;
      const currentValue = textarea.value;
      const previousChar = start > 0 ? currentValue[start - 1] : '';
      const nextChar = end < currentValue.length ? currentValue[end] : '';

      const needsLeadingSpace = previousChar !== '' && !/\s|\(|\[|["'/-]/.test(previousChar);
      const needsTrailingSpace = nextChar !== '' && !/[\s.,;:!?)]/.test(nextChar);
      const transcriptWithSpacing = `${needsLeadingSpace ? ' ' : ''}${transcript}${needsTrailingSpace ? ' ' : ''}`;

      textarea.focus();
      textarea.setSelectionRange(start, end);
      textarea.setRangeText(transcriptWithSpacing, start, end, 'end');
      selectionRef.current = {
        start: textarea.selectionStart ?? start + transcriptWithSpacing.length,
        end: textarea.selectionEnd ?? start + transcriptWithSpacing.length,
      };
      textarea.dispatchEvent(new Event('input', {bubbles: true}));
    }, []);

    const handleToggleRecording = React.useCallback(() => {
      if (disabled || readOnly) return;

      const textarea = textareaRef.current;
      if (!textarea) return;

      if (isListening) {
        recognitionRef.current?.stop();
        return;
      }

      const Recognition = getSpeechRecognitionConstructor();
      if (!Recognition) return;

      if (!recognitionRef.current) {
        recognitionRef.current = new Recognition();
      }

      const recognition = recognitionRef.current;
      selectionRef.current = {
        start: textarea.selectionStart ?? textarea.value.length,
        end: textarea.selectionEnd ?? textarea.value.length,
      };

      recognition.lang = locale;
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.onresult = (event) => {
        let transcript = '';

        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          if (result?.isFinal) {
            transcript += result[0]?.transcript ?? '';
          }
        }

        insertTranscript(transcript);
      };
      recognition.onerror = (event) => {
        if (event.error !== 'no-speech') {
          console.error('Speech recognition error:', event.error);
        }
        setIsListening(false);
      };
      recognition.onend = () => {
        setIsListening(false);
      };

      try {
        recognition.start();
        setIsListening(true);
      } catch (error) {
        console.error('Failed to start speech recognition:', error);
        setIsListening(false);
      }
    }, [disabled, insertTranscript, isListening, locale, readOnly]);

    const showSpeechInput = speechSupported && !disableSpeechInput && !disabled && !readOnly;

    return (
      <div className="relative">
        <textarea
          className={cn(
            'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
            showSpeechInput && 'pr-11',
            className
          )}
          ref={setTextareaRefs}
          disabled={disabled}
          readOnly={readOnly}
          onBlur={(event) => {
            selectionRef.current = {
              start: event.currentTarget.selectionStart ?? event.currentTarget.value.length,
              end: event.currentTarget.selectionEnd ?? event.currentTarget.value.length,
            };
            onBlur?.(event);
          }}
          {...props}
        />
        {showSpeechInput && (
          <button
            type="button"
            onClick={handleToggleRecording}
            className={cn(
              'absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/70 bg-background/95 text-muted-foreground shadow-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
              isListening && 'border-red-200 text-red-600'
            )}
            aria-label={isListening ? t('stopDictation') : t('startDictation')}
            title={isListening ? t('stopDictation') : t('startDictation')}
          >
            {isListening ? <Square className="h-3.5 w-3.5 fill-current" /> : <Mic className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';

export {Textarea};
