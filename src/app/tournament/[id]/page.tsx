'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/public/Header';
import { Footer } from '@/components/public/Footer';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatPaiseToINR, formatDate, cricketRoleLabels } from '@/lib/utils/format';
import { DbTournament, CricketRole, BattingStyle, JerseySize } from '@/types';
import { Trophy, Calendar, Users, ShieldAlert, CheckCircle2, ArrowRight, Upload, Image as ImageIcon, Lock, Crown, Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { TeamOwnerRegistrationModal } from '@/components/register/TeamOwnerRegistrationModal';

export default function PublicTournamentPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const supabase = createClient();

  const [tournament, setTournament] = useState<DbTournament | null>(null);
  const [confirmedCount, setConfirmedCount] = useState<number>(0);
  const [waitlistCount, setWaitlistCount] = useState<number>(0);
  const [availableSlots, setAvailableSlots] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isOwnerModalOpen, setIsOwnerModalOpen] = useState(false);

  // Form State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [profileImageUrl, setProfileImageUrl] = useState('');
  const [cricketRole, setCricketRole] = useState<CricketRole>('BATSMAN');
  const [battingStyle, setBattingStyle] = useState<BattingStyle>('RIGHT_HAND');
  const [jerseySize, setJerseySize] = useState<JerseySize>('M');
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [confirmedPlayers, setConfirmedPlayers] = useState<any[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    // 1. Fetch Tournament details & Confirmed Players Roster
    fetch(`/api/tournaments/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setErrorMsg(data.error);
        } else {
          setTournament(data.tournament);
          setConfirmedCount(data.confirmedCount || 0);
          setWaitlistCount(data.waitlistCount || 0);
          setAvailableSlots(data.availableSlots || 0);
          setConfirmedPlayers(data.confirmedPlayers || []);
        }
      })
      .catch(() => setErrorMsg('Failed to load tournament details'));

    // 2. Fetch authenticated user & prefill persistent profile
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setCurrentUser(user);
        setEmail(user.email || '');

        fetch('/api/players/profile')
          .then((res) => res.json())
          .then((pData) => {
            const defaultName = (user.email || '')
              .split('@')[0]
              .replace(/[._-]/g, ' ')
              .replace(/\b\w/g, (c: string) => c.toUpperCase());

            if (pData.player) {
              setFullName(pData.player.full_name || defaultName);
              setProfileImageUrl(pData.player.profile_image_url || '');
              setCricketRole(pData.player.cricket_role || 'BATSMAN');
              setBattingStyle(pData.player.batting_style || 'RIGHT_HAND');
              setJerseySize(pData.player.jersey_size || 'M');
            } else {
              setFullName(defaultName);
            }
          })
          .catch(() => {});
      }
    }).finally(() => setLoading(false));
  }, [id, supabase]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setErrorMsg('Please upload a JPG, PNG or WebP image');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg('File size must be under 2 MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setProfileImageUrl(reader.result as string);
      setErrorMsg(null);
    };
    reader.readAsDataURL(file);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUser) {
      router.push(`/auth/login?redirect=/tournament/${id}`);
      return;
    }

    if (!profileImageUrl) {
      setErrorMsg('Please upload your profile photo to complete registration');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setTermsAccepted(true);

    try {
      const res = await fetch(`/api/tournaments/${id}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName || email.split('@')[0],
          email,
          profileImageUrl,
          cricketRole,
          battingStyle,
          jerseySize,
          termsAccepted: true,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setErrorMsg(data.error || 'Registration failed');
        setSubmitting(false);
        return;
      }

      // Redirect to registration confirmation details page
      router.push(`/registration/${data.registrationId}`);
    } catch (err: any) {
      setErrorMsg('Network error submitting registration');
      setSubmitting(false);
    }
  };

  const isWaitlistMode = availableSlots <= 0;

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-white">
      <Header />

      <main className="flex-1 py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {loading ? (
            <div className="text-center py-20 text-slate-400">Loading tournament details...</div>
          ) : !tournament ? (
            <div className="p-8 bg-slate-900 border border-slate-800 rounded-3xl text-center space-y-3">
              <ShieldAlert className="w-10 h-10 text-rose-400 mx-auto" />
              <h2 className="text-xl font-bold text-white">Tournament Not Found</h2>
              <p className="text-xs text-slate-400">The requested tournament link may be expired or invalid.</p>
            </div>
          ) : (
            <>
              {/* Registration Deadline Banner Notice if closed */}
              {(() => {
                const isDeadlinePassed = tournament.registration_end_date ? new Date(tournament.registration_end_date) < new Date() : false;
                const isClosed = !tournament.registration_open || isDeadlinePassed;
                if (isClosed) {
                  return (
                    <div className="p-4 bg-rose-950/90 border border-rose-500/50 rounded-2xl text-rose-200 text-xs sm:text-sm font-semibold flex items-center justify-center gap-3 shadow-xl">
                      <Clock className="w-5 h-5 text-rose-400 shrink-0" />
                      <span>
                        Registration for <strong>{tournament.name}</strong> is <strong>CLOSED</strong>
                        {isDeadlinePassed && tournament.registration_end_date ? ` (Registration deadline passed on ${formatDate(tournament.registration_end_date)})` : ''}.
                      </span>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Tournament Header Banner Card */}
              <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-6 relative overflow-hidden">
                {tournament.banner_url && (
                  <div className="relative w-full rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 flex items-center justify-center min-h-[200px] overflow-hidden">
                    <img
                      src={tournament.banner_url}
                      alt=""
                      aria-hidden="true"
                      className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-25 scale-110 pointer-events-none"
                    />
                    <img
                      src={tournament.banner_url}
                      alt={tournament.name}
                      className="w-full h-auto max-h-[420px] object-contain relative z-10"
                    />
                  </div>
                )}

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shrink-0 shadow-xl">
                      <Trophy className="w-9 h-9" />
                    </div>
                    <div>
                      <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                        {tournament.name}
                      </h1>
                      <p className="text-xs sm:text-sm text-slate-300 mt-1">{tournament.description}</p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-3 self-start md:self-auto">
                    {tournament.tournament_type === 'OWNER_BASED' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setIsOwnerModalOpen(true)}
                        className="border-amber-500/40 text-amber-300 hover:bg-amber-950/50"
                        leftIcon={<Crown className="w-4 h-4 text-amber-400" />}
                      >
                        Register as Team Owner
                      </Button>
                    )}

                    <Badge status={tournament.registration_open ? 'ACTIVE' : 'INACTIVE'}>
                      {tournament.registration_open ? 'Registration Open' : 'Registration Closed'}
                    </Badge>
                  </div>
                </div>

                {/* Capacity & Fee Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-800/80">
                  <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                      Fee
                    </span>
                    <span className="text-lg font-extrabold text-emerald-400">
                      {formatPaiseToINR(tournament.registration_fee)}
                    </span>
                  </div>

                  <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                      Date
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-slate-200">
                      {formatDate(tournament.tournament_date)}
                    </span>
                  </div>

                  <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                      Capacity
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-slate-200">
                      {confirmedCount} / {tournament.max_players} Filled
                    </span>
                  </div>

                  <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                      Deadline
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-amber-300">
                      {tournament.registration_end_date ? formatDate(tournament.registration_end_date) : 'Until Capacity'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Registration Form Card */}
              <Card className="space-y-6">
                <div className="border-b border-slate-800 pb-4">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-emerald-400" />
                    <span>{isWaitlistMode ? 'Join Tournament Waitlist' : 'Player Registration'}</span>
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1">
                    {isWaitlistMode
                      ? 'Main squad slots are full. Complete the form to be assigned a waitlist position.'
                      : 'Fill in your player details or confirm your prefilled saved profile.'}
                  </p>
                </div>

                {errorMsg && (
                  <div className="p-4 bg-rose-950/80 border border-rose-500/50 rounded-xl text-rose-300 text-xs sm:text-sm flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 shrink-0 text-rose-400" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {!currentUser ? (
                  <div className="p-6 bg-slate-950/80 border border-slate-800 rounded-2xl text-center space-y-4">
                    <Lock className="w-10 h-10 text-emerald-400 mx-auto" />
                    <h3 className="text-base font-bold text-white">Authentication Required</h3>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                      Please sign in or create an account to register. Your player details will be saved to your reusable profile.
                    </p>
                    <Link href={`/auth/login?redirect=/tournament/${id}`}>
                      <Button size="lg" className="w-full sm:w-auto">
                        Sign In to Register
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <form onSubmit={handleRegisterSubmit} className="space-y-6">
                    {/* 1st Field: Profile Image Upload / Preview */}
                    <div className="space-y-2">
                      <label className="text-xs sm:text-sm font-medium text-slate-300 block">
                        Profile Photo <span className="text-rose-400">*</span>
                      </label>
                      <div className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-slate-950/60 border border-dashed border-slate-700 rounded-2xl">
                        {profileImageUrl ? (
                          <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-emerald-500 shrink-0">
                            <img src={profileImageUrl} alt="Player Photo" className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 shrink-0">
                            <ImageIcon className="w-10 h-10" />
                          </div>
                        )}
                        <div className="flex-1 text-center sm:text-left">
                          <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-medium rounded-xl border border-slate-700 transition-colors">
                            <Upload className="w-4 h-4 text-emerald-400" />
                            <span>Choose Photo</span>
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              className="hidden"
                              onChange={handleImageUpload}
                            />
                          </label>
                          <p className="text-[11px] text-slate-400 mt-1">
                            Required: JPG, PNG or WebP (Max 2 MB)
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Full Name */}
                      <Input
                        label="Player Full Name"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Rahul Patil"
                        helperText="Extracted from account, fully editable"
                      />

                      {/* Email (Readonly) */}
                      <Input
                        label="Email Address"
                        disabled
                        value={email}
                        helperText="Authenticated account email"
                      />

                      {/* Cricket Role */}
                      <Select
                        label="Cricket Role"
                        required
                        value={cricketRole}
                        onChange={(e) => setCricketRole(e.target.value as CricketRole)}
                        options={[
                          { value: 'BATSMAN', label: 'Batsman' },
                          { value: 'BOWLER', label: 'Bowler' },
                          { value: 'ALL_ROUNDER', label: 'All-rounder' },
                          { value: 'BATSMAN_WICKETKEEPER', label: 'Batsman + Wicketkeeper' },
                          { value: 'BOWLER_WICKETKEEPER', label: 'Bowler + Wicketkeeper' },
                        ]}
                      />

                      {/* Batting Style */}
                      <Select
                        label="Batting Style"
                        value={battingStyle}
                        onChange={(e) => setBattingStyle(e.target.value as BattingStyle)}
                        options={[
                          { value: 'RIGHT_HAND', label: 'Right-hand' },
                          { value: 'LEFT_HAND', label: 'Left-hand' },
                        ]}
                      />

                      {/* Jersey Size */}
                      <Select
                        label="Jersey Size"
                        required
                        value={jerseySize}
                        onChange={(e) => setJerseySize(e.target.value as JerseySize)}
                        options={[
                          { value: 'S', label: 'Small (S - 38")' },
                          { value: 'M', label: 'Medium (M - 40")' },
                          { value: 'L', label: 'Large (L - 42")' },
                          { value: 'XL', label: 'X-Large (XL - 44")' },
                          { value: 'XXL', label: 'XX-Large (XXL - 46")' },
                          { value: '3XL', label: '3X-Large (3XL - 48")' },
                        ]}
                      />
                    </div>

                    {/* Terms & Conduct Checkbox */}
                    <div className="pt-2">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={termsAccepted}
                          onChange={(e) => {
                            setTermsAccepted(e.target.checked);
                            if (e.target.checked) setErrorMsg(null);
                          }}
                          className="w-5 h-5 mt-0.5 rounded border-slate-700 bg-slate-950 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                        <span className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                          I agree to abide by all tournament rules and code of conduct.
                        </span>
                      </label>
                    </div>

                    <div className="pt-4 border-t border-slate-800 flex justify-end">
                      <Button
                        type="submit"
                        size="lg"
                        isLoading={submitting}
                        disabled={!tournament.registration_open}
                        rightIcon={<ArrowRight className="w-5 h-5" />}
                        className="w-full sm:w-auto"
                      >
                        {isWaitlistMode ? 'Submit & Join Waitlist' : `Complete Registration (${formatPaiseToINR(tournament.registration_fee)})`}
                      </Button>
                    </div>
                  </form>
                )}
              </Card>

              {/* CONFIRMED SQUAD ROSTER SECTION */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-emerald-400" />
                      <span>Confirmed Tournament Squad ({confirmedPlayers.length})</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Official squad roster of admin-approved registered players for {tournament.name}.
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/80 px-3 py-1 rounded-full border border-emerald-500/30 self-start sm:self-auto">
                    {confirmedPlayers.length} Confirmed Players
                  </span>
                </div>

                {confirmedPlayers.length === 0 ? (
                  <div className="p-8 bg-slate-950/60 border border-slate-800 rounded-2xl text-center space-y-2">
                    <p className="text-xs text-slate-400">
                      No players have been approved for this tournament yet. Complete your registration above to get your slot verified!
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {confirmedPlayers.map((playerItem) => {
                      const isCurrentUser = currentUser?.email && playerItem.player?.email === currentUser.email;

                      return (
                        <div
                          key={playerItem.id}
                          className={`p-4 rounded-2xl border transition-all space-y-3 ${
                            isCurrentUser
                              ? 'bg-emerald-950/40 border-emerald-500/60 shadow-lg shadow-emerald-950/50'
                              : 'bg-slate-950/80 border-slate-800'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[11px] font-bold text-emerald-400">
                              {playerItem.registration_number}
                            </span>
                            {isCurrentUser ? (
                              <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950 px-2 py-0.5 rounded-full border border-emerald-500/40">
                                🎉 Your Entry
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-slate-400 bg-slate-900 px-2 py-0.5 rounded-full border border-slate-800">
                                Confirmed
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3">
                            {playerItem.registered_image_snapshot ? (
                              <img
                                src={playerItem.registered_image_snapshot}
                                alt="Player Photo"
                                className="w-12 h-12 rounded-full object-cover border-2 border-emerald-500 shrink-0"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                                <Users className="w-6 h-6" />
                              </div>
                            )}
                            <div>
                              <h4 className="font-bold text-white text-sm">
                                {playerItem.registered_name_snapshot}
                              </h4>
                              <span className="text-xs text-emerald-300 font-semibold block">
                                {cricketRoleLabels[playerItem.registered_role_snapshot as keyof typeof cricketRoleLabels] || playerItem.registered_role_snapshot}
                              </span>
                            </div>
                          </div>

                          <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-800/80">
                            <span className="text-slate-400">Jersey Size:</span>
                            <span className="font-bold text-amber-400">
                              {playerItem.registered_jersey_size_snapshot || 'M'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>

      {tournament && (
        <TeamOwnerRegistrationModal
          isOpen={isOwnerModalOpen}
          onClose={() => setIsOwnerModalOpen(false)}
          tournament={tournament}
          currentUser={currentUser}
        />
      )}

      <Footer />
    </div>
  );
}
