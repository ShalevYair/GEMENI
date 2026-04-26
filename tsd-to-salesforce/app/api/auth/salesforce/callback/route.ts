import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForToken } from '@/lib/salesforce';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const error = req.nextUrl.searchParams.get('error');

  if (error) {
    return NextResponse.redirect(
      new URL(`/?sf_error=${encodeURIComponent(error)}`, req.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(new URL('/?sf_error=no_code', req.url));
  }

  const clientId = process.env.SF_CLIENT_ID!;
  const clientSecret = process.env.SF_CLIENT_SECRET!;
  const redirectUri = process.env.SF_REDIRECT_URI!;

  try {
    const token = await exchangeCodeForToken(code, clientId, clientSecret, redirectUri);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const dest = new URL('/deploy', appUrl);
    dest.searchParams.set('access_token', token.access_token);
    dest.searchParams.set('instance_url', token.instance_url);

    return NextResponse.redirect(dest);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'שגיאת אימות';
    return NextResponse.redirect(
      new URL(`/?sf_error=${encodeURIComponent(message)}`, req.url)
    );
  }
}
