'use client';

import * as React from 'react';
import { api } from '@/services/api';
import { API_ROUTES } from '@/constants/routes';

export type IntentType = 'navigation' | 'help' | 'task';
export type ProcessedBy = 'local' | 'backend';
export type NoteActionKey = 'CALENDAR' | 'QUOTE' | 'INVOICE' | 'PURCHASE';

export interface EnhanceResult {
    text: string;
    processedBy: ProcessedBy;
    actions: NoteActionKey[];
    redirects: string[];
}

export interface UseLocalAIReturn {
    isAvailable: boolean;
    isReady: boolean;
    enhanceText: (text: string, context?: string) => Promise<EnhanceResult>;
    classifyIntent: (text: string) => Promise<IntentType>;
}

// ── Master prompt for Gemini Nano ─────────────────────────────────────────────
// Computational identity + negative rules in caps + few-shot examples.
// The few-shot pattern is the most reliable technique for small models:
// the model imitates the exact input → JSON output pattern from the examples.
const LOCAL_SYSTEM_PROMPT = [
    'Actúa como un procesador de texto automatizado. Tu única función es recibir un texto, corregir su ortografía y sintaxis, y detectar intenciones clave.',
    '',
    'REGLAS ESTRICTAS E INQUEBRANTABLES:',
    '1. NO agregues saludos, introducciones, explicaciones ni despedidas.',
    '2. NO agregues información nueva, no des contexto, ni respondas a preguntas que el texto haga.',
    '3. Mantén la longitud original: si el texto es una oración corta, la mejora debe ser una oración corta. Solo corrige ortografía y mejora la gramática.',
    '4. Devuelve ÚNICAMENTE un objeto JSON válido. Nada de texto fuera de las llaves.',
    '',
    'INTENCIONES A DETECTAR (acciones):',
    '- "cita", "turno", "agendar", "consulta" → Agrega "CALENDAR"',
    '- "presupuesto", "cotización", "tratamiento" → Agrega "QUOTE"',
    '- "factura", "cobrar", "pendiente de pago", "pago" → Agrega "INVOICE"',
    '- Si no hay coincidencia, devuelve un arreglo vacío [].',
    '',
    'EJEMPLOS DE COMPORTAMIENTO ESPERADO:',
    '',
    'Entrada: "nesesito un turno para mañana y tmb q me pasen el presupuesto"',
    'Salida: {"texto_mejorado":"Necesito un turno para mañana y también que me pasen el presupuesto.","acciones":["CALENDAR","QUOTE"]}',
    '',
    'Entrada: "hola q tal"',
    'Salida: {"texto_mejorado":"Hola, ¿qué tal?","acciones":[]}',
    '',
    'Entrada: "quiero cobrar la factura de juan perez q esta pendiente de pago"',
    'Salida: {"texto_mejorado":"Quiero cobrar la factura de Juan Pérez que está pendiente de pago.","acciones":["INVOICE"]}',
    '',
    'Entrada: "¿Como se hace una torta de chocolate?"',
    'Salida: {"texto_mejorado":"¿Cómo se hace una torta de chocolate?","acciones":[]}',
].join('\n');

const INTENT_SYSTEM_PROMPT =
    'Clasifica la intención en una palabra: navigation, help o task.\n' +
    '- navigation: ir a una pantalla, buscar algo en la UI\n' +
    '- help: pregunta o duda\n' +
    '- task: crear, editar, guardar, eliminar\n' +
    'Responde solo la palabra.';

// ── Chrome AI detection ───────────────────────────────────────────────────────
// Chrome 127–137: window.ai.languageModel  (flag: #prompt-api-for-gemini-nano)
// Chrome 138–148: window.LanguageModel     (standardized proposal)
//   availability() returns: 'available' | 'unavailable' | 'downloadable' | 'downloading'
//   (older flag-based returned: 'readily' | 'no' | 'after-download')

type ChromeAISession = {
    prompt(input: string): Promise<string>;
    destroy(): void;
};

type LMGlobal = {
    availability(): Promise<string>;
    create(opts: { systemPrompt?: string; temperature?: number; topK?: number }): Promise<ChromeAISession>;
};

function getLMGlobal(): LMGlobal | null {
    if (typeof window === 'undefined') return null;
    // Chrome 138+ standardized API
    const w = window as unknown as Record<string, unknown>;
    if (w['LanguageModel'] && typeof (w['LanguageModel'] as LMGlobal).availability === 'function') {
        return w['LanguageModel'] as LMGlobal;
    }
    // Chrome 127–137 flag-based API
    if (window.ai?.languageModel) {
        const old = window.ai.languageModel;
        return {
            availability: async () => {
                const caps = await old.capabilities();
                const v = caps?.available;
                if (v === 'readily') return 'available';
                if (v === 'after-download') return 'downloadable';
                return 'unavailable';
            },
            create: (opts) => old.create(opts),
        };
    }
    return null;
}

