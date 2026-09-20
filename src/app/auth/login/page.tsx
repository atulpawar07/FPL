'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Trophy, Mail, Lock, LogIn, AlertCircle } from 'lucide-react';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect') || '/register';
  const urlError = searchParams.get('error');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInErr) {
      setError(signInErr.message);
      setLoading(false);
      return;
    }

    window.location.href = redirectUrl;
  };

  const handleOAuthLogin = async (provider: 'google') => {
    setError(null);
    const { error: oauthErr } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirectUrl)}`,
      },
    });

    if (oauthErr) {
      setError(oauthErr.message);
    }
  };

  const activeError = error || urlError;
  const isGoogleExchangeError = activeError && (activeError.includes('4/0A') || activeError.includes('exchange external code'));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 selection:bg-emerald-500 selection:text-white">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white mx-auto shadow-lg">
            <Trophy className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Player & Admin Sign In</h1>
          <p className="text-xs text-slate-400">
            Sign in to register for cricket tournaments & manage profiles.
          </p>
        </div>

        {activeError && (
          <div className="p-4 bg-rose-950/80 border border-rose-500/50 rounded-xl text-rose-300 text-xs space-y-2">
            <div className="flex items-center gap-2 font-semibold text-rose-200">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{isGoogleExchangeError ? 'Google OAuth Code Exchange Error (4/0A)' : 'Authentication Notice'}</span>
            </div>
            <p className="leading-relaxed text-rose-300/90">
              {isGoogleExchangeError
                ? 'Supabase could not exchange Google authorization code with Google servers.'
                : activeError}
            </p>
            {isGoogleExchangeError && (
              <div className="pt-1 border-t border-rose-800/50 text-[11px] text-rose-300 space-y-1">
                <p className="font-semibold text-rose-200">Common fixes in Google & Supabase:</p>
                <ul className="list-disc list-inside space-y-1 text-rose-300/80">
                  <li><strong>Google Audience / Test Users</strong>: If App Status is Testing, add your email address under Test Users in Google Auth Platform.</li>
                  <li><strong>Supabase Client Secret</strong>: Verify that the Client Secret in Supabase matches Google Cloud Console without trailing spaces.</li>
                  <li><strong>Supabase URL Config</strong>: Ensure Redirect URLs includes <code>http://localhost:3000/auth/callback</code>.</li>
                </ul>
              </div>
            )}
          </div>
        )}

        {/* OAuth Buttons */}
        <div className="space-y-2.5">
          <button
            onClick={() => handleOAuthLogin('google')}
            className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs sm:text-sm rounded-xl border border-slate-700 flex items-center justify-center gap-3 transition-colors min-h-[46px]"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>
        </div>

        <div className="flex items-center my-4">
          <div className="flex-1 border-t border-slate-800" />
          <span className="px-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Or Email</span>
          <div className="flex-1 border-t border-slate-800" />
        </div>

        {/* Email & Password Form */}
        <form onSubmit={handleEmailLogin} className="space-y-4">
          <Input
            label="Email Address"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="player@example.com"
          />

          <Input
            label="Password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />

          <Button type="submit" size="lg" isLoading={loading} className="w-full" leftIcon={<LogIn className="w-5 h-5" />}>
            Sign In with Email
          </Button>
        </form>

        <div className="pt-2 text-center text-xs text-slate-400">
          <span>Don't have an account? </span>
          <Link href={`/auth/signup?redirect=${encodeURIComponent(redirectUrl)}`} className="text-emerald-400 font-bold hover:underline">
            Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">Loading login...</div>}>
      <LoginContent />
    </Suspense>
  );
}
