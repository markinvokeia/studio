// Chrome Prompt API (window.ai) — not yet in lib.dom.d.ts
// Spec: https://github.com/explainers-by-googlers/prompt-api
// Available in Chrome 127+ with chrome://flags/#prompt-api-for-gemini-nano enabled.

interface AILanguageModelCapabilities {
    readonly available: 'no' | 'readily' | 'after-download';
}

interface AILanguageModelCreateOptions {
    systemPrompt?: string;
    temperature?: number;
    topK?: number;
}

interface AILanguageModelSession {
    prompt(input: string): Promise<string>;
    promptStreaming(input: string): ReadableStream<string>;
    destroy(): void;
}

interface AILanguageModel {
    capabilities(): Promise<AILanguageModelCapabilities>;
    create(options?: AILanguageModelCreateOptions): Promise<AILanguageModelSession>;
}

interface AI {
    readonly languageModel: AILanguageModel;
}

interface Window {
    readonly ai?: AI;
}
