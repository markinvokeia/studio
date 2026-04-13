'use client';

import { Loader2, Mic } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// ── Web Speech API types (not always exported from lib.dom.d.ts) ──────────────
interface ISpeechRecognitionEvent extends Event {
    readonly resultIndex: number;
    readonly results: SpeechRecognitionResultList;
}
interface ISpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onresult: ((this: ISpeechRecognition, ev: ISpeechRecognitionEvent) => void) | null;
    onerror: ((this: ISpeechRecognition, ev: Event) => void) | null;
    onend: ((this: ISpeechRecognition, ev: Event) => void) | null;
    start(): void;
    stop(): void;
    abort(): void;
}
interface ISpeechRecognitionConstructor {
    new (): ISpeechRecognition;
}
declare const SpeechRecognition: ISpeechRecognitionConstructor | undefined;
declare const webkitSpeechRecognition: ISpeechRecognitionConstructor | undefined;

// ─────────────────────────────────────────────────────────────────────────────

type VoiceState = 'idle' | 'listening' | 'recording' | 'processing';

// Silence: RMS below this value (0-255 scale) for SILENCE_DURATION_MS → auto-stop
const SILENCE_THRESHOLD_RMS = 12;
const SILENCE_DURATION_MS = 2000;

const WAKE_PHRASES = [
    'hey invoke', 'hei invoke', 'ei invoke', 'oye invoke', 'hey invoque',
    'hey in vogue', 'hey in boke', 'hay invoke',
];

// Words that trigger manual stop while recording
const STOP_WORDS = ['enviar', 'send', 'listo', 'done', 'terminar'];

interface VoiceAssistantProps {
    /** Called when the user finishes recording — parent handles sending + chat */
    onAudioReady: (blob: Blob) => void;
    /** True while parent is processing/sending the audio */
    isProcessing: boolean;
}

