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

const ENGLISH_POSSESSIVE = /^((?:show me|go to|take me to|select|open|delete|remove|erase|edit|mark|make|move|cancel|find|focus on|reschedule|change|paint|color)\s)?([a-z]+(?: [a-z]+){0,2}?) (?:appointment|appt)(\s.*)?$/;

/** Cortesía y muletillas que no cambian el pedido («poné más zoom por favor», «dale, andá a hoy»). */
const POLITE = /(?:^|\s)(?:por favor|porfa|porfis|please|pls|dale|bueno|che|eh|este|o sea|a ver|mira|mirá|fijate|che che|gracias|thanks|thank you|okay so|so|well)(?=\s|$)/g;
export function stripPoliteness(normalized: string): string {
  return normalized.replace(POLITE, ' ').replace(/\s+/g, ' ').trim();
}

/** El primer comando de los módulos activos que reconoce la frase, con lo que entendió. */
export function matchVoiceCommand(
  active: readonly string[],
  normalized: string,
  raw: string,
  /** Comandos que no cuentan (p. ej. el formulario abierto, al buscar si es otro pedido). */
  skip?: (command: VoiceCommand<any>) => boolean,
): { command: VoiceCommand<any>; parsed: unknown } | null {
  const tries = [normalized];
  const plain = stripPoliteness(normalized);
  if (plain && plain !== normalized) tries.push(plain);
  // Orden inglés «delete Carlos López appointment» → «delete the appointment of Carlos López».
  const english = plain.match(ENGLISH_POSSESSIVE);
  if (english) tries.push(`${english[1] ?? ''}the appointment of ${english[2]}${english[3] ?? ''}`.trim());
  for (const text of tries) {
    for (const command of activeCommands(active)) {
      if (skip?.(command)) continue;
      const parsed = command.match(text, raw);
      if (parsed != null) return { command, parsed };
    }
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
