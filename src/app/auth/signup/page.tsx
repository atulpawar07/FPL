'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Trophy, Mail, Lock, UserCheck, AlertCircle, CheckCircle2 } from 'lucide-react';

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect') || '/register';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationSent, setVerificationSent] = useState(false);

  const supabase = createClient();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirectUrl)}`,
      },
    });

    if (signUpErr) {
      setError(signUpErr.message);
      setLoading(false);
      return;
    }

    if (signUpData?.session) {
      window.location.href = redirectUrl;
      return;
    }

    // Try instant sign in in case email confirmation is turned off in Supabase
    const { data: signInData } = await supabase.auth.signInWithPassword({ email, password });
    if (signInData?.session) {
      window.location.href = redirectUrl;
      return;
    }

    setVerificationSent(true);
    setLoading(false);
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 selection:bg-emerald-500 selection:text-white">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white mx-auto shadow-lg">
            <Trophy className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Create Player Account</h1>
          <p className="text-xs text-slate-400">
            Sign up to save your persistent player profile across all tournaments.
          </p>
        </div>

        {verificationSent ? (
          <div className="p-6 bg-slate-900 border border-emerald-500/50 rounded-2xl text-center space-y-4 animate-fadeIn shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
              <Mail className="w-6 h-6 animate-bounce" />
            </div>
            <h3 className="font-extrabold text-lg text-white">Confirm Your Email Address</h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              We sent a confirmation link to <strong className="text-emerald-400">{email}</strong>.
            </p>
            <div className="p-4 bg-slate-950/90 border border-emerald-500/30 rounded-xl text-xs text-slate-300 text-left space-y-2">
              <p className="font-bold text-emerald-400 text-sm flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                Action Required:
              </p>
              <p className="text-slate-200">
                Kindly login on to your email and click <strong className="text-emerald-300">Confirm Email</strong>.
              </p>
              <p className="text-slate-300">
                Once confirmed, you will automatically get back to the <strong>Home Page</strong> where you can view ongoing tournaments!
              </p>
            </div>
            <div className="p-3 bg-amber-950/40 border border-amber-500/30 rounded-xl text-[11px] text-amber-300/90 text-left">
              💡 <strong>Email not in Inbox?</strong> Check your Spam / Junk folder. If email is delayed on Supabase free tier, you can also sign in instantly using <strong>Google Sign-In</strong>.
            </div>
            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <Link href="/" className="w-full">
                <Button variant="primary" size="sm" className="w-full">
                  Go to Home Page
                </Button>
              </Link>
              <Link href={`/auth/login?redirect=${encodeURIComponent(redirectUrl)}`} className="w-full">
                <Button variant="outline" size="sm" className="w-full">
                  Sign In Page
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <>
            {error && (
              <div className="p-3.5 bg-rose-950/80 border border-rose-500/50 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Google OAuth Button */}
            <div className="space-y-2.5">
              <button
                type="button"
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
                <span>Sign up with Google (Instant)</span>
              </button>
            </div>

            <div className="flex items-center my-4">
              <div className="flex-1 border-t border-slate-800" />
              <span className="px-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Or Email</span>
              <div className="flex-1 border-t border-slate-800" />
            </div>

            <form onSubmit={handleSignup} className="space-y-4">
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
                placeholder="At least 6 characters"
              />

              <Input
                label="Confirm Password"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
              />

              <Button type="submit" size="lg" isLoading={loading} className="w-full" leftIcon={<UserCheck className="w-5 h-5" />}>
                Create Account
              </Button>
            </form>

            <div className="pt-2 text-center text-xs text-slate-400">
              <span>Already have an account? </span>
              <Link href={`/auth/login?redirect=${encodeURIComponent(redirectUrl)}`} className="text-emerald-400 font-bold hover:underline">
                Sign In
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );

}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">Loading signup...</div>}>
      <SignupContent />
    </Suspense>
  );
}
