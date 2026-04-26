import { NextRequest, NextResponse } from 'next/server';
import { generateStep } from '@/lib/gemini';

export async function POST(req: NextRequest) {
  try {
    const { tsdContent, step, apiKey } = await req.json();

    if (!tsdContent || !step || !apiKey) {
      return NextResponse.json({ error: 'חסרים פרמטרים: tsdContent, step, apiKey' }, { status: 400 });
    }

    const files = await generateStep(apiKey, tsdContent, step);
    return NextResponse.json({ files });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'שגיאה לא ידועה';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
