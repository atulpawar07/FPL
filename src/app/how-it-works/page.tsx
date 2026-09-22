'use client';

import React from 'react';
import Link from 'next/link';
import { Header } from '@/components/public/Header';
import { Footer } from '@/components/public/Footer';
import {
  UserCheck,
  ArrowRight,
  Sparkles,
  FileImage,
  ShieldCheck,
  Trophy,
  Phone,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

const steps = [
  {
    number: 1,
    title: 'Personal Details',
    description:
      'Enter your full name, 10-digit mobile number, email, date of birth, city, and upload your profile photo.',
    icon: '📋',
    color: 'emerald',
  },
  {
    number: 2,
    title: 'Cricket Skills',
    description:
      'Select your primary playing role (Batsman, Bowler, All-rounder), batting style, bowling style, and preferred jersey size.',
    icon: '🏏',
    color: 'teal',
  },
  {
    number: 3,
    title: 'Review & Pay Fee',
    description:
      'Review your entry details, verify the registration fee, scan the QR code to pay via UPI, and upload your payment screenshot.',
    icon: '💳',
    color: 'amber',
  },
  {
    number: 4,
    title: 'Admin Verification',
    description:
      'Your registration and payment screenshot are reviewed by the admin. Once approved, you receive your official tournament entry pass with a unique Reference ID.',
    icon: '✅',
    color: 'sky',
  },
];

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-white">
      <Header />

      <main className="flex-1 space-y-16 md:space-y-24 pb-20 pt-8 md:pt-12">
        {/* PAGE HERO */}
        <section className="relative overflow-hidden">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[250px] bg-teal-500/10 blur-[140px] pointer-events-none rounded-full" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-4 text-center">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs md:text-sm font-semibold tracking-wide">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Registration Journey</span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-[1.1]">
              How to Complete Your Registration
            </h1>
            <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
              Get registered in 4 simple mobile-friendly steps. Your entry is verified by our admin team
              before being confirmed.
            </p>
          </div>
        </section>

        {/* STEPS SECTION */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((step) => (
              <div
                key={step.number}
                className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-6 space-y-4 hover:border-emerald-500/50 transition-all group relative overflow-hidden"
              >
                {/* Subtle glow on hover */}
                <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-2xl" />

                <div className="relative z-10 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-800 text-emerald-400 font-bold text-lg flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors shrink-0">
                    {step.number}
                  </div>
                  <span className="text-2xl">{step.icon}</span>
                </div>

                <h3 className="relative z-10 font-bold text-slate-100 text-base">{step.title}</h3>
                <p className="relative z-10 text-xs text-slate-400 leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* DETAILED FLOW FOR PLAYERS */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white text-center">
            Player Registration Flow
          </h2>

          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-10 space-y-6 shadow-xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-950 border border-emerald-500/40 text-emerald-400 flex items-center justify-center text-sm font-bold shrink-0">
                    1
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm">Fill Your Details</h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Name, mobile, email, date of birth, city, profile photo, cricket role, batting style,
                      bowling style, jersey size.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-950 border border-emerald-500/40 text-emerald-400 flex items-center justify-center text-sm font-bold shrink-0">
                    2
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm">Pay Registration Fee</h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Scan the UPI QR code or use the payment details displayed to pay the registration fee.
                      Upload a screenshot of your payment confirmation.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-950 border border-amber-500/40 text-amber-400 flex items-center justify-center text-sm font-bold shrink-0">
                    3
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm">Admin Reviews Your Entry</h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Your registration stays in <strong className="text-amber-300">PENDING</strong> status
                      until the admin verifies your payment screenshot and approves your entry.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-sky-950 border border-sky-500/40 text-sky-400 flex items-center justify-center text-sm font-bold shrink-0">
                    4
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm">Entry Confirmed!</h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Once approved, your status changes to <strong className="text-emerald-300">CONFIRMED</strong>.
                      You receive your unique Reference ID (REG-2026-XXXXX) and can download your official receipt.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-bold text-white text-sm flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  Team Owner Registration
                </h4>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-950 border border-amber-500/40 text-amber-400 flex items-center justify-center text-sm font-bold shrink-0">
                      👑
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">Owner + Icon Player Details</h4>
                      <p className="text-xs text-slate-400 mt-1">
                        Fill in owner details, team name, icon player details (name, mobile, role, batting style,
                        jersey size). Both the owner and icon player are registered.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-950 border border-amber-500/40 text-amber-400 flex items-center justify-center text-sm font-bold shrink-0">
                      💰
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">Clubbed Fee Payment</h4>
                      <p className="text-xs text-slate-400 mt-1">
                        The owner pays a clubbed fee = Owner Entry Fee + Player Entry Fee in a single payment.
                        Upload a screenshot of the combined payment.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-950 border border-amber-500/40 text-amber-400 flex items-center justify-center text-sm font-bold shrink-0">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">Admin Approval Required</h4>
                      <p className="text-xs text-slate-400 mt-1">
                        Both owner and icon player registrations stay <strong className="text-amber-300">PENDING</strong> until
                        admin verifies the payment screenshot and approves.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* NEED HELP */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="space-y-3 text-center md:text-left">
              <h2 className="text-xl sm:text-2xl font-bold text-white">Need Help Registering?</h2>
              <p className="text-xs sm:text-sm text-slate-400 max-w-xl">
                Contact our tournament desk for any queries about registration, payments, or tournament details.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-4 shrink-0">
              <a
                href="https://wa.me/918652526186"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 font-semibold rounded-xl text-xs sm:text-sm border border-emerald-500/40 transition-colors shadow-lg"
              >
                <span>💬 WhatsApp: 8652526186</span>
              </a>
              <a
                href="tel:+918433832332"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs sm:text-sm border border-slate-700 transition-colors"
              >
                <Phone className="w-4 h-4 text-emerald-400" />
                <span>Calling: 8433832332</span>
              </a>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-950 border border-emerald-500/30 rounded-3xl p-8 sm:p-12 text-center space-y-6 shadow-2xl">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Ready to Register?</h2>
            <p className="text-sm text-slate-300 max-w-xl mx-auto">
              Join the FairPlay Premier League and showcase your cricket skills.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/register">
                <Button size="lg" leftIcon={<UserCheck className="w-5 h-5" />}>
                  Register as Player
                </Button>
              </Link>
              <Link href="/about">
                <Button size="lg" variant="outline" rightIcon={<ArrowRight className="w-4 h-4" />}>
                  About FPL
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