export function VoiceAssistant({ onAudioReady, isProcessing }: VoiceAssistantProps) {
    const t = useTranslations('VoiceAssistant');
    const { toast } = useToast();

    const [voiceState, setVoiceState] = React.useState<VoiceState>('idle');
    const [audioLevel, setAudioLevel] = React.useState<number[]>([2, 2, 2, 2, 2]);

    const voiceStateRef = React.useRef<VoiceState>('idle');
    // Ref to break circular dep between startRecording ↔ startWakeWordListening
    const startWakeWordListeningRef = React.useRef<() => void>(() => {});
    const wakeRecognitionRef = React.useRef<ISpeechRecognition | null>(null);
    const stopRecognitionRef = React.useRef<ISpeechRecognition | null>(null);
    const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
    const audioChunksRef = React.useRef<Blob[]>([]);
    const audioContextRef = React.useRef<AudioContext | null>(null);
    const animFrameRef = React.useRef<number | null>(null);
    const streamRef = React.useRef<MediaStream | null>(null);
    const silenceStartRef = React.useRef<number | null>(null);

    const getSpeechRecognitionCtor = (): ISpeechRecognitionConstructor | undefined =>
        (typeof SpeechRecognition !== 'undefined' ? SpeechRecognition : undefined) ??
        (typeof webkitSpeechRecognition !== 'undefined' ? webkitSpeechRecognition : undefined);

    const setState = (s: VoiceState) => {
        voiceStateRef.current = s;
        setVoiceState(s);
    };

    // ── Cleanup ───────────────────────────────────────────────────────────────

    const stopAnimFrame = React.useCallback(() => {
        if (animFrameRef.current !== null) {
            cancelAnimationFrame(animFrameRef.current);
            animFrameRef.current = null;
        }
    }, []);

    const releaseStream = React.useCallback(async () => {
        stopAnimFrame();
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            await audioContextRef.current.close();
        }
        audioContextRef.current = null;
    }, [stopAnimFrame]);

    const stopStopWordRecognition = React.useCallback(() => {
        try { stopRecognitionRef.current?.stop(); } catch { /* ignore */ }
        stopRecognitionRef.current = null;
    }, []);

    // ── Stop recording → emit blob ────────────────────────────────────────────

    const stopRecording = React.useCallback(async () => {
        stopStopWordRecognition();
        stopAnimFrame();
        setAudioLevel([2, 2, 2, 2, 2]);

        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state !== 'inactive') {
            recorder.stop(); // onstop fires → onAudioReady
        }
        await releaseStream();
    }, [stopAnimFrame, releaseStream, stopStopWordRecognition]);

    // ── "enviar" stop-word recognition (runs while recording) ────────────────

    const startStopWordRecognition = React.useCallback(() => {
        const SR = getSpeechRecognitionCtor();
        if (!SR) return;

        const recognition = new SR();
        stopRecognitionRef.current = recognition;
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = 'es-ES'; // stop words are Spanish

        recognition.onresult = (event: ISpeechRecognitionEvent) => {
            if (voiceStateRef.current !== 'recording') return;
            const transcript = Array.from(event.results)
                .map((r: SpeechRecognitionResult) => r[0].transcript.toLowerCase().trim())
                .join(' ');

            if (STOP_WORDS.some((w) => transcript.includes(w))) {
                stopRecording();
            }
        };

        recognition.onend = () => {
            // Restart if still recording
            if (voiceStateRef.current === 'recording') {
                setTimeout(() => {
                    if (voiceStateRef.current === 'recording') startStopWordRecognition();
                }, 200);
            }
        };

        try { recognition.start(); } catch { /* ignore */ }
    }, [stopRecording]);

    // ── Start recording + VAD ─────────────────────────────────────────────────

    const startRecording = React.useCallback(async () => {
        if (voiceStateRef.current === 'recording') return;
        setState('recording');
        silenceStartRef.current = null;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            streamRef.current = stream;

            const audioCtx = new AudioContext();
            audioContextRef.current = audioCtx;
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            audioCtx.createMediaStreamSource(stream).connect(analyser);

            const dataArray = new Uint8Array(analyser.frequencyBinCount);

            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus'
                : 'audio/webm';
            const recorder = new MediaRecorder(stream, { mimeType });
            mediaRecorderRef.current = recorder;
            audioChunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            recorder.onstop = async () => {
                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                await releaseStream();

                if (blob.size > 1000) {
                    setState('processing');
                    onAudioReady(blob);
                } else {
                    setState('listening');
                    startWakeWordListeningRef.current();
                }
            };

            recorder.start(100);

            // Start stop-word recognition in parallel
            startStopWordRecognition();

            // VAD loop
            const BAR_COUNT = 5;
            const checkSilence = () => {
                if (voiceStateRef.current !== 'recording') return;
                analyser.getByteFrequencyData(dataArray);

                const rms = Math.sqrt(
                    dataArray.reduce((s, v) => s + v * v, 0) / dataArray.length,
                );

                const bars = Array.from({ length: BAR_COUNT }, (_, i) => {
                    const offset = Math.floor((i / BAR_COUNT) * dataArray.length);
                    const slice = dataArray.slice(offset, offset + 4);
                    const avg = slice.reduce((s, v) => s + v, 0) / slice.length;
                    return Math.max(2, (avg / 255) * 28);
                });
                setAudioLevel(bars);

                if (rms < SILENCE_THRESHOLD_RMS) {
                    if (silenceStartRef.current === null) {
                        silenceStartRef.current = Date.now();
                    } else if (Date.now() - silenceStartRef.current >= SILENCE_DURATION_MS) {
                        stopRecording();
                        return;
                    }
                } else {
                    silenceStartRef.current = null;
                }

                animFrameRef.current = requestAnimationFrame(checkSilence);
            };
            animFrameRef.current = requestAnimationFrame(checkSilence);
        } catch {
            toast({ title: t('micError'), variant: 'destructive', duration: 4000 });
            setState('listening');
            startWakeWordListeningRef.current();
        }
    }, [onAudioReady, releaseStream, startStopWordRecognition, stopRecording, t, toast]);

    // ── Wake word detection ───────────────────────────────────────────────────

    const startWakeWordListening = React.useCallback(() => {
        if (typeof window === 'undefined') return;

        const SR = getSpeechRecognitionCtor();
        if (!SR) return;

        if (wakeRecognitionRef.current) {
            try { wakeRecognitionRef.current.abort(); } catch { /* ignore */ }
        }

        const recognition = new SR();
        wakeRecognitionRef.current = recognition;
        recognition.continuous = true;
        recognition.interimResults = true;
        // Use en-US: "Invoke" is English — es-ES often mishears it
        recognition.lang = 'en-US';

        recognition.onresult = (event: ISpeechRecognitionEvent) => {
            if (voiceStateRef.current !== 'listening') return;

            const transcript = Array.from(event.results)
                .map((r: SpeechRecognitionResult) => r[0].transcript.toLowerCase())
                .join(' ');

            if (WAKE_PHRASES.some((phrase) => transcript.includes(phrase))) {
                recognition.abort();
                startRecording();
            }
        };

        const reschedule = (delay: number) => {
            setTimeout(() => {
                if (voiceStateRef.current === 'listening') startWakeWordListening();
            }, delay);
        };

        recognition.onerror = () => reschedule(1500);
        recognition.onend = () => reschedule(300);

        setState('listening');
        try { recognition.start(); } catch { /* ignore duplicate start */ }
    }, [startRecording]);

    // Keep ref in sync so startRecording can call it without circular deps
    React.useEffect(() => {
        startWakeWordListeningRef.current = startWakeWordListening;
    }, [startWakeWordListening]);

    // ── Pause wake-word listening when tab is hidden ──────────────────────────
    // SpeechRecognition keeps a live audio session even in background tabs,
    // preventing Chrome from throttling or suspending the process.
    React.useEffect(() => {
        const handleVisibility = () => {
            if (document.hidden) {
                // Tab hidden — stop recognition to release mic + CPU
                if (voiceStateRef.current === 'listening') {
                    voiceStateRef.current = 'idle';
                    setVoiceState('idle');
                    try { wakeRecognitionRef.current?.abort(); } catch { /* ignore */ }
                    wakeRecognitionRef.current = null;
                }
            } else {
                // Tab visible again — resume if not recording/processing
                if (voiceStateRef.current === 'idle') {
                    startWakeWordListening();
                }
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, [startWakeWordListening]);

    // ── Sync processing state from parent ────────────────────────────────────

    React.useEffect(() => {
        if (!isProcessing && voiceStateRef.current === 'processing') {
            setState('listening');
            startWakeWordListening();
        }
    }, [isProcessing, startWakeWordListening]);

    // ── Mount / unmount ───────────────────────────────────────────────────────

    React.useEffect(() => {
        startWakeWordListening();
        return () => {
            voiceStateRef.current = 'idle';
            try { wakeRecognitionRef.current?.abort(); } catch { /* ignore */ }
            try { stopRecognitionRef.current?.abort(); } catch { /* ignore */ }
            stopAnimFrame();
            streamRef.current?.getTracks().forEach((t) => t.stop());
            if (audioContextRef.current?.state !== 'closed') {
                audioContextRef.current?.close();
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Manual click ─────────────────────────────────────────────────────────

    const handleClick = () => {
        if (isProcessing) return;
        if (voiceStateRef.current === 'recording') {
            stopRecording();
        } else if (voiceStateRef.current !== 'processing') {
            try { wakeRecognitionRef.current?.abort(); } catch { /* ignore */ }
            startRecording();
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────

    const isRecording = voiceState === 'recording';
    const isListening = voiceState === 'listening';

    return (
        <div className="relative flex flex-col items-center">
            <Button
                variant="ghost"
                size="icon"
                onClick={handleClick}
                disabled={isProcessing}
                title={
                    isRecording
                        ? t('clickToStop')
                        : isListening
                          ? t('listeningForWakeWord')
                          : t('clickToSpeak')
                }
                className={cn(
                    'rounded-full h-9 w-9 relative transition-all duration-200',
                    isRecording && 'bg-red-500/15 text-red-600 hover:bg-red-500/25',
                    isProcessing && 'opacity-60 cursor-not-allowed',
                )}
            >
                {isProcessing ? (
                    <Loader2 className="h-5 w-5 animate-spin text-purple-500" />
                ) : (
                    <Mic
                        className={cn(
                            'h-5 w-5 transition-colors',
                            isRecording && 'text-red-600',
                            isListening && 'text-muted-foreground',
                        )}
                    />
                )}

                {/* Pulsing ring while recording */}
                {isRecording && (
                    <span className="absolute inset-0 rounded-full border-2 border-red-500 animate-ping opacity-60" />
                )}

                {/* Green dot: wake word active */}
                {isListening && (
                    <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-green-500 animate-pulse shadow-sm shadow-green-500/50" />
                )}
            </Button>

            {/* Audio level bars while recording */}
            {isRecording && (
                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 flex items-end gap-[2px]">
                    {audioLevel.map((h, i) => (
                        <div
                            key={i}
                            className="w-[3px] rounded-full bg-red-500 transition-all duration-75"
                            style={{ height: `${h}px` }}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
