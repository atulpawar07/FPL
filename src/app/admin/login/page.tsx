'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ShieldCheck, Mail, Lock, AlertCircle, LogIn } from 'lucide-react';
import { ADMIN_EMAIL } from '@/lib/auth/constants';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (email.trim().toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      setError(`Access Denied: Admin access is restricted strictly to ${ADMIN_EMAIL}`);
      setIsLoading(false);
      return;
    }

    const { data, error: signInErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInErr) {
      setError(signInErr.message);
      setIsLoading(false);
      return;
    }

    if (data?.user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      window.location.href = '/admin';
    } else {
      setError(`Access Denied: Only ${ADMIN_EMAIL} is authorized as Admin.`);
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    const { error: oauthErr } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect=/admin`,
      },
    });

    if (oauthErr) {
      setError(oauthErr.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 selection:bg-emerald-500 selection:text-white">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white mx-auto shadow-lg shadow-emerald-950/60">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Admin Portal Login</h1>
            <p className="text-xs text-slate-400 mt-1">
              Protected authentication reserved exclusively for <span className="text-emerald-400 font-semibold">{ADMIN_EMAIL}</span>
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3.5 bg-rose-950/80 border border-rose-500/50 rounded-xl text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Google OAuth Login */}
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={handleGoogleLogin}
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
            <span>Sign in as Admin with Google</span>
          </button>
        </div>

        <div className="flex items-center my-4">
          <div className="flex-1 border-t border-slate-800" />
          <span className="px-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Or Email Login</span>
          <div className="flex-1 border-t border-slate-800" />
        </div>

        <form onSubmit={handleEmailLogin} className="space-y-4">
          <Input
            label="Admin Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="atulpawar07@gmail.com"
          />

          <Input
            label="Password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />

          <Button type="submit" size="lg" isLoading={isLoading} className="w-full" leftIcon={<LogIn className="w-5 h-5" />}>
            Sign In as Admin
          </Button>
        </form>
      </div>
    </div>
  );
}
