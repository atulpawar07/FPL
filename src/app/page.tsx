'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/public/Header';
import { Footer } from '@/components/public/Footer';
import { Button } from '@/components/ui/Button';
import { formatPaiseToINR, formatDate } from '@/lib/utils/format';
import { DbTournament } from '@/types';
import {
  Trophy,
  Calendar,
  DollarSign,
  UserCheck,
  Award,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Mail,
  Phone,
  Sparkles,
  Check,
  Clock,
} from 'lucide-react';

function HomePageContent() {
  const searchParams = useSearchParams();
  const isSubmitted = searchParams.get('submitted') === 'true';
  const submittedTournamentName = searchParams.get('tName') || 'FairPlay Premier League';

  const [tournaments, setTournaments] = useState<DbTournament[]>([]);
  const [loadingTournaments, setLoadingTournaments] = useState(true);

  useEffect(() => {
    fetch('/api/tournaments/upcoming')
      .then((res) => res.json())
      .then((data) => {
        if (data.tournaments && Array.isArray(data.tournaments)) {
          setTournaments(data.tournaments);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingTournaments(false));
  }, []);

  const activeTournament = tournaments.find((t) => t.registration_open) || tournaments[0] || null;
  const feeDisplay = activeTournament ? formatPaiseToINR(activeTournament.registration_fee) : '₹0';

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-white">
      <Header />

      <main className="flex-1 space-y-16 md:space-y-24 pb-20">
        {/* SUBMITTED PAYMENT SCREENSHOT BANNER */}
        {isSubmitted && (
          <div className="bg-emerald-950/90 border-b border-emerald-500/50 py-4 px-4 sm:px-6 shadow-2xl animate-fadeIn">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                  <Check className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-sm sm:text-base">
                    🎉 Payment Screenshot Uploaded & Step 1 Validated!
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Your entry for <strong className="text-emerald-300">{submittedTournamentName}</strong> has passed Step 1 Automated Checks and is now awaiting Step 2 Admin Review.
                  </p>
                </div>
              </div>
              <Link href="#upcoming-tournaments">
                <Button size="sm" variant="outline">
                  View Squad Status
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* HERO SECTION */}
        <section className="relative overflow-hidden pt-6 pb-12 md:pt-12 md:pb-20 border-b border-slate-900 bg-gradient-to-b from-slate-900/80 via-slate-950 to-slate-950">
          {/* Ambient Lighting Gradients */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-emerald-500/10 blur-[140px] pointer-events-none rounded-full" />
          <div className="absolute top-1/3 right-10 w-[300px] h-[300px] bg-teal-500/10 blur-[100px] pointer-events-none rounded-full" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-6">
            {/* Registration Deadline Banner Notice if closed */}
            {activeTournament && (() => {
              const isDeadlinePassed = activeTournament.registration_end_date ? new Date(activeTournament.registration_end_date) < new Date() : false;
              const isClosed = !activeTournament.registration_open || isDeadlinePassed;
              if (isClosed) {
                return (
                  <div className="p-4 bg-rose-950/90 border border-rose-500/50 rounded-2xl text-rose-200 text-xs sm:text-sm font-semibold flex items-center justify-center gap-3 shadow-xl">
                    <Clock className="w-5 h-5 text-rose-400 shrink-0" />
                    <span>
                      Registration for <strong>{activeTournament.name}</strong> is currently <strong>CLOSED</strong>
                      {isDeadlinePassed && activeTournament.registration_end_date ? ` (Deadline passed on ${formatDate(activeTournament.registration_end_date)})` : ''}.
                    </span>
                  </div>
                );
              }
              return null;
            })()}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* TOURNAMENT BANNER DISPLAY (Mobile top / Desktop side) */}
              <div className="lg:col-span-6 space-y-4">
                <div className="w-full rounded-3xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl relative group">
                  {activeTournament?.banner_url ? (
                    <div className="relative w-full flex items-center justify-center bg-slate-950 overflow-hidden min-h-[220px] sm:min-h-[300px]">
                      {/* Ambient background glow */}
                      <img
                        src={activeTournament.banner_url}
                        alt=""
                        aria-hidden="true"
                        className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-25 scale-110 pointer-events-none"
                      />
                      {/* Uncropped main banner image */}
                      <img
                        src={activeTournament.banner_url}
                        alt={activeTournament.name}
                        className="w-full h-auto max-h-[420px] object-contain relative z-10 group-hover:scale-[1.01] transition-transform duration-500"
                      />
                    </div>
                  ) : (
                    <div className="w-full h-56 sm:h-72 md:h-80 bg-gradient-to-tr from-slate-900 via-emerald-950 to-teal-900 p-8 flex flex-col justify-between relative overflow-hidden">
                      <div className="absolute -right-10 -bottom-10 opacity-10">
                        <Trophy className="w-80 h-80 text-white" />
                      </div>
                      <span className="px-3 py-1 bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-bold rounded-full uppercase self-start">
                        {activeTournament?.tournament_type === 'OWNER_BASED' ? '👑 Owner-Based League' : '🏏 Premier Championship'}
                      </span>
                      <div>
                        <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                          {activeTournament?.name || 'FairPlay Premier League'}
                        </h2>
                        <p className="text-xs text-slate-300 mt-1 line-clamp-2">
                          {activeTournament?.description || 'Official Player Registration & Auction Portal'}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Banner Overlay Badge */}
                  <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full bg-slate-950/90 backdrop-blur-md border border-slate-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg">
                      <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                      {activeTournament ? formatDate(activeTournament.tournament_date) : 'Coming Soon'}
                    </span>
                  </div>
                </div>

                {/* MOBILE DISPLAY: ACTION BUTTONS RIGHT BELOW BANNER */}
                <div className="block lg:hidden space-y-3">
                  {activeTournament && (() => {
                    const isDeadlinePassed = activeTournament.registration_end_date ? new Date(activeTournament.registration_end_date) < new Date() : false;
                    const isClosed = !activeTournament.registration_open || isDeadlinePassed;

                    if (isClosed) {
                      return (
                        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-center text-slate-400 text-xs font-semibold">
                          Registration Closed for this Tournament
                        </div>
                      );
                    }

                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Link href={`/tournament/${activeTournament.id}`} className="w-full">
                          <Button size="lg" className="w-full" leftIcon={<UserCheck className="w-5 h-5" />}>
                            Register as Player ({feeDisplay})
                          </Button>
                        </Link>

                        {activeTournament.tournament_type === 'OWNER_BASED' && (
                          <Link href={`/tournament/${activeTournament.id}?type=owner`} className="w-full">
                            <Button size="lg" variant="secondary" className="w-full border-amber-500/40 text-amber-300 hover:bg-amber-950/50" leftIcon={<Trophy className="w-5 h-5 text-amber-400" />}>
                              Register as Team Owner
                            </Button>
                          </Link>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* DESKTOP SIDE: TOURNAMENT DETAILS & REGISTRATION CTAS */}
              <div className="lg:col-span-6 space-y-6 text-center lg:text-left">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs md:text-sm font-semibold tracking-wide">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>FairPlay Premier League Registration Portal</span>
                </div>

                <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-[1.1]">
                  {activeTournament?.name || 'FairPlay Cricket Championship'}
                </h1>

                <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                  {activeTournament?.description ||
                    'Showcase your batting, bowling, and fielding skills. Register online to lock in your official tournament entry or team ownership slot.'}
                </p>

                {/* Key Metrics Quick Ribbon */}
                {activeTournament && (
                  <div className="pt-2 grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-xl mx-auto lg:mx-0">
                    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 text-center sm:text-left">
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                        Player Fee
                      </span>
                      <span className="text-lg md:text-xl font-extrabold text-emerald-400">
                        {feeDisplay}
                      </span>
                    </div>
                    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 text-center sm:text-left">
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                        Tournament Date
                      </span>
                      <span className="text-xs md:text-sm font-bold text-slate-200">
                        {formatDate(activeTournament.tournament_date)}
                      </span>
                    </div>
                    <div className="col-span-2 sm:col-span-1 bg-slate-900/80 border border-slate-800 rounded-xl p-3 text-center sm:text-left">
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                        Registration Deadline
                      </span>
                      <span className="text-xs md:text-sm font-bold text-amber-300">
                        {activeTournament.registration_end_date ? formatDate(activeTournament.registration_end_date) : 'Until Capacity'}
                      </span>
                    </div>
                  </div>
                )}

                {/* DESKTOP CTA BUTTONS */}
                <div className="hidden lg:flex flex-col sm:flex-row items-center justify-start gap-4 pt-4">
                  {activeTournament ? (() => {
                    const isDeadlinePassed = activeTournament.registration_end_date ? new Date(activeTournament.registration_end_date) < new Date() : false;
                    const isClosed = !activeTournament.registration_open || isDeadlinePassed;

                    if (isClosed) {
                      return (
                        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 text-xs font-semibold">
                          Registration Closed for this Tournament
                        </div>
                      );
                    }

                    return (
                      <div className="flex flex-wrap items-center gap-3">
                        <Link href={`/tournament/${activeTournament.id}`}>
                          <Button size="lg" leftIcon={<UserCheck className="w-5 h-5" />}>
                            Register as Player ({feeDisplay})
                          </Button>
                        </Link>

                        {activeTournament.tournament_type === 'OWNER_BASED' && (
                          <Link href={`/tournament/${activeTournament.id}?type=owner`}>
                            <Button size="lg" variant="secondary" className="border-amber-500/40 text-amber-300 hover:bg-amber-950/50" leftIcon={<Trophy className="w-5 h-5 text-amber-400" />}>
                              Register as Team Owner
                            </Button>
                          </Link>
                        )}
                      </div>
                    );
                  })() : (
                    <Link href="/admin/login">
                      <Button size="lg" variant="outline">
                        Admin Login to Create Tournament
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* UPCOMING TOURNAMENTS DASHBOARD SECTION */}
        <section id="upcoming-tournaments" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 scroll-mt-24">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-900 pb-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Player Registration Portal
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1 flex items-center gap-2">
                <Trophy className="w-7 h-7 text-emerald-400" />
                <span>Upcoming Cricket Tournaments</span>
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 max-w-md">
              Select any tournament created by the admin below to register for entry.
            </p>
          </div>

          {loadingTournaments ? (
            <div className="p-12 text-center text-slate-400">Loading tournaments...</div>
          ) : tournaments.length === 0 ? (
            <div className="p-8 bg-slate-900 border border-slate-800 rounded-3xl text-center space-y-4 shadow-xl">
              <Trophy className="w-12 h-12 text-emerald-400 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white">No Tournaments Published Yet</h3>
                <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
                  The admin has not created any active tournaments in the system. Log in to the Admin Portal to publish a new tournament.
                </p>
              </div>
              <div className="pt-2 flex justify-center">
                <Link href="/admin/login">
                  <Button size="md" leftIcon={<ArrowRight className="w-4 h-4" />}>
                    Go to Admin Dashboard to Create Tournament
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {tournaments.map((item) => (
                <div
                  key={item.id}
                  className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl relative overflow-hidden group hover:border-emerald-500/50 transition-all"
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shrink-0">
                        <Trophy className="w-7 h-7" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-white text-lg">{item.name}</h3>
                        <span className="text-xs text-slate-400">Official Tournament</span>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-emerald-950 border border-emerald-500/40 text-emerald-300 text-xs font-bold rounded-full uppercase">
                      {item.registration_open ? 'Open' : 'Closed'}
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    {item.description || 'Showcase your skills in front of top selectors and coaches.'}
                  </p>

                  <div className="grid grid-cols-3 gap-3 p-3.5 bg-slate-950/80 rounded-2xl border border-slate-800 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Fee</span>
                      <span className="font-extrabold text-emerald-400 text-sm">
                        {formatPaiseToINR(item.registration_fee)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Date</span>
                      <span className="font-bold text-slate-200">{formatDate(item.tournament_date)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Capacity</span>
                      <span className="font-bold text-sky-400">{item.max_players} Players</span>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <Link href={`/tournament/${item.id}`} className="w-full sm:w-auto">
                      <Button size="md" className="w-full sm:w-auto" rightIcon={<ArrowRight className="w-4 h-4" />}>
                        Register Now ({formatPaiseToINR(item.registration_fee)})
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* HOW IT WORKS SECTION */}
        <section id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 scroll-mt-24">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Registration Journey
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white">
              How to Complete Your Registration
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Get registered in 4 simple mobile-friendly steps.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Step 1 */}
            <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-6 space-y-4 hover:border-emerald-500/50 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-slate-800 text-emerald-400 font-bold text-lg flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                1
              </div>
              <h3 className="font-bold text-slate-100 text-base">Personal Details</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Enter your full name, 10-digit mobile number, email, DOB, city, and optional profile photo.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-6 space-y-4 hover:border-emerald-500/50 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-slate-800 text-emerald-400 font-bold text-lg flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                2
              </div>
              <h3 className="font-bold text-slate-100 text-base">Cricket Skills</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Select your primary playing role (Batsman, Bowler, All-rounder), batting style, and bowling preference.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-6 space-y-4 hover:border-emerald-500/50 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-slate-800 text-emerald-400 font-bold text-lg flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                3
              </div>
              <h3 className="font-bold text-slate-100 text-base">Review & Fee</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Review your entry details, verify the registration fee ({feeDisplay}), and accept the tournament code of conduct.
              </p>
            </div>

            {/* Step 4 */}
            <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-6 space-y-4 hover:border-emerald-500/50 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-slate-800 text-emerald-400 font-bold text-lg flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                4
              </div>
              <h3 className="font-bold text-slate-100 text-base">Instant Pass</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Receive your non-sequential Reference ID (`REG-2026-XXXXX`) and printable official receipt.
              </p>
            </div>
          </div>
        </section>

        {/* ABOUT FAIRPLAY PREMIER LEAGUE (FPL) & CODE OF CONDUCT SECTION */}
        <section id="about-fpl" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 scroll-mt-24">
          {/* Mission Banner Card */}
          <div className="bg-gradient-to-br from-slate-900 via-emerald-950/40 to-slate-950 border border-emerald-500/30 rounded-3xl p-6 sm:p-10 space-y-6 shadow-2xl relative overflow-hidden">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950 border border-emerald-500/40 text-emerald-300 text-xs font-bold uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  Official Platform Mission
                </div>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white">
                  About FairPlay Premier League (FPL)
                </h2>
              </div>
            </div>

            <p className="text-sm sm:text-base text-slate-200 leading-relaxed max-w-5xl">
              FairPlay Premier League (FPL) is a platform which has been formed to enhance the game of cricket with those cricket enthusiasts who never got an opportunity or a platform to discover their skills and achieve their dreams. In Fairplay Premier League (FPL) we practice being sincere towards maintaining the integrity of the game by rendering <strong className="text-emerald-300">RESPECT</strong> towards all participants and League officials involved.
            </p>

            {/* 5 Basic Principles Grid */}
            <div className="space-y-4 pt-4 border-t border-slate-800">
              <h3 className="text-sm font-extrabold text-amber-300 uppercase tracking-wider flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-400" />
                Five Basic Principles of FairPlay Premier League
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {[
                  "1. Respect the rules of the League.",
                  "2. Respect the opponents.",
                  "3. Respect the League officials and their decisions.",
                  "4. Have everyone participate.",
                  "5. Always maintain self-control.",
                ].map((principle, idx) => (
                  <div key={idx} className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 text-xs font-semibold text-slate-200 flex items-center gap-2 shadow-md">
                    <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0 text-[10px] font-bold">✓</span>
                    <span>{principle.substring(3)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Benefits & Team Selection Criteria */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Benefits of FPL */}
            <div className="lg:col-span-6 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl">
              <h3 className="text-lg font-extrabold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                <Trophy className="w-5 h-5 text-emerald-400" />
                Benefits of Fairplay Premier League (FPL)
              </h3>
              <ul className="space-y-2.5 text-xs sm:text-sm text-slate-300">
                <li className="flex items-start gap-2.5"><span className="text-emerald-400 font-bold">✓</span> Increased positive team unity.</li>
                <li className="flex items-start gap-2.5"><span className="text-emerald-400 font-bold">✓</span> More appropriate spectator behaviour.</li>
                <li className="flex items-start gap-2.5"><span className="text-emerald-400 font-bold">✓</span> Decrease the win-at-all-cost attitude.</li>
                <li className="flex items-start gap-2.5"><span className="text-emerald-400 font-bold">✓</span> Increase of on-field positive behaviour.</li>
                <li className="flex items-start gap-2.5"><span className="text-emerald-400 font-bold">✓</span> Participants take more responsibility for their actions.</li>
                <li className="flex items-start gap-2.5"><span className="text-emerald-400 font-bold">✓</span> Increase in sportsmanship.</li>
                <li className="flex items-start gap-2.5"><span className="text-emerald-400 font-bold">✓</span> More become promoters of positive attitudes.</li>
                <li className="flex items-start gap-2.5"><span className="text-emerald-400 font-bold">✓</span> New participants drawn to cricket by positive aspects of FPL.</li>
              </ul>
            </div>

            {/* Team Selection Criteria & Program Intercede */}
            <div className="lg:col-span-6 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl">
              <h3 className="text-lg font-extrabold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                <ShieldCheck className="w-5 h-5 text-teal-400" />
                Team Selection & Auction Standards
              </h3>
              <div className="space-y-3 text-xs sm:text-sm text-slate-300 leading-relaxed">
                <p>
                  Procedures for selection of competitive and recreational teams vary with associations. In player selection, <strong>'Ability'</strong> and <strong>'Attitude'</strong> should be criteria. All participants must be made aware of these two criteria prior to selections.
                </p>
                <div className="p-3.5 bg-rose-950/40 border border-rose-500/30 rounded-2xl text-rose-200 text-xs font-semibold">
                  🚫 Players exhibiting poor sportsmanship, lack of honesty, and lack of safety and respect for others should be made aware that attitudes such as these are not tolerated in FPL.
                </div>
                <p className="text-slate-400">
                  Selection criteria in auction for any members should not solely be based upon skill level. Attitude is important. FPL Program Intercede are components introduced into Premier Leagues to enhance Dishonest Practice and Respect towards fellow members and to abide with the principles of FPL.
                </p>
              </div>
            </div>
          </div>

          {/* Code of Conduct Tabs / Cards */}
          <div className="space-y-6">
            <div className="text-center space-y-2 max-w-xl mx-auto">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Official Code of Conduct</h2>
              <p className="text-xs sm:text-sm text-slate-400">Established rules and ethical guidelines for all participants in FPL.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Code for Team Owners & Captains */}
              <div className="bg-slate-900/90 border border-amber-500/30 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl relative overflow-hidden">
                <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-950 border border-amber-500/40 text-amber-400 flex items-center justify-center font-bold shrink-0">
                    👑
                  </div>
                  <div>
                    <h3 className="font-extrabold text-white text-base sm:text-lg">Code for Team Owners & Captains</h3>
                    <span className="text-xs text-amber-400 font-semibold">FPL Leadership Guidelines</span>
                  </div>
                </div>

                <ul className="space-y-2.5 text-xs sm:text-sm text-slate-300">
                  <li className="flex items-start gap-2.5"><span className="text-amber-400 font-bold">•</span> Reasonable when scheduling games and practices, remembering that players have other obligations.</li>
                  <li className="flex items-start gap-2.5"><span className="text-amber-400 font-bold">•</span> Guide players to play fairly and to respect the rules, officials, and opponents.</li>
                  <li className="flex items-start gap-2.5"><span className="text-amber-400 font-bold">•</span> Ensure that all players get equal instruction, support, and opportunities.</li>
                  <li className="flex items-start gap-2.5"><span className="text-amber-400 font-bold">•</span> Will not ridicule or yell at players for making mistakes or performing poorly.</li>
                  <li className="flex items-start gap-2.5"><span className="text-amber-400 font-bold">•</span> Remember players play to have fun and must be encouraged to have confidence in themselves.</li>
                  <li className="flex items-start gap-2.5"><span className="text-amber-400 font-bold">•</span> Be generous with praise and set a good example.</li>
                  <li className="flex items-start gap-2.5"><span className="text-amber-400 font-bold">•</span> Obtain proper training and continue to upgrade team member skills.</li>
                  <li className="flex items-start gap-2.5"><span className="text-amber-400 font-bold">•</span> Work in cooperation with officials for the benefit of the game.</li>
                </ul>
              </div>

              {/* Code for Players */}
              <div className="bg-slate-900/90 border border-emerald-500/30 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl relative overflow-hidden">
                <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold shrink-0">
                    🏏
                  </div>
                  <div>
                    <h3 className="font-extrabold text-white text-base sm:text-lg">Code for Players</h3>
                    <span className="text-xs text-emerald-400 font-semibold">FPL Player Ethics</span>
                  </div>
                </div>

                <ul className="space-y-2.5 text-xs sm:text-sm text-slate-300">
                  <li className="flex items-start gap-2.5"><span className="text-emerald-400 font-bold">•</span> Play cricket because I want to, not just because Captains and Owners want me to.</li>
                  <li className="flex items-start gap-2.5"><span className="text-emerald-400 font-bold">•</span> Play and abide by the rules of cricket during the tournament, and in the spirit of the game.</li>
                  <li className="flex items-start gap-2.5"><span className="text-emerald-400 font-bold">•</span> Control my temper – fighting and “mouthing off” can spoil the activity for everybody.</li>
                  <li className="flex items-start gap-2.5"><span className="text-emerald-400 font-bold">•</span> Respect my opponents and do my best to be a true team player.</li>
                  <li className="flex items-start gap-2.5"><span className="text-emerald-400 font-bold">•</span> Remember that winning isn’t everything. Having fun, improving skills, making friends, and doing my best are also important.</li>
                  <li className="flex items-start gap-2.5"><span className="text-emerald-400 font-bold">•</span> Acknowledge all good plays/performances – those of my team and of my opponents.</li>
                  <li className="flex items-start gap-2.5"><span className="text-emerald-400 font-bold">•</span> Remember that Captains and Owners are there to help me. Accept their decisions and show them respect.</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* TOURNAMENT DETAILS & RULES */}
        <section id="tournament-info" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-24">
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-10 space-y-8">
            <div className="border-b border-slate-800 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white">
                  Tournament Guidelines & Eligibility
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  Read the official guidelines before completing your application.
                </p>
              </div>
              <Link href="/register">
                <Button size="md">Register Now</Button>
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs sm:text-sm text-slate-300">
              <div className="space-y-3 bg-slate-950/60 p-5 rounded-2xl border border-slate-800">
                <h3 className="font-bold text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Eligibility & Age Criteria</span>
                </h3>
                <ul className="space-y-2 list-disc list-inside text-slate-400">
                  <li>Open to male & female players aged 16 years and above.</li>
                  <li>Players must reside in the participating region / district.</li>
                  <li>Physical fitness clearance is required prior to match day.</li>
                </ul>
              </div>

              <div className="space-y-3 bg-slate-950/60 p-5 rounded-2xl border border-slate-800">
                <h3 className="font-bold text-emerald-400 flex items-center gap-2">
                  <Award className="w-4 h-4" />
                  <span>Selection & Match Structure</span>
                </h3>
                <ul className="space-y-2 list-disc list-inside text-slate-400">
                  <li>All registered players are categorized by role for team allocation.</li>
                  <li>Tournament uses T20 format with white ball and professional colored kits.</li>
                  <li>Match schedules and squad lists will be published on the portal.</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* CONTACT SECTION */}
        <section id="contact" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-24">
          <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="space-y-3 text-center md:text-left">
              <h2 className="text-xl sm:text-2xl font-bold text-white">Have Questions or Need Help?</h2>
              <p className="text-xs sm:text-sm text-slate-400 max-w-xl">
                Our tournament helpdesk is available to assist you with registration queries, role choices, and receipt access.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-4 shrink-0">
              <a
                href={`mailto:${activeTournament?.contact_email || 'support@cricketchampionship.org'}`}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs sm:text-sm border border-slate-700 transition-colors"
              >
                <Mail className="w-4 h-4 text-emerald-400" />
                <span>Email Helpdesk</span>
              </a>
              <a
                href={`tel:${activeTournament?.contact_phone || '+919876543210'}`}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs sm:text-sm border border-slate-700 transition-colors"
              >
                <Phone className="w-4 h-4 text-emerald-400" />
                <span>Call Helpdesk</span>
              </a>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">Loading home...</div>}>
      <HomePageContent />
    </Suspense>
  );
}
