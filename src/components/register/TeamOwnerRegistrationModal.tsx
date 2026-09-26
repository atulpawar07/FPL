'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { formatPaiseToINR } from '@/lib/utils/format';
import { compressImageFile } from '@/lib/utils/image';
import {
  Crown,
  Upload,
  CheckCircle2,
  ShieldAlert,
  Image as ImageIcon,
  UserCheck,
  Shield,
  Star,
} from 'lucide-react';

import { JerseyInfoTooltip } from '@/components/ui/JerseyInfoTooltip';

interface TeamOwnerRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  tournament: any;
  currentUser?: any;
}

const CRICKET_ROLE_OPTIONS = [
  { value: 'BATSMAN', label: 'Batsman' },
  { value: 'BOWLER', label: 'Bowler' },
  { value: 'ALL_ROUNDER', label: 'All-Rounder' },
  { value: 'BATSMAN_WICKETKEEPER', label: 'Batsman + Wicketkeeper' },
  { value: 'BOWLER_WICKETKEEPER', label: 'Bowler + Wicketkeeper' },
];

const BATTING_STYLE_OPTIONS = [
  { value: 'RIGHT_HAND', label: 'Right Hand' },
  { value: 'LEFT_HAND', label: 'Left Hand' },
];

const BOWLING_STYLE_OPTIONS = [
  { value: '', label: "Doesn't Bowl" },
  { value: 'RIGHT_ARM_FAST', label: 'Right Arm Fast' },
  { value: 'RIGHT_ARM_MEDIUM', label: 'Right Arm Medium' },
  { value: 'RIGHT_ARM_SPIN', label: 'Right Arm Spin' },
  { value: 'LEFT_ARM_FAST', label: 'Left Arm Fast' },
  { value: 'LEFT_ARM_MEDIUM', label: 'Left Arm Medium' },
  { value: 'LEFT_ARM_SPIN', label: 'Left Arm Spin' },
];

const JERSEY_SIZE_OPTIONS = [
  { value: 'S', label: 'Small (S - 38")' },
  { value: 'M', label: 'Medium (M - 40")' },
  { value: 'L', label: 'Large (L - 42")' },
  { value: 'XL', label: 'X-Large (XL - 44")' },
  { value: 'XXL', label: 'XX-Large (XXL - 46")' },
  { value: '3XL', label: '3X-Large (3XL - 48")' },
];