async function checkNanoAvailability(): Promise<'available' | 'downloadable' | 'unavailable'> {
    const lm = getLMGlobal();
    if (!lm) {
        console.log('[useLocalAI] No Chrome AI API found — window.LanguageModel and window.ai both absent');
        return 'unavailable';
    }
    try {
        const status = await lm.availability();
        console.log('[useLocalAI] Chrome AI availability:', status);
        if (status === 'available' || status === 'readily') return 'available';
        if (status === 'downloadable' || status === 'after-download' || status === 'downloading') return 'downloadable';
        return 'unavailable';
    } catch (e) {
        console.log('[useLocalAI] availability() failed:', e);
        return 'unavailable';
    }
}

async function createNanoSession(systemPrompt: string): Promise<ChromeAISession | null> {
    const lm = getLMGlobal();
    if (!lm) return null;
    try {
        return await lm.create({ systemPrompt });
    } catch (e) {
        console.log('[useLocalAI] create() failed:', e);
        return null;
    }
}

function parseNanoEnhanceResponse(raw: string, fallback: string): { text: string; actions: NoteActionKey[]; redirects: string[] } {
    try {
        // Find the JSON object in the response (model may add text before/after)
        const match = raw.match(/\{[\s\S]*\}/);
        if (!match) return { text: fallback, actions: [], redirects: [] };
        const parsed = JSON.parse(match[0]) as { texto_mejorado?: string; acciones?: unknown[]; redirects?: unknown[] };
        const text = typeof parsed.texto_mejorado === 'string' && parsed.texto_mejorado.trim()
            ? parsed.texto_mejorado.trim()
            : fallback;
        const validKeys: NoteActionKey[] = ['CALENDAR', 'QUOTE', 'INVOICE', 'PURCHASE'];
        const actions = Array.isArray(parsed.acciones)
            ? (parsed.acciones as string[]).filter((a): a is NoteActionKey => validKeys.includes(a as NoteActionKey))
            : [];
        const redirects = Array.isArray(parsed.redirects)
            ? (parsed.redirects as unknown[]).filter((r): r is string => typeof r === 'string')
            : [];
        return { text, actions, redirects };
    } catch {
        return { text: fallback, actions: [], redirects: [] };
    }
}

// ─────────────────────────────────────────────────────────────────────────────

export function useLocalAI(): UseLocalAIReturn {
    const [isAvailable, setIsAvailable] = React.useState(false);
    const [isReady, setIsReady] = React.useState(false);

    React.useEffect(() => {
        if (typeof window === 'undefined') {
            setIsReady(true);
            return;
        }
        void (async () => {
            const status = await checkNanoAvailability();
            const available = status === 'available';
            console.log('[useLocalAI] isAvailable:', available, '| status:', status);
            setIsAvailable(available);
            setIsReady(true);
        })();
    }, []);

    const enhanceTextViaBackend = React.useCallback(
        async (text: string, context?: string): Promise<EnhanceResult> => {
            try {
                const data = await api.post(API_ROUTES.AI.ENHANCE_TEXT, { text, context }) as {
                    enhanced_text?: string;
                    processed_by?: ProcessedBy;
                    actions?: NoteActionKey[];
                    redirects?: string[];
                } | null;
                if (!data?.enhanced_text) return { text, processedBy: 'backend', actions: [], redirects: [] };
                const result: EnhanceResult = {
                    text: data.enhanced_text.trim() || text,
                    processedBy: 'backend',
                    actions: data.actions ?? [],
                    redirects: data.redirects ?? [],
                };
                console.log('[AI enhance]', result);
                return result;
            } catch (e) {
                console.log('[AI enhance] Backend call failed:', e);
                return { text, processedBy: 'backend', actions: [], redirects: [] };
            }
        },
        [],
    );

    // Local model temporarily disabled — all enhancement goes through n8n
    const enhanceText = React.useCallback(
        async (text: string, context?: string): Promise<EnhanceResult> => {
            return enhanceTextViaBackend(text, context);
        },
        [enhanceTextViaBackend],
    );

    const classifyIntent = React.useCallback(
        async (text: string): Promise<IntentType> => {
            if (!isAvailable) return 'help';
            try {
                const session = await createNanoSession(INTENT_SYSTEM_PROMPT);
                if (!session) return 'help';
                const result = await session.prompt(text);
                session.destroy();
                const lower = result.trim().toLowerCase();
                if (lower.startsWith('navigation')) return 'navigation';
                if (lower.startsWith('task')) return 'task';
                return 'help';
            } catch {
                return 'help';
            }
        },
        [isAvailable],
    );

    return { isAvailable, isReady, enhanceText, classifyIntent };
}
