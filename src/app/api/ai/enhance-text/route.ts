import { enhanceClinicalText } from '@/ai/flows/enhance-clinical-text';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const body = await request.json() as { text?: unknown; context?: unknown };
        const text = typeof body.text === 'string' ? body.text.trim() : '';
        const context = typeof body.context === 'string' ? body.context : undefined;

        if (!text) {
            return NextResponse.json({ error: 'text is required' }, { status: 400 });
        }

        const result = await enhanceClinicalText({ text, context });
        return NextResponse.json(result);
    } catch (err) {
        console.error('[enhance-text] Error:', err);
        return NextResponse.json({ error: 'Enhancement failed', detail: String(err) }, { status: 500 });
    }
}
