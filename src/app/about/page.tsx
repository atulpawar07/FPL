'use client';

import React from 'react';
import Link from 'next/link';
import { Header } from '@/components/public/Header';
import { Footer } from '@/components/public/Footer';
import {
  Trophy,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  UserCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-white">
      <Header />

      <main className="flex-1 space-y-16 md:space-y-24 pb-20 pt-8 md:pt-12">
        {/* PAGE HERO */}
        <section className="relative overflow-hidden">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-emerald-500/10 blur-[140px] pointer-events-none rounded-full" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-6 text-center">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs md:text-sm font-semibold tracking-wide">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Official Platform Mission</span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-[1.1]">
              About FairPlay Premier League (FPL)
            </h1>
            <p className="text-sm sm:text-base text-slate-300 max-w-3xl mx-auto leading-relaxed">
              Established in 2022, FairPlay Premier League (FPL) is a platform which has been formed to enhance the game of cricket
              with those cricket enthusiasts who never got an opportunity or a platform to discover their skills
              and achieve their dreams. In Fairplay Premier League (FPL) we practice being sincere towards
              maintaining the integrity of the game by rendering{' '}
              <strong className="text-emerald-300">RESPECT</strong> towards all participants and League officials involved.
            </p>
          </div>
        </section>

        {/* 5 BASIC PRINCIPLES */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="bg-gradient-to-br from-slate-900 via-emerald-950/40 to-slate-950 border border-emerald-500/30 rounded-3xl p-6 sm:p-10 space-y-6 shadow-2xl relative overflow-hidden">
            <h2 className="text-sm font-extrabold text-amber-300 uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-amber-400" />
              Five Basic Principles of FairPlay Premier League
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {[
                'Respect the rules of the League.',
                'Respect the opponents.',
                'Respect the League officials and their decisions.',
                'Have everyone participate.',
                'Always maintain self-control.',
              ].map((principle, idx) => (
                <div
                  key={idx}
                  className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 text-sm font-semibold text-slate-200 flex items-center gap-3 shadow-md hover:border-amber-500/40 transition-colors"
                >
                  <span className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0 text-sm font-bold">
                    {idx + 1}
                  </span>
                  <span>{principle}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* BENEFITS & TEAM SELECTION */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
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

            {/* Team Selection Criteria */}
            <div className="lg:col-span-6 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl">
              <h3 className="text-lg font-extrabold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                <ShieldCheck className="w-5 h-5 text-teal-400" />
                Team Selection & Auction Standards
              </h3>
              <div className="space-y-3 text-xs sm:text-sm text-slate-300 leading-relaxed">
                <p>
                  Procedures for selection of competitive and recreational teams vary with associations.
                  In player selection, <strong>&apos;Ability&apos;</strong> and <strong>&apos;Attitude&apos;</strong> should be criteria.
                  All participants must be made aware of these two criteria prior to selections.
                </p>
                <div className="p-3.5 bg-rose-950/40 border border-rose-500/30 rounded-2xl text-rose-200 text-xs font-semibold">
                  🚫 Players exhibiting poor sportsmanship, lack of honesty, and lack of safety and respect
                  for others should be made aware that attitudes such as these are not tolerated in FPL.
                </div>
                <p className="text-slate-400">
                  Selection criteria in auction for any members should not solely be based upon skill level.
                  Attitude is important. FPL Program Intercede are components introduced into Premier Leagues
                  to enhance Dishonest Practice and Respect towards fellow members and to abide with the principles of FPL.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CODE OF CONDUCT */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="text-center space-y-2 max-w-xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Official Code of Conduct</h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Established rules and ethical guidelines for all participants in FPL.
            </p>
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
                <li className="flex items-start gap-2.5"><span className="text-emerald-400 font-bold">•</span> Control my temper – fighting and &quot;mouthing off&quot; can spoil the activity for everybody.</li>
                <li className="flex items-start gap-2.5"><span className="text-emerald-400 font-bold">•</span> Respect my opponents and do my best to be a true team player.</li>
                <li className="flex items-start gap-2.5"><span className="text-emerald-400 font-bold">•</span> Remember that winning isn&apos;t everything. Having fun, improving skills, making friends, and doing my best are also important.</li>
                <li className="flex items-start gap-2.5"><span className="text-emerald-400 font-bold">•</span> Acknowledge all good plays/performances – those of my team and of my opponents.</li>
                <li className="flex items-start gap-2.5"><span className="text-emerald-400 font-bold">•</span> Remember that Captains and Owners are there to help me. Accept their decisions and show them respect.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-950 border border-emerald-500/30 rounded-3xl p-8 sm:p-12 text-center space-y-6 shadow-2xl">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Ready to Join the League?</h2>
            <p className="text-sm text-slate-300 max-w-xl mx-auto">
              Register as a player or team owner and be part of the FairPlay Premier League experience.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/register">
                <Button size="lg" leftIcon={<UserCheck className="w-5 h-5" />}>
                  Register as Player
                </Button>
              </Link>
              <Link href="/how-it-works">
                <Button size="lg" variant="outline" rightIcon={<ArrowRight className="w-4 h-4" />}>
                  How It Works
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
