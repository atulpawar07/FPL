import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Trophy, Menu, X, ShieldCheck, User, LogOut, LogIn, UserCheck, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';
import { ADMIN_EMAIL } from '@/lib/auth/constants';

export const Header: React.FC = () => {
  const router = useRouter();
  const supabase = createClient();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [displayName, setDisplayName] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isManager, setIsManager] = useState<boolean>(false);

  useEffect(() => {
    const handleUser = async (user: any) => {
      if (user) {
        setCurrentUser(user);
        const name =
          user.user_metadata?.full_name ||
          (user.email || '')
            .split('@')[0]
            .replace(/[._-]/g, ' ')
            .replace(/\b\w/g, (c: string) => c.toUpperCase());
        setDisplayName(name || user.email || 'Player');

        const userEmail = (user.email || '').toLowerCase();
        if (userEmail === ADMIN_EMAIL.toLowerCase()) {
          setIsAdmin(true);
          setIsManager(false);
        } else {
          setIsAdmin(false);
          // Check if manager
          try {
            const res = await fetch('/api/manager/me');
            const data = await res.json();
            if (res.ok && data.isManager) {
              setIsManager(true);
            } else {
              setIsManager(false);
            }
          } catch {
            setIsManager(false);
          }
        }
      } else {
        setCurrentUser(null);
        setDisplayName('');
        setIsAdmin(false);
        setIsManager(false);
      }
    };

    supabase.auth.getUser().then(({ data: { user } }) => {
      handleUser(user);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      handleUser(session?.user || null);
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setIsAdmin(false);
    setIsManager(false);
    window.location.href = '/';
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 transition-all duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 md:h-20 flex items-center justify-between">
        {/* Logo & Brand */}
        <Link href="/" className="flex items-center gap-3 group focus:outline-none">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl overflow-hidden border border-amber-500/50 shadow-lg shadow-amber-950/60 group-hover:scale-105 transition-transform bg-slate-900 shrink-0 glow-gold">
            <img src="/logo.png" alt="Fairplay Premier League Logo" className="w-full h-full object-cover" />
          </div>
          <div>
            <span className="font-black text-base md:text-xl tracking-tight text-gradient-gold block leading-tight">
              FAIRPLAY PREMIER LEAGUE (FPL)
            </span>
            <span className="text-[10px] md:text-xs font-semibold text-amber-400/90 tracking-widest uppercase block">
              Official Player Portal
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-6">
          <Link
            href="/"
            className="text-sm font-medium text-slate-300 hover:text-emerald-400 transition-colors"
          >
            Home
          </Link>
          <Link
            href="/about"
            className="text-sm font-medium text-slate-300 hover:text-emerald-400 transition-colors"
          >
            About FPL
          </Link>
          <Link
            href="/#tournament-info"
            className="text-sm font-medium text-slate-300 hover:text-emerald-400 transition-colors"
          >
            Tournament Details
          </Link>
          <Link
            href="/how-it-works"
            className="text-sm font-medium text-slate-300 hover:text-emerald-400 transition-colors"
          >
            How It Works
          </Link>

          {/* Role-gated portal links */}
          {isAdmin && (
            <Link href="/admin" className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-emerald-950 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-900 transition-colors flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Admin Panel</span>
            </Link>
          )}

          {isManager && (
            <Link href="/manager" className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-teal-950 border border-teal-500/40 text-teal-300 hover:bg-teal-900 transition-colors flex items-center gap-1.5">
              <Briefcase className="w-4 h-4 text-teal-400" />
              <span>Manager Panel</span>
            </Link>
          )}
        </nav>

        {/* Desktop Right Side User Profile & Logout */}
        <div className="hidden md:flex items-center gap-3">
          {currentUser ? (
            <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 p-1.5 pl-3 rounded-2xl shadow-lg">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-950 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 font-bold text-xs">
                  <User className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <span className="text-xs font-bold text-white block max-w-[130px] truncate">
                    {displayName}
                  </span>
                  <span className="text-[10px] text-slate-400 block max-w-[130px] truncate">
                    {currentUser.email}
                  </span>
                </div>
              </div>

              <Link href="/register">
                <Button size="sm" variant="primary" className="text-xs py-1.5 px-3">
                  + Register Player
                </Button>
              </Link>

              <button
                onClick={handleLogout}
                title="Sign Out"
                className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/auth/login">
                <Button size="sm" variant="outline" leftIcon={<LogIn className="w-4 h-4" />}>
                  Sign In
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm" variant="primary">
                  Register Player
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-900 border border-slate-800 transition-colors focus:outline-none"
          aria-label="Toggle mobile menu"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-slate-900/95 border-b border-slate-800 backdrop-blur-xl px-4 pt-4 pb-6 space-y-4 animate-slideDown">
          {/* Mobile Logged In User Profile Box */}
          {currentUser && (
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-950 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-sm shrink-0">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-bold text-white text-sm block">{displayName}</span>
                  <span className="text-xs text-slate-400 block">{currentUser.email}</span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 bg-rose-950/60 border border-rose-500/30 text-rose-300 text-xs font-bold rounded-xl flex items-center gap-1"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Link
              href="/"
              onClick={() => setMobileMenuOpen(false)}
              className="px-4 py-2.5 rounded-xl text-slate-200 hover:bg-slate-800 font-medium text-sm transition-colors"
            >
              Home
            </Link>
            <Link
              href="/about"
              onClick={() => setMobileMenuOpen(false)}
              className="px-4 py-2.5 rounded-xl text-slate-200 hover:bg-slate-800 font-medium text-sm transition-colors"
            >
              About FPL
            </Link>
            <Link
              href="/#tournament-info"
              onClick={() => setMobileMenuOpen(false)}
              className="px-4 py-2.5 rounded-xl text-slate-200 hover:bg-slate-800 font-medium text-sm transition-colors"
            >
              Tournament Details
            </Link>
            <Link
              href="/how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="px-4 py-2.5 rounded-xl text-slate-200 hover:bg-slate-800 font-medium text-sm transition-colors"
            >
              How It Works
            </Link>

            {isAdmin && (
              <Link
                href="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500/30 text-emerald-300 font-semibold text-sm flex items-center gap-2"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Admin Panel</span>
              </Link>
            )}

            {isManager && (
              <Link
                href="/manager"
                onClick={() => setMobileMenuOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-teal-950/80 border border-teal-500/30 text-teal-300 font-semibold text-sm flex items-center gap-2"
              >
                <Briefcase className="w-4 h-4 text-teal-400" />
                <span>Manager Panel</span>
              </Link>
            )}
          </div>

          <div className="pt-2 border-t border-slate-800 flex flex-col gap-2">
            <Link href="/register" onClick={() => setMobileMenuOpen(false)}>
              <Button size="lg" className="w-full">
                + Register Player
              </Button>
            </Link>
            {!currentUser && (
              <Link href="/auth/login" onClick={() => setMobileMenuOpen(false)}>
                <Button size="md" variant="outline" className="w-full">
                  Sign In
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
