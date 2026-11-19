import type { VoiceCommand, VoiceDomain } from '@/lib/types';

/**
 * Módulos y comandos de voz. Cada módulo registra su VoiceDomain y sus comandos en
 * src/lib/voice/commands/ (ver index.ts); la pantalla que monta el host dice qué módulos están
 * activos, y solo esos se prueban y le cuentan su contexto a la IA.
 */
const domains = new Map<string, VoiceDomain<any>>();
const commands: VoiceCommand<any>[] = [];

export function registerVoiceDomain<R>(domain: VoiceDomain<R>) {
  if (!domains.has(domain.id)) domains.set(domain.id, domain as VoiceDomain<any>);
}

export function getVoiceDomain(id: string): VoiceDomain<any> | undefined {
  return domains.get(id);
}

export function registerVoiceCommand<P, R = any>(command: VoiceCommand<P, R>) {
  if (commands.some((c) => c.id === command.id)) return;
  commands.push(command as VoiceCommand<any>);
  // Estable: a igual prioridad queda el orden de registro.
  commands.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}

const activeCommands = (active: readonly string[]) => commands.filter((c) => active.includes(c.domain));

/** El primer comando de los módulos activos que reconoce la frase, con lo que entendió. */
export function matchVoiceCommand(active: readonly string[], normalized: string, raw: string): { command: VoiceCommand<any>; parsed: unknown } | null {
  for (const command of activeCommands(active)) {
    const parsed = command.match(normalized, raw);
    if (parsed != null) return { command, parsed };
  }
  return null;
}

/** Los módulos activos que saben preguntarle a la IA, en el orden en que los activó la pantalla. */
export function listVoiceAiDomains(active: readonly string[]): VoiceDomain<any>[] {
  return active.flatMap((id) => {
    const domain = domains.get(id);
    return domain?.ai ? [domain] : [];
  });
}

/** El primer comando del módulo que acepta lo que interpretó la IA. */
export function matchVoiceAiResult(domain: string, result: unknown, raw: string): { command: VoiceCommand<any>; parsed: unknown } | null {
  for (const command of commands) {
    if (command.domain !== domain || !command.ai) continue;
    const parsed = command.ai.from(result, raw);
    if (parsed != null) return { command, parsed };
  }
  return null;
}
