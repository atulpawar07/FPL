'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import {
  Trophy,
  LayoutDashboard,
  Users,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  ShieldCheck,
} from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // If on login page, render children directly
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  const navItems = [
    { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { label: 'Player Directory', href: '/admin/players', icon: Users },
    { label: 'Audit Logs', href: '/admin/audit-logs', icon: FileText },
    { label: 'Settings', href: '/admin/settings', icon: Settings },
  ];

  const handleLogout = async () => {
    await fetch('/api/admin/login', { method: 'DELETE' }).catch(() => {});
    router.push('/admin/login');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row selection:bg-emerald-500 selection:text-white">
      {/* Mobile Header Bar */}
      <div className="md:hidden sticky top-0 z-40 bg-slate-900 border-b border-slate-800 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold">
            <Trophy className="w-4 h-4" />
          </div>
          <span className="font-bold text-sm text-white">Admin Portal</span>
        </div>
        <button
          onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          className="p-2 rounded-lg text-slate-300 hover:bg-slate-800 focus:outline-none"
        >
          {mobileSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileSidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-slate-950/80 backdrop-blur-sm"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Desktop Sidebar / Mobile Drawer */}
      <aside
        className={clsx(
          'fixed md:static inset-y-0 left-0 z-40 w-64 bg-slate-900 border-r border-slate-800/80 p-5 flex flex-col justify-between transition-transform duration-300 md:translate-x-0',
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="space-y-6">
          {/* Logo */}
          <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <span className="font-extrabold text-base text-white block">Premier Cricket</span>
              <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">
                Admin Console
              </span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileSidebarOpen(false)}
                  className={clsx(
                    'flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-xs sm:text-sm transition-colors',
                    isActive
                      ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Footer */}
        <div className="pt-4 border-t border-slate-800 space-y-3">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-500/40 flex items-center justify-center font-bold text-xs">
              SA
            </div>
            <div className="overflow-hidden">
              <span className="font-semibold text-xs text-white block truncate">Super Admin</span>
              <span className="text-[10px] text-slate-400 block truncate">admin@cricket.org</span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-800/80 hover:bg-rose-950/40 text-slate-300 hover:text-rose-400 border border-slate-700/60 hover:border-rose-500/30 rounded-xl text-xs font-semibold transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
