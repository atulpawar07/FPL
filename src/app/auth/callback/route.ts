import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { type EmailOtpType } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const redirect = searchParams.get('redirect') || searchParams.get('next') || '/register';
  const errorDescription = searchParams.get('error_description') || searchParams.get('error');

  if (errorDescription) {
    const friendlyMsg =
      errorDescription.includes('exchange external code') || errorDescription.includes('4/0A')
        ? `Unable to exchange Google code (4/0A). Check Google OAuth settings (Redirect URI, Client Secret, & Test Users).`
        : errorDescription;
    return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent(friendlyMsg)}&redirect=${encodeURIComponent(redirect)}`);
  }

  try {
    const supabase = await createServerSupabaseClient();

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(`${origin}${redirect}`);
      } else {
        console.error('Exchange code error:', error.message);
        const friendlyMsg =
          error.message.includes('exchange external code') || error.message.includes('4/0A')
            ? `Unable to exchange Google code (4/0A). Check Google OAuth settings (Redirect URI, Client Secret, & Test Users).`
            : error.message;
        return NextResponse.redirect(
          `${origin}/auth/login?error=${encodeURIComponent(friendlyMsg)}&redirect=${encodeURIComponent(redirect)}`
        );
      }
    }

    if (token_hash && type) {
      const { error } = await supabase.auth.verifyOtp({
        type,
        token_hash,
      });
      if (!error) {
        return NextResponse.redirect(`${origin}${redirect}`);
      }
    }
  } catch (err) {
    console.error('Auth callback error:', err);
  }

  return NextResponse.redirect(`${origin}/auth/login?error=Authentication+failed.+Please+try+signing+in+again.&redirect=${encodeURIComponent(redirect)}`);
}

