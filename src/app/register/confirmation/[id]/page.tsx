'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Header } from '@/components/public/Header';
import { Footer } from '@/components/public/Footer';
import { PrintableReceipt } from '@/components/public/PrintableReceipt';
import { FullPlayerProfile } from '@/types';
import { Loader2, ShieldAlert } from 'lucide-react';

export default function RegistrationConfirmationPage() {
  const params = useParams();
  const id = params?.id as string;

  const [profile, setProfile] = useState<FullPlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    fetch(`/api/registrations/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setProfile(data);
        }
      })
      .catch((err) => {
        setError(err.message || 'Failed to load registration details');
      })
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-white">
      <Header />

      <main className="flex-1 py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
            <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
            <p className="text-sm font-medium">Fetching verified registration receipt...</p>
          </div>
        ) : error || !profile ? (
          <div className="max-w-md mx-auto p-6 bg-slate-900 border border-slate-800 rounded-2xl text-center space-y-4 my-12">
            <div className="w-12 h-12 rounded-full bg-rose-950 text-rose-400 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-white">Registration Reference Not Found</h2>
            <p className="text-xs text-slate-400">{error || 'Unable to locate this registration record.'}</p>
          </div>
        ) : (
          <PrintableReceipt profile={profile} />
        )}
      </main>

      <Footer />
    </div>
  );
}
