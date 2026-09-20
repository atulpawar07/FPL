'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Trophy, ShieldCheck, Lock, Mail, AlertCircle } from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@cricket.org');
  const [password, setPassword] = useState('admin123');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Invalid credentials');
        setIsLoading(false);
        return;
      }

      router.push('/admin');
    } catch (err: any) {
      setError('Network connection error');
      setIsLoading(false);
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
              Authorized access for tournament management & finance operations.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rose-950/80 border border-rose-500/50 rounded-xl text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <Input
            label="Admin Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@cricket.org"
          />

          <Input
            label="Password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />

          <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-[11px] text-slate-400">
            <span className="font-bold text-slate-300 block">Default Phase 1 Credentials:</span>
            <span>Email: <code className="text-emerald-400">admin@cricket.org</code> | Password: <code className="text-emerald-400">admin123</code></span>
          </div>

          <Button type="submit" size="lg" isLoading={isLoading} className="w-full">
            Log In to Admin Dashboard
          </Button>
        </form>
      </div>
    </div>
  );
}
