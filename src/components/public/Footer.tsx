import React from 'react';
import Link from 'next/link';
import { Trophy, Mail, Phone, MapPin, ShieldCheck } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-slate-950 border-t border-slate-900 text-slate-400 text-sm py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Col 1: Brand Info */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl overflow-hidden border border-amber-500/40 bg-slate-900 shrink-0">
              <img src="/logo.png" alt="Fairplay Premier League (FPL) Logo" className="w-full h-full object-cover" />
            </div>
            <span className="font-bold text-lg text-white">Fairplay Premier League (FPL)</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            The official portal for player registration, verified payments, squad management, and tournament updates. Est. 2022.
          </p>
        </div>

        {/* Col 2: Navigation */}
        <div>
          <h4 className="font-semibold text-slate-200 mb-3 text-sm">Quick Links</h4>
          <ul className="space-y-2 text-xs">
            <li>
              <Link href="/" className="hover:text-emerald-400 transition-colors">
                Home
              </Link>
            </li>
            <li>
              <Link href="/about" className="hover:text-emerald-400 transition-colors">
                About FPL
              </Link>
            </li>
            <li>
              <Link href="/how-it-works" className="hover:text-emerald-400 transition-colors">
                How It Works
              </Link>
            </li>
            <li>
              <Link href="/register" className="hover:text-emerald-400 transition-colors">
                Player Registration
              </Link>
            </li>
            <li>
              <Link href="/admin/login" className="hover:text-emerald-400 transition-colors flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>Admin Login</span>
              </Link>
            </li>
          </ul>
        </div>

        {/* Col 3: Contact Details */}
        <div>
          <h4 className="font-semibold text-slate-200 mb-3 text-sm">Tournament Desk</h4>
          <ul className="space-y-2.5 text-xs">
            <li className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Email:{' '}
                <a href="mailto:fairplaypremierleague@gmail.com" className="text-white hover:text-emerald-400 font-semibold transition-colors">
                  fairplaypremierleague@gmail.com
                </a>
              </span>
            </li>
            <li className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Calling:{' '}
                <a href="tel:+918433832332" className="text-white hover:text-emerald-400 font-semibold transition-colors">
                  8433832332
                </a>
              </span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-emerald-400 font-bold text-sm shrink-0">💬</span>
              <span>
                WhatsApp:{' '}
                <a
                  href="https://wa.me/918652526186"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 hover:underline font-semibold"
                >
                  8652526186
                </a>
              </span>
            </li>
            <li className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <a
                href="https://share.google/jhDr1oV9hKexMdG3Q"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:underline font-semibold flex items-center gap-1"
              >
                Turf Titans 📍
              </a>
            </li>
          </ul>
        </div>

        {/* Col 4: Trust & Verification */}
        <div>
          <h4 className="font-semibold text-slate-200 mb-3 text-sm">Verification Notice</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            All registrations are assigned a unique non-sequential Reference ID (`REG-2026-XXXXX`). Payments are verified server-side prior to confirmation.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-8 pt-6 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
        <p>© 2022–2026 Fairplay Premier League (FPL). All rights reserved.</p>
        <div className="flex items-center gap-6">
          <span className="hover:text-slate-400 cursor-pointer">Terms & Conditions</span>
          <span className="hover:text-slate-400 cursor-pointer">Privacy Policy</span>
        </div>
      </div>
    </footer>
  );
};
