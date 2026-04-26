import { NextRequest, NextResponse } from 'next/server';
import { deployToSalesforce } from '@/lib/salesforce';
import { GeneratedFile } from '@/types/salesforce';

export async function POST(req: NextRequest) {
  try {
    const { files, accessToken, instanceUrl } = (await req.json()) as {
      files: GeneratedFile[];
      accessToken: string;
      instanceUrl: string;
    };

    if (!files?.length || !accessToken || !instanceUrl) {
      return NextResponse.json({ error: 'חסרים פרמטרים' }, { status: 400 });
    }

    const result = await deployToSalesforce(accessToken, instanceUrl, files);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'שגיאה לא ידועה';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
