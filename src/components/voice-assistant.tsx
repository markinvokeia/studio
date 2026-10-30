'use client';

import { Loader2, Mic, MicOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// ── Web Speech API types ──────────────────────────────────────────────────────
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

type VoiceState = 'idle' | 'recording' | 'processing';

const SILENCE_THRESHOLD_RMS = 12;
const SILENCE_DURATION_MS = 2000;
const STOP_WORDS = ['enviar', 'send', 'listo', 'done', 'terminar'];

interface VoiceAssistantProps {
    onAudioReady: (blob: Blob) => void;
    isProcessing: boolean;
    onTranscriptReady?: (text: string, blob: Blob) => void;
}

export function VoiceAssistant({ onAudioReady, isProcessing, onTranscriptReady }: VoiceAssistantProps) {
    const t = useTranslations('VoiceAssistant');
    const { toast } = useToast();

    const [voiceState, setVoiceState] = React.useState<VoiceState>('idle');
    const [audioLevel, setAudioLevel] = React.useState<number[]>([2, 2, 2, 2, 2]);

    const voiceStateRef = React.useRef<VoiceState>('idle');
    const stopRecognitionRef = React.useRef<ISpeechRecognition | null>(null);
    const transcriptRecognitionRef = React.useRef<ISpeechRecognition | null>(null);
    const rollingTranscriptRef = React.useRef<string>('');
    const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
    const audioChunksRef = React.useRef<Blob[]>([]);
    const audioContextRef = React.useRef<AudioContext | null>(null);
    const animFrameRef = React.useRef<number | null>(null);
    const streamRef = React.useRef<MediaStream | null>(null);
    const silenceStartRef = React.useRef<number | null>(null);
    const lastAudioLevelUpdateRef = React.useRef(0);

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

    const stopTranscriptRecognition = React.useCallback(() => {
        try { transcriptRecognitionRef.current?.stop(); } catch { /* ignore */ }
        transcriptRecognitionRef.current = null;
    }, []);

    // ── Stop recording → emit blob ────────────────────────────────────────────

    const stopRecording = React.useCallback(async () => {
        stopStopWordRecognition();
        stopTranscriptRecognition();
        stopAnimFrame();
        setAudioLevel([2, 2, 2, 2, 2]);

        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state !== 'inactive') {
            recorder.stop();
        }
        await releaseStream();
    }, [stopAnimFrame, releaseStream, stopStopWordRecognition, stopTranscriptRecognition]);

    // ── Stop-word recognition ─────────────────────────────────────────────────

    const startStopWordRecognition = React.useCallback(() => {
        const SR = getSpeechRecognitionCtor();
        if (!SR) return;

        const recognition = new SR();
        stopRecognitionRef.current = recognition;
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = 'es-ES';

        recognition.onresult = (event: ISpeechRecognitionEvent) => {
            if (voiceStateRef.current !== 'recording') return;
            const transcript = Array.from(event.results)
                .map((r: SpeechRecognitionResult) => r[0].transcript.toLowerCase().trim())
                .join(' ');
            if (STOP_WORDS.some((w) => transcript.includes(w))) stopRecording();
        };

        recognition.onend = () => {
            if (voiceStateRef.current === 'recording') {
                setTimeout(() => {
                    if (voiceStateRef.current === 'recording') startStopWordRecognition();
                }, 200);
            }
        };

        try { recognition.start(); } catch { /* ignore */ }
    }, [stopRecording]);

    // ── Transcript recognition ────────────────────────────────────────────────

    const startTranscriptRecognition = React.useCallback(() => {
        const SR = getSpeechRecognitionCtor();
        if (!SR) return;

        const recognition = new SR();
        transcriptRecognitionRef.current = recognition;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'es-ES';

        recognition.onresult = (event: ISpeechRecognitionEvent) => {
            if (voiceStateRef.current !== 'recording') return;
            let transcript = '';
            for (let i = 0; i < event.results.length; i++) {
                if (event.results[i].isFinal) transcript += event.results[i][0].transcript;
            }
            if (transcript) rollingTranscriptRef.current = transcript.trim();
        };

        recognition.onend = () => {
            if (voiceStateRef.current === 'recording') {
                setTimeout(() => {
                    if (voiceStateRef.current === 'recording') startTranscriptRecognition();
                }, 150);
            }
        };

        recognition.onerror = () => { transcriptRecognitionRef.current = null; };

        try { recognition.start(); } catch { /* ignore */ }
    }, []);

    // ── Start recording ───────────────────────────────────────────────────────

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
                const transcript = rollingTranscriptRef.current;
                await releaseStream();

                if (blob.size > 1000) {
                    setState('processing');
                    if (onTranscriptReady && transcript.length > 10) {
                        onTranscriptReady(transcript, blob);
                    } else {
                        onAudioReady(blob);
                    }
                } else {
                    setState('idle');
                }
            };

            recorder.start(100);

            rollingTranscriptRef.current = '';
            startStopWordRecognition();
            startTranscriptRecognition();

            // VAD loop
            const BAR_COUNT = 5;
            const checkSilence = () => {
                if (voiceStateRef.current !== 'recording') return;
                analyser.getByteFrequencyData(dataArray);

                const rms = Math.sqrt(dataArray.reduce((s, v) => s + v * v, 0) / dataArray.length);

                const now = performance.now();
                if (now - lastAudioLevelUpdateRef.current >= 100) {
                    lastAudioLevelUpdateRef.current = now;
                    const bars = Array.from({ length: BAR_COUNT }, (_, i) => {
                        const offset = Math.floor((i / BAR_COUNT) * dataArray.length);
                        const slice = dataArray.slice(offset, offset + 4);
                        const avg = slice.reduce((s, v) => s + v, 0) / slice.length;
                        return Math.max(2, (avg / 255) * 28);
                    });
                    setAudioLevel(bars);
                }

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
            toast({ title: t('micError'), variant: 'destructive' });
            setState('idle');
        }
    }, [onAudioReady, onTranscriptReady, releaseStream, startStopWordRecognition, startTranscriptRecognition, stopRecording, t, toast]);

    // ── Sync processing → idle when parent finishes ───────────────────────────

    React.useEffect(() => {
        if (!isProcessing && voiceStateRef.current === 'processing') {
            setState('idle');
        }
    }, [isProcessing]);

    // ── Unmount cleanup ───────────────────────────────────────────────────────

    React.useEffect(() => {
        return () => {
            voiceStateRef.current = 'idle';
            try { stopRecognitionRef.current?.abort(); } catch { /* ignore */ }
            try { transcriptRecognitionRef.current?.abort(); } catch { /* ignore */ }
            stopAnimFrame();
            streamRef.current?.getTracks().forEach((t) => t.stop());
            if (audioContextRef.current?.state !== 'closed') audioContextRef.current?.close();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Manual click ──────────────────────────────────────────────────────────

    const handleClick = () => {
        if (isProcessing) return;
        if (voiceStateRef.current === 'recording') {
            stopRecording();
        } else if (voiceStateRef.current === 'idle') {
            startRecording();
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────

    const isRecording = voiceState === 'recording';

    return (
        <div className="relative flex flex-col items-center">
            <Button
                variant="ghost"
                size="icon"
                onClick={handleClick}
                disabled={isProcessing}
                title={isRecording ? t('clickToStop') : t('clickToSpeak')}
                className={cn(
                    'rounded-xl h-10 w-10 relative transition-all duration-200',
                    isRecording
                        ? 'bg-red-500/15 text-red-600 hover:bg-red-500/25'
                        : isProcessing
                            ? 'bg-muted/60 opacity-60 cursor-not-allowed'
                            : 'bg-muted/60 text-muted-foreground hover:bg-muted',
                )}
            >
                {isProcessing ? (
                    <Loader2 className="h-5 w-5 animate-spin text-purple-500" />
                ) : isRecording ? (
                    <MicOff className="h-5 w-5 text-red-600" />
                ) : (
                    <Mic className="h-5 w-5 text-muted-foreground" />
                )}

                {isRecording && (
                    <span className="absolute inset-0 rounded-xl border-2 border-red-500 animate-ping opacity-60" />
                )}
            </Button>

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