const SectionHeader: React.FC<{
  icon: React.ReactNode;
  title: string;
  badge?: string;
  badgeColor?: string;
}> = ({ icon, title, badge, badgeColor = 'text-amber-400 bg-amber-950 border-amber-500/40' }) => (
  <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
    <span className="text-xs font-extrabold text-slate-200 uppercase tracking-wider flex items-center gap-2">
      {icon}
      {title}
    </span>
    {badge && (
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeColor}`}>
        {badge}
      </span>
    )}
  </div>
);

const SelectField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}> = ({ label, value, onChange, options }) => (
  <div>
    <label className="text-[11px] font-medium text-slate-300 block mb-1">{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  </div>
);

export const TeamOwnerRegistrationModal: React.FC<TeamOwnerRegistrationModalProps> = ({
  isOpen,
  onClose,
  tournament,
  currentUser,
}) => {
  // ---- OWNER / PLAYER #1 STATE ----
  const [ownerName, setOwnerName] = useState(
    currentUser?.user_metadata?.full_name || currentUser?.email?.split('@')[0] || ''
  );
  const [contactEmail, setContactEmail] = useState(currentUser?.email || '');
  const [contactPhone, setContactPhone] = useState('');
  // Owner Player #1 snapshot fields (same fields as normal Player)
  const [ownerRole, setOwnerRole] = useState('BATSMAN');
  const [ownerBattingStyle, setOwnerBattingStyle] = useState('RIGHT_HAND');
  const [ownerBowlingStyle, setOwnerBowlingStyle] = useState('');
  const [ownerJerseySize, setOwnerJerseySize] = useState('M');
  // Owner profile image: stored as base64 data URL for preview; sent as-is to API
  const [ownerProfileImageUrl, setOwnerProfileImageUrl] = useState('');

  // ---- TEAM STATE ----
  const [teamName, setTeamName] = useState('');
  const [teamLogoUrl, setTeamLogoUrl] = useState('');
  const [teamLogoBase64, setTeamLogoBase64] = useState('');

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Team logo image must be 5 MB or smaller');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setTeamLogoBase64(result);
      setTeamLogoUrl(result);
      setErrorMsg(null);
    };
    reader.readAsDataURL(file);
  };

  // ---- ICON / PLAYER #2 STATE ----
  const [iconPlayerName, setIconPlayerName] = useState('');
  const [iconPlayerMobile, setIconPlayerMobile] = useState('');
  const [iconPlayerRole, setIconPlayerRole] = useState('BATSMAN');
  const [iconPlayerBattingStyle, setIconPlayerBattingStyle] = useState('RIGHT_HAND');
  const [iconPlayerBowlingStyle, setIconPlayerBowlingStyle] = useState('');

  // ---- PAYMENT STATE ----
  const [paymentMethod, setPaymentMethod] = useState<'UPI_QR' | 'ACKNOWLEDGE_BY_ORGANISER'>('UPI_QR');
  const [screenshotBase64, setScreenshotBase64] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Fee calculation
  const ownerFeePaise = tournament?.owner_registration_fee || 900000;
  const playerFeePaise = tournament?.registration_fee || 90000;
  const totalClubbedFeePaise = ownerFeePaise + playerFeePaise;
  const ownerFeeDisplay = formatPaiseToINR(ownerFeePaise);
  const playerFeeDisplay = formatPaiseToINR(playerFeePaise);
  const totalClubbedFeeDisplay = formatPaiseToINR(totalClubbedFeePaise);

  const isIconRequired = Boolean(tournament?.icon_player_enabled);

  // Owner profile image upload handler
  const handleOwnerImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setErrorMsg('Profile photo must be JPG, PNG or WebP');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg('Profile photo must be under 2 MB');
      return;
    }
    try {
      const compressed = await compressImageFile(file);
      if (compressed) {
        setOwnerProfileImageUrl(compressed);
        setErrorMsg(null);
        return;
      }
    } catch {
      // Fallback to raw FileReader
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setOwnerProfileImageUrl(reader.result as string);
      setErrorMsg(null);
    };
    reader.readAsDataURL(file);
  };

  // Payment screenshot upload handler
  const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file);
      if (compressed) {
        setScreenshotBase64(compressed);
        return;
      }
    } catch {
      // Fallback
    }
    const reader = new FileReader();
    reader.onloadend = () => setScreenshotBase64(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!ownerName.trim() || !contactEmail.trim() || !teamName.trim()) {
      setErrorMsg('Team Name, Owner Name, and Contact Email are required');
      return;
    }

    if (!contactPhone.trim()) {
      setErrorMsg('Owner mobile number is required');
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
          // Owner identity
          ownerName: ownerName.trim(),
          contactEmail: contactEmail.trim().toLowerCase(),
          contactPhone: contactPhone.trim(),
          // Owner Player #1 complete snapshot fields
          ownerRole,
          ownerBattingStyle,
          ownerBowlingStyle: ownerBowlingStyle || null,
          ownerJerseySize,
          ownerProfileImageUrl: ownerProfileImageUrl || null,
          // Team
          teamName: teamName.trim(),
          teamLogoBase64: teamLogoBase64 || null,
          // Payment
          paymentMethod,
          paymentScreenshotBase64: screenshotBase64 || null,
          // Icon Player #2 fields
          iconPlayerName: iconPlayerName.trim(),
          iconPlayerMobile: iconPlayerMobile.trim(),
          iconPlayerRole,
          iconPlayerBattingStyle,
          iconPlayerBowlingStyle: iconPlayerBowlingStyle || null,
          // iconExistingPlayerId intentionally NOT sent — API drops it anyway
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="👑 Team Owner Registration"
      maxWidth="md"
    >
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
              <span className="text-[10px] text-amber-300 uppercase font-bold block">Total</span>
              <span className="font-extrabold text-amber-400 text-sm">{totalClubbedFeeDisplay}</span>
            </div>
          </div>
          <p className="text-[10px] text-amber-200/70 text-center">
            1 Owner slot + 2 Player slots (Owner #1 + Icon #2) allocated atomically
          </p>
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

        {/* ============================================================
            SECTION 1: OWNER / PLAYER #1
            The authenticated Owner is Player #1 of the team.
            These fields create a tournament-specific snapshot independent
            of the reusable player profile.
            ============================================================ */}
        <div className="p-4 bg-amber-950/20 border border-amber-500/40 rounded-2xl space-y-3">
          <SectionHeader
            icon={<UserCheck className="w-4 h-4 text-amber-400" />}
            title="Owner / Player #1"
            badge="Player Slot #1"
            badgeColor="text-amber-400 bg-amber-950 border-amber-500/40"
          />
          <p className="text-[11px] text-slate-400 -mt-1 mb-2">
            Your details as the team owner and first player of the squad.
          </p>

          {/* Owner Profile Photo */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-300 block">
              Profile Photo
            </label>
            <div className="flex items-center gap-4 p-3 bg-slate-950/60 border border-dashed border-slate-700 rounded-xl">
              {ownerProfileImageUrl ? (
                <img
                  src={ownerProfileImageUrl}
                  alt="Owner Photo"
                  className="w-16 h-16 rounded-full object-cover border-2 border-amber-500 shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 shrink-0">
                  <ImageIcon className="w-7 h-7" />
                </div>
              )}
              <div className="flex-1">
                <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition-colors">
                  <Upload className="w-4 h-4 text-amber-400" />
                  <span>Upload Photo</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleOwnerImageUpload}
                  />
                </label>
                <p className="text-[10px] text-slate-400 mt-1">JPG, PNG or WebP (Max 2 MB)</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Full Name *"
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

          <div className="grid grid-cols-1 sm:grid-cols-1 gap-3">
            <Input
              label="Mobile Number *"
              type="tel"
              required
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="10 digit mobile"
            />
          </div>

          {/* Owner Player #1 Cricket Fields — same as normal Player */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <SelectField
              label="Cricket Role *"
              value={ownerRole}
              onChange={setOwnerRole}
              options={CRICKET_ROLE_OPTIONS}
            />
            <SelectField
              label="Batting Style *"
              value={ownerBattingStyle}
              onChange={setOwnerBattingStyle}
              options={BATTING_STYLE_OPTIONS}
            />
            <SelectField
              label="Bowling Style"
              value={ownerBowlingStyle}
              onChange={setOwnerBowlingStyle}
              options={BOWLING_STYLE_OPTIONS}
            />
            <div>
              <div className="flex items-center gap-1 mb-1">
                <label className="text-[11px] font-medium text-slate-300 block">Jersey Size *</label>
                <JerseyInfoTooltip />
              </div>
              <select
                value={ownerJerseySize}
                onChange={(e) => setOwnerJerseySize(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {JERSEY_SIZE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ============================================================
            SECTION 2: TEAM DETAILS
            ============================================================ */}
        <div className="p-4 bg-slate-900/80 border border-slate-700 rounded-2xl space-y-3">
          <SectionHeader
            icon={<Shield className="w-4 h-4 text-teal-400" />}
            title="Team Details"
            badgeColor="text-teal-400 bg-teal-950 border-teal-500/40"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Team / Franchise Name *"
              required
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="e.g. Royal Strikers Mumbai"
            />
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Team Logo Image (Optional)
              </label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleLogoFileChange}
                className="w-full text-xs text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-teal-950 file:text-teal-300 hover:file:bg-teal-900 cursor-pointer bg-slate-950 border border-slate-700 rounded-xl p-1"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">JPEG, PNG or WebP image (Max 5 MB)</span>
            </div>
          </div>
        </div>

        {/* ============================================================
            SECTION 3: ICON / PLAYER #2
            Always a new tournament-only player (is_tournament_only = TRUE,
            auth_user_id = NULL). No existing player lookup or attachment.
            ============================================================ */}
        <div className="p-4 bg-slate-900/80 border border-slate-700 rounded-2xl space-y-3">
          <SectionHeader
            icon={<Star className="w-4 h-4 text-amber-400" />}
            title={`Icon / Player #2${isIconRequired ? ' *' : ' (Optional)'}`}
            badge="Player Slot #2"
            badgeColor="text-emerald-400 bg-emerald-950 border-emerald-500/40"
          />
          <p className="text-[11px] text-slate-400 -mt-1 mb-2">
            Your nominated Icon player. A new tournament-only profile is created automatically.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label={`Icon Player Full Name${isIconRequired ? ' *' : ''}`}
              required={isIconRequired}
              value={iconPlayerName}
              onChange={(e) => setIconPlayerName(e.target.value)}
              placeholder="e.g. Rohit Sharma"
            />
            <Input
              label="Icon Player Mobile Number"
              type="tel"
              value={iconPlayerMobile}
              onChange={(e) => setIconPlayerMobile(e.target.value)}
              placeholder="10 digit mobile"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <SelectField
              label="Playing Role *"
              value={iconPlayerRole}
              onChange={setIconPlayerRole}
              options={CRICKET_ROLE_OPTIONS}
            />
            <SelectField
              label="Batting Style *"
              value={iconPlayerBattingStyle}
              onChange={setIconPlayerBattingStyle}
              options={BATTING_STYLE_OPTIONS}
            />
            <SelectField
              label="Bowling Style"
              value={iconPlayerBowlingStyle}
              onChange={setIconPlayerBowlingStyle}
              options={BOWLING_STYLE_OPTIONS}
            />
          </div>
        </div>

        {/* ============================================================
            SECTION 4: PAYMENT
            ============================================================ */}
        <div className="p-4 bg-slate-900/80 border border-slate-700 rounded-2xl space-y-3">
          <SectionHeader
            icon={<Crown className="w-4 h-4 text-amber-400" />}
            title="Payment Options"
          />

          <div className="space-y-3">
            <label className="text-[11px] font-semibold text-slate-300 block">Select Payment Method *</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentMethod('UPI_QR')}
                className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-colors ${
                  paymentMethod === 'UPI_QR'
                    ? 'bg-amber-950/70 border-amber-500 text-amber-300 ring-1 ring-amber-500'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <span className="font-bold text-xs">📱 Pay via UPI QR Code</span>
                <span className="text-[10px] text-slate-400">Scan QR code & upload payment receipt screenshot</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('ACKNOWLEDGE_BY_ORGANISER')}
                className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-colors ${
                  paymentMethod === 'ACKNOWLEDGE_BY_ORGANISER'
                    ? 'bg-amber-950/70 border-amber-500 text-amber-300 ring-1 ring-amber-500'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <span className="font-bold text-xs">🤝 Acknowledge by Organiser</span>
                <span className="text-[10px] text-slate-400">Offline / Direct arrangement with Organiser</span>
              </button>
            </div>

            {paymentMethod === 'ACKNOWLEDGE_BY_ORGANISER' ? (
              <div className="p-3 bg-amber-950/40 border border-amber-500/30 rounded-xl text-amber-300 text-xs">
                ℹ️ Organiser will verify payment offline. Your registration will enter <strong>PENDING</strong> review queue for Organiser acknowledgement.
              </div>
            ) : (
              <div className="flex items-center gap-4 p-3 bg-slate-950 rounded-xl border border-slate-800">
                {screenshotBase64 ? (
                  <img
                    src={screenshotBase64}
                    alt="Payment Screenshot"
                    className="w-16 h-16 object-contain rounded bg-slate-900 border border-emerald-500"
                  />
                ) : (
                  <div className="w-16 h-16 bg-slate-800 rounded flex items-center justify-center text-slate-500">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                )}
                <div className="flex-1 space-y-1">
                  <label className="cursor-pointer px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 inline-block">
                    Upload Payment Proof ({totalClubbedFeeDisplay})
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleScreenshotUpload}
                    />
                  </label>
                  <span className="text-[10px] text-slate-400 block">
                    Attach UPI transaction receipt for admin verification.
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={submitting} variant="gold">
            Register Owner + Icon ({totalClubbedFeeDisplay})
          </Button>
        </div>
      </form>
    </Modal>
  );
};
