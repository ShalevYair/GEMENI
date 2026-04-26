import { NextResponse } from 'next/server';
import { buildSalesforceOAuthUrl } from '@/lib/salesforce';

export async function GET() {
  const clientId = process.env.SF_CLIENT_ID;
  const redirectUri = process.env.SF_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: 'SF_CLIENT_ID או SF_REDIRECT_URI לא מוגדרים' }, { status: 500 });
  }

  const url = buildSalesforceOAuthUrl(clientId, redirectUri);
  return NextResponse.redirect(url);
}
