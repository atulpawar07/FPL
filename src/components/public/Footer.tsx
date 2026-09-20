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
              <img src="/logo.png" alt="FairPlay Premier League Logo" className="w-full h-full object-cover" />
            </div>
            <span className="font-bold text-lg text-white">FairPlay Premier League</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            The official portal for player registration, verified payments, squad management, and tournament updates.
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
              <Link href="/register" className="hover:text-emerald-400 transition-colors">
                Player Registration
              </Link>
            </li>
            <li>
              <Link href="/#tournament-info" className="hover:text-emerald-400 transition-colors">
                Eligibility & Rules
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
          <ul className="space-y-2 text-xs">
            <li className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-emerald-400" />
              <span>+91 98765 43210</span>
            </li>
            <li className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-emerald-400" />
              <span>support@cricketchampionship.org</span>
            </li>
            <li className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>Central Cricket Ground Complex, Sports City</span>
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
        <p>© 2026 FairPlay Premier League. All rights reserved.</p>
        <div className="flex items-center gap-6">
          <span className="hover:text-slate-400 cursor-pointer">Terms & Conditions</span>
          <span className="hover:text-slate-400 cursor-pointer">Privacy Policy</span>
        </div>
      </div>
    </footer>
  );
};
