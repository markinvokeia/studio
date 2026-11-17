import type { VoiceAiResult, VoiceCommand } from '@/lib/types';

/**
 * Comandos de voz disponibles, en orden de prioridad. Cada módulo agrega los suyos en
 * src/lib/voice/commands/ (ver index.ts).
 */
const commands: VoiceCommand<any>[] = [];

export function registerVoiceCommand<P>(command: VoiceCommand<P>) {
  if (commands.some((c) => c.id === command.id)) return;
  commands.push(command as VoiceCommand<any>);
  // Estable: a igual prioridad queda el orden de registro.
  commands.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}

/** El primer comando que reconoce la frase, con lo que entendió. */
export function matchVoiceCommand(normalized: string, raw: string): { command: VoiceCommand<any>; parsed: unknown } | null {
  for (const command of commands) {
    const parsed = command.match(normalized, raw);
    if (parsed != null) return { command, parsed };
  }
  return null;
}

/** Los comandos que saben usar la respuesta de la IA. */
export function listVoiceAiCommands(): VoiceCommand<any>[] {
  return commands.filter((c) => c.ai);
}

/** El primer comando que acepta lo que interpretó la IA. */
export function matchVoiceAiResult(result: VoiceAiResult, raw: string): { command: VoiceCommand<any>; parsed: unknown } | null {
  for (const command of listVoiceAiCommands()) {
    const parsed = command.ai!.from(result, raw);
    if (parsed != null) return { command, parsed };
  }
  return null;
}
