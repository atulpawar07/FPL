'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ManagerLoginPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/auth/login?redirect=/manager');
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
      Redirecting to login...
    </div>
  );
}
