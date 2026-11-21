import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * El texto que manda la IA (el agente clínico) suele venir en markdown: **negritas**, *cursivas*,
 * listas con «-», «*» o «1.», títulos con «#». En la tarjeta de voz se ve con formato, sin los
 * asteriscos ni los numerales, como en el chat del agente.
 */

/** Negritas y cursivas dentro de una línea; los asteriscos que quedan sueltos se sacan. */
function inline(text: string, key: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /\*\*([^*]+?)\*\*|__([^_]+?)__|\*([^*\s][^*]*?)\*|_([^_\s][^_]*?)_|`([^`]+?)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index).replace(/\*+/g, ''));
    const [, b1, b2, i1, i2, code] = m;
    if (b1 || b2) out.push(<strong key={`${key}-${i++}`} className="font-semibold">{b1 ?? b2}</strong>);
    else if (i1 || i2) out.push(<em key={`${key}-${i++}`}>{i1 ?? i2}</em>);
    else if (code) out.push(<span key={`${key}-${i++}`} className="font-mono">{code}</span>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last).replace(/\*+/g, ''));
  return out;
}

type Block =
  | { kind: 'heading'; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] };

export function parseRichText(value: string): Block[] {
  const lines = value.replace(/\\n/g, '\n').replace(/\r/g, '').split('\n');
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
    paragraph = [];
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || /^[-*_]{3,}$/.test(line)) { flush(); continue; }
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    if (heading) { flush(); blocks.push({ kind: 'heading', text: heading[1] }); continue; }
    const bullet = line.match(/^(?:[-*•·]|(\d+)[.)])\s+(.*)$/);
    if (bullet) {
      flush();
      const ordered = !!bullet[1];
      const prev = blocks[blocks.length - 1];
      if (prev?.kind === 'list' && prev.ordered === ordered) prev.items.push(bullet[2]);
      else blocks.push({ kind: 'list', ordered, items: [bullet[2]] });
      continue;
    }
    paragraph.push(line);
  }
  flush();
  return blocks;
}

/** Lo mismo, sin formato: para leerlo en voz alta. */
export function plainRichText(value: string): string {
  return parseRichText(value)
    .map((b) => (b.kind === 'list' ? b.items.join('. ') : b.text))
    .join('. ')
    .replace(/\*\*|__|`/g, '')
    .replace(/(^|\s)[*_](\S[^*_]*?)[*_](?=\s|[.,;:!?]|$)/g, '$1$2')
    .replace(/\*+/g, '')
    .replace(/\.\s*\./g, '.')
    .trim();
}

export function VoiceRichText({ text, className }: { text: string; className?: string }) {
  const blocks = parseRichText(text);
  return (
    <div className={cn('space-y-1.5', className)}>
      {blocks.map((block, index) => {
        const key = `b${index}`;
        if (block.kind === 'heading') return <p key={key} className="font-semibold">{inline(block.text, key)}</p>;
        if (block.kind === 'paragraph') return <p key={key}>{inline(block.text, key)}</p>;
        const List = block.ordered ? 'ol' : 'ul';
        return (
          <List key={key} className={cn('space-y-0.5 pl-4', block.ordered ? 'list-decimal' : 'list-disc')}>
            {block.items.map((item, i) => <li key={`${key}-${i}`}>{inline(item, `${key}-${i}`)}</li>)}
          </List>
        );
      })}
    </div>
  );
}
