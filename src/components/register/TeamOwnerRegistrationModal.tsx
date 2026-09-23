'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { formatPaiseToINR } from '@/lib/utils/format';
import { compressImageFile } from '@/lib/utils/image';
import { Crown, Upload, CheckCircle2, ShieldAlert, Image as ImageIcon, UserCheck } from 'lucide-react';

interface TeamOwnerRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  tournament: any;
  currentUser?: any;
}

export const TeamOwnerRegistrationModal: React.FC<TeamOwnerRegistrationModalProps> = ({
  isOpen,
  onClose,
  tournament,
  currentUser,
}) => {
  // Team Info State
  const [teamName, setTeamName] = useState('');
  const [teamLogoUrl, setTeamLogoUrl] = useState('');

  // Team Owner Details
  const [ownerName, setOwnerName] = useState(
    currentUser?.user_metadata?.full_name || currentUser?.email?.split('@')[0] || ''
  );
  const [contactEmail, setContactEmail] = useState(currentUser?.email || '');
  const [contactPhone, setContactPhone] = useState('');
  const [ownerDateOfBirth, setOwnerDateOfBirth] = useState('');
  const [ownerCity, setOwnerCity] = useState('');
  const [ownerIsPlaying, setOwnerIsPlaying] = useState(true);
  const [ownerCricketRole, setOwnerCricketRole] = useState('ALL_ROUNDER');
  const [ownerBattingStyle, setOwnerBattingStyle] = useState('RIGHT_HAND');
  const [ownerBowlingStyle, setOwnerBowlingStyle] = useState('DOESNT_BOWL');
  const [ownerJerseySize, setOwnerJerseySize] = useState('M');

  // Icon Player Details
  const [iconPlayerName, setIconPlayerName] = useState('');
  const [iconPlayerMobile, setIconPlayerMobile] = useState('');
  const [iconPlayerEmail, setIconPlayerEmail] = useState('');
  const [iconPlayerDateOfBirth, setIconPlayerDateOfBirth] = useState('');
  const [iconPlayerCity, setIconPlayerCity] = useState('');
  const [iconPlayerRole, setIconPlayerRole] = useState('BATSMAN');
  const [iconPlayerBattingStyle, setIconPlayerBattingStyle] = useState('RIGHT_HAND');
  const [iconPlayerBowlingStyle, setIconPlayerBowlingStyle] = useState('DOESNT_BOWL');
  const [iconPlayerJerseySize, setIconPlayerJerseySize] = useState('M');

  // Payment Proof Screenshot
  const [screenshotUrl, setScreenshotUrl] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Calculate Clubbed Fees (Owner Entry + Player Entry)
  const ownerFeePaise = tournament?.owner_registration_fee || 900000;
  const playerFeePaise = tournament?.registration_fee || 90000;
  const totalClubbedFeePaise = ownerFeePaise + playerFeePaise;

  const ownerFeeDisplay = formatPaiseToINR(ownerFeePaise);
  const playerFeeDisplay = formatPaiseToINR(playerFeePaise);
  const totalClubbedFeeDisplay = formatPaiseToINR(totalClubbedFeePaise);

  const isIconRequired = Boolean(tournament?.icon_player_enabled);
  const isOwnerPlayingAllowed = tournament?.owner_is_playing_enabled !== false;

  const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImageFile(file);
      if (compressed) {
        setScreenshotUrl(compressed);
      }
    } catch {
      // Fallback
      const reader = new FileReader();
      reader.onloadend = () => setScreenshotUrl(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerName || !contactEmail || !teamName.trim()) {
      setErrorMsg('Team Name, Owner Name, and Contact Email are required');
      return;
    }

    if (!tournament?.id) {
      setErrorMsg('Tournament ID missing. Please reload the page.');
      return;
    }

    if (isIconRequired && !iconPlayerName.trim()) {
      setErrorMsg('Icon Player Name is required for this tournament');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/registrations/owner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId: tournament.id,
          teamName: teamName.trim(),
          teamLogoUrl: teamLogoUrl.trim() || null,
          ownerName: ownerName.trim(),
          contactEmail: contactEmail.trim().toLowerCase(),
          contactPhone: contactPhone.trim(),
          ownerDateOfBirth,
          ownerCity,
          playerId: currentUser?.id,
          paymentScreenshotUrl: screenshotUrl,
          ownerIsPlaying,
          ownerCricketRole,
          ownerBattingStyle,
          ownerBowlingStyle,
          ownerJerseySize,
          iconPlayerName: iconPlayerName.trim(),
          iconPlayerMobile: iconPlayerMobile.trim(),
          iconPlayerEmail: iconPlayerEmail.trim(),
          iconPlayerDateOfBirth,
          iconPlayerCity,
          iconPlayerRole,
          iconPlayerBattingStyle,
          iconPlayerBowlingStyle,
          iconPlayerJerseySize,
          clubbedAmountPaise: totalClubbedFeePaise,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setErrorMsg(data.error || 'Failed to register as Team Owner');
        setSubmitting(false);
        return;
      }

      setSuccessMsg(data.message || 'Registered as Team Owner successfully!');
      setSubmitting(false);
      setTimeout(() => {
        onClose();
        window.location.reload();
      }, 1800);
    } catch (err: any) {
      setErrorMsg('Network error submitting Team Owner registration');
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="👑 Team Owner & Icon Player Registration" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-5 text-xs sm:text-sm">
        {/* CLUBBED FEE SUMMARY BANNER */}
        <div className="p-4 bg-gradient-to-r from-amber-950/80 via-slate-900 to-amber-950/80 border border-amber-500/50 rounded-2xl space-y-2 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-amber-300 text-sm">{tournament?.name}</span>
            <Crown className="w-6 h-6 text-amber-400 shrink-0" />
          </div>
          <div className="pt-2 border-t border-amber-500/20 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Owner Entry</span>
              <span className="font-bold text-amber-300">{ownerFeeDisplay}</span>
            </div>
            <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Player Entry</span>
              <span className="font-bold text-emerald-300">{playerFeeDisplay}</span>
            </div>
            <div className="bg-amber-950 border border-amber-500/60 p-2 rounded-xl">
              <span className="text-[10px] text-amber-300 uppercase font-bold block">Total Clubbed Fee</span>
              <span className="font-extrabold text-amber-400 text-sm">{totalClubbedFeeDisplay}</span>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-950/80 border border-rose-500/50 rounded-xl text-rose-300 text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-950/80 border border-emerald-500/50 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* 1. TEAM FRANCHISE DETAILS */}
        <div className="p-4 bg-amber-950/20 border border-amber-500/30 rounded-2xl space-y-3">
          <h3 className="font-extrabold text-amber-300 text-xs uppercase tracking-wider flex items-center gap-2">
            <Crown className="w-4 h-4 text-amber-400" />
            <span>Team / Franchise Details</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Team / Franchise Name *"
              required
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="e.g. Royal Strikers Mumbai"
            />
            <Input
              label="Team Logo URL (Optional)"
              type="url"
              value={teamLogoUrl}
              onChange={(e) => setTeamLogoUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
            />
          </div>
        </div>

        {/* 2. TEAM OWNER FULL DETAILS */}
        <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-3">
          <h3 className="font-extrabold text-slate-200 text-xs uppercase tracking-wider flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-amber-400" />
            <span>Team Owner Personal & Cricket Details</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Owner Full Name *"
              required
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="e.g. Vikram Sharma"
            />
            <Input
              label="Contact Email *"
              type="email"
              required
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="owner@example.com"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Mobile Number *"
              type="tel"
              required
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="10 digit mobile"
            />
            <Input
              label="Date of Birth"
              type="date"
              value={ownerDateOfBirth}
              onChange={(e) => setOwnerDateOfBirth(e.target.value)}
            />
            <Input
              label="City / Location"
              value={ownerCity}
              onChange={(e) => setOwnerCity(e.target.value)}
              placeholder="e.g. Mumbai"
            />
          </div>

          {/* Owner Playing Details */}
          {isOwnerPlayingAllowed && (
            <div className="pt-2 border-t border-slate-800 space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ownerIsPlaying}
                  onChange={(e) => setOwnerIsPlaying(e.target.checked)}
                  className="w-4 h-4 accent-amber-500 rounded"
                />
                <span className="font-bold text-amber-300 text-xs">
                  🏏 Register Team Owner as Playing Player in Squad
                </span>
              </label>

              {ownerIsPlaying && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div>
                    <label className="text-[11px] font-medium text-slate-300 block mb-1">Playing Role</label>
                    <select
                      value={ownerCricketRole}
                      onChange={(e) => setOwnerCricketRole(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-2 text-xs"
                    >
                      <option value="BATSMAN">Batsman</option>
                      <option value="BOWLER">Bowler</option>
                      <option value="ALL_ROUNDER">All-Rounder</option>
                      <option value="WICKETKEEPER">Wicketkeeper</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-slate-300 block mb-1">Batting Style</label>
                    <select
                      value={ownerBattingStyle}
                      onChange={(e) => setOwnerBattingStyle(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-2 text-xs"
                    >
                      <option value="RIGHT_HAND">Right Hand</option>
                      <option value="LEFT_HAND">Left Hand</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-slate-300 block mb-1">Bowling Style</label>
                    <select
                      value={ownerBowlingStyle}
                      onChange={(e) => setOwnerBowlingStyle(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-2 text-xs"
                    >
                      <option value="DOESNT_BOWL">Doesn't Bowl</option>
                      <option value="RIGHT_ARM_FAST">Right Arm Fast</option>
                      <option value="RIGHT_ARM_SPIN">Right Arm Spin</option>
                      <option value="LEFT_ARM_FAST">Left Arm Fast</option>
                      <option value="LEFT_ARM_SPIN">Left Arm Spin</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-slate-300 block mb-1">Jersey Size</label>
                    <select
                      value={ownerJerseySize}
                      onChange={(e) => setOwnerJerseySize(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-2 text-xs"
                    >
                      <option value="S">Small (S - 38")</option>
                      <option value="M">Medium (M - 40")</option>
                      <option value="L">Large (L - 42")</option>
                      <option value="XL">X-Large (XL - 44")</option>
                      <option value="XXL">XX-Large (XXL - 46")</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 3. ICON PLAYER FULL DETAILS */}
        <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-xs font-extrabold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
              <Crown className="w-4 h-4 text-amber-400" />
              Icon Player Personal & Cricket Details {isIconRequired ? '*' : '(Optional)'}
            </span>
            {isIconRequired && (
              <span className="text-[10px] font-bold text-amber-400 bg-amber-950 border border-amber-500/40 px-2 py-0.5 rounded-full">
                Required
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Icon Player Full Name *"
              required={isIconRequired}
              value={iconPlayerName}
              onChange={(e) => setIconPlayerName(e.target.value)}
              placeholder="e.g. Rohit Sharma"
            />
            <Input
              label="Icon Player Mobile Number *"
              type="tel"
              required={isIconRequired}
              value={iconPlayerMobile}
              onChange={(e) => setIconPlayerMobile(e.target.value)}
              placeholder="10 digit mobile"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Icon Player Email"
              type="email"
              value={iconPlayerEmail}
              onChange={(e) => setIconPlayerEmail(e.target.value)}
              placeholder="icon@example.com"
            />
            <Input
              label="Date of Birth"
              type="date"
              value={iconPlayerDateOfBirth}
              onChange={(e) => setIconPlayerDateOfBirth(e.target.value)}
            />
            <Input
              label="City / Location"
              value={iconPlayerCity}
              onChange={(e) => setIconPlayerCity(e.target.value)}
              placeholder="e.g. Mumbai"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
            <div>
              <label className="text-[11px] font-medium text-slate-300 block mb-1">Playing Role *</label>
              <select
                value={iconPlayerRole}
                onChange={(e) => setIconPlayerRole(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-2 text-xs"
              >
                <option value="BATSMAN">Batsman</option>
                <option value="BOWLER">Bowler</option>
                <option value="ALL_ROUNDER">All-Rounder</option>
                <option value="WICKETKEEPER">Wicketkeeper</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-medium text-slate-300 block mb-1">Batting Style *</label>
              <select
                value={iconPlayerBattingStyle}
                onChange={(e) => setIconPlayerBattingStyle(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-2 text-xs"
              >
                <option value="RIGHT_HAND">Right Hand</option>
                <option value="LEFT_HAND">Left Hand</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-medium text-slate-300 block mb-1">Bowling Style</label>
              <select
                value={iconPlayerBowlingStyle}
                onChange={(e) => setIconPlayerBowlingStyle(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-2 text-xs"
              >
                <option value="DOESNT_BOWL">Doesn't Bowl</option>
                <option value="RIGHT_ARM_FAST">Right Arm Fast</option>
                <option value="RIGHT_ARM_SPIN">Right Arm Spin</option>
                <option value="LEFT_ARM_FAST">Left Arm Fast</option>
                <option value="LEFT_ARM_SPIN">Left Arm Spin</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-medium text-slate-300 block mb-1">Jersey Size *</label>
              <select
                value={iconPlayerJerseySize}
                onChange={(e) => setIconPlayerJerseySize(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-2 text-xs"
              >
                <option value="S">Small (S - 38")</option>
                <option value="M">Medium (M - 40")</option>
                <option value="L">Large (L - 42")</option>
                <option value="XL">X-Large (XL - 44")</option>
                <option value="XXL">XX-Large (XXL - 46")</option>
              </select>
            </div>
          </div>
        </div>

        {/* 4. CLUBBED PAYMENT SCREENSHOT PROOF */}
        <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-200 block">
              Payment Screenshot Proof (Total Clubbed Fee: <strong className="text-amber-400">{totalClubbedFeeDisplay}</strong>)
            </label>
          </div>

          <div className="flex items-center gap-4 p-3 bg-slate-950 rounded-xl border border-slate-800">
            {screenshotUrl ? (
              <img src={screenshotUrl} alt="Payment Screenshot" className="w-16 h-16 object-contain rounded bg-slate-900 border border-emerald-500" />
            ) : (
              <div className="w-16 h-16 bg-slate-800 rounded flex items-center justify-center text-slate-500">
                <ImageIcon className="w-6 h-6" />
              </div>
            )}
            <div className="flex-1 space-y-1">
              <label className="cursor-pointer px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 inline-block">
                Upload Payment Proof (₹9,900)
                <input type="file" accept="image/*" className="hidden" onChange={handleScreenshotUpload} />
              </label>
              <span className="text-[10px] text-slate-400 block">
                Attach UPI transaction receipt for verification.
              </span>
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={submitting} variant="gold">
            Register Team Owner & Icon ({totalClubbedFeeDisplay})
          </Button>
        </div>
      </form>
    </Modal>
  );
};
