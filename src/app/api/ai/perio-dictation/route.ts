import { NextResponse } from 'next/server';

import { rewritePerioDictation } from '@/ai/flows/perio-dictation';

/** Fallback of the periodontogram's dictation (see src/ai/flows/perio-dictation.ts) */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { text?: unknown };
    const text = typeof body.text === 'string' ? body.text.trim().slice(0, 500) : '';
    if (!text) return NextResponse.json({ error: 'text is required' }, { status: 400 });
    return NextResponse.json(await rewritePerioDictation({ text }));
  } catch (err) {
    console.error('[perio-dictation] Error:', err);
    return NextResponse.json({ error: 'Rewrite failed' }, { status: 500 });
  }
}
